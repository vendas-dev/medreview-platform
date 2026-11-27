// ══ Forecast — "este mês × o mesmo mês do ano passado": cálculo PURO (sem banco, sem tela) ═══════════════════════════════
//  • Receita = soma de TODAS as vendas (novas e recorrentes) das 4 verticais ativas; Vasc-Review/PsiqClara e qualquer outra vertical NÃO entram (não aparecem em lugar nenhum).
//  • "Operação" = a SOMA das 4 verticais na receita; a META de cada linha vem do cadastro (Operação = meta geral cadastrada).
//  • Dias em horário de Brasília. O ano passado entra JÁ ALINHADO por dia da semana (364 dias antes — veja lib/dashboard/projecao.ts): `prev[k][i]` é o dia
//    do ano passado que vale de régua para o dia i+1 deste ano, e `prevDates[i]` diz qual data é essa. Por isso 27/11/2026 (sex) casa com 28/11/2025 (sex).
//  • A PROJEÇÃO, a rota e o Radar saem todos de lib/dashboard/projecao.ts: uma conta só. Aqui ficam as visões (tabela, cartas, gráficos).
//  Colunas da tabela:  Acumulado A-1 / A (1 a D-1, só dias FECHADOS)  · Crescimento % e R$  · Projeção de fechamento (a única)  · Fechamento do período de A-1  · Meta de A  · Projeção − Meta
import { projetar, buildRadar, refDates as refDatesDe, reparte, wdLabel, type SerieDia, type Radar } from './projecao'
export { reparte }
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
  /** "Meta do Radar" do mês (total das 4 verticais): é a meta que o Radar, a rota e o hora a hora usam. Ausente/0 = usa a meta cadastrada. */
  metaRadar?: number
  today: string; month: string; dayOfMonth: number; yearCur: number; yearPrev: number
  daysInMonth: { cur: number; prev: number }                         // a janela do ano passado tem o MESMO nº de dias (prev = cur)
  /** A data do ano passado que vale de régua para cada dia (índice 0 = dia 1). Ausente = calcula pela regra dos 364 dias. */
  prevDates?: string[]
  cur: Record<VKey, number[]>; prev: Record<VKey, number[]>          // receita por dia (índice 0 = dia 1); cur só tem valor até hoje; prev já alinhado ao dia da semana
  /** SÓ do ano passado: a receita (prevH) e o nº de vendas (prevHN) de cada HORA de Brasília, por dia (índice 0 = dia 1) → 24 valores. Alimenta o gráfico "hora a hora" dos dias fortes. Ausente = sem detalhe por hora. */
  prevH?: Record<VKey, number[][]>; prevHN?: Record<VKey, number[][]>
  /** Igual ao prevH/prevHN, mas DESTE ano (o que já foi vendido hora a hora). Ausente = sem o realizado por hora. */
  curH?: Record<VKey, number[][]>; curHN?: Record<VKey, number[][]>
  /** Hora de Brasília de agora (0 a 23): o limite do "já fizemos" de hoje. Ausente = sem limite. */
  horaAgora?: number
}
export const prevDatesOf = (d: Pick<YoYData, 'month' | 'prevDates'>): string[] => d.prevDates ?? refDatesDe(d.month)
export interface TableRow {
  key: 'total' | VKey; label: string
  accPrev: number; accCur: number; growthR: number; growthPct: number | null
  projecao: number; fechPrev: number; meta: number; gapMeta: number; pctMeta: number | null; ritmo: number
}
const sum = (a: number[], from = 0, to = a.length) => { let s = 0; for (let i = from; i < Math.min(to, a.length); i++) s += a[i] || 0; return s }
export const daysIn = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate()

