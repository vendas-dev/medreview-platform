// Mural de insights de IA em nível de empresa (dashboard inicial, superadmin).
//
// COMO FUNCIONA (v2 — números sempre coerentes com o painel):
//  1. Os FATOS (% da meta da empresa, quanto falta, ritmo × calendário, projeção, mesmo período do mês anterior…) são calculados em CÓDIGO
//     (companyFacts.ts), com a mesma meta que a tela mostra. A IA não calcula nada.
//  2. Os insights de SITUAÇÃO e PROJEÇÃO ("Meta em 40% com 61% do mês passado", "Projeção de fechamento…") são montados em código a cada
//     carregamento: nunca ficam velhos e nunca erram o número.
//  3. A IA entra pra ANÁLISE e PRÓXIMOS PASSOS (verticais, closers, desconto, produtos, assinaturas). O que ela escreve é VALIDADO: qualquer
//     percentual/valor/dias que não esteja nos fatos descarta o insight. Insight inventado não chega na tela.
//  4. A parte da IA é guardada (company_daily_insights) mas NÃO congela o dia: refaz quando os números mudam de verdade (meta ±2 p.p., receita ±8%,
//     ou 6 h), no máximo 1 vez a cada 20 min. Itens guardados são revalidados contra os números de agora a cada leitura.
//  5. FORMATO GUARDADO = uma LISTA de insights, igual ao formato antigo (a marca de controle _gen/_rev/_pct vai DENTRO do 1º item). Assim a versão antiga
//     do código — num preview, num rollback ou num deploy ainda não trocado, que compartilham o mesmo banco — lê a linha sem quebrar. (Guardar um objeto ali
//     derrubava o dashboard: o código antigo devolvia o objeto e o InsightMural fazia (insights ?? []).map.) Esta função NUNCA lança erro e sempre devolve uma lista.

import { createAdminClient } from '@/lib/supabase/admin'
import { todayInSaoPaulo } from '@/lib/timezone'
import {
  CompanyInsight, CompanyFacts, FactsInput, GoalSource, Allowed, buildCompanyFacts, factLines, deterministicInsights, allowedFromFacts, mergeAllowed,
  validateInsightText, fmtMoney, fmtPct,
} from '@/lib/dashboard/companyFacts'

export type { CompanyInsight } from '@/lib/dashboard/companyFacts'

export interface VerticalSnapshot { vertical: string; revenue: number; count: number; avgTicket: number; avgDiscountPct: number }

export interface CompanyInsightInput {
  totalRevMonth:      number
  totalRevPrevMonth:  number                       // mês anterior FECHADO (só contexto)
  pctCompanyGoal:     number                       // LEGADO e IGNORADO (era receita ÷ soma das metas dos closers = o 73%/74% errado). A meta vem de metaGeralMes ou direto de company_goals
  totalMoneyLeft:     number
  verticalNow:        VerticalSnapshot[]
  verticalPrev:       VerticalSnapshot[]           // do MESMO período do mês anterior (até o mesmo dia)
  forecast:           { ativas: number; atrasadas: number; emRisco: number; persistenceRate: number }
  topClosers:         { name: string; revenue: number; pctGoal: number; pctOfTotalRev: number }[]
  riskClosers:        { name: string; daysSinceLastSale: number; pctGoal: number }[]
  discountOutliers:   { name: string; avgPct: number; companyAvgPct: number }[]
  productDeltas:      { product: string; vertical: string; revNow: number; revPrev: number; deltaPct: number | null }[]
  // ── novos (a tela principal passa; se faltarem, usa-se o legado) ──
  metaGeralMes?:              number                // meta da EMPRESA (a mesma da tela)
  goalSource?:                GoalSource
  dayOfMonth?:                number
  daysInMonth?:               number
  forecastFechamentoMes?:     number | null
  projecaoRestanteNovaVenda?: number
  recorrenciaPrevistaMes?:    number
  prevRevSamePeriod?:         number | null
}

export interface InsightDeps { admin?: any; fetch?: typeof fetch; now?: () => number; today?: () => string; apiKey?: string | undefined }

