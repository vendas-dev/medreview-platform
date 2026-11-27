// Metas de evento — lógica PURA (sem banco): normalização, dias, contagem e validação.
// Regra de venda de evento (combinada com o time):
//   • só vendas (event_type='sale' — reembolsada já sai do placar);
//   • NOME DO EVENTO preenchido é obrigatório (EV_ sem nome NÃO conta; depois que o nome é
//     editado em massa no banco, passa a contar). Cupom EV_ ou não, vale o nome;
//   • a venda conta para a edição cujo nome bate (sem diferenciar acento/maiúscula);
//   • o dia da venda é o dia em horário de São Paulo.
import { addDaysToDateStr, dateInSaoPaulo } from '@/lib/timezone'

export type GoalScope = 'total' | 'day' | 'closer' | 'closer_day'

export const VERTICAL_IDS = ['anestreview', 'oftreview', 'ortopreview', 'medreview'] as const
export type EventVertical = (typeof VERTICAL_IDS)[number]

export interface EditionRow {
  id: string; name: string; event_name: string; vertical?: EventVertical | null
  start_date: string; end_date: string; notes: string | null
}
export interface RosterCloser {
  id: string; name: string; avatar_url: string | null; team: string | null; hubspot_id: string | null
}
export interface GoalRow { scope: GoalScope; day: string | null; profile_id: string | null; amount: number }
export interface SaleRow {
  id?: string | number; value: number | string | null; event_name: string | null
  closer_id: string | null; closer_hubspot_id: string | null; is_self_checkout: boolean | null
  occurred_at: string; is_refunded?: boolean | null; product?: string | null
}

export const normName = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const isDateStr = (s: unknown): s is string =>
  typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s

export function eventDays(start: string, end: string): string[] {
  const out: string[] = []
  if (!isDateStr(start) || !isDateStr(end) || end < start) return out
  for (let d = start, i = 0; d <= end && i < 40; d = addDaysToDateStr(d, 1), i++) out.push(d)
  return out
}

export function editionStatus(e: { start_date: string; end_date: string }, today: string): 'proximo' | 'andamento' | 'encerrado' {
  if (today < e.start_date) return 'proximo'
  if (today > e.end_date) return 'encerrado'
  return 'andamento'
}

export function isCountableSale(r: SaleRow, editionEventName: string): boolean {
  if (r.is_refunded === true) return false
  const n = normName(r.event_name)
  return n !== '' && n === normName(editionEventName)
}

/** Quantos dias depois do fim do evento uma venda com o nome dele ainda aparece NO GRÁFICO do evento (só o gráfico:
 *  o crédito da venda para o closer não depende disso). */
export const POST_EVENT_DAYS = 10

/** A venda (pelo dia de SP) pertence a ESTA edição? Janela: 1 dia antes … POST_EVENT_DAYS depois do fim.
 *  Havendo outra edição do mesmo evento (mesmo nome) que também alcança o dia, vale a mais próxima do dia
 *  (dentro das datas = distância 0); empate → a que começou depois. Assim a venda de 21–24/12 vai para o SBOT de
 *  dezembro e não para o de novembro. */
export function belongsToEdition(day: string, edition: EditionRow, all: EditionRow[] = []): boolean {
  const reach = (e: EditionRow) => day >= addDaysToDateStr(e.start_date, -1) && day <= addDaysToDateStr(e.end_date, POST_EVENT_DAYS)
  if (!reach(edition)) return false
  const key = normName(edition.event_name)
  const dist = (e: EditionRow) => (day < e.start_date ? daysBetween(day, e.start_date) : day > e.end_date ? daysBetween(e.end_date, day) : 0)
  const rivals = all.filter(e => e.id !== edition.id && normName(e.event_name) === key && reach(e))
  for (const r of rivals) {
    const dr = dist(r), dm = dist(edition)
    if (dr < dm || (dr === dm && r.start_date > edition.start_date)) return false
  }
  return true
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)

export interface Bucket { value: number; count: number }
const add = (b: Bucket, v: number) => { b.value += v; b.count += 1 }
const empty = (): Bucket => ({ value: 0, count: 0 })

export interface ProductRow { product: string; value: number; count: number; byDay: Record<string, Bucket> }
export const NO_PRODUCT = 'Sem produto'