// ── a ponte entre os dados e a conta única ───────────────────────────────────────────────────────────────────────────────────
/** Receita por dia, deste ano e do dia equivalente do ano passado, de uma vertical ou do total das 4 (a entrada de todas as contas de lib/dashboard/projecao.ts). */
export function serieDe(d: YoYData, key: 'total' | VKey): SerieDia {
  const keys = key === 'total' ? VKEYS : [key], N = d.daysInMonth.cur
  const add = (src: Record<VKey, number[]>) => Array.from({ length: N }, (_, i) => keys.reduce((s, k) => s + (src[k]?.[i] || 0), 0))
  return { cur: add(d.cur).map((v, i) => (i < d.dayOfMonth ? v : 0)), ref: add(d.prev), D: d.dayOfMonth, N }
}
export const metaOf = (d: YoYData, key: 'total' | VKey): number => (key === 'total' ? d.metas.geral : d.metas[key]) || 0
/** A projeção de fechamento do mês — a ÚNICA, a mesma em todo o painel. */
export const projecaoOf = (d: YoYData, key: 'total' | VKey = 'total') => projetar(serieDe(d, key), metaOf(d, key))
/** A meta que o Radar usa: a "Meta do Radar" do mês (total) e, nas verticais, a parte de cada uma na meta cadastrada (a soma fecha a Meta do Radar). Sem Meta do Radar: a cadastrada. */
export function metaRadarOf(d: YoYData, key: 'total' | VKey = 'total'): number {
  const mr = d.metaRadar ?? 0
  if (!(mr > 0)) return metaOf(d, key)
  if (key === 'total') return mr
  const soma = VKEYS.reduce((a, k) => a + (d.metas[k] || 0), 0)
  return soma > 0 ? Math.round(mr * (d.metas[key] || 0) / soma * 100) / 100 : mr / VKEYS.length
}
export const radarOf = (d: YoYData, key: 'total' | VKey = 'total'): Radar => buildRadar(serieDe(d, key), metaRadarOf(d, key), { month: d.month, today: d.today, refDates: prevDatesOf(d) })

