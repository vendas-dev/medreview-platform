// ══ Vendas — validações (puras): as MESMAS regras valem no formulário e no servidor ═══════════
import { VERTICAIS_ATIVAS, verticaisDoTime } from './format'

export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
function urlOk(s: string): boolean { try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false } }

// ── Pedido de troca de venda ──────────────────────────────────────────────────────────────────
export interface TrocaInput { vertical: string; product: string; transaction_id: string; lead_name: string; hubspot_url: string; botmaker_url: string; reason: string }
export type Errors = Record<string, string>

export function validarTroca(body: any, team: string | null): { ok: true; value: TrocaInput } | { ok: false; errors: Errors } {
  const e: Errors = {}
  const b = body && typeof body === 'object' ? body : {}
  const vertical = str(b.vertical), product = str(b.product), lead_name = str(b.lead_name), hubspot_url = str(b.hubspot_url), botmaker_url = str(b.botmaker_url), reason = str(b.reason)
  const transaction_id = str(b.transaction_id).toUpperCase()
  if (!vertical) e.vertical = 'Escolha a vertical.'
  else if (!verticaisDoTime(team).includes(vertical)) e.vertical = 'Vertical não disponível para o seu time.'
  if (!product) e.product = 'Informe o produto.'; else if (product.length > 200) e.product = 'Máximo de 200 caracteres.'
  if (!transaction_id) e.transaction_id = 'Informe o ID da transação da Hotmart.'
  else if (!/^[A-Z0-9][A-Z0-9._-]{2,79}$/.test(transaction_id)) e.transaction_id = 'ID inválido (use só letras, números, ponto, hífen ou sublinhado; ex.: HP1234567890).'
  if (!lead_name) e.lead_name = 'Informe o nome do lead.'; else if (lead_name.length > 200) e.lead_name = 'Máximo de 200 caracteres.'
  if (!hubspot_url) e.hubspot_url = 'Cole o link do negócio no HubSpot.'
  else if (!urlOk(hubspot_url) || hubspot_url.length > 600) e.hubspot_url = 'Link inválido (precisa começar com http:// ou https://).'
  if (!botmaker_url) e.botmaker_url = 'Cole o link da conversa no Botmaker.'
  else if (!urlOk(botmaker_url) || botmaker_url.length > 600) e.botmaker_url = 'Link inválido (precisa começar com http:// ou https://).'
  if (!reason) e.reason = 'Explique o motivo da troca.'
  else if (reason.length < 5) e.reason = 'Descreva um pouco mais o motivo.'
  else if (reason.length > 2000) e.reason = 'Máximo de 2000 caracteres.'
  if (Object.keys(e).length) return { ok: false, errors: e }
  return { ok: true, value: { vertical, product, transaction_id, lead_name, hubspot_url, botmaker_url, reason } }
}

/** Conceder ou Negar: nos DOIS casos a justificativa (resposta) é obrigatória. */
export function validarDecisao(body: any): { ok: true; value: { decision: 'concedida' | 'negada'; response: string } } | { ok: false; error: string } {
  const d = str(body?.decision)
  if (d !== 'concedida' && d !== 'negada') return { ok: false, error: 'Escolha Conceder ou Negar.' }
  const r = str(body?.response)
  if (!r) return { ok: false, error: d === 'concedida' ? 'Justifique a concessão antes de confirmar.' : 'Justifique a negativa antes de confirmar.' }
  if (r.length > 2000) return { ok: false, error: 'A justificativa pode ter no máximo 2000 caracteres.' }
  return { ok: true, value: { decision: d, response: r } }
}

/** "7.777,70" / "7777,70" / "7777.70" / 7777.7 → 7777.7 (aceita o formato brasileiro com ponto de milhar). */
export function parseBRNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return NaN
  const t = v.trim().replace(/^R\$\s*/, '')
  if (!t) return NaN
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}

export function validarObs(body: any): { ok: true; value: string | null } | { ok: false; error: string } {
  const o = body?.obs
  if (o === null || o === undefined) return { ok: true, value: null }
  if (typeof o !== 'string') return { ok: false, error: 'Obs inválido.' }
  const t = o.trim()
  if (t.length > 2000) return { ok: false, error: 'O Obs pode ter no máximo 2000 caracteres.' }
  return { ok: true, value: t || null }
}

// ── Edição de venda (superadmin) ──────────────────────────────────────────────────────────────
export const CAMPOS_EDITAVEIS = ['occurred_at', 'transaction_id', 'vertical', 'product', 'value', 'coupon_code', 'lead_name', 'email', 'phone', 'payment_type', 'payment_installments', 'ambassador_name', 'obs'] as const
export type CampoEditavel = typeof CAMPOS_EDITAVEIS[number]
const VERTICAIS_EDITAVEIS = [...VERTICAIS_ATIVAS, 'vascreview']