export interface Actuals {
  total: Bucket
  byDay: Record<string, Bucket>
  outside: Bucket                       // vendas do evento fora dos dias cadastrados
  byCloser: Record<string, Bucket & { byDay: Record<string, Bucket> }>
  others: Bucket                        // self-checkout / closer fora da escalação (entra no geral)
  products: ProductRow[]               // ranking de produtos (todo o evento), do mais vendido pro menos
  recent: { id: string | number | null; value: number; closer_id: string | null; occurred_at: string; product: string | null }[]
  /** Receita (hourly) e nº de vendas (hourlyN) de cada HORA de Brasília (0 a 23), por dia do evento: alimenta o acumulado por hora. */
  hourly: Record<string, number[]>; hourlyN: Record<string, number[]>
}
export const RECENT_MAX = 60
const SPH = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
export const hourInSaoPaulo = (iso: string): number => { const h = +SPH.format(new Date(iso)); return h >= 0 && h <= 23 ? h : 0 }

export function aggregate(rows: SaleRow[], edition: EditionRow, roster: RosterCloser[], allEditions: EditionRow[] = []): Actuals {
  const days = eventDays(edition.start_date, edition.end_date)
  const daySet = new Set(days)
  const hub = new Map<string, string>(); const ids = new Map<string, string>()
  for (const c of roster) { if (c.hubspot_id?.trim()) hub.set(c.hubspot_id.trim(), c.id); ids.set(c.id, c.id) }

  const a: Actuals = { total: empty(), byDay: {}, outside: empty(), byCloser: {}, others: empty(), products: [], recent: [], hourly: {}, hourlyN: {} }
  const prod = new Map<string, ProductRow>()
  for (const d of days) { a.byDay[d] = empty(); a.hourly[d] = new Array(24).fill(0); a.hourlyN[d] = new Array(24).fill(0) }
  for (const c of roster) { a.byCloser[c.id] = { ...empty(), byDay: Object.fromEntries(days.map(d => [d, empty()])) } }

  const counted: { r: SaleRow; v: number; cid: string | null }[] = []
  for (const r of rows) {
    if (!isCountableSale(r, edition.event_name)) continue
    const v = Number(r.value) || 0
    const day = dateInSaoPaulo(r.occurred_at)
    if (!belongsToEdition(day, edition, allEditions)) continue
    let cid: string | null = null
    if (!r.is_self_checkout) {
      const h = r.closer_hubspot_id ? String(r.closer_hubspot_id).trim() : ''
      cid = (h && hub.get(h)) || (r.closer_id && ids.get(r.closer_id)) || null
    }
    add(a.total, v)
    if (daySet.has(day)) { add(a.byDay[day], v); const hh = hourInSaoPaulo(r.occurred_at); a.hourly[day][hh] += v; a.hourlyN[day][hh] += 1 } else add(a.outside, v)
    if (cid) { add(a.byCloser[cid], v); if (daySet.has(day)) add(a.byCloser[cid].byDay[day], v) }
    else add(a.others, v)
    const pname = (r.product ?? '').trim() || NO_PRODUCT
    const pk = normName(pname)
    let pr = prod.get(pk)
    if (!pr) { pr = { product: pname, value: 0, count: 0, byDay: {} }; prod.set(pk, pr) }
    pr.value += v; pr.count += 1
    if (daySet.has(day)) add((pr.byDay[day] ??= empty()), v)
    counted.push({ r, v, cid })
  }
  a.products = [...prod.values()].sort((x, y) => y.value - x.value || y.count - x.count || x.product.localeCompare(y.product))
  for (const d of days) a.hourly[d] = a.hourly[d].map(v => Math.round(v * 100) / 100)
  counted.sort((x, y) => (x.r.occurred_at < y.r.occurred_at ? 1 : -1))
  a.recent = counted.slice(0, RECENT_MAX).map(x => ({ id: x.r.id ?? null, value: x.v, closer_id: x.cid, occurred_at: x.r.occurred_at, product: x.r.product ?? null }))
  return a
}

export interface GoalsView {
  total: number | null
  days: Record<string, number>
  closers: Record<string, number>
  cells: Record<string, Record<string, number>>
}
export function buildGoals(rows: GoalRow[]): GoalsView {
  const g: GoalsView = { total: null, days: {}, closers: {}, cells: {} }
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    if (r.scope === 'total') g.total = amt
    else if (r.scope === 'day' && r.day) g.days[r.day] = amt
    else if (r.scope === 'closer' && r.profile_id) g.closers[r.profile_id] = amt
    else if (r.scope === 'closer_day' && r.profile_id && r.day) (g.cells[r.profile_id] ??= {})[r.day] = amt
  }
  return g
}

