// ══ Projeção de fechamento do mês — a MESMA conta do Forecast, para quem não passa pela tela do Forecast (ex.: KPI de Vendas Gerais e a página inicial) ═════
// Uma conta só: lib/dashboard/projecao.ts (o ano passado, dia da semana com dia da semana, como régua). Aqui só se leem os dados e se chama essa conta;
// o topo do Forecast, a tabela e o Radar usam exatamente as mesmas funções sobre os mesmos dados (lib/dashboard/yoyServer.ts).
import { computeYoY } from './yoyServer'
import { projecaoOf } from './yoy'

export interface ProjecaoFechamento {
  today: string; monthKey: string
  realizado: number; projecao: number; resto: number; meta: number; pctVsMeta: number
  ritmo: number                        // 1 = igual ao ano passado nos dias fechados
  fonte: 'dias' | 'meta' | 'igual' | 'linear'
}

export async function computeClosingProjection(admin: any, now: Date = new Date()): Promise<ProjecaoFechamento> {
  const d = await computeYoY(admin, now), p = projecaoOf(d, 'total')
  return { today: d.today, monthKey: d.month, realizado: p.realizado, projecao: p.projecao, resto: p.resto, meta: p.meta, pctVsMeta: p.pctVsMeta ?? 0, ritmo: p.ritmo, fonte: p.fonte }
}
