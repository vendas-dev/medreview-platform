'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { THEMES, ThemeId } from '@/lib/campaigns/types'

// ══ Popup central dos vencedores ═════════════════════════════════════════════
// Abre ao clicar num aviso de campanha. Mostra SÓ quem ganhou e o prêmio — nunca valores de venda.
// O servidor já devolve só o time da pessoa (OAO vê OAO, R1 vê R1; superadmin vê os times da campanha).

interface Position { position: number; prize: string | null; winner: { name: string; me: boolean } | null; state: 'winner' | 'pending' | 'empty' }
interface View {
  campaign: { id: string; name: string; subtitle: string; emoji: string; theme: ThemeId; state: 'scheduled' | 'active' | 'counting' | 'finished' | 'cancelled'; prize_mode: 'single' | 'tiered'; prize_single: string | null }
  viewer: { team: string | null; admin: boolean }; teams: { team: string; positions: Position[] }[]
}
const MEDALS = ['🥇', '🥈', '🥉']
const STATE: Record<View['campaign']['state'], { label: string; color: string }> = {
  scheduled: { label: 'Começa em breve', color: '#f59e0b' }, active: { label: 'Em andamento', color: '#22c55e' },
  counting: { label: 'Apurando o resultado', color: '#6366f1' }, finished: { label: 'Encerrada', color: '#94a3b8' }, cancelled: { label: 'Cancelada', color: '#ef4444' },
}

export function WinnersModal({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [v, setV] = useState<View | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let off = false
    fetch(`/api/campaigns/${campaignId}/winners`, { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (off) return; if (r.ok) setV(j); else setErr(j?.error ?? 'Não consegui abrir esta campanha.') })
      .catch(() => { if (!off) setErr('Sem conexão. Tente de novo.') })
    return () => { off = true }
  }, [campaignId])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const th = v ? THEMES[v.campaign.theme] ?? THEMES.roxo : THEMES.roxo
  const st = v ? STATE[v.campaign.state] : null
  const iWon = !!v?.teams.some(t => t.positions.some(p => p.winner?.me))
  const decided = !!v?.teams.some(t => t.positions.some(p => p.winner))
  const tiered = v?.campaign.prize_mode === 'tiered'

  if (typeof document === 'undefined') return null
  return createPortal(
    <div data-winners-modal onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Vencedores da campanha"
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(8,6,20,.66)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        style={{ width: 'min(480px, 100%)', maxHeight: 'min(88vh, 720px)', overflowY: 'auto', borderRadius: 24, background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 30px 90px rgba(0,0,0,.5)' }}>
        <div data-wm-banner style={{ position: 'relative', overflow: 'hidden', padding: '24px 24px 20px', color: '#fff', background: `linear-gradient(135deg, ${th.from}, ${th.to})` }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 190, height: 190, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
          <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,.3)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><X size={15} /></button>
          {v ? (<>
            <motion.div initial={{ scale: 0.3, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 12, delay: 0.1 }} style={{ fontSize: 46, lineHeight: 1, filter: `drop-shadow(0 6px 14px ${th.glow})` }}>{decided && v.campaign.state === 'finished' ? '🏆' : v.campaign.emoji}</motion.div>
            <p style={{ margin: '10px 0 0', fontSize: 10, fontWeight: 800, letterSpacing: '.22em', opacity: 0.85 }}>CAMPANHA</p>
            <h3 data-wm-title style={{ margin: '3px 0 0', fontSize: 25, lineHeight: 1.1, fontWeight: 900, letterSpacing: '.05em', textTransform: 'uppercase', textShadow: `0 3px 18px ${th.glow}`, wordBreak: 'break-word', paddingRight: 30 }}>{v.campaign.name}</h3>
            {st && <span data-wm-state style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '4px 11px', borderRadius: 999, background: 'rgba(0,0,0,.28)', fontSize: 11, fontWeight: 700 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, boxShadow: `0 0 8px ${st.color}` }} />{st.label}</span>}
          </>) : <div style={{ height: 120 }} />}
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {!v && !err && <div data-wm-loading style={{ height: 110, borderRadius: 14, background: 'var(--secondary)', opacity: 0.6 }} />}
          {err && <p data-wm-error style={{ margin: '14px 0', textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--muted-foreground)' }}>{err}</p>}
          {v && (<>
            {iWon && <motion.div data-wm-congrats initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 14, textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#16a34a', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.4)' }}>🎉 Parabéns, você ganhou!</motion.div>}
            {v.campaign.state === 'cancelled' ? <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 13.5, color: 'var(--muted-foreground)' }}>Esta campanha foi cancelada pela gestão.</p> : (<>
              <p data-wm-heading style={{ margin: '0 0 10px', fontSize: 10.5, fontWeight: 900, letterSpacing: '.14em', color: 'var(--muted-foreground)' }}>{v.campaign.state === 'finished' ? '🏆 VENCEDORES' : '🎁 PRÊMIOS EM JOGO'}</p>
              {!tiered && v.campaign.prize_single && <div data-wm-prize style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(245,158,11,.16), rgba(234,88,12,.12))', border: '1px solid rgba(245,158,11,.4)', fontSize: 14, fontWeight: 900, color: 'var(--foreground)' }}>🎁 {v.campaign.prize_single}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {v.teams.map(t => (
                  <div key={t.team} data-wm-team={t.team}>
                    {(v.teams.length > 1 || v.viewer.admin) && <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', color: 'var(--foreground)' }}>TIME {t.team}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {t.positions.map((p, i) => (
                        <motion.div key={p.position} data-wm-row={p.state} data-wm-me={p.winner?.me ? '1' : '0'} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.05 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: p.winner?.me ? 'rgba(34,197,94,.13)' : 'var(--secondary)', border: p.winner?.me ? '1px solid rgba(34,197,94,.45)' : '1px solid transparent', opacity: p.state === 'empty' ? 0.55 : 1 }}>
                          <span style={{ width: 28, textAlign: 'center', fontSize: p.position <= 3 ? 20 : 12, fontWeight: 800, color: 'var(--muted-foreground)' }}>{p.position <= 3 ? MEDALS[p.position - 1] : `${p.position}º`}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: p.winner ? 800 : 600, color: p.winner ? 'var(--foreground)' : 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.winner ? <>{p.winner.name}{p.winner.me && <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 800 }}>VOCÊ</span>}</> : p.state === 'empty' ? 'Sem ganhador' : 'Aguardando…'}
                          </span>
                          {tiered && p.prize && <span data-wm-pos-prize style={{ fontSize: 12, fontWeight: 800, color: '#d97706', textAlign: 'right', maxWidth: '45%' }}>🎁 {p.prize}</span>}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {v.campaign.state !== 'finished' && <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--muted-foreground)', textAlign: 'center' }}>{v.campaign.state === 'counting' ? 'O resultado está sendo apurado.' : 'Os vencedores aparecem aqui assim que forem definidos.'}</p>}
            </>)}
          </>)}
          <button onClick={onClose} data-wm-close style={{ width: '100%', marginTop: 18, height: 42, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--foreground)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
        </div>
      </motion.div>
    </div>, document.body)
}
