// ══ Forecast — "este mês × o mesmo mês do ano passado": cálculo PURO (sem banco, sem tela) ═══════════════════════════════
//  • Receita = soma de TODAS as vendas (novas e recorrentes) das 4 verticais ativas; Vasc-Review/PsiqClara e qualquer outra vertical NÃO entram (não aparecem em lugar nenhum).
//  • "Operação" = a SOMA das 4 verticais na receita; a META de cada linha vem do cadastro (Operação = meta geral cadastrada).
//  • Dias em horário de Brasília. O acumulado compara o dia 1 até HOJE de cada ano (hoje, ainda em andamento, entra).
//  Colunas da tabela (as mesmas do print):
//    Acumulado A-1 / A (1 a D)  · Crescimento % e R$  · Ritmo linear = acumulado ÷ D × dias do mês  · Projeção pelo comportamento de A-1
//    = acumulado de A + o que A-1 vendeu do dia D+1 ao fim do mês  · Fechamento real de A-1  · Meta de A  · Ritmo linear de A − Meta
export type VKey = 'anest' | 'oft' | 'ortop' | 'r1'
export const VKEYS: VKey[] = ['anest', 'oft', 'ortop', 'r1']
export const VERTICAL_DB: Record<string, VKey> = { anestreview: 'anest', oftreview: 'oft', ortopreview: 'ortop', medreview: 'r1' }     // só estas entram
export const DB_VERTICALS = Object.keys(VERTICAL_DB)
export const VLABEL: Record<VKey, string> = { anest: 'Anest-Review', oft: 'Oft-Review', ortop: 'Ortop-Review', r1: 'Med-Review R1' }
export const TABLE_ORDER: ('total' | VKey)[] = ['total', 'r1', 'anest', 'oft', 'ortop']                  // a ordem do print: Operação, Med-Review R1, Anest, Oft, Ortop

/** Metas do mês, lidas do CADASTRO (company_goals; a geral cai para a soma das metas dos closers) — a mesma fonte do restante do Forecast. */
export interface YoYMetas { anest: number; oft: number; ortop: number; r1: number; geral: number }
export interface YoYData {
  metas: YoYMetas
  today: string; month: string; dayOfMonth: number; yearCur: number; yearPrev: number
  daysInMonth: { cur: number; prev: number }
  cur: Record<VKey, number[]>; prev: Record<VKey, number[]>          // receita por dia (índice 0 = dia 1); cur só tem valor até hoje
}
export interface TableRow {
  key: 'total' | VKey; label: string
  accPrev: number; accCur: number; growthR: number; growthPct: number | null
  ritmoPrev: number; ritmoCur: number; projecao: number; fechPrev: number; meta: number; gapMeta: number
}
const sum = (a: number[], from = 0, to = a.length) => { let s = 0; for (let i = from; i < Math.min(to, a.length); i++) s += a[i] || 0; return s }
export const daysIn = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate()

export function buildTable(d: YoYData): TableRow[] {
  const D = d.dayOfMonth, metas = d.metas
  const one = (key: 'total' | VKey): TableRow => {
    const keys = key === 'total' ? VKEYS : [key]
    const accPrev = keys.reduce((s, k) => s + sum(d.prev[k], 0, D), 0), accCur = keys.reduce((s, k) => s + sum(d.cur[k], 0, D), 0)
    const fechPrev = keys.reduce((s, k) => s + sum(d.prev[k]), 0), meta = key === 'total' ? (metas.geral || 0) : (metas[key] || 0)        // cada linha mostra a meta CADASTRADA dela (Operação = a meta geral)
    const restoPrev = keys.reduce((s, k) => s + sum(d.prev[k], D, d.daysInMonth.cur), 0)        // o que o ano passado vendeu do dia D+1 até o último dia deste mês
    const ritmoCur = accCur / D * d.daysInMonth.cur
    return {
      key, label: key === 'total' ? 'Operação' : VLABEL[key], accPrev, accCur, growthR: accCur - accPrev, growthPct: accPrev > 0 ? (accCur - accPrev) / accPrev * 100 : null,
      ritmoPrev: accPrev / D * d.daysInMonth.prev, ritmoCur, projecao: accCur + restoPrev, fechPrev, meta, gapMeta: ritmoCur - meta,
    }
  }
  return TABLE_ORDER.map(one)
}

