import { todayInSaoPaulo, dayBoundsSaoPaulo, monthBoundsSaoPaulo, addDaysToDateStr } from '@/lib/timezone'

// ── Verticais ─────────────────────────────────────────────────────────
// O campo "vertical" dos links vem como texto cru de quem gera o link
// (ex: "anestreview", "Anest-Review", "ortoprev"…), então é normalizado pros
// 4 grupos do painel. Quem não casa com nenhum cai em "outros" — fica
// contado no total, mas não vira card de vertical.
export type VKey = 'anest' | 'oft' | 'ortop' | 'r1'
export const VKEYS: VKey[] = ['anest', 'oft', 'ortop', 'r1']        // ordem de exibição

// Rótulo usado em company_goals.scope (mesmo do page.tsx do dashboard)
export const GOAL_SCOPE: Record<VKey, string> = {
  anest: 'Anest-Review', oft: 'Oft-Review', ortop: 'Ortop-Review', r1: 'Med-Review R1',
}

export function verticalKey(raw: string | null | undefined): VKey | null {
  const s = String(raw ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '')
  if (!s) return null
  if (s.includes('anest')) return 'anest'
  if (s.includes('oft')) return 'oft'
  if (s.includes('ortop') || s.includes('orto')) return 'ortop'
  if (s.includes('medreview') || s.includes('r1') || s.startsWith('med')) return 'r1'
  return null
}

// ── Fuso: São Paulo é UTC-3 fixo (sem horário de verão desde 2019), mesma
// regra já usada pra gravar datas nas rotas de links/vendas.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000
const spShift = (iso: string) => new Date(new Date(iso).getTime() - SP_OFFSET_MS)
export const spDateOf = (iso: string): string => spShift(iso).toISOString().slice(0, 10)
export const spHourOf = (iso: string): number => spShift(iso).getUTCHours()

interface Bucket { value: number; count: number }
const emptyBucket = (): Bucket => ({ value: 0, count: 0 })
type ByV = Record<VKey | 'outros', Bucket>
const emptyByV = (): ByV => ({ anest: emptyBucket(), oft: emptyBucket(), ortop: emptyBucket(), r1: emptyBucket(), outros: emptyBucket() })
const num = (v: any) => Number(v) || 0

