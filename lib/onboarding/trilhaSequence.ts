// Calcula quais etapas estão liberadas pro usuário, respeitando a ordem
// sequencial: dia (day_number) primeiro, depois order_index dentro do dia.
// A primeira etapa da sequência sempre libera; as demais só liberam se a
// etapa anterior estiver com status 'concluido'.
export function computeUnlockedStepIds(
  steps: { id: string; day_number: number | null; order_index: number | null }[],
  progressByStepId: Record<string, string>
): Set<string> {
  const ordered = [...steps].sort((a, b) => {
    const da = a.day_number ?? 0, db = b.day_number ?? 0
    if (da !== db) return da - db
    return (a.order_index ?? 0) - (b.order_index ?? 0)
  })

  const unlocked = new Set<string>()
  let prevDone = true // a primeira etapa da sequência sempre começa liberada
  for (const step of ordered) {
    if (prevDone) unlocked.add(step.id)
    prevDone = progressByStepId[step.id] === 'concluido'
  }
  return unlocked
}
