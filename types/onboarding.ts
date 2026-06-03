export type TeamType = 'OAO' | 'R1' | 'ambos'
export type MaterialType = 'video' | 'documento' | 'pdf' | 'site' | 'apresentacao' | 'outro'
export type ProgressStatus = 'nao_iniciado' | 'em_andamento' | 'concluido'
export type CompletionCriteria = 'visualizar' | 'materiais' | 'quiz' | 'materiais_e_quiz'
export type TrackMode = 'livre' | 'sequencial'
export type CopilotTone = 'didatico' | 'objetivo' | 'descontraido' | 'formal'

export interface OnboardingSettings {
  id: string
  welcome_message: string
  tone: CopilotTone
  extra_instructions: string | null
  track_mode: TrackMode
}

export interface OnboardingStep {
  id: string
  title: string
  description: string | null
  estimated_minutes: number | null
  team: TeamType
  order_index: number
  completion_criteria: CompletionCriteria
  min_quiz_score: number
  max_attempts: number | null
  is_active: boolean
  // Relations
  materials?: OnboardingMaterial[]
  faqs?: OnboardingFaq[]
  questions?: OnboardingQuestion[]
}

export interface OnboardingMaterial {
  id: string
  step_id: string
  title: string
  description: string | null
  url: string
  type: MaterialType
  order_index: number
}

export interface OnboardingFaq {
  id: string
  step_id: string
  question: string
  answer: string
  order_index: number
}

export interface OnboardingQuestion {
  id: string
  step_id: string
  question: string
  explanation: string | null
  order_index: number
  answers?: OnboardingAnswer[]
}

export interface OnboardingAnswer {
  id: string
  question_id: string
  answer_text: string
  is_correct: boolean
  order_index: number
}

export interface OnboardingVideo {
  id: string
  title: string
  description: string | null
  url: string
  thumbnail_url: string | null
  team: TeamType
  duration_min: number | null
  order_index: number
  is_active: boolean
}

export interface OnboardingProgress {
  id: string
  user_id: string
  step_id: string
  status: ProgressStatus
  started_at: string | null
  completed_at: string | null
  quiz_score: number | null
  quiz_attempts: number
  time_spent_min: number
}

export interface OnboardingConversation {
  id: string
  user_id: string
  title: string
  created_at: string
}

export interface OnboardingMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
