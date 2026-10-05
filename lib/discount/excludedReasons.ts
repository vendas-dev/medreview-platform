// ── Motivos de desconto que NÃO entram no cálculo de desconto médio ─────
// O gerador de link manda um campo extra ("motivo_desconto"). Se ele
// trouxer qualquer um dos valores abaixo, a venda continua contando normal
// em receita, ranking e quantidade — só o cálculo de desconto (desconto
// médio e "deixado na mesa") passa a ignorá-la, mesmo que o cupom
// termine em _X%.
//
// Lista FIXA no código, de propósito: pra mudar, é só editar aqui.
export const DISCOUNT_EXCLUDED_REASONS = ['Upsell', '2 Links', 'FIES', 'Prouni'] as const

// Minúsculo, sem acento, espaços repetidos viram um só — assim "PROUNI",
// "Prouní" e "2  links" casam com os valores acima.
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
}

const EXCLUDED = new Set(DISCOUNT_EXCLUDED_REASONS.map(norm))

// O campo pode trazer um valor só ou vários, separados por vírgula ou
// ponto e vírgula (ex: "FIES; Upsell"). Cada pedaço é comparado por
// inteiro com a lista — comparar por "contém" no texto todo daria falso
// positivo (ex: "12 Links" contém "2 Links").
export function isDiscountExcludedReason(raw: string | null | undefined): boolean {
  if (!raw) return false
  return String(raw).split(/[,;]/).map(norm).filter(Boolean).some(token => EXCLUDED.has(token))
}