// ══ A ROTA PARA IGUALAR O ANO PASSADO ═════════════════════════════════════════════════════════════════════════════════
// Objetivo do gestor: fechar o mês PELO MENOS no valor do mesmo mês do ano passado (o piso da meta). Para cada linha:
//   falta        = fechamento do ano passado − o que já vendemos (nunca negativo)
//   precisa/dia  = falta ÷ dias que ainda restam depois de hoje
//   exigência    = falta ÷ (o que o ano passado vendeu do dia seguinte ao fim do mês)  → "precisa vender X% do que o ano passado vendeu no resto do mês"
//   situação     = já igualou (falta 0) · no caminho (exigência ≤ 100%: repetindo o resto de 2025 já iguala) · atenção (até 115%) · precisa acelerar (acima de 115%)
export type Status = 'batido' | 'ok' | 'atencao' | 'acelerar' | 'semBase'      // semBase: o ano passado não vendeu nada neste mês (não há o que igualar nem com o que comparar)
export const LIMITE_ATENCAO = 100, LIMITE_ACELERAR = 115
export interface Pico { day: number; valor: number; share: number; wd: string }
export interface Route {
  key: 'total' | VKey; label: string; status: Status
  accPrev: number; accCur: number; fechPrev: number; falta: number; restoPrev: number; diasRestantes: number
  precisaDia: number | null; ritmoDia: number; restoPrevDia: number | null; exigencia: number | null
  pctFech: number; pctPrevHoje: number; projecao: number; picos: Pico[]
}
export function statusOf(falta: number, restoPrev: number): { status: Status; exigencia: number | null } {
  if (falta <= 0) return { status: 'batido', exigencia: 0 }
  if (!(restoPrev > 0)) return { status: 'acelerar', exigencia: null }
  const e = falta / restoPrev * 100
  return { status: e <= LIMITE_ATENCAO ? 'ok' : e <= LIMITE_ACELERAR ? 'atencao' : 'acelerar', exigencia: e }
}
export function buildRoute(d: YoYData, key: 'total' | VKey): Route {
  const keys = key === 'total' ? VKEYS : [key], D = d.dayOfMonth, m1 = +d.month.slice(5), Nc = d.daysInMonth.cur
  const accPrev = keys.reduce((s, k) => s + sum(d.prev[k], 0, D), 0), accCur = keys.reduce((s, k) => s + sum(d.cur[k], 0, D), 0), fechPrev = keys.reduce((s, k) => s + sum(d.prev[k]), 0)
  const restoPrev = keys.reduce((s, k) => s + sum(d.prev[k], D, Nc), 0), falta = Math.max(fechPrev - accCur, 0), dias = Math.max(Nc - D, 0)
  const { status, exigencia } = fechPrev > 0 ? statusOf(falta, restoPrev) : { status: 'semBase' as Status, exigencia: null }
  const picos: Pico[] = []
  for (let day = D + 1; day <= Math.min(Nc, d.daysInMonth.prev); day++) { const valor = keys.reduce((s, k) => s + (d.prev[k][day - 1] || 0), 0); if (valor > 0) picos.push({ day, valor, share: restoPrev > 0 ? valor / restoPrev * 100 : 0, wd: wd(d.yearCur, m1, day) }) }
  picos.sort((a, b) => b.valor - a.valor || a.day - b.day)
  return {
    key, label: key === 'total' ? 'Operação' : VLABEL[key], status, accPrev, accCur, fechPrev, falta, restoPrev, diasRestantes: dias, precisaDia: dias > 0 ? falta / dias : null,
    ritmoDia: accCur / D, restoPrevDia: dias > 0 ? restoPrev / dias : null, exigencia, pctFech: fechPrev > 0 ? accCur / fechPrev * 100 : 0, pctPrevHoje: fechPrev > 0 ? accPrev / fechPrev * 100 : 0,
    projecao: accCur + restoPrev, picos: picos.slice(0, 3),
  }
}
export const buildRoutes = (d: YoYData): Route[] => (['total', 'anest', 'oft', 'ortop', 'r1'] as const).map(k => buildRoute(d, k))
export const STATUS_LABEL: Record<Status, string> = { batido: 'Já igualou o ano passado', ok: 'No caminho', atencao: 'Atenção', acelerar: 'Precisa acelerar', semBase: 'Sem base de comparação' }
/** A frase que diz ao gestor o que fazer. */
export function routeMessage(r: Route, yearPrev: number): string {
  const pct = (v: number) => `${Math.round(v)}%`
  if (r.status === 'semBase') return `Não há vendas de ${yearPrev} neste mês para comparar.`
  if (r.status === 'batido') return `Já passou o fechamento de ${yearPrev}: ${fmtMi(r.accCur - r.fechPrev)} acima. Tudo daqui para frente é ganho.`
  if (r.diasRestantes === 0) return `Último dia do mês: faltam ${fmtMi(r.falta)} para igualar ${yearPrev}.`
  if (r.status === 'ok') return `Se o resto do mês repetir ${yearPrev}, o mês fecha em ${fmtMi(r.projecao)}, ${fmtMi(r.projecao - r.fechPrev)} acima de ${yearPrev}. Dá para vender até ${pct(100 - (r.exigencia ?? 0))} menos que ${yearPrev} e ainda igualar.`
  if (r.exigencia === null) return `Em ${yearPrev} não houve venda no resto do mês: é preciso ${fmtMi(r.precisaDia ?? 0)} por dia para igualar.`
  return `Para igualar ${yearPrev} é preciso vender ${pct(r.exigencia)} do que ${yearPrev} vendeu no resto do mês: ${fmtMi(r.precisaDia ?? 0)} por dia, contra a média de ${fmtMi(r.ritmoDia)} até agora.`
}
export interface DayPoint { day: number; wdCur: string; wdPrev: string; cur: number | null; prev: number | null }
export interface Series { days: DayPoint[]; toDateCur: number; toDatePrev: number; growthR: number; growthPct: number | null; fechPrev: number; max: number }
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const wd = (y: number, m1: number, day: number) => (day >= 1 && day <= daysIn(y, m1)) ? WD[new Date(Date.UTC(y, m1 - 1, day)).getUTCDay()] : ''
/** Uma barra dupla por dia do mês: 2026 (só até hoje; dia futuro = sem barra) e 2025 (o mês inteiro). */
export function buildSeries(d: YoYData, key: 'total' | VKey): Series {
  const keys = key === 'total' ? VKEYS : [key], m1 = +d.month.slice(5), N = Math.max(d.daysInMonth.cur, d.daysInMonth.prev), D = d.dayOfMonth
  const days: DayPoint[] = []; let max = 0
  for (let day = 1; day <= N; day++) {
    const cur = day <= D && day <= d.daysInMonth.cur ? keys.reduce((s, k) => s + (d.cur[k][day - 1] || 0), 0) : null
    const prev = day <= d.daysInMonth.prev ? keys.reduce((s, k) => s + (d.prev[k][day - 1] || 0), 0) : null
    days.push({ day, wdCur: wd(d.yearCur, m1, day), wdPrev: wd(d.yearPrev, m1, day), cur, prev }); max = Math.max(max, cur ?? 0, prev ?? 0)
  }
  const toDateCur = keys.reduce((s, k) => s + sum(d.cur[k], 0, D), 0), toDatePrev = keys.reduce((s, k) => s + sum(d.prev[k], 0, D), 0)
  return { days, toDateCur, toDatePrev, growthR: toDateCur - toDatePrev, growthPct: toDatePrev > 0 ? (toDateCur - toDatePrev) / toDatePrev * 100 : null, fechPrev: keys.reduce((s, k) => s + sum(d.prev[k]), 0), max }
}
/** Escala "redonda" do eixo: 4 divisões iguais e um máximo fácil de ler (ex.: 183 mil → 200 mil). */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 0.25, 0.5, 0.75, 1] }
  const raw = max / 4, exp = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / exp
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp, top = Math.ceil(max / step - 1e-9) * step, ticks: number[] = []
  for (let v = 0; v <= top + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { top, ticks }
}

