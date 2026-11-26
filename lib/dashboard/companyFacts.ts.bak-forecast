// ── Fatos do painel de empresa — calculados em CÓDIGO, nunca pela IA ───────────────────────────
// A IA do diagnóstico recebia números soltos (e, no caso do "% da meta", calculado sobre a SOMA DAS METAS DOS CLOSERS em vez da meta da
// empresa) e escrevia as frases em cima deles — daí "Meta em 72%" quando o painel mostra 40%. Aqui ficam: (1) as contas, feitas uma vez só
// e iguais às da tela; (2) o texto dos fatos que vai pro prompt; (3) a lista de números que a IA PODE citar; (4) a validação do que ela escreveu;
// (5) os insights de situação/projeção, que são determinísticos (sempre certos).

export type GoalSource = 'empresa' | 'closers' | 'nenhuma' | 'indisponivel'   // indisponivel = não consegui ler a meta agora (não é o mesmo que "não cadastrada")
export type PaceStatus = 'sem_meta' | 'meta_batida' | 'adiantada' | 'no_ritmo' | 'atrasada'
export interface CompanyInsight { type: 'alerta' | 'oportunidade' | 'destaque'; titulo: string; motivo: string | null; sugestao: string | null }

export interface FactsInput {
  revenue: number                      // receita do mês até agora
  goal: number                         // meta da EMPRESA no mês (a mesma que a tela mostra)
  goalSource: GoalSource
  dayOfMonth: number; daysInMonth: number
  forecastClose: number | null         // projeção de fechamento do mês (receita + novas vendas no ritmo + recorrência)
  pipelineNew: number                  // novas vendas projetadas pro resto do mês, no ritmo atual
  recurringExpected: number            // recorrência prevista pro resto do mês
  prevSamePeriod: number | null        // mês anterior ATÉ O MESMO DIA (comparação justa)
  prevMonthTotal: number               // mês anterior fechado (só contexto)
  moneyLeft: number                    // dinheiro deixado na mesa (descontos)
}
export interface CompanyFacts {
  revenue: number; goal: number; goalSource: GoalSource; hasGoal: boolean
  pctGoal: number; pctMonthElapsed: number; dayOfMonth: number; daysInMonth: number; daysLeft: number
  remaining: number; requiredPerDay: number; currentPerDay: number; paceGapPp: number; status: PaceStatus
  forecastClose: number | null; pctForecast: number | null
  pipelineNew: number; recurringExpected: number
  prevSamePeriod: number | null; deltaVsPrevPct: number | null; prevMonthTotal: number; moneyLeft: number
}

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const pos = (v: any) => Math.max(num(v), 0)

export function buildCompanyFacts(i: FactsInput): CompanyFacts {
  const daysInMonth = Number.isFinite(i.daysInMonth) && i.daysInMonth >= 28 && i.daysInMonth <= 31 ? Math.floor(i.daysInMonth) : 30
  const dayOfMonth = Math.min(Math.max(Math.floor(num(i.dayOfMonth)) || 1, 1), daysInMonth)
  const revenue = pos(i.revenue), goal = pos(i.goal), hasGoal = goal > 0
  const daysLeft = daysInMonth - dayOfMonth
  const pctGoal = hasGoal ? (revenue / goal) * 100 : 0
  const pctMonthElapsed = (dayOfMonth / daysInMonth) * 100
  const remaining = hasGoal ? Math.max(goal - revenue, 0) : 0
  const gap = pctGoal - pctMonthElapsed
  const status: PaceStatus = !hasGoal ? 'sem_meta' : revenue >= goal ? 'meta_batida' : gap >= 3 ? 'adiantada' : gap <= -3 ? 'atrasada' : 'no_ritmo'
  const forecastClose = i.forecastClose == null || !Number.isFinite(Number(i.forecastClose)) ? null : pos(i.forecastClose)
  const prevSame = i.prevSamePeriod == null || !Number.isFinite(Number(i.prevSamePeriod)) ? null : pos(i.prevSamePeriod)
  return {
    revenue, goal, goalSource: hasGoal ? (i.goalSource === 'closers' ? 'closers' : 'empresa') : (i.goalSource === 'indisponivel' ? 'indisponivel' : 'nenhuma'), hasGoal, pctGoal, pctMonthElapsed, dayOfMonth, daysInMonth, daysLeft,
    remaining, requiredPerDay: daysLeft > 0 ? remaining / daysLeft : remaining, currentPerDay: revenue / dayOfMonth, paceGapPp: hasGoal ? gap : 0, status,
    forecastClose, pctForecast: hasGoal && forecastClose !== null ? (forecastClose / goal) * 100 : null,
    pipelineNew: pos(i.pipelineNew), recurringExpected: pos(i.recurringExpected),
    prevSamePeriod: prevSame, deltaVsPrevPct: prevSame !== null && prevSame > 0 ? (revenue / prevSame - 1) * 100 : null,
    prevMonthTotal: pos(i.prevMonthTotal), moneyLeft: pos(i.moneyLeft),
  }
}

