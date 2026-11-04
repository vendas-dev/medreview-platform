import { CampaignDraft, CampaignRow, Team, TEAMS, THEMES, CRITERIA, EMOJIS } from './types'
import { rowToDraft } from './server'

/** Lê o rascunho vindo da tela e devolve só o que é válido (nunca confia no que chega). */
export function parseDraft(b: any): CampaignDraft | null {
  if (!b || typeof b !== 'object') return null
  const teams: CampaignDraft['teams'] = {}, prizes: CampaignDraft['prizes'] = {}
  for (const t of TEAMS) {
    const r = b.teams?.[t]; if (!r) continue
    const winners = Number(r.winners), target = r.target === null || r.target === '' || r.target === undefined ? null : Number(r.target)
    if (Array.isArray(b.prizes?.[t])) prizes[t as Team] = b.prizes[t].slice(0, 50).map((x: unknown) => String(x ?? ''))
    teams[t as Team] = { winners: Number.isFinite(winners) ? Math.trunc(winners) : 0, target: target !== null && Number.isFinite(target) ? target : null }
  }
  return {
    name: String(b.name ?? ''), subtitle: String(b.subtitle ?? ''), prize: String(b.prize ?? ''),
    prize_mode: b.prize_mode === 'tiered' ? 'tiered' : 'single', prizes,
    emoji: EMOJIS.includes(b.emoji) ? b.emoji : '🏁', theme: b.theme in THEMES ? b.theme : 'roxo',
    criterion: CRITERIA.some(c => c.id === b.criterion) ? b.criterion : 'revenue_rank',
    teams, starts_on: String(b.starts_on ?? ''), ends_on: String(b.ends_on ?? ''),
    count_recurring: b.count_recurring === true,
    verticals: Array.isArray(b.verticals) && b.verticals.length ? b.verticals.filter((v: unknown) => typeof v === 'string').slice(0, 10) : null,
    notify: b.notify !== false,
  }
}
export const toRow = (r: any): CampaignRow => ({ ...rowToDraft(r), id: r.id, status: r.status, created_at: r.created_at, created_by: r.created_by, launched_at: r.launched_at, finalized_at: r.finalized_at, start_notified_at: r.start_notified_at })
