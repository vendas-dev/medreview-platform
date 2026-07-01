// ── Forecast de receita recorrente ──────────────────────────
//
// 1. Agrupa vendas recorrentes por subscription_id e descobre o estado
//    de cada assinatura (quantas parcelas faltam, status).
// 2. Calcula a taxa de aderência histórica (% de assinaturas que de fato
//    pagaram a parcela seguinte quando já era esperado).
// 3. Projeta MÊS A MÊS (até dezembro do ano corrente) o valor esperado
//    de parcelas futuras, aplicando a taxa de aderência de forma
//    COMPOSTA por parcela (parcela 1 no futuro = rate^1, parcela 2 = rate^2...),
//    já que cada parcela futura depende de todas as anteriores terem se confirmado.

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

export interface MonthlyForecast {
  monthKey:  string   // "2026-07"
  label:     string   // "Jul"
  bruto:     number
  ajustado:  number
}

const CADENCE_DAYS  = 30   // assume cadência mensal entre parcelas
const ATRASO_DIAS   = 40   // após isso, considera "atrasada"
const RISCO_DIAS    = 60   // após isso, considera "em risco" (provável churn)
const MONTH_LABELS  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

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
      if (daysSince > RISCO_DIAS)       status = 'em_risco'
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
      if (cur.installment_number >= cur.total_installments) continue
      const daysSince = Math.floor((now - new Date(cur.occurred_at).getTime()) / 86400000)
      if (daysSince < CADENCE_DAYS + 5) continue

      chances++
      const hasNext = sorted.some(s => s.installment_number > cur.installment_number)
      if (hasNext) continued++
    }
  }

  if (chances < 5) return { rate: 0.70, sampleSize: chances }
  return { rate: continued / chances, sampleSize: chances }
}

// Projeção mês a mês, limitada ao fim do ano corrente (a partir do próximo mês).
// Para assinaturas "atrasadas", a próxima parcela esperada é ancorada no
// próximo mês (já está em atraso, então a expectativa é que regularize em breve).
// Para assinaturas "ativas", a cadência continua a partir da última parcela paga.
export function computeMonthlyForecast(
  states: SubscriptionState[],
  persistenceRate: number,
  now: Date = new Date()
): MonthlyForecast[] {
  const year = now.getFullYear()
  const months: MonthlyForecast[] = []
  for (let mi = now.getMonth() + 1; mi <= 11; mi++) {
    months.push({ monthKey: `${year}-${String(mi + 1).padStart(2, '0')}`, label: MONTH_LABELS[mi], bruto: 0, ajustado: 0 })
  }
  if (months.length === 0) return months // já é dezembro — sem meses futuros no ano

  const idxByKey = new Map(months.map((m, i) => [m.monthKey, i]))

  for (const s of states) {
    if (s.status === 'completa' || s.status === 'em_risco' || s.remaining <= 0) continue

    const anchor = s.status === 'atrasada'
      ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
      : new Date(s.lastPaymentDate)

    for (let k = 1; k <= s.remaining; k++) {
      const expected = new Date(anchor)
      expected.setDate(expected.getDate() + k * CADENCE_DAYS)
      if (expected.getFullYear() > year) break // passou do fim do ano, para essa assinatura
      const mk  = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}`
      const idx = idxByKey.get(mk)
      if (idx === undefined) continue
      months[idx].bruto    += s.value
      months[idx].ajustado += s.value * Math.pow(persistenceRate, k)
    }
  }

  return months
}

export interface ForecastResult {
  mrrAtual:                  number
  parcelasRestantesBruto:    number
  parcelasRestantesAjustado: number
  persistenceRate:           number
  sampleSize:                number
  ativas:                    number
  atrasadas:                 number
  emRisco:                   number
  completas:                 number
  monthlyForecast:           MonthlyForecast[]
}

export function computeForecast(
  allRecurringSales: RecurringSale[],
  mrrAtual: number,
  now: Date = new Date()
): ForecastResult {
  const states = computeSubscriptionStates(allRecurringSales)
  const { rate, sampleSize } = computePersistenceRate(allRecurringSales)
  const monthlyForecast = computeMonthlyForecast(states, rate, now)

  let ativas = 0, atrasadas = 0, emRisco = 0, completas = 0
  for (const s of states) {
    if (s.status === 'completa')  completas++
    if (s.status === 'ativa')      ativas++
    if (s.status === 'atrasada')   atrasadas++
    if (s.status === 'em_risco')   emRisco++
  }

  const bruto    = monthlyForecast.reduce((s, m) => s + m.bruto, 0)
  const ajustado = monthlyForecast.reduce((s, m) => s + m.ajustado, 0)

  return {
    mrrAtual,
    parcelasRestantesBruto:    bruto,
    parcelasRestantesAjustado: ajustado,
    persistenceRate:           rate,
    sampleSize,
    ativas, atrasadas, emRisco, completas,
    monthlyForecast,
  }
}
