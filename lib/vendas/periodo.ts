// ══ Vendas — períodos rápidos (mesmos do Telão) e conversão para o intervalo ISO do banco ═════
import { todayInSaoPaulo, weekdayInSaoPaulo, addDaysToDateStr, dayBoundsSaoPaulo } from '@/lib/timezone'

export type PeriodoKey = 'hoje' | 'ontem' | 'semana' | 'mes' | '7d' | '30d' | '3m' | 'mes-passado' | 'custom'
export interface Periodo { key: PeriodoKey; label: string; start: string; end: string }   // start/end = datas "YYYY-MM-DD" de São Paulo

export function periodoPresets(): Periodo[] {
  const today = todayInSaoPaulo()
  const dow = (weekdayInSaoPaulo(new Date()) + 6) % 7                       // dias desde a segunda
  const firstThis = today.slice(0, 8) + '01'
  const lastPrev = addDaysToDateStr(firstThis, -1)
  return [
    { key: 'hoje', label: 'Hoje', start: today, end: today },
    { key: 'ontem', label: 'Ontem', start: addDaysToDateStr(today, -1), end: addDaysToDateStr(today, -1) },
    { key: 'semana', label: 'Esta semana', start: addDaysToDateStr(today, -dow), end: today },
    { key: 'mes', label: 'Este mês', start: firstThis, end: today },
    { key: '7d', label: 'Últimos 7 dias', start: addDaysToDateStr(today, -6), end: today },
    { key: '30d', label: 'Últimos 30 dias', start: addDaysToDateStr(today, -29), end: today },
    { key: '3m', label: 'Últimos 3 meses', start: addDaysToDateStr(today, -89), end: today },
    { key: 'mes-passado', label: 'Mês passado', start: lastPrev.slice(0, 8) + '01', end: lastPrev },
  ]
}
/** O padrão de todas as telas de vendas: "Este mês". */
export const periodoPadrao = (): Periodo => periodoPresets().find(p => p.key === 'mes')!

/** Datas de São Paulo → intervalo ISO UTC (início do 1º dia até o fim do último). */
export function periodoToRange(p: Pick<Periodo, 'start' | 'end'>): { from: string; to: string } {
  return { from: dayBoundsSaoPaulo(p.start).start, to: dayBoundsSaoPaulo(p.end).end }
}

const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
export function periodoRotulo(p: Periodo): string {
  return p.key === 'custom' || p.start !== p.end ? `${p.label} · ${dm(p.start)} – ${dm(p.end)}` : `${p.label} · ${dm(p.start)}`
}
export function periodoCustom(start: string, end: string): Periodo {
  const [a, b] = start <= end ? [start, end] : [end, start]
  return { key: 'custom', label: 'Personalizado', start: a, end: b }
}