// ── formatação única (o prompt e os textos determinísticos usam as MESMAS funções) ─────────────
export const fmtPct = (n: number) => `${Math.round(num(n))}%`
export function fmtMoney(n: number): string {
  const v = Math.abs(num(n)), sign = num(n) < 0 ? '-' : '', k = Math.round(v / 1e3)
  if (v >= 1e6 || k >= 1000) return `${sign}R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi`
  if (v >= 1e3) return `${sign}R$ ${k} mil`
  return `${sign}R$ ${Math.round(v)}`
}
const GOAL_LABEL: Record<GoalSource, string> = { empresa: 'meta da empresa', closers: 'soma das metas dos closers (a meta da empresa não está cadastrada)', nenhuma: 'sem meta cadastrada', indisponivel: 'indisponível' }

/** Bloco "FATOS" do prompt: tudo já calculado, com a formatação que a IA deve copiar. */
export function factLines(f: CompanyFacts): string[] {
  const L = [
    `Hoje é o dia ${f.dayOfMonth} de ${f.daysInMonth} do mês (${fmtPct(f.pctMonthElapsed)} do mês já passou; faltam ${f.daysLeft} dias)`,
    `Receita do mês até hoje: ${fmtMoney(f.revenue)} (média de ${fmtMoney(f.currentPerDay)} por dia)`,
  ]
  if (f.hasGoal) {
    L.push(`Meta do mês (${GOAL_LABEL[f.goalSource]}): ${fmtMoney(f.goal)}`, `% da meta atingido: ${fmtPct(f.pctGoal)}`)
    L.push(f.status === 'meta_batida' ? 'Situação: meta já batida' : `Falta pra meta: ${fmtMoney(f.remaining)} (${fmtMoney(f.requiredPerDay)} por dia nos ${f.daysLeft} dias restantes)`)
    L.push(`Ritmo × calendário: ${f.status === 'atrasada' ? 'ABAIXO do calendário' : f.status === 'adiantada' ? 'ACIMA do calendário' : f.status === 'meta_batida' ? 'meta batida' : 'em linha com o calendário'} (${fmtPct(f.pctGoal)} da meta contra ${fmtPct(f.pctMonthElapsed)} do mês)`)
    if (f.forecastClose !== null) L.push(`Projeção de fechamento do mês: ${fmtMoney(f.forecastClose)} (${fmtPct(f.pctForecast as number)} da meta)`)
  } else L.push(f.goalSource === 'indisponivel' ? 'Meta do mês: INDISPONÍVEL agora (não calcule nem cite % de meta)' : 'Meta do mês: NÃO cadastrada (não calcule nem cite % de meta)')
  if (f.pipelineNew > 0 || f.recurringExpected > 0) L.push(`Do resto do mês: novas vendas projetadas no ritmo atual ${fmtMoney(f.pipelineNew)}; recorrência prevista ${fmtMoney(f.recurringExpected)}`)
  if (f.prevSamePeriod !== null && f.prevSamePeriod > 0) L.push(`Mesmo período do mês anterior (até o dia ${f.dayOfMonth}): ${fmtMoney(f.prevSamePeriod)}${f.deltaVsPrevPct !== null ? ` — receita atual ${f.deltaVsPrevPct >= 0 ? '+' : '-'}${fmtPct(Math.abs(f.deltaVsPrevPct))} em relação a ele` : ''}`)
  if (f.prevMonthTotal > 0) L.push(`Mês anterior fechado: ${fmtMoney(f.prevMonthTotal)} (só contexto: NÃO compare com a receita parcial do mês atual)`)
  L.push(`Dinheiro deixado na mesa (descontos) no mês: ${fmtMoney(f.moneyLeft)}`)
  return L
}

