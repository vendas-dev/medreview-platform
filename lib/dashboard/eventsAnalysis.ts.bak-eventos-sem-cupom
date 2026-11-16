import { todayInSaoPaulo, dayBoundsSaoPaulo, monthBoundsSaoPaulo, addDaysToDateStr, weekdayInSaoPaulo } from '@/lib/timezone'
import { eventMoneyLeftOnTable } from '@/lib/telao/format'

const VERT_LABEL: Record<string, string> = {
  medreview: 'Med-Review R1', anestreview: 'Anest-Review', oftreview: 'Oft-Review',
  ortoprev: 'Ortop-Review', ortopreview: 'Ortop-Review',
}
const vLabel = (k: string) => VERT_LABEL[k] ?? k

// ── Período — mesmos atalhos usados no resto do sistema (Hoje/Ontem/Esta
// semana/Este mês), mais "Mês passado" e "Intervalo" personalizado. Tudo em
// horário de São Paulo, usando os mesmos helpers já usados em todo o resto
// do dashboard (page.tsx) e do telão.
export function getEventsPeriodBounds(period: string, customStart?: string, customEnd?: string) {
  const today = todayInSaoPaulo()

  if (period === 'hoje') {
    const b = dayBoundsSaoPaulo(today)
    return { ...b, label: 'Hoje' }
  }
  if (period === 'ontem') {
    const y = addDaysToDateStr(today, -1)
    const b = dayBoundsSaoPaulo(y)
    return { ...b, label: 'Ontem' }
  }
  if (period === 'semana') {
    const wd = weekdayInSaoPaulo(new Date()) // 0=dom..6=sáb
    const daysSinceMonday = (wd + 6) % 7
    const weekStart = addDaysToDateStr(today, -daysSinceMonday)
    const { start } = dayBoundsSaoPaulo(weekStart)
    const { end } = dayBoundsSaoPaulo(today)
    return { start, end, label: 'Esta semana' }
  }
  if (period === 'mes_passado') {
    const monthKeyStr = today.slice(0, 7)
    const [y, m] = monthKeyStr.split('-').map(Number)
    const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const b = monthBoundsSaoPaulo(prevKey)
    return { ...b, label: 'Mês passado' }
  }
  if (period === 'custom' && customStart) {
    const { start } = dayBoundsSaoPaulo(customStart)
    const { end } = dayBoundsSaoPaulo(customEnd || customStart)
    const label = customEnd && customEnd !== customStart ? `${customStart} a ${customEnd}` : customStart
    return { start, end, label }
  }
  // 'mes' e fallback
  const monthKeyStr = today.slice(0, 7)
  const b = monthBoundsSaoPaulo(monthKeyStr)
  return { ...b, label: 'Este mês' }
}

export interface EventsAnalysisParams {
  period: string; customStart?: string; customEnd?: string
  vertical?: string; eventCategory?: string; eventName?: string; closer?: string
}

