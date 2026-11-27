// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FORECAST — A ÚNICA CONTA de projeção, rota e Radar Diário (puro: sem banco, sem tela).
// Tudo que o painel mostra de "projeção" (topo do Forecast, tabela, rota, KPI de Vendas, página inicial, insights de IA) sai das funções daqui.
//
// 1) O ANO PASSADO COMO RÉGUA, DIA DA SEMANA COM DIA DA SEMANA
//    Cada dia de agora é comparado com o dia de 364 dias antes (52 semanas): mesma segunda, mesma sexta… Assim a Black Friday de 27/11/2026 (sex)
//    cai em cima da de 28/11/2025 (sex) e 30/11/2026 (seg) em cima da Cyber Monday de 01/12/2025 (seg). Meses em ALINHAR_POR_DATA comparam a mesma data.
// 2) PROJEÇÃO = realizado + o resto do mês seguindo a forma de 2025, no ritmo atual
//    ritmo = (o que vendemos nos dias FECHADOS) ÷ (o que 2025 vendeu nesses mesmos dias). Hoje, que ainda está em andamento, entra pelo maior entre o que
//    já vendemos e o que o ritmo esperava. Sem dias fechados (dia 1) o ritmo vem da meta; sem meta, é igual a 2025.
// 3) ROTA = a curva de 2025 escalada para fechar exatamente na meta (o mesmo desenho do mês inteiro, definido no dia 1).
// 4) RADAR DIÁRIO = a meta de cada dia (curva de 2025 × um fator) refeita toda segunda-feira com o que falta para a meta; durante a semana a meta planejada
//    fica parada e só a meta AJUSTADA se mexe: meta do dia − a diferença acumulada até o dia anterior (superávit abate, déficit soma).
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const DIAS_ALINHAMENTO = 364
/** Meses ('AAAA-MM') que devem comparar a MESMA DATA do ano passado em vez do mesmo dia da semana. Vazio = todos os meses por dia da semana. */
export const ALINHAR_POR_DATA: ReadonlySet<string> = new Set<string>()
/** Radar: 'semana' = o plano é refeito toda segunda-feira; 'mes' = um plano só, definido no dia 1. */
export const RADAR_ANCORA: 'semana' | 'mes' = 'semana'
/** Nome de dias especiais (AAAA-MM-DD deste ano) para o texto do Radar. */
export const NOME_DIA_ESPECIAL: Record<string, string> = { '2026-11-27': 'Black Friday', '2026-11-30': 'Cyber Monday' }

const MS = 86_400_000
export const WD_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const sum = (a: number[], from = 0, to = a.length) => { let s = 0; for (let i = Math.max(0, from); i < Math.min(to, a.length); i++) s += a[i] || 0; return s }
const p2 = (n: number) => String(n).padStart(2, '0')

// ── datas (strings AAAA-MM-DD; contas em UTC, sem fuso nem horário de verão) ─────────────────────────────────────────────────
export const addDays = (iso: string, n: number): string => new Date(Date.parse(iso + 'T00:00:00Z') + n * MS).toISOString().slice(0, 10)
export const weekdayOf = (iso: string): number => new Date(iso + 'T00:00:00Z').getUTCDay()               // 0 = domingo
export const wdLabel = (iso: string): string => WD_PT[weekdayOf(iso)]
export const daysInMonthOf = (month: string): number => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate()
/** O dia do ano passado que serve de régua para `iso` (dia `iso` de um mês qualquer). */
export function refDateOf(iso: string): string {
  if (ALINHAR_POR_DATA.has(iso.slice(0, 7))) {
    const y = +iso.slice(0, 4) - 1, m = iso.slice(5, 7), d = Math.min(+iso.slice(8, 10), new Date(Date.UTC(y, +m, 0)).getUTCDate())
    return `${y}-${m}-${p2(d)}`
  }
  return addDays(iso, -DIAS_ALINHAMENTO)
}
/** Para cada dia do mês (índice 0 = dia 1), a data do ano passado que vale como régua. */
export function refDates(month: string): string[] {
  return Array.from({ length: daysInMonthOf(month) }, (_, i) => refDateOf(`${month}-${p2(i + 1)}`))
}