// ── Validação do que o superadmin envia ao salvar ──────────────────────────
export interface ConfigInput {
  vertical: EventVertical | null
  name: string; event_name: string; start_date: string; end_date: string; notes: string | null
  closers: string[]; goals: GoalRow[]
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseConfig(body: any): { ok: true; value: ConfigInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Dados inválidos.' }
  const name = String(body.name ?? '').trim(); const event_name = String(body.event_name ?? '').trim()
  if (!name) return { ok: false, error: 'Dê um nome ao evento.' }
  if (!event_name) return { ok: false, error: 'Informe o nome do evento como aparece nas vendas.' }
  if (!isDateStr(body.start_date) || !isDateStr(body.end_date)) return { ok: false, error: 'Informe a data de início e a de fim.' }
  if (body.end_date < body.start_date) return { ok: false, error: 'A data final não pode ser antes da inicial.' }
  const days = eventDays(body.start_date, body.end_date)
  if (days.length > 31) return { ok: false, error: 'O evento pode ter no máximo 31 dias.' }
  const daySet = new Set(days)
  const closers: string[] = []
  for (const c of Array.isArray(body.closers) ? body.closers : []) {
    if (typeof c !== 'string' || !UUID_RE.test(c)) return { ok: false, error: 'Closer inválido.' }
    if (!closers.includes(c)) closers.push(c)
  }
  const cs = new Set(closers); const seen = new Set<string>(); const goals: GoalRow[] = []
  for (const g of Array.isArray(body.goals) ? body.goals : []) {
    const scope = g?.scope as GoalScope
    const amount = Number(g?.amount)
    if (!['total', 'day', 'closer', 'closer_day'].includes(scope)) continue
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Meta com valor inválido.' }
    if (amount > 1e9) return { ok: false, error: 'Meta com valor alto demais.' }
    const day = g.day ?? null; const pid = g.profile_id ?? null
    if ((scope === 'day' || scope === 'closer_day') && !(typeof day === 'string' && daySet.has(day))) continue
    if ((scope === 'closer' || scope === 'closer_day') && !(typeof pid === 'string' && cs.has(pid))) continue
    const key = [scope, scope.includes('day') ? day : '', scope.startsWith('closer') ? pid : ''].join('|')
    if (seen.has(key)) continue; seen.add(key)
    goals.push({ scope, day: scope.includes('day') ? day : null, profile_id: scope.startsWith('closer') ? pid : null, amount: Math.round(amount * 100) / 100 })
  }
  const vertical = body.vertical == null || body.vertical === '' ? null : body.vertical
  if (vertical !== null && !(VERTICAL_IDS as readonly string[]).includes(vertical)) return { ok: false, error: 'Vertical inválida.' }
  const notes = body.notes == null ? null : String(body.notes).trim().slice(0, 1000) || null
  return { ok: true, value: { vertical, name: name.slice(0, 120), event_name: event_name.slice(0, 160), start_date: body.start_date, end_date: body.end_date, notes, closers, goals } }
}

export const rangesOverlap = (a: { start_date: string; end_date: string }, b: { start_date: string; end_date: string }) =>
  a.start_date <= b.end_date && b.start_date <= a.end_date

// ── Sugestão de distribuição (NUNCA salva sozinha: só preenche a prévia) ───────
/** Reparte `total` (R$) proporcionalmente a `weights`, em múltiplos de `step`; a soma dá exatamente `total`. */
export function distribute(total: number, weights: number[], step = 100): number[] {
  const n = weights.length
  if (!n) return []
  const w = weights.map(x => (Number.isFinite(x) && x > 0 ? x : 0))
  const sum = w.reduce((a, b) => a + b, 0)
  if (!(total > 0) || sum === 0) return w.map(() => 0)
  const unit = total >= step * n ? step : 1
  const units = Math.floor(total / unit)
  const exact = w.map(x => (x / sum) * units)
  const base = exact.map(Math.floor)
  let left = units - base.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length) { if (w[order[k].i] > 0) { base[order[k].i]++; left-- } }
  const out = base.map(b => b * unit)
  const rest = Math.round((total - units * unit) * 100) / 100
  if (rest > 0) { const big = w.indexOf(Math.max(...w)); out[big] = Math.round((out[big] + rest) * 100) / 100 }
  return out
}
