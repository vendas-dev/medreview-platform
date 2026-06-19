'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Settings, RefreshCw, SlidersHorizontal, X, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import { useLiveData, LiveDataProvider } from '@/hooks/useLiveData'
import { VERTICALS, VERTICAL_LIST, GOLD, VerticalId, FilterState, EMPTY_FILTER, Closer, TelaoEvent, CloserStats } from '@/lib/telao/types'
import { computeCloserStats, computeHourBuckets, fmtBRL, todayKey, monthKey, initials, timeAgo } from '@/lib/telao/format'
import { MascotR1, MascotAnest, MascotOft, MascotOrtop, initAudio, playSaleSound, playCertSound, playGoalSound } from '@/lib/telao/assets'

// ── Design tokens roxo ────────────────────────────────────────
const T = {
  bg:         '#0d0015',
  bgCard:     'rgba(139,92,246,0.05)',
  bgCardHov:  'rgba(139,92,246,0.09)',
  border:     'rgba(139,92,246,0.15)',
  borderBrig: 'rgba(139,92,246,0.35)',
  purple1:    '#7c3aed',
  purple2:    '#a855f7',
  purple3:    '#c4b5fd',
  purple4:    '#ede9fe',
  muted:      '#6b21a8',
  mutedText:  '#7e5bab',
  dimText:    '#4a2d6b',
}

const card = (glow = false): React.CSSProperties => ({
  background: T.bgCard,
  border: `1px solid ${glow ? T.borderBrig : T.border}`,
  borderRadius: 16,
  boxShadow: glow ? `0 0 24px rgba(139,92,246,0.12)` : 'none',
})

const sectionLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: T.dimText, textTransform: 'uppercase',
  letterSpacing: '0.1em', fontFamily: "'JetBrains Mono',monospace",
  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
}

// ── Mascote por vertical ──────────────────────────────────────
function VertMascot({ id, size = 40 }: { id: VerticalId | null; size?: number }) {
  if (id === 'medreview')   return <MascotR1    size={size} />
  if (id === 'anestreview') return <MascotAnest size={size} />
  if (id === 'oftreview')   return <MascotOft   size={size} />
  if (id === 'ortopreview') return <MascotOrtop size={size} />
  return <span style={{ fontSize: size * 0.5 }}>⭐</span>
}

// ── Avatar de closer ──────────────────────────────────────────
function CloserAvatar({ closer, name, size = 36, rank }: { closer: Closer | null; name: string; size?: number; rank?: number }) {
  const color  = closer?.color ?? T.purple1
  const halos  = ['#FFD700', '#C0C0C0', '#CD7F32']
  const halo   = rank !== undefined && rank < 3 ? halos[rank] : null
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${color}, ${color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 900, color: '#fff', fontFamily: "'Space Grotesk',sans-serif", border: halo ? `2px solid ${halo}` : `1.5px solid ${color}55`, boxShadow: halo ? `0 0 ${size/1.5}px ${halo}55` : `0 0 ${size/3}px ${color}44` }}>
        {initials(name)}
      </div>
      {halo && rank !== undefined && (
        <span style={{ position: 'absolute', top: -4, right: -4, fontSize: Math.max(10, size * 0.28) }}>
          {['🥇','🥈','🥉'][rank]}
        </span>
      )}
    </div>
  )
}

