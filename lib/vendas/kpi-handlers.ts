// ══ Vendas Gerais → visão KPI (só superadmin): realizado, meta e vendas do total, de cada vertical e de cada closer ═══════════════════
// MESMA regra de venda e de atribuição de Vendas Individuais e do Dados Gerais (é o que impede o atingimento de divergir entre as telas):
//  • vendas = event_type 'sale' (reembolsada fora), de QUALQUER vertical — como o Dados Gerais, o Forecast e Vendas Individuais. As 4 verticais ativas têm linha própria; o resto cai em "Outras verticais".
//  • a venda vale CHEIA para o closer principal E para o co-closer (troca/transferência), em qualquer canal; o total geral e o total de cada time contam cada venda UMA vez.
//  • sem closer de time na venda: Self-Checkout, Embaixadores ou "Closers sem time".
// Metas: company_goals (geral e por vertical) e closer_goals (por closer), do mês do período; meta do closer = a dele ou, se não houver, a soma das metas por vertical (igual a Vendas Individuais).
// Closer ↔ vendas por hubspot_id ou id, nunca só por nome (nome é o último recurso). As contas (gap, %, ticket, projeção) são feitas na tela por lib/vendas/kpi.ts.
import { dateInSaoPaulo, todayInSaoPaulo } from '@/lib/timezone'
import type { Ctx, R } from './handlers'
import { VERTICAIS_ATIVAS, verticalLabel } from './format'
import { canalDe } from './gerais'
import { effectiveGeneralGoal } from '@/lib/dashboard/goalProgress'
import { periodoKpi, somar, type KpiBruto, type KpiCloser, type KpiForecast, type KpiResposta } from './kpi'
import { computeClosingProjection } from '@/lib/dashboard/forecastClosing'

const ok = (json: any, status = 200): R => ({ status, json })
const err = (status: number, error: string): R => ({ status, json: { error } })
const hub = (v: any) => (v == null ? '' : String(v).trim())
const normName = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const r2 = (n: number) => Math.round(n * 100) / 100
const PERIODO_MAX_DIAS = 400, LIMITE_LINHAS = 60000
const GOAL_SCOPE: Record<string, string> = { anestreview: 'Anest-Review', oftreview: 'Oft-Review', ortopreview: 'Ortop-Review', medreview: 'Med-Review R1' }      // company_goals.scope de cada vertical
const dbErr = (e: any): R => { console.error('[vendas-gerais/kpi]', String(e?.message ?? e)); return err(500, 'Erro ao acessar os dados. Tente novamente em instantes.') }

/** `deps` existe para os testes: a data de hoje e a projeção do Forecast podem ser trocadas. */
export interface KpiDeps { hoje?: string; projecaoForecast?: (admin: any) => Promise<KpiForecast | null> }
const projecaoDoForecast = async (admin: any): Promise<KpiForecast | null> => { const c = await computeClosingProjection(admin); return { projecao: c.projecao, realizado: c.realizado } }

