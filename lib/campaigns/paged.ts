// Lê TODAS as linhas de uma consulta, em páginas (o Supabase devolve no máximo 1.000 por consulta — campanha por hora passa disso).
// `make(de, ate)` monta a consulta já com .range(de, ate); use sempre uma ORDEM ESTÁVEL (inclua uma coluna única) para as páginas não se repetirem nem pularem linhas.
export async function fetchAllRows<T = any>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: { message?: string } | null }>, page = 1000, maxPages = 30): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await make(i * page, i * page + page - 1)
    if (error) throw new Error(error.message ?? 'erro ao ler')
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < page) break
  }
  return out
}
