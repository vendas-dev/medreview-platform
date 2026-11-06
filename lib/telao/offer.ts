// ══ Ofertas da Hotmart: o CÓDIGO DA OFERTA da venda ═══════════════════════════════════════════
// Cada produto da Hotmart tem várias ofertas e cada oferta tem um código (8 letras/números, ex.: "8h0jsbyi").
// Regras PURAS (sem banco, sem tela), usadas pela rota de eventos (gravar a venda) e pelas campanhas (filtrar por oferta).

export const OFFER_MAX_LEN = 100          // tamanho máximo do texto gravado na venda (a coluna tem a mesma trava)
export const MAX_OFFER_CODES = 50         // máximo de códigos em UMA campanha
export const MAX_PRODUCT_IDS = 50         // máximo de IDs de produto em UMA campanha
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * Venda: o que chegou (qualquer coisa) → texto de UMA linha, ou null.
 * Nunca lança erro: é dado de enriquecimento e não pode barrar a venda. Quebra de linha/tabulação viram espaço,
 * espaços repetidos viram um só, caracteres invisíveis somem, e passa de 100 caracteres é cortado.
 */
export function normalizeOfferCode(v: unknown): string | null {
  let s: string
  if (typeof v === 'string') s = v
  else if (typeof v === 'number' && Number.isFinite(v)) s = String(v)
  else return null
  s = s.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return null
  return s.length > OFFER_MAX_LEN ? s.slice(0, OFFER_MAX_LEN).trim() : s
}

/** Chave de comparação: sem espaços nas pontas e sem diferenciar maiúscula de minúscula. */
export const offerKey = (s: unknown): string => (typeof s === 'string' ? s : s == null ? '' : String(s)).trim().toLowerCase()

/** Código que uma CAMPANHA aceita: letras, números, ponto, hífen e sublinhado (1 a 100 caracteres). */
export const isValidOfferCode = (s: unknown): boolean => typeof s === 'string' && s.length >= 1 && s.length <= OFFER_MAX_LEN && CODE_RE.test(s)

export interface ParsedOffers { codes: string[]; rejected: string[] }
const ENVOLTORIO = /^["'`“”‘’(\[{<]+|["'`“”‘’)\]}>.,;:!]+$/g

/**
 * Texto livre digitado ou colado (ou lista) → códigos limpos, sem repetição (maiúscula/minúscula não diferencia).
 * Separa por espaço, vírgula, ponto e vírgula, barra vertical ou quebra de linha. Se colarem um LINK da Hotmart
 * com ?off=CODIGO, pega o código do link. O que não for código válido vai para `rejected` (nunca é descartado em silêncio).
 */
export function parseOfferCodes(input: unknown): ParsedOffers {
  // texto livre: separa por espaço, vírgula etc. · LISTA: cada elemento é UM código (validado inteiro — "a b@" não vira "a")
  const tokens: string[] = Array.isArray(input) ? input.filter(x => typeof x === 'string' || typeof x === 'number').map(String) : typeof input === 'string' || typeof input === 'number' ? String(input).split(/[\s,;|]+/) : []
  const codes: string[] = [], rejected: string[] = [], seen = new Set<string>(), seenBad = new Set<string>()
  for (const raw of tokens) {
    let tok = raw.replace(ENVOLTORIO, '').trim()
    if (!tok) continue
    if (/^https?:\/\//i.test(tok) || /[?&]off=/i.test(tok)) {
      const m = tok.match(/[?&]off=([^&#\s]+)/i)
      if (m) { try { tok = decodeURIComponent(m[1]) } catch { tok = m[1] } }
    }
    if (isValidOfferCode(tok)) { const k = offerKey(tok); if (!seen.has(k)) { seen.add(k); codes.push(tok) } if (codes.length >= 200) break }
    else { const k = tok.toLowerCase(); if (!seenBad.has(k)) { seenBad.add(k); rejected.push(tok.length > 40 ? tok.slice(0, 40) + '…' : tok) } }
  }
  return { codes, rejected }
}

/** "abc12345, def67890 e mais 3" — para os textos dos avisos e da prévia. */
export function offersLabel(codes: string[], max = 5): string {
  const list = codes.filter(c => typeof c === 'string' && c.trim())
  if (list.length <= max) return list.join(', ')
  return `${list.slice(0, max).join(', ')} e mais ${list.length - max}`
}

/** A venda (código gravado nela) entra numa campanha com ESTES códigos? Sem códigos na campanha = entra qualquer venda. */
export function offerMatches(campaignCodes: string[] | null | undefined, saleCode: unknown): boolean {
  if (!campaignCodes || campaignCodes.length === 0) return true
  const k = offerKey(saleCode)
  return k !== '' && campaignCodes.some(c => offerKey(c) === k)
}

// ── ID do PRODUTO (Hotmart): mesmas regras do código da oferta (uma linha, até 100 caracteres, comparação sem diferenciar maiúscula) ──
// O ID do produto na Hotmart é numérico (ex.: 2366290); guardamos como TEXTO para não perder nada.
export const normalizeProductId = (v: unknown): string | null => normalizeOfferCode(v)
export const isValidProductId = (s: unknown): boolean => isValidOfferCode(s)
export const parseProductIds = (input: unknown): ParsedOffers => parseOfferCodes(input)

/** Quando a campanha filtra por produto E por oferta: 'and' = a venda precisa ser do produto E da oferta · 'or' = basta uma das duas. */
export type FilterLogic = 'and' | 'or'
export interface SaleFilter { offer_codes?: string[] | null; product_ids?: string[] | null; filter_logic?: FilterLogic | string | null }

/**
 * A venda entra na campanha, dado o filtro de ofertas e/ou de produtos?
 *  • nenhum filtro → entra qualquer venda (inclusive sem código e sem produto)
 *  • só ofertas → o código da oferta da venda precisa ser um dos informados
 *  • só produtos → o ID do produto da venda precisa ser um dos informados
 *  • os dois → 'and': precisa casar com os dois · 'or': basta casar com um
 * Venda sem código/sem ID nunca casa com aquele filtro. Se a condição estiver ausente (não deveria: a validação exige), vale 'and', o mais restritivo.
 */
export function saleMatchesFilter(f: SaleFilter, sale: { offer?: unknown; product?: unknown }): boolean {
  const o = !!(f.offer_codes && f.offer_codes.length > 0), p = !!(f.product_ids && f.product_ids.length > 0)
  if (!o && !p) return true
  const om = o && offerMatches(f.offer_codes, sale.offer), pm = p && offerMatches(f.product_ids, sale.product)
  if (o && p) return f.filter_logic === 'or' ? om || pm : om && pm
  return o ? om : pm
}
