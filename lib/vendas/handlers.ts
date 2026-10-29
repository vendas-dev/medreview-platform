// ══ Vendas — regras do servidor (sem Next: recebe o contexto pronto e devolve { status, json }) ═══
// Quem vê o quê:
//   • CLOSER   → só as PRÓPRIAS vendas (closer_id do usuário); só edita o "Obs" delas; abre e acompanha os próprios pedidos de troca.
//   • SUPERADMIN → todas as vendas, agrupadas por closer; edita qualquer campo (com auditoria); responde as trocas.
import { dateInSaoPaulo, monthBoundsSaoPaulo, todayInSaoPaulo } from '@/lib/timezone'
import { sendNotification } from '@/lib/notifications/server'
import type { TrocaInput } from './validate'
import { isUuid, validarTroca, validarDecisao, validarObs, validarEdicao, CAMPOS_EDITAVEIS } from './validate'
import { verticalLabel, verticalPorRotulo } from './format'

export interface Ctx { admin: any; userId: string; role: string | null; name: string | null; team: string | null; hubspotId: string | null }
export interface R { status: number; json: any }
const ok = (json: any, status = 200): R => ({ status, json })
const err = (status: number, error: string, extra: Record<string, any> = {}): R => ({ status, json: { error, ...extra } })
const isSuper = (c: Ctx) => c.role === 'superadmin'
const MIGRACAO = 'Falta rodar a migração de Vendas no Supabase (migration-vendas.sql).'

/** Erro de banco → resposta. Sem vazar detalhe interno; "tabela/coluna não existe" vira o aviso de migração. */
function dbErr(e: any): R {
  const m = String(e?.message ?? '')
  if (/\bobs\b|obs_updated|sale_swap_requests|sales_edit_log|schema cache/i.test(m)) return err(503, MIGRACAO, { migracao: true })
  console.error('[vendas]', m)
  return err(500, 'Erro ao acessar os dados. Tente novamente em instantes.')
}

const VENDA_COLS = 'id, occurred_at, transaction_id, vertical, product, value, coupon_code, lead_name, email, phone, payment_type, payment_installments, total_installments, is_recurring, installment_number, ambassador_name, seller_type, closer_id, closer_name, obs, obs_updated_at'
const VERTICAIS_FILTRO = ['medreview', 'anestreview', 'oftreview', 'ortopreview', 'vascreview']
const normName = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

// ── Filtros ───────────────────────────────────────────────────────────────────────────────────
interface Filtros { from: string | null; to: string | null; vertical: string | null; recorrentes: boolean; inativos: boolean; team: string | null; closerId: string | null; status: 'pendente' | 'resolvida' | 'concedida' | 'negada' | null }
function parseFiltros(sp: URLSearchParams, opts: { periodoObrigatorio: boolean }): { ok: true; f: Filtros } | { ok: false; error: string } {
  let from = sp.get('from'), to = sp.get('to')
  if (!from && !to && opts.periodoObrigatorio) { const m = monthBoundsSaoPaulo(todayInSaoPaulo().slice(0, 7)); from = m.start; to = m.end }
  let fromIso: string | null = null, toIso: string | null = null
  if (from || to) {
    const a = from ? Date.parse(from) : NaN, b = to ? Date.parse(to) : NaN
    if (isNaN(a) || isNaN(b)) return { ok: false, error: 'Período inválido.' }
    if (a > b) return { ok: false, error: 'Período inválido: a data inicial é depois da final.' }
    if (b - a > 400 * 86400_000) return { ok: false, error: 'Período máximo: 400 dias.' }
    fromIso = new Date(a).toISOString(); toIso = new Date(b).toISOString()
  }
  const vertical = sp.get('vertical'); if (vertical && vertical !== 'todas' && !VERTICAIS_FILTRO.includes(vertical)) return { ok: false, error: 'Vertical inválida.' }
  const team = (sp.get('team') ?? '').toUpperCase(); if (team && team !== 'TODOS' && team !== 'R1' && team !== 'OAO') return { ok: false, error: 'Time inválido.' }
  const closerId = sp.get('closerId'); if (closerId && closerId !== 'todos' && !isUuid(closerId)) return { ok: false, error: 'Closer inválido.' }
  const status = sp.get('status'); if (status && !['todas', 'pendente', 'resolvida', 'concedida', 'negada'].includes(status)) return { ok: false, error: 'Status inválido.' }
  return { ok: true, f: { from: fromIso, to: toIso, vertical: vertical && vertical !== 'todas' ? vertical : null, recorrentes: ['1', 'true'].includes(sp.get('recorrentes') ?? ''), inativos: ['1', 'true'].includes(sp.get('inativos') ?? ''), team: team && team !== 'TODOS' ? team : null, closerId: closerId && closerId !== 'todos' ? closerId : null, status: status && status !== 'todas' ? (status as any) : null } }
}
function filtrosVendas(q: any, f: Filtros) {
  q = q.eq('event_type', 'sale')
  if (f.from) q = q.gte('occurred_at', f.from).lte('occurred_at', f.to)
  if (f.vertical) q = q.eq('vertical', f.vertical)
  if (!f.recorrentes) q = q.or('sale_type.neq.recorrente,sale_type.is.null')     // parcelas de assinatura (2ª em diante) ficam de fora, a menos que se peça
  return q
}

