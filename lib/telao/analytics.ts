import { VERTICALS, VerticalId } from './types'
import { eventMoneyLeftOnTable, fmtBRL } from './format'

// ══════════════════════════════════════════════════════════════════════════
// Telão Completo — cálculos (funções puras, sem tela, sem banco).
//
// REGRAS DE RECEITA (tudo é receita; a composição é só "como ela entrou"):
//  • Receita = soma de `value` de TODA venda (event_type = 'sale'), incluindo parcelas de recorrência.
//  • Composição (mutuamente exclusiva, soma = receita):
//      evento      → cupom começa com EV_            (mesmo critério da Análise de Eventos)
//      recorrência → parcela de assinatura (is_recurring / sale_type 'recorrente' / parcela > 1)
//      nova        → todo o resto
//  • Canal: Self Checkout · Embaixadores · Imparáveis (closers) — mesma regra do Telão ao vivo.
//  • Camadas À PARTE (não saem do total, só são destacadas):
//      transferida       → venda com transferência/co-atribuição de closer
//      desconto ignorado → venda marcada pra ficar fora da conta de desconto
//      deixado na mesa   → eventMoneyLeftOnTable (cupom _X%, só closer, só 1ª parcela, sem desc. ignorado)
//  • Ticket médio = só vendas NOVAS (nova + evento): recorrência não entra, igual ao Telão ao vivo.
//  • Todos os dias/horas em horário de São Paulo.
// ══════════════════════════════════════════════════════════════════════════

export type PanelId = 'geral' | VerticalId
export const PANELS: PanelId[] = ['geral', 'anestreview', 'oftreview', 'ortopreview', 'medreview']
export const VERT_IDS: VerticalId[] = ['anestreview', 'oftreview', 'ortopreview', 'medreview']
export type RevKind = 'nova' | 'recorrencia' | 'evento'
export type Channel = 'closer' | 'embaixador' | 'self'
export type PayKind = 'cartao' | 'pix' | 'boleto' | 'outros'
export type Gran = 'dia' | 'semana' | 'mes'

export const KIND_LABEL: Record<RevKind, string> = { nova: 'Venda nova', recorrencia: 'Recorrência', evento: 'Eventos' }
export const CHANNEL_LABEL: Record<Channel, string> = { closer: 'Imparáveis', embaixador: 'Embaixadores', self: 'Self Checkout' }
export const PAY_LABEL: Record<PayKind, string> = { cartao: 'Cartão', pix: 'Pix', boleto: 'Boleto', outros: 'Outros' }
export const PANEL_LABEL: Record<PanelId, string> = {
  geral: 'Geral', anestreview: 'Anest-Review', oftreview: 'Oft-Review', ortopreview: 'Ortop-Review', medreview: 'Med-Review R1',
}
/** Nome do escopo na tabela company_goals */
export const GOAL_SCOPE: Record<PanelId, string> = {
  geral: 'geral', anestreview: 'Anest-Review', oftreview: 'Oft-Review', ortopreview: 'Ortop-Review', medreview: 'Med-Review R1',
}

// ── Linha crua do banco (só as colunas que a gente busca) ───────────────────
export interface RawSale {
  id: string; event_type: string; vertical: VerticalId; value: number | null; occurred_at: string
  seller_type?: string | null; is_self_checkout?: boolean | null; sold_by_ambassador?: boolean | null
  is_recurring?: boolean | null; installment_number?: number | null; sale_type?: string | null
  coupon_code?: string | null; desconto_ignorado?: boolean | null
  transferred_at?: string | null; co_closer_id?: string | null
  product?: string | null; state?: string | null; payment_type?: string | null; payment_installments?: number | null
  event_name?: string | null
}

// ── Venda já "digerida" (calculada UMA vez ao carregar) ─────────────────────
export interface Sale {
  id: string; vertical: VerticalId; value: number; at: string
  day: string; hour: number; weekday: number          // SP
  kind: RevKind; channel: Channel
  discountIgnored: boolean; transferred: boolean
  left: number                                         // dinheiro deixado na mesa
  product: string | null; uf: string | null; pay: PayKind | null
  installments: number | null; eventName: string | null
}

