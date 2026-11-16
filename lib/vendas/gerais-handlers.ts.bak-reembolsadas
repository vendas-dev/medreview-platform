// ══ Vendas Gerais — regras do servidor (só superadmin): TODAS as vendas, com filtros, busca, ordem e paginação ═════
// Segue o padrão de handlers.ts: recebe o contexto pronto e devolve { status, json }. Só conta as 4 verticais ATIVAS (Vasc/Psiq ficam escondidas, como no resto do sistema).
import { monthBoundsSaoPaulo, todayInSaoPaulo } from '@/lib/timezone'
import type { Ctx, R } from './handlers'
import { VERTICAIS_ATIVAS } from './format'
import { abaValida, canalDe, canalFiltroValido, grupoBusca, padraoRegex, tokensDaBusca, type AbaId, type CanalFiltro, type CanalId } from './gerais'
import { ordemValida, type Ordem } from './ordem'

const ok = (json: any, status = 200): R => ({ status, json })
const err = (status: number, error: string, extra: Record<string, any> = {}): R => ({ status, json: { error, ...extra } })
const NIL = '00000000-0000-0000-0000-000000000000'
const hub = (v: any) => (v == null ? '' : String(v).trim())
const normName = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const aspas = (s: string) => `"${String(s).replace(/["\\]/g, '')}"`

const COLS = 'id, occurred_at, transaction_id, vertical, product, value, coupon_code, lead_name, email, phone, payment_type, payment_installments, total_installments, is_recurring, installment_number, sale_type, subscription_id, ambassador_name, seller_type, is_self_checkout, sold_by_ambassador, closer_id, closer_name, closer_hubspot_id, co_closer_id, co_closer_hubspot_id'
export const TAMANHOS_PAGINA = [25, 50, 100]
const PERIODO_MAX_DIAS = 400, MAX_Q = 120

interface FiltrosG { from: string; to: string; vertical: string | null; team: 'R1' | 'OAO' | null; canal: CanalFiltro; ordem: Ordem; q: string; aba: AbaId; page: number; pageSize: number }
function parse(sp: URLSearchParams): { ok: true; f: FiltrosG } | { ok: false; error: string } {
  let from = sp.get('from'), to = sp.get('to')
  if (!from && !to) { const m = monthBoundsSaoPaulo(todayInSaoPaulo().slice(0, 7)); from = m.start; to = m.end }
  const a = from ? Date.parse(from) : NaN, b = to ? Date.parse(to) : NaN
  if (isNaN(a) || isNaN(b)) return { ok: false, error: 'Período inválido.' }
  if (a > b) return { ok: false, error: 'Período inválido: a data inicial é depois da final.' }
  if (b - a > PERIODO_MAX_DIAS * 86400_000) return { ok: false, error: `Período máximo: ${PERIODO_MAX_DIAS} dias.` }
  const vertical = sp.get('vertical'); if (vertical && vertical !== 'todas' && !(VERTICAIS_ATIVAS as readonly string[]).includes(vertical)) return { ok: false, error: 'Vertical inválida.' }
  const team = (sp.get('team') ?? '').toUpperCase(); if (team && team !== 'TODOS' && team !== 'R1' && team !== 'OAO') return { ok: false, error: 'Time inválido.' }
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1)), ps = Number(sp.get('pageSize'))
  return { ok: true, f: { from: new Date(a).toISOString(), to: new Date(b).toISOString(), vertical: vertical && vertical !== 'todas' ? vertical : null, team: team === 'R1' || team === 'OAO' ? team : null, canal: canalFiltroValido(sp.get('canal')), ordem: ordemValida(sp.get('ordem')), q: (sp.get('q') ?? '').slice(0, MAX_Q), aba: abaValida(sp.get('aba')), page, pageSize: TAMANHOS_PAGINA.includes(ps) ? ps : 25 } }
}

interface Refs { closers: { id: string; hubspot_id: string | null; name: string; avatar_url: string | null; team: string | null }[]; profiles: any[] }
async function carregarRefs(ctx: Ctx): Promise<{ refs: Refs } | { error: any }> {
  const [cl, pr] = await Promise.all([ctx.admin.from('closers').select('id, name, normalized_name, hubspot_id, avatar_url'), ctx.admin.from('profiles').select('id, name, team, hubspot_id, avatar_url')])
  if (cl.error) return { error: cl.error }; if (pr.error) return { error: pr.error }
  const profiles: any[] = pr.data ?? []
  const profileOf = (c: any) => (hub(c.hubspot_id) && profiles.find(x => hub(x.hubspot_id) === hub(c.hubspot_id))) || profiles.find(x => normName(x.name) === (c.normalized_name ?? normName(c.name))) || null
  return { refs: { profiles, closers: (cl.data ?? []).map((c: any) => ({ id: c.id, hubspot_id: c.hubspot_id ?? null, name: c.name, avatar_url: c.avatar_url ?? profileOf(c)?.avatar_url ?? null, team: profileOf(c)?.team ?? null })) } }
}

