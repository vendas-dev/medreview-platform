'use client'
import { motion } from 'framer-motion'
import { CampaignDraft, criterionInfo, Team, TEAMS, THEMES } from '@/lib/campaigns/types'
import { diffDays, durationDays, fmtDM, howToWin, launchMessage, metricText, phaseOf, prizeFor, validateDraft } from '@/lib/campaigns/engine'
import { fmtBRL } from '@/lib/telao/format'
import { NotificationCard } from '@/components/notifications/NotificationBell'

// ══ Prévia da campanha — o que o superadmin vê enquanto preenche (e nos cards da lista) ══

export interface PreviewTeam { team: Team; winners: number; top: { name: string; rank: number; metric: number; count: number; revenue: number; progress: number; qualified: boolean }[] }
export interface PreviewData { errors: string[]; phase: string; participants: { OAO: number; R1: number }; teams: PreviewTeam[] }

const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅']
const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** "Começa em 3 dias" · "Em andamento — termina em 2 dias" · "Último dia!" · "Encerrada" */
export function phaseLabel(d: Pick<CampaignDraft, 'starts_on' | 'ends_on'>, today: string): { text: string; color: string } {
  const ph = phaseOf(d, today)
  if (ph === 'scheduled') { const n = diffDays(today, d.starts_on); return { text: n === 1 ? 'Começa amanhã' : `Começa em ${n} dias`, color: '#f59e0b' } }
  if (ph === 'ended') return { text: 'Encerrada', color: '#94a3b8' }
  const left = diffDays(today, d.ends_on)
  return { text: left === 0 ? 'Último dia!' : `Em andamento · termina em ${pl(left, 'dia', 'dias')}`, color: '#22c55e' }
}

const chip = (bg = 'rgba(255,255,255,.18)'): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: bg, color: '#fff', fontSize: 11, fontWeight: 700, backdropFilter: 'blur(6px)', whiteSpace: 'nowrap' })

/** O banner (também é o topo dos cards da lista). No card (compact) tem altura mínima fixa e só data + situação, pra todos ficarem iguais. */
export function CampaignBanner({ d, today, compact = false }: { d: CampaignDraft; today: string; compact?: boolean }) {
  const th = THEMES[d.theme] ?? THEMES.roxo, info = criterionInfo(d.criterion), ph = phaseLabel(d, today), days = durationDays(d)
  const hasName = d.name.trim().length > 0
  return (
    <div data-banner style={{ position: 'relative', overflow: 'hidden', padding: compact ? '18px 20px' : '22px 24px 20px', background: `linear-gradient(135deg, ${th.from}, ${th.to})`, color: '#fff', ...(compact ? { minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 } : {}) }}>
      <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.14)', filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(0,0,0,.14)' }} />
      <motion.span key={d.emoji} initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        style={{ position: 'absolute', top: compact ? 14 : 14, right: compact ? 18 : 20, fontSize: compact ? 38 : 56, filter: `drop-shadow(0 6px 14px ${th.glow})` }}>{d.emoji}</motion.span>
      <div style={{ position: 'relative' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '.22em', opacity: 0.85 }}>CAMPANHA</p>
        <h3 data-title style={{ margin: '5px 0 0', fontSize: compact ? 22 : 31, lineHeight: 1.1, fontWeight: 900, letterSpacing: '.05em', textTransform: 'uppercase', textShadow: `0 3px 18px ${th.glow}`, paddingRight: compact ? 56 : 74, opacity: hasName ? 1 : 0.5, wordBreak: 'break-word' }}>
          {hasName ? d.name.trim() : 'Nome da campanha'}
        </h3>
        {d.subtitle.trim() && <p style={{ margin: '6px 0 0', fontSize: 12.5, opacity: 0.92, paddingRight: 60 }}>{d.subtitle.trim()}</p>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: compact ? 0 : 14, position: 'relative' }}>
        <span data-chip="datas" style={chip()}>📅 {days > 0 ? `${fmtDM(d.starts_on)}${d.starts_on === d.ends_on ? '' : ` → ${fmtDM(d.ends_on)}`} · ${pl(days, 'dia', 'dias')}` : 'Defina as datas'}</span>
        {days > 0 && <span data-chip="fase" style={{ ...chip('rgba(0,0,0,.28)') }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: ph.color, boxShadow: `0 0 8px ${ph.color}` }} />{ph.text}</span>}
        {!compact && <span data-chip="criterio" style={chip()}>{info.icon} {info.label}</span>}
      </div>
    </div>
  )
}

