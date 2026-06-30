// ── Forecast de receita recorrente ──────────────────────────
//
// Lógica:
// 1. Agrupa vendas recorrentes por subscription_id.
// 2. Para cada assinatura, identifica a última parcela paga e quantas faltam.
// 3. Calcula a taxa de aderência histórica (% de assinaturas que de fato
//    pagaram a parcela seguinte quando já era esperado) com base em TODO
//    o histórico de vendas recorrentes — não só do mês corrente.
// 4. Aplica essa taxa como "haircut" sobre o valor bruto das parcelas
//    restantes, gerando um forecast conservador.
//
// Por que não assumir 100% das parcelas restantes:
// o usuário deixou claro que parcelas podem não se confirmar (cliente
// cancela, atrasa, etc.), então o forecast precisa refletir isso.

export interface RecurringSale {
  subscription_id:     string
  installment_number:   number
  total_installments:   number
  value:                number
  occurred_at:          string
}

export interface SubscriptionState {
  subscription_id:     string
  lastInstallment:      number
  totalInstallments:    number
  remaining:            number
  value:                number
  lastPaymentDate:      string
  daysSinceLastPayment: number
  status:               'completa' | 'ativa' | 'atrasada' | 'em_risco'
}

const CADENCE_DAYS  = 30   // assume cadência mensal entre parcelas
const ATRASO_DIAS   = 40   // após isso, considera "atrasada"
const RISCO_DIAS    = 60   // após isso, considera "em risco" (provável churn)

// Agrupa vendas recorrentes por assinatura e determina o estado de cada uma
export function computeSubscriptionStates(allRecurringSales: RecurringSale[]): SubscriptionState[] {
  const bySub = new Map<string, RecurringSale[]>()
  for (const s of allRecurringSales) {
    if (!s.subscription_id) continue
    if (!bySub.has(s.subscription_id)) bySub.set(s.subscription_id, [])
    bySub.get(s.subscription_id)!.push(s)
  }

  const now = Date.now()
  const states: SubscriptionState[] = []

  for (const [subId, sales] of bySub) {
    const sorted = [...sales].sort((a, b) => b.installment_number - a.installment_number)
    const last = sorted[0]
    const remaining = Math.max(last.total_installments - last.installment_number, 0)
    const daysSince = Math.floor((now - new Date(last.occurred_at).getTime()) / 86400000)

    let status: SubscriptionState['status'] = 'completa'
    if (remaining > 0) {
      if (daysSince > RISCO_DIAS)      status = 'em_risco'
      else if (daysSince > ATRASO_DIAS) status = 'atrasada'
      else                              status = 'ativa'
    }

    states.push({
      subscription_id:     subId,
      lastInstallment:      last.installment_number,
      totalInstallments:    last.total_installments,
      remaining,
      value:                last.value,
      lastPaymentDate:      last.occurred_at,
      daysSinceLastPayment: daysSince,
      status,
    })
  }
  return states
}

// Taxa de aderência histórica: das assinaturas que já tiveram "chance" de
// pagar a parcela seguinte (passou tempo suficiente desde a última parcela
// E ainda restavam parcelas), quantas de fato continuaram pagando?
//
// "Continuou pagando" = existe no histórico uma parcela com número maior
// que a que tínhamos quando a "chance" apareceu.
export function computePersistenceRate(allRecurringSales: RecurringSale[]): { rate: number; sampleSize: number } {
  const bySub = new Map<string, RecurringSale[]>()
  for (const s of allRecurringSales) {
    if (!s.subscription_id) continue
    if (!bySub.has(s.subscription_id)) bySub.set(s.subscription_id, [])
    bySub.get(s.subscription_id)!.push(s)
  }

  const now = Date.now()
  let chances = 0
  let continued = 0

  for (const [, sales] of bySub) {
    const sorted = [...sales].sort((a, b) => a.installment_number - b.installment_number)
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i]
      if (cur.installment_number >= cur.total_installments) continue // já era a última parcela
      const daysSince = Math.floor((now - new Date(cur.occurred_at).getTime()) / 86400000)
      if (daysSince < CADENCE_DAYS + 5) continue // ainda não teve "chance" de pagar a próxima

      chances++
      const hasNext = sorted.some(s => s.installment_number > cur.installment_number)
      if (hasNext) continued++
    }
  }

  // Sem amostra suficiente: usar taxa conservadora padrão de 70%
  if (chances < 5) return { rate: 0.70, sampleSize: chances }
  return { rate: continued / chances, sampleSize: chances }
}

export interface ForecastResult {
  mrrAtual:           number   // receita recorrente confirmada no mês corrente
  parcelasRestantesBruto: number  // soma de (remaining * value) de assinaturas ativas/atrasadas
  parcelasRestantesAjustado: number // mesmo valor, com haircut da taxa de aderência
  persistenceRate:    number
  sampleSize:         number
  ativas:             number
  atrasadas:          number
  emRisco:            number
  completas:          number
}

export function computeForecast(
  allRecurringSales: RecurringSale[],
  mrrAtual: number
): ForecastResult {
  const states = computeSubscriptionStates(allRecurringSales)
  const { rate, sampleSize } = computePersistenceRate(allRecurringSales)

  let bruto = 0
  let ativas = 0, atrasadas = 0, emRisco = 0, completas = 0

  for (const s of states) {
    if (s.status === 'completa') { completas++; continue }
    if (s.status === 'ativa')      ativas++
    if (s.status === 'atrasada')   atrasadas++
    if (s.status === 'em_risco') { emRisco++; continue } // não entra no forecast — provável churn

    bruto += s.remaining * s.value
  }

  return {
    mrrAtual,
    parcelasRestantesBruto:    bruto,
    parcelasRestantesAjustado: bruto * rate,
    persistenceRate:           rate,
    sampleSize,
    ativas, atrasadas, emRisco, completas,
  }
}
