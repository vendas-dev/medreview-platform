// Calcula quais etapas estão liberadas pro usuário, respeitando a ordem
// sequencial: dia (day_number) primeiro, depois order_index dentro do dia.
// A primeira etapa da sequência sempre libera; as demais só liberam se a
// etapa anterior estiver com status 'concluido'.
//
// Etapa SEM dia definido (day_number nulo) fica FORA da corrente sequencial:
// sempre acessível, não trava esperando nada, e também não vira pré-requisito
// de mais ninguém (não entra na verificação "a anterior está concluída?").
// Isso evita que uma etapa mal configurada (sem dia) vire uma trava invisível
// — seja furando a fila pra frente do Dia 1, seja exigindo que tudo mais do
// time esteja concluído antes dela liberar.
export function computeUnlockedStepIds(
  steps: { id: string; day_number: number | null; order_index: number | null }[],
  progressByStepId: Record<string, string>
): Set<string> {
  const comDia = steps.filter(s => s.day_number !== null && s.day_number !== undefined)
  const semDia = steps.filter(s => s.day_number === null || s.day_number === undefined)

  const ordered = [...comDia].sort((a, b) => {
    const da = a.day_number as number, db = b.day_number as number
    if (da !== db) return da - db
    return (a.order_index ?? 0) - (b.order_index ?? 0)
  })

  const unlocked = new Set<string>()
  let prevDone = true // a primeira etapa da sequência sempre começa liberada
  for (const step of ordered) {
    if (prevDone) unlocked.add(step.id)
    prevDone = progressByStepId[step.id] === 'concluido'
  }

  // Etapas sem dia definido: sempre liberadas, fora da corrente.
  semDia.forEach(step => unlocked.add(step.id))

  return unlocked
}