// ── repartir em centavos sem perder nem criar centavo (maiores restos) ──────────────────────────────────────────────────
export function reparte(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0)
  if (!(soma > 0) || !(total > 0)) return pesos.map(() => 0)
  const exatos = pesos.map(p => total * p / soma), base = exatos.map(Math.floor); let resto = total - base.reduce((a, b) => a + b, 0)
  const ordem = exatos.map((e, i) => ({ i, f: e - base[i] })).sort((a, b) => b.f - a.f || a.i - b.i)
  for (let k = 0; resto > 0 && k < ordem.length; k++, resto--) base[ordem[k].i]++
  return base
}

/** A entrada de toda conta: receita por dia deste ano (`cur`, só vale até hoje) e do dia equivalente do ano passado (`ref`), ambas com N posições. */
export interface SerieDia { cur: number[]; ref: number[]; D: number; N: number }   // D = dia de hoje (1 a N)
const clampD = (s: SerieDia) => Math.min(Math.max(Math.round(s.D) || 1, 1), Math.max(s.N, 1))

// ══ 1) PROJEÇÃO DE FECHAMENTO ═════════════════════════════════════════════════════════════════════════════════════════════
export type RitmoFonte = 'dias' | 'meta' | 'igual' | 'linear'      // de onde veio o ritmo (linear = não há ano passado para comparar)
export interface Projecao {
  realizado: number                 // vendido do dia 1 até hoje (hoje em andamento entra)
  refTotal: number                  // o que o ano passado vendeu no período equivalente, mês inteiro
  ritmo: number                     // 1 = igual ao ano passado · 1,2 = 20% acima
  fonte: RitmoFonte
  diasFechados: number
  projecao: number
  resto: number                     // projecao − realizado: o que ainda se espera vender
  meta: number
  pctVsMeta: number | null          // projeção ÷ meta × 100
  faltaPraMeta: number              // meta − realizado (nunca negativo)
  diasRestantes: number             // dias depois de hoje
  precisaDia: number | null         // faltaPraMeta ÷ diasRestantes
}
export function projetar(s: SerieDia, meta = 0): Projecao {
  const N = Math.max(s.N, 1), D = clampD(s), fechados = D - 1
  const curAte = sum(s.cur, 0, D), curFech = sum(s.cur, 0, fechados), refFech = sum(s.ref, 0, fechados), refTotal = sum(s.ref, 0, N)
  const curHoje = s.cur[D - 1] || 0, refHoje = s.ref[D - 1] || 0, refDepois = sum(s.ref, D, N)
  let ritmo = 1, fonte: RitmoFonte = 'igual', projecao: number
  if (!(refTotal > 0)) { fonte = 'linear'; ritmo = 1; projecao = D > 0 ? curAte / D * N : curAte }
  else {
    if (fechados > 0 && refFech > 0) { ritmo = curFech / refFech; fonte = 'dias' }
    else if (meta > 0) { ritmo = meta / refTotal; fonte = 'meta' }
    projecao = curFech + Math.max(curHoje, ritmo * refHoje) + ritmo * refDepois
  }
  const diasRestantes = Math.max(N - D, 0), falta = Math.max(meta - curAte, 0)
  return {
    realizado: curAte, refTotal, ritmo, fonte, diasFechados: fechados, projecao, resto: Math.max(projecao - curAte, 0), meta,
    pctVsMeta: meta > 0 ? projecao / meta * 100 : null, faltaPraMeta: falta, diasRestantes, precisaDia: diasRestantes > 0 ? falta / diasRestantes : null,
  }
}