export function buildTable(d: YoYData): TableRow[] {
  const D = d.dayOfMonth, F = Math.max(D - 1, 0)         // só os dias FECHADOS entram na comparação (hoje, em andamento, não pesa contra o dia inteiro do ano passado)
  const one = (key: 'total' | VKey): TableRow => {
    const keys = key === 'total' ? VKEYS : [key], s = serieDe(d, key), p = projetar(s, metaOf(d, key))
    const accPrev = keys.reduce((a, k) => a + sum(d.prev[k], 0, F), 0), accCur = keys.reduce((a, k) => a + sum(d.cur[k], 0, F), 0)
    const meta = metaOf(d, key)          // cada linha mostra a meta CADASTRADA dela (Operação = a meta geral)
    return {
      key, label: key === 'total' ? 'Operação' : VLABEL[key], accPrev, accCur, growthR: accCur - accPrev, growthPct: accPrev > 0 ? (accCur - accPrev) / accPrev * 100 : null,
      projecao: p.projecao, fechPrev: p.refTotal, meta, gapMeta: meta > 0 ? p.projecao - meta : 0, pctMeta: p.pctVsMeta, ritmo: p.ritmo,
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
/** Dias fortes DESTE ano (chave "AAAA-MM"): são os dias que o painel destaca com ★. Como o ano passado já entra alinhado por dia da semana, cada um deles já cai em cima do
 *  dia equivalente (27/11/2026 sex ↔ 28/11/2025 sex) sem nenhuma exceção no cálculo. Mês sem entrada aqui: os dias fortes são os 3 de maior receita do ano passado. */
export const DIAS_FORTES: Record<string, number[]> = { '2026-11': [27, 28, 29] }
/** O índice do dia de régua do ano passado para `day`: como `prev` já vem alinhado, é o próprio dia (mantido para quem já usava). */
export function diaPar(_d: Pick<YoYData, 'month' | 'yearCur' | 'yearPrev' | 'daysInMonth'>, day: number): number { return day }
export interface Pico { day: number; valor: number; share: number; wd: string; dayPrev?: number; wdPrev?: string; refDate?: string }
/** Os dias de MAIOR receita do mês inteiro do ano passado, com a % FIXA (dia ÷ receita do período inteiro: nunca muda com o passar dos dias). quando = em relação a hoje. */
export type Quando = 'passou' | 'hoje' | 'vem'
export interface PicoMes extends Pico { quando: Quando; dayPrev: number; wdPrev: string; refDate: string }
export interface Route {
  key: 'total' | VKey; label: string; status: Status
  accPrev: number; accCur: number; fechPrev: number; falta: number; restoPrev: number; diasRestantes: number
  precisaDia: number | null; ritmoDia: number; restoPrevDia: number | null; exigencia: number | null
  pctFech: number; pctPrevHoje: number; projecao: number; picos: Pico[]
  picosMes: PicoMes[]; picosMesShare: number          // dias fortes do MÊS INTEIRO de A-1 (% fixa) e a soma deles
}
export function statusOf(falta: number, restoPrev: number): { status: Status; exigencia: number | null } {
  if (falta <= 0) return { status: 'batido', exigencia: 0 }
  if (!(restoPrev > 0)) return { status: 'acelerar', exigencia: null }
  const e = falta / restoPrev * 100
  return { status: e <= LIMITE_ATENCAO ? 'ok' : e <= LIMITE_ACELERAR ? 'atencao' : 'acelerar', exigencia: e }
}
export function buildRoute(d: YoYData, key: 'total' | VKey): Route {
  const keys = key === 'total' ? VKEYS : [key], D = d.dayOfMonth, Nc = d.daysInMonth.cur, rd = prevDatesOf(d)
  const accPrev = keys.reduce((s, k) => s + sum(d.prev[k], 0, D), 0), accCur = keys.reduce((s, k) => s + sum(d.cur[k], 0, D), 0), fechPrev = keys.reduce((s, k) => s + sum(d.prev[k]), 0)
  const restoPrev = keys.reduce((s, k) => s + sum(d.prev[k], D, Nc), 0), falta = Math.max(fechPrev - accCur, 0), dias = Math.max(Nc - D, 0)
  const { status, exigencia } = fechPrev > 0 ? statusOf(falta, restoPrev) : { status: 'semBase' as Status, exigencia: null }
  const picos: Pico[] = [], fortes = DIAS_FORTES[d.month], dia = (n: number) => `${d.month}-${String(n).padStart(2, '0')}`
  const mk = (day: number, valor: number): Pico => { const rf = rd[day - 1] ?? ''; return { day, valor, share: restoPrev > 0 ? valor / restoPrev * 100 : 0, wd: wdLabel(dia(day)), dayPrev: rf ? +rf.slice(8, 10) : day, wdPrev: rf ? wdLabel(rf) : '', refDate: rf } }
  const valorDe = (day: number) => keys.reduce((s, k) => s + (d.prev[k][day - 1] || 0), 0)
  if (fortes) {      // os dias fortes deste ano que ainda vêm, cada um com o valor do dia equivalente do ano passado
    for (const day of fortes) { if (day <= D || day > Nc) continue; const valor = valorDe(day); if (valor > 0) picos.push(mk(day, valor)) }
  } else for (let day = D + 1; day <= Nc; day++) { const valor = valorDe(day); if (valor > 0) picos.push(mk(day, valor)) }
  picos.sort((a, b) => b.valor - a.valor || a.day - b.day)
  return {
    key, label: key === 'total' ? 'Operação' : VLABEL[key], status, accPrev, accCur, fechPrev, falta, restoPrev, diasRestantes: dias, precisaDia: dias > 0 ? falta / dias : null,
    ritmoDia: accCur / D, restoPrevDia: dias > 0 ? restoPrev / dias : null, exigencia, pctFech: fechPrev > 0 ? accCur / fechPrev * 100 : 0, pctPrevHoje: fechPrev > 0 ? accPrev / fechPrev * 100 : 0,
    projecao: projecaoOf(d, key).projecao, picos: picos.slice(0, 3), ...picosDoMes(d, keys, fechPrev),
  }
}
/** Top dias da receita de TODO o período do ano passado. A % de cada dia é dia ÷ período inteiro: é FIXA (não muda com o dia de hoje). */
function picosDoMes(d: YoYData, keys: VKey[], fechPrev: number, n = 3): { picosMes: PicoMes[]; picosMesShare: number } {
  const D = d.dayOfMonth, lista: PicoMes[] = [], fortes = DIAS_FORTES[d.month], rd = prevDatesOf(d), dia = (x: number) => `${d.month}-${String(x).padStart(2, '0')}`
  const dias = fortes ? fortes.filter(x => x >= 1 && x <= d.daysInMonth.cur) : Array.from({ length: d.daysInMonth.cur }, (_, i) => i + 1)
  for (const day of dias) {
    const valor = keys.reduce((s, k) => s + (d.prev[k][day - 1] || 0), 0), rf = rd[day - 1] ?? ''
    if (valor > 0 && fechPrev > 0) lista.push({ day, valor, share: valor / fechPrev * 100, wd: wdLabel(dia(day)), dayPrev: rf ? +rf.slice(8, 10) : day, wdPrev: rf ? wdLabel(rf) : '', refDate: rf, quando: day < D ? 'passou' : day === D ? 'hoje' : 'vem' })
  }
  if (fortes) lista.sort((a, b) => a.day - b.day); else lista.sort((a, b) => b.valor - a.valor || a.day - b.day)      // dias configurados: em ordem de data; senão, do maior para o menor
  const top = lista.slice(0, n); return { picosMes: top, picosMesShare: top.reduce((s, p) => s + p.share, 0) }
}
export const buildRoutes = (d: YoYData): Route[] => (['total', 'anest', 'oft', 'ortop', 'r1'] as const).map(k => buildRoute(d, k))
export const STATUS_LABEL: Record<Status, string> = { batido: 'Já igualou o ano passado', ok: 'No caminho', atencao: 'Atenção', acelerar: 'Precisa acelerar', semBase: 'Sem base de comparação' }
/** A frase que diz ao gestor o que fazer. */
export function routeMessage(r: Route, yearPrev: number): string {
  const pct = (v: number) => `${Math.round(v)}%`
  if (r.status === 'semBase') return `Não há vendas de ${yearPrev} neste mês para comparar.`
  if (r.status === 'batido') return `Já passou o fechamento de ${yearPrev}: ${fmtMi(r.accCur - r.fechPrev)} acima. Tudo daqui para frente é ganho.`
  if (r.diasRestantes === 0) return `Último dia do mês: faltam ${fmtMi(r.falta)} para igualar ${yearPrev}.`
  if (r.status === 'ok') return `No ritmo atual o mês fecha em ${fmtMi(r.projecao)}, ${fmtMi(r.projecao - r.fechPrev)} acima de ${yearPrev}. Dá para vender até ${pct(100 - (r.exigencia ?? 0))} menos que ${yearPrev} e ainda igualar.`
  if (r.exigencia === null) return `Em ${yearPrev} não houve venda no resto do mês: é preciso ${fmtMi(r.precisaDia ?? 0)} por dia para igualar.`
  return `Para igualar ${yearPrev} é preciso vender ${pct(r.exigencia)} do que ${yearPrev} vendeu no resto do mês: ${fmtMi(r.precisaDia ?? 0)} por dia, contra a média de ${fmtMi(r.ritmoDia)} até agora.`
}
// ══ O PLANO HORA A HORA DE UM DIA FORTE ═════════════════════════════════════════════════════════════════════════════
// A META DO DIA é a MESMA do Radar Diário (lib/dashboard/projecao.ts): a ajustada, de hoje em diante; antes disso, a planejada da semana (ou, se o dia é anterior ao plano, o peso do dia × a meta).
// Essa meta do dia é repartida pelas 24 horas de Brasília NA MESMA PROPORÇÃO em que A-1 vendeu naquele dia. Em centavos: a soma das horas fecha EXATAMENTE a meta do dia.
export interface HoraPlano { h: number; prev: number; prevN: number; shareDia: number; alvo: number; alvoAcum: number; real: number | null; realN: number | null; realAcum: number | null }
export interface PlanoDia {
  key: 'total' | VKey; label: string; day: number; dayPrev: number; refDate: string; wdCur: string; wdPrev: string; quando: Quando      // dayPrev/refDate = o dia do ano passado usado como modelo (o mesmo dia da semana)
  share: number                                                   // % FIXA do dia sobre a receita do período inteiro de A-1
  valorPrev: number; vendasPrev: number; fechPrev: number
  meta: number; temMeta: boolean; alvoDia: number                  // meta do mês (a do Radar) · meta deste dia (a do Radar)
  temReal: boolean; realDia: number | null; vendasDia: number | null; horaAgora: number | null    // já vendido no dia (null = o dia ainda não chegou) · hora de Brasília de agora (só hoje)
  projDia: number | null           // quanto o dia fecha no ritmo atual do mês (ritmo × o mesmo dia de A-1); hoje nunca fica abaixo do já vendido
  temHoras: boolean; horas: HoraPlano[]; horaForte: number | null
}
export function buildPlanoDia(d: YoYData, key: 'total' | VKey, day: number): PlanoDia | null {
  const keys = key === 'total' ? VKEYS : [key], D = d.dayOfMonth, rd = prevDatesOf(d), dia = (n: number) => `${d.month}-${String(n).padStart(2, '0')}`
  if (!(day >= 1 && day <= d.daysInMonth.cur)) return null
  const rf = rd[day - 1] ?? ''
  const valorPrev = keys.reduce((s, k) => s + (d.prev[k][day - 1] || 0), 0), fechPrev = keys.reduce((s, k) => s + sum(d.prev[k]), 0)
  if (!(valorPrev > 0) || !(fechPrev > 0)) return null
  const meta = metaRadarOf(d, key), temMeta = meta > 0
  const linha = temMeta ? radarOf(d, key).linhas.find(l => l.day === day) : undefined
  const alvoDia = !temMeta ? 0 : linha ? (day >= D ? linha.ajustada : linha.planejada) : Math.round(meta * valorPrev / fechPrev * 100) / 100
  const hv = Array.from({ length: 24 }, (_, h) => keys.reduce((s, k) => s + (d.prevH?.[k]?.[day - 1]?.[h] || 0), 0)), hn = Array.from({ length: 24 }, (_, h) => keys.reduce((s, k) => s + (d.prevHN?.[k]?.[day - 1]?.[h] || 0), 0))
  const somaH = hv.reduce((a, b) => a + b, 0), temHoras = somaH > 0
  const alvos = temMeta && temHoras ? reparte(Math.round(alvoDia * 100), hv).map(c => c / 100) : hv.map(() => 0)
  const diaChegou = day <= D, temReal = diaChegou && !!d.curH
  const cv = Array.from({ length: 24 }, (_, h) => keys.reduce((s, k) => s + (d.curH?.[k]?.[day - 1]?.[h] || 0), 0)), cn = Array.from({ length: 24 }, (_, h) => keys.reduce((s, k) => s + (d.curHN?.[k]?.[day - 1]?.[h] || 0), 0))
  const horaAgora = day === D && d.horaAgora !== undefined ? d.horaAgora : null
  let acum = 0, racum = 0
  const horas: HoraPlano[] = temHoras ? hv.map((v, h) => {
    acum = Math.round((acum + alvos[h]) * 100) / 100
    const vivo = temReal && (horaAgora === null || h <= horaAgora)       // hora que ainda não chegou fica sem barra
    if (vivo) racum = Math.round((racum + cv[h]) * 100) / 100
    return { h, prev: v, prevN: hn[h], shareDia: v / somaH * 100, alvo: alvos[h], alvoAcum: acum, real: vivo ? cv[h] : null, realN: vivo ? cn[h] : null, realAcum: vivo ? racum : null }
  }) : []
  const realDia = diaChegou ? keys.reduce((s, k) => s + (d.cur[k][day - 1] || 0), 0) : null
  const ritmo = projetar(serieDe(d, key), metaOf(d, key)).ritmo
  const projDia = day < D ? realDia : day === D ? Math.max(realDia ?? 0, ritmo * valorPrev) : ritmo * valorPrev
  const ref = (x: HoraPlano) => (temMeta ? x.alvo : x.prev), forte = horas.reduce<HoraPlano | null>((b, x) => (b === null || ref(x) > ref(b) ? x : b), null)
  return { key, label: key === 'total' ? 'Operação' : VLABEL[key], day, dayPrev: rf ? +rf.slice(8, 10) : day, refDate: rf, wdCur: wdLabel(dia(day)), wdPrev: rf ? wdLabel(rf) : '', quando: day < D ? 'passou' : day === D ? 'hoje' : 'vem',
    share: valorPrev / fechPrev * 100, valorPrev, vendasPrev: hn.reduce((a, b) => a + b, 0), fechPrev, meta, temMeta, alvoDia, temReal, realDia, vendasDia: temReal ? cn.reduce((a, b) => a + b, 0) : null, horaAgora, projDia, temHoras, horas, horaForte: forte ? forte.h : null }
}

export interface DayPoint { day: number; wdCur: string; wdPrev: string; refDate: string; cur: number | null; prev: number | null; metaDia?: number | null }      // metaDia = a meta do dia do Radar (ajustada de hoje em diante, planejada antes); null = dia fora do plano
export interface Series { days: DayPoint[]; toDateCur: number; toDatePrev: number; growthR: number; growthPct: number | null; fechPrev: number; max: number; fechados: number }
/** Uma barra dupla por dia do mês: este ano (só até hoje; dia futuro = sem barra) e o dia equivalente do ano passado (o mês inteiro). Os totais comparam só os dias FECHADOS. */
export function buildSeries(d: YoYData, key: 'total' | VKey): Series {
  const keys = key === 'total' ? VKEYS : [key], N = d.daysInMonth.cur, D = d.dayOfMonth, F = Math.max(D - 1, 0), rd = prevDatesOf(d), dia = (n: number) => `${d.month}-${String(n).padStart(2, '0')}`
  const days: DayPoint[] = []; let max = 0
  const radar = metaRadarOf(d, key) > 0 ? radarOf(d, key) : null, linhaDe = (n: number) => (radar?.ok ? radar.linhas.find(l => l.day === n) : undefined)
  for (let day = 1; day <= N; day++) {
    const cur = day <= D ? keys.reduce((s, k) => s + (d.cur[k][day - 1] || 0), 0) : null
    const prev = keys.reduce((s, k) => s + (d.prev[k][day - 1] || 0), 0), rf = rd[day - 1] ?? ''
    const ln = linhaDe(day); days.push({ day, wdCur: wdLabel(dia(day)), wdPrev: rf ? wdLabel(rf) : '', refDate: rf, cur, prev, metaDia: ln ? (day >= D ? ln.ajustada : ln.planejada) : null }); max = Math.max(max, cur ?? 0, prev ?? 0)
  }
  const toDateCur = keys.reduce((s, k) => s + sum(d.cur[k], 0, F), 0), toDatePrev = keys.reduce((s, k) => s + sum(d.prev[k], 0, F), 0)
  return { days, toDateCur, toDatePrev, growthR: toDateCur - toDatePrev, growthPct: toDatePrev > 0 ? (toDateCur - toDatePrev) / toDatePrev * 100 : null, fechPrev: keys.reduce((s, k) => s + sum(d.prev[k]), 0), max, fechados: F }
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
/** A % FIXA de um dia sobre o mês: sempre com uma casa (19,3%). */
export const fmtShare = (p: number) => `${dec(p, 1)}%`
export const fmtPct = (p: number | null, signed = true) => p === null ? '—' : `${p < 0 ? MINUS : (signed && p > 0 ? '+' : '')}${dec(Math.abs(p), 1)}%`
export const fmtReais = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const fmtAxis = (v: number) => v >= 1_000_000 ? `${dec(v / 1_000_000, v % 1_000_000 === 0 ? 0 : 1)} mi` : v >= 1000 ? `${dec(v / 1000, 0)} mil` : dec(v, 0)
/** AAAA-MM-DD → dd/mm/aaaa (ou dd/mm). */
export const fmtDataBR = (iso: string, ano = true) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}${ano ? '/' + iso.slice(0, 4) : ''}` : '')
export const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
