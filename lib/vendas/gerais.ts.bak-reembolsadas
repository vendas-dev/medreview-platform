// ══ Vendas Gerais — regras puras (servidor e tela usam as MESMAS): canais, busca tolerante a acento e destaque ═════
import { FORMAS_PAGAMENTO, VERTICAIS_ATIVAS, VERTICAL_LABEL, formaPagamento } from './format'

// ── Canal de venda ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type CanalId = 'self' | 'embaixador' | 'closer' | 'sem'
export type CanalFiltro = 'todos' | 'self' | 'closers' | 'embaixadores'
export const CANAIS: { value: CanalFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos os canais' }, { value: 'self', label: 'Self-Checkout' }, { value: 'closers', label: 'Imparáveis (closers)' }, { value: 'embaixadores', label: 'Embaixadores' },
]
export const CANAL_ROTULO: Record<CanalId, string> = { self: 'Self-Checkout', embaixador: 'Embaixador', closer: 'Imparável', sem: 'Sem origem' }
export const CANAL_COR: Record<CanalId, string> = { self: '#0ea5e9', embaixador: '#d97706', closer: '#14b8a6', sem: '#94a3b8' }
/** Cor para TEXTO pequeno sobre o fundo claro da etiqueta: mistura a cor com a cor do texto do tema (escurece no tema claro, clareia no escuro) — contraste mínimo 4,5:1. */
export const textoCor = (cor: string) => `color-mix(in srgb, ${cor} 52%, var(--foreground))`
export const canalFiltroValido = (c?: string | null): CanalFiltro => (CANAIS.some(x => x.value === c) ? (c as CanalFiltro) : 'todos')
/** Self-Checkout ganha de Embaixador, que ganha de Closer (a mesma prioridade do "Consultar HP"). Sem nenhuma pista de origem: "sem". */
export function canalDe(v: { is_self_checkout?: boolean | null; seller_type?: string | null; sold_by_ambassador?: boolean | null; closer_id?: string | null; closer_hubspot_id?: string | null }): CanalId {
  if (v.is_self_checkout === true || v.seller_type === 'self_checkout') return 'self'
  if (v.sold_by_ambassador === true || v.seller_type === 'ambassador') return 'embaixador'
  if (v.seller_type === 'closer' || !!v.closer_id || !!(v.closer_hubspot_id ?? '').trim()) return 'closer'
  return 'sem'
}

// ── Abas (uma tabela geral + uma por vertical ATIVA) ────────────────────────────────────────────────────────────────────────────────
export const ABAS = ['geral', ...VERTICAIS_ATIVAS] as const
export type AbaId = (typeof ABAS)[number]
export const abaValida = (a?: string | null): AbaId => ((ABAS as readonly string[]).includes(a ?? '') ? (a as AbaId) : 'geral')

// ── Busca ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const MAX_TOKENS = 6, MAX_TOKEN = 30, MIN_TOKEN = 2
/** tira acento e põe em minúsculas ("João" → "joao"). */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** As palavras da busca: sem acento, só com letras, números e @ . _ + - ; mínimo 2 letras; sem repetir; no máximo 6. */
export function tokensDaBusca(q: string): string[] {
  const out: string[] = []
  for (const bruto of semAcento(q ?? '').split(/\s+/)) {
    const t = bruto.replace(/[^a-z0-9@._+\-]/g, '').replace(/^[.\-_+]+|[.\-_+]+$/g, '').slice(0, MAX_TOKEN)
    if (t.length >= MIN_TOKEN && !out.includes(t)) out.push(t)
    if (out.length >= MAX_TOKENS) break
  }
  return out
}
const CLASSES: Record<string, string> = { a: 'aAáÁàÀâÂãÃäÄ', e: 'eEéÉèÈêÊëË', i: 'iIíÍìÌîÎïÏ', o: 'oOóÓòÒôÔõÕöÖ', u: 'uUúÚùÙûÛüÜ', c: 'cCçÇ', n: 'nNñÑ' }
/** A palavra vira uma expressão regular que ignora acento e maiúscula ("joao" acha "João" e "JOAO"); caracteres especiais ficam entre colchetes (nunca precisam de barra). */
export function padraoRegex(token: string): string {
  return [...token].map(ch => CLASSES[ch] ? `[${CLASSES[ch]}]` : /[a-z0-9@_]/.test(ch) ? ch : `[${ch}]`).join('')
}
/** Para o telefone: os dígitos podem ter qualquer separador no meio ("(11) 98888-7777" acha 11988887777 e +55 11 98888-7777). */
export function padraoTelefone(token: string): string {
  const d = token.replace(/\D/g, '')
  return d.length >= 4 ? d.split('').join('[^0-9]*') : padraoRegex(token)
}