const MIN_INTERVAL_MS = 20 * 60e3, MAX_AGE_MS = 6 * 3600e3, FAIL_BACKOFF_MS = 5 * 60e3
let lastFailAt = 0                                                              // se a IA falhou agora há pouco, não tenta de novo a cada carregamento do painel
export const __resetBackoff = () => { lastFailAt = 0 }
interface Cache { generatedAt: string; revenue: number; pctGoal: number; items: CompanyInsight[] }
type Stored = CompanyInsight & { _gen?: string; _rev?: number; _pct?: number; _placeholder?: boolean }
const PLACEHOLDER: CompanyInsight = { type: 'destaque', titulo: 'Sem insights adicionais no momento.', motivo: null, sugestao: null }   // só pra guardar a marca quando a IA não devolve nada válido
const strip = (x: any): CompanyInsight => ({ type: x?.type, titulo: x?.titulo, motivo: x?.motivo ?? null, sugestao: x?.sugestao ?? null })

/** Lê o que está guardado. Lista COM marca (_gen) = formato atual; lista SEM marca = formato antigo (descartada); objeto { v: 2 } = versão anterior deste módulo (entendido e regravado como lista). */
export function parseCache(raw: any): Cache | null {
  if (Array.isArray(raw)) {
    const head = raw[0]
    if (!head || typeof head._gen !== 'string' || !Number.isFinite(Date.parse(head._gen))) return null
    return { generatedAt: head._gen, revenue: Number(head._rev) || 0, pctGoal: Number(head._pct) || 0, items: raw.filter((x: any) => x && !x._placeholder && typeof x.titulo === 'string').map(strip) }
  }
  if (raw && typeof raw === 'object' && raw.v === 2 && Array.isArray(raw.items) && typeof raw.generatedAt === 'string')
    return { generatedAt: raw.generatedAt, revenue: Number(raw.revenue) || 0, pctGoal: Number(raw.pctGoal) || 0, items: raw.items.filter((x: any) => x && typeof x.titulo === 'string').map(strip) }
  return null
}
export function toStored(items: CompanyInsight[], generatedAt: string, revenue: number, pctGoal: number): Stored[] {
  const list: Stored[] = items.length ? items.map(strip) : [{ ...PLACEHOLDER, _placeholder: true }]
  list[0] = { ...list[0], _gen: generatedAt, _rev: revenue, _pct: pctGoal }
  return list
}

export interface GoalInfo { goal: number; source: GoalSource }

/** A meta do mês lida DIRETO da fonte, a mesma que a tela /intel/goals grava: company_goals (escopo 'geral'). Só se ela não existir cai na soma das metas dos
 *  closers (a mesma regra do anel do topo e do forecast). Devolve null se não conseguiu LER (aí o painel não afirma nada sobre meta). */
export async function loadGoal(admin: any, monthKey: string): Promise<GoalInfo | null> {
  try {
    const [c, k] = await Promise.all([admin.from('company_goals').select('scope, goal_value').eq('month', monthKey), admin.from('closer_goals').select('goal_sales').eq('month', monthKey)])
    if (c?.error || k?.error) return null
    const geral = Number(((c.data ?? []) as any[]).find(g => g.scope === 'geral')?.goal_value) || 0
    if (geral > 0) return { goal: geral, source: 'empresa' }
    const soma = ((k.data ?? []) as any[]).reduce((s, g) => s + (Number(g.goal_sales) || 0), 0)
    return soma > 0 ? { goal: soma, source: 'closers' } : { goal: 0, source: 'nenhuma' }
  } catch { return null }
}

export function factsFromInput(input: CompanyInsightInput, todayStr: string, goalInfo?: GoalInfo): CompanyFacts {
  const daysInMonth = input.daysInMonth ?? new Date(Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)), 0).getDate()
  const dayOfMonth = input.dayOfMonth ?? Number(todayStr.slice(8, 10))
  // A meta NUNCA é deduzida do pctCompanyGoal antigo (que dividia pela soma das metas dos closers). Ordem: o que o page.tsx passou → o que li do banco → "indisponível".
  const gi: GoalInfo = goalInfo ?? (input.metaGeralMes !== undefined
    ? { goal: input.metaGeralMes, source: input.goalSource ?? (input.metaGeralMes > 0 ? 'empresa' : 'nenhuma') }
    : { goal: 0, source: 'indisponivel' })
  const fi: FactsInput = {
    revenue: input.totalRevMonth, goal: gi.goal, goalSource: gi.source, dayOfMonth, daysInMonth,
    forecastClose: input.forecastFechamentoMes ?? null, pipelineNew: input.projecaoRestanteNovaVenda ?? 0, recurringExpected: input.recorrenciaPrevistaMes ?? 0,
    prevSamePeriod: input.prevRevSamePeriod ?? null, prevMonthTotal: input.totalRevPrevMonth, moneyLeft: input.totalMoneyLeft,
  }
  return buildCompanyFacts(fi)
}