/** O Supabase corta cada resposta em 1000 linhas: lê em páginas até acabar (com teto de segurança). */
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>, cap = 5000) {
  const out: any[] = []; let truncated = false
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) return { data: null as any[] | null, error, truncated }
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
    if (out.length >= cap) { truncated = true; break }
  }
  return { data: out, error: null, truncated }
}
const soma = (rows: { value: number | null }[]) => Math.round(rows.reduce((s, r) => s + (Number(r.value) || 0), 0) * 100) / 100

// ── Closer do usuário (hubspot_id → closers; fallback por nome — igual ao Telão) ──────────────
async function resolveCloser(ctx: Ctx): Promise<{ id: string; name: string; avatar_url: string | null } | null> {
  const cols = 'id, name, avatar_url'
  if (ctx.hubspotId) { const { data } = await ctx.admin.from('closers').select(cols).eq('hubspot_id', ctx.hubspotId).maybeSingle(); if (data) return data }
  const n = normName(ctx.name)
  if (n) { const { data } = await ctx.admin.from('closers').select(cols).eq('normalized_name', n).maybeSingle(); if (data) return data }
  return null
}

/** Aplica o filtro de status dos pedidos: pendentes / resolvidas (qualquer decisão) / concedidas / negadas. */
function filtroStatusTroca(q: any, status: Filtros['status']) {
  if (!status) return q
  if (status === 'pendente' || status === 'resolvida') return q.eq('status', status)
  return q.eq('status', 'resolvida').eq('decision', status)
}
/** Acrescenta a FOTO de quem pediu (closer; senão o perfil) e de quem respondeu. Só enfeite: se falhar, devolve os pedidos sem foto. */
async function comFotos(ctx: Ctx, rows: any[]): Promise<any[]> {
  if (!rows.length) return rows
  try {
    const cids = [...new Set(rows.map(r => r.closer_id).filter(Boolean))], pids = [...new Set(rows.flatMap(r => [r.requester_id, r.resolved_by]).filter(Boolean))]
    const [c, p] = await Promise.all([cids.length ? ctx.admin.from('closers').select('id, avatar_url').in('id', cids) : { data: [] }, pids.length ? ctx.admin.from('profiles').select('id, avatar_url').in('id', pids) : { data: [] }])
    const ca = new Map<string, string | null>((c.data ?? []).map((x: any) => [x.id, x.avatar_url])), pa = new Map<string, string | null>((p.data ?? []).map((x: any) => [x.id, x.avatar_url]))
    return rows.map(r => ({ ...r, requester_avatar: ca.get(r.closer_id) ?? pa.get(r.requester_id) ?? null, resolved_by_avatar: r.resolved_by ? pa.get(r.resolved_by) ?? null : null }))
  } catch { return rows }
}

