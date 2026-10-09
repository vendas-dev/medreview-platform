export type ExamVertical = 'anest' | 'oft' | 'ortop'
export const EXAM_VERTICALS: ExamVertical[] = ['anest', 'oft', 'ortop']

// Etapas que o sistema reconhece. A IA escolhe UMA delas por data; o tipo ("kind") é
// derivado daqui — nunca decidido pela IA.
export const PHASES = [
  'edital', 'inscricoes', 'pre_teste', 'prova_teorica', 'prova_teorico_pratica', 'prova_pratica',
  'prova_oral', 'gabarito', 'resultado_preliminar', 'resultado_final', 'outro',
] as const
export type ExamPhase = (typeof PHASES)[number]
export type ExamKind = 'edital' | 'inscricao' | 'prova' | 'resultado' | 'outro'

export const PHASE_KIND: Record<ExamPhase, ExamKind> = {
  edital: 'edital', inscricoes: 'inscricao', pre_teste: 'outro',
  prova_teorica: 'prova', prova_teorico_pratica: 'prova', prova_pratica: 'prova', prova_oral: 'prova',
  gabarito: 'resultado', resultado_preliminar: 'resultado', resultado_final: 'resultado', outro: 'outro',
}
export const PHASE_LABEL: Record<ExamPhase, string> = {
  edital: 'Edital publicado', inscricoes: 'Inscrições', pre_teste: 'Pré-teste obrigatório',
  prova_teorica: 'Prova teórica', prova_teorico_pratica: 'Prova teórico-prática', prova_pratica: 'Prova prática',
  prova_oral: 'Prova oral', gabarito: 'Gabarito', resultado_preliminar: 'Resultado preliminar',
  resultado_final: 'Resultado final', outro: 'Outra data',
}

export interface ExamSource {
  id: string; vertical: ExamVertical; society: string; exam_labels: string[]; name: string; url: string
  follow_pattern: string | null; exclude_pattern: string | null; follow_max: number; priority: number; active: boolean
}

// O que a IA devolve (ainda NÃO confiável — passa pela verificação antes de virar dado)
export interface RawItem {
  exam_label: string; phase: string; title: string
  starts_on: string; ends_on: string | null; evidence: string
}

// O que sobrevive à verificação
export interface VerifiedItem {
  vertical: ExamVertical; society: string; exam_label: string; phase: ExamPhase; kind: ExamKind; title: string
  starts_on: string; ends_on: string | null; evidence: string; source_url: string; source_id: string
  dedupe_key: string
}

export type RunStatus = 'ok' | 'no_data' | 'blocked_robots' | 'fetch_error' | 'extract_error'

export interface ExamMilestoneRow {
  id: string; dedupe_key: string; vertical: ExamVertical; society: string; exam_label: string; phase: ExamPhase
  kind: ExamKind; title: string; starts_on: string; ends_on: string | null; source_id: string | null; source_url: string
  evidence: string | null; origin: 'auto' | 'manual'; status: 'active' | 'stale'
  previous_starts_on: string | null; previous_ends_on: string | null; changed_at: string | null
  first_seen_at: string; last_seen_at: string; created_by?: string | null; created_by_name?: string | null
}