// ── o que a IA pode citar ─────────────────────────────────────────────────────────────────────
export interface Allowed { pcts: number[]; moneys: number[]; days: number[] }
export const emptyAllowed = (): Allowed => ({ pcts: [], moneys: [], days: [] })
export function allowedFromFacts(f: CompanyFacts): Allowed {
  const a = emptyAllowed()
  a.pcts.push(f.pctMonthElapsed, f.pctGoal, Math.abs(f.paceGapPp))
  if (f.pctForecast !== null) a.pcts.push(f.pctForecast)
  if (f.deltaVsPrevPct !== null) a.pcts.push(Math.abs(f.deltaVsPrevPct))
  a.moneys.push(f.revenue, f.goal, f.remaining, f.requiredPerDay, f.currentPerDay, f.pipelineNew, f.recurringExpected, f.prevMonthTotal, f.moneyLeft)
  if (f.forecastClose !== null) a.moneys.push(f.forecastClose, Math.abs(f.goal - f.forecastClose))
  if (f.prevSamePeriod !== null) a.moneys.push(f.prevSamePeriod)
  a.days.push(f.dayOfMonth, f.daysInMonth, f.daysLeft)
  return a
}
export const mergeAllowed = (a: Allowed, b: Partial<Allowed>): Allowed => ({ pcts: [...a.pcts, ...(b.pcts ?? [])], moneys: [...a.moneys, ...(b.moneys ?? [])], days: [...a.days, ...(b.days ?? [])] })

// ── ler os números que a IA escreveu ──────────────────────────────────────────────────────────
interface Mention { v: number; tol: number; raw: string }
const decimals = (s?: string) => (s ? s.length : 0)
export function extractMentions(text: string): { pcts: Mention[]; moneys: Mention[]; days: number[] } {
  const pcts: Mention[] = [], moneys: Mention[] = [], days: number[] = []
  const t = text.replace(/\u00a0/g, ' ')
  for (const m of t.matchAll(/(\d+)(?:[.,](\d+))?\s*(?:%|p\.?\s?p\.?)/gi)) { const d = decimals(m[2]); pcts.push({ v: Number(`${m[1]}${m[2] ? '.' + m[2] : ''}`), tol: 0.5 * Math.pow(10, -d) + 1e-9, raw: m[0] }) }
  for (const m of t.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?:\s*(milh[õo]es|milh[ãa]o|mi\b|M\b|mil\b|k\b))?/gi)) {
    const unit = (m[3] ?? '').toLowerCase(), mult = /^milh|^mi$|^m$/.test(unit) ? 1e6 : /^mil$|^k$/.test(unit) ? 1e3 : 1, d = decimals(m[2])
    const base = Number(`${m[1].replace(/\./g, '')}${m[2] ? '.' + m[2] : ''}`)
    moneys.push({ v: base * mult, tol: (d > 0 ? 0.5 * Math.pow(10, -d) : 0.5) * mult + 1e-6, raw: m[0] })
  }
  for (const m of t.matchAll(/(\d+)\s*dias?\b/gi)) days.push(Number(m[1]))
  return { pcts, moneys, days }
}
const near = (list: number[], v: number, tol: number) => list.some(a => Math.abs(a - v) <= tol)