function TeamBlock({ d, team }: { d: CampaignDraft; team: Team }) {
  const r = d.teams[team]!, info = criterionInfo(d.criterion), n = r.winners > 0 ? r.winners : 0
  return (
    <div data-team-block={team} style={{ flex: 1, minWidth: 150, padding: '10px 12px', borderRadius: 14, background: 'var(--secondary)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>TIME {team}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--foreground)' }}>{n === 1 ? '1º lugar' : `Top ${n || '—'}`}</span>
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', fontSize: 19, minHeight: 24 }}>
        {Array.from({ length: Math.min(n, 5) }, (_, i) => <span key={i}>{MEDALS[i]}</span>)}
        {n > 5 && <span style={{ fontSize: 12, fontWeight: 800, alignSelf: 'center', color: 'var(--muted-foreground)' }}>+{n - 5}</span>}
      </div>
      {info.needsTarget && <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>🎯 bater {r.target && r.target > 0 ? (info.unit === 'money' ? fmtBRL(r.target) : `${r.target} ${r.target === 1 ? 'venda' : 'vendas'}`) : <span style={{ opacity: 0.55 }}>defina o alvo</span>}</p>}
    </div>
  )
}

function Standings({ d, live, loading, today }: { d: CampaignDraft; live: PreviewData | null; loading: boolean; today: string }) {
  const info = criterionInfo(d.criterion), ph = phaseOf(d, today)
  if (durationDays(d) === 0) return null
  return (
    <div data-live style={{ marginTop: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>📊 {ph === 'ended' ? 'COMO FICOU' : 'QUEM LIDERA HOJE'}</p>
      {ph === 'scheduled' ? <p data-live-empty style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>A campanha ainda não começou — o ranking aparece a partir de {fmtDM(d.starts_on)}.</p>
        : !live ? <div style={{ height: 70, borderRadius: 12, background: 'var(--secondary)', opacity: loading ? 0.6 : 0.3 }} />
        : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
            {live.teams.map(t => {
              const rows = t.top.filter(r => (info.race ? r.progress > 0 : r.metric > 0)), max = Math.max(...rows.map(r => (info.race ? 1 : r.metric)), 1)
              return (
                <div key={t.team} data-live-team={t.team} style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: 'var(--foreground)' }}>Time {t.team}</p>
                  {rows.length === 0 ? <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-foreground)' }}>Ainda sem vendas no período.</p> : rows.map(r => {
                    const inMoney = r.rank <= t.winners && (!info.race || r.qualified)
                    return (
                      <div key={r.rank + r.name} data-live-row={r.name} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', marginBottom: 4, borderRadius: 10, background: inMoney ? 'rgba(34,197,94,.1)' : 'var(--secondary)', border: inMoney ? '1px solid rgba(34,197,94,.35)' : '1px solid transparent' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${((info.race ? r.progress : r.metric / max) * 100)}%` }} transition={{ duration: 0.6 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: inMoney ? 'rgba(34,197,94,.14)' : 'rgba(99,102,241,.1)' }} />
                        <span style={{ position: 'relative', width: 22, fontSize: 13, textAlign: 'center' }}>{r.rank <= 3 ? MEDALS[r.rank - 1] : `${r.rank}º`}</span>
                        <span style={{ position: 'relative', flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                        <span style={{ position: 'relative', fontSize: 11.5, fontWeight: 800, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{info.race ? (r.qualified ? '✅ bateu' : `${Math.round(r.progress * 100)}%`) : metricText(d.criterion, r.metric)}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

export function CampaignPreview({ d, today, eligible, live, liveLoading = false }: { d: CampaignDraft; today: string; eligible: { OAO: number; R1: number }; live: PreviewData | null; liveLoading?: boolean }) {
  const teams = TEAMS.filter(t => d.teams[t]), pt = live?.participants ?? eligible
  const total = teams.reduce((a, t) => a + pt[t], 0)
  const rule = teams.length > 0 && durationDays(d) > 0 && (!criterionInfo(d.criterion).needsTarget || teams.every(t => (d.teams[t]!.target ?? 0) > 0))
  const msgReady = d.name.trim() && rule && validateDraft(d, true).length === 0      // (a validação já exige o prêmio, único ou por posição)
  return (
    <div data-preview style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,.14)' }}>
      <CampaignBanner d={d} today={today} />
      <div style={{ padding: '16px 20px 20px' }}>
        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>COMO GANHAR</p>
        <p data-howto style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--foreground)', fontWeight: 600 }}>{rule ? howToWin(d) : <span style={{ opacity: 0.55, fontWeight: 500 }}>Escolha o critério, os times e as datas para ver a regra aqui.</span>}</p>
        {teams.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>{teams.map(t => <TeamBlock key={t} d={d} team={t} />)}</div>}

        {d.prize_mode === 'tiered' ? (
          <div data-prize="tiered" style={{ marginTop: 14, padding: '11px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(245,158,11,.16), rgba(234,88,12,.12))', border: '1px solid rgba(245,158,11,.4)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 9.5, fontWeight: 900, letterSpacing: '.14em', color: '#d97706' }}>🎁 PREMIAÇÃO POR POSIÇÃO</p>
            {teams.length === 0 ? <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>Escolha os times para definir os prêmios.</p> : (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {teams.map(t => (
                  <div key={t} data-prize-list={t} style={{ flex: 1, minWidth: 170 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, letterSpacing: '.1em', color: 'var(--muted-foreground)' }}>TIME {t}</p>
                    {Array.from({ length: Math.max(0, Math.min(d.teams[t]!.winners || 0, 50)) }, (_, i) => {
                      const p = prizeFor(d, t, i + 1)
                      return <p key={i} data-prize-line={`${t}-${i + 1}`} style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 800, color: 'var(--foreground)', wordBreak: 'break-word' }}><span style={{ display: 'inline-block', width: 26 }}>{i < 3 ? MEDALS[i] : `${i + 1}º`}</span>{p || <span style={{ opacity: 0.45, fontWeight: 600 }}>defina o prêmio</span>}</p>
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div data-prize="single" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(245,158,11,.16), rgba(234,88,12,.12))', border: '1px solid rgba(245,158,11,.4)' }}>
          <span style={{ fontSize: 26 }}>🎁</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 9.5, fontWeight: 900, letterSpacing: '.14em', color: '#d97706' }}>PRÊMIO</p>
            <p style={{ margin: '1px 0 0', fontSize: 16, fontWeight: 900, color: 'var(--foreground)', wordBreak: 'break-word' }}>{d.prize.trim() || <span style={{ opacity: 0.45, fontWeight: 600 }}>Qual será o prêmio?</span>}</p>
          </div>
        </div>
        )}

        <p data-participants style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
          👥 <strong style={{ color: 'var(--foreground)' }}>{pl(total, 'pessoa concorre', 'pessoas concorrem')}</strong>{teams.length > 1 ? ` · ${teams.map(t => `${t} ${pt[t]}`).join(' · ')}` : ''}
          {d.count_recurring ? ' · parcelas de recorrência contam' : ''}
        </p>

        <Standings d={d} live={live} loading={liveLoading} today={today} />

        {d.notify && msgReady ? (
          <div data-notif-preview style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>🔔 COMO O AVISO CHEGA PRA EQUIPE</p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}><NotificationCard n={{ ...launchMessage(d), kind: 'campanha', created_at: new Date().toISOString() }} /></div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