const norm = (s: string) => semAcento(s).replace(/[^a-z0-9]/g, '')
const palavras = (s: string) => semAcento(s).split(/[^a-z0-9]+/).filter(Boolean)
/** Palavras que a busca reconhece como FILTRO (além de procurar nos textos): vertical, canal, forma de pagamento e recorrência. */
export interface Entendido { verticais: string[]; canais: ('self' | 'embaixador' | 'closer')[]; formas: string[]; recorrente: boolean }
const ALIAS_PAGTO: Record<string, string[]> = { BILLET: ['BOLETO'], CREDIT_CARD: ['CARTAO', 'CREDITCARD', 'CARD'] }
const ehPrefixo = (token: string, vocab: string[]) => token.length >= 3 && vocab.some(w => w.startsWith(token))
export function entenderToken(token: string): Entendido {
  const t = norm(token)
  const verticais = t.length >= 2 ? VERTICAIS_ATIVAS.filter(v => {
    const rot = VERTICAL_LABEL[v] ?? v, curto = v === 'medreview' ? ['r1'] : []
    return (t.length >= 3 && [norm(v), norm(rot)].some(x => x.startsWith(t))) || curto.includes(t) || (v === 'medreview' && t === 'med')
  }) : []
  const canais: Entendido['canais'] = []
  if (ehPrefixo(t, ['selfcheckout', 'checkout', 'autoatendimento'])) canais.push('self')
  if (ehPrefixo(t, ['embaixador', 'embaixadora', 'embaixadores', 'ambassador', 'afiliado', 'afiliada'])) canais.push('embaixador')
  if (ehPrefixo(t, ['imparavel', 'imparaveis', 'closer', 'closers'])) canais.push('closer')
  const formas = FORMAS_PAGAMENTO.filter(k => palavras(formaPagamento(k)).some(w => t.length >= 3 && w.startsWith(t)) || (t.length >= 3 && norm(k).startsWith(t)) || (ALIAS_PAGTO[k] ?? []).some(a => t.length >= 4 && a.toLowerCase().startsWith(t)))
  const recorrente = ehPrefixo(t, ['recorrente', 'recorrencia', 'assinatura'])
  return { verticais: [...verticais], canais, formas, recorrente }
}
/** O texto da busca ESCAPADO para ir dentro de aspas duplas do filtro do PostgREST (a regex já não tem aspas nem barras; por garantia, remove-as). */
const aspas = (s: string) => `"${s.replace(/["\\]/g, '')}"`
const COLUNAS_TEXTO = ['lead_name', 'email', 'transaction_id', 'product', 'closer_name', 'ambassador_name', 'coupon_code', 'subscription_id'] as const
/** UM grupo OU para a palavra (cada palavra da busca precisa casar com ALGUMA coisa da venda; as palavras são ligadas por E). Só colunas de TEXTO levam regex (vertical e tipo de vendedor são enums). */
export function grupoBusca(token: string): string {
  const pat = padraoRegex(token), itens: string[] = COLUNAS_TEXTO.map(c => `${c}.imatch.${aspas(pat)}`)
  itens.push(`phone.imatch.${aspas(padraoTelefone(token))}`)
  const e = entenderToken(token)
  for (const v of e.verticais) itens.push(`vertical.eq.${v}`)
  for (const c of e.canais) {
    if (c === 'self') itens.push('is_self_checkout.eq.true', 'seller_type.eq.self_checkout')
    if (c === 'embaixador') itens.push('sold_by_ambassador.eq.true', 'seller_type.eq.ambassador')
    if (c === 'closer') itens.push('seller_type.eq.closer', 'closer_id.not.is.null')
  }
  const pagtos = new Set<string>(); for (const k of e.formas) { pagtos.add(k); (ALIAS_PAGTO[k] ?? []).forEach(a => pagtos.add(a)) }
  for (const k of pagtos) itens.push(`payment_type.ilike.${aspas(k)}`)
  if (e.recorrente) itens.push('sale_type.eq.recorrente')
  return itens.join(',')
}

/** Destaque do que casou na tela: ignora acento e maiúscula e devolve pedaços { texto, hit }. */
export function destacar(texto: string | null | undefined, tokens: string[]): { t: string; hit: boolean }[] {
  const s = texto ?? ''; if (!s) return []
  const base = [...s].map(ch => semAcento(ch).slice(0, 1) || ch.toLowerCase())      // 1 caractere de saída por caractere de entrada (o índice bate com o texto original)
  const flat = base.join(''), marca = new Array(s.length).fill(false)
  for (const tk of tokens) { if (!tk) continue; let i = flat.indexOf(tk); while (i !== -1) { for (let k = i; k < i + tk.length && k < marca.length; k++) marca[k] = true; i = flat.indexOf(tk, i + 1) } }
  const out: { t: string; hit: boolean }[] = []
  for (let i = 0; i < s.length; i++) { const h = marca[i]; if (out.length && out[out.length - 1].hit === h) out[out.length - 1].t += s[i]; else out.push({ t: s[i], hit: h }) }
  return out
}

// ── A linha da tabela (o que o servidor devolve) ───────────────────────────────────────────────────────────────────────────────────
export interface VendedorGeral { nome: string | null; avatar_url: string | null; team: string | null }
export interface VendaGeral {
  id: string; occurred_at: string; transaction_id: string | null; vertical: string; product: string | null; value: number | null; coupon_code: string | null
  lead_name: string | null; email: string | null; phone: string | null; payment_type: string | null; payment_installments: number | null; total_installments: number | null
  is_recurring: boolean | null; installment_number: number | null; sale_type: string | null; subscription_id: string | null; ambassador_name: string | null
  canal: CanalId; vendedor: VendedorGeral; co: VendedorGeral | null
}