async function avisar(fn: () => Promise<any>): Promise<boolean> {
  try { await fn(); return true } catch (e: any) { console.error('[vendas] aviso não enviado:', e?.message ?? e); return false }
}

// ══ CLOSER ════════════════════════════════════════════════════════════════════════════════════
/** GET /api/vendas/minhas — as vendas do closer logado. */
export async function hMinhasVendas(ctx: Ctx, sp: URLSearchParams): Promise<R> {
  if (isSuper(ctx)) return err(403, 'Superadmin usa a tela de Vendas.')
  const p = parseFiltros(sp, { periodoObrigatorio: true }); if (!p.ok) return err(400, p.error)
  const closer = await resolveCloser(ctx)
  if (!closer) return ok({ vinculado: false, vendas: [], resumo: { vendas: 0, valor: 0 }, truncated: false })
  const r = await fetchAll((a, b) => filtrosVendas(ctx.admin.from('telao_events').select(VENDA_COLS).eq('closer_id', closer.id), p.f).order('occurred_at', { ascending: false }).order('id').range(a, b))
  if (r.error) return dbErr(r.error)
  return ok({ vinculado: true, closer: { id: closer.id, name: closer.name, avatar_url: closer.avatar_url }, team: ctx.team, vendas: r.data, resumo: { vendas: r.data!.length, valor: soma(r.data!) }, truncated: r.truncated })
}

/** PATCH /api/vendas/:id/obs — o closer só mexe no Obs das PRÓPRIAS vendas; o superadmin, em qualquer uma. */
export async function hObs(ctx: Ctx, id: string, body: any): Promise<R> {
  if (!isUuid(id)) return err(400, 'Venda inválida.')
  const v = validarObs(body); if (!v.ok) return err(400, v.error)
  const { data: sale, error: e1 } = await ctx.admin.from('telao_events').select('id, closer_id').eq('id', id).eq('event_type', 'sale').maybeSingle()
  if (e1) return dbErr(e1)
  if (!sale) return err(404, 'Venda não encontrada.')
  if (!isSuper(ctx)) {
    const closer = await resolveCloser(ctx)
    if (!closer || sale.closer_id !== closer.id) return err(403, 'Você só pode editar o Obs das suas próprias vendas.')
  }
  const { data, error } = await ctx.admin.from('telao_events').update({ obs: v.value, obs_updated_at: new Date().toISOString(), obs_updated_by: ctx.userId }).eq('id', id).select('id, obs, obs_updated_at').single()
  if (error) return dbErr(error)
  return ok({ venda: data })
}

/** POST /api/trocas — o closer abre um pedido de troca de venda. Avisa todos os superadmins. */
export async function hCriarTroca(ctx: Ctx, body: any): Promise<R> {
  if (isSuper(ctx)) return err(403, 'Pedidos de troca são abertos pelos closers.')
  const v = validarTroca(body, ctx.team); if (!v.ok) return err(400, 'Corrija os campos destacados.', { errors: v.errors })
  const closer = await resolveCloser(ctx)
  const { data, error } = await ctx.admin.from('sale_swap_requests').insert({
    requester_id: ctx.userId, requester_name: ctx.name || 'Closer', requester_team: ctx.team, closer_id: closer?.id ?? null, ...v.value,
  }).select('*').single()
  if (error) {
    if (error.code === '23505') return err(409, 'Você já tem um pedido PENDENTE para esta transação.', { errors: { transaction_id: 'Já existe um pedido pendente para este ID.' } })
    return dbErr(error)
  }
  const notificado = await avisar(async () => {
    const { data: sup } = await ctx.admin.from('profiles').select('id').eq('role', 'superadmin')
    await sendNotification(ctx.admin, {
      title: 'Nova solicitação de troca de venda', kind: 'aviso', link: '/admin/vendas/trocas', created_by: ctx.userId,
      body: `${data.requester_name}${data.requester_team ? ` (${data.requester_team})` : ''} · ${verticalLabel(data.vertical)} · ${data.lead_name} · ${data.transaction_id}`,
      recipients: (sup ?? []).map((s: any) => s.id), event_key: `swap:new:${data.id}`,
    })
  })
  return ok({ troca: (await comFotos(ctx, [data]))[0], notificado }, 201)
}

