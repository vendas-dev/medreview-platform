// ══ Campanhas — tipos e catálogos ═══════════════════════════════════════════
export type Team = 'OAO' | 'R1'
export const TEAMS: Team[] = ['OAO', 'R1']
export const TEAM_NAME: Record<Team, string> = { OAO: 'OAO', R1: 'R1' }
export const TEAM_HINT: Record<Team, string> = { OAO: 'Anest · Oft · Ortop', R1: 'Med-Review R1' }

export type Criterion = 'revenue_rank' | 'count_rank' | 'first_revenue' | 'first_count' | 'best_day' | 'best_sale'
export interface CriterionInfo {
  id: Criterion; icon: string; label: string; desc: string
  unit: 'money' | 'count'      // o que é medido
  race: boolean                // corrida: ganha quem BATE o alvo primeiro (vence na hora, não só no fim)
  needsTarget: boolean         // pede um valor/quantidade alvo
}
export const CRITERIA: CriterionInfo[] = [
  { id: 'revenue_rank',  icon: '💰', label: 'Maior receita',               desc: 'Ganha quem somar mais R$ em vendas no período.',                   unit: 'money', race: false, needsTarget: false },
  { id: 'count_rank',    icon: '🔢', label: 'Mais vendas',                 desc: 'Ganha quem fechar mais vendas (quantidade) no período.',            unit: 'count', race: false, needsTarget: false },
  { id: 'first_revenue', icon: '🏁', label: 'Primeiro a bater R$ X',       desc: 'Corrida: ganham os primeiros a atingir o valor em vendas.',        unit: 'money', race: true,  needsTarget: true  },
  { id: 'first_count',   icon: '⚡', label: 'Primeiro a bater X vendas',   desc: 'Corrida: ganham os primeiros a atingir a quantidade de vendas.',   unit: 'count', race: true,  needsTarget: true  },
  { id: 'best_day',      icon: '🚀', label: 'Pico de vendas (melhor dia)', desc: 'Ganha quem fizer a maior receita em um único dia.',                unit: 'money', race: false, needsTarget: false },
  { id: 'best_sale',     icon: '💎', label: 'Maior venda',                 desc: 'Ganha quem fechar a venda de maior valor.',                        unit: 'money', race: false, needsTarget: false },
]
export const criterionInfo = (c: Criterion): CriterionInfo => CRITERIA.find(x => x.id === c)!

export interface TeamRule { winners: number; target: number | null }

/** single = um prêmio pra todos os ganhadores · tiered = um prêmio DIFERENTE por posição (e por time) */
export type PrizeMode = 'single' | 'tiered'

export const THEMES = {
  roxo:  { label: 'Roxo',  from: '#7c3aed', to: '#4f46e5', glow: 'rgba(124,58,237,.45)' },
  ouro:  { label: 'Ouro',  from: '#f59e0b', to: '#ea580c', glow: 'rgba(245,158,11,.45)' },
  azul:  { label: 'Azul',  from: '#0ea5e9', to: '#2563eb', glow: 'rgba(14,165,233,.45)' },
  verde: { label: 'Verde', from: '#10b981', to: '#0d9488', glow: 'rgba(16,185,129,.45)' },
  rosa:  { label: 'Rosa',  from: '#ec4899', to: '#be185d', glow: 'rgba(236,72,153,.45)' },
} as const
export type ThemeId = keyof typeof THEMES
export const EMOJIS = ['🏁', '🏆', '🚀', '🔥', '💎', '🎯', '⚡', '🥇', '🎁', '🌟', '💰', '🏅']

/** O que o superadmin preenche. */
export interface CampaignDraft {
  name: string; subtitle: string
  prize: string                                     // premiação única (ignorado no modo diferenciado)
  prize_mode: PrizeMode
  prizes: Partial<Record<Team, string[]>>           // modo diferenciado: prizes[time][posição-1]
  emoji: string; theme: ThemeId
  criterion: Criterion
  teams: Partial<Record<Team, TeamRule>>
  starts_on: string; ends_on: string               // YYYY-MM-DD (São Paulo), inclusive
  count_recurring: boolean                         // parcelas de recorrência contam como venda?
  verticals: string[] | null                       // null = todas as do time
  notify: boolean                                  // avisar os participantes (lançamento, resultado)
}

export type CampaignStatus = 'draft' | 'published' | 'cancelled'
export type Phase = 'scheduled' | 'active' | 'ended'
export interface CampaignRow extends CampaignDraft {
  id: string; status: CampaignStatus; created_at: string; created_by: string | null
  launched_at: string | null; finalized_at: string | null; start_notified_at: string | null
}

export function emptyDraft(today: string): CampaignDraft {
  return {
    name: '', subtitle: '', prize: '', prize_mode: 'single', prizes: {}, emoji: '🏁', theme: 'roxo', criterion: 'revenue_rank',
    teams: { OAO: { winners: 3, target: null }, R1: { winners: 4, target: null } },
    starts_on: today, ends_on: today, count_recurring: false, verticals: null, notify: true,
  }
}