export async function hVendasGeraisKpi(ctx: Ctx, sp: URLSearchParams, deps: KpiDeps = {}): Promise<R> {
  if (ctx.role !== 'superadmin') return err(403, 'Somente superadmin.')
  const from = sp.get('from'), to = sp.get('to'), a = from ? Date.parse(from) : NaN, b = to ? Date.parse(to) : NaN
  if (isNaN(a) || isNaN(b)) return err(400, 'Período inválido.')
  if (a > b) return err(400, 'Período inválido: a data inicial é depois da final.')
  if (b - a > PERIODO_MAX_DIAS * 86400_000) return err(400, `Período máximo: ${PERIODO_MAX_DIAS} dias.`)
  const hoje = deps.hoje ?? todayInSaoPaulo()
  const periodo = periodoKpi(dateInSaoPaulo(new Date(a)), dateInSaoPaulo(new Date(b)), hoje)
  // projeção: se o período é o mês corrente (do dia 1 até hoje ou além), vale a MESMA do Forecast; se não der para calcular, a tela cai no ritmo por dias úteis
  let forecast: KpiForecast | null = null
  if (periodo.comMeta && periodo.mes === hoje.slice(0, 7) && periodo.ate >= hoje) {
    try { forecast = await (deps.projecaoForecast ?? projecaoDoForecast)(ctx.admin) } catch (e: any) { console.error('[vendas-gerais/kpi] projeção do Forecast indisponível:', String(e?.message ?? e)) }
  }

  // 1) as vendas do período (em páginas de 1.000: o banco corta qualquer leitura em 1.000 linhas sem avisar)
  const vendas: any[] = []; let truncated = false
  for (let off = 0; ; off += 1000) {
    const { data, error } = await ctx.admin.from('telao_events').select('vertical, value, closer_id, closer_hubspot_id, closer_name, co_closer_id, co_closer_hubspot_id, is_self_checkout, seller_type, sold_by_ambassador')
      .eq('event_type', 'sale').gte('occurred_at', new Date(a).toISOString()).lte('occurred_at', new Date(b).toISOString()).order('id').range(off, off + 999)
    if (error) return dbErr(error)
    vendas.push(...(data ?? [])); if (!data || data.length < 1000) break
    if (vendas.length >= LIMITE_LINHAS) { truncated = true; break }
  }

  // 2) quem é quem (closers e perfis) e as metas do mês
  const [cl, pr] = await Promise.all([ctx.admin.from('closers').select('id, name, hubspot_id'), ctx.admin.from('profiles').select('id, name, team, hubspot_id, avatar_url')])
  if (cl.error) return dbErr(cl.error); if (pr.error) return dbErr(pr.error)
  const closers: any[] = cl.data ?? [], profiles: any[] = pr.data ?? []
  let metaGeral: number | null = null; const metaVertical: Record<string, number> = {}, metaCloser: Record<string, number> = {}
  if (periodo.comMeta && periodo.mes) {
    const [cg, cgl] = await Promise.all([ctx.admin.from('company_goals').select('scope, goal_value').eq('month', periodo.mes), ctx.admin.from('closer_goals').select('user_id, goal_sales, goals_by_vertical').eq('month', periodo.mes)])
    if (cg.error) return dbErr(cg.error); if (cgl.error) return dbErr(cgl.error)
    const por: Record<string, number> = Object.fromEntries((cg.data ?? []).map((g: any) => [g.scope, Number(g.goal_value) || 0]))
    for (const v of VERTICAIS_ATIVAS) if (por[GOAL_SCOPE[v]] > 0) metaVertical[v] = por[GOAL_SCOPE[v]]
    let somaClosers = 0
    for (const g of cgl.data ?? []) {
      const propria = Number(g.goal_sales) || 0; somaClosers += propria > 0 ? propria : 0
      const porV = Object.fromEntries(Object.entries((g.goals_by_vertical ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0]))
      const m = effectiveGeneralGoal(propria, porV); if (m > 0) metaCloser[g.user_id] = m               // a dele; sem ela, a soma das metas por vertical (como em Vendas Individuais)
    }
    metaGeral = por['geral'] > 0 ? por['geral'] : somaClosers > 0 ? somaClosers : null           // a mesma regra do Forecast: sem meta geral, vale a soma das metas (próprias) dos closers
  }

  // 3) quem vendeu: cada venda cai em UM lugar (vertical + canal/closer)
  const perfilDoHub = (h: string) => (h ? profiles.find(p => hub(p.hubspot_id) === h) : null) ?? null
  const perfilPorId = (id: any) => (id ? profiles.find(p => p.id === id) : null) ?? null
  const perfilDaVenda = (v: any) => {
    const h = hub(v.closer_hubspot_id), c = closers.find(x => v.closer_id && x.id === v.closer_id) ?? (h ? closers.find(x => hub(x.hubspot_id) === h) : null)
    return perfilPorId(v.closer_id) ?? perfilDoHub(h) ?? (c ? perfilDoHub(hub(c.hubspot_id)) ?? profiles.find(p => normName(p.name) === normName(c.name)) : null) ?? (hub(v.closer_name) ? profiles.find(p => normName(p.name) === normName(v.closer_name)) : null) ?? null
  }
  /** O co-closer (troca/transferência): por id do perfil/cadastro de closers ou por hubspot_id — nunca por nome. */
  const perfilDoCo = (v: any) => {
    const h = hub(v.co_closer_hubspot_id), c = closers.find(x => v.co_closer_id && x.id === v.co_closer_id) ?? (h ? closers.find(x => hub(x.hubspot_id) === h) : null)
    return perfilPorId(v.co_closer_id) ?? perfilDoHub(h) ?? (c ? perfilDoHub(hub(c.hubspot_id)) : null) ?? null
  }
  const zero = () => ({ realizado: 0, vendas: 0 })
  const total = zero(), porVert: Record<string, { realizado: number; vendas: number }> = Object.fromEntries(VERTICAIS_ATIVAS.map(v => [v, zero()]))
  const porPerfil = new Map<string, { realizado: number; vendas: number }>(), outros = { self: zero(), embaixador: zero(), semTime: zero() }, outrasVerticais = zero()
  const porTime: Record<'OAO' | 'R1', { realizado: number; vendas: number }> = { OAO: zero(), R1: zero() }
  for (const v of vendas) {
    const val = Number(v.value) || 0; total.realizado += val; total.vendas++
    const pv = porVert[v.vertical]; if (pv) { pv.realizado += val; pv.vendas++ } else { outrasVerticais.realizado += val; outrasVerticais.vendas++ }
    // quem leva a venda: o principal e o co-closer (cada um UMA vez, venda cheia), só se forem de um time; o canal não tira a venda de quem a fez
    const creditados = new Map<string, any>()
    for (const p of [perfilDaVenda(v), perfilDoCo(v)]) if (p && (p.team === 'OAO' || p.team === 'R1')) creditados.set(p.id, p)
    if (!creditados.size) {
      const canal = canalDe(v), o = canal === 'self' ? outros.self : canal === 'embaixador' ? outros.embaixador : outros.semTime
      o.realizado += val; o.vendas++; continue
    }
    for (const p of creditados.values()) { const x = porPerfil.get(p.id) ?? zero(); x.realizado += val; x.vendas++; porPerfil.set(p.id, x) }
    for (const team of new Set([...creditados.values()].map(p => p.team as 'OAO' | 'R1'))) { porTime[team].realizado += val; porTime[team].vendas++ }          // o total do time conta a venda uma vez, mesmo com dois do time nela
  }

  // 4) o que a tela recebe
  const linhaCloser = (p: any): KpiCloser => { const x = porPerfil.get(p.id) ?? zero(); return { id: p.id, nome: p.name, avatar_url: p.avatar_url ?? null, realizado: r2(x.realizado), vendas: x.vendas, meta: metaCloser[p.id] ?? null } }
  const timeDe = (team: 'OAO' | 'R1') => {
    const lista = profiles.filter(p => p.team === team && ((metaCloser[p.id] ?? 0) > 0 || (porPerfil.get(p.id)?.vendas ?? 0) > 0)).map(linhaCloser).sort((x, y) => y.realizado - x.realizado || x.nome.localeCompare(y.nome, 'pt-BR'))
    return { team, label: `Time ${team}`, total: { realizado: r2(porTime[team].realizado), vendas: porTime[team].vendas, meta: somar(lista as KpiBruto[]).meta }, closers: lista }
  }
  const out: KpiResposta = {
    periodo, truncated, forecast,
    total: { realizado: r2(total.realizado), vendas: total.vendas, meta: metaGeral },
    verticais: [...VERTICAIS_ATIVAS.map(v => ({ id: v, label: verticalLabel(v), realizado: r2(porVert[v].realizado), vendas: porVert[v].vendas, meta: metaVertical[v] ?? null })),
      ...(outrasVerticais.vendas > 0 ? [{ id: 'outras', label: 'Outras verticais', realizado: r2(outrasVerticais.realizado), vendas: outrasVerticais.vendas, meta: null }] : [])],
    times: [timeDe('OAO'), timeDe('R1')],
    outros: [{ id: 'self', label: 'Self-Checkout', ...outros.self }, { id: 'embaixador', label: 'Embaixadores', ...outros.embaixador }, { id: 'semTime', label: 'Closers sem time', ...outros.semTime }].map(o => ({ ...o, realizado: r2(o.realizado) })).filter(o => o.vendas > 0),
  }
  return ok(out)
}