/** A IA só pode citar número que está nos fatos. Devolve o motivo da rejeição (ou ok). */
export function validateInsightText(texts: (string | null | undefined)[], allowed: Allowed, f: CompanyFacts, closers: { name: string; pctGoal: number }[] = []): { ok: true } | { ok: false; reason: string } {
  const text = texts.filter(Boolean).join(' | ')
  const m = extractMentions(text)
  for (const p of m.pcts) if (!near(allowed.pcts, p.v, p.tol)) return { ok: false, reason: `percentual "${p.raw.trim()}" não está nos fatos` }
  for (const x of m.moneys) if (!near(allowed.moneys, x.v, x.tol)) return { ok: false, reason: `valor "${x.raw.trim()}" não está nos fatos` }
  for (const d of m.days) if (!near(allowed.days, d, 0.01)) return { ok: false, reason: `"${d} dias" não está nos fatos` }
  // "% da meta" é sempre o da EMPRESA (ou a projeção); só vale outro percentual se for da meta de um closer que o texto cita pelo nome
  const goalOk = [f.pctGoal, ...(f.pctForecast !== null ? [f.pctForecast] : [])]
  const named = closers.filter(c => c.name && text.toLowerCase().includes(c.name.toLowerCase())).map(c => c.pctGoal)
  const ctx = [...text.matchAll(/meta[^%.|]{0,60}?(\d+(?:[.,]\d+)?)\s*%/gi), ...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*(?:da|de|à|a)\s+meta/gi)]
  for (const c of ctx) {
    const v = Number(c[1].replace(',', '.')), d = decimals(c[1].split(/[.,]/)[1]), tol = 0.5 * Math.pow(10, -d) + 1e-9
    if (!f.hasGoal) return { ok: false, reason: 'cita % de meta mas não há meta cadastrada' }
    if (!near([...goalOk, ...named], v, tol)) return { ok: false, reason: `"${c[0].trim()}" não é o % da meta da empresa (${fmtPct(f.pctGoal)})` }
  }
  // "falta / a fechar / restam R$ X": o X COLADO à expressão TEM que ser o que falta pra meta (ou o ritmo por dia / a diferença pra projeção). Sem isso, um valor que
  // existe nos fatos por outro motivo (ex.: o dinheiro deixado na mesa) poderia ser escrito como se fosse "o que falta". Só vale o valor adjacente, não o texto todo.
  const KW = '(?:\\bfalt(?:a|am|aria|ariam|ando)\\b|\\brestam?\\b|ainda (?:precis\\w*|falt\\w*)|(?:pra|para) bater|a fechar)'
  const MONEY = 'R\\$\\s*\\d[\\d.,]*(?:\\s*(?:milh[õo]es|milh[ãa]o|mi\\b|M\\b|mil\\b|k\\b))?'
  const claims = [...text.matchAll(new RegExp(`${KW}[^R\\d%|.;]{0,25}${MONEY}`, 'gi')), ...text.matchAll(new RegExp(`${MONEY}[^R\\d%|.;]{0,20}${KW}`, 'gi'))]
  if (claims.length > 0) {
    const rem = [f.remaining, f.requiredPerDay, ...(f.forecastClose !== null ? [Math.abs(f.goal - f.forecastClose)] : [])]
    for (const c of claims) for (const x of extractMentions(c[0]).moneys) if (!near(rem, x.v, x.tol)) return { ok: false, reason: `"${x.raw.trim()}" aparece como o que falta/a fechar, mas o que falta pra meta é ${fmtMoney(f.remaining)}` }
  }
  return { ok: true }
}

