// ══ Vendas — "Consultar HP" e "Transferir Venda" (superadmin): regras PURAS (sem banco, sem tela) ═══════════════════
//  • Conferir o ID (HP) que o closer digitou contra a linha real de telao_events, em português.
//  • Decidir COMO transferir (mesma lógica da rota pública /api/public/transfer-sale):
//      - Self-Checkout            → CORRIGIR: vira venda do closer (closer_id exige a tabela closers)
//      - Embaixador / sem closer  → DIVIDIR : o closer entra como co-closer (co_closer_id exige a tabela profiles); a venda original continua intacta (uma linha só, o total da empresa não duplica)
//      - Já é de OUTRO closer     → o superadmin ESCOLHE: DIVIDIR (co-closer) ou TOTAL (o closer que pediu vira o dono e o outro deixa de ter o crédito)
//    Se a venda é uma parcela de assinatura, grava também a regra para as parcelas FUTURAS (subscription_transfers).
import { fmtDataHora } from './format'

export type Modo = 'corrigir' | 'dividir' | 'total'
export type Origem = 'self_checkout' | 'embaixador' | 'closer' | 'sem_origem'
export type Situacao = 'ja_do_solicitante' | 'self_checkout' | 'embaixador' | 'de_outro_closer' | 'sem_closer'
export type Tom = 'ok' | 'atencao' | 'info' | 'erro'

export interface VendaBanco {
  id: string; transaction_id: string | null; lead_name: string | null; email: string | null; vertical: string | null; product: string | null; value: number | string | null; coupon_code: string | null; occurred_at: string | null
  seller_type: string | null; is_self_checkout: boolean | null; sold_by_ambassador: boolean | null; ambassador_name: string | null
  closer_id: string | null; closer_name: string | null; closer_hubspot_id: string | null; co_closer_id: string | null; co_closer_hubspot_id: string | null
  transferred_at: string | null; transfer_reason: string | null; sale_type: string | null; is_recurring: boolean | null; installment_number: number | null; total_installments: number | null; subscription_id: string | null
}
/** O closer que pediu a troca, com os DOIS ids (closer_id aponta para closers; co_closer_id aponta para profiles). */
export interface Solicitante { profileId: string | null; closerId: string | null; hubspotId: string | null; nome: string }
export interface RegraAssinatura { mode: string | null; co_closer_id: string | null; co_closer_hubspot_id: string | null; reason?: string | null }
export interface Linha { chave: string; titulo: string; texto: string; tom: Tom }

export const normalizar = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m)
const hub = (s?: string | null) => (s == null ? '' : String(s).trim())

/** Quem é o closer que pediu, nessa venda: principal (closer_id/closer_hubspot_id) e/ou co-closer. */
export function souEu(v: VendaBanco, s: Solicitante): { principal: boolean; co: boolean } {
  const principal = (!!v.closer_id && !!s.closerId && v.closer_id === s.closerId) || (!!hub(v.closer_hubspot_id) && !!hub(s.hubspotId) && hub(v.closer_hubspot_id) === hub(s.hubspotId))
  const co = (!!v.co_closer_id && !!s.profileId && v.co_closer_id === s.profileId) || (!!hub(v.co_closer_hubspot_id) && !!hub(s.hubspotId) && hub(v.co_closer_hubspot_id) === hub(s.hubspotId))
  return { principal, co }
}
export function origemDe(v: VendaBanco): Origem {
  if (v.is_self_checkout === true || v.seller_type === 'self_checkout') return 'self_checkout'
  if (v.seller_type === 'ambassador' || v.sold_by_ambassador === true) return 'embaixador'
  if (v.seller_type === 'closer') return 'closer'
  return 'sem_origem'
}
export function situacaoDe(v: VendaBanco, s: Solicitante): Situacao {
  const eu = souEu(v, s)
  if (eu.principal || eu.co) return 'ja_do_solicitante'
  if (origemDe(v) === 'self_checkout') return 'self_checkout'
  if (v.closer_id || hub(v.closer_hubspot_id)) return 'de_outro_closer'
  return origemDe(v) === 'embaixador' ? 'embaixador' : 'sem_closer'
}
/** O modo que o sistema usa sozinho; null = precisa o superadmin escolher. */
export const modoPadrao = (sit: Situacao): Modo | null => (sit === 'self_checkout' ? 'corrigir' : sit === 'embaixador' || sit === 'sem_closer' ? 'dividir' : null)
export const modosPermitidos = (sit: Situacao): Modo[] => (sit === 'self_checkout' ? ['corrigir'] : sit === 'embaixador' || sit === 'sem_closer' ? ['dividir'] : sit === 'de_outro_closer' ? ['dividir', 'total'] : [])

