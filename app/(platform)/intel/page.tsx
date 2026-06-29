export const dynamic = 'force-dynamic'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { IntelView }         from './IntelView'

const VERT_LABEL: Record<string, string> = {
  medreview:   'Med-Review R1',
  anestreview: 'Anest-Review',
  oftreview:   'Oft-Review',
  ortoprev:    'Ortop-Review',
  ortopreview: 'Ortop-Review',
}
const vLabel = (k: string) => VERT_LABEL[k] ?? k

function bizDays(start: Date, end: Date) {
  let c = 0; const d = new Date(start)
  while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1) }
  return c
}

function matchSales(all: any[], c: any) {
  return (all ?? []).filter((e: any) =>
    (e.closer_id && e.closer_id === c.id) ||
    (c.hubspot_id && e.closer_hubspot_id && e.closer_hubspot_id === c.hubspot_id)
  )
}

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
  const today     = new Date().toISOString().slice(0, 10)
  // Respeitar filtro de mês da URL, senão usa mês atual
  const monthKey  = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month)
    ? searchParams.month
    : today.slice(0, 7)
  const [y, m]    = monthKey.split('-').map(Number)
  const mStart    = new Date(y, m - 1, 1).toISOString()
  const mEnd      = new Date(y, m, 0, 23, 59, 59).toISOString()
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
    ] = await Promise.all([
      admin.from('profiles').select('id, name, team, hubspot_id, avatar_url').neq('role','superadmin').order('name'),
      admin.from('telao_events')
        .select('closer_id, closer_hubspot_id, value, vertical, occurred_at, seller_type, sold_by_ambassador, is_self_checkout')
        .eq('event_type','sale').gte('occurred_at', mStart).lte('occurred_at', mEnd),
      admin.from('hubspot_leads')
        .select('owner_id, deal_stage, vertical').gte('created_at_hs', mStart).lte('created_at_hs', mEnd),
      admin.from('closer_goals').select('*').eq('month', monthKey),
      admin.from('commercial_insights').select('content').eq('insight_date', today).eq('scope','global').maybeSingle(),
    ])

    const goalsMap = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))
    const sales    = allSales ?? []

    const totalRev   = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const totalSales = sales.length

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
      const key = l.vertical ?? 'outros'
      if (byVertical[key]) byVertical[key].leads++
    })

    const closerStats = (closers ?? []).map((c: any) => {
      const mySales   = matchSales(sales, c)
      const myLeads   = (allLeads ?? []).filter((l: any) => c.hubspot_id && l.owner_id === c.hubspot_id)
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

      return { id:c.id, name:c.name, team:c.team, avatar_url:c.avatar_url??null, revenue_month:revMonth, sales_month:mySales.length, goal_sales:goalSales, pct_goal:pctGoal, revenue_projected:projected, leads_month:leadsTotal, leads_open:leadsOpen, conversion_rate:convRate, days_since_last_sale:daysSince, revenue_by_vertical:byVert, sales_by_vertical:salesByVert, leads_by_vertical:leadsByVert, closer_count:closerSalesCount, ambassador_count:ambassadorSalesCount, selfco_count:selfCoCount, closer_rev:closerRevAmt, ambassador_rev:ambassadorRevAmt, selfco_rev:selfCoRevAmt, biz_total:bizTotal, biz_passed:bizPassed, biz_left:bizLeft }
    })

    return <IntelView
      isAdmin={true} profile={profile as any}
      closerStats={closerStats}
      insightData={parseInsight(insightRow?.content ?? null)}
      insightDate={today} snapshot={null} currentMonth={monthKey}
      adminExtra={{ totalRev, totalSales, totalLeadsHS:(allLeads??[]).length, byType, byVertical, bizTotal, bizPassed, bizLeft }}
    />
  }

  // ── Closer (inalterado) ───────────────────────────────
  const uid = user.id, hubId = (profile as any)?.hubspot_id ?? null
  const weekAgo = new Date(Date.now()-7*86400000).toISOString()
  const twoWAgo = new Date(Date.now()-14*86400000).toISOString()
  const prevMStart = new Date(y,m-2,1).toISOString()
  const prevMEnd   = new Date(y,m-2,now.getDate(),23,59,59).toISOString()

  const [
    {data:salesById},{data:salesByHub},{data:salesPrevW},{data:salesPrevM},
    {data:myLeads},{data:myGoal},{data:myInsight},
  ] = await Promise.all([
    admin.from('telao_events').select('id,value,vertical,occurred_at').eq('event_type','sale').eq('closer_id',uid).gte('occurred_at',mStart).lte('occurred_at',mEnd),
    hubId?admin.from('telao_events').select('id,value,vertical,occurred_at').eq('event_type','sale').eq('closer_hubspot_id',hubId).gte('occurred_at',mStart).lte('occurred_at',mEnd):Promise.resolve({data:[]}),
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
  const last7:{label:string;rev:number}[]=[]
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);const de=new Date(d);de.setHours(23,59,59,999);const rev=salesM.filter((e:any)=>{const t=new Date(e.occurred_at).getTime();return t>=d.getTime()&&t<=de.getTime()}).reduce((s:number,e:any)=>s+(Number(e.value)||0),0);last7.push({label:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()],rev})}

  return <IntelView isAdmin={false} profile={profile as any}
    closerStats={[]} insightData={parseInsight((myInsight as any)?.content??null)}
    insightDate={today} currentMonth={monthKey} adminExtra={null}
    snapshot={{revenue_month:revMonth,sales_month:salesM.length,revenue_projected:projected,pct_goal:pctGoal,goal_sales:goalSales,delta_week_pct:deltaWeek,delta_month_pct:deltaMon,leads_month:leadsTotal,leads_open:leadsOpen,conversion_rate:convRate,days_since_last_sale:daysSince,revenue_by_vertical:byVert,business_days_total:bizTotal,business_days_passed:bizPassed,business_days_remaining:bizLeft,last7}}/>
}