export function validarEdicao(body: any): { ok: true; patch: Partial<Record<CampoEditavel, any>> } | { ok: false; errors: Errors } {
  const e: Errors = {}; const patch: Partial<Record<CampoEditavel, any>> = {}
  const b = body && typeof body === 'object' ? body : {}
  const desconhecidos = Object.keys(b).filter(k => !(CAMPOS_EDITAVEIS as readonly string[]).includes(k))
  if (desconhecidos.length) return { ok: false, errors: { _: `Campo não editável: ${desconhecidos.join(', ')}` } }
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k)
  const txt = (k: CampoEditavel, max: number, req = false, label = k as string) => {
    if (!has(k)) return
    const v = b[k]
    if (v !== null && typeof v !== 'string') { e[k] = 'Valor inválido.'; return }
    const t = (v ?? '').trim()
    if (!t) { if (req) e[k] = `${label} é obrigatório.`; else patch[k] = null; return }
    if (t.length > max) { e[k] = `Máximo de ${max} caracteres.`; return }
    patch[k] = t
  }
  if (has('occurred_at')) {
    const t = typeof b.occurred_at === 'string' ? Date.parse(b.occurred_at) : NaN
    if (isNaN(t)) e.occurred_at = 'Data inválida.'
    else if (t < Date.parse('2020-01-01T00:00:00Z') || t > Date.now() + 36 * 3600_000) e.occurred_at = 'Data fora do intervalo permitido.'
    else patch.occurred_at = new Date(t).toISOString()
  }
  if (has('transaction_id')) {
    const v = b.transaction_id
    if (v !== null && typeof v !== 'string') e.transaction_id = 'Valor inválido.'
    else { const t = (v ?? '').trim().toUpperCase(); if (!t) patch.transaction_id = null; else if (!/^[A-Z0-9][A-Z0-9._-]{2,79}$/.test(t)) e.transaction_id = 'ID inválido.'; else patch.transaction_id = t }
  }
  if (has('vertical')) { const v = str(b.vertical); if (!VERTICAIS_EDITAVEIS.includes(v)) e.vertical = 'Vertical inválida.'; else patch.vertical = v }
  txt('product', 200, false, 'Produto')
  if (has('value')) {
    const v = parseBRNumber(b.value)
    if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 10_000_000) e.value = 'Valor inválido (0 a 10.000.000).'
    else patch.value = Math.round(v * 100) / 100
  }
  txt('coupon_code', 80)
  txt('lead_name', 200, true, 'Nome')
  if (has('email')) {
    const v = b.email
    if (v !== null && typeof v !== 'string') e.email = 'Valor inválido.'
    else { const t = (v ?? '').trim().toLowerCase(); if (!t) patch.email = null; else if (t.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) e.email = 'E-mail inválido.'; else patch.email = t }
  }
  if (has('phone')) {
    const v = b.phone
    if (v !== null && typeof v !== 'string') e.phone = 'Valor inválido.'
    else { const d = (v ?? '').replace(/\D/g, ''); if (!d) patch.phone = null; else if (d.length < 8 || d.length > 15) e.phone = 'Telefone inválido (8 a 15 dígitos).'; else patch.phone = d }
  }
  if (has('payment_type')) {
    const v = b.payment_type
    if (v !== null && typeof v !== 'string') e.payment_type = 'Valor inválido.'
    else { const t = (v ?? '').trim().toUpperCase().replace(/[\s-]/g, '_'); if (!t) patch.payment_type = null; else if (!/^[A-Z][A-Z_]{1,29}$/.test(t)) e.payment_type = 'Forma de pagamento inválida.'; else patch.payment_type = t }
  }
  if (has('payment_installments')) {
    const v = b.payment_installments
    if (v === null || v === '') patch.payment_installments = null
    else { const n = typeof v === 'string' ? Number(v) : v; if (!Number.isInteger(n) || n < 1 || n > 99) e.payment_installments = 'Parcelas: número inteiro de 1 a 99.'; else patch.payment_installments = n }
  }
  if (has('ambassador_name')) {
    const v = b.ambassador_name
    if (v !== null && typeof v !== 'string') e.ambassador_name = 'Valor inválido.'
    else { const t = (v ?? '').trim(); if (!t || t.toLowerCase() === 'não' || t.toLowerCase() === 'nao') patch.ambassador_name = null; else if (t.length > 200) e.ambassador_name = 'Máximo de 200 caracteres.'; else patch.ambassador_name = t }
  }
  if (has('obs')) { const r = validarObs({ obs: b.obs }); if (!r.ok) e.obs = r.error; else patch.obs = r.value }
  if (Object.keys(e).length) return { ok: false, errors: e }
  if (Object.keys(patch).length === 0) return { ok: false, errors: { _: 'Nada para alterar.' } }
  return { ok: true, patch }
}
