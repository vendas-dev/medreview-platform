import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayInSaoPaulo, monthBoundsSaoPaulo, dayBoundsSaoPaulo, addDaysToDateStr, weekdayInSaoPaulo, hourInSaoPaulo } from '@/lib/timezone'
import { eventMoneyLeftOnTable, extractCouponDiscountPct } from '@/lib/telao/format'

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const VERT_LABEL: Record<string, string> = {
  medreview: 'Med-Review R1', anestreview: 'Anest-Review', oftreview: 'Oft-Review',
  ortoprev: 'Ortop-Review', ortopreview: 'Ortop-Review',
}
const vLabel = (k: string) => VERT_LABEL[k] ?? k
const ALL_VERTICALS = ['Anest-Review', 'Oft-Review', 'Ortop-Review', 'Med-Review R1']

function matchesCloser(e: { closer_id?: string|null; closer_hubspot_id?: string|null; co_closer_id?: string|null; co_closer_hubspot_id?: string|null }, c: { id:string; hubspot_id:string|null }) {
  if (e.closer_id && e.closer_id === c.id) return true
  if (c.hubspot_id && e.closer_hubspot_id && String(e.closer_hubspot_id).trim() === String(c.hubspot_id).trim()) return true
  if (e.co_closer_id && e.co_closer_id === c.id) return true
  if (c.hubspot_id && e.co_closer_hubspot_id && String(e.co_closer_hubspot_id).trim() === String(c.hubspot_id).trim()) return true
  return false
}