/** GET /api/trocas — o histórico de pedidos do PRÓPRIO closer (filtra por data, vertical e status). */
export async function hMinhasTrocas(ctx: Ctx, sp: URLSearchParams): Promise<R> {
  if (isSuper(ctx)) return err(403, 'Superadmin usa a tela de Trocas de Venda.')
  const p = parseFiltros(sp, { periodoObrigatorio: false }); if (!p.ok) return err(400, p.error)
  const r = await fetchAll((a, b) => {
    let q = ctx.admin.from('sale_swap_requests').select('*').eq('requester_id', ctx.userId)
    if (p.f.from) q = q.gte('created_at', p.f.from).lte('created_at', p.f.to)
    if (p.f.vertical) q = q.eq('vertical', p.f.vertical)
    q = filtroStatusTroca(q, p.f.status)
    return q.order('created_at', { ascending: false }).order('id').range(a, b)
  }, 2000)
  if (r.error) return dbErr(r.error)
  const todas = await ctx.admin.from('sale_swap_requests').select('id', { count: 'exact', head: true }).eq('requester_id', ctx.userId).eq('status', 'pendente')
  return ok({ trocas: await comFotos(ctx, r.data!), pendentes_total: todas.count ?? 0 })
}

// ══ SUPERADMIN ═════════════════════════════════════════════════════════════════════════════════
/** O mês ("2026-10") a que as metas se aplicam, ou null se o período não é exatamente um mês (as metas são mensais). */
function mesDaMeta(f: Filtros): string | null {
  if (!f.from || !f.to) return null
  const a = dateInSaoPaulo(f.from), b = dateInSaoPaulo(f.to)
  return a.slice(0, 7) === b.slice(0, 7) && a.slice(8, 10) === '01' ? a.slice(0, 7) : null
}

