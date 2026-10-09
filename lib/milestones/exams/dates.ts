// Leitor de datas em português — ESTRITO de propósito.
// Só reconhece datas escritas com dia, mês e ANO no próprio texto. Nunca presume o ano.
// É a base da verificação: a data que a IA devolve precisa aparecer aqui, no trecho citado.

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}
const MON = '(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)'
const SEP = '(?:a|e|à|até|-)'          // "13 a 30", "26 e 27", "13 - 30"

export function isoDate(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null   // ex: 31/02
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function prep(text: string): string {
  return text.toLowerCase()
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/(\d)\s*[º°]/g, '$1')          // 1º → 1
    .replace(/\s+/g, ' ')
}
const mes = (s: string) => MESES[s.replace('ç', 'c')] ?? MESES[s]

/** Todas as datas COMPLETAS (com ano) que o texto escreve — inclusive intervalos ("13 a 30/10/2026"). */
export function extractDates(raw: string): string[] {
  const t = prep(raw)
  const out = new Set<string>()
  const add = (y: number, m: number, d: number) => { const v = isoDate(y, m, d); if (v) out.add(v) }

  // dd/mm/aaaa
  for (const m of t.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g)) add(+m[3], +m[2], +m[1])
  // d de mês de aaaa
  for (const m of t.matchAll(new RegExp(`(?<!\\d)(\\d{1,2}) de ${MON} de (\\d{4})(?!\\d)`, 'g'))) add(+m[3], mes(m[2]), +m[1])
  // d a d/mm/aaaa   |   d e d/mm/aaaa
  for (const m of t.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2}) ?${SEP} ?(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})(?!\\d)`, 'g'))) { add(+m[4], +m[3], +m[1]); add(+m[4], +m[3], +m[2]) }
  // d a d de mês de aaaa
  for (const m of t.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2}) ?${SEP} ?(\\d{1,2}) de ${MON} de (\\d{4})(?!\\d)`, 'g'))) { add(+m[4], mes(m[3]), +m[1]); add(+m[4], mes(m[3]), +m[2]) }
  // dd/mm a dd/mm/aaaa  (o ano do 1º vem do 2º; se o mês do 1º for maior, é o ano anterior)
  for (const m of t.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2})\\/(\\d{1,2}) ?${SEP} ?(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})(?!\\d)`, 'g'))) {
    const y2 = +m[5], m1 = +m[2], m2 = +m[4]
    add(m1 > m2 ? y2 - 1 : y2, m1, +m[1]); add(y2, m2, +m[3])
  }
  // d de mês [de aaaa] a d de mês de aaaa
  for (const m of t.matchAll(new RegExp(`(?<!\\d)(\\d{1,2}) de ${MON}(?: de (\\d{4}))? ?${SEP} ?(\\d{1,2}) de ${MON} de (\\d{4})(?!\\d)`, 'g'))) {
    const y2 = +m[6], m1 = mes(m[2]), m2 = mes(m[5])
    const y1 = m[3] ? +m[3] : (m1 > m2 ? y2 - 1 : y2)
    add(y1, m1, +m[1]); add(y2, m2, +m[4])
  }
  return [...out].sort()
}

export const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
export const diffDays = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