function rangeForPeriod(period: string) {
  const today = todayInSaoPaulo()
  if (period === 'ontem') {
    const d = addDaysToDateStr(today, -1)
    const { start, end } = dayBoundsSaoPaulo(d)
    return { start, end, label: 'Ontem' }
  }
  if (period === 'semana') {
    const wd = weekdayInSaoPaulo(new Date())
    const daysSinceMonday = (wd + 6) % 7
    const monday = addDaysToDateStr(today, -daysSinceMonday)
    return { start: dayBoundsSaoPaulo(monday).start, end: dayBoundsSaoPaulo(today).end, label: 'Essa semana' }
  }
  if (period === 'mes') {
    const monthKey = today.slice(0, 7)
    const { start } = monthBoundsSaoPaulo(monthKey)
    return { start, end: dayBoundsSaoPaulo(today).end, label: 'Este mês' }
  }
  const { start, end } = dayBoundsSaoPaulo(today)
  return { start, end, label: 'Hoje' }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const period = req.nextUrl.searchParams.get('period') ?? 'mes'
  const { start, end, label } = rangeForPeriod(period)
  const today = todayInSaoPaulo()
  const { start: tStart, end: tEnd } = dayBoundsSaoPaulo(today)

  const admin = createAdminClient()
  const [{ data: sales }, { data: certs }, { data: closerProfiles }, { data: leads }] = await Promise.all([
    admin.from('telao_events')
      .select('value, occurred_at, seller_type, sold_by_ambassador, is_self_checkout, sale_type, co_closer_id, co_closer_hubspot_id, closer_id, closer_hubspot_id, coupon_code, vertical, product, event_type, is_recurring, installment_number')
      .eq('event_type', 'sale').gte('occurred_at', start).lte('occurred_at', end).limit(999999),
    admin.from('telao_events')
      .select('closer_id, closer_hubspot_id')
      .eq('event_type', 'ambassador_certified').gte('occurred_at', start).lte('occurred_at', end).limit(999999),
    admin.from('profiles').select('id, name, hubspot_id, avatar_url').neq('role', 'superadmin'),
    admin.from('hubspot_leads').select('owner_id').gte('created_at_hs', start).lte('created_at_hs', end).limit(999999),
  ])

  const salesList = sales ?? []
  const closers    = closerProfiles ?? []

  // Meta individual de cada closer — SEMPRE a meta MENSAL, independente do
  // período selecionado no filtro. Em "hoje" ou "essa semana", a barra vai
  // aparecer pequena mesmo que o closer esteja no ritmo certo — isso é
  // esperado e correto: mostra o quanto daquele período já contribuiu pra
  // meta do mês inteiro, não uma "meta do dia" que não existe no sistema.
  const monthKey = today.slice(0, 7)
  const { data: closerGoals } = await admin.from('closer_goals').select('user_id, goal_sales').eq('month', monthKey)
  const goalsMap: Record<string, number> = {}
  ;(closerGoals ?? []).forEach((g: any) => { goalsMap[g.user_id] = Number(g.goal_sales) || 0 })

  // ── KPIs do período (mesma regra de sempre: ticket médio só 1ª parcela) ──
  const totalRevenue = salesList.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const totalSales   = salesList.length
  const novaSales     = salesList.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
  const novaRev       = novaSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const avgTicket     = novaSales.length > 0 ? novaRev / novaSales.length : 0
  const moneyLeft      = salesList.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
  const todaySales    = salesList.filter((e: any) => e.occurred_at >= tStart && e.occurred_at <= tEnd)
  const revenueToday  = todaySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)

  const kpis = {
    totalRevenue, totalSales: novaSales.length, avgTicket, moneyLeft,
    revenueToday, salesToday: todaySales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova').length,
    certsCount: (certs ?? []).length,
  }

  // ── Por vertical (mesmas 4 + "Outros" se sobrar algo fora) ────
  const companyDiscountByVertical: Record<string, { sum: number; count: number }> = {}
  salesList.forEach((e: any) => {
    if (e.is_self_checkout) return
    const pct = extractCouponDiscountPct(e.coupon_code)
    if (pct === null) return
    const vlabel = vLabel(e.vertical ?? 'outros')
    if (!companyDiscountByVertical[vlabel]) companyDiscountByVertical[vlabel] = { sum: 0, count: 0 }
    companyDiscountByVertical[vlabel].sum += pct
    companyDiscountByVertical[vlabel].count++
  })
  const companyAvgDiscount = (vlabel: string) => {
    const d = companyDiscountByVertical[vlabel]
    return d && d.count > 0 ? d.sum / d.count : 0
  }
  const verticalBreakdown = ALL_VERTICALS.map(vlabel => {
    const inVert = salesList.filter((e: any) => vLabel(e.vertical ?? 'outros') === vlabel)
    const rev = inVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const novaInVert = inVert.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
    const novaRevInVert = novaInVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const moneyLeftVert = inVert.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
    return {
      vertical: vlabel, revenue: rev, count: inVert.length,
      avgTicket: novaInVert.length > 0 ? novaRevInVert / novaInVert.length : 0,
      moneyLeft: moneyLeftVert, avgDiscountPct: companyAvgDiscount(vlabel),
    }
  })

  // ── Vendas por tipo (4 categorias, sem duplicar total) ────────
  const byType = {
    closer: { rev: 0, count: 0 }, ambassador: { rev: 0, count: 0 },
    selfcheckout: { rev: 0, count: 0 }, ambassadorCloser: { rev: 0, count: 0 },
  }
  salesList.forEach((e: any) => {
    const v = Number(e.value) || 0
    const isAmbassador = e.sold_by_ambassador || e.seller_type === 'ambassador'
    if (e.is_self_checkout || e.seller_type === 'self_checkout') { byType.selfcheckout.rev += v; byType.selfcheckout.count++ }
    else if (isAmbassador && e.co_closer_id) { byType.ambassadorCloser.rev += v; byType.ambassadorCloser.count++ }
    else if (isAmbassador) { byType.ambassador.rev += v; byType.ambassador.count++ }
    else { byType.closer.rev += v; byType.closer.count++ }
  })

  // ── Nova vs recorrente ─────────────────────────────────────────
  const novaVsRecorrente = { nova: { rev: 0, count: 0 }, recorrente: { rev: 0, count: 0 } }
  salesList.forEach((e: any) => {
    const v = Number(e.value) || 0
    const key: 'nova' | 'recorrente' = (e.sale_type ?? 'nova') === 'recorrente' ? 'recorrente' : 'nova'
    novaVsRecorrente[key].rev += v
    novaVsRecorrente[key].count++
  })

  // ── Embaixadores certificados por closer (com foto) ───────────
  const certsByCloser: Record<string, { name: string; count: number; avatarUrl: string | null }> = {}
  ;(certs ?? []).forEach((e: any) => {
    const closer = closers.find((c: any) =>
      (e.closer_id && e.closer_id === c.id) ||
      (c.hubspot_id && e.closer_hubspot_id && String(e.closer_hubspot_id).trim() === String(c.hubspot_id).trim())
    )
    const key  = closer?.id ?? e.closer_hubspot_id ?? 'desconhecido'
    const name = closer?.name ?? 'Desconhecido'
    if (!certsByCloser[key]) certsByCloser[key] = { name, count: 0, avatarUrl: closer?.avatar_url ?? null }
    certsByCloser[key].count++
  })
  const certsRanking = Object.values(certsByCloser).sort((a, b) => b.count - a.count)

  // ── Distribuição por dia da semana e por horário ──────────────
  const byWeekday = WEEKDAY_LABELS.map(l => ({ label: l, rev: 0, count: 0 }))
  const byHour    = Array.from({ length: 24 }, (_, h) => ({ hour: h, rev: 0, count: 0 }))
  salesList.forEach((e: any) => {
    const v  = Number(e.value) || 0
    const wd = weekdayInSaoPaulo(e.occurred_at)
    const h  = hourInSaoPaulo(e.occurred_at)
    byWeekday[wd].rev += v; byWeekday[wd].count++
    byHour[h].rev += v; byHour[h].count++
  })
  const topDay  = [...byWeekday].sort((a, b) => b.rev - a.rev)[0]
  const topHour = [...byHour].sort((a, b) => b.rev - a.rev)[0]

  // ── Ranking de produtos — mesma lógica do page.tsx, agora por período ──
  const productMap: Record<string, { product: string; vertical: string; count: number; rev: number }> = {}
  salesList.forEach((e: any) => {
    if (!e.product) return
    const vlabel = vLabel(e.vertical ?? 'outros')
    if (vlabel === 'outros') return
    const key = `${e.product}|||${vlabel}`
    if (!productMap[key]) productMap[key] = { product: e.product, vertical: vlabel, count: 0, rev: 0 }
    productMap[key].count++
    productMap[key].rev += Number(e.value) || 0
  })
  const productRanking = Object.values(productMap).sort((a, b) => b.rev - a.rev).slice(0, 5)

  // ── Performance por closer — comparação completa, não só receita ──
  const leadsList = leads ?? []
  const closerPerformance = closers.map((c: any) => {
    const mySales = salesList.filter((e: any) => matchesCloser(e, c))
    const revenue = mySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const salesCount = mySales.length
    const myNova = mySales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
    const myNovaRev = myNova.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const avgTicket = myNova.length > 0 ? myNovaRev / myNova.length : 0
    const moneyLeftCloser = mySales.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
    const myLeads = leadsList.filter((l: any) => c.hubspot_id && l.owner_id != null && String(l.owner_id).trim() === String(c.hubspot_id).trim()).length
    const convRate = myLeads > 0 ? (salesCount / myLeads) * 100 : 0
    const withDiscount = mySales.filter((e: any) => !e.is_self_checkout)
      .map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
    const avgDiscountPct = withDiscount.length > 0 ? withDiscount.reduce((s, p) => s + p, 0) / withDiscount.length : 0
    return {
      id: c.id, name: c.name, avatarUrl: c.avatar_url, revenue, salesCount, avgTicket, convRate, moneyLeft: moneyLeftCloser, avgDiscountPct,
      goalSales: goalsMap[c.id] ?? 0,
    }
  }).filter(c => c.salesCount > 0 || c.revenue > 0).sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json({
    period, label, start, end,
    kpis, verticalBreakdown, productRanking, closerPerformance,
    byType, novaVsRecorrente, certsRanking, byWeekday, byHour, topDay, topHour,
    totalRevenue, totalSales,
  })
}