/** GET /api/admin/vendas/resumo — um bloco por closer (vendas e valor), para a lista expansível. */
export async function hResumoAdmin(ctx: Ctx, sp: URLSearchParams): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Somente superadmin.')
  const p = parseFiltros(sp, { periodoObrigatorio: true }); if (!p.ok) return err(400, p.error)
  const [cl, pr] = await Promise.all([ctx.admin.from('closers').select('id, name, normalized_name, hubspot_id, avatar_url'), ctx.admin.from('profiles').select('id, name, team, hubspot_id, role, is_active')])
  if (cl.error) return dbErr(cl.error); if (pr.error) return dbErr(pr.error)
  const profiles: any[] = pr.data ?? []
  const profileOf = (c: any): any => (c.hubspot_id && profiles.find(x => x.hubspot_id === c.hubspot_id)) || profiles.find(x => normName(x.name) === c.normalized_name) || null
  // Metas (R$) do MÊS: só quando o período é exatamente um mês (do dia 1 até dentro do mesmo mês). Se a tabela de metas falhar, a tela segue sem metas.
  const mesMeta = mesDaMeta(p.f); const metas = new Map<string, { total: number; por_vertical: Record<string, number> }>()
  if (mesMeta) {
    const g = await ctx.admin.from('closer_goals').select('user_id, goal_sales, goals_by_vertical').eq('month', mesMeta)
    if (!g.error) for (const x of g.data ?? []) {
      const por: Record<string, number> = {}
      for (const [k, v] of Object.entries((x.goals_by_vertical ?? {}) as Record<string, unknown>)) { const id = verticalPorRotulo(k), n = Number(v); if (id && isFinite(n) && n > 0) por[id] = n }
      const total = Number(x.goal_sales) || 0
      if (total > 0 || Object.keys(por).length) metas.set(x.user_id, { total, por_vertical: por })
    }
  }
  let closers = (cl.data ?? []).map((c: any) => { const pf = profileOf(c); return { id: c.id as string, name: c.name as string, team: (pf?.team ?? null) as string | null, avatar_url: (c.avatar_url ?? null) as string | null, ativo: pf ? pf.is_active !== false : true, meta: (pf && metas.get(pf.id)) || null } })
  if (p.f.team) closers = closers.filter((c: any) => c.team === p.f.team)
  if (p.f.closerId) closers = closers.filter((c: any) => c.id === p.f.closerId)
  const ids = closers.map((c: any) => c.id)                            // só os closers: venda sem closer atribuído NÃO entra em Vendas Individuais
  let rows: any[] = []; let truncated = false
  if (ids.length) {
    const r = await fetchAll((a, b) => filtrosVendas(ctx.admin.from('telao_events').select('closer_id, value, vertical'), p.f).in('closer_id', ids).order('id').range(a, b), 20000)
    if (r.error) return dbErr(r.error); rows = r.data!; truncated = r.truncated
  }
  const agg = new Map<string, { vendas: number; valor: number; por: Record<string, { vendas: number; valor: number }> }>()
  for (const x of rows) {
    const a = agg.get(x.closer_id) ?? { vendas: 0, valor: 0, por: {} }; const v = Number(x.value) || 0
    a.vendas++; a.valor += v; const pv = a.por[x.vertical] ?? { vendas: 0, valor: 0 }; pv.vendas++; pv.valor += v; a.por[x.vertical] = pv; agg.set(x.closer_id, a)
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  // Usuário INATIVO: some SÓ A LINHA (e dos filtros). Nada sai de SOMA: o total abaixo inclui tudo que ele vendeu. Para conferir/editar vendas dele: inativos=1 (interruptor "Mostrar inativos") ou pedir o closer pelo id.
  const lista0 = closers.map((c: any) => { const a = agg.get(c.id); return { id: c.id, name: c.name, team: c.team, avatar_url: c.avatar_url, ativo: c.ativo, meta: c.meta, vendas: a?.vendas ?? 0, valor: r2(a?.valor ?? 0), por_vertical: Object.fromEntries(Object.entries(a?.por ?? {}).map(([k, v]) => [k, { vendas: v.vendas, valor: r2(v.valor) }])) } })
  const lista = lista0.filter((c: any) => c.ativo || p.f.inativos || !!p.f.closerId)
  const ocultos = lista0.filter((c: any) => !lista.includes(c) && c.vendas > 0)
  lista.sort((a: any, b: any) => b.valor - a.valor || a.name.localeCompare(b.name, 'pt-BR'))
  return ok({ closers: lista, total: { vendas: lista0.reduce((s: number, c: any) => s + c.vendas, 0), valor: Math.round(lista0.reduce((s: number, c: any) => s + c.valor, 0) * 100) / 100 }, ocultos: { closers: ocultos.length, vendas: ocultos.reduce((s: number, c: any) => s + c.vendas, 0), valor: Math.round(ocultos.reduce((s: number, c: any) => s + c.valor, 0) * 100) / 100 }, truncated, meta_mes: mesMeta })
}

/** GET /api/admin/vendas/closer/:id — a tabela de vendas de UM closer (id uuid, ou "sem-closer"). */
export async function hVendasDoCloser(ctx: Ctx, closerId: string, sp: URLSearchParams): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Somente superadmin.')
  if (!isUuid(closerId)) return err(400, 'Closer inválido.')
  const p = parseFiltros(sp, { periodoObrigatorio: true }); if (!p.ok) return err(400, p.error)
  const r = await fetchAll((a, b) => { let q = filtrosVendas(ctx.admin.from('telao_events').select(VENDA_COLS), p.f); q = q.eq('closer_id', closerId); return q.order('occurred_at', { ascending: false }).order('id').range(a, b) })
  if (r.error) return dbErr(r.error)
  return ok({ vendas: r.data, resumo: { vendas: r.data!.length, valor: soma(r.data!) }, truncated: r.truncated })
}

const sameVal = (campo: string, a: any, b: any) => {
  if (campo === 'occurred_at') return Date.parse(a) === Date.parse(b)
  if (campo === 'value') return Number(a) === Number(b)
  return (a ?? null) === (b ?? null)
}
const asText = (v: any) => (v === null || v === undefined ? null : String(v))

