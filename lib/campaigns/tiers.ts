import { fmtBRL } from '@/lib/telao/format'
import { CampaignDraft, Team, TEAMS, Tier } from './types'

// ══ Critério "Faixas de valor" (tier_revenue) ═══════════════════════════════════════════════════════════
//  Cada time tem N faixas: "quem atingir R$ X ganha o prêmio P". NÃO há limite de ganhadores: quem atinge, ganha — seja 1 ou todos.
//  Quem atinge mais de uma faixa ganha SÓ o prêmio da mais alta (não soma). Conta a receita do período (mesma atribuição das outras campanhas).
//  Este arquivo é puro (sem banco e sem tela) e NÃO importa o engine (o engine é que importa este).

export const isTierCriterion = (c: unknown): boolean => c === 'tier_revenue'
const EPS = 1e-6
const round2 = (n: number) => Math.round(n * 100) / 100
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? s)

export interface TierRow { target: number; prize: string }
/** Só as faixas válidas (valor > 0 e prêmio preenchido), em ordem crescente de valor. */
export function sortedTiers(tiers: Tier[] | undefined | null): TierRow[] {
  return (tiers ?? []).filter(t => typeof t?.target === 'number' && t.target > 0 && String(t.prize ?? '').trim()).map(t => ({ target: round2(t.target as number), prize: String(t.prize).trim() })).sort((a, b) => a.target - b.target)
}
/** Lê as faixas vindas da tela (nunca confia no que chega). Mantém faixas incompletas (rascunho). */
export function cleanTiers(raw: unknown, max = 10): Tier[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, max).map((x: any) => { const n = x?.target === null || x?.target === '' || x?.target === undefined ? null : Number(x.target); return { target: n !== null && Number.isFinite(n) && n > 0 ? round2(n) : null, prize: String(x?.prize ?? '').slice(0, 120) } })
}
/** Índice (na lista ORDENADA) da faixa mais alta cujo valor foi atingido; -1 se nenhuma. */
export function tierIndexFor(sorted: TierRow[], revenue: number): number {
  let idx = -1
  for (let i = 0; i < sorted.length; i++) if (revenue + EPS >= sorted[i].target) idx = i
  return idx
}
export interface TierStanding { tier: number | null; tierTarget: number | null; tierPrize: string | null; nextTarget: number | null; nextPrize: string | null; progress: number; tierHits: (string | null)[] }
/** Situação de UMA pessoa: faixa atual, próxima, e QUANDO bateu cada faixa (pelas vendas, em ordem de horário). */
export function tierStanding(tiers: Tier[] | undefined | null, sales: { at: string; value: number }[]): TierStanding {
  const s = sortedTiers(tiers), total = sales.reduce((a, c) => a + c.value, 0), idx = tierIndexFor(s, total)
  const hits: (string | null)[] = s.map(() => null); let acc = 0
  for (const c of sales) { acc += c.value; s.forEach((t, i) => { if (hits[i] === null && acc + EPS >= t.target) hits[i] = c.at }) }
  const next = s[idx + 1] ?? null
  return {
    tier: idx >= 0 ? idx : null, tierTarget: idx >= 0 ? s[idx].target : null, tierPrize: idx >= 0 ? s[idx].prize : null,
    nextTarget: next ? next.target : null, nextPrize: next ? next.prize : null,
    progress: s.length === 0 ? 0 : next ? Math.min(total / next.target, 1) : 1, tierHits: hits,
  }
}
export const tiersValid = (tiers: Tier[] | undefined | null): boolean => {
  const l = tiers ?? []
  if (l.length < 1 || l.length > 10) return false
  const ts = l.map(t => t.target)
  return l.every(t => typeof t.target === 'number' && t.target > 0 && String(t.prize ?? '').trim().length > 0 && String(t.prize).trim().length <= 120) && new Set(ts).size === ts.length
}

/** Mensagens de erro (a tela e a API usam a MESMA). strict=false (rascunho): só confere o que já foi preenchido. */
export function validateTiers(d: Pick<CampaignDraft, 'teams'>, teams: Team[], strict: boolean): string[] {
  const e: string[] = []
  for (const t of teams) {
    const l = d.teams[t]?.tiers ?? []
    if (strict && l.length === 0) { e.push(`Time ${t}: adicione pelo menos uma faixa (valor e prêmio).`); continue }
    if (l.length > 10) e.push(`Time ${t}: no máximo 10 faixas.`)
    const seen = new Set<number>()
    l.forEach((x, i) => {
      const n = i + 1
      if (x.target !== null && x.target !== undefined && !(typeof x.target === 'number' && x.target > 0)) e.push(`Time ${t}, faixa ${n}: o valor precisa ser maior que zero.`)
      else if (strict && !(typeof x.target === 'number' && x.target > 0)) e.push(`Time ${t}, faixa ${n}: informe o valor (R$).`)
      else if (typeof x.target === 'number') { if (seen.has(round2(x.target))) e.push(`Time ${t}: há duas faixas com o mesmo valor (${fmtBRL(x.target)}).`); seen.add(round2(x.target)) }
      const p = String(x.prize ?? '').trim()
      if (strict && !p) e.push(`Time ${t}, faixa ${n}: informe o prêmio.`)
      else if (p.length > 120) e.push(`Time ${t}, faixa ${n}: o prêmio pode ter até 120 caracteres.`)
    })
  }
  return e
}
export const tierTargetsKey = (tiers: Tier[] | undefined | null): string => sortedTiers(tiers).map(t => t.target).join(',')