// ── conferência com o que o closer digitou ───────────────────────────────────────────────────────────────────────
export interface PedidoInfo { lead_name: string; product: string; vertical: string }
export interface Conf { campo: 'lead' | 'produto' | 'vertical'; rotulo: string; pedido: string; banco: string; status: 'confere' | 'diverge' | 'sem_dado' }
const contem = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a))
export function compararPedido(v: VendaBanco, p: PedidoInfo, rotuloVertical: (x?: string | null) => string): { resumo: 'confere' | 'parcial' | 'diverge'; campos: Conf[] } {
  const lead = normalizar(v.lead_name), pl = normalizar(p.lead_name), prod = normalizar(v.product), pp = normalizar(p.product)
  const campos: Conf[] = [
    { campo: 'lead', rotulo: 'Nome do lead', pedido: p.lead_name, banco: v.lead_name ?? '—', status: !lead ? 'sem_dado' : contem(lead, pl) ? 'confere' : (() => { const a = new Set(lead.split(' ')), b = pl.split(' ').filter(x => x.length > 2); return b.length && b.filter(x => a.has(x)).length / b.length >= 0.6 ? 'confere' : 'diverge' })() },
    { campo: 'produto', rotulo: 'Produto', pedido: p.product, banco: v.product ?? '—', status: !prod ? 'sem_dado' : contem(prod, pp) ? 'confere' : 'diverge' },
    { campo: 'vertical', rotulo: 'Vertical', pedido: rotuloVertical(p.vertical), banco: rotuloVertical(v.vertical), status: !v.vertical ? 'sem_dado' : v.vertical === p.vertical ? 'confere' : 'diverge' },
  ]
  const div = campos.filter(c => c.status === 'diverge').length, ok = campos.filter(c => c.status === 'confere').length
  return { resumo: div === 0 ? 'confere' : ok === 0 ? 'diverge' : 'parcial', campos }
}

