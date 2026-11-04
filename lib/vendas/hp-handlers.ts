// ══ Vendas — handlers de "Consultar HP" e "Transferir Venda" (SÓ superadmin) ═════════════════════════════════════
//  GET  /api/admin/trocas/:id/consultar-hp  → procura o HP (transaction_id) em telao_events e traduz a linha (NÃO altera nada)
//  POST /api/admin/trocas/:id/transferir    → transfere a venda para o closer que pediu a troca (mesma lógica da rota pública) e RELÊ o banco para confirmar
import type { Ctx, R } from './handlers'
import { verticalLabel } from './format'
import { compararPedido, escapeLike, modoPadrao, modosPermitidos, planoAtualizacao, situacaoDe, souEu, sugestaoDe, traduzir, type Modo, type Nomes, type Solicitante, type VendaBanco } from './hp'

const ok = (json: any, status = 200): R => ({ status, json })
const err = (status: number, error: string, extra: Record<string, any> = {}): R => ({ status, json: { error, ...extra } })
const isSuper = (c: Ctx) => c.role === 'superadmin'
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const COLS = 'id, transaction_id, lead_name, email, vertical, product, value, coupon_code, occurred_at, seller_type, is_self_checkout, sold_by_ambassador, ambassador_name, closer_id, closer_name, closer_hubspot_id, co_closer_id, co_closer_hubspot_id, transferred_at, transfer_reason, sale_type, is_recurring, installment_number, total_installments, subscription_id'
const normNome = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()     // a MESMA normalização do módulo (closers.normalized_name)
const AUDIT_FIELDS = ['closer_id', 'closer_name', 'closer_hubspot_id', 'co_closer_id', 'co_closer_hubspot_id', 'is_self_checkout', 'seller_type', 'transferred_at', 'transfer_reason']

async function carregarTroca(ctx: Ctx, id: string): Promise<{ ok: false; r: R } | { ok: true; troca: any }> {
  if (!isUuid(id)) return { ok: false, r: err(400, 'Pedido inválido.') }
  const { data, error } = await ctx.admin.from('sale_swap_requests').select('*').eq('id', id).maybeSingle()
  if (error) return { ok: false, r: err(500, 'Erro ao acessar os dados. Tente novamente em instantes.') }
  if (!data) return { ok: false, r: err(404, 'Pedido de troca não encontrado.') }
  return { ok: true, troca: data as any }
}
/** O closer que pediu, com os dois ids (closers para closer_id; profiles para co_closer_id). */
async function solicitante(ctx: Ctx, troca: any): Promise<Solicitante> {
  const { data: prof } = await ctx.admin.from('profiles').select('id, name, hubspot_id').eq('id', troca.requester_id).maybeSingle()
  const cols = 'id, name, hubspot_id'; let closer: any = null
  if (troca.closer_id) closer = (await ctx.admin.from('closers').select(cols).eq('id', troca.closer_id).maybeSingle()).data
  const h = String(prof?.hubspot_id ?? '').trim()
  if (!closer && h) closer = (await ctx.admin.from('closers').select(cols).eq('hubspot_id', h).maybeSingle()).data
  if (!closer) { const n = normNome(prof?.name ?? troca.requester_name); if (n) closer = (await ctx.admin.from('closers').select(cols).eq('normalized_name', n).maybeSingle()).data }
  const hubspotId = (h || String(closer?.hubspot_id ?? '').trim()) || null
  return { profileId: prof?.id ?? troca.requester_id ?? null, closerId: closer?.id ?? null, hubspotId, nome: prof?.name ?? closer?.name ?? troca.requester_name ?? 'o closer' }
}
async function buscarVendas(ctx: Ctx, hp: string): Promise<{ vendas: VendaBanco[]; falhou: boolean }> {
  const { data, error } = await ctx.admin.from('telao_events').select(COLS).eq('event_type', 'sale').ilike('transaction_id', escapeLike(hp.trim())).order('occurred_at', { ascending: false }).limit(10)
  return { vendas: (data ?? []) as VendaBanco[], falhou: !!error }
}
async function nomesDe(ctx: Ctx, v: VendaBanco): Promise<Nomes> {
  const n: Nomes = {}
  if (v.closer_id) n.principal = (await ctx.admin.from('closers').select('name').eq('id', v.closer_id).maybeSingle()).data?.name ?? null
  if (v.co_closer_id) n.co = (await ctx.admin.from('profiles').select('name').eq('id', v.co_closer_id).maybeSingle()).data?.name ?? null
  if (v.subscription_id) {
    const { data: reg } = await ctx.admin.from('subscription_transfers').select('mode, co_closer_id, co_closer_hubspot_id, reason').eq('subscription_id', v.subscription_id).maybeSingle()
    if (reg) { n.regra = reg; if (reg.co_closer_id) n.regraNome = (await ctx.admin.from('profiles').select('name').eq('id', reg.co_closer_id).maybeSingle()).data?.name ?? null }
  }
  return n
}
const viewVenda = (v: VendaBanco) => ({ id: v.id, hp: v.transaction_id, nome: v.lead_name, email: v.email, vertical: v.vertical, vertical_label: verticalLabel(v.vertical), produto: v.product, valor: v.value == null ? null : Number(v.value), cupom: v.coupon_code, data: v.occurred_at, tipo: v.sale_type })
async function outrasParcelas(ctx: Ctx, v: VendaBanco, sol: Solicitante) {
  if (!v.subscription_id) return { total: 0, pendentes: [] as VendaBanco[] }
  const { data } = await ctx.admin.from('telao_events').select(COLS).eq('event_type', 'sale').eq('subscription_id', v.subscription_id).neq('id', v.id).limit(500)
  const todas = (data ?? []) as VendaBanco[]
  return { total: todas.length, pendentes: todas.filter(p => { const e = souEu(p, sol); return !e.principal && !e.co }) }
}