/** Escala do gráfico de barras. "Ampliada": quando UM dia é muito maior que o resto (ex.: o dia 28 vende 5× mais), ele achata todos os outros em "barrinhas iguais".
 *  Então a régua passa a caber nos dias típicos (≈ 85% dos dias × 1,5) e só os dias acima dela são CORTADOS (o gráfico marca o corte e escreve o valor no topo).
 *  Só amplia quando o maior dia passa 30% do teto da régua ampliada; com poucos dias (< 8 com venda) ou sem exagero, usa a escala proporcional. */
export interface ChartScale { top: number; ticks: number[]; clipped: number[]; ampliada: boolean }
export function chartScale(s: Series, ampliada: boolean): ChartScale {
  const base = niceScale(s.max), normal: ChartScale = { top: base.top, ticks: base.ticks, clipped: [], ampliada: false }
  if (!ampliada) return normal
  const vals = s.days.flatMap(d => [d.cur, d.prev]).filter((v): v is number => v !== null && v > 0).sort((a, b) => a - b)
  if (vals.length < 8) return normal
  const cap = niceScale(vals[Math.floor(0.85 * (vals.length - 1))] * 1.5)
  if (s.max <= cap.top * 1.3) return normal
  return { top: cap.top, ticks: cap.ticks, clipped: s.days.filter(d => (d.cur ?? 0) > cap.top || (d.prev ?? 0) > cap.top).map(d => d.day), ampliada: true }
}

// ── formatação (o estilo do print: "R$ 344,3 mil", "R$ 9,45 mi", "−32,6%") ───────────────────────────────────────────────
const MINUS = '−'
const dec = (v: number, n: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n })
export function fmtMi(v: number, signed = false): string {
  const a = Math.abs(v), sign = v < 0 ? MINUS : (signed && v > 0 ? '+' : '')
  let t: string
  if (a >= 1_000_000) t = `R$ ${dec(a / 1_000_000, 2)} mi`
  else if (a >= 1000) { const x = a / 1000, s = dec(x, 1); t = `R$ ${s.endsWith(',0') ? s.slice(0, -2) : s} mil` }
  else t = `R$ ${dec(a, 0)}`
  return sign + t
}
/** Igual ao fmtMi, sem o "R$" (para a tabela, onde o cabeçalho já diz "valores em R$"): 944 mil · 9,43 mi · −388 mil. */
export const fmtNum = (v: number, signed = false): string => fmtMi(v, signed).replace('R$ ', '')
export const fmtPct = (p: number | null, signed = true) => p === null ? '—' : `${p < 0 ? MINUS : (signed && p > 0 ? '+' : '')}${dec(Math.abs(p), 1)}%`
export const fmtReais = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const fmtAxis = (v: number) => v >= 1_000_000 ? `${dec(v / 1_000_000, v % 1_000_000 === 0 ? 0 : 1)} mi` : v >= 1000 ? `${dec(v / 1000, 0)} mil` : dec(v, 0)
export const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
