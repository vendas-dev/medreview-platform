// ── Atingimento de meta do closer ──────────────────────────────────────
// Uma única regra de conta, usada pela meta GERAL e por cada VERTICAL, pra
// os números nunca discordarem entre si.
//
// Dias corridos (igual ao painel do superadmin e ao card "Seu ritmo"). O
// ritmo necessário conta o dia de hoje como dia ainda disponível: a receita
// de hoje já está no realizado, mas o dia ainda não acabou.

export type GoalStatus = 'none' | 'done' | 'ahead' | 'onpace' | 'behind'

export interface GoalProgress {
  goal: number
  revenue: number
  pct: number            // atingimento (passa de 100 quando supera a meta)
  pctMonth: number       // % do mês já decorrido
  gap: number            // quanto falta pra meta (0 se já bateu)
  excess: number         // quanto passou da meta (0 se ainda não bateu)
  diasRestantes: number  // contando hoje
  perDayNeeded: number   // R$/dia pra fechar a meta até o fim do mês
  perDayCurrent: number  // média do mês até agora (R$/dia)
  projected: number      // onde fecha se mantiver o ritmo atual
  projectedPct: number
  expected: number       // quanto "deveria" ter feito até hoje
  diffPP: number         // atingimento − % do mês (pontos percentuais)
  status: GoalStatus
}

export function computeGoalProgress(p: { goal: number; revenue: number; dayOfMonth: number; daysInMonth: number }): GoalProgress {
  const goal = Math.max(Number(p.goal) || 0, 0)
  const revenue = Math.max(Number(p.revenue) || 0, 0)
  const daysInMonth = Math.max(Math.round(p.daysInMonth) || 30, 1)
  const dayOfMonth = Math.min(Math.max(Math.round(p.dayOfMonth) || 1, 1), daysInMonth)

  const pctMonth = (dayOfMonth / daysInMonth) * 100
  const diasRestantes = Math.max(daysInMonth - dayOfMonth + 1, 1)
  const perDayCurrent = revenue / dayOfMonth
  const projected = perDayCurrent * daysInMonth
  const pct = goal > 0 ? (revenue / goal) * 100 : 0
  const gap = Math.max(goal - revenue, 0)
  const diffPP = pct - pctMonth

  let status: GoalStatus = 'none'
  if (goal > 0) status = revenue >= goal ? 'done' : Math.abs(diffPP) < 1 ? 'onpace' : diffPP > 0 ? 'ahead' : 'behind'

  return {
    goal, revenue, pct, pctMonth, gap,
    excess: Math.max(revenue - goal, 0),
    diasRestantes,
    perDayNeeded: gap / diasRestantes,
    perDayCurrent,
    projected,
    projectedPct: goal > 0 ? (projected / goal) * 100 : 0,
    expected: goal * (pctMonth / 100),
    diffPP,
    status,
  }
}

// Meta geral efetiva: a do closer; se ela não foi definida mas as metas por
// vertical foram, a soma delas.
export function effectiveGeneralGoal(goalSales: number, goalsByVertical: Record<string, number> | null | undefined): number {
  const g = Number(goalSales) || 0
  if (g > 0) return g
  return Object.values(goalsByVertical ?? {}).reduce((s, v) => s + (Number(v) || 0), 0)
}

// Quais verticais ganham barra própria. R1 vende numa vertical só — a barra
// geral já é a da vertical, então não repete. OAO tem as 3.
export const OAO_VERTICALS = ['Anest-Review', 'Oft-Review', 'Ortop-Review'] as const
export function verticalsForTeam(team: string): string[] {
  return team === 'OAO' ? [...OAO_VERTICALS] : []
}

// "R$ 22,5k" / "R$ 850" / "R$ 1,2 mi" — compacto, com 1 casa quando precisa
export function fmtCompactBRL(v: number): string {
  const n = Math.abs(v || 0)
  const trim = (x: number, d: number) => x.toFixed(d).replace('.', ',').replace(/,0+$/, '')
  if (n >= 1_000_000) return `R$ ${trim(n / 1_000_000, 2)} mi`
  if (n >= 100_000) return `R$ ${trim(n / 1_000, 0)}k`
  if (n >= 1_000) return `R$ ${trim(n / 1_000, 1)}k`
  return `R$ ${Math.round(n)}`
}
