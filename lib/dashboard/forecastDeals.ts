import { todayInSaoPaulo, dayBoundsSaoPaulo, addDaysToDateStr } from '@/lib/timezone'
import { VKey, verticalKey, spDateOf, spHourOf, HISTORY_DAYS, groupByDeal, dealOutcome, queryLinks } from '@/lib/dashboard/forecastAnalysis'

// ── Lista de negócios por trás de cada número do forecast ───────────────────────────────────
// Usa EXATAMENTE as regras do forecastAnalysis: um por negócio (vale o link mais recente), links excluídos (dismissed_at) fora,
// pago = link convertido ou substituído por um que pagou, e negócio em "Perdido" (e não pago) é o "perdido". Assim a lista aberta ao clicar
// numa área tem sempre o mesmo número de linhas e a mesma soma que aparece na tela.
export type DealStatus = 'paid' | 'unpaid' | 'lost'
export interface DealsQuery { scope: 'today' | 'history'; status: 'all' | DealStatus; vertical?: VKey | 'outros'; hour?: number; day?: string }
export interface DealRow {
  key: string; deal_id: string | null; link_id: string; deal_name: string | null; product: string | null
  vertical: VKey | 'outros'; vertical_raw: string | null; value: number; owner: string | null
  generated_at: string; expires_at: string | null; converted_at: string | null; lost_at: string | null; status: DealStatus
}
export interface DealsResult { rows: DealRow[]; total: { count: number; value: number }; truncated: boolean; cap: number; query: DealsQuery; generatedAt: string }

export const DEALS_CAP = 3000
const VKEYS_ALL = ['anest', 'oft', 'ortop', 'r1', 'outros']
const num = (v: any) => Number(v) || 0

/** Valida os parâmetros da URL. Devolve a consulta ou o motivo do erro (400). */
export function parseDealsQuery(sp: { get(k: string): string | null }): { ok: true; query: DealsQuery } | { ok: false; error: string } {
  const scope = sp.get('scope'), status = sp.get('status') ?? 'all', vertical = sp.get('vertical'), hour = sp.get('hour'), day = sp.get('day')
  if (scope !== 'today' && scope !== 'history') return { ok: false, error: 'scope deve ser today ou history' }
  if (!['all', 'paid', 'unpaid', 'lost'].includes(status)) return { ok: false, error: 'status inválido' }
  if (vertical != null && vertical !== '' && !VKEYS_ALL.includes(vertical)) return { ok: false, error: 'vertical inválida' }
  const q: DealsQuery = { scope, status: status as DealsQuery['status'] }
  if (vertical) q.vertical = vertical as any
  if (hour != null && hour !== '') {
    if (scope !== 'today') return { ok: false, error: 'hour só vale com scope=today' }
    if (!/^\d{1,2}$/.test(hour) || Number(hour) > 23) return { ok: false, error: 'hour deve ser de 0 a 23' }
    q.hour = Number(hour)
  }
  if (day != null && day !== '') {
    if (scope !== 'history') return { ok: false, error: 'day só vale com scope=history' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(Date.parse(`${day}T00:00:00Z`))) return { ok: false, error: 'day deve ser AAAA-MM-DD' }
    q.day = day
  }
  return { ok: true, query: q }
}

// Ordem útil pra quem vai agir: não pagos — o que vence primeiro no topo, vencidos depois, sem prazo no fim;
// pagos — o pago mais recente primeiro; o resto — o gerado mais recente primeiro.
function sortRows(rows: DealRow[], status: DealsQuery['status'], nowMs: number): DealRow[] {
  const byGen = (a: DealRow, b: DealRow) => b.generated_at.localeCompare(a.generated_at) || a.key.localeCompare(b.key)
  if (status === 'paid') return [...rows].sort((a, b) => String(b.converted_at ?? '').localeCompare(String(a.converted_at ?? '')) || byGen(a, b))
  if (status === 'unpaid') {
    const grp = (r: DealRow) => !r.expires_at ? 2 : Date.parse(r.expires_at) > nowMs ? 0 : 1
    return [...rows].sort((a, b) => grp(a) - grp(b) || (grp(a) === 0 ? Date.parse(a.expires_at!) - Date.parse(b.expires_at!) : grp(a) === 1 ? Date.parse(b.expires_at!) - Date.parse(a.expires_at!) : 0) || byGen(a, b))
  }
  return [...rows].sort(byGen)
}

export async function computeForecastDeals(admin: any, q: DealsQuery, nowMs = Date.now()): Promise<DealsResult> {
  const today = todayInSaoPaulo()
  const fromDate = q.scope === 'today' ? today : addDaysToDateStr(today, -HISTORY_DAYS)
  const toDate = q.scope === 'today' ? today : addDaysToDateStr(today, -1)
  const { start } = dayBoundsSaoPaulo(fromDate), { end } = dayBoundsSaoPaulo(toDate)
  const { data, error } = await queryLinks(admin, 'id, deal_id, deal_name, deal_value, owner_name, product_name, generated_at, vertical, converted_at, superseded_by_link_id, expires_at',
    qq => qq.gte('generated_at', start).lte('generated_at', end).is('dismissed_at', null))
  if (error) throw new Error(`links: ${(error as any).message}`)

  const all: DealRow[] = []
  for (const links of groupByDeal((data ?? []) as any[]).values()) {
    const o = dealOutcome(links)
    const date = spDateOf(o.rep.generated_at)
    if (q.scope === 'history' && (date < fromDate || date > toDate)) continue          // fora da janela (borda de fuso) — igual ao gráfico
    const status: DealStatus = o.paid ? 'paid' : o.rep.deal_lost_at ? 'lost' : 'unpaid'
    if (q.scope === 'history' && status === 'lost' && q.status === 'all') continue      // histórico: o Perdido não entra no "total" (só em status=lost)
    const shown = o.paid ? (links.find(l => l.converted_at) ?? o.rep) : o.rep           // pago: os dados do link que pagou
    const vk: VKey | 'outros' = verticalKey(o.rep.vertical) ?? 'outros'
    all.push({
      key: String(o.rep.deal_id ?? o.rep.id), deal_id: o.rep.deal_id ?? null, link_id: String(shown.id), deal_name: shown.deal_name ?? null, product: shown.product_name ?? null,
      vertical: vk, vertical_raw: o.rep.vertical ?? null, value: o.value, owner: shown.owner_name ?? null,
      generated_at: String(o.rep.generated_at), expires_at: o.paid ? null : (o.rep.expires_at ?? null), converted_at: shown.converted_at ?? null,
      lost_at: status === 'lost' ? (o.rep.deal_lost_at ?? null) : null, status,
    })
  }
  const keep = all.filter(r =>
    (q.status === 'all' || r.status === q.status) &&
    (!q.vertical || r.vertical === q.vertical) &&
    (q.hour === undefined || spHourOf(r.generated_at) === q.hour) &&
    (!q.day || spDateOf(r.generated_at) === q.day))
  const sorted = sortRows(keep, q.status, nowMs)
  return { rows: sorted.slice(0, DEALS_CAP), total: { count: keep.length, value: keep.reduce((s, r) => s + num(r.value), 0) }, truncated: sorted.length > DEALS_CAP, cap: DEALS_CAP, query: q, generatedAt: new Date(nowMs).toISOString() }
}
