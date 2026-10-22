import { weekdayInSaoPaulo } from '@/lib/timezone'

// Formatador criado UMA vez (o dateInSaoPaulo cria um novo a cada chamada — com milhares de vendas isso pesava).
const SP_DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const dateInSaoPaulo = (iso: string) => SP_DAY_FMT.format(new Date(iso))
import type { VerticalId } from '@/lib/telao/types'

// ══ Receita por dia do mês (gráfico do Telão) ═══════════════════════════════
// Mesma definição de "receita" do resto do telão: soma do `value` dos eventos `sale`.
// O dia de cada venda é o dia em SÃO PAULO (uma venda às 23h30 de SP não vira o dia seguinte por causa do UTC).
//
//  • Dias que NÃO são hoje  → vêm do histórico do mês (buscado à parte, paginado). Uma venda com data errada
//                              no futuro também entra (na barra do dia dela), pra o total fechar com o número do mês no topo.
//  • HOJE                    → vem dos eventos ao vivo (os mesmos do resto do telão), assim a barra de hoje
//                              sobe sozinha a cada venda e uma venda apagada/corrigida some na hora.
//  • Painel (vertical)       → "Geral" (null) soma TUDO; um painel soma só aquela vertical.
//  • Filtro de closer        → mesma regra do `viewEvents` do LiveWall.

export interface DaySale {
  id: string
  occurred_at: string
  value: number | null
  vertical: VerticalId | string
  closer_id?: string | null
  closer_name?: string | null
  is_self_checkout?: boolean | null
  event_type?: string          // o histórico já vem só com 'sale'; os eventos de hoje vêm de todos os tipos
}

export interface DayPoint {
  date: string                 // 'YYYY-MM-DD' (SP)
  day: number                  // 1..31
  weekday: number              // 0=dom … 6=sáb
  total: number                // receita do dia (R$)
  count: number                // nº de vendas
  isToday: boolean
  isFuture: boolean
}

export interface DailySeries {
  days: DayPoint[]
  total: number                // soma do mês até agora
  count: number
  closedAvg: number | null     // média/dia dos dias JÁ FECHADOS (antes de hoje); null se ainda não há nenhum
  closedDays: number
  best: DayPoint | null        // melhor dia (inclui hoje); empate = o mais cedo
  max: number                  // maior total diário (pra escala)
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Todas as datas 'YYYY-MM-DD' de start até end (inclusive), no máximo `cap` dias. */
export function listDates(start: string, end: string, cap = 400): string[] {
  const out: string[] = [], t0 = Date.parse(`${start}T00:00:00Z`)
  for (let i = 0; i < cap; i++) { const d = new Date(t0 + i * 86400000).toISOString().slice(0, 10); if (d > end) break; out.push(d) }
  return out
}

/** Quantos dias tem o mês 'YYYY-MM'. */
export function daysInMonthKey(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Mesma regra do filtro de closer do LiveWall (`viewEvents`). Lista vazia = todos. */
export function matchesCloserFilter(e: Pick<DaySale, 'is_self_checkout' | 'closer_id' | 'closer_name'>, keys: string[]): boolean {
  if (keys.length === 0) return true
  return e.is_self_checkout
    ? keys.includes('self')
    : (keys.includes(e.closer_id ?? '') || keys.includes(`name-${e.closer_name ?? ''}`))
}

export function buildDailySeries(o: {
  monthKey: string                 // 'YYYY-MM' do mês mostrado
  today: string                    // 'YYYY-MM-DD' em SP
  history: DaySale[]               // vendas do mês (paginado) até o momento da busca
  todayEvents: DaySale[]           // eventos ao vivo de hoje (qualquer tipo)
  vertical: VerticalId | null      // painel: null = Geral
  closerKeys?: string[]
  range?: { start: string; end: string } | null   // modo "período": as barras são SÓ os dias de start..end (podem cruzar meses); sem isso, o mês inteiro
}): DailySeries {
  const { monthKey, today, history, todayEvents, vertical } = o
  const range = o.range && o.range.start ? o.range : null
  const inScope = (date: string) => (range ? date >= range.start && date <= range.end : date.slice(0, 7) === monthKey)
  const closerKeys = o.closerKeys ?? []
  const n = daysInMonthKey(monthKey)
  const sums = new Map<string, { total: number; count: number }>()
  const seen = new Set<string>()

  const add = (e: DaySale, date: string) => {
    if (e.id) { if (seen.has(e.id)) return; seen.add(e.id) }       // a paginação pode repetir uma linha na emenda das páginas
    if (vertical && e.vertical !== vertical) return
    if (!matchesCloserFilter(e, closerKeys)) return
    const v = Number(e.value ?? 0)
    const cur = sums.get(date) ?? { total: 0, count: 0 }
    cur.total += Number.isFinite(v) ? v : 0
    cur.count += 1
    sums.set(date, cur)
  }

  for (const e of history) {
    if ((e.event_type ?? 'sale') !== 'sale') continue
    const date = dateInSaoPaulo(e.occurred_at)
    if (!inScope(date)) continue                                  // fora do mês/período (ex.: 23h30 do último dia do mês anterior)
    if (date === today) continue                                   // hoje é do ao vivo (o resto, inclusive data errada no futuro, é do histórico)
    add(e, date)
  }
  if (inScope(today)) {
    for (const e of todayEvents) {
      if (e.event_type !== 'sale') continue
      if (dateInSaoPaulo(e.occurred_at) !== today) continue
      add(e, today)
    }
  }

  const dates = range ? listDates(range.start, range.end) : Array.from({ length: n }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`)
  const days: DayPoint[] = []
  for (const date of dates) {
    const s = sums.get(date)
    days.push({
      date, day: Number(date.slice(8, 10)), weekday: weekdayInSaoPaulo(new Date(`${date}T12:00:00-03:00`)),
      total: round2(s?.total ?? 0), count: s?.count ?? 0,
      isToday: date === today, isFuture: date > today,
    })
  }

  const total = round2(days.reduce((s, x) => s + x.total, 0))
  const count = days.reduce((s, x) => s + x.count, 0)
  const closed = days.filter(x => x.date < today)
  const closedAvg = closed.length > 0 ? round2(closed.reduce((s, x) => s + x.total, 0) / closed.length) : null
  let best: DayPoint | null = null
  for (const x of days) if (x.total > 0 && (!best || x.total > best.total)) best = x
  return { days, total, count, closedAvg, closedDays: closed.length, best, max: Math.max(0, ...days.map(x => x.total)) }
}

/** Teto "redondo" pra escala do gráfico (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × potência de 10). */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1000
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / p
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => f <= s + 1e-9) ?? 10
  return step * p
}

/** Valor curto pro gráfico, no mesmo estilo do HourlyChart (12.3k). */
export function fmtShort(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return String(Math.round(v))
}