/** Todos os filtros num lugar só: as linhas, os totais e as abas usam EXATAMENTE a mesma regra (por isso as contas fecham). */
function aplicar(q: any, f: FiltrosG, refs: Refs, aba: AbaId | null, modoBusca: 'regex' | 'simples') {
  q = q.eq('event_type', 'sale').in('vertical', [...VERTICAIS_ATIVAS]).gte('occurred_at', f.from).lte('occurred_at', f.to)
  if (aba && aba !== 'geral') q = q.eq('vertical', aba)
  if (f.vertical) q = q.eq('vertical', f.vertical)
  // Canal: mutuamente exclusivos, com a prioridade Self-Checkout > Embaixador > Closer (a soma dos três = todas, menos as "sem origem").
  const NAO_SELF = (x: any) => x.or('is_self_checkout.is.null,is_self_checkout.eq.false').or('seller_type.is.null,seller_type.neq.self_checkout')
  if (f.canal === 'self') q = q.or('is_self_checkout.eq.true,seller_type.eq.self_checkout')
  else if (f.canal === 'embaixadores') q = NAO_SELF(q).or('sold_by_ambassador.eq.true,seller_type.eq.ambassador')
  else if (f.canal === 'closers') q = NAO_SELF(q).or('sold_by_ambassador.is.null,sold_by_ambassador.eq.false').or('seller_type.is.null,seller_type.neq.ambassador').or('seller_type.eq.closer,closer_id.not.is.null,closer_hubspot_id.not.is.null')
  // Time: as vendas dos closers daquele time (principal). Self-Checkout e embaixador não têm time, então saem.
  if (f.team) {
    const doTime = refs.closers.filter(c => c.team === f.team), ids = doTime.map(c => c.id), hubs = doTime.map(c => hub(c.hubspot_id)).filter(Boolean)
    q = ids.length || hubs.length ? q.or([ids.length ? `closer_id.in.(${ids.join(',')})` : '', hubs.length ? `closer_hubspot_id.in.(${hubs.map(aspas).join(',')})` : ''].filter(Boolean).join(',')) : q.eq('closer_id', NIL)
  }
  for (const t of tokensDaBusca(f.q)) q = q.or(modoBusca === 'regex' ? grupoBusca(t) : grupoSimples(t))
  return q
}
/** Rede de segurança: se o banco recusar o operador de regex, a busca continua funcionando (sem ignorar acento). */
function grupoSimples(t: string) { const w = `*${t.replace(/[^a-z0-9@._+\-]/g, '')}*`; return ['lead_name', 'email', 'phone', 'transaction_id', 'product', 'closer_name', 'ambassador_name', 'coupon_code', 'subscription_id'].map(c => `${c}.ilike.${aspas(w)}`).join(',') }
const buscaFalhou = (e: any) => /imatch|match|operator|regex|PGRST100|42883|2201B/i.test(`${e?.message ?? ''} ${e?.code ?? ''}`)

function dbErr(e: any): R { console.error('[vendas-gerais]', String(e?.message ?? e)); return err(500, 'Erro ao acessar os dados. Tente novamente em instantes.') }

