'use client'
import { Copy, Plus, X } from 'lucide-react'
import { Team, Tier } from '@/lib/campaigns/types'
import { Btn } from './ui'

// ══ Editor das faixas de valor de UM time: cada linha é "quem atingir R$ X ganha o prêmio P" ═══════════
// Sem limite de ganhadores; quem passa de mais de uma faixa ganha SÓ a mais alta. A ordem digitada não importa (o sistema ordena por valor);
// as linhas NUNCA mudam de lugar sozinhas (isso fazia o prêmio ir para a linha errada ao dar Tab) — só pelo botão "Ordenar por valor".
const byTarget = (a: Tier, b: Tier) => (a.target ?? Infinity) - (b.target ?? Infinity)

export function TierEditor({ team, tiers, onChange, copyFrom }: { team: Team; tiers: Tier[]; onChange: (t: Tier[]) => void; copyFrom?: { team: Team; tiers: Tier[] } | null }) {
  const set = (i: number, p: Partial<Tier>) => onChange(tiers.map((t, k) => (k === i ? { ...t, ...p } : t)))
  const unsorted = tiers.length > 1 && tiers.every(t => t.target !== null) && tiers.some((t, k) => k > 0 && (t.target as number) < (tiers[k - 1].target as number))
  const dup = (i: number) => tiers[i].target !== null && tiers.some((t, k) => k !== i && t.target === tiers[i].target)
  return (
    <div data-tier-editor={team} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '.04em', color: 'var(--foreground)' }}>Faixas de valor <span style={{ fontWeight: 500, color: 'var(--muted-foreground)' }}>· {tiers.length} {tiers.length === 1 ? 'faixa' : 'faixas'}</span></span>
        {copyFrom && copyFrom.tiers.length > 0 && <Btn size="sm" data-tier-copy={`${copyFrom.team}-${team}`} onClick={() => onChange(copyFrom.tiers.map(t => ({ ...t })))}><Copy size={13} />Copiar do {copyFrom.team}</Btn>}
      </div>
      {tiers.map((t, i) => (
        <div key={i} data-tier-row={`${team}-${i}`} style={{ display: 'grid', gridTemplateColumns: '28px minmax(110px,1fr) minmax(130px,1.4fr) 36px', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', textAlign: 'center' }}>{i + 1}ª</span>
          <input className="cp-field" data-tier-target={`${team}-${i}`} type="number" min={1} step="0.01" inputMode="decimal" aria-label={`Valor da faixa ${i + 1} (R$)`} placeholder="R$ valor" value={t.target ?? ''}
            style={dup(i) ? { borderColor: '#ef4444' } : undefined}
            onChange={e => set(i, { target: e.target.value === '' ? null : Number(e.target.value) })} />
          <input className="cp-field" data-tier-prize={`${team}-${i}`} aria-label={`Prêmio da faixa ${i + 1}`} placeholder="Prêmio (ex.: R$ 100)" maxLength={120} value={t.prize} onChange={e => set(i, { prize: e.target.value })} />
          <button type="button" className="cp-ib" data-tier-del={`${team}-${i}`} aria-label={`Remover faixa ${i + 1}`} disabled={tiers.length <= 1} onClick={() => onChange(tiers.filter((_, k) => k !== i))} style={{ width: 36, height: 36 }}><X size={14} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn size="sm" data-tier-add={team} disabled={tiers.length >= 10} onClick={() => onChange([...tiers, { target: null, prize: '' }])}><Plus size={13} />Adicionar faixa</Btn>
        {unsorted && <Btn size="sm" data-tier-sort={team} onClick={() => onChange([...tiers].sort(byTarget))}>Ordenar por valor</Btn>}
        <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--muted-foreground)', flex: 1, minWidth: 200 }}>Quem atingir uma faixa ganha o prêmio dela; quem passar de mais de uma ganha só a mais alta. Sem limite de ganhadores.</span>
      </div>
    </div>
  )
}
