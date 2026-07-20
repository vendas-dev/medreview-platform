export const dynamic = 'force-dynamic'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { IntelView }         from './IntelView'
import { computeForecast, RecurringSale } from '@/lib/telao/forecast'
import { todayInSaoPaulo, monthBoundsSaoPaulo, dayBoundsSaoPaulo, addDaysToDateStr, weekdayInSaoPaulo, hourInSaoPaulo } from '@/lib/timezone'

const VERT_LABEL: Record<string, string> = {
  medreview:   'Med-Review R1',
  anestreview: 'Anest-Review',
  oftreview:   'Oft-Review',
  ortoprev:    'Ortop-Review',
  ortopreview: 'Ortop-Review',
}
// Aceita tanto o código cru (ex: "anestreview", usado pelo telão) quanto o nome
// já formatado (ex: "Anest-Review", que é como os leads do HubSpot chegam) —
// normaliza os dois pro mesmo rótulo final, não importa maiúscula/espaço/hífen.
const VERT_CANON: Record<string, string> = {}
Object.values(VERT_LABEL).forEach(label => { VERT_CANON[label.toLowerCase().replace(/[\s-]/g, '')] = label })
const vLabel = (k: string) => {
  if (!k) return 'outros'
  const key = String(k).trim()
  if (VERT_LABEL[key]) return VERT_LABEL[key]
  const norm = key.toLowerCase().replace(/[\s-]/g, '')
  return VERT_CANON[norm] ?? key
}

// Dias corridos (NÃO dias úteis) — conta todos os dias do período, inclusive fins de semana.
// Clona as datas para não mutar os objetos originais recebidos (ex: 'now' é reutilizado depois).
function bizDays(start: Date, end: Date) {
  const s = new Date(start); s.setHours(0,0,0,0)
  const e = new Date(end);   e.setHours(23,59,59,999)
  return Math.max(Math.floor((e.getTime() - s.getTime()) / 86400000) + 1, 0)
}

function matchSales(all: any[], c: any) {
  return (all ?? []).filter((e: any) =>
    (e.closer_id && e.closer_id === c.id) ||
    (c.hubspot_id && e.closer_hubspot_id && e.closer_hubspot_id === c.hubspot_id)
  )
}

// Mesma lógica de matchSales — a maioria dos eventos do telão tem closer_id=null
// e só vem com closer_hubspot_id preenchido, então é obrigatório ter esse fallback
// (sem isso, a contagem por closer fica zerada mesmo com eventos existindo).
const matchCerts = matchSales

