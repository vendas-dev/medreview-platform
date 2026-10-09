import { ExamMilestoneRow, ExamVertical, PHASE_LABEL } from './types'
import { diffDays } from './dates'

// Cores por vertical (as mesmas do restante da plataforma): Anest = azul, Oft = amarelo, Ortop = laranja
export const VERT_STYLE: Record<ExamVertical, { label: string; short: string; color: string }> = {
  anest: { label: 'Anest-Review', short: 'Anest', color: '#4f7be8' },
  oft:   { label: 'Oft-Review',   short: 'Oft',   color: '#dba21a' },
  ortop: { label: 'Ortop-Review', short: 'Ortop', color: '#e67a38' },
}

export const todaySP = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)

export const fmtBR = (iso: string): string => iso.split('-').reverse().join('/')
/** "13 a 30/10/2026" · "30/10 a 05/11/2026" · "30/12/2026 a 05/01/2027" */
export function fmtRange(a: string, b: string | null): string {
  if (!b || b === a) return fmtBR(a)
  const [ya, ma, da] = a.split('-'), [yb, mb, db] = b.split('-')
  if (ya === yb && ma === mb) return `${da} a ${db}/${mb}/${yb}`
  if (ya === yb) return `${da}/${ma} a ${db}/${mb}/${yb}`
  return `${fmtBR(a)} a ${fmtBR(b)}`
}

export type AlertLevel = 'urgent' | 'soon' | 'info' | 'past'
export type AlertState = 'upcoming' | 'open' | 'today' | 'past'