// ── Calcula tudo que a seção de Eventos precisa: KPIs, receita/quantidade
// por evento, ranking de produtos e de canal — e as OPÇÕES de filtro
// contínuas (cada dimensão calculada olhando as OUTRAS já selecionadas,
// nunca a si mesma, pra nunca mostrar uma opção sem resultado nenhum).
export async function computeEventsAnalysis(admin: any, params: EventsAnalysisParams) {
  const { start, end, label } = getEventsPeriodBounds(params.period, params.customStart, params.customEnd)

  // Qualquer venda com cupom de evento (EV_) — é esse o critério combinado
  // pra tudo que é "venda de evento" no sistema.
  const { data: rows } = await admin.from('telao_events')
    .select('value, vertical, product, event_name, event_category, coupon_code, closer_id, closer_hubspot_id, is_self_checkout, occurred_at')
    .eq('event_type', 'sale').ilike('coupon_code', 'EV_%')
    .gte('occurred_at', start).lte('occurred_at', end).limit(999999)
  const all = (rows ?? []) as any[]

  const { data: closerProfiles } = await admin.from('profiles').select('id, name, hubspot_id').neq('role', 'superadmin')
  const closers = (closerProfiles ?? []) as any[]
  const closerNameByHub = Object.fromEntries(closers.filter((c: any) => c.hubspot_id).map((c: any) => [String(c.hubspot_id), c.name]))
  const closerNameById  = Object.fromEntries(closers.map((c: any) => [c.id, c.name]))

  function closerKeyOf(r: any): string {
    if (r.is_self_checkout) return 'self'
    if (r.closer_hubspot_id) return `hub:${r.closer_hubspot_id}`
    if (r.closer_id) return `id:${r.closer_id}`
    return 'self'
  }
  function closerNameOf(r: any): string {
    if (r.is_self_checkout) return 'Self-checkout'
    if (r.closer_hubspot_id && closerNameByHub[String(r.closer_hubspot_id)]) return closerNameByHub[String(r.closer_hubspot_id)]
    if (r.closer_id && closerNameById[r.closer_id]) return closerNameById[r.closer_id]
    return 'Self-checkout'
  }

  const { vertical = '', eventCategory = '', eventName = '', closer = '' } = params

  // ── Filtros contínuos — cada dimensão ignora A SI MESMA ao calcular suas
  // próprias opções, mas respeita todas as outras já escolhidas. Exemplo do
  // pedido: se o intervalo de data só tem eventos X e Z, o dropdown de nome
  // de evento só mostra X e Z, mesmo que outros eventos existam fora do
  // período selecionado.
  function applyFilters(rowsIn: any[], skip: string) {
    return rowsIn.filter(r => {
      if (skip !== 'vertical' && vertical && r.vertical !== vertical) return false
      if (skip !== 'category' && eventCategory && r.event_category !== eventCategory) return false
      if (skip !== 'name' && eventName && r.event_name !== eventName) return false
      if (skip !== 'closer' && closer && closerKeyOf(r) !== closer) return false
      return true
    })
  }

  const verticalOptions = [...new Set(applyFilters(all, 'vertical').map((r: any) => r.vertical).filter(Boolean))]
    .sort().map(v => ({ value: v as string, label: vLabel(v as string) }))
  const categoryOptions = [...new Set(applyFilters(all, 'category').map((r: any) => r.event_category).filter(Boolean))].sort() as string[]
  const nameOptions     = [...new Set(applyFilters(all, 'name').map((r: any) => r.event_name).filter(Boolean))].sort() as string[]
  const closerRowsForOptions = applyFilters(all, 'closer')
  const closerOptionsMap = new Map<string, string>()
  closerRowsForOptions.forEach((r: any) => closerOptionsMap.set(closerKeyOf(r), closerNameOf(r)))
  const closerOptions = [...closerOptionsMap.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name))

  // ── Dataset final, com TODOS os filtros aplicados de verdade
  const filtered = all.filter((r: any) => {
    if (vertical && r.vertical !== vertical) return false
    if (eventCategory && r.event_category !== eventCategory) return false
    if (eventName && r.event_name !== eventName) return false
    if (closer && closerKeyOf(r) !== closer) return false
    return true
  })

  const totalRevenue = filtered.reduce((s: number, r: any) => s + (Number(r.value) || 0), 0)
  const totalSales = filtered.length
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0
  const moneyLeft = filtered.reduce((s: number, r: any) => s + eventMoneyLeftOnTable(r), 0)

  // Receita e quantidade de vendas POR evento (event_name)
  const byEventMap: Record<string, { revenue: number; count: number }> = {}
  filtered.forEach((r: any) => {
    const key = r.event_name || 'Sem nome'
    if (!byEventMap[key]) byEventMap[key] = { revenue: 0, count: 0 }
    byEventMap[key].revenue += Number(r.value) || 0
    byEventMap[key].count++
  })
  const byEvent = Object.entries(byEventMap).map(([eventNameOut, v]) => ({ eventName: eventNameOut, ...v })).sort((a, b) => b.revenue - a.revenue)

  // Ranking de produtos por QUANTIDADE — com vertical e evento indicados,
  // pra separar o mesmo produto vendido em eventos/verticais diferentes.
  const productMap: Record<string, { product: string; vertical: string; eventName: string; count: number; revenue: number }> = {}
  filtered.forEach((r: any) => {
    if (!r.product) return
    const key = `${r.product}|||${r.vertical}|||${r.event_name}`
    if (!productMap[key]) productMap[key] = { product: r.product, vertical: vLabel(r.vertical), eventName: r.event_name || '—', count: 0, revenue: 0 }
    productMap[key].count++
    productMap[key].revenue += Number(r.value) || 0
  })
  const productRanking = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 10)

  // Ranking por canal — self-checkout e cada closer, nomeado
  const channelMap: Record<string, { label: string; revenue: number; count: number; isCloser: boolean }> = {}
  filtered.forEach((r: any) => {
    const key = closerKeyOf(r)
    const name = closerNameOf(r)
    if (!channelMap[key]) channelMap[key] = { label: name, revenue: 0, count: 0, isCloser: key !== 'self' }
    channelMap[key].revenue += Number(r.value) || 0
    channelMap[key].count++
  })
  const channelRanking = Object.values(channelMap).sort((a, b) => b.revenue - a.revenue)

  return {
    totalRevenue, totalSales, avgTicket, moneyLeft, byEvent, productRanking, channelRanking,
    filterOptions: { verticals: verticalOptions, eventCategories: categoryOptions, eventNames: nameOptions, closers: closerOptions },
    label,
  }
}