function parseInsight(raw: string | null): any | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export default async function IntelPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, role, name, team, hubspot_id').eq('id', user.id).single()

  const isAdmin   = (profile as any)?.role === 'superadmin'
  const today     = todayInSaoPaulo()
  // Respeitar filtro de mês da URL, senão usa mês atual
  const monthKey  = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month)
    ? searchParams.month
    : today.slice(0, 7)
  const [y, m]    = monthKey.split('-').map(Number)
  const { start: mStart, end: mEnd } = monthBoundsSaoPaulo(monthKey)
  const now       = new Date()
  const isCurrentMonth = monthKey === today.slice(0, 7)
  const refDate   = isCurrentMonth ? now : new Date(y, m, 0) // último dia do mês se passado
  const bizTotal  = bizDays(new Date(y, m - 1, 1), new Date(y, m, 0))
  const bizPassed = bizDays(new Date(y, m - 1, 1), refDate)
  const bizLeft   = isCurrentMonth ? Math.max(bizTotal - bizPassed, 0) : 0
  const admin     = createAdminClient()

  if (isAdmin) {
    const [
      { data: closers },
      { data: allSales },
      { data: allLeads },
      { data: goals },
      { data: insightRow },
      { data: allCerts },
    ] = await Promise.all([
      admin.from('profiles').select('id, name, team, hubspot_id, avatar_url').neq('role','superadmin').order('name'),
      admin.from('telao_events')
        .select('closer_id, closer_hubspot_id, value, vertical, product, occurred_at, seller_type, sold_by_ambassador, is_self_checkout, sale_type, is_recurring, subscription_id, installment_number, total_installments')
        .eq('event_type','sale').gte('occurred_at', mStart).lte('occurred_at', mEnd),
      admin.from('hubspot_leads')
        .select('owner_id, deal_stage, vertical').gte('created_at_hs', mStart).lte('created_at_hs', mEnd),
      admin.from('closer_goals').select('*').eq('month', monthKey),
      admin.from('commercial_insights').select('content').eq('insight_date', today).eq('scope','global').maybeSingle(),
      admin.from('telao_events')
        .select('closer_id, closer_hubspot_id, occurred_at')
        .eq('event_type','ambassador_certified').gte('occurred_at', mStart).lte('occurred_at', mEnd),
    ])

    // Histórico COMPLETO de vendas recorrentes (não limitado ao mês) — necessário
    // para calcular quantas parcelas faltam em cada assinatura e a taxa de aderência.
    // Inclui closer_id/hubspot_id/vertical pra dar pra filtrar no cliente (forecast
    // também precisa respeitar os filtros de time/closer/vertical).
    const { data: allRecurringRaw } = await admin.from('telao_events')
      .select('subscription_id, installment_number, total_installments, value, occurred_at, closer_id, closer_hubspot_id, vertical')
      .eq('event_type','sale').eq('is_recurring', true).not('subscription_id','is',null)

    const goalsMap = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))
    const sales    = allSales ?? []

    // Certificações de embaixadores (evento do telão, time R1) — total do mês.
    // A contagem por closer é feita mais abaixo, dentro do map de closerStats,
    // usando o mesmo matcher de fallback (closer_id OU hubspot_id) das vendas.
    const certs = allCerts ?? []
    const totalCerts = certs.length

    const totalRev   = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const totalSales = sales.length

    // ── Split nova vs recorrente (mês corrente) ──────────────
    const novaSales      = sales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
    const recorrenteSales= sales.filter((e: any) => e.sale_type === 'recorrente')
    const totalNewRev    = novaSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const totalRecurringRev = recorrenteSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)

    // ── Forecast de recorrência (usa histórico completo, não só o mês) ──
    const recurringSalesForForecast: RecurringSale[] = (allRecurringRaw ?? [])
      .filter((e: any) => e.subscription_id && e.installment_number && e.total_installments)
      .map((e: any) => ({
        subscription_id:    e.subscription_id,
        installment_number: e.installment_number,
        total_installments: e.total_installments,
        value:               Number(e.value) || 0,
        occurred_at:         e.occurred_at,
      }))
    const forecast = computeForecast(recurringSalesForForecast, totalRecurringRev)

    const byType = {
      closer:      { rev: 0, count: 0 },
      ambassador:  { rev: 0, count: 0 },
      selfcheckout:{ rev: 0, count: 0 },
    }
    sales.forEach((e: any) => {
      const v = Number(e.value) || 0
      if (e.is_self_checkout || e.seller_type === 'self_checkout')
        { byType.selfcheckout.rev += v; byType.selfcheckout.count++ }
      else if (e.sold_by_ambassador || e.seller_type === 'ambassador')
        { byType.ambassador.rev += v; byType.ambassador.count++ }
      else { byType.closer.rev += v; byType.closer.count++ }
    })

    const byVertical: Record<string, any> = {}
    sales.forEach((e: any) => {
      const key = e.vertical ?? 'outros'; const label = vLabel(key); const v = Number(e.value) || 0
      if (!byVertical[key]) byVertical[key] = { label, rev:0, count:0, closer:0, ambassador:0, selfcheckout:0, closerRev:0, ambassadorRev:0, selfcheckoutRev:0, leads:0 }
      byVertical[key].rev += v; byVertical[key].count++
      if (e.is_self_checkout || e.seller_type === 'self_checkout')
        { byVertical[key].selfcheckout++; byVertical[key].selfcheckoutRev += v }
      else if (e.sold_by_ambassador || e.seller_type === 'ambassador')
        { byVertical[key].ambassador++; byVertical[key].ambassadorRev += v }
      else { byVertical[key].closer++; byVertical[key].closerRev += v }
    })
    ;(allLeads ?? []).forEach((l: any) => {
      const key = l.vertical ?? 'outros'; const label = vLabel(key)
      if (!byVertical[key]) byVertical[key] = { label, rev:0, count:0, closer:0, ambassador:0, selfcheckout:0, closerRev:0, ambassadorRev:0, selfcheckoutRev:0, leads:0 }
      byVertical[key].leads++
    })

    // Ranking dos produtos mais vendidos — agrupado por produto+vertical (não só
    // produto), já que produtos com o mesmo nome existem em verticais diferentes.
    const productMap: Record<string, { product:string; vertical:string; count:number; rev:number }> = {}
    sales.forEach((e: any) => {
      if (!e.product) return
      const vlabel = vLabel(e.vertical ?? 'outros')
      if (vlabel === 'outros') return
      const key = `${e.product}|||${vlabel}`
      if (!productMap[key]) productMap[key] = { product: e.product, vertical: vlabel, count: 0, rev: 0 }
      productMap[key].count++
      productMap[key].rev += Number(e.value) || 0
    })
    const productRanking = Object.values(productMap).sort((a,b) => b.rev - a.rev).slice(0, 5)

    // Ticket médio por vertical — usa só vendas 'nova' (primeira parcela conta
    // como nova; parcelas recorrentes 2+ NÃO entram, senão distorce a média
    // pra baixo em verticais com assinatura, tipo Med-Review R1).
    const avgTicketMap: Record<string, { rev:number; count:number }> = {}
    novaSales.forEach((e: any) => {
      const label = vLabel(e.vertical ?? 'outros')
      if (label === 'outros') return
      if (!avgTicketMap[label]) avgTicketMap[label] = { rev:0, count:0 }
      avgTicketMap[label].rev += Number(e.value) || 0
      avgTicketMap[label].count++
    })
    const avgTicketByVertical = Object.entries(avgTicketMap).map(([label, v]) => ({
      label, avgTicket: v.count > 0 ? v.rev / v.count : 0, count: v.count,
    })).sort((a,b) => b.avgTicket - a.avgTicket)

    // Distribuição de vendas por dia da semana e por hora — sempre em horário
    // de SP (não no fuso do servidor, mesmo cuidado do resto do painel).
    const WEEKDAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    const salesByWeekday = WEEKDAY_LABELS.map(label => ({ label, count: 0, rev: 0 }))
    const salesByHour    = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
    sales.forEach((e: any) => {
      if (!e.occurred_at) return
      const wd = weekdayInSaoPaulo(e.occurred_at)
      salesByWeekday[wd].count++; salesByWeekday[wd].rev += Number(e.value) || 0
      salesByHour[hourInSaoPaulo(e.occurred_at)].count++
    })

    const closerStats = (closers ?? []).map((c: any) => {
      const mySales   = matchSales(sales, c)
      const myLeads   = (allLeads ?? []).filter((l: any) =>
        c.hubspot_id && l.owner_id != null && String(l.owner_id).trim() === String(c.hubspot_id).trim()
      )
      const myGoal    = goalsMap[c.id] ?? null
      const revMonth  = mySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const goalSales = Number(myGoal?.goal_sales ?? 0)
      const pctGoal   = goalSales > 0 ? (revMonth / goalSales) * 100 : 0
      const projected = bizPassed > 0 ? (revMonth / bizPassed) * bizTotal : 0
      const leadsTotal = myLeads.length
      const leadsOpen  = myLeads.filter((l: any) => !['closedwon','closedlost'].includes(l.deal_stage ?? '')).length
      const convRate   = leadsTotal > 0 ? (mySales.length / leadsTotal) * 100 : 0
      const sortedS    = [...mySales].sort((a: any, b: any) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))
      const daysSince  = sortedS[0]?.occurred_at ? Math.floor((Date.now() - new Date(sortedS[0].occurred_at).getTime()) / 86400000) : 999
      const byVert: Record<string, number> = {}
      const salesByVert: Record<string, number> = {}
      mySales.forEach((e: any) => {
        if (e.vertical) {
          const k = vLabel(e.vertical)
          byVert[k]     = (byVert[k]     ?? 0) + (Number(e.value) || 0)
          salesByVert[k]= (salesByVert[k]?? 0) + 1
        }
      })
      const leadsByVert: Record<string, number> = {}
      myLeads.forEach((l: any) => {
        if (l.vertical) { const k = vLabel(l.vertical); leadsByVert[k] = (leadsByVert[k] ?? 0) + 1 }
      })
      // Breakdown de tipo por closer
      const closerSalesCount     = mySales.filter((e:any)=>!e.is_self_checkout&&e.seller_type!=='self_checkout'&&!e.sold_by_ambassador&&e.seller_type!=='ambassador').length
      const ambassadorSalesCount = mySales.filter((e:any)=>e.sold_by_ambassador||e.seller_type==='ambassador').length
      const selfCoCount          = mySales.filter((e:any)=>e.is_self_checkout||e.seller_type==='self_checkout').length
      const closerRevAmt         = mySales.filter((e:any)=>!e.is_self_checkout&&e.seller_type!=='self_checkout'&&!e.sold_by_ambassador&&e.seller_type!=='ambassador').reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
      const ambassadorRevAmt     = mySales.filter((e:any)=>e.sold_by_ambassador||e.seller_type==='ambassador').reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
      const selfCoRevAmt         = mySales.filter((e:any)=>e.is_self_checkout||e.seller_type==='self_checkout').reduce((s:number,e:any)=>s+(Number(e.value)||0),0)

      return { id:c.id, name:c.name, team:c.team, avatar_url:c.avatar_url??null, revenue_month:revMonth, sales_month:mySales.length, goal_sales:goalSales, pct_goal:pctGoal, revenue_projected:projected, leads_month:leadsTotal, leads_open:leadsOpen, conversion_rate:convRate, days_since_last_sale:daysSince, revenue_by_vertical:byVert, sales_by_vertical:salesByVert, leads_by_vertical:leadsByVert, closer_count:closerSalesCount, ambassador_count:ambassadorSalesCount, selfco_count:selfCoCount, closer_rev:closerRevAmt, ambassador_rev:ambassadorRevAmt, selfco_rev:selfCoRevAmt, biz_total:bizTotal, biz_passed:bizPassed, biz_left:bizLeft, goal_ambassador:Number(myGoal?.goal_ambassador??0), ambassadors_certified:matchCerts(certs, c).length }
    })

    return <IntelView
      isAdmin={true} profile={profile as any}
      closerStats={closerStats}
      insightData={parseInsight(insightRow?.content ?? null)}
      insightDate={today} snapshot={null} currentMonth={monthKey}
      adminExtra={{ totalRev, totalSales, totalLeadsHS:(allLeads??[]).length, byType, byVertical, bizTotal, bizPassed, bizLeft, totalNewRev, totalRecurringRev, forecast, totalCerts, productRanking, avgTicketByVertical, salesByWeekday, salesByHour,
        // Dados brutos — usados no cliente pra recalcular os gráficos respeitando
        // TODOS os filtros ativos (vertical sozinho já filtra tudo, não só quem
        // bateu com um closer cadastrado; time/closer continuam exigindo o match).
        rawSales: sales, rawLeads: allLeads ?? [], rawRecurring: allRecurringRaw ?? [] }}
    />
  }

  // ── Closer (inalterado) ───────────────────────────────
  const uid = user.id, hubId = (profile as any)?.hubspot_id ?? null
  const weekAgo = new Date(Date.now()-7*86400000).toISOString()
  const twoWAgo = new Date(Date.now()-14*86400000).toISOString()
  const todayDayNum = Number(today.slice(8, 10))
  const prevY = m === 1 ? y - 1 : y
  const prevM = m === 1 ? 12 : m - 1
  const prevMonthKey = `${prevY}-${String(prevM).padStart(2, '0')}`
  const { start: prevMStart } = monthBoundsSaoPaulo(prevMonthKey)
  // Fim do mês anterior "até o mesmo dia" (comparação like-for-like), não o mês inteiro
  const prevMEnd = dayBoundsSaoPaulo(addDaysToDateStr(`${prevMonthKey}-01`, todayDayNum - 1)).end

  const [
    {data:salesById},{data:salesByHub},{data:salesPrevW},{data:salesPrevM},
    {data:myLeads},{data:myGoal},{data:myInsight},
  ] = await Promise.all([
    admin.from('telao_events').select('id,value,vertical,product,occurred_at').eq('event_type','sale').eq('closer_id',uid).gte('occurred_at',mStart).lte('occurred_at',mEnd),
    hubId?admin.from('telao_events').select('id,value,vertical,product,occurred_at').eq('event_type','sale').eq('closer_hubspot_id',hubId).gte('occurred_at',mStart).lte('occurred_at',mEnd):Promise.resolve({data:[]}),
    admin.from('telao_events').select('id,value').eq('event_type','sale').eq('closer_id',uid).gte('occurred_at',twoWAgo).lt('occurred_at',weekAgo),
    admin.from('telao_events').select('id,value').eq('event_type','sale').eq('closer_id',uid).gte('occurred_at',prevMStart).lte('occurred_at',prevMEnd),
    hubId?admin.from('hubspot_leads').select('deal_stage').eq('owner_id',hubId).gte('created_at_hs',mStart).lte('created_at_hs',mEnd):Promise.resolve({data:[]}),
    admin.from('closer_goals').select('*').eq('user_id',uid).eq('month',monthKey).maybeSingle(),
    admin.from('commercial_insights').select('content').eq('insight_date',today).eq('scope',uid).maybeSingle(),
  ])

  const salesMap=new Map()
  ;[...(salesById??[]),(salesByHub??[])].flat().forEach((e:any)=>salesMap.set(e.id,e))
  const salesM=Array.from(salesMap.values())
  const revMonth=salesM.reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
  const revWeek=salesM.filter((e:any)=>e.occurred_at>=weekAgo).reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
  const revPrevW=(salesPrevW??[]).reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
  const revPrevM=(salesPrevM??[]).reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
  const goalSales=Number((myGoal as any)?.goal_sales??0)
  const pctGoal=goalSales>0?(revMonth/goalSales)*100:0
  const projected=bizPassed>0?(revMonth/bizPassed)*bizTotal:0
  const deltaWeek=revPrevW>0?((revWeek-revPrevW)/revPrevW)*100:0
  const deltaMon=revPrevM>0?((revMonth-revPrevM)/revPrevM)*100:0
  const leadsTotal=(myLeads??[]).length, leadsOpen=(myLeads??[]).filter((l:any)=>!['closedwon','closedlost'].includes(l.deal_stage??'')).length
  const convRate=leadsTotal>0?(salesM.length/leadsTotal)*100:0
  const sortedS=[...salesM].sort((a:any,b:any)=>(b.occurred_at??'').localeCompare(a.occurred_at??''))
  const daysSince=sortedS[0]?.occurred_at?Math.floor((Date.now()-new Date(sortedS[0].occurred_at).getTime())/86400000):999
  const byVert:Record<string,number>={}
  salesM.forEach((e:any)=>{if(e.vertical){const k=vLabel(e.vertical);byVert[k]=(byVert[k]??0)+(Number(e.value)||0)}})
  // Ranking dos produtos mais vendidos por esse closer — mesmo critério do admin
  // (agrupado por produto+vertical, já que produtos repetem nome entre verticais).
  const myProductMap: Record<string, { product:string; vertical:string; count:number; rev:number }> = {}
  salesM.forEach((e:any) => {
    if (!e.product) return
    const vlabel = vLabel(e.vertical ?? 'outros')
    const key = `${e.product}|||${vlabel}`
    if (!myProductMap[key]) myProductMap[key] = { product: e.product, vertical: vlabel, count: 0, rev: 0 }
    myProductMap[key].count++
    myProductMap[key].rev += Number(e.value) || 0
  })
  const productRanking = Object.values(myProductMap).sort((a,b) => b.rev - a.rev).slice(0, 5)

  // Ticket médio por vertical — só vendas 'nova' (mesma regra do admin: parcelas
  // recorrentes 2+ não entram, senão distorce a média pra baixo).
  const myNovaSales = salesM.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
  const myAvgTicketMap: Record<string, { rev:number; count:number }> = {}
  myNovaSales.forEach((e: any) => {
    if (!e.vertical) return
    const k = vLabel(e.vertical)
    if (!myAvgTicketMap[k]) myAvgTicketMap[k] = { rev:0, count:0 }
    myAvgTicketMap[k].rev += Number(e.value) || 0
    myAvgTicketMap[k].count++
  })
  const avgTicketByVertical = Object.entries(myAvgTicketMap).map(([label, v]) => ({
    label, avgTicket: v.count > 0 ? v.rev / v.count : 0, count: v.count,
  })).sort((a,b) => b.avgTicket - a.avgTicket)

  // Distribuição de vendas por dia da semana e por hora, só as minhas — sempre em horário de SP.
  const WEEKDAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const salesByWeekday = WEEKDAY_LABELS.map(label => ({ label, count: 0, rev: 0 }))
  const salesByHour    = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  salesM.forEach((e: any) => {
    if (!e.occurred_at) return
    const wd = weekdayInSaoPaulo(e.occurred_at)
    salesByWeekday[wd].count++; salesByWeekday[wd].rev += Number(e.value) || 0
    salesByHour[hourInSaoPaulo(e.occurred_at)].count++
  })

  const last7:{label:string;rev:number}[]=[]
  for(let i=6;i>=0;i--){
    const dateStr = addDaysToDateStr(today, -i)
    const { start, end } = dayBoundsSaoPaulo(dateStr)
    const rev = salesM.filter((e:any)=>e.occurred_at>=start && e.occurred_at<=end).reduce((s:number,e:any)=>s+(Number(e.value)||0),0)
    const [dy,dm,dd] = dateStr.split('-').map(Number)
    const weekday = new Date(Date.UTC(dy,dm-1,dd)).getUTCDay()
    last7.push({label:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][weekday],rev})
  }

  return <IntelView isAdmin={false} profile={profile as any}
    closerStats={[]} insightData={parseInsight((myInsight as any)?.content??null)}
    insightDate={today} currentMonth={monthKey} adminExtra={null}
    snapshot={{revenue_month:revMonth,sales_month:salesM.length,revenue_projected:projected,pct_goal:pctGoal,goal_sales:goalSales,delta_week_pct:deltaWeek,delta_month_pct:deltaMon,leads_month:leadsTotal,leads_open:leadsOpen,conversion_rate:convRate,days_since_last_sale:daysSince,revenue_by_vertical:byVert,business_days_total:bizTotal,business_days_passed:bizPassed,business_days_remaining:bizLeft,last7,productRanking,avgTicketByVertical,salesByWeekday,salesByHour}}/>
}
