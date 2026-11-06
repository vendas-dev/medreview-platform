// ══ Vendas — ordenação das listas de vendas (puro: serve as telas e o servidor) ══════════════════════════════════
export type Ordem = 'recentes' | 'antigas' | 'maior' | 'menor'
export const ORDENS: { value: Ordem; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' }, { value: 'antigas', label: 'Mais antigas' },
  { value: 'maior', label: 'Maior valor' }, { value: 'menor', label: 'Menor valor' },
]
export const ordemValida = (o?: string | null): Ordem => (ORDENS.some(x => x.value === o) ? (o as Ordem) : 'recentes')

/** Devolve uma CÓPIA ordenada. Data = occurred_at. Em empate (mesma data/valor) a venda mais recente vem antes e, por fim, o id (a ordem nunca "pula" entre uma consulta e outra). */
export function ordenarVendas<T extends { id: string; occurred_at: string; value: number | null }>(rows: T[], ordem: Ordem): T[] {
  const dt = (r: T) => Date.parse(r.occurred_at) || 0, vl = (r: T) => Number(r.value) || 0
  const cmp: (a: T, b: T) => number =
    ordem === 'antigas' ? (a, b) => dt(a) - dt(b)
    : ordem === 'maior' ? (a, b) => vl(b) - vl(a) || dt(b) - dt(a)
    : ordem === 'menor' ? (a, b) => vl(a) - vl(b) || dt(b) - dt(a)
    : (a, b) => dt(b) - dt(a)
  return [...rows].sort((a, b) => cmp(a, b) || String(a.id).localeCompare(String(b.id)))
}