function enriquecer(rows: any[], refs: Refs) {
  const closerDe = (v: any) => refs.closers.find(c => v.closer_id && c.id === v.closer_id) ?? refs.closers.find(c => hub(c.hubspot_id) && hub(c.hubspot_id) === hub(v.closer_hubspot_id)) ?? null
  const coDe = (v: any) => {
    if (!v.co_closer_id && !hub(v.co_closer_hubspot_id)) return null
    const p = refs.profiles.find(x => (v.co_closer_id && x.id === v.co_closer_id) || (hub(v.co_closer_hubspot_id) && hub(x.hubspot_id) === hub(v.co_closer_hubspot_id)))
    const c = refs.closers.find(x => hub(v.co_closer_hubspot_id) && hub(x.hubspot_id) === hub(v.co_closer_hubspot_id)) ?? (p ? refs.closers.find(x => normName(x.name) === normName(p.name)) : null)
    const nome = p?.name ?? c?.name ?? null; return nome ? { nome, avatar_url: c?.avatar_url ?? p?.avatar_url ?? null, team: p?.team ?? c?.team ?? null } : null
  }
  return rows.map(v => {
    const canal: CanalId = canalDe(v), c = closerDe(v)
    const vendedor = canal === 'embaixador' ? { nome: hub(v.ambassador_name) || null, avatar_url: null, team: null }
      : canal === 'self' ? { nome: null, avatar_url: null, team: null }
      : { nome: c?.name ?? hub(v.closer_name) ?? null, avatar_url: c?.avatar_url ?? null, team: c?.team ?? null }
    return { id: v.id, occurred_at: v.occurred_at, transaction_id: v.transaction_id, vertical: v.vertical, product: v.product, value: v.value, coupon_code: v.coupon_code, lead_name: v.lead_name, email: v.email, phone: v.phone, payment_type: v.payment_type, payment_installments: v.payment_installments, total_installments: v.total_installments, is_recurring: v.is_recurring, installment_number: v.installment_number, sale_type: v.sale_type, subscription_id: v.subscription_id, ambassador_name: v.ambassador_name, canal, vendedor: { ...vendedor, nome: vendedor.nome || null }, co: coDe(v) }
  })
}

/** GET /api/admin/vendas/gerais — UMA página da tabela (aba "geral" ou uma vertical). */
export async function hVendasGerais(ctx: Ctx, sp: URLSearchParams): Promise<R> {
  if (ctx.role !== 'superadmin') return err(403, 'Somente superadmin.')
  const p = parse(sp); if (!p.ok) return err(400, p.error); const f = p.f
  const r0 = await carregarRefs(ctx); if ('error' in r0) return dbErr(r0.error); const refs = r0.refs
  const consulta = (modo: 'regex' | 'simples') => {
    let q = aplicar(ctx.admin.from('telao_events').select(COLS, { count: 'exact' }), f, refs, f.aba, modo)
    if (f.ordem === 'maior' || f.ordem === 'menor') q = q.order('value', { ascending: f.ordem === 'menor', nullsFirst: f.ordem === 'menor' }).order('occurred_at', { ascending: false })
    else q = q.order('occurred_at', { ascending: f.ordem === 'antigas' })
    return q.order('id').range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1)
  }
  let busca: 'regex' | 'simples' = 'regex'; let r = await consulta('regex')
  if (r.error && tokensDaBusca(f.q).length && buscaFalhou(r.error)) { busca = 'simples'; r = await consulta('simples') }
  if (r.error) return dbErr(r.error)
  const total = r.count ?? 0
  return ok({ vendas: enriquecer(r.data ?? [], refs), total, page: f.page, pageSize: f.pageSize, pages: Math.max(1, Math.ceil(total / f.pageSize)), busca })
}

/** GET /api/admin/vendas/gerais/resumo — quantas vendas e quanto R$ em cada aba, com os MESMOS filtros (menos a aba). */
export async function hVendasGeraisResumo(ctx: Ctx, sp: URLSearchParams): Promise<R> {
  if (ctx.role !== 'superadmin') return err(403, 'Somente superadmin.')
  const p = parse(sp); if (!p.ok) return err(400, p.error); const f = p.f
  const r0 = await carregarRefs(ctx); if ('error' in r0) return dbErr(r0.error); const refs = r0.refs
  const ler = async (modo: 'regex' | 'simples') => {
    const out: any[] = []; let truncated = false
    for (let a = 0; ; a += 1000) {
      const { data, error } = await aplicar(ctx.admin.from('telao_events').select('vertical, value'), f, refs, null, modo).order('id').range(a, a + 999)
      if (error) return { error, data: null as any[] | null, truncated }
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
      if (out.length >= 60000) { truncated = true; break }
    }
    return { error: null, data: out, truncated }
  }
  let r = await ler('regex'); if (r.error && tokensDaBusca(f.q).length && buscaFalhou(r.error)) r = await ler('simples')
  if (r.error) return dbErr(r.error)
  const r2 = (n: number) => Math.round(n * 100) / 100, abas: Record<string, { vendas: number; valor: number }> = { geral: { vendas: 0, valor: 0 } }
  for (const v of VERTICAIS_ATIVAS) abas[v] = { vendas: 0, valor: 0 }
  for (const x of r.data!) { const val = Number(x.value) || 0; abas.geral.vendas++; abas.geral.valor += val; if (abas[x.vertical]) { abas[x.vertical].vendas++; abas[x.vertical].valor += val } }
  for (const k of Object.keys(abas)) abas[k].valor = r2(abas[k].valor)
  return ok({ abas, truncated: r.truncated })
}