/** PATCH /api/admin/vendas/:id — o superadmin edita QUALQUER campo da venda (tudo fica no log de auditoria). */
export async function hEditarVenda(ctx: Ctx, id: string, body: any): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Somente superadmin.')
  if (!isUuid(id)) return err(400, 'Venda inválida.')
  const v = validarEdicao(body); if (!v.ok) return err(400, 'Corrija os campos destacados.', { errors: v.errors })
  const { data: cur, error: e1 } = await ctx.admin.from('telao_events').select(VENDA_COLS).eq('id', id).eq('event_type', 'sale').maybeSingle()
  if (e1) return dbErr(e1)
  if (!cur) return err(404, 'Venda não encontrada.')
  const mudancas = (Object.keys(v.patch) as (typeof CAMPOS_EDITAVEIS[number])[]).filter(k => !sameVal(k, (cur as any)[k], (v.patch as any)[k]))
  if (mudancas.length === 0) return ok({ venda: cur, alterados: 0, auditoria: true })
  if (mudancas.includes('transaction_id') && v.patch.transaction_id) {
    const { data: dup } = await ctx.admin.from('telao_events').select('id').eq('transaction_id', v.patch.transaction_id).neq('id', id).limit(1)
    if (dup && dup.length) return err(409, 'Já existe outra venda com este ID de transação.', { errors: { transaction_id: 'ID já usado por outra venda.' } })
  }
  const upd: Record<string, any> = {}; for (const k of mudancas) upd[k] = (v.patch as any)[k]
  if (mudancas.includes('obs')) { upd.obs_updated_at = new Date().toISOString(); upd.obs_updated_by = ctx.userId }
  const { data: row, error: e2 } = await ctx.admin.from('telao_events').update(upd).eq('id', id).select(VENDA_COLS).single()
  if (e2) {
    if (/enum/i.test(String(e2.message))) return err(400, 'Esta vertical ainda não existe no banco.', { errors: { vertical: 'Vertical inexistente no banco.' } })
    return dbErr(e2)
  }
  const auditoria = await avisar(async () => {
    const { error } = await ctx.admin.from('sales_edit_log').insert(mudancas.map(k => ({ event_id: id, transaction_id: row.transaction_id, edited_by: ctx.userId, edited_by_name: ctx.name, field: k, old_value: asText((cur as any)[k]), new_value: asText((row as any)[k]) })))
    if (error) throw new Error(error.message)
  })
  return ok({ venda: row, alterados: mudancas.length, auditoria })
}

/** GET /api/admin/trocas — todos os pedidos (filtra por status, data, vertical, time e closer). */
export async function hTrocasAdmin(ctx: Ctx, sp: URLSearchParams): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Somente superadmin.')
  const p = parseFiltros(sp, { periodoObrigatorio: false }); if (!p.ok) return err(400, p.error)
  const r = await fetchAll((a, b) => {
    let q = ctx.admin.from('sale_swap_requests').select('*')
    if (p.f.from) q = q.gte('created_at', p.f.from).lte('created_at', p.f.to)
    if (p.f.vertical) q = q.eq('vertical', p.f.vertical)
    q = filtroStatusTroca(q, p.f.status)
    if (p.f.team) q = q.eq('requester_team', p.f.team)
    if (p.f.closerId) q = q.eq('closer_id', p.f.closerId)
    return q.order('created_at', { ascending: false }).order('id').range(a, b)
  }, 2000)
  if (r.error) return dbErr(r.error)
  const pend = await ctx.admin.from('sale_swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
  return ok({ trocas: await comFotos(ctx, r.data!), pendentes_total: pend.count ?? 0 })
}

