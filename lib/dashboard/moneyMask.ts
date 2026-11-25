// Máscara de dinheiro (pt-BR) dos campos de meta: milhar com ponto, centavos com vírgula, no máximo 2 casas.
// Digitando: o ponto é só separador de milhar (some e volta sozinho); a VÍRGULA começa os centavos.
// Colando (Ctrl+V): entende "R$ 1.234,56", "1234,56", "1234.56", "1,234.56", "50.000" e "1.5".
export const MONEY_MAX_INT_DIGITS = 9            // até R$ 999.999.999,99 (o servidor aceita até 1 bilhão)

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function build(int: string, dec: string | null): { text: string; value: number | undefined } {
  int = int.replace(/^0+(?=\d)/, '').slice(0, MONEY_MAX_INT_DIGITS)
  const d = dec == null ? null : dec.slice(0, 2)
  if (int === '' && d == null) return { text: '', value: undefined }
  const text = (int === '' ? '0' : group(int)) + (d == null ? '' : ',' + d)
  return { text, value: Number((int || '0') + (d ? '.' + d : '')) }
}

/** Digitando: `raw` é o que está no campo agora (com pontos de milhar que a própria máscara pôs). */
export function maskMoneyTyped(raw: string): { text: string; value: number | undefined } {
  const s = raw.replace(/[^\d,]/g, '')
  const i = s.indexOf(',')
  if (i < 0) return build(s, null)
  return build(s.slice(0, i), s.slice(i + 1).replace(/,/g, ''))
}

/** Colando: descobre qual símbolo é o decimal. */
export function maskMoneyPasted(raw: string): { text: string; value: number | undefined } {
  const s = raw.replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return { text: '', value: undefined }
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.')
  let dec: '.' | ',' | null = null
  if (lc >= 0 && ld >= 0) dec = lc > ld ? ',' : '.'
  else if (lc >= 0) dec = ','                                   // "1234,5" / "1.234,56" / "1234,567" (vírgula é sempre decimal no Brasil)
  else if (ld >= 0) dec = /^\d{1,3}(\.\d{3})+$/.test(s) ? null : '.'   // "50.000" = cinquenta mil · "1234.56" / "1.5" = decimal
  if (dec == null) return build(s.replace(/\./g, ''), null)
  const k = s.lastIndexOf(dec), int = s.slice(0, k).replace(/[.,]/g, ''), fr = s.slice(k + 1).replace(/[.,]/g, '')
  return build(int, fr)
}

/** Como o valor aparece quando o campo não está sendo digitado: sem ",00" nos inteiros, 2 casas nos quebrados. */
export function moneyFieldText(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return ''
  const cents = Math.round(v * 100)
  const int = String(Math.trunc(cents / 100)), c = cents % 100
  return group(int) + (c ? ',' + String(c).padStart(2, '0') : '')
}