// ── Fuso: tudo em São Paulo ─────────────────────────────────────────────────
const SP_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
export function spParts(iso: string): { day: string; hour: number } {
  const p = SP_FMT.formatToParts(new Date(iso))
  const g = (t: string) => p.find(x => x.type === t)!.value
  return { day: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) % 24 }
}
export const todaySP = (d: Date = new Date()): string => spParts(d.toISOString()).day

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
export const diffDays = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
export const weekdayOf = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay()      // 0=Dom
export const monthOf = (day: string): string => day.slice(0, 7)
export const daysInMonth = (month: string): number => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() }
export const monthStartOf = (day: string): string => `${day.slice(0, 7)}-01`
export const monthEndOf = (day: string): string => `${day.slice(0, 7)}-${String(daysInMonth(day.slice(0, 7))).padStart(2, '0')}`
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number); const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
const weekStartOf = (day: string): string => addDays(day, -((weekdayOf(day) + 6) % 7))    // segunda-feira
const quarterStartOf = (day: string): string => { const [y, m] = day.split('-').map(Number); return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01` }

// ── Classificação ───────────────────────────────────────────────────────────
export function revKind(e: { coupon_code?: string | null; is_recurring?: boolean | null; sale_type?: string | null; installment_number?: number | null }): RevKind {
  if (e.coupon_code && /^EV_/i.test(e.coupon_code.trim())) return 'evento'
  if (e.is_recurring === true || e.sale_type === 'recorrente' || (e.installment_number ?? 1) > 1) return 'recorrencia'
  return 'nova'
}
export function channelOf(e: { is_self_checkout?: boolean | null; seller_type?: string | null; sold_by_ambassador?: boolean | null }): Channel {
  if (e.is_self_checkout || e.seller_type === 'self_checkout') return 'self'
  if (e.sold_by_ambassador || e.seller_type === 'ambassador') return 'embaixador'
  return 'closer'
}
export function payKind(t?: string | null): PayKind | null {
  if (!t) return null
  const u = t.toUpperCase()
  if (u.includes('CREDIT') || u.includes('CARD') || u.includes('CART')) return 'cartao'
  if (u.includes('PIX')) return 'pix'
  if (u.includes('BOLETO') || u.includes('SLIP')) return 'boleto'
  return 'outros'
}

const UF_NAMES: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES',
  goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB',
  parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}
export const UF_LIST = Object.values(UF_NAMES)
export function normalizeUF(s?: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  if (/^[A-Za-z]{2}$/.test(t)) { const u = t.toUpperCase(); return UF_LIST.includes(u) ? u : null }
  const key = t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ')
  return UF_NAMES[key] ?? null
}

/** Converte a linha do banco numa venda calculada. Devolve null se não for venda com valor. */
export function toSale(r: RawSale): Sale | null {
  if (r.event_type !== 'sale') return null
  if (r.value === null || r.value === undefined || !Number.isFinite(Number(r.value))) return null
  const { day, hour } = spParts(r.occurred_at)
  return {
    id: r.id, vertical: r.vertical, value: Number(r.value), at: r.occurred_at, day, hour, weekday: weekdayOf(day),
    kind: revKind(r), channel: channelOf(r),
    discountIgnored: r.desconto_ignorado === true,
    transferred: !!r.transferred_at || !!r.co_closer_id,
    left: eventMoneyLeftOnTable(r as any),
    product: r.product?.trim() || null, uf: normalizeUF(r.state), pay: payKind(r.payment_type),
    installments: r.payment_installments ?? null, eventName: r.event_name?.trim() || null,
  }
}
export const toSales = (rows: RawSale[]): Sale[] => rows.map(toSale).filter((s): s is Sale => s !== null)

// ══ Períodos ════════════════════════════════════════════════════════════════
export type PresetId = 'mes' | 'mes_ant' | 'trimestre' | 'ult30' | 'ult90' | 'ano' | 'tudo' | 'custom'
export interface Range { start: string; end: string }
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'mes', label: 'Este mês' }, { id: 'mes_ant', label: 'Mês anterior' }, { id: 'trimestre', label: 'Trimestre' },
  { id: 'ult30', label: '30 dias' }, { id: 'ult90', label: '90 dias' }, { id: 'ano', label: 'Ano' }, { id: 'tudo', label: 'Tudo' },
]
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
export const validRange = (r: Range): boolean => DAY_RE.test(r.start) && DAY_RE.test(r.end) && r.start <= r.end
export const rangeLength = (r: Range): number => (validRange(r) ? diffDays(r.start, r.end) + 1 : 0)
/** Todos os dias do período. Período inválido (ex.: antes de carregar) devolve [] — nunca quebra nem entra em loop. */
export function eachDay(r: Range): string[] {
  if (!validRange(r) || rangeLength(r) > 4000) return []
  const out: string[] = []; for (let d = r.start; d <= r.end; d = addDays(d, 1)) out.push(d); return out
}

export function resolvePreset(id: PresetId, today: string, firstDay: string, custom?: Range): Range {
  switch (id) {
    case 'mes':       return { start: monthStartOf(today), end: today }
    case 'mes_ant': { const pm = addMonths(monthOf(today), -1); return { start: `${pm}-01`, end: `${pm}-${String(daysInMonth(pm)).padStart(2, '0')}` } }
    case 'trimestre': return { start: quarterStartOf(today), end: today }
    case 'ult30':     return { start: addDays(today, -29), end: today }
    case 'ult90':     return { start: addDays(today, -89), end: today }
    case 'ano':       return { start: `${today.slice(0, 4)}-01-01`, end: today }
    case 'tudo':      return { start: firstDay < today ? firstDay : today, end: today }
    case 'custom':    return custom && custom.start <= custom.end ? custom : { start: monthStartOf(today), end: today }
  }
}

/** Período de comparação "justo": mesmos dias do mês/trimestre anterior, ou a janela imediatamente anterior. */
export function previousRange(id: PresetId, r: Range): Range | null {
  const len = rangeLength(r)
  if (id === 'tudo') return null
  if (id === 'mes') {
    const pm = addMonths(monthOf(r.start), -1)
    const end = addDays(`${pm}-01`, len - 1)
    return { start: `${pm}-01`, end: end > `${pm}-${String(daysInMonth(pm)).padStart(2, '0')}` ? `${pm}-${String(daysInMonth(pm)).padStart(2, '0')}` : end }
  }
  if (id === 'mes_ant') { const pm = addMonths(monthOf(r.start), -1); return { start: `${pm}-01`, end: `${pm}-${String(daysInMonth(pm)).padStart(2, '0')}` } }
  if (id === 'trimestre') {
    const ps = quarterStartOf(addDays(r.start, -1))
    const pe = addDays(r.start, -1)
    const end = addDays(ps, len - 1)
    return { start: ps, end: end > pe ? pe : end }
  }
  if (id === 'ano') { const y = Number(r.start.slice(0, 4)) - 1; return { start: `${y}-01-01`, end: `${y}${r.end.slice(4)}` } }
  return { start: addDays(r.start, -len), end: addDays(r.start, -1) }      // 30d, 90d, personalizado
}
export const suggestGran = (r: Range): Gran => { const n = rangeLength(r); return n <= 45 ? 'dia' : n <= 200 ? 'semana' : 'mes' }

export const filterSales = (all: Sale[], panel: PanelId, r: Range): Sale[] =>
  all.filter(s => s.day >= r.start && s.day <= r.end && (panel === 'geral' || s.vertical === panel))

// ══ Resumo ══════════════════════════════════════════════════════════════════
const zeroV = (): Record<VerticalId, { revenue: number; count: number }> => ({
  anestreview: { revenue: 0, count: 0 }, oftreview: { revenue: 0, count: 0 }, ortopreview: { revenue: 0, count: 0 }, medreview: { revenue: 0, count: 0 },
})
export interface Summary {
  revenue: number; count: number; days: number; perDay: number
  byKind: Record<RevKind, { revenue: number; count: number }>
  byChannel: Record<Channel, { revenue: number; count: number }>
  byVertical: Record<VerticalId, { revenue: number; count: number }>
  ticket: number                                  // só vendas novas (nova + evento)
  left: number; leftPct: number
  discountIgnored: { count: number; revenue: number }
  transferred: { count: number; revenue: number }
  recurrencePct: number
}
export function summarize(sales: Sale[], days: number): Summary {
  const byKind: Summary['byKind'] = { nova: { revenue: 0, count: 0 }, recorrencia: { revenue: 0, count: 0 }, evento: { revenue: 0, count: 0 } }
  const byChannel: Summary['byChannel'] = { closer: { revenue: 0, count: 0 }, embaixador: { revenue: 0, count: 0 }, self: { revenue: 0, count: 0 } }
  const byVertical = zeroV()
  let revenue = 0, left = 0
  const di = { count: 0, revenue: 0 }, tr = { count: 0, revenue: 0 }
  for (const s of sales) {
    revenue += s.value; left += s.left
    byKind[s.kind].revenue += s.value; byKind[s.kind].count++
    byChannel[s.channel].revenue += s.value; byChannel[s.channel].count++
    byVertical[s.vertical].revenue += s.value; byVertical[s.vertical].count++
    if (s.discountIgnored) { di.count++; di.revenue += s.value }
    if (s.transferred) { tr.count++; tr.revenue += s.value }
  }
  const newRev = byKind.nova.revenue + byKind.evento.revenue, newCnt = byKind.nova.count + byKind.evento.count
  return {
    revenue, count: sales.length, days, perDay: days > 0 ? revenue / days : 0, byKind, byChannel, byVertical,
    ticket: newCnt > 0 ? newRev / newCnt : 0, left, leftPct: revenue > 0 ? (left / revenue) * 100 : 0,
    discountIgnored: di, transferred: tr, recurrencePct: revenue > 0 ? (byKind.recorrencia.revenue / revenue) * 100 : 0,
  }
}
export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

// ══ Série por período (barras) ═════════════════════════════════════════════
export interface Bucket {
  key: string; label: string; start: string; end: string; revenue: number; count: number
  byKind: Record<RevKind, number>; byVertical: Record<VerticalId, number>; byChannel: Record<Channel, number>
}
export function bucketKey(day: string, g: Gran): string { return g === 'dia' ? day : g === 'semana' ? weekStartOf(day) : monthOf(day) }
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function bucketLabel(key: string, g: Gran): string {
  if (g === 'mes') { const [y, m] = key.split('-'); return `${MESES[Number(m) - 1]}/${y.slice(2)}` }
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}
export function bucketize(sales: Sale[], r: Range, g: Gran): Bucket[] {
  if (!validRange(r) || rangeLength(r) > 4000) return []
  const keys: string[] = []
  if (g === 'mes') { for (let m = monthOf(r.start); m <= monthOf(r.end); m = addMonths(m, 1)) keys.push(m) }
  else { for (let d = bucketKey(r.start, g); d <= r.end; d = addDays(d, g === 'semana' ? 7 : 1)) keys.push(d) }
  const map = new Map<string, Bucket>()
  for (const k of keys) {
    const start = g === 'mes' ? `${k}-01` : k
    const end = g === 'mes' ? monthEndOf(`${k}-01`) : g === 'semana' ? addDays(k, 6) : k
    map.set(k, { key: k, label: bucketLabel(k, g), start, end, revenue: 0, count: 0,
      byKind: { nova: 0, recorrencia: 0, evento: 0 }, byVertical: { anestreview: 0, oftreview: 0, ortopreview: 0, medreview: 0 }, byChannel: { closer: 0, embaixador: 0, self: 0 } })
  }
  for (const s of sales) {
    const b = map.get(bucketKey(s.day, g)); if (!b) continue
    b.revenue += s.value; b.count++; b.byKind[s.kind] += s.value; b.byVertical[s.vertical] += s.value; b.byChannel[s.channel] += s.value
  }
  return keys.map(k => map.get(k)!)
}

// ══ Acumulado diário ═══════════════════════════════════════════════════════
export interface Cumulative { days: string[]; values: (number | null)[] }
/** Receita acumulada dia a dia. Dias depois de "hoje" ficam null (o futuro não é desenhado). */
export function cumulativeDaily(sales: Sale[], r: Range, today: string): Cumulative {
  const days = eachDay(r)
  const perDay = new Map<string, number>()
  for (const s of sales) perDay.set(s.day, (perDay.get(s.day) ?? 0) + s.value)
  let acc = 0
  return { days, values: days.map(d => { if (d > today) return null; acc += perDay.get(d) ?? 0; return acc }) }
}

/** Acumulado diário separado por grupo (ex.: uma linha por vertical / canal / origem). */
export function cumulativeBy<K extends string>(sales: Sale[], r: Range, today: string, keyOf: (s: Sale) => K, keys: readonly K[]): Record<K, Cumulative> {
  const out = {} as Record<K, Cumulative>
  for (const k of keys) out[k] = cumulativeDaily(sales.filter(s => keyOf(s) === k), r, today)
  return out
}

// ══ Metas e ritmo ══════════════════════════════════════════════════════════
export type GoalMap = Record<string, Record<string, number>>        // { '2026-10': { geral: 1000000, 'Anest-Review': 600000 } }
export function goalForRange(goals: GoalMap, r: Range, panel: PanelId): { total: number; complete: boolean } {
  let total = 0, complete = true
  for (let m = monthOf(r.start); m <= monthOf(r.end); m = addMonths(m, 1)) {
    const g = goals[m]?.[GOAL_SCOPE[panel]] ?? 0
    if (g > 0) total += g; else complete = false
  }
  return { total, complete: complete && total > 0 }
}

export type PaceStatus = 'acima' | 'no-ritmo' | 'abaixo'
export interface MonthPace {
  month: string; day: number; days: number; goal: number; revenue: number; pct: number
  expected: number; status: PaceStatus; projection: number; projectionPct: number
  remaining: number; perDayNeeded: number; done: boolean
}
/** Ritmo do mês corrente — mesma lógica do Telão ao vivo: meta ÷ dias do mês × dia atual vs realizado. */
export function monthPace(panelSales: Sale[], goal: number, today: string): MonthPace | null {
  if (!(goal > 0)) return null
  const month = monthOf(today), day = Number(today.slice(8, 10)), days = daysInMonth(month)
  const revenue = panelSales.filter(s => monthOf(s.day) === month).reduce((a, s) => a + s.value, 0)
  const expected = goal * (day / days)
  const ratio = expected > 0 ? revenue / expected : 1
  const status: PaceStatus = ratio >= 1.05 ? 'acima' : ratio >= 0.95 ? 'no-ritmo' : 'abaixo'
  const projection = day > 0 ? (revenue / day) * days : 0
  const remaining = Math.max(goal - revenue, 0)
  const daysLeft = Math.max(days - day + 1, 1)                   // inclui hoje (mesma conta do Telão)
  return { month, day, days, goal, revenue, pct: (revenue / goal) * 100, expected, status, projection, projectionPct: (projection / goal) * 100,
    remaining, perDayNeeded: remaining / daysLeft, done: revenue >= goal }
}

// ══ Mapas / rankings ═══════════════════════════════════════════════════════
export interface Heat { cells: number[][]; counts: number[][]; max: number; total: number }
export function heatmap(sales: Sale[]): Heat {
  const cells = Array.from({ length: 7 }, () => Array(24).fill(0)), counts = Array.from({ length: 7 }, () => Array(24).fill(0))
  let max = 0, total = 0
  for (const s of sales) { cells[s.weekday][s.hour] += s.value; counts[s.weekday][s.hour]++; total += s.value; if (cells[s.weekday][s.hour] > max) max = cells[s.weekday][s.hour] }
  return { cells, counts, max, total }
}
export function byUF(sales: Sale[]): { items: { uf: string; revenue: number; count: number }[]; coveragePct: number } {
  const m = new Map<string, { uf: string; revenue: number; count: number }>()
  let withUF = 0
  for (const s of sales) { if (!s.uf) continue; withUF++; const x = m.get(s.uf) ?? { uf: s.uf, revenue: 0, count: 0 }; x.revenue += s.value; x.count++; m.set(s.uf, x) }
  return { items: [...m.values()].sort((a, b) => b.revenue - a.revenue), coveragePct: sales.length ? (withUF / sales.length) * 100 : 0 }
}
export function byPayment(sales: Sale[]): { items: { kind: PayKind; revenue: number; count: number }[]; avgInstallments: number | null; coveragePct: number } {
  const m = new Map<PayKind, { kind: PayKind; revenue: number; count: number }>()
  let known = 0, instSum = 0, instN = 0
  for (const s of sales) {
    if (!s.pay) continue; known++
    const x = m.get(s.pay) ?? { kind: s.pay, revenue: 0, count: 0 }; x.revenue += s.value; x.count++; m.set(s.pay, x)
    if (s.pay === 'cartao' && s.installments && s.installments > 0) { instSum += s.installments; instN++ }
  }
  return { items: [...m.values()].sort((a, b) => b.revenue - a.revenue), avgInstallments: instN ? instSum / instN : null, coveragePct: sales.length ? (known / sales.length) * 100 : 0 }
}
export function topProducts(sales: Sale[], n = 6): { product: string; revenue: number; count: number }[] {
  const m = new Map<string, { product: string; revenue: number; count: number }>()
  for (const s of sales) { const k = s.product ?? 'Sem produto'; const x = m.get(k) ?? { product: k, revenue: 0, count: 0 }; x.revenue += s.value; x.count++; m.set(k, x) }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, n)
}

// ══ Regiões do Brasil ══════════════════════════════════════════════════════════
export type Region = 'norte' | 'nordeste' | 'centro-oeste' | 'sudeste' | 'sul'
export const REGIONS: Region[] = ['norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul']
export const REGION_LABEL: Record<Region, string> = { norte: 'Norte', nordeste: 'Nordeste', 'centro-oeste': 'Centro-Oeste', sudeste: 'Sudeste', sul: 'Sul' }
export const REGION_OF: Record<string, Region> = {
  AC: 'norte', AP: 'norte', AM: 'norte', PA: 'norte', RO: 'norte', RR: 'norte', TO: 'norte',
  AL: 'nordeste', BA: 'nordeste', CE: 'nordeste', MA: 'nordeste', PB: 'nordeste', PE: 'nordeste', PI: 'nordeste', RN: 'nordeste', SE: 'nordeste',
  DF: 'centro-oeste', GO: 'centro-oeste', MT: 'centro-oeste', MS: 'centro-oeste',
  ES: 'sudeste', MG: 'sudeste', RJ: 'sudeste', SP: 'sudeste',
  PR: 'sul', RS: 'sul', SC: 'sul',
}
export interface RegionRow { region: Region; label: string; revenue: number; count: number; sharePct: number; topUF: { uf: string; revenue: number } | null }
/** Receita por região. A % é sobre as vendas COM estado informado (as sem estado não dá pra atribuir a região). */
export function byRegion(items: { uf: string; revenue: number; count: number }[]): { regions: RegionRow[]; totalKnown: number } {
  const total = items.reduce((a, i) => a + i.revenue, 0)
  const rows = REGIONS.map<RegionRow>(r => {
    const its = items.filter(i => REGION_OF[i.uf] === r)
    const revenue = its.reduce((a, i) => a + i.revenue, 0)
    const top = [...its].sort((a, b) => b.revenue - a.revenue)[0]
    return { region: r, label: REGION_LABEL[r], revenue, count: its.reduce((a, i) => a + i.count, 0), sharePct: total > 0 ? (revenue / total) * 100 : 0, topUF: top ? { uf: top.uf, revenue: top.revenue } : null }
  })
  return { regions: rows.sort((a, b) => b.revenue - a.revenue), totalKnown: total }
}
export function topStates(items: { uf: string; revenue: number; count: number }[], n = 3): { uf: string; revenue: number; count: number; sharePct: number; region: Region }[] {
  const total = items.reduce((a, i) => a + i.revenue, 0)
  return [...items].sort((a, b) => b.revenue - a.revenue).slice(0, n).map(i => ({ ...i, sharePct: total > 0 ? (i.revenue / total) * 100 : 0, region: REGION_OF[i.uf] }))
}

// ══ Como o cliente paga: à vista × parcelado e as formas mais usadas ═══════════
export interface PayForm { kind: 'avista' | 'parcelado'; label: string; n: number }
/**
 * Pix = à vista. Cartão/boleto: 1x = à vista, 2x ou mais = parcelado. Sem forma de pagamento (ou cartão sem nº de
 * parcelas) → null: a venda não entra nesta conta (a tela mostra a % informada), nada é presumido.
 */
export function payForm(s: { pay: PayKind | null; installments: number | null }): PayForm | null {
  if (!s.pay) return null
  if (s.pay === 'pix') return { kind: 'avista', label: 'Pix', n: 1 }
  const n = s.installments
  if (n === null || n === undefined || !(n >= 1)) return null
  const base = s.pay === 'cartao' ? 'Cartão' : s.pay === 'boleto' ? 'Boleto' : 'Outros'
  return n <= 1 ? { kind: 'avista', label: s.pay === 'cartao' ? 'Cartão à vista' : s.pay === 'boleto' ? 'Boleto' : 'Outros à vista', n: 1 }
                : { kind: 'parcelado', label: `${base} em ${n}x`, n }
}
export interface PayStructure {
  avista: { revenue: number; count: number }; parcelado: { revenue: number; count: number; avgInstallments: number | null }
  forms: { label: string; kind: 'avista' | 'parcelado'; revenue: number; count: number }[]; coveragePct: number; known: number
  total: number                                   // receita de TODAS as vendas do período (a base de todas as %)
  unknown: { revenue: number; count: number }     // vendas sem forma de pagamento (ou cartão sem nº de parcelas)
}
export function payStructure(sales: Sale[]): PayStructure {
  const av = { revenue: 0, count: 0 }, pa = { revenue: 0, count: 0 }
  const forms = new Map<string, { label: string; kind: 'avista' | 'parcelado'; revenue: number; count: number }>()
  let known = 0, instSum = 0, unknownCount = 0
  for (const s of sales) {
    const f = payForm(s); if (!f) { unknownCount++; continue }
    known += s.value
    const bucket = f.kind === 'avista' ? av : pa; bucket.revenue += s.value; bucket.count++
    if (f.kind === 'parcelado') instSum += f.n
    const x = forms.get(f.label) ?? { label: f.label, kind: f.kind, revenue: 0, count: 0 }; x.revenue += s.value; x.count++; forms.set(f.label, x)
  }
  const total = sales.reduce((a, s) => a + s.value, 0)
  return { avista: av, parcelado: { ...pa, avgInstallments: pa.count ? instSum / pa.count : null },
    forms: [...forms.values()].sort((a, b) => b.revenue - a.revenue), coveragePct: total > 0 ? (known / total) * 100 : 0, known,
    total, unknown: { revenue: total - known, count: unknownCount } }
}

export interface PayRow { id: string; label: string; revenue: number; count: number; kind: 'avista' | 'parcelado' | 'outras' | 'sem-info' }
/**
 * A lista "formas mais usadas" que FECHA o total: as N maiores + "Demais formas" (tudo que ficou de fora) +
 * "Sem forma informada". A soma das linhas é sempre a receita do período (nada some em silêncio).
 */
export function payBreakdown(ps: PayStructure, topN = 5): { rows: PayRow[]; total: number; hiddenForms: number } {
  const top = ps.forms.slice(0, topN), rest = ps.forms.slice(topN)
  const rows: PayRow[] = top.map(f => ({ id: f.label, label: f.label, revenue: f.revenue, count: f.count, kind: f.kind }))
  if (rest.length) rows.push({ id: 'outras', label: `Demais formas (${rest.length})`, revenue: rest.reduce((a, f) => a + f.revenue, 0), count: rest.reduce((a, f) => a + f.count, 0), kind: 'outras' })
  if (ps.unknown.revenue > 0.005 || ps.unknown.count > 0) rows.push({ id: 'sem-info', label: 'Sem forma informada', revenue: ps.unknown.revenue, count: ps.unknown.count, kind: 'sem-info' })
  return { rows, total: ps.total, hiddenForms: rest.length }
}

// ══ Destaques do mapa de calor ═════════════════════════════════════════════════
export interface HeatSlot { weekday: number; hour: number; revenue: number; count: number; pct: number }
export function heatHighlights(h: Heat, n = 3): { top: HeatSlot[]; day: { weekday: number; revenue: number; pct: number } | null; hour: { hour: number; revenue: number; pct: number } | null; days: number[]; hours: number[] } {
  const slots: HeatSlot[] = []
  for (let d = 0; d < 7; d++) for (let hr = 0; hr < 24; hr++) if (h.cells[d][hr] > 0) slots.push({ weekday: d, hour: hr, revenue: h.cells[d][hr], count: h.counts[d][hr], pct: h.total > 0 ? (h.cells[d][hr] / h.total) * 100 : 0 })
  slots.sort((a, b) => b.revenue - a.revenue || a.weekday - b.weekday || a.hour - b.hour)
  const perDay = Array.from({ length: 7 }, (_, d) => ({ weekday: d, revenue: h.cells[d].reduce((a, b) => a + b, 0) })).sort((a, b) => b.revenue - a.revenue)[0]
  const perHour = Array.from({ length: 24 }, (_, hr) => ({ hour: hr, revenue: h.cells.reduce((a, row) => a + row[hr], 0) })).sort((a, b) => b.revenue - a.revenue)[0]
  return {
    top: slots.slice(0, n),
    day: perDay && perDay.revenue > 0 ? { ...perDay, pct: (perDay.revenue / h.total) * 100 } : null,
    hour: perHour && perHour.revenue > 0 ? { ...perHour, pct: (perHour.revenue / h.total) * 100 } : null,
    days: Array.from({ length: 7 }, (_, d) => h.cells[d].reduce((a, b) => a + b, 0)),
    hours: Array.from({ length: 24 }, (_, hr) => h.cells.reduce((a, row) => a + row[hr], 0)),
  }
}

// ══ Insights automáticos (calculados por código — sem IA, sem chute) ══════════
export interface Insight { id: string; tone: 'good' | 'warn' | 'info'; icon: string; text: string }
const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export function buildInsights(c: {
  panel: PanelId; sum: Summary; prev: Summary | null; pace: MonthPace | null; heat: Heat
}): Insight[] {
  const out: Insight[] = []
  const { sum, prev, pace, panel } = c
  if (sum.count === 0) return [{ id: 'vazio', tone: 'info', icon: '🕳️', text: 'Nenhuma venda no período selecionado.' }]

  const ch = prev ? pctChange(sum.revenue, prev.revenue) : null
  if (ch !== null && prev) out.push({ id: 'variacao', tone: ch >= 0 ? 'good' : 'warn', icon: ch >= 0 ? '📈' : '📉',
    text: `Receita de ${fmtBRL(sum.revenue)}, ${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(0)}% sobre o período anterior (${fmtBRL(prev.revenue)}).` })

  if (pace) {
    const proj = fmtBRL(pace.projection), pct = pace.projectionPct.toFixed(0)
    out.push(pace.done
      ? { id: 'meta', tone: 'good', icon: '🏆', text: `Meta do mês batida: ${fmtBRL(pace.revenue)} de ${fmtBRL(pace.goal)}.` }
      : { id: 'meta', tone: pace.status === 'abaixo' ? 'warn' : 'good', icon: pace.status === 'acima' ? '🟢' : pace.status === 'no-ritmo' ? '🟡' : '🔴',
          text: `${pace.status === 'acima' ? 'Acima do ritmo' : pace.status === 'no-ritmo' ? 'No ritmo' : 'Abaixo do ritmo'}: no passo atual o mês fecha em ~${proj} (${pct}% da meta). Faltam ${fmtBRL(pace.remaining)}, ou ${fmtBRL(pace.perDayNeeded)} por dia.` })
  }

  if (panel === 'geral') {
    const rows = VERT_IDS.map(v => ({ v, rev: sum.byVertical[v].revenue, prev: prev?.byVertical[v].revenue ?? 0 })).filter(x => x.rev > 0)
    const lead = [...rows].sort((a, b) => b.rev - a.rev)[0]
    if (lead) out.push({ id: 'lider', tone: 'info', icon: '🥇', text: `${VERTICALS[lead.v].label} lidera com ${((lead.rev / sum.revenue) * 100).toFixed(0)}% da receita (${fmtBRL(lead.rev)}).` })
    const movers = rows.filter(x => x.prev > 0).map(x => ({ ...x, ch: ((x.rev - x.prev) / x.prev) * 100 })).sort((a, b) => b.ch - a.ch)
    if (movers.length >= 2) {
      const up = movers[0], down = movers[movers.length - 1]
      if (up.ch > 0) out.push({ id: 'sobe', tone: 'good', icon: '🚀', text: `${VERTICALS[up.v].label} foi a que mais cresceu: ▲ ${up.ch.toFixed(0)}% no período.` })
      if (down.ch < 0 && down.v !== up.v) out.push({ id: 'cai', tone: 'warn', icon: '⚠️', text: `${VERTICALS[down.v].label} caiu ▼ ${Math.abs(down.ch).toFixed(0)}% frente ao período anterior.` })
    }
  }

  if (sum.left > 0) out.push({ id: 'mesa', tone: 'warn', icon: '💸', text: `Foram deixados na mesa ${fmtBRL(sum.left)} em descontos (${sum.leftPct.toFixed(1)}% da receita).` })

  const chans = (Object.keys(sum.byChannel) as Channel[]).map(k => ({ k, rev: sum.byChannel[k].revenue })).sort((a, b) => b.rev - a.rev)
  if (chans[0].rev > 0) out.push({ id: 'canal', tone: 'info', icon: '🧭', text: `${CHANNEL_LABEL[chans[0].k]} é o canal dominante: ${((chans[0].rev / sum.revenue) * 100).toFixed(0)}% da receita.` })

  if (sum.byKind.recorrencia.revenue > 0) out.push({ id: 'rec', tone: 'info', icon: '🔄', text: `Recorrência soma ${fmtBRL(sum.byKind.recorrencia.revenue)} (${sum.recurrencePct.toFixed(0)}% da receita) em ${sum.byKind.recorrencia.count} parcelas.` })

  const wd = Array.from({ length: 7 }, (_, d) => ({ d, rev: c.heat.cells[d].reduce((a, b) => a + b, 0) })).sort((a, b) => b.rev - a.rev)[0]
  if (wd && wd.rev > 0 && c.heat.total > 0) out.push({ id: 'dia', tone: 'info', icon: '📅', text: `${WEEKDAY[wd.d][0].toUpperCase()}${WEEKDAY[wd.d].slice(1)} é o melhor dia da semana: ${((wd.rev / c.heat.total) * 100).toFixed(0)}% da receita do período.` })

  return out
}