// ── tradução da linha do banco ───────────────────────────────────────────────────────────────────────────────────
export interface Nomes { principal?: string | null; co?: string | null; regra?: RegraAssinatura | null; regraNome?: string | null }
export function traduzir(v: VendaBanco, s: Solicitante, n: Nomes = {}): Linha[] {
  const L: Linha[] = [], eu = souEu(v, s), org = origemDe(v)
  const quem = (x?: string | null) => x || 'um closer'
  if (org === 'self_checkout') L.push({ chave: 'origem', titulo: 'Origem', tom: 'atencao', texto: 'Self-Checkout — o lead pagou direto, sem passar por um closer. Hoje esta venda NÃO conta para nenhum closer.' })
  else if (org === 'embaixador') L.push({ chave: 'origem', titulo: 'Origem', tom: 'info', texto: `Venda de Embaixador — fechada pelo cupom ${v.coupon_code ? `"${v.coupon_code}" ` : ''}${v.ambassador_name ? `do embaixador ${v.ambassador_name}` : 'de um embaixador'}. Conta no canal Embaixadores.` })
  else if (org === 'closer') L.push({ chave: 'origem', titulo: 'Origem', tom: 'info', texto: 'Venda de Closer — fechada por um closer.' })
  else L.push({ chave: 'origem', titulo: 'Origem', tom: 'atencao', texto: 'Origem não identificada (sem tipo de vendedor registrado).' })
  const temPrincipal = !!(v.closer_id || hub(v.closer_hubspot_id))
  if (temPrincipal) {
    const nome = quem(n.principal ?? v.closer_name)
    L.push(eu.principal
      ? { chave: 'closer', titulo: 'Closer da venda', tom: 'ok', texto: `${nome} — é o PRÓPRIO closer que pediu a troca. Já está como Closer.` }
      : { chave: 'closer', titulo: 'Closer da venda', tom: 'atencao', texto: `${nome} — é OUTRO closer (quem pediu foi ${s.nome}). Alguém já negociou ou registrou esta venda antes.` })
  } else if (org !== 'self_checkout') L.push({ chave: 'closer', titulo: 'Closer da venda', tom: 'atencao', texto: 'Nenhum closer está atribuído a esta venda.' })
  if (v.co_closer_id || hub(v.co_closer_hubspot_id)) {
    const quando = v.transferred_at ? ` Transferida em ${fmtDataHora(v.transferred_at)}.` : '', motivo = v.transfer_reason ? ` Motivo: ${v.transfer_reason}.` : ''
    L.push({ chave: 'co', titulo: 'Co-closer', tom: eu.co ? 'ok' : 'info', texto: `${quem(n.co)} também recebe o crédito desta venda (co-closer)${eu.co ? ' — é o closer que pediu a troca' : ''}.${quando}${motivo}` })
  }
  if (v.sale_type === 'recorrente' || v.is_recurring) {
    const parc = `Parcela ${v.installment_number ?? '?'}${v.total_installments ? ` de ${v.total_installments}` : ''} de uma assinatura recorrente.`
    const reg = !v.subscription_id ? ' (sem identificador de assinatura: não dá para criar regra para as próximas).' : n.regra ? ` Já existe uma regra: as próximas parcelas vão para ${quem(n.regraNome)} (${n.regra.mode === 'correct' ? 'como correção/closer da venda' : 'como co-closer'}).` : ' Ainda NÃO existe regra para as próximas parcelas desta assinatura.'
    L.push({ chave: 'recorrencia', titulo: 'Recorrência', tom: 'info', texto: parc + reg })
  } else L.push({ chave: 'recorrencia', titulo: 'Tipo', tom: 'info', texto: 'Venda nova (primeira cobrança).' })
  return L
}
export function sugestaoDe(sit: Situacao, nome: string, n: Nomes = {}): string {
  switch (sit) {
    case 'ja_do_solicitante': return `Nada a transferir: esta venda já está com ${nome}.`
    case 'self_checkout': return `“Transferir Venda” transforma esta venda em venda de ${nome} (corrige o Self-Checkout).`
    case 'embaixador': return `“Transferir Venda” adiciona ${nome} como co-closer. A venda do embaixador continua intacta (o total da empresa não duplica).`
    case 'sem_closer': return `“Transferir Venda” adiciona ${nome} como co-closer desta venda.`
    case 'de_outro_closer': return `Esta venda já é de ${n.principal ?? 'outro closer'}. Ao transferir você escolhe: dividir (${nome} entra como co-closer) ou transferir totalmente (${nome} vira o dono).`
  }
}

// ── plano de atualização (mesmos campos da rota pública, mais o necessário no modo "total") ─────────────────────
export interface Plano { updates: Record<string, any>; regra: null | { subscription_id: string; mode: 'correct' | 'co_closer'; co_closer_id: string; co_closer_hubspot_id: string | null; reason: string }; exige: 'closers' | 'profiles' }
export function planoAtualizacao(modo: Modo, v: VendaBanco, s: Solicitante, motivo: string, agora: string): Plano {
  const base: Record<string, any> = { transferred_at: agora, transfer_reason: motivo }
  let updates: Record<string, any>
  if (modo === 'dividir') updates = { ...base, co_closer_id: s.profileId, co_closer_hubspot_id: s.hubspotId }
  else {
    updates = { ...base, closer_id: s.closerId, closer_hubspot_id: s.hubspotId, closer_name: s.nome }
    if (modo === 'corrigir') { updates.is_self_checkout = false; updates.seller_type = 'closer' }
    else if (origemDe(v) !== 'embaixador') updates.seller_type = 'closer'
    if (modo === 'total' && souEu({ ...v, closer_id: null, closer_hubspot_id: null }, s).co) { updates.co_closer_id = null; updates.co_closer_hubspot_id = null }    // quem era co-closer vira o dono: some a duplicidade
  }
  const regra = v.subscription_id && s.profileId ? { subscription_id: v.subscription_id, mode: (modo === 'dividir' ? 'co_closer' : 'correct') as 'correct' | 'co_closer', co_closer_id: s.profileId, co_closer_hubspot_id: s.hubspotId, reason: motivo } : null
  return { updates, regra, exige: modo === 'dividir' ? 'profiles' : 'closers' }
}