/** Tudo que a IA pode citar: os fatos + os números por vertical/closer/produto/assinatura que ela recebe no prompt. */
export function allowedFromInput(input: CompanyInsightInput, f: CompanyFacts): Allowed {
  const a = allowedFromFacts(f)
  const x: Allowed = { pcts: [], moneys: [], days: [] }
  for (const v of input.verticalNow) { x.moneys.push(v.revenue, v.avgTicket); x.pcts.push(v.avgDiscountPct) }
  input.verticalNow.forEach(v => {
    const p = input.verticalPrev.find(q => q.vertical === v.vertical)
    if (p && p.avgTicket > 0) x.pcts.push(Math.abs(((v.avgTicket - p.avgTicket) / p.avgTicket) * 100))
    if (p && p.revenue > 0) x.pcts.push(Math.abs(((v.revenue - p.revenue) / p.revenue) * 100))
    if (p) x.moneys.push(p.revenue)
  })
  x.pcts.push(input.forecast.persistenceRate)
  for (const c of input.topClosers) { x.moneys.push(c.revenue); x.pcts.push(c.pctGoal, c.pctOfTotalRev) }
  for (const c of input.riskClosers) { x.days.push(c.daysSinceLastSale); x.pcts.push(c.pctGoal) }
  for (const c of input.discountOutliers) x.pcts.push(c.avgPct, c.companyAvgPct)
  for (const p of input.productDeltas) { x.moneys.push(p.revNow, p.revPrev); if (p.deltaPct !== null) x.pcts.push(Math.abs(p.deltaPct)) }
  return mergeAllowed(a, x)
}

export function needsRegeneration(cache: Cache | null, f: CompanyFacts, nowMs: number, validCount: number): boolean {
  if (!cache) return true
  const age = nowMs - Date.parse(cache.generatedAt)
  if (!Number.isFinite(age)) return true
  if (age < MIN_INTERVAL_MS) return false                                     // no máximo 1 geração a cada 20 min (custo)
  if (age > MAX_AGE_MS) return true
  if (Math.abs(f.pctGoal - cache.pctGoal) >= 2) return true
  if (cache.revenue > 0 && Math.abs(f.revenue - cache.revenue) / cache.revenue >= 0.08) return true
  return validCount < Math.min(2, cache.items.length)                         // a maioria dos itens guardados já não bate com os números de agora
}

const DUP_RE = /^\s*(meta\b|proje[cç][aã]o|faltam?\b|falta\b|ritmo\b)/i       // situação/projeção já vêm prontas em código: a IA não repete
function keepValid(items: CompanyInsight[], allowed: Allowed, f: CompanyFacts, closers: { name: string; pctGoal: number }[], log?: (m: string) => void): CompanyInsight[] {
  const out: CompanyInsight[] = []
  for (const it of items) {
    if (!it || typeof it.titulo !== 'string' || !it.titulo.trim()) continue
    if (DUP_RE.test(it.titulo)) continue
    const v = validateInsightText([it.titulo, it.motivo, it.sugestao], allowed, f, closers)
    if (!v.ok) { log?.(`[companyInsights] descartado (${v.reason}): ${it.titulo}`); continue }
    out.push({ type: ['alerta', 'oportunidade', 'destaque'].includes(it.type) ? it.type : 'destaque', titulo: it.titulo.slice(0, 160), motivo: it.motivo ? String(it.motivo).slice(0, 200) : null, sugestao: it.sugestao ? String(it.sugestao).slice(0, 200) : null })
  }
  return out
}