// ── textos ──────────────────────────────────────────────────────────────────
const teamsOf = (d: Pick<CampaignDraft, 'teams'>): Team[] => TEAMS.filter(t => d.teams[t])
/** "R$ 1.000 → R$ 100 · R$ 2.000 → R$ 200" (se os dois times têm as mesmas faixas, não repete por time). */
export function tiersText(d: Pick<CampaignDraft, 'teams'>): string {
  const ts = teamsOf(d), lines = ts.map(t => sortedTiers(d.teams[t]!.tiers).map(x => `${fmtBRL(x.target)} → ${x.prize}`).join(' · '))
  return lines.length > 1 && lines.every(l => l === lines[0]) ? lines[0] : ts.map((t, i) => (ts.length > 1 ? `${t}: ${lines[i]}` : lines[i])).join(' | ')
}
export function howToWinTiers(d: Pick<CampaignDraft, 'teams'>, period: string): string {
  return `Todos que atingirem uma das faixas de vendas ${period} ganham o prêmio da faixa mais alta alcançada (sem limite de ganhadores).`
}
export function tierHitMessage(campaignName: string, w: { metric: number; tierTarget: number; tierPrize: string; nextTarget: number | null; nextPrize: string | null }): { title: string; body: string } {
  return {
    title: `🎯 Você atingiu ${fmtBRL(w.tierTarget)} e ganhou: ${w.tierPrize}!`,
    body: `Campanha ${campaignName.trim()}: você já soma ${fmtBRL(w.metric)}. ${w.nextTarget !== null ? `Faltam ${fmtBRL(Math.max(w.nextTarget - w.metric, 0))} para a próxima faixa (${fmtBRL(w.nextTarget)}: ${w.nextPrize}).` : 'Você está na faixa mais alta!'}`,
  }
}
export function finishMessagesTiers(d: CampaignDraft, results: { team: Team; winners: { name: string; metric: number; prize?: string | null }[] }[]) {
  const name = d.name.trim()
  const line = (t: { team: Team; winners: { name: string; metric: number; prize?: string | null }[] }) => {
    if (t.winners.length === 0) return `${t.team}: sem ganhadores`
    const by = new Map<string, string[]>(); for (const w of [...t.winners].sort((a, b) => b.metric - a.metric)) { const k = w.prize ?? ''; (by.get(k) ?? by.set(k, []).get(k)!).push(firstWord(w.name)) }
    return `${t.team}: ${t.winners.length} ${t.winners.length === 1 ? 'premiado' : 'premiados'} — ${[...by].map(([p, ns]) => `${p}: ${ns.join(', ')}`).join(' · ')}`
  }
  const lines = results.map(line).join(' · ')
  return {
    personal: (w: { team: Team; metric: number; prize?: string | null }, _position: number) => {
      const s = sortedTiers(d.teams[w.team]?.tiers), i = tierIndexFor(s, w.metric)
      return { title: `🏆 Você ganhou: ${w.prize || (i >= 0 ? s[i].prize : '')}!`, body: `Campanha ${name}: você atingiu ${fmtBRL(w.metric)}${i >= 0 ? ` e fechou na faixa de ${fmtBRL(s[i].target)}` : ''}. Parabéns!` }
    },
    everyone: { title: `🏁 Resultado: ${name}`, body: `${lines}.` },
    creator: { title: `✅ Campanha encerrada: ${name}`, body: `${lines}. Marque a entrega do prêmio em Administração → Campanhas.` },
  }
}

/** Popup dos vencedores (SÓ nome e prêmio — nunca quanto vendeu): os premiados de cada time, do maior prêmio (faixa) para o menor. */
export function tierTeamsView(d: Pick<CampaignDraft, 'teams'>, allowed: Team[], winners: any[], userId: string, closed: boolean) {
  return allowed.map(team => {
    const s = sortedTiers(d.teams[team]?.tiers), mine = winners.filter(w => w.team === team)
      .sort((a, b) => Number(b.metric_value ?? 0) - Number(a.metric_value ?? 0) || String(a.user_name).localeCompare(String(b.user_name)))
    return {
      team, tiers: s,
      positions: mine.map((w, i) => ({ position: i + 1, prize: w.prize || null, winner: { name: w.user_name as string, me: w.user_id === userId }, state: 'winner' })),
      ...(mine.length === 0 ? { empty: closed ? 'Ninguém atingiu uma faixa.' : 'Ainda ninguém atingiu uma faixa.' } : {}),
    }
  })
}