// ══ 2) ROTA PARA A META (o gráfico "Receita acumulada") ═══════════════════════════════════════════════════════════════════
export interface PontoRota {
  day: number
  cur: number | null                // acumulado de hoje até o fim do dia; null = ainda não chegou
  ref: number                       // acumulado do ano passado (dia equivalente)
  rota: number | null               // acumulado da rota (curva do ano passado escalada para fechar na meta); null = sem meta
  proj: number | null               // acumulado projetado (a partir de hoje); null = antes de hoje
}
export interface RotaChart {
  pontos: PontoRota[]; N: number; D: number; ultimoFechado: number
  meta: number; refTotal: number; fatorRota: number | null
  curFechado: number; curHoje: number; rotaNoFechado: number | null; refNoFechado: number
  projecao: number; ritmo: number
}
/** Se vier o `radar`, a rota SEGUE O RADAR: a partir da segunda-feira do plano ela acumula a meta planejada de cada dia (e fecha exatamente na meta); antes disso é a curva do ano passado, escalada para chegar ao que já tinha sido vendido. */
export function buildRota(s: SerieDia, meta = 0, radar?: Radar): RotaChart {
  const N = Math.max(s.N, 1), D = clampD(s), p = projetar(s, meta), refTotal = p.refTotal
  const fator = meta > 0 && refTotal > 0 ? meta / refTotal : null
  const pontos: PontoRota[] = []; let cc = 0, cr = 0, cp = 0
  const usaRadar = !!radar?.ok && radar.linhas.length > 0, A = usaRadar ? radar!.inicio : 1, refAntesA = usaRadar ? sum(s.ref, 0, A - 1) : 0
  const rotaDe = (d: number, crd: number): number | null => {
    if (!usaRadar) return fator === null ? null : fator * crd
    if (d >= A) return radar!.linhas[d - A]?.metaAcum ?? radar!.meta
    return refAntesA > 0 ? radar!.realAntes * crd / refAntesA : 0
  }
  const curFech = sum(s.cur, 0, D - 1), curHoje = sum(s.cur, 0, D)
  for (let d = 1; d <= N; d++) {
    cr += s.ref[d - 1] || 0
    let cur: number | null = null, proj: number | null = null
    if (d <= D) { cc += s.cur[d - 1] || 0; cur = cc }
    if (d === D) { cp = curFech + Math.max(s.cur[d - 1] || 0, p.ritmo * (s.ref[d - 1] || 0)); proj = cp }
    else if (d > D) { cp += p.ritmo * (s.ref[d - 1] || 0); proj = cp }
    pontos.push({ day: d, cur, ref: cr, rota: rotaDe(d, cr), proj })
  }
  const refFech = sum(s.ref, 0, D - 1)
  return { pontos, N, D, ultimoFechado: D - 1, meta, refTotal, fatorRota: radar?.ok ? radar.fator : fator, curFechado: curFech, curHoje, rotaNoFechado: D - 1 >= 1 ? pontos[D - 2].rota : (fator === null && !radar?.ok ? null : 0), refNoFechado: refFech, projecao: p.projecao, ritmo: p.ritmo }
}