export function buildPrompt(input: CompanyInsightInput, f: CompanyFacts): string {
  const vertLines = input.verticalNow.map(v => {
    const prev = input.verticalPrev.find(p => p.vertical === v.vertical)
    const ticketDelta = prev && prev.avgTicket > 0 ? ((v.avgTicket - prev.avgTicket) / prev.avgTicket) * 100 : null
    return `${v.vertical}: receita ${fmtMoney(v.revenue)} (${v.count} vendas), ticket médio ${fmtMoney(v.avgTicket)}${ticketDelta !== null ? ` (${ticketDelta >= 0 ? '+' : '-'}${fmtPct(Math.abs(ticketDelta))} vs mesmo período do mês anterior)` : ''}, desconto médio ${v.avgDiscountPct.toFixed(1).replace('.', ',')}%`
  }).join('\n')
  return [
    'Você é o analista comercial sênior da operação (empresa de cursos médicos; verticais: Anest-Review, Oft-Review, Ortop-Review, Med-Review R1).',
    'Seu trabalho é dar VISIBILIDADE da operação — como estamos, o que merece atenção e COMO PROSSEGUIR — com números CERTOS, falando como quem vê o mês inteiro, não só o dia.',
    '',
    'REGRAS DE OURO (quebrar uma invalida o insight):',
    '1. Use SOMENTE números que aparecem em FATOS e nas seções abaixo, copiados EXATAMENTE (mesmo arredondamento, mesma unidade). NÃO calcule, NÃO estime, NÃO converta, NÃO invente percentual nem valor.',
    '2. "% da meta" é SEMPRE o que está em FATOS (meta da empresa). Nunca derive outro percentual de meta. Percentual de meta de um closer só se citar o nome dele.',
    '3. Respeite o calendário: o mês está no dia indicado em FATOS. Nunca compare a receita parcial do mês com um mês anterior fechado; só com o "mesmo período" informado.',
    '4. Situação da meta, ritmo e projeção JÁ são mostrados em outro item: NÃO repita. Foque no que muda uma decisão: verticais, closers, desconto, produtos, assinaturas e PRÓXIMOS PASSOS concretos.',
    '5. Cada insight junta: o que os números mostram → por que importa → o que fazer. Sem frase genérica. Se nada for realmente notável, devolva menos itens.',
    '',
    'Devolva um JSON puro (array, sem markdown, sem texto fora do array) com 2 a 3 insights. Cada item: { "type": "alerta"|"oportunidade"|"destaque", "titulo": string (máx 12 palavras, direto, com o número real), "motivo": string ou null (máx 14 palavras, causa provável), "sugestao": string ou null (máx 14 palavras, ação concreta) }.',
    '"alerta" = risco a tratar · "oportunidade" = ganho possível se agir · "destaque" = ponto positivo a manter.',
    '',
    'FATOS (já calculados — use exatamente estes números):',
    ...factLines(f),
    '',
    'Por vertical (mês atual; ticket comparado ao mesmo período do mês anterior):',
    vertLines,
    '',
    `Assinaturas recorrentes: ${input.forecast.ativas} ativas, ${input.forecast.atrasadas} atrasadas, ${input.forecast.emRisco} em risco (aderência histórica: ${fmtPct(input.forecast.persistenceRate)})`,
    input.topClosers.length > 0 ? `Top closers do mês: ${input.topClosers.map(c => `${c.name} (${fmtMoney(c.revenue)}, ${fmtPct(c.pctGoal)} da meta dele, ${fmtPct(c.pctOfTotalRev)} da receita da empresa)`).join('; ')}` : '',
    input.riskClosers.length > 0 ? `Closers sem vender há dias: ${input.riskClosers.map(c => `${c.name} (${c.daysSinceLastSale} dias, ${fmtPct(c.pctGoal)} da meta dele)`).join('; ')}` : '',
    input.discountOutliers.length > 0 ? `Closers com desconto muito acima da média do time: ${input.discountOutliers.map(c => `${c.name} (${c.avgPct.toFixed(1).replace('.', ',')}% vs média de ${c.companyAvgPct.toFixed(1).replace('.', ',')}%)`).join('; ')}` : '',
    input.productDeltas.length > 0 ? `Produtos em queda forte vs o MESMO PERÍODO do mês anterior: ${input.productDeltas.map(p => `${p.product} (${p.vertical}, -${fmtPct(Math.abs(p.deltaPct as number))}, de ${fmtMoney(p.revPrev)} pra ${fmtMoney(p.revNow)})`).join('; ')}` : '',
    '',
    'Responda APENAS com o array JSON.',
  ].filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '').join('\n')
}

