// ══ Projeção de fechamento do mês — a MESMA conta do Forecast, para quem não passa pela tela do Forecast (ex.: KPI de Vendas Gerais) ═════
// Espelha o que dashboard/page.tsx + ForecastSection.tsx fazem: realizado do mês + recorrência a receber + links em aberto válidos + ritmo de vendas novas × dias restantes.
// Se mudar a regra lá, mude aqui (e vice-versa): é o que impede dois números diferentes para a mesma coisa.
import { todayInSaoPaulo, monthBoundsSaoPaulo } from '@/lib/timezone'
import { computeForecast, computeRemainingMonthRecurring, type RecurringSale } from '@/lib/telao/forecast'
import { composeClosingForecast } from './forecastMath'
import { computeForecastLive } from './forecastAnalysis'

const num = (v: any) => Number(v) || 0

/** Lê todas as linhas, 1.000 por vez (o banco corta cada leitura em 1.000 sem avisar). */
async function lerTudo(build: (a: number, b: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  const out: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await build(a, a + 999)
    if (error) throw new Error(String(error.message ?? error))
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

export interface ProjecaoFechamento {
  today: string; monthKey: string
  realizado: number; recorrencia: number; links: number; ritmo: number
  projecao: number; meta: number; pctVsMeta: number
}

export async function computeClosingProjection(admin: any): Promise<ProjecaoFechamento> {
  const today = todayInSaoPaulo(), monthKey = today.slice(0, 7)
  const { start: mStart, end: mEnd } = monthBoundsSaoPaulo(monthKey)
  const [vendasMes, recorrentes, live] = await Promise.all([
    lerTudo((a, b) => admin.from('telao_events').select('value, sale_type').eq('event_type', 'sale').gte('occurred_at', mStart).lte('occurred_at', mEnd).order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(a, b)),
    lerTudo((a, b) => admin.from('telao_events').select('subscription_id, installment_number, total_installments, value, occurred_at').eq('event_type', 'sale').eq('is_recurring', true).not('subscription_id', 'is', null).order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(a, b)),
    computeForecastLive(admin),
  ])
  const realizado = vendasMes.reduce((s, e) => s + num(e.value), 0)
  const novaRev = vendasMes.filter(e => (e.sale_type ?? 'nova') === 'nova').reduce((s, e) => s + num(e.value), 0)
  const mrrAtual = vendasMes.filter(e => (e.sale_type ?? 'nova') === 'recorrente').reduce((s, e) => s + num(e.value), 0)
  const rec: RecurringSale[] = recorrentes.filter(e => e.subscription_id && e.installment_number && e.total_installments)
    .map(e => ({ subscription_id: e.subscription_id, installment_number: e.installment_number, total_installments: e.total_installments, value: num(e.value), occurred_at: e.occurred_at }))
  const fc = computeForecast(rec, mrrAtual)
  const [y, m] = monthKey.split('-').map(Number)
  const diasNoMes = new Date(y, m, 0).getDate(), diaDoMes = Number(today.slice(8, 10)), diasRestantes = Math.max(diasNoMes - diaDoMes, 0)
  const c = composeClosingForecast({
    realizado,
    recorrenciaPrevista: computeRemainingMonthRecurring(fc.states, fc.persistenceRate, new Date()),
    recorrenciaPagaDesdeCarga: 0,
    linksValidos: live.links.valid.value,
    ritmoRestante: diaDoMes > 0 ? (novaRev / diaDoMes) * diasRestantes : 0,
    meta: live.goals.geral.meta,
    diasRestantes,
  })
  return { today, monthKey, realizado: c.realizado, recorrencia: c.recorrencia, links: c.links, ritmo: c.ritmo, projecao: c.projecao, meta: live.goals.geral.meta, pctVsMeta: c.pctVsMeta }
}
