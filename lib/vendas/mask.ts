// ══ Vendas — máscaras de campo (puras): o que o usuário digita é formatado na hora ═══════════════
/** Valor em reais, digitando livremente: "7777,7" → "7.777,7"; no máximo 2 casas e 8 dígitos inteiros. */
export function maskMoney(input: string): string {
  const s = (input ?? '').replace(/[^\d,]/g, '')
  const i = s.indexOf(',')
  let int = (i === -1 ? s : s.slice(0, i)).replace(/^0+(?=\d)/, '').slice(0, 8)
  const dec = i === -1 ? null : s.slice(i + 1).replace(/,/g, '').slice(0, 2)
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec === null ? int : `${int || '0'},${dec}`
}
/** Ao sair do campo: sempre 2 casas ("7.777,7" → "7.777,70"; "7.777" → "7.777,00"; vazio continua vazio). */
export function moneyBlur(masked: string): string {
  const m = maskMoney(masked)
  if (!m) return ''
  const [int, dec = ''] = m.split(',')
  return `${int || '0'},${(dec + '00').slice(0, 2)}`
}
export function parseMoney(masked: string): number | null {
  const m = (masked ?? '').trim(); if (!m) return null
  const n = Number(m.replace(/\./g, '').replace(',', '.'))
  return isFinite(n) ? n : null
}
export function moneyToMasked(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(Number(n))) return ''
  return moneyBlur(Number(n).toFixed(2).replace('.', ','))
}

/** Telefone brasileiro: (41) 9999-9999 (10 dígitos) ou (41) 99999-9999 (11 dígitos). */
export function maskPhone(input: string): string {
  const d = (input ?? '').replace(/\D/g, '').slice(0, 11)
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return d ? `(${d}` : ''
}
export const unmaskPhone = (masked: string) => (masked ?? '').replace(/\D/g, '')

export const maskInt = (input: string, max = 2) => (input ?? '').replace(/\D/g, '').slice(0, max)
/** ID de transação: MAIÚSCULAS, só letras, números, ponto, hífen e sublinhado. */
export const maskTx = (input: string) => (input ?? '').toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 80)
/** Cupom: MAIÚSCULAS; aceita também % (o sufixo _7.5% é a "Oferta"). */
export const maskCoupon = (input: string) => (input ?? '').toUpperCase().replace(/[^A-Z0-9_.%-]/g, '').slice(0, 80)
export const maskEmail = (input: string) => (input ?? '').replace(/\s/g, '').toLowerCase().slice(0, 200)
/** Nome: sem espaço no começo e sem espaços duplos (o espaço final simples é permitido enquanto digita). */
export const maskName = (input: string, max = 200) => (input ?? '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ').slice(0, max)
export const maskUrl = (input: string) => (input ?? '').replace(/\s/g, '').slice(0, 600)