export interface ExamAlert {
  id: string; vertical: ExamVertical; exam_label: string; phase: string; kind: string
  headline: string; dateText: string; countdown: string
  level: AlertLevel; state: AlertState; nextDate: string
  changed: boolean; previousText: string | null
  source_url: string; origin: 'auto' | 'manual'; evidence: string | null
  last_seen_at: string; created_by_name?: string | null; starts_on: string; ends_on: string | null
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

export function buildAlerts(items: ExamMilestoneRow[], today: string): ExamAlert[] {
  const out: ExamAlert[] = []
  for (const it of items) {
    if (it.status !== 'active') continue
    const range = !!it.ends_on && it.ends_on !== it.starts_on
    const end = it.ends_on ?? it.starts_on
    const isInsc = it.phase === 'inscricoes'
    let state: AlertState, level: AlertLevel, countdown: string, nextDate: string

    if (today > end) {
      const ago = diffDays(end, today)
      if (ago > 14) continue                                  // some da tela 14 dias depois de encerrar
      state = 'past'; level = 'past'; nextDate = end
      countdown = ago === 1 ? 'encerrou ontem' : `encerrou há ${ago} dias`
    } else if (range && today >= it.starts_on) {              // dentro do intervalo
      state = 'open'; nextDate = end
      const m = diffDays(today, end)
      countdown = m === 0 ? 'último dia' : m === 1 ? (isInsc ? 'fecha amanhã' : 'termina amanhã') : `${isInsc ? 'fecha' : 'termina'} em ${m} dias`
      level = m <= 7 ? 'urgent' : 'soon'
    } else if (range) {                                      // intervalo que ainda não começou
      state = 'upcoming'; nextDate = it.starts_on
      const n = diffDays(today, it.starts_on)
      countdown = n === 1 ? (isInsc ? 'abre amanhã' : 'começa amanhã') : `${isInsc ? 'abre' : 'começa'} em ${n} dias`
      level = n <= 7 ? 'soon' : 'info'
    } else {                                                 // data única
      nextDate = it.starts_on
      const n = diffDays(today, it.starts_on)
      if (n === 0) { state = 'today'; countdown = 'hoje'; level = 'urgent' }
      else { state = 'upcoming'; countdown = n === 1 ? 'amanhã' : `em ${n} dias`; level = n <= 7 ? 'urgent' : n <= 30 ? 'soon' : 'info' }
    }
    // resultado/gabarito/edital não pedem ação de venda: nunca "urgente"
    if ((it.kind === 'resultado' || it.kind === 'edital') && level === 'urgent') level = 'soon'

    const changed = !!it.previous_starts_on && !!it.changed_at && diffDays(it.changed_at.slice(0, 10), today) <= 14
    const label = PHASE_LABEL[it.phase] ?? it.title
    const headline = isInsc
      ? (state === 'open' ? 'Inscrições abertas' : state === 'past' ? 'Inscrições encerradas' : 'Inscrições')
      : (it.phase === 'outro' ? it.title : label)

    out.push({
      id: it.id, vertical: it.vertical, exam_label: it.exam_label, phase: it.phase, kind: it.kind,
      headline, dateText: fmtRange(it.starts_on, it.ends_on), countdown, level, state, nextDate,
      changed, previousText: changed ? fmtRange(it.previous_starts_on!, it.previous_ends_on) : null,
      source_url: it.source_url, origin: it.origin, evidence: it.evidence, last_seen_at: it.last_seen_at,
      created_by_name: it.created_by_name, starts_on: it.starts_on, ends_on: it.ends_on,
    })
  }
  return out.sort((a, b) => (a.state === 'past' ? 1 : 0) - (b.state === 'past' ? 1 : 0) || (a.state === 'past' ? b.nextDate.localeCompare(a.nextDate) : a.nextDate.localeCompare(b.nextDate)))
}

/** Alertas que merecem faixa de destaque no topo (urgentes e próximos), no máx. N. */
export function topAlerts(alerts: ExamAlert[], max = 3): ExamAlert[] {
  const rank: Record<AlertLevel, number> = { urgent: 0, soon: 1, info: 2, past: 3 }
  return alerts.filter(a => a.level === 'urgent' || a.level === 'soon').sort((a, b) => rank[a.level] - rank[b.level] || a.nextDate.localeCompare(b.nextDate)).slice(0, max)
}

export const alertsByVertical = (alerts: ExamAlert[]): Record<ExamVertical, ExamAlert[]> => ({
  anest: alerts.filter(a => a.vertical === 'anest'), oft: alerts.filter(a => a.vertical === 'oft'), ortop: alerts.filter(a => a.vertical === 'ortop'),
})

const VERTICAL_VALUE: Record<ExamVertical, string> = { anest: 'anestreview', oft: 'oftreview', ortop: 'ortopreview' }
export const EXAM_CATEGORY = { value: 'prova_titulo', label: '📋 Prova de título', color: '#6366f1' }

/**
 * Datas verificadas → marcos no MESMO formato do calendário do Milestones (start_at/end_at/vertical/color).
 * Cor = a da vertical. Meio-dia local evita cair no dia errado por fuso; "allDay" esconde o horário na tela.
 */
export function examToCalendarMilestones(items: ExamMilestoneRow[]) {
  return items.filter(i => i.status === 'active').map(i => ({
    id: `exam-${i.id}`,
    title: `${i.exam_label} · ${i.phase === 'outro' ? i.title : PHASE_LABEL[i.phase]}`,
    category: EXAM_CATEGORY.value,
    vertical: VERTICAL_VALUE[i.vertical],
    start_at: `${i.starts_on}T12:00:00`,
    end_at: i.ends_on && i.ends_on !== i.starts_on ? `${i.ends_on}T12:00:00` : null,
    description: null as string | null, responsible: null as string | null,
    link: i.source_url, priority: null as string | null, audience: null as string | null,
    color: VERT_STYLE[i.vertical].color,
    created_at: i.first_seen_at,
    allDay: true,
    exam: {
      society: i.society, origin: i.origin, evidence: i.evidence, checkedAt: i.last_seen_at,
      changedFrom: i.previous_starts_on && i.changed_at ? fmtRange(i.previous_starts_on, i.previous_ends_on) : null,
      addedBy: i.created_by_name ?? null,
    },
  }))
}
