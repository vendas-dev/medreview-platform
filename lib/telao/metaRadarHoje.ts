import type { Goal } from './types'

// ══ Meta do dia do telão = a "Meta de hoje" do Radar (EXCEÇÃO por data) ═════════════════════════════════════════════════
// Normalmente a meta do dia do telão é (meta do mês − já feito) ÷ dias restantes (hooks/useLiveData.tsx).
// Nas datas listadas aqui, o GERAL usa a meta de hoje do Radar (Forecast → Radar diário, coluna "meta ajustada"). Fora delas nada muda:
// amanhã o telão volta sozinho ao cálculo de sempre. Para repetir em outro dia, é só acrescentar a data (AAAA-MM-DD, horário de Brasília).
export const META_DIA_RADAR_DATAS: string[] = ['2026-11-27']

export const usaMetaRadarHoje = (hojeSP: string): boolean => META_DIA_RADAR_DATAS.includes(hojeSP)

/** Troca a meta do dia GERAL pela do Radar. Só vale em data da lista e com valor válido (> 0); senão devolve as metas como estão. As verticais não mudam. */
export function aplicarMetaRadarHoje(goals: Goal[], hojeSP: string, valorRadar: number | null | undefined): Goal[] {
  if (!usaMetaRadarHoje(hojeSP) || !(typeof valorRadar === 'number' && valorRadar > 0)) return goals
  return goals.map(g => (g.period === 'day' && g.vertical === null ? { ...g, target_value: valorRadar } : g))
}
