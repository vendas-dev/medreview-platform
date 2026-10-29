// ══ Vendas — rótulos e formatação (puro: serve servidor e telas) ════════════════
import { extractCouponDiscountPct } from '@/lib/telao/format'
import type { VendaRow } from './types'

export const VERTICAL_LABEL: Record<string, string> = {
  medreview: 'Med-Review R1', anestreview: 'Anest-Review', oftreview: 'Oft-Review', ortopreview: 'Ortop-Review', vascreview: 'Vasc-Review',
}
export const verticalLabel = (v?: string | null) => (v ? VERTICAL_LABEL[v] ?? v : '—')

/** Verticais ATIVAS (as 4 que o time vende hoje). */
export const VERTICAIS_ATIVAS = ['medreview', 'anestreview', 'oftreview', 'ortopreview'] as const

/** R1 vende só a vertical R1; OAO vende Anest, Oft e Ortop. Sem time conhecido: todas. */
export function verticaisDoTime(team?: string | null): string[] {
  const t = (team ?? '').toUpperCase()
  if (t === 'R1') return ['medreview']
  if (t === 'OAO') return ['anestreview', 'oftreview', 'ortopreview']
  return [...VERTICAIS_ATIVAS]
}

const PAGTO: Record<string, string> = {
  CREDIT_CARD: 'Cartão de crédito', PIX: 'Pix', BILLET: 'Boleto', APPLE_PAY: 'Apple Pay', GOOGLE_PAY: 'Google Pay',
  WALLET: 'Saldo Hotmart', PAYPAL: 'PayPal', NUPAY: 'NuPay', HYBRID: 'Pagamento híbrido', CASH_PAYMENT: 'Dinheiro',
}
const PAGTO_ALIAS: Record<string, string> = { BOLETO: 'BILLET', CARTAO: 'CREDIT_CARD', CREDITCARD: 'CREDIT_CARD', CARD: 'CREDIT_CARD' }
export const FORMAS_PAGAMENTO = Object.keys(PAGTO)
/** pix / credit_card / boleto (como o webhook comenta) e CREDIT_CARD (como a Hotmart manda) viram o mesmo rótulo. */
export function formaPagamento(t?: string | null): string {
  const k = (t ?? '').trim().toUpperCase().replace(/[\s-]/g, '_')
  if (!k) return '—'
  const norm = PAGTO_ALIAS[k] ?? k
  return PAGTO[norm] ?? (t ?? '').trim()
}

/** "Oferta" = o desconto que o closer concedeu, lido do sufixo _X% do cupom (mesma regra do "dinheiro deixado na mesa"). */
export function oferta(coupon?: string | null): string | null {
  const pct = extractCouponDiscountPct(coupon)
  if (pct == null) return null
  return `${String(pct).replace('.', ',')}%`
}

/** Parcelas TOTAIS feitas: as do cartão; se não houver, o total da assinatura; senão "—". */
export function parcelas(v: Pick<VendaRow, 'payment_installments' | 'total_installments'>): string {
  const n = v.payment_installments ?? v.total_installments
  return n && n > 0 ? `${n}x` : '—'
}

/** Afiliado: o nome do embaixador/afiliado, ou "Não". */
export function afiliado(v: Pick<VendaRow, 'ambassador_name'>): string {
  const n = (v.ambassador_name ?? '').trim()
  return n || 'Não'
}

export function formatPhone(p?: string | null): string {
  const d = (p ?? '').replace(/\D/g, '')
  if (!d) return '—'
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p!.trim()
}

export const fmtBRL = (n?: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
/** Reais sem centavos (para "falta R$ 5.518" em espaços pequenos). */
export const fmtBRLInt = (n?: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }))
/** Rótulo ("Anest-Review") → id da vertical ("anestreview"). As metas por vertical são salvas com o rótulo. */
export const verticalPorRotulo = (r: string): string | null => Object.entries(VERTICAL_LABEL).find(([, l]) => l === r)?.[0] ?? (r in VERTICAL_LABEL ? r : null)

/** dd/MM/yyyy HH:mm no fuso de São Paulo (o banco guarda UTC). */
export function fmtDataHora(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}
export const fmtData = (iso?: string | null) => fmtDataHora(iso).slice(0, 10)

/** Converte "2026-10-28T14:30" (hora de Brasília, como o campo datetime-local) em ISO UTC (Brasília = UTC−3, sem horário de verão). */
export function brtLocalToIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 3, +m[5])
  return isNaN(t) ? null : new Date(t).toISOString()
}
/** ISO UTC → "2026-10-28T11:30" (hora de Brasília) para o campo datetime-local. */
export function isoToBrtLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000)
  return d.toISOString().slice(0, 16)
}

/** Cor de cada vertical (distintas entre si, e as mesmas em todas as telas de vendas). */
const VERTICAL_COR: Record<string, string> = { medreview: '#8b5cf6', anestreview: '#0ea5e9', oftreview: '#ca8a04', ortopreview: '#f97316', vascreview: '#94a3b8' }
export const verticalCor = (v?: string | null) => (v && VERTICAL_COR[v]) || '#94a3b8'
/** Nome curto para etiquetas pequenas. */
const VERTICAL_CURTO: Record<string, string> = { medreview: 'R1', anestreview: 'Anest', oftreview: 'Oft', ortopreview: 'Ortop', vascreview: 'Vasc' }
export const verticalCurto = (v?: string | null) => (v && VERTICAL_CURTO[v]) || (v ?? '—')
/** Cor de cada time. */
export const TEAM_COR: Record<string, string> = { R1: '#8b5cf6', OAO: '#14b8a6' }
export const teamCor = (t?: string | null) => (t && TEAM_COR[(t ?? '').toUpperCase()]) || '#94a3b8'