// ── insights de situação e projeção: determinísticos (nunca erram o número) ────────────────────
export function deterministicInsights(f: CompanyFacts): CompanyInsight[] {
  const out: CompanyInsight[] = []
  const quem = f.goalSource === 'closers' ? 'Meta dos closers' : 'Meta'                         // deixa claro quando NÃO é a meta da empresa
  const daMeta = f.goalSource === 'closers' ? 'da meta dos closers' : 'da meta'
  if (!f.hasGoal) {
    if (f.goalSource !== 'indisponivel')                                                          // se não consegui LER a meta, não afirmo que ela não existe
      out.push({ type: 'alerta', titulo: 'Meta do mês da empresa não está cadastrada', motivo: 'Sem meta não dá pra medir ritmo nem projeção', sugestao: 'Cadastrar a meta geral do mês em Metas' })
  } else if (f.status === 'meta_batida') {
    out.push({ type: 'destaque', titulo: `${quem} batida: ${fmtPct(f.pctGoal)} (${fmtMoney(f.revenue)} de ${fmtMoney(f.goal)})`, motivo: f.daysLeft > 0 ? `Ainda restam ${f.daysLeft} dias do mês` : 'Mês encerrado acima da meta', sugestao: 'Segurar o ritmo e adiantar o pipeline do mês seguinte' })
  } else {
    const sug = f.status === 'atrasada' ? `Média atual é ${fmtMoney(f.currentPerDay)} por dia: precisa acelerar` : f.status === 'adiantada' ? `Ritmo de ${fmtMoney(f.currentPerDay)} por dia está acima do calendário` : `Ritmo de ${fmtMoney(f.currentPerDay)} por dia acompanha o calendário`
    out.push({
      type: f.status === 'atrasada' ? 'alerta' : 'destaque', titulo: `${quem} em ${fmtPct(f.pctGoal)} com ${fmtPct(f.pctMonthElapsed)} do mês passado`,
      motivo: f.daysLeft > 0 ? `Faltam ${fmtMoney(f.remaining)} em ${f.daysLeft} dias (${fmtMoney(f.requiredPerDay)} por dia)` : `Faltam ${fmtMoney(f.remaining)} e o mês acabou`, sugestao: sug,
    })
  }
  if (f.hasGoal && f.forecastClose !== null && f.pctForecast !== null && f.status !== 'meta_batida') {
    const p = f.pctForecast
    out.push({
      type: p >= 100 ? 'oportunidade' : p >= 90 ? 'destaque' : 'alerta', titulo: `Projeção de fechamento: ${fmtMoney(f.forecastClose)} (${fmtPct(p)} ${daMeta})`,
      motivo: p < 100 ? `Faltariam ${fmtMoney(f.goal - f.forecastClose)} pra meta nesse ritmo` : `Projeção fica ${fmtMoney(f.forecastClose - f.goal)} acima da meta`,
      sugestao: f.pipelineNew > 0 || f.recurringExpected > 0 ? `Novas vendas no ritmo atual: ${fmtMoney(f.pipelineNew)}; recorrência: ${fmtMoney(f.recurringExpected)}` : null,
    })
  }
  if (f.deltaVsPrevPct !== null && f.prevSamePeriod !== null && Math.abs(f.deltaVsPrevPct) >= 5) {
    out.push({ type: f.deltaVsPrevPct >= 0 ? 'destaque' : 'alerta', titulo: `Receita ${f.deltaVsPrevPct >= 0 ? '+' : '-'}${fmtPct(Math.abs(f.deltaVsPrevPct))} vs. mesmo período do mês anterior`, motivo: `Até o dia ${f.dayOfMonth}: ${fmtMoney(f.revenue)} contra ${fmtMoney(f.prevSamePeriod)}`, sugestao: null })
  }
  if (f.hasGoal && f.goalSource === 'closers')
    out.push({ type: 'alerta', titulo: 'Meta da empresa não cadastrada: usando a soma dos closers', motivo: 'O % acima compara com a meta dos closers, não da empresa', sugestao: 'Cadastrar a Meta Geral do mês em Metas' })
  return out
}