// ── AO VIVO ───────────────────────────────────────────────────────────
// 1) Links gerados HOJE ainda em aberto: não pagos, não substituídos por
//    reemissão e não excluídos — a mesma definição dos "Links pra cobrar".
//    Se o mesmo negócio tem mais de um link em aberto, conta só o mais
//    recente (senão o valor do mesmo negócio seria somado duas vezes).
//    Quando o lead paga, o link ganha converted_at e SOME daqui, e o valor
//    abaixa sozinho.
// 2) Meta x Realizado do mês (geral e por vertical), com o realizado
//    calculado na hora — a mesma fonte do dashboard (company_goals, com
//    fallback pra soma das metas dos closers).
export async function computeForecastLive(admin: any, since?: string | null) {
  const today = todayInSaoPaulo()
  const monthKey = today.slice(0, 7)
  const { start: dStart, end: dEnd } = dayBoundsSaoPaulo(today)
  const { start: mStart, end: mEnd } = monthBoundsSaoPaulo(monthKey)

  const nowIso = new Date().toISOString()
  // Janela de segurança: só links gerados nos últimos 30 dias entram no
  // "em aberto válido" — um link muito antigo e esquecido não é pipeline.
  const { start: validFrom } = dayBoundsSaoPaulo(addDaysToDateStr(today, -30))

  const [linksRes, validRes, salesRes, companyGoalsRes, closerGoalsRes] = await Promise.all([
    admin.from('geracoes_links')
      .select('id, deal_id, deal_value, generated_at, vertical, converted_at, superseded_by_link_id')
      .gte('generated_at', dStart).lte('generated_at', dEnd).is('dismissed_at', null).limit(999999),
    // Links ainda VÁLIDOS: não pagos, não substituídos, não excluídos e com
    // vencimento no futuro (expires_at nulo não entra — não dá pra saber se vale).
    admin.from('geracoes_links')
      .select('id, deal_id, deal_value, generated_at')
      .is('converted_at', null).is('superseded_by_link_id', null).is('dismissed_at', null)
      .gt('expires_at', nowIso).gte('generated_at', validFrom).limit(999999),
    admin.from('telao_events').select('value, vertical, sale_type, occurred_at')
      .eq('event_type', 'sale').gte('occurred_at', mStart).lte('occurred_at', mEnd).limit(999999),
    admin.from('company_goals').select('scope, goal_value').eq('month', monthKey),
    admin.from('closer_goals').select('goal_sales').eq('month', monthKey),
  ])
  if (linksRes.error) console.error('[forecast] links:', linksRes.error.message)
  if (validRes.error) console.error('[forecast] links válidos:', validRes.error.message)
  if (salesRes.error) console.error('[forecast] vendas:', salesRes.error.message)

  // ── links de hoje
  const todayLinks = (linksRes.data ?? []) as any[]
  const open = todayLinks.filter(l => !l.converted_at && !l.superseded_by_link_id)
  const latestByDeal = new Map<string, any>()
  for (const l of open) {
    const key = String(l.deal_id ?? l.id)
    const cur = latestByDeal.get(key)
    if (!cur || String(l.generated_at) > String(cur.generated_at)) latestByDeal.set(key, l)
  }
  const pending = [...latestByDeal.values()]

  const byVertical = emptyByV()
  const hoursMap = new Map<number, { value: number; count: number; byVertical: ByV }>()
  let totalValue = 0
  for (const l of pending) {
    const v = num(l.deal_value)
    const vk: VKey | 'outros' = verticalKey(l.vertical) ?? 'outros'
    byVertical[vk].value += v; byVertical[vk].count++
    totalValue += v
    const h = spHourOf(l.generated_at)
    if (!hoursMap.has(h)) hoursMap.set(h, { value: 0, count: 0, byVertical: emptyByV() })
    const hb = hoursMap.get(h)!
    hb.value += v; hb.count++
    hb.byVertical[vk].value += v; hb.byVertical[vk].count++
  }
  // só as horas que realmente geraram link — ordenadas
  const byHour = [...hoursMap.entries()].sort((a, b) => a[0] - b[0])
    .map(([hour, b]) => ({ hour, label: `${String(hour).padStart(2, '0')}h`, ...b }))

  // ── pipeline de links ainda válidos (qualquer dia de geração), um por negócio
  const validByDeal = new Map<string, any>()
  for (const l of ((validRes.data ?? []) as any[])) {
    const key = String(l.deal_id ?? l.id)
    const cur = validByDeal.get(key)
    if (!cur || String(l.generated_at) > String(cur.generated_at)) validByDeal.set(key, l)
  }
  const validLinks = [...validByDeal.values()]
  const validValue = validLinks.reduce((s, l) => s + num(l.deal_value), 0)

  const paid = todayLinks.filter(l => l.converted_at)
  const paidValue = paid.reduce((s, l) => s + num(l.deal_value), 0)

  // ── meta x realizado do mês
  const companyGoals: Record<string, number> = Object.fromEntries(((companyGoalsRes.data ?? []) as any[]).map(g => [g.scope, num(g.goal_value)]))
  const closersGoalSum = ((closerGoalsRes.data ?? []) as any[]).reduce((s, g) => s + num(g.goal_sales), 0)
  const metaGeral = companyGoals['geral'] > 0 ? companyGoals['geral'] : closersGoalSum

  const realizedByV: Record<VKey | 'outros', number> = { anest: 0, oft: 0, ortop: 0, r1: 0, outros: 0 }
  let realizedTotal = 0
  const sinceMs = since ? Date.parse(since) : NaN
  let recurringPaidSince = 0
  for (const e of ((salesRes.data ?? []) as any[])) {
    const v = num(e.value)
    realizedTotal += v
    if (Number.isFinite(sinceMs) && e.sale_type === 'recorrente' && Date.parse(e.occurred_at) > sinceMs) recurringPaidSince += v
    realizedByV[verticalKey(e.vertical) ?? 'outros'] += v
  }

  const [y, m] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const dayOfMonth = Number(today.slice(8, 10))
  const pctMonthElapsed = Math.min((dayOfMonth / daysInMonth) * 100, 100)

  return {
    generatedAt: new Date().toISOString(),
    today,
    links: {
      open: { value: totalValue, count: pending.length },
      byVertical,
      byHour,
      generatedCount: todayLinks.length,
      paid: { count: paid.length, value: paidValue },
      // pipeline: todos os links ainda válidos (não só os de hoje)
      valid: { value: validValue, count: validLinks.length },
    },
    // recorrência que já caiu DEPOIS da tela carregar (sai da "prevista")
    recurringPaidSince,
    goals: {
      monthKey, daysInMonth, dayOfMonth, pctMonthElapsed,
      geral: { meta: metaGeral, realizado: realizedTotal },
      byVertical: Object.fromEntries(VKEYS.map(k => [k, { meta: companyGoals[GOAL_SCOPE[k]] ?? 0, realizado: realizedByV[k] }])) as Record<VKey, { meta: number; realizado: number }>,
      realizadoOutros: realizedByV.outros,
    },
  }
}

// ── HISTÓRICO ─────────────────────────────────────────────────────────
// Links gerados nos 15 dias ANTES de hoje (hoje não entra). Conta TODOS os
// gerados — pagos ou não — porque é histórico: não some quando o lead paga.
// Só os links excluídos de propósito (dismissed_at) ficam de fora, já que
// "somem de todas as telas".
export const HISTORY_DAYS = 15

export async function computeForecastHistory(admin: any) {
  const today = todayInSaoPaulo()
  const fromDate = addDaysToDateStr(today, -HISTORY_DAYS)
  const toDate = addDaysToDateStr(today, -1)
  const { start } = dayBoundsSaoPaulo(fromDate)
  const { end } = dayBoundsSaoPaulo(toDate)

  const { data, error } = await admin.from('geracoes_links')
    .select('generated_at, vertical')
    .gte('generated_at', start).lte('generated_at', end).is('dismissed_at', null).limit(999999)
  if (error) console.error('[forecast] histórico:', error.message)

  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => addDaysToDateStr(fromDate, i))
  const dayIndex = new Map(days.map((d, i) => [d, i]))
  const mk = () => ({ count: 0, daily: Array.from({ length: HISTORY_DAYS }, () => 0) })
  const byVertical: Record<VKey, { count: number; daily: number[] }> = { anest: mk(), oft: mk(), ortop: mk(), r1: mk() }
  let outros = 0, total = 0

  for (const l of ((data ?? []) as any[])) {
    const idx = dayIndex.get(spDateOf(l.generated_at))
    if (idx === undefined) continue            // fora da janela (borda de fuso)
    total++
    const vk = verticalKey(l.vertical)
    if (!vk) { outros++; continue }
    byVertical[vk].count++
    byVertical[vk].daily[idx]++
  }

  return { today, from: fromDate, to: toDate, days, byVertical, outros, total }
}

export type ForecastLive = Awaited<ReturnType<typeof computeForecastLive>>
export type ForecastHistory = Awaited<ReturnType<typeof computeForecastHistory>>