// ══ 3) RADAR DIÁRIO ═══════════════════════════════════════════════════════════════════════════════════════════════════════
export type QuandoRadar = 'passou' | 'hoje' | 'amanha' | 'vem'
export interface RadarLinha {
  day: number; date: string; wd: string; refDate: string; refWd: string; quando: QuandoRadar
  planejada: number                 // meta do dia, conforme o plano da semana
  ajustada: number                  // planejada − diferença acumulada até o dia anterior (superávit abate · déficit soma)
  ajuste: number                    // ajustada − planejada (negativo = a meta caiu · positivo = subiu)
  realizado: number | null
  pct: number | null                // realizado ÷ ajustada
  metaAcum: number; realAcum: number | null; difAcum: number | null
  refValor: number; especial: string | null
}
export interface Radar {
  ok: boolean; motivo?: string
  linhas: RadarLinha[]; inicio: number; fator: number; realAntes: number; meta: number; refJanela: number
  hojeDia: number; dataInicio: string; dataFim: string; refInicio: string; refFim: string
}
/** Ajuste manual do plano: a meta PLANEJADA de `dia` vira `planejada` e a diferença vai para o dia `para` (a soma do plano não muda). */
export interface AjusteRadar { dia: string; planejada: number; para: string }
export interface RadarDatas { month: string; today: string; refDates: string[]; ajustes?: AjusteRadar[] }
const r2 = (n: number) => Math.round(n * 100) / 100
export function buildRadar(s: SerieDia, meta: number, dt: RadarDatas): Radar {
  const N = Math.max(s.N, 1), D = clampD(s), dia = (d: number) => `${dt.month}-${p2(d)}`
  const base: Radar = { ok: false, linhas: [], inicio: 1, fator: 0, realAntes: 0, meta, refJanela: 0, hojeDia: D, dataInicio: dia(1), dataFim: dia(N), refInicio: dt.refDates[0] ?? '', refFim: dt.refDates[N - 1] ?? '' }
  if (!(meta > 0)) return { ...base, motivo: 'Cadastre a meta do mês para ver o Radar.' }
  const hoje = dia(D), sem = RADAR_ANCORA === 'mes' ? 0 : (weekdayOf(hoje) + 6) % 7          // dias desde a segunda-feira
  const A = Math.max(1, D - sem), realAntes = sum(s.cur, 0, A - 1), refJanela = sum(s.ref, A - 1, N)
  if (!(refJanela > 0)) return { ...base, inicio: A, realAntes, motivo: 'O ano passado não tem vendas neste período para servir de régua.' }
  const resto = Math.max(meta - realAntes, 0), fator = resto / refJanela
  const plano = reparte(Math.round(resto * 100), s.ref.slice(A - 1, N).map(v => Math.max(v || 0, 0))).map(c => c / 100)
  for (const aj of dt.ajustes ?? []) {       // ajustes manuais: só valem dentro do plano desta semana (os dois dias de A em diante)
    const i = +aj.dia.slice(8, 10) - A, j = +aj.para.slice(8, 10) - A
    if (aj.dia.slice(0, 7) !== dt.month || aj.para.slice(0, 7) !== dt.month || i < 0 || j < 0 || i >= plano.length || j >= plano.length || i === j || !(aj.planejada >= 0)) continue
    const dif = r2(plano[i] - aj.planejada); plano[i] = r2(aj.planejada); plano[j] = r2(plano[j] + dif)
  }
  const linhas: RadarLinha[] = []
  let metaAcum = realAntes, realAcum = realAntes, difPrev = 0, carry = 0
  for (let d = A; d <= N; d++) {
    const planejada = plano[d - A], date = dia(d), refDate = dt.refDates[d - 1] ?? ''
    const quando: QuandoRadar = d < D ? 'passou' : d === D ? 'hoje' : d === D + 1 ? 'amanha' : 'vem'
    metaAcum = r2(metaAcum + planejada)
    let ajustada: number, realizado: number | null = null, pct: number | null = null, rAcum: number | null = null, dif: number | null = null
    if (d <= D) {
      ajustada = Math.max(r2(planejada - difPrev), 0)
      realizado = r2(s.cur[d - 1] || 0); realAcum = r2(realAcum + realizado); rAcum = realAcum; dif = r2(realAcum - metaAcum); difPrev = dif
      pct = ajustada > 0 ? realizado / ajustada * 100 : null
    } else if (d === D + 1) {                        // amanhã já desconta a diferença de hoje, mesmo com o dia em andamento
      const bruto = r2(planejada - difPrev); ajustada = Math.max(bruto, 0); carry = bruto < 0 ? -bruto : 0
    } else {                                         // depois de amanhã: a planejada; só abate se sobrou superávit maior que a meta de amanhã
      ajustada = Math.max(r2(planejada - carry), 0); carry = Math.max(r2(carry - planejada), 0)
    }
    linhas.push({ day: d, date, wd: wdLabel(date), refDate, refWd: refDate ? wdLabel(refDate) : '', quando, planejada, ajustada, ajuste: r2(ajustada - planejada), realizado, pct, metaAcum, realAcum: rAcum, difAcum: dif, refValor: s.ref[d - 1] || 0, especial: NOME_DIA_ESPECIAL[date] ?? null })
  }
  return { ok: true, linhas, inicio: A, fator, realAntes, meta, refJanela, hojeDia: D, dataInicio: dia(A), dataFim: dia(N), refInicio: dt.refDates[A - 1] ?? '', refFim: dt.refDates[N - 1] ?? '' }
}