export async function hConsultarHP(ctx: Ctx, id: string): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Só o superadmin pode consultar o HP.')
  const t = await carregarTroca(ctx, id); if (!t.ok) return t.r
  const troca = t.troca, sol = await solicitante(ctx, troca)
  const { vendas, falhou } = await buscarVendas(ctx, troca.transaction_id)
  if (falhou) return err(500, 'Não consegui consultar o banco agora. Tente novamente.')
  const pedido = { hp: troca.transaction_id, lead_name: troca.lead_name, product: troca.product, vertical: troca.vertical, vertical_label: verticalLabel(troca.vertical), closer: sol.nome }
  if (vendas.length === 0) {
    const parecidas = await sugestoes(ctx, troca)
    return ok({ encontrada: false, quantidade: 0, pedido, parecidas, mensagem: 'Nenhuma venda com este HP no banco. O closer pode ter digitado o ID errado.' })
  }
  const v = vendas[0], nomes = await nomesDe(ctx, v), sit = situacaoDe(v, sol), par = await outrasParcelas(ctx, v, sol)
  return ok({
    encontrada: true, quantidade: vendas.length, duplicada: vendas.length > 1, pedido, venda: viewVenda(v),
    conferencia: compararPedido(v, troca, verticalLabel),
    traducao: { situacao: sit, linhas: traduzir(v, sol, nomes), sugestao: sugestaoDe(sit, sol.nome, nomes), pode_transferir: vendas.length === 1 && sit !== 'ja_do_solicitante', modo_padrao: modoPadrao(sit), modos: modosPermitidos(sit) },
    parcelas: { outras: par.total, pendentes: par.pendentes.length },
  })
}
/** Quando o HP não existe: vendas com nome parecido e HPs que começam igual (ajuda a achar o erro de digitação). */
async function sugestoes(ctx: Ctx, troca: any) {
  const out: any[] = [], ids = new Set<string>()
  const add = (rows: any[] | null, motivo: string) => { for (const r of rows ?? []) if (r.transaction_id && !ids.has(r.id)) { ids.add(r.id); out.push({ hp: r.transaction_id, nome: r.lead_name, produto: r.product, valor: r.value == null ? null : Number(r.value), data: r.occurred_at, motivo }) } }
  const hp = String(troca.transaction_id ?? '').trim()
  if (hp.length >= 5) add((await ctx.admin.from('telao_events').select('id, transaction_id, lead_name, product, value, occurred_at').eq('event_type', 'sale').ilike('transaction_id', escapeLike(hp.slice(0, -1)) + '%').order('occurred_at', { ascending: false }).limit(5)).data, 'ID parecido')
  const nome = String(troca.lead_name ?? '').trim()
  if (nome.length >= 5) add((await ctx.admin.from('telao_events').select('id, transaction_id, lead_name, product, value, occurred_at').eq('event_type', 'sale').ilike('lead_name', '%' + escapeLike(nome) + '%').order('occurred_at', { ascending: false }).limit(5)).data, 'Mesmo nome de lead')
  return out.slice(0, 6)
}