/** POST /api/admin/trocas/:id/resolver — o superadmin dá o check com uma resposta; o closer é avisado. */
export async function hResolverTroca(ctx: Ctx, id: string, body: any): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Somente superadmin.')
  if (!isUuid(id)) return err(400, 'Pedido inválido.')
  const v = validarDecisao(body); if (!v.ok) return err(400, v.error)
  const { data, error } = await ctx.admin.from('sale_swap_requests')
    .update({ status: 'resolvida', decision: v.value.decision, response: v.value.response, resolved_by: ctx.userId, resolved_by_name: ctx.name || 'Superadmin', resolved_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pendente').select('*')            // só resolve o que ainda está pendente (duas pessoas clicando juntas: só uma vale)
  if (error) return dbErr(error)
  if (!data || data.length === 0) {
    const { data: ex } = await ctx.admin.from('sale_swap_requests').select('id, status').eq('id', id).maybeSingle()
    if (!ex) return err(404, 'Pedido não encontrado.')
    return err(409, 'Este pedido já foi resolvido por outra pessoa.')
  }
  const troca = data[0]
  const notificado = await avisar(() => sendNotification(ctx.admin, {
    title: v.value.decision === 'concedida' ? 'Sua troca de venda foi CONCEDIDA' : 'Sua troca de venda foi NEGADA', kind: 'aviso', link: '/vendas/trocas', created_by: ctx.userId,
    body: `${troca.resolved_by_name}: ${v.value.response.slice(0, 220)}`, recipients: [troca.requester_id], event_key: `swap:resp:${troca.id}`,
  }))
  return ok({ troca: (await comFotos(ctx, [troca]))[0], notificado })
}

const ROTULO_CAMPO: Record<string, string> = { vertical: 'Vertical', product: 'Produto', transaction_id: 'ID da transação', lead_name: 'Nome do lead', hubspot_url: 'Link do HubSpot', botmaker_url: 'Link do Botmaker', reason: 'Motivo' }
const CAMPOS_TROCA = Object.keys(ROTULO_CAMPO) as (keyof TrocaInput)[]
const ROTULO_DECISAO = { concedida: 'CONCEDIDA', negada: 'NEGADA' } as const

/** PATCH /api/trocas/:id — EDITA os dados de uma solicitação.
 *  Closer: só o PRÓPRIO pedido e só enquanto estiver PENDENTE. Superadmin: qualquer pedido, em qualquer status (a decisão e a resposta não mudam aqui).
 *  Mesmas regras do envio; o outro lado é avisado; fica registrado quem editou e quando. */
export async function hEditarTroca(ctx: Ctx, id: string, body: any): Promise<R> {
  if (!isUuid(id)) return err(400, 'Pedido inválido.')
  const sup = isSuper(ctx)
  const { data: ex, error: e0 } = await ctx.admin.from('sale_swap_requests').select('*').eq('id', id).maybeSingle()
  if (e0) return dbErr(e0)
  if (!ex || (!sup && ex.requester_id !== ctx.userId)) return err(404, 'Pedido não encontrado.')          // closer não descobre pedido dos outros
  if (!sup && ex.status !== 'pendente') return err(409, 'Este pedido já foi respondido, então a solicitação não pode mais ser editada.')
  const v = validarTroca(body, ex.requester_team); if (!v.ok) return err(400, 'Corrija os campos destacados.', { errors: v.errors })     // a vertical vale para o time de QUEM pediu
  const mudou = CAMPOS_TROCA.filter(k => String(ex[k] ?? '') !== v.value[k])
  if (!mudou.length) return ok({ troca: (await comFotos(ctx, [ex]))[0], alterado: false })
  let q = ctx.admin.from('sale_swap_requests').update({ ...v.value, edited_at: new Date().toISOString(), edited_by: ctx.userId, edited_by_name: ctx.name || (sup ? 'Superadmin' : 'Closer') }).eq('id', id)
  if (!sup) q = q.eq('status', 'pendente')            // se responderam enquanto você editava, nada é gravado
  const { data, error } = await q.select('*')
  if (error) {
    if (error.code === '23505') return err(409, 'Já existe um pedido PENDENTE para esta transação.', { errors: { transaction_id: 'Já existe um pedido pendente para este ID.' } })
    return dbErr(error)
  }
  if (!data || data.length === 0) return err(409, 'Este pedido acabou de ser respondido, então a solicitação não pode mais ser editada.')
  const troca = data[0]; const campos = mudou.map(k => ROTULO_CAMPO[k]).join(', ')
  const notificado = await avisar(async () => {
    if (sup) {
      await sendNotification(ctx.admin, { title: 'Sua solicitação de troca foi ajustada', kind: 'aviso', link: '/vendas/trocas', created_by: ctx.userId,
        body: `${troca.edited_by_name} ajustou: ${campos} · ${troca.lead_name} · ${troca.transaction_id}`, recipients: [troca.requester_id], event_key: `swap:edit:${troca.id}:${Date.now()}` })
    } else {
      const { data: sp } = await ctx.admin.from('profiles').select('id').eq('role', 'superadmin')
      await sendNotification(ctx.admin, { title: 'Solicitação de troca EDITADA', kind: 'aviso', link: '/admin/vendas/trocas', created_by: ctx.userId,
        body: `${troca.requester_name} editou o pedido (${campos}) · ${verticalLabel(troca.vertical)} · ${troca.lead_name} · ${troca.transaction_id}`, recipients: (sp ?? []).map((x: any) => x.id), event_key: `swap:edit:${troca.id}:${Date.now()}` })
    }
  })
  return ok({ troca: (await comFotos(ctx, [troca]))[0], alterado: true, campos: mudou, notificado })
}

/** PATCH /api/admin/trocas/:id/resposta — o superadmin EDITA uma resposta JÁ enviada: a justificativa e/ou a decisão (Conceder ↔ Negar).
 *  Continua obrigatória a justificativa; quem respondeu primeiro e quando ficam como estão (a edição tem registro próprio); o closer é avisado. */
export async function hEditarResposta(ctx: Ctx, id: string, body: any): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Somente superadmin.')
  if (!isUuid(id)) return err(400, 'Pedido inválido.')
  const v = validarDecisao(body); if (!v.ok) return err(400, v.error)
  const { data: ex, error: e0 } = await ctx.admin.from('sale_swap_requests').select('*').eq('id', id).maybeSingle()
  if (e0) return dbErr(e0)
  if (!ex) return err(404, 'Pedido não encontrado.')
  if (ex.status !== 'resolvida') return err(409, 'Este pedido ainda não foi respondido. Use Conceder ou Negar.')
  if (ex.decision === v.value.decision && String(ex.response ?? '') === v.value.response) return ok({ troca: (await comFotos(ctx, [ex]))[0], alterado: false })
  const mudouDecisao = ex.decision !== v.value.decision
  const { data, error } = await ctx.admin.from('sale_swap_requests')
    .update({ decision: v.value.decision, response: v.value.response, response_edited_at: new Date().toISOString(), response_edited_by: ctx.userId, response_edited_by_name: ctx.name || 'Superadmin' })
    .eq('id', id).eq('status', 'resolvida').select('*')
  if (error) return dbErr(error)
  if (!data || data.length === 0) return err(409, 'Não foi possível editar: o pedido mudou. Atualize a tela.')
  const troca = data[0]
  const notificado = await avisar(() => sendNotification(ctx.admin, {
    title: mudouDecisao ? `Sua troca de venda agora está ${ROTULO_DECISAO[v.value.decision]}` : 'A justificativa da sua troca de venda foi atualizada', kind: 'aviso', link: '/vendas/trocas', created_by: ctx.userId,
    body: `${troca.response_edited_by_name}: ${v.value.response.slice(0, 220)}`, recipients: [troca.requester_id], event_key: `swap:resp-edit:${troca.id}:${Date.now()}`,
  }))
  return ok({ troca: (await comFotos(ctx, [troca]))[0], alterado: true, decisao_mudou: mudouDecisao, notificado })
}

/** GET /api/trocas/contagem — o numerozinho do menu (pendentes, só para superadmin). */
export async function hContagem(ctx: Ctx): Promise<R> {
  if (!isSuper(ctx)) return ok({ pendentes: 0 })
  const { count, error } = await ctx.admin.from('sale_swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
  if (error) return ok({ pendentes: 0 })                           // o menu não pode quebrar se a migração ainda não rodou
  return ok({ pendentes: count ?? 0 })
}