// ── Relógio ───────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('')
  const [d, setD] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setT(n.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setD(n.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
    }
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div suppressHydrationWarning>
      <p style={{ fontSize: 20, fontWeight: 900, color: T.purple3, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.06em' }}>{t}</p>
      <p style={{ fontSize: 10, color: T.dimText, margin: 0, fontFamily: "'Space Grotesk',sans-serif", textTransform: 'capitalize' }}>{d}</p>
    </div>
  )
}

// ── MetricsCard ───────────────────────────────────────────────
function MetricsCard({ events, accent, label }: { events: TelaoEvent[]; accent: string; label: string }) {
  const sales   = events.filter(e => e.event_type === 'sale')
  const certs   = events.filter(e => e.event_type === 'ambassador_certified')
  const revenue = sales.reduce((s, e) => s + (e.value ?? 0), 0)

  return (
    <div style={{ ...card(true), display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', overflow: 'hidden' }}>
      {[
        { label: `Fat. ${label}`, value: fmtBRL(revenue), color: accent, big: true },
        { label: 'Vendas',        value: String(sales.length), color: T.purple3, big: false },
        { label: 'Embaixadores ★', value: String(certs.length), color: GOLD, big: false },
      ].map((item, i) => (
        <div key={i} style={{ padding: '16px 20px', borderRight: i < 2 ? `1px solid ${T.border}` : 'none' }}>
          <p style={{ ...sectionLabel, marginBottom: 8 }}>{item.label}</p>
          <p style={{ fontSize: item.big ? 28 : 24, fontWeight: 900, color: item.color, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '-0.02em', lineHeight: 1 }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── GoalBar ───────────────────────────────────────────────────
function GoalBar({ period, periodKey, vertical, current, goals, accent, totalLabel, totalValue }: {
  period: 'day'|'month'; periodKey: string; vertical: string|null
  current: number; goals: any[]; accent: string; totalLabel?: string; totalValue?: number
}) {
  const goal   = goals.find(g => g.period === period && g.period_key === periodKey && g.vertical === vertical)
  const target = goal?.target_value ?? 0
  const pct    = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const done   = pct >= 100

  return (
    <div style={{ ...card(), padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 800, color: T.dimText, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono',monospace" }}>
            {period === 'day' ? 'Meta do Dia' : 'Meta do Mês'}
          </span>
          {totalLabel && totalValue !== undefined && (
            <span style={{ fontSize: 9, color: T.dimText, marginLeft: 6, fontFamily: "'JetBrains Mono',monospace" }}>
              {totalLabel}: {fmtBRL(totalValue)}
            </span>
          )}
        </div>
        <span style={{ fontSize: 16, fontWeight: 900, color: done ? '#22c55e' : accent, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk',sans-serif" }}>
          {fmtBRL(current)}
          {target > 0 && <span style={{ fontSize: 11, color: T.dimText, fontWeight: 500 }}> / {fmtBRL(target)}</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(139,92,246,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 999, background: done ? 'linear-gradient(90deg,#22c55e,#16a34a)' : `linear-gradient(90deg,${accent}88,${accent})`, boxShadow: `0 0 10px ${done ? '#22c55e66' : accent + '55'}` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: done ? '#22c55e' : T.mutedText, fontFamily: "'JetBrains Mono',monospace", fontWeight: done ? 800 : 400 }}>
          {done ? '✅ META BATIDA!' : target > 0 ? `${pct.toFixed(0)}% da meta` : '— sem meta definida'}
        </span>
        {target > 0 && !done && (
          <span style={{ fontSize: 10, color: T.dimText, fontFamily: "'JetBrains Mono',monospace" }}>
            faltam {fmtBRL(target - current)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── EventFeed ─────────────────────────────────────────────────
function EventFeed({ events, closers }: { events: TelaoEvent[]; closers: Closer[] }) {
  const byId = Object.fromEntries(closers.map(c => [c.id, c]))
  const shown = events.slice(0, 15)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, paddingRight: 2 }}>
      <AnimatePresence initial={false}>
        {shown.map(ev => {
          const closer = ev.closer_id ? byId[ev.closer_id] : null
          const name   = ev.is_self_checkout ? 'Self Checkout' : (closer?.name ?? ev.closer_name ?? '?')
          const vert   = VERTICALS[ev.vertical]
          const isSale = ev.event_type === 'sale'
          return (
            <motion.div key={ev.id}
              initial={{ opacity: 0, x: 24, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{ background: 'rgba(139,92,246,0.04)', border: `1px solid ${T.border}`, borderLeft: `3px solid ${vert.accent}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <CloserAvatar closer={closer} name={name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: vert.accent + '22', color: vert.accent, fontFamily: "'JetBrains Mono',monospace" }}>{vert.short}</span>
                  <span style={{ fontSize: 9, color: T.dimText, fontFamily: "'JetBrains Mono',monospace" }}>{isSale ? '💰' : '🎓'}</span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.purple4, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isSale ? ev.lead_name : ev.ambassador_name}
                </p>
                <p style={{ fontSize: 10, color: T.mutedText, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono',monospace" }}>
                  {name.split(' ')[0]} · {timeAgo(ev.occurred_at)}
                </p>
              </div>
              {isSale && ev.value && (
                <span style={{ fontSize: 13, fontWeight: 900, color: vert.accent, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0 }}>
                  {fmtBRL(ev.value)}
                </span>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
      {shown.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: T.dimText }}>
          <p style={{ fontSize: 28 }}>⚡</p>
          <p style={{ fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>Aguardando eventos...</p>
        </div>
      )}
    </div>
  )
}

// ── Ranking ───────────────────────────────────────────────────
function Ranking({ stats, accent }: { stats: CloserStats[]; accent: string }) {
  const max = stats[0]?.revenue ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
      {stats.slice(0, 8).map((s, i) => {
        const pct    = max > 0 ? (s.revenue / max) * 100 : 0
        const isTop3 = i < 3
        const halos  = ['#FFD700','#C0C0C0','#CD7F32']
        return (
          <motion.div key={s.closer?.id ?? s.name}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 220, damping: 20 }}
            style={{ ...card(isTop3), padding: '10px 14px', position: 'relative', overflow: 'hidden' }}>
            {/* Barra de fundo */}
            <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: isTop3 ? `${halos[i]}08` : 'rgba(139,92,246,0.04)', borderRadius: 16 }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: isTop3 ? 18 : 12, width: 24, textAlign: 'center', fontWeight: 900, color: isTop3 ? halos[i] : T.dimText, fontFamily: isTop3 ? 'inherit' : "'JetBrains Mono',monospace", flexShrink: 0 }}>
                {isTop3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
              </span>
              <CloserAvatar closer={s.closer} name={s.name} size={isTop3 ? 38 : 30} rank={i} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: isTop3 ? 14 : 12, fontWeight: 800, color: isTop3 ? T.purple4 : T.purple3, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk',sans-serif" }}>
                  {s.name}
                </p>
                <p style={{ fontSize: 10, color: T.dimText, margin: 0, fontFamily: "'JetBrains Mono',monospace" }}>
                  {s.sales}v {s.certs > 0 ? `· ${s.certs}★` : ''}
                </p>
              </div>
              <span style={{ fontSize: isTop3 ? 16 : 13, fontWeight: 900, color: isTop3 ? accent : T.mutedText, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0 }}>
                {fmtBRL(s.revenue)}
              </span>
            </div>
          </motion.div>
        )
      })}
      {stats.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: T.dimText }}>
          <p style={{ fontSize: 22 }}>🏆</p>
          <p style={{ fontSize: 11, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>Sem dados ainda</p>
        </div>
      )}
    </div>
  )
}

// ── HourlyChart ───────────────────────────────────────────────
function HourlyChart({ events, closers, accent }: { events: TelaoEvent[]; closers: Closer[]; accent: string }) {
  const byId    = Object.fromEntries(closers.map(c => [c.id, c]))
  const buckets = computeHourBuckets(events, byId)
  const max     = Math.max(...buckets.map(b => b.topRevenue), 1)

  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
      {buckets.map((b, i) => {
        const pct     = (b.topRevenue / max) * 100
        const isEmpty = b.total === 0
        const isNow   = i === buckets.length - 1

        return (
          <div key={b.hourIso} style={{ flexShrink: 0, width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ ...card(isNow), width: '100%', minHeight: 70, padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: isEmpty ? 0.3 : 1, boxShadow: isNow ? `0 0 16px rgba(139,92,246,0.2)` : 'none' }}>
              {!isEmpty && b.topCloser ? (
                <>
                  <CloserAvatar closer={b.topCloser} name={b.topName} size={24} rank={0} />
                  <p style={{ fontSize: 8, color: T.purple3, fontWeight: 700, margin: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', padding: '0 4px', fontFamily: "'Space Grotesk',sans-serif" }}>
                    {b.topName.split(' ')[0]}
                  </p>
                  <p style={{ fontSize: 8, color: accent, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtBRL(b.topRevenue)}
                  </p>
                  <span style={{ fontSize: 8, color: T.dimText, fontFamily: "'JetBrains Mono',monospace" }}>{b.total}v</span>
                </>
              ) : <span style={{ fontSize: 16, color: T.dimText }}>—</span>}
            </div>
            {/* Barra */}
            <div style={{ height: 32, width: '70%', background: 'rgba(139,92,246,0.08)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${pct}%`, background: isEmpty ? 'rgba(139,92,246,0.1)' : `linear-gradient(0deg,${accent}cc,${accent}44)`, borderRadius: 4, transition: 'height 0.5s ease' }} />
            </div>
            <span style={{ fontSize: 9, color: isNow ? accent : T.dimText, fontFamily: "'JetBrains Mono',monospace", fontWeight: isNow ? 800 : 400 }}>
              {b.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Ticker ────────────────────────────────────────────────────
function Ticker({ events }: { events: TelaoEvent[] }) {
  const sales = events.filter(e => e.event_type === 'sale' && e.value).slice(0, 20)
  if (sales.length === 0) return null
  const items = [...sales, ...sales]
  return (
    <div style={{ background: 'rgba(139,92,246,0.06)', borderTop: `1px solid ${T.border}`, overflow: 'hidden', height: 28, display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', animation: 'ticker 35s linear infinite', whiteSpace: 'nowrap' }}>
        {items.map((ev, i) => {
          const v = VERTICALS[ev.vertical]
          return (
            <span key={`${ev.id}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 18px', borderRight: `1px solid ${T.border}`, fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
              <span style={{ color: v.accent, fontWeight: 700 }}>{v.short}</span>
              <span style={{ color: T.mutedText }}>{ev.lead_name}</span>
              <span style={{ color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtBRL(ev.value!)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Confete ───────────────────────────────────────────────────
function Confete({ color }: { color: string }) {
  const particles = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      x: Math.random() * 100, y: -10 - Math.random() * 20,
      size: Math.random() * 8 + 4,
      color: [color, T.purple2, GOLD, '#c4b5fd', '#fff'][i % 5],
      delay: Math.random() * 2, dur: 2 + Math.random() * 2,
      drift: (Math.random() - 0.5) * 30,
    })), [color])
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 999 }}>
      {particles.map((p, i) => (
        <motion.div key={i}
          initial={{ x: `${p.x}vw`, y: `${p.y}vh`, rotate: 0, opacity: 1 }}
          animate={{ x: `${p.x + p.drift}vw`, y: '110vh', rotate: 360 * 3, opacity: 0 }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'linear' }}
          style={{ position: 'absolute', width: p.size, height: p.size, background: p.color, borderRadius: 2 }} />
      ))}
    </div>
  )
}

// ── Celebration overlay ───────────────────────────────────────
function CelebrationOverlay({ ev, closer, onDone }: { ev: TelaoEvent; closer: Closer | null; onDone: () => void }) {
  const [count, setCount] = useState(0)
  const vert  = VERTICALS[ev.vertical]
  const isSale = ev.event_type === 'sale'
  const target = ev.value ?? 0
  const name   = ev.is_self_checkout ? 'Self Checkout' : (closer?.name ?? ev.closer_name ?? '?')

  useEffect(() => {
    if (isSale) {
      playSaleSound()
      let v = 0; const step = target / 60
      const id = setInterval(() => { v = Math.min(v + step, target); setCount(Math.floor(v)); if (v >= target) clearInterval(id) }, 16)
      const t = setTimeout(onDone, 6500); return () => { clearInterval(id); clearTimeout(t) }
    } else {
      playCertSound()
      const t = setTimeout(onDone, 6000); return () => clearTimeout(t)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at center, ${vert.accent}18 0%, rgba(13,0,21,0.95) 65%)`, backdropFilter: 'blur(10px)' }}>
      <Confete color={vert.accent} />
      <motion.div initial={{ scale: 0.7, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        style={{ textAlign: 'center', maxWidth: 560, padding: '0 32px', position: 'relative', zIndex: 1001 }}>

        {/* Mascote */}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
          style={{ margin: '0 auto 20px', filter: `drop-shadow(0 0 30px ${vert.accent}88)` }}>
          <VertMascot id={ev.vertical} size={100} />
        </motion.div>

        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ fontSize: 11, fontWeight: 800, color: vert.accent, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
          {isSale ? '💰 VENDA FECHADA!' : '🎓 EMBAIXADOR CERTIFICADO!'}
        </motion.p>

        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ fontSize: 34, fontWeight: 900, color: T.purple4, marginBottom: 8, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '-0.02em' }}>
          {isSale ? name : ev.ambassador_name}
        </motion.p>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ fontSize: 14, color: T.mutedText, marginBottom: 28, fontFamily: "'Space Grotesk',sans-serif" }}>
          {isSale ? `${ev.lead_name} · ${ev.product}` : `${ev.college}${ev.class ? ` · Turma ${ev.class}` : ''}`}
        </motion.p>

        {isSale && (
          <motion.p initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.4 }}
            style={{ fontSize: 64, fontWeight: 900, color: vert.accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: "'Space Grotesk',sans-serif", textShadow: `0 0 40px ${vert.accent}88` }}>
            {fmtBRL(count)}
          </motion.p>
        )}

        {/* Vertical badge */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '6px 18px', borderRadius: 999, background: vert.accent + '22', border: `1px solid ${vert.accent}44` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: vert.accent, fontFamily: "'JetBrains Mono',monospace" }}>{vert.label}</span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// ── FilterBar simplificado ────────────────────────────────────
function FilterBar({ filter, onChange, closers }: { filter: FilterState; onChange: (f: FilterState) => void; closers: Closer[] }) {
  const [open,  setOpen]  = useState(false)
  const [draft, setDraft] = useState(filter)
  const count = (filter.start ? 1 : 0) + (filter.end ? 1 : 0) + filter.closerKeys.length

  function apply() { onChange(draft); setOpen(false) }
  function clear()  { const e = EMPTY_FILTER; setDraft(e); onChange(e); setOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setDraft(filter); setOpen(o => !o) }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${count > 0 ? T.purple1 + '88' : T.border}`, background: count > 0 ? T.purple1 + '15' : 'rgba(139,92,246,0.03)', color: count > 0 ? T.purple3 : T.mutedText, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif", transition: 'all 0.15s' }}>
        <SlidersHorizontal size={12} /> Filtros
        {count > 0 && <span style={{ background: T.purple1, color: '#fff', fontSize: 9, borderRadius: 999, padding: '1px 5px', fontWeight: 900 }}>{count}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
              style={{ position: 'absolute', top: 38, right: 0, zIndex: 100, width: 300, background: '#110020', border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.purple3 }}>Filtros</span>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: T.dimText, cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {(['start','end'] as const).map(k => (
                  <div key={k}>
                    <label style={{ fontSize: 9, color: T.dimText, display: 'block', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k === 'start' ? 'De' : 'Até'}</label>
                    <input type="date" value={draft[k] ?? ''} onChange={e => setDraft(p => ({ ...p, [k]: e.target.value || null }))}
                      style={{ width: '100%', height: 34, padding: '0 8px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'rgba(139,92,246,0.05)', color: T.purple3, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", outline: 'none', colorScheme: 'dark' }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 9, color: T.dimText, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>Closers</p>
              <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[{ id: 'self', name: '↻ Self Checkout', color: T.mutedText }, ...closers].map(c => {
                  const sel = draft.closerKeys.includes(c.id)
                  return (
                    <label key={c.id} onClick={() => setDraft(p => ({ ...p, closerKeys: sel ? p.closerKeys.filter(k => k !== c.id) : [...p.closerKeys, c.id] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', background: sel ? 'rgba(139,92,246,0.1)' : 'transparent', transition: 'background 0.12s' }}>
                      <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${sel ? T.purple2 : T.border}`, background: sel ? T.purple2 : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: sel ? T.purple3 : T.mutedText }}>{c.name}</span>
                    </label>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={clear} style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.dimText, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>× Limpar</button>
                <button onClick={apply} style={{ flex: 2, height: 32, borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${T.purple1},${T.purple2})`, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Aplicar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── LiveWallInner ─────────────────────────────────────────────
function LiveWallInner({ isAdmin }: { isAdmin: boolean }) {
  const { events, closers, goals, monthRevenue, latest, clearLatest, loading, refetch } = useLiveData()
  const [vf,         setVf]         = useState<VerticalId | null>(null)
  const [filter,     setFilter]     = useState<FilterState>(EMPTY_FILTER)
  const [audioOn,    setAudioOn]    = useState(false)
  const [celebration, setCelebration] = useState<TelaoEvent | null>(null)

  const accent   = vf ? VERTICALS[vf].accent : T.purple2
  const byId     = useMemo(() => Object.fromEntries(closers.map(c => [c.id, c])), [closers])

  const viewEvents = useMemo(() => {
    let evs = events
    if (vf)           evs = evs.filter(e => e.vertical === vf)
    if (filter.start) evs = evs.filter(e => e.occurred_at >= filter.start!)
    if (filter.end)   evs = evs.filter(e => e.occurred_at <= filter.end! + 'T23:59:59')
    if (filter.closerKeys.length > 0) {
      evs = evs.filter(e => e.is_self_checkout
        ? filter.closerKeys.includes('self')
        : filter.closerKeys.includes(e.closer_id ?? ''))
    }
    return evs
  }, [events, vf, filter])

  const stats      = useMemo(() => computeCloserStats(viewEvents, closers), [viewEvents, closers])
  const todayRev   = useMemo(() => viewEvents.filter(e => e.event_type === 'sale').reduce((s, e) => s + (e.value ?? 0), 0), [viewEvents])
  const monthRev   = vf ? (monthRevenue.byVertical[vf] ?? 0) : monthRevenue.overall

  // Streak
  const streak = viewEvents.filter(e => Date.now() - new Date(e.occurred_at).getTime() < 90000).length

  // Celebration trigger
  useEffect(() => {
    if (!latest) return
    if (vf && latest.vertical !== vf) { clearLatest(); return }
    setCelebration(latest)
    clearLatest()
  }, [latest])

  function toggleAudio() {
    if (!audioOn) { initAudio(); setAudioOn(true) } else setAudioOn(false)
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: '#fff', fontFamily: "'Space Grotesk',sans-serif", position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 999px; }
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes spin    { to   { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Grid pattern roxo */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `radial-gradient(circle, ${T.purple1}18 1px, transparent 1px)`, backgroundSize: '36px 36px', pointerEvents: 'none', zIndex: 0 }} />
      {/* Glow de fundo */}
      <div style={{ position: 'fixed', top: '-20%', left: '30%', width: '40%', height: '40%', background: `radial-gradient(ellipse, ${T.purple1}18 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,0,21,0.94)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`, padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8 }}>
          {/* Status + Mascote */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 900, color: accent, letterSpacing: '0.12em', fontFamily: "'JetBrains Mono',monospace", transition: 'color 0.3s' }}>
              {vf ? VERTICALS[vf].short : 'GERAL'}
            </span>
            <div style={{ opacity: 0.8 }}><VertMascot id={vf} size={26} /></div>
            <span style={{ fontSize: 9, color: T.dimText, fontFamily: "'JetBrains Mono',monospace" }}>LIVE WALL</span>
          </div>

          {/* Chips de vertical */}
          <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
            <button onClick={() => setVf(null)}
              style={{ height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${!vf ? T.purple2 : T.border}`, background: !vf ? T.purple1 + '22' : 'transparent', color: !vf ? T.purple3 : T.dimText, fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", transition: 'all 0.15s' }}>
              ★ GERAL
            </button>
            {VERTICAL_LIST.map(v => (
              <button key={v.id} onClick={() => setVf(vf === v.id ? null : v.id as VerticalId)}
                style={{ height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${vf === v.id ? v.accent : T.border}`, background: vf === v.id ? v.accent + '22' : 'transparent', color: vf === v.id ? v.accent : T.dimText, fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", transition: 'all 0.15s' }}>
                {v.short}
              </button>
            ))}
            {streak >= 3 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                style={{ height: 26, padding: '0 10px', borderRadius: 999, background: 'linear-gradient(135deg,#f97316,#c9a84c)', fontSize: 10, fontWeight: 900, color: '#000', display: 'inline-flex', alignItems: 'center' }}>
                🔥 STREAK ×{streak}
              </motion.span>
            )}
          </div>

          {/* Direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterBar filter={filter} onChange={setFilter} closers={closers} />
            <button onClick={toggleAudio} title={audioOn ? 'Desativar som' : 'Ativar som'}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: audioOn ? T.purple1 + '22' : 'transparent', color: audioOn ? T.purple3 : T.dimText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {audioOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button onClick={refetch}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.dimText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            {isAdmin && (
              <Link href="/telao/settings" style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.dimText, fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: "'Space Grotesk',sans-serif" }}>
                <Settings size={12} />
              </Link>
            )}
            <button onClick={() => document.documentElement.requestFullscreen?.()}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.dimText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Maximize2 size={13} />
            </button>
            <Clock />
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div style={{ position: 'relative', zIndex: 1 }}><Ticker events={viewEvents} /></div>

      {/* ── Grid responsivo ────────────────────────────────── */}
      <div className="telao-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,380px)', gap: 14, padding: '14px 16px', position: 'relative', zIndex: 1, minHeight: 'calc(100vh - 80px)' }}>

        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MetricsCard events={viewEvents} accent={accent} label={vf ? VERTICALS[vf].short : 'GERAL'} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <GoalBar period="day" periodKey={todayKey()} vertical={vf} current={todayRev} goals={goals} accent={accent} totalLabel="mês" totalValue={monthRev} />
            <GoalBar period="month" periodKey={monthKey()} vertical={vf} current={monthRev} goals={goals} accent={accent} />
          </div>

          {/* VerticalRail */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {VERTICAL_LIST.map(v => {
              const count = events.filter(e => e.vertical === v.id).length
              const max   = Math.max(...VERTICAL_LIST.map(vv => events.filter(e => e.vertical === vv.id).length), 1)
              return (
                <button key={v.id} onClick={() => setVf(vf === v.id ? null : v.id as VerticalId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: `1px solid ${vf === v.id ? v.accent : T.border}`, background: vf === v.id ? v.accent + '15' : 'transparent', color: vf === v.id ? v.accent : T.dimText, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", transition: 'all 0.15s' }}>
                  <div style={{ height: 8, width: Math.max(3, (count / max) * 30), borderRadius: 2, background: v.accent }} />
                  {v.short} <span style={{ color: vf === v.id ? v.accent : T.dimText }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* HourlyChart */}
          <div style={{ ...card(), padding: '12px 14px' }}>
            <p style={{ ...sectionLabel }}>⏱ Ranking por hora</p>
            <HourlyChart events={viewEvents} closers={closers} accent={accent} />
          </div>
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 76, height: 'calc(100vh - 90px)' }}>
          <div style={{ ...card(), padding: '12px 14px', flex: '0 0 48%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <p style={{ ...sectionLabel }}>⚡ Feed ao vivo</p>
            <EventFeed events={viewEvents} closers={closers} />
          </div>
          <div style={{ ...card(), padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <p style={{ ...sectionLabel }}>🏆 Ranking {vf ? VERTICALS[vf].short : 'GERAL'}</p>
            <Ranking stats={stats} accent={accent} />
          </div>
        </div>
      </div>

      {/* Celebration */}
      <AnimatePresence mode="wait">
        {celebration && (
          <CelebrationOverlay key={celebration.id} ev={celebration} closer={celebration.closer_id ? byId[celebration.closer_id] ?? null : null} onDone={() => setCelebration(null)} />
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 900px) {
          .telao-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

export function LiveWall({ isAdmin }: { isAdmin: boolean }) {
  return (
    <LiveDataProvider>
      <LiveWallInner isAdmin={isAdmin} />
    </LiveDataProvider>
  )
}