export async function hTransferirVenda(ctx: Ctx, id: string, body: any): Promise<R> {
  if (!isSuper(ctx)) return err(403, 'Só o superadmin pode transferir vendas.')
  const t = await carregarTroca(ctx, id); if (!t.ok) return t.r
  const troca = t.troca, sol = await solicitante(ctx, troca)
  const pedidoModo = ['corrigir', 'dividir', 'total'].includes(body?.modo) ? (body.modo as Modo) : null
  if (body?.modo !== undefined && body?.modo !== null && !pedidoModo) return err(400, 'Modo de transferência inválido.')
  const incluir = body?.incluir_parcelas === true
  const base = { pedido: { hp: troca.transaction_id, closer: sol.nome } }
  const { vendas, falhou } = await buscarVendas(ctx, troca.transaction_id)
  if (falhou) return err(500, 'Não consegui consultar o banco agora. Tente novamente.')
  if (vendas.length === 0) return ok({ ...base, resultado: 'nao_encontrada', titulo: 'HP não encontrado', mensagem: 'Não existe venda com este HP no banco. Nada foi alterado. Confira com o closer se o ID está certo (use “Consultar HP”).', checks: [{ ok: false, texto: `Nenhuma venda com o HP ${troca.transaction_id}` }] })
  if (vendas.length > 1) return ok({ ...base, resultado: 'bloqueada', titulo: 'HP duplicado no banco', mensagem: `Existem ${vendas.length} vendas com este HP. Por segurança nada foi alterado: corrija a duplicidade antes de transferir.`, checks: [{ ok: false, texto: `${vendas.length} linhas com o mesmo HP` }] })
  const v = vendas[0], sit = situacaoDe(v, sol), eu = souEu(v, sol), par = await outrasParcelas(ctx, v, sol)
  const nomesAntes = await nomesDe(ctx, v), antes = traduzir(v, sol, nomesAntes)
  const pendentes = par.pendentes.length
  if (sit === 'ja_do_solicitante' && !(incluir && pendentes > 0)) {
    return ok({ ...base, resultado: 'nada_a_fazer', titulo: 'Nada a fazer', mensagem: `Esta venda já está com ${sol.nome}${eu.principal ? ' como Closer' : ' como co-closer'}. Nada foi alterado.`, venda: viewVenda(v), depois: antes, parcelas: { outras: par.total, pendentes }, checks: [{ ok: true, texto: `Venda localizada (${v.transaction_id})` }, { ok: true, texto: `Já atribuída a ${sol.nome}` }] })
  }
  let modo: Modo | null = sit === 'ja_do_solicitante' ? (eu.principal ? 'corrigir' : 'dividir') : (pedidoModo ?? modoPadrao(sit))
  if (!modo) return ok({ ...base, resultado: 'precisa_escolher', titulo: 'Esta venda já é de outro closer', mensagem: sugestaoDe(sit, sol.nome, nomesAntes), venda: viewVenda(v), antes, opcoes: modosPermitidos(sit), outro: nomesAntes.principal ?? v.closer_name ?? 'outro closer', checks: [] })
  if (sit !== 'ja_do_solicitante' && !modosPermitidos(sit).includes(modo)) return err(400, 'Esse modo não vale para esta venda.')
  const motivo = `Troca de venda concedida (pedido de ${sol.nome}) por ${ctx.name ?? 'superadmin'}`.slice(0, 200)
  const agora = new Date().toISOString(), plano = planoAtualizacao(modo, v, sol, motivo, agora)
  if (plano.exige === 'closers' && !sol.closerId) return ok({ ...base, resultado: 'bloqueada', titulo: 'Closer sem cadastro em “closers”', mensagem: `${sol.nome} não está cadastrado na tabela “closers” — necessário para ser o closer principal da venda. Nada foi alterado.`, checks: [{ ok: false, texto: 'Cadastro do closer na tabela closers' }] })
  if (plano.exige === 'profiles' && !sol.profileId) return ok({ ...base, resultado: 'bloqueada', titulo: 'Closer sem perfil', mensagem: `${sol.nome} não tem perfil cadastrado — necessário para ser co-closer. Nada foi alterado.`, checks: [{ ok: false, texto: 'Perfil do closer' }] })

  const checks: { ok: boolean; texto: string; aviso?: boolean }[] = [{ ok: true, texto: `Venda localizada no banco (${v.transaction_id})` }]
  const antesCampos = Object.fromEntries(AUDIT_FIELDS.map(k => [k, (v as any)[k] ?? null]))
  if (sit !== 'ja_do_solicitante') {
    const { error } = await ctx.admin.from('telao_events').update(plano.updates).eq('id', v.id)
    if (error) return ok({ ...base, resultado: 'erro', titulo: 'Não foi possível gravar', mensagem: 'O banco recusou a alteração. Nada foi transferido.', detalhe: String(error.message ?? '').slice(0, 200), checks: [...checks, { ok: false, texto: 'Gravar a transferência' }] })
  }
  // RELÊ o banco: a confirmação vem da linha de verdade, não do "update deu certo"
  const { data: rel } = await ctx.admin.from('telao_events').select(COLS).eq('id', v.id).maybeSingle()
  const depoisV = rel as VendaBanco | null
  const eu2 = depoisV ? souEu(depoisV, sol) : { principal: false, co: false }
  const esperado = modo === 'dividir' ? eu2.co : eu2.principal
  if (sit !== 'ja_do_solicitante') checks.push({ ok: !!esperado, texto: modo === 'dividir' ? `${sol.nome} agora é co-closer desta venda` : modo === 'corrigir' ? `A venda deixou de ser Self-Checkout e agora é de ${sol.nome}` : `${sol.nome} agora é o closer da venda (substituiu ${nomesAntes.principal ?? v.closer_name ?? 'o anterior'})` })
  if (modo === 'corrigir' && sit !== 'ja_do_solicitante') checks.push({ ok: depoisV?.is_self_checkout === false, texto: 'Marca de Self-Checkout removida' })
  let regraGravada = false
  if (v.subscription_id) {
    if (!plano.regra) checks.push({ ok: false, aviso: true, texto: 'Regra das próximas parcelas NÃO criada (closer sem perfil)' })
    else {
      const { error } = await ctx.admin.from('subscription_transfers').upsert(plano.regra, { onConflict: 'subscription_id' })
      const { data: reg } = await ctx.admin.from('subscription_transfers').select('mode, co_closer_id').eq('subscription_id', v.subscription_id).maybeSingle()
      regraGravada = !error && reg?.co_closer_id === sol.profileId
      checks.push({ ok: regraGravada, aviso: !regraGravada, texto: regraGravada ? 'Regra gravada: as próximas parcelas desta assinatura já nascem com este closer' : 'Não consegui gravar a regra das próximas parcelas' })
    }
  }
  let parcelasAplicadas = 0
  if (incluir && pendentes > 0) {
    const ids = par.pendentes.map(p => p.id)
    const { error } = await ctx.admin.from('telao_events').update(plano.updates).in('id', ids)
    const { data: conf } = await ctx.admin.from('telao_events').select(COLS).in('id', ids)
    parcelasAplicadas = ((conf ?? []) as VendaBanco[]).filter(p => { const e = souEu(p, sol); return modo === 'dividir' ? e.co : e.principal }).length
    checks.push({ ok: !error && parcelasAplicadas === ids.length, aviso: parcelasAplicadas !== ids.length, texto: `Parcelas anteriores atualizadas: ${parcelasAplicadas} de ${ids.length}` })
  }
  // auditoria (best effort: se a tabela ainda não existe, a transferência vale mesmo assim e o aviso diz isso)
  const depoisCampos = depoisV ? Object.fromEntries(AUDIT_FIELDS.map(k => [k, (depoisV as any)[k] ?? null])) : plano.updates
  const aud = await ctx.admin.from('sale_transfer_log').insert({ troca_id: troca.id, sale_id: v.id, transaction_id: v.transaction_id, modo, requester_id: troca.requester_id, requester_name: sol.nome, performed_by: ctx.userId, performed_by_name: ctx.name, antes: antesCampos, depois: depoisCampos, regra_assinatura: plano.regra, parcelas_afetadas: parcelasAplicadas })
  checks.push({ ok: !aud.error, aviso: !!aud.error, texto: aud.error ? 'Registro de auditoria não gravado (rode a migração migration-transferencias.sql)' : 'Registro de auditoria gravado (quem, quando, antes e depois)' })
  const par2 = await outrasParcelas(ctx, depoisV ?? v, sol), nomesDepois = depoisV ? await nomesDe(ctx, depoisV) : {}
  const tudoOk = checks.filter(c => !c.aviso).every(c => c.ok)
  return ok({ ...base, resultado: tudoOk ? 'transferida' : 'parcial', modo, titulo: tudoOk ? 'Venda transferida' : 'Transferida, com ressalvas', mensagem: tudoOk ? `${sol.nome} agora ${modo === 'dividir' ? 'divide o crédito desta venda como co-closer' : 'é o closer desta venda'}. Confirmado no banco.` : 'A alteração foi gravada, mas alguma conferência falhou — veja os itens abaixo.', checks, venda: viewVenda(depoisV ?? v), antes, depois: depoisV ? traduzir(depoisV, sol, nomesDepois) : [], parcelas: { outras: par2.total, pendentes: par2.pendentes.length, aplicadas: parcelasAplicadas }, assinatura: v.subscription_id ? { regra_gravada: regraGravada } : null })
}
