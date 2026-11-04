'use client'
import { Team, Tier } from '@/lib/campaigns/types'
import { sortedTiers } from '@/lib/campaigns/tiers'
import { fmtBRL } from '@/lib/telao/format'

/** Bloco do time na prévia/cards quando o critério é "Faixas de valor": lista valor → prêmio (em ordem crescente). */
export function TierTeamBlock({ team, tiers }: { team: Team; tiers: Tier[] }) {
  const s = sortedTiers(tiers)
  return (
    <div data-team-block={team} data-tier-block style={{ flex: 1, minWidth: 170, padding: '10px 12px', borderRadius: 14, background: 'var(--secondary)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>TIME {team}</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--foreground)' }}>Faixas</span>
      </div>
      {s.length === 0 ? <p style={{ margin: 0, fontSize: 11.5, opacity: 0.55 }}>defina as faixas</p> : s.map((t, i) => (
        <p key={i} data-tier-line={`${team}-${i}`} style={{ margin: '0 0 3px', fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)', wordBreak: 'break-word' }}>🎯 {fmtBRL(t.target)} <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>→</span> 🎁 {t.prize}</p>
      ))}
    </div>
  )
}