async function callModel(prompt: string, deps: Required<Pick<InsightDeps, 'fetch'>> & { apiKey: string }): Promise<CompanyInsight[] | null> {
  try {
    const res = await deps.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': deps.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) { console.error('[companyInsights] API respondeu', res.status); return null }
    const data = await res.json()
    let raw = (data.content?.find((b: any) => b.type === 'text')?.text ?? '').trim().replace(/```json/g, '').replace(/```/g, '').trim()
    const match = raw.match(/\[[\s\S]*\]/); if (match) raw = match[0]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch (e: any) { console.error('[companyInsights] erro ao gerar:', e?.message ?? e); return null }
}

export async function ensureCompanyInsights(input: CompanyInsightInput, deps: InsightDeps = {}): Promise<CompanyInsight[]> {
  try { return await run(input, deps) }
  catch (e: any) {                                                                            // o dashboard NUNCA pode cair por causa dos insights
    console.error('[companyInsights] falha inesperada:', e?.message ?? e)
    try { return deterministicInsights(factsFromInput(input, (deps.today ?? todayInSaoPaulo)(), { goal: input.metaGeralMes ?? 0, source: input.metaGeralMes !== undefined ? (input.goalSource ?? 'empresa') : 'indisponivel' })) } catch { return [] }
  }
}

async function run(input: CompanyInsightInput, deps: InsightDeps): Promise<CompanyInsight[]> {
  const now = deps.now ?? Date.now, today = (deps.today ?? todayInSaoPaulo)(), apiKey = 'apiKey' in deps ? deps.apiKey : process.env.ANTHROPIC_API_KEY
  if (input.totalRevMonth === 0 && input.verticalNow.every(v => v.count === 0)) return [{ type: 'destaque', titulo: 'Sem dados suficientes ainda este mês.', motivo: null, sugestao: null }]

  const admin = deps.admin ?? createAdminClient()
  const goalInfo = input.metaGeralMes !== undefined ? undefined : ((await loadGoal(admin, today.slice(0, 7))) ?? { goal: 0, source: 'indisponivel' as GoalSource })   // page.tsx antigo não passa a meta: leio direto do banco
  const f = factsFromInput(input, today, goalInfo), allowed = allowedFromInput(input, f), closers = input.topClosers.concat(input.riskClosers as any).map(c => ({ name: c.name, pctGoal: c.pctGoal }))
  const fresh = deterministicInsights(f)                                                    // sempre calculado agora

  let cache: Cache | null = null, rawFormat = false
  try {
    const { data } = await admin.from('company_daily_insights').select('insights').eq('insight_date', today).maybeSingle()
    cache = parseCache(data?.insights); rawFormat = !!data?.insights && !Array.isArray(data.insights)
  } catch { cache = null }
  if (cache && rawFormat) {                                                                 // linha no formato objeto (versão anterior): regrava como lista, que o código antigo também lê
    try { await admin.from('company_daily_insights').upsert({ insight_date: today, insights: toStored(cache.items, cache.generatedAt, cache.revenue, cache.pctGoal) }, { onConflict: 'insight_date' }) } catch { /* segue */ }
  }
  const cachedValid = cache ? keepValid(cache.items, allowed, f, closers) : []              // revalida o guardado contra os números de agora
  let llm = cachedValid

  if (needsRegeneration(cache, f, now(), cachedValid.length)) {
    const canCall = !!apiKey && now() - lastFailAt > FAIL_BACKOFF_MS
    if (canCall) console.log('[companyInsights] gerando com estes FATOS (é o que a IA recebe):\n' + factLines(f).join('\n'))
    const raw = canCall ? await callModel(buildPrompt(input, f), { fetch: deps.fetch ?? fetch, apiKey: apiKey as string }) : null
    if (canCall && !raw) lastFailAt = now()
    if (raw) {
      const valid = keepValid(raw, allowed, f, closers, m => console.warn(m)).slice(0, 3)
      llm = valid
      if (valid.length === 0) lastFailAt = now()                                            // a IA não devolveu nada aproveitável: não insiste a cada carregamento
      const { error } = await admin.from('company_daily_insights').upsert(
        { insight_date: today, insights: toStored(valid, new Date(now()).toISOString(), f.revenue, f.pctGoal) }, { onConflict: 'insight_date' })
      if (error) console.error('[companyInsights] erro ao salvar cache:', error.message)
    }                                                                                         // falhou: segue com o que ainda é válido do cache (e a parte em código)
  }
  return [...fresh, ...llm].slice(0, 5)
}
