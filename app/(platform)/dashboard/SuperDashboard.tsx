'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Users, TrendingUp,
  ArrowRight, BarChart2, Target, DollarSign, Percent,
  Flame, AlertTriangle, Award, X, Sparkles, Stethoscope, HeartPulse, ClipboardList
} from 'lucide-react'

// ── Mini bar ────────────────────────────────────────────────
function Bar({ pct, color, h = 6 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{ height: '100%', borderRadius: 999, background: color }} />
    </div>
  )
}

// ── Curva suave (mesma técnica do telão) ─────────────────────
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

// ── Gráfico de receita — linha curva e fluida ────────────────
function RevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const W = 700, H = 90, padX = 10, padY = 18
  const max = Math.max(...data.map(d => d.revenue), 1)
  const min = Math.min(...data.map(d => d.revenue), 0)
  const range = Math.max(max - min, 1)
  const step = (W - padX * 2) / (data.length - 1)
  const pts = data.map((d, i) => ({ x: padX + i * step, y: padY + (H - padY - 14) * (1 - (d.revenue - min) / range) }))
  const linePath = smoothPath(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`
  return (
    <div style={{ width: '100%', overflow: 'visible' }}>
      <svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity=".3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={areaPath} fill="url(#revGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
        <motion.path d={linePath} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1
          const isHovered = hovered === i
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              {isHovered && (
                <line x1={p.x} y1={padY - 4} x2={p.x} y2={H} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" opacity={0.35} />
              )}
              {/* área de toque maior, invisível, pra facilitar o hover */}
              <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
              <motion.circle cx={p.x} cy={p.y} r={isHovered ? 6 : isLast ? 4.5 : 3} fill={isHovered || isLast ? '#22c55e' : 'var(--card)'} stroke="#22c55e" strokeWidth={1.5}
                animate={{ r: isHovered ? 6 : isLast ? 4.5 : 3 }} transition={{ duration: 0.15 }}
                initial={{ scale: 0 }} style={{ scale: 1 }} />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={isHovered ? 12.5 : 11} fontWeight={isHovered || isLast ? 800 : 600} fill={isHovered || isLast ? '#22c55e' : 'var(--muted-foreground)'} style={{ transition: 'font-size .15s' }}>
                {data[i].revenue >= 1000 ? `${(data[i].revenue / 1000).toFixed(1)}k` : data[i].revenue.toFixed(0)}
              </text>
              <text x={p.x} y={H + 16} textAnchor="middle" fontSize={10} fontWeight={isHovered ? 800 : 400} fill={isHovered ? '#22c55e' : 'var(--muted-foreground)'}>{data[i].day}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, rawValue, format = fmtBRL, sub, grad, color, href, big, trend }: any) {
  return (
    <Link href={href ?? '#'} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: big ? '20px 22px' : '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s', cursor: href ? 'pointer' : 'default', height: '100%', display: 'flex', flexDirection: 'column' }}
        onMouseEnter={e => { if (href) { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--shadow-md)'; el.style.borderColor = color + '40' } }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--shadow-sm)'; el.style.borderColor = 'var(--border)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: big ? 16 : 10 }}>
          <div style={{ width: big ? 42 : 38, height: big ? 42 : 38, borderRadius: 11, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${color}35` }}>
            <Icon size={big ? 18 : 16} style={{ color: '#fff' }} />
          </div>
        </div>
        <p style={{ fontSize: big ? 'clamp(30px,3vw,38px)' : 28, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1, letterSpacing: '-0.03em' }}>
          <CountUp value={rawValue} format={format} />
        </p>
        <p style={{ fontSize: big ? 13 : 11, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: big ? 11 : 10, color, marginTop: 4, fontWeight: 700 }}>{sub}</p>}
        {big && trend && trend.length > 1 && (
          <div style={{ marginTop: 'auto', paddingTop: 14 }}>
            <MiniTrendLine data={trend} color={color} />
          </div>
        )}
      </motion.div>
    </Link>
  )
}

// ── Mini linha de tendência embutida no card grande ────────────
function MiniTrendLine({ data, color }: { data: { day: string; revenue: number }[]; color: string }) {
  const W = 300, H = 46
  const max = Math.max(...data.map(d => d.revenue), 1)
  const min = Math.min(...data.map(d => d.revenue), 0)
  const range = Math.max(max - min, 1)
  const step = W / (data.length - 1)
  const pts = data.map((d, i) => ({ x: i * step, y: H - ((d.revenue - min) / range) * H }))
  const linePath = smoothPath(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${H} L 0,${H} Z`
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="miniTrendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={areaPath} fill="url(#miniTrendGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
    </svg>
  )
}

// ── Presença online dot ──────────────────────────────────────
function OnlineDot({ online }: { online: boolean }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#22c55e' : 'var(--border)', boxShadow: online ? '0 0 6px #22c55e' : 'none', transition: 'all 0.3s' }} />
      {online && <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid #22c55e', opacity: 0.4, animation: 'pulse 2s ease-in-out infinite' }} />}
    </div>
  )
}

// ── Tempo relativo ───────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// ── Avatar mini ──────────────────────────────────────────────
function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.38), fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials || '?'}
    </div>
  )
}

// ── Formatação de moeda ───────────────────────────────────────
function fmtBRL(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Ranking de produtos — pódium (mesmo formato do /intel) ───
function ProductRankingCard({ data }: { data: { product: string; vertical: string; count: number; rev: number }[] }) {
  if (!data || data.length === 0) return null
  const top3 = data.slice(0, 3)
  const rest = data.slice(3, 5)
  const visualOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as typeof top3
  const rankOf = (p: typeof top3[0]) => top3.indexOf(p)
  const PODIUM_HEIGHT = [92, 68, 52]
  const MEDAL = ['🥇', '🥈', '🥉']
  const GRAD  = ['linear-gradient(180deg,#fbbf24,#d97706)', 'linear-gradient(180deg,#cbd5e1,#94a3b8)', 'linear-gradient(180deg,#fb923c,#c2410c)']
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow .25s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>🏆 Produtos mais vendidos</p>
      <p style={{ margin: '2px 0 6px', fontSize: 11, color: 'var(--muted-foreground)' }}>Top 5 por receita no mês</p>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginTop: 18 }}>
        {visualOrder.map((p, idx) => {
          const rank = rankOf(p)
          return (
            <motion.div key={`${p.product}-${p.vertical}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08, type: 'spring', stiffness: 240, damping: 22 }}
              whileHover={{ y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 96, cursor: 'default' }}>
              <span style={{ fontSize: 18 }}>{MEDAL[rank]}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--foreground)', textAlign: 'center', marginTop: 4, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.product}</span>
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 1 }}>{p.vertical}</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--foreground)', marginTop: 4 }}>{fmtBRL(p.rev)}</span>
              <motion.div whileHover={{ boxShadow: '0 6px 20px rgba(0,0,0,.22)' }} transition={{ duration: 0.2 }}
                style={{ width: '100%', height: PODIUM_HEIGHT[rank], background: GRAD[rank], borderRadius: '8px 8px 0 0', marginTop: 8, boxShadow: '0 3px 10px rgba(0,0,0,.12)' }} />
            </motion.div>
          )
        })}
      </div>

      {rest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {rest.map((p, i) => (
            <motion.div key={`${p.product}-${p.vertical}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
              whileHover={{ x: 3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--secondary)', cursor: 'default' }}>
              <span style={{ width: 16, textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', flexShrink: 0 }}>{i + 4}º</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--foreground)' }}>{p.product}</span>
                <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginLeft: 6 }}>{p.vertical}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', flexShrink: 0 }}>{fmtBRL(p.rev)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Mini gráfico de barras por vertical ──────────────────────
function VerticalMiniBars({ title, icon, data, valueKey, color, format }: { title: string; icon: string; data: any[]; valueKey: string; color: string; format: (v: number) => string }) {
  const [hoveredCard, setHoveredCard] = useState(false)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const filtered = data.filter(d => d[valueKey] > 0 || true) // mantém as 4 verticais sempre visíveis, mesmo com 0
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div onMouseEnter={() => setHoveredCard(true)} onMouseLeave={() => { setHoveredCard(false); setHoveredBar(null) }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', boxShadow: hoveredCard ? 'var(--shadow-md)' : 'var(--shadow-sm)', transform: hoveredCard ? 'translateY(-3px)' : 'none', transition: 'box-shadow .25s ease, transform .25s ease' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 14px' }}>{icon} {title}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
        {filtered.map((d, i) => {
          const h = Math.max((d[valueKey] / max) * 74, d[valueKey] > 0 ? 6 : 2)
          const shortLabel = d.vertical.replace('-Review', '').replace(' R1', ' R1')
          const isHovered = hoveredBar === i
          return (
            <div key={d.vertical} onMouseEnter={() => setHoveredBar(i)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}>
              <motion.span animate={{ scale: isHovered ? 1.18 : 1 }} transition={{ duration: 0.18 }}
                style={{ fontSize: 9, fontWeight: 800, color, whiteSpace: 'nowrap', display: 'inline-block' }}>{format(d[valueKey])}</motion.span>
              <motion.div initial={{ height: 0 }} animate={{ height: h, scaleX: isHovered ? 1.12 : 1 }} transition={{ height: { duration: 0.65, delay: i * 0.08, ease: 'easeOut' }, scaleX: { duration: 0.18 } }}
                style={{ width: '100%', minHeight: 3, borderRadius: '5px 5px 0 0', background: isHovered ? color : `linear-gradient(180deg,${color},${color}99)`, marginTop: 4, boxShadow: isHovered ? `0 4px 14px ${color}55` : 'none', transformOrigin: 'bottom' }} />
              <span style={{ fontSize: 8.5, color: isHovered ? color : 'var(--muted-foreground)', fontWeight: isHovered ? 800 : 400, marginTop: 6, textAlign: 'center', lineHeight: 1.2, transition: 'color .15s' }}>{shortLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Partículas flutuantes discretas no fundo do header ────────
function ParticleField() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const particles = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 1.5 + Math.random() * 2.5, duration: 7 + Math.random() * 8, delay: Math.random() * 5,
  })), [])
  if (!mounted) return null
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <motion.div key={p.id}
          style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%', background: 'rgba(255,255,255,.55)' }}
          animate={{ y: [0, -16, 0], opacity: [0.15, 0.6, 0.15] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
    </div>
  )
}

// ── Linha de batimento (EKG) discreta — toque de identidade médica ──
function HeartbeatLine() {
  const pathD = 'M0,20 L100,20 L115,20 L125,4 L135,36 L145,20 L160,20 L500,20'
  return (
    <svg width="100%" height="34" viewBox="0 0 500 34" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 2, left: 0, opacity: 0.16, pointerEvents: 'none' }}>
      <path d={pathD} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.5" />
      <circle r="4" fill="#4ade80">
        <animateMotion dur="3.2s" repeatCount="indefinite" path={pathD} />
      </circle>
    </svg>
  )
}

// ── Contador vivo — "última venda há Xmin" ────────────────────
function LiveTicker({ lastSaleAt }: { lastSaleAt: string | null }) {
  const [, forceTick] = useState(0)
  useEffect(() => { const id = setInterval(() => forceTick(t => t + 1), 30000); return () => clearInterval(id) }, [])
  if (!lastSaleAt) return null
  const diffMs = Date.now() - new Date(lastSaleAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  const label = mins < 1 ? 'agora mesmo' : mins < 60 ? `há ${mins}min` : `há ${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}min` : ''}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
      <motion.div animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Última venda {label}</span>
    </div>
  )
}

// ── Anel duplo — % da meta (externo) vs % do mês decorrido (interno) ──
function DualRingGauge({ pctGoal, pctMonth }: { pctGoal: number; pctMonth: number }) {
  const R1 = 38, R2 = 26
  const C1 = 2 * Math.PI * R1, C2 = 2 * Math.PI * R2
  const diff = pctGoal - pctMonth
  const ahead = diff >= 0
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <div style={{ position: 'relative', width: 110, height: 110 }}>
        <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={R1} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="9" />
          <motion.circle cx="55" cy="55" r={R1} fill="none" stroke="#4ade80" strokeWidth="9" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C1}` }} animate={{ strokeDasharray: `${(pctGoal / 100) * C1} ${C1}` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
          <circle cx="55" cy="55" r={R2} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <motion.circle cx="55" cy="55" r={R2} fill="none" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C2}` }} animate={{ strokeDasharray: `${(pctMonth / 100) * C2} ${C2}` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{pctGoal.toFixed(0)}%</span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>da meta</span>
        </div>
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: ahead ? '#4ade80' : '#f87171' }}>{ahead ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}pp</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>vs ritmo do mês</span>
      </div>
    </div>
  )
}

// ── Contador animado — número "conta" do zero até o valor, não aparece pronto ──
function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 1200, start = performance.now(), from = display
    let raf: number
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cúbico
      setDisplay(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{format(display)}</>
}

// ── Forecast — componente de destaque, com área suave e saúde das assinaturas ──
function ForecastHero({ total, monthly, detail }: {
  total: number
  monthly?: { label: string; ajustado: number }[]
  detail?: { mrrAtual: number; persistenceRate: number; sampleSize: number; ativas: number; atrasadas: number; emRisco: number; completas: number }
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const safeMonthly = monthly ?? []
  const safeDetail  = detail ?? { mrrAtual: 0, persistenceRate: 0, sampleSize: 0, ativas: 0, atrasadas: 0, emRisco: 0, completas: 0 }
  const W = 700, H = 100, padX = 12, padY = 22
  const max = Math.max(...safeMonthly.map(d => d.ajustado), 1)
  const step = safeMonthly.length > 1 ? (W - padX * 2) / (safeMonthly.length - 1) : 0
  const pts = safeMonthly.map((d, i) => ({ x: padX + i * step, y: padY + (H - padY - 30) * (1 - d.ajustado / max) }))
  const linePath = smoothPath(pts)
  const areaPath = pts.length > 1 ? `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z` : ''

  const healthItems = [
    { label: 'Ativas', count: safeDetail.ativas, color: '#22c55e', emoji: '💚' },
    { label: 'Atrasadas', count: safeDetail.atrasadas, color: '#f59e0b', emoji: '⏰' },
    { label: 'Em risco', count: safeDetail.emRisco, color: '#ef4444', emoji: '⚠️' },
    { label: 'Completas', count: safeDetail.completas, color: 'var(--muted-foreground)', emoji: '✅' },
  ].filter(h => h.count > 0)

  return (
    <div style={{ background: 'linear-gradient(135deg,#042f2e 0%,#0f766e 55%,#0d9488 100%)', borderRadius: 22, padding: 'clamp(20px,3vw,30px)', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(13,148,136,0.28)' }}>
      <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                💓 Sinal vital da recorrência
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>Esperado até dezembro</p>
            <p style={{ fontSize: 'clamp(30px,5vw,46px)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>
              <CountUp value={total} format={fmtBRL} />
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '8px 0 0' }}>
              Recebido este mês em recorrência: <strong style={{ color: '#fff' }}>{fmtBRL(safeDetail.mrrAtual)}</strong>
              {' · '}<Link href="/intel" style={{ color: '#5eead4', fontWeight: 700, textDecoration: 'none' }}>ver detalhe completo</Link>
            </p>
          </div>

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 84, height: 84 }}>
              <svg width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                <motion.circle cx="42" cy="42" r="34" fill="none" stroke="#5eead4" strokeWidth="8" strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${2 * Math.PI * 34}` }} animate={{ strokeDasharray: `${(safeDetail.persistenceRate / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{safeDetail.persistenceRate.toFixed(0)}%</span>
              </div>
            </div>
            <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.6)', margin: '6px 0 0', maxWidth: 90 }}>aderência histórica</p>
          </div>
        </div>

        {safeMonthly.length > 1 && (
          <div style={{ margin: '10px 0 6px' }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5eead4" stopOpacity=".35" />
                  <stop offset="100%" stopColor="#5eead4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path d={areaPath} fill="url(#fcGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
              <motion.path d={linePath} fill="none" stroke="#5eead4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: 'easeOut' }} />
              {pts.map((p, i) => {
                const isFirst = i === 0 // mês mais próximo/confiável — o ponto que importa mais aqui
                const isHovered = hovered === i
                return (
                  <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                    {isHovered && (
                      <line x1={p.x} y1={6} x2={p.x} y2={H} stroke="#5eead4" strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
                    )}
                    <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                    <motion.circle cx={p.x} cy={p.y} r={isHovered ? 6.5 : isFirst ? 4.5 : 3} fill={isHovered || isFirst ? '#5eead4' : 'rgba(4,47,46,0.85)'} stroke="#5eead4" strokeWidth={1.5}
                      animate={{ r: isHovered ? 6.5 : isFirst ? 4.5 : 3 }} transition={{ duration: 0.15 }}
                      initial={{ scale: 0 }} style={{ scale: 1 }} />
                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={isHovered ? 12.5 : 11} fontWeight={isHovered || isFirst ? 800 : 600} fill={isHovered || isFirst ? '#5eead4' : 'rgba(255,255,255,0.75)'}>
                      {safeMonthly[i].ajustado >= 1000 ? `${(safeMonthly[i].ajustado / 1000).toFixed(1)}k` : safeMonthly[i].ajustado.toFixed(0)}
                    </text>
                    <text x={p.x} y={H + 14} textAnchor="middle" fontSize={10} fontWeight={isHovered ? 800 : 400} fill={isHovered ? '#5eead4' : 'rgba(255,255,255,0.55)'}>{safeMonthly[i].label}</text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        {healthItems.length > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            {healthItems.map(h => (
              <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{h.emoji}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                  <strong style={{ color: '#fff' }}>{h.count}</strong> assinatura{h.count !== 1 ? 's' : ''} <span style={{ color: h.color, fontWeight: 700 }}>{h.label.toLowerCase()}</span>
                </span>
              </div>
            ))}
            {safeDetail.sampleSize < 5 && (
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>· amostra histórica pequena, aderência é uma estimativa conservadora</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mural de insights de IA — nível de empresa ────────────────
const INSIGHT_STYLE = {
  alerta:       { emoji: '⚠️', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)' },
  oportunidade: { emoji: '💡', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  destaque:     { emoji: '✨', color: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.25)' },
} as const

function InsightMural({ insights }: { insights: { type: 'alerta' | 'oportunidade' | 'destaque'; titulo: string; motivo: string | null; sugestao: string | null }[] }) {
  if (!insights || insights.length === 0) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Stethoscope size={15} style={{ color: '#a855f7' }} />
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Diagnóstico do Dia</p>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· gerado 1x por dia, olhando o painel inteiro</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        {insights.map((ins, i) => {
          const s = INSIGHT_STYLE[ins.type] ?? INSIGHT_STYLE.destaque
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }}
              style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{s.emoji}</span>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.35 }}>{ins.titulo}</p>
              </div>
              {ins.motivo && (
                <div style={{ paddingLeft: 30 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>Provável motivo</span>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0', lineHeight: 1.4 }}>{ins.motivo}</p>
                </div>
              )}
              {ins.sugestao && (
                <div style={{ paddingLeft: 30 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>Sugestão</span>
                  <p style={{ fontSize: 12, color: 'var(--foreground)', margin: '2px 0 0', lineHeight: 1.4, fontWeight: 600 }}>{ins.sugestao}</p>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Divisor de pulso — pequeno toque de identidade médica entre seções ──
function PulseDivider() {
  const pathD = 'M0,10 L40,10 L48,10 L53,2 L58,18 L63,10 L72,10 L200,10'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px', opacity: 0.5 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <svg width="90" height="20" viewBox="0 0 200 20" preserveAspectRatio="xMidYMid meet">
        <path d={pathD} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" />
        <circle r="3" fill="#a855f7">
          <animateMotion dur="2.6s" repeatCount="indefinite" path={pathD} />
        </circle>
      </svg>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ── Baralho de closers ────────────────────────────────────────
const BADGE_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  meta_batida: { emoji: '🎯', label: 'Meta batida',   color: '#22c55e' },
  em_alta:     { emoji: '🔥', label: 'Em alta',       color: '#f97316' },
  sem_vender:  { emoji: '⚠️', label: 'Sem vender',    color: '#ef4444' },
  maior_ticket:{ emoji: '💰', label: 'Maior ticket',  color: '#eab308' },
}

// Rotação/deslocamento fixos por posição — dá o efeito de baralho espalhado
// sem ficar diferente a cada render (nada de random no render).
const SCATTER = [-6, 4, -3, 7, -5, 2, -7, 5, -2, 6, -4, 3, -6, 4, -3]

function DeckCard({ c, index, onOpen }: { c: any; index: number; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false)
  const rot = SCATTER[index % SCATTER.length]
  const teamColor = c.team === 'R1' ? '#8b5cf6' : c.team === 'OAO' ? '#3b82f6' : '#6366f1'
  const topBadge = c.badges?.[0] ? BADGE_INFO[c.badges[0]] : null

  let insight: { resumo?: string; destaque?: string | null; atencao?: string | null } = {}
  try { insight = c.insight ? JSON.parse(c.insight) : {} } catch { insight = { resumo: c.insight } }

  return (
    <div onClick={onOpen}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 172, height: 250, flexShrink: 0, marginLeft: index === 0 ? 0 : -58,
        cursor: 'pointer', position: 'relative', perspective: 1200,
        transform: hovered ? 'rotate(0deg) translateY(-18px) scale(1.06)' : `rotate(${rot}deg)`,
        transition: 'transform .3s ease', zIndex: hovered ? 999 : index,
      }}>
      <motion.div
        animate={{ rotateY: hovered ? 180 : 0 }}
        transition={{ duration: 0.55, ease: 'easeInOut' }}
        style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}>

        {/* FRENTE */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', boxShadow: hovered ? '0 20px 40px rgba(0,0,0,.25)' : 'var(--shadow-md)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${teamColor},${teamColor}88)` }} />
          {topBadge && (
            <div title={topBadge.label} style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%', background: 'var(--card)', border: `1.5px solid ${topBadge.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
              {topBadge.emoji}
            </div>
          )}
          <div style={{ padding: '20px 14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: teamColor, background: `${teamColor}18`, padding: '2px 10px', borderRadius: 999, marginBottom: 10 }}>{c.team ?? '—'}</span>
            <Avatar name={c.name} url={c.avatarUrl} size={64} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '10px 0 2px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{c.name}</p>
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '0 0 10px' }}>#{c.rank} no ranking</p>
            <div style={{ marginTop: 'auto', width: '100%', textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: c.pctGoal >= 100 ? '#22c55e' : 'var(--foreground)', margin: 0, lineHeight: 1 }}>{c.pctGoal.toFixed(0)}%</p>
              <p style={{ fontSize: 9, color: 'var(--muted-foreground)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>da meta</p>
            </div>
          </div>
        </div>

        {/* VERSO — a IA falando */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 16, background: `linear-gradient(160deg,${teamColor}ee,${teamColor}bb)`, border: '1px solid var(--border)', boxShadow: hovered ? '0 20px 40px rgba(0,0,0,.25)' : 'var(--shadow-md)', overflow: 'hidden', padding: '14px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Sparkles size={11} style={{ color: '#fff', flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.name.split(' ')[0]}</span>
          </div>
          <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.95)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
            {insight.resumo || 'Sem dados suficientes ainda este mês.'}
          </p>
          {insight.destaque && (
            <p style={{ fontSize: 9.5, color: '#dcfce7', margin: 0, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>✅ {insight.destaque}</p>
          )}
          {insight.atencao && (
            <p style={{ fontSize: 9.5, color: '#fef3c7', margin: 0, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>⚠️ {insight.atencao}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#fff', margin: 0 }}>{fmtBRL(c.revenue)}</p>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', margin: 0 }}>receita</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#fff', margin: 0 }}>{c.daysSinceLastSale === null ? '—' : c.daysSinceLastSale}</p>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', margin: 0 }}>dias s/ vender</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function CardModal({ c, onClose }: { c: any; onClose: () => void }) {
  const teamColor = c.team === 'R1' ? '#8b5cf6' : c.team === 'OAO' ? '#3b82f6' : '#6366f1'
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.4)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--secondary)', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>

        <div style={{ background: `linear-gradient(135deg,${teamColor}22,transparent)`, padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Avatar name={c.name} url={c.avatarUrl} size={72} />
          <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: '12px 0 4px' }}>{c.name}</p>
          <span style={{ fontSize: 11, fontWeight: 800, color: teamColor, background: `${teamColor}18`, padding: '3px 12px', borderRadius: 999 }}>Time {c.team ?? '—'} · #{c.rank} no ranking</span>
        </div>

        {c.insight && (() => {
          let parsed: { resumo?: string; destaque?: string | null; atencao?: string | null } = {}
          try { parsed = JSON.parse(c.insight) } catch { parsed = { resumo: c.insight } }
          return (
            <div style={{ margin: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parsed.resumo && (
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Sparkles size={13} style={{ color: '#6366f1', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 12.5, color: 'var(--foreground)', margin: 0, lineHeight: 1.45 }}>{parsed.resumo}</p>
                </div>
              )}
              {parsed.destaque && (
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0 }}>✅</span>
                  <p style={{ fontSize: 12.5, color: 'var(--foreground)', margin: 0, lineHeight: 1.45 }}>{parsed.destaque}</p>
                </div>
              )}
              {parsed.atencao && (
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0 }}>⚠️</span>
                  <p style={{ fontSize: 12.5, color: 'var(--foreground)', margin: 0, lineHeight: 1.45 }}>{parsed.atencao}</p>
                </div>
              )}
            </div>
          )
        })()}

        {c.badges?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 20px 6px' }}>
            {c.badges.map((b: string) => BADGE_INFO[b] && (
              <span key={b} style={{ fontSize: 11, fontWeight: 700, color: BADGE_INFO[b].color, background: `${BADGE_INFO[b].color}15`, padding: '4px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
                {BADGE_INFO[b].emoji} {BADGE_INFO[b].label}
              </span>
            ))}
          </div>
        )}

        <div style={{ padding: '10px 20px 22px' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Meta do mês</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{fmtBRL(c.revenue)} / {c.goalSales > 0 ? fmtBRL(c.goalSales) : 'sem meta'}</span>
            </div>
            <Bar pct={c.pctGoal} color={c.pctGoal >= 100 ? '#22c55e' : teamColor} h={8} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {[
              { label: 'Vendas no mês',  value: c.salesCount,                                     color: teamColor },
              { label: 'Ticket médio',   value: fmtBRL(c.avgTicket),                               color: '#22c55e' },
              { label: 'Dias sem vender',value: c.daysSinceLastSale === null ? '—' : c.daysSinceLastSale, color: c.daysSinceLastSale !== null && c.daysSinceLastSale >= 4 ? '#ef4444' : 'var(--foreground)' },
              { label: 'Embaixadores',   value: c.myCerts,                                         color: '#eab308' },
              { label: 'Conversão',      value: `${c.convRate.toFixed(0)}%`,                        color: '#3b82f6' },
              { label: 'Deixado na mesa',value: fmtBRL(c.moneyLeft),                                color: c.moneyLeft > 0 ? '#f97316' : 'var(--foreground)' },
            ].map((m, i) => (
              <div key={i} style={{ background: 'var(--secondary)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: m.color, margin: 0 }}>{m.value}</p>
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


interface Props {
  userName: string
  stats: {
    totalUsers: number; totalSteps: number; totalMaterials: number
    activeOnboarding: number; completedCount: number; avgCompletion: number
    onlineCount: number; passedRate: number; totalConversations: number
  }
  users: any[]
  progressByDay: { day: string; completions: number; quizzes: number }[]
  commercial: {
    totalRevMonth: number; totalSalesMonth: number; totalSalesToday: number; totalRevToday: number
    avgTicketAll: number; totalMoneyLeft: number; totalCertsMonth: number
    forecast: number; monthlyForecast: { label: string; ajustado: number }[]
    forecastDetail: { mrrAtual: number; persistenceRate: number; sampleSize: number; ativas: number; atrasadas: number; emRisco: number; completas: number }
    revenueByDay: { day: string; revenue: number }[]
    closerCards: any[]; totalGoalMonth: number; pctCompanyGoal: number
    productRanking: { product: string; vertical: string; count: number; rev: number }[]
    verticalBreakdown: { vertical: string; revenue: number; count: number; avgTicket: number; moneyLeft: number; avgDiscountPct: number }[]
    lastSaleAt: string | null
    pctMonthElapsed: number
    companyInsights: { type: 'alerta' | 'oportunidade' | 'destaque'; titulo: string; motivo: string | null; sugestao: string | null }[]
  }
}

export function SuperDashboard({ userName, stats, users, progressByDay, commercial }: Props) {
  const [activities, setActivities] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [openCard, setOpenCard] = useState<any | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Busca atividade recente
  useEffect(() => {
    fetch('/api/admin/activity')
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoadingActivity(false) })
      .catch(() => setLoadingActivity(false))
  }, [])

  // Heartbeat + busca presença online a cada 30s
  useEffect(() => {
    async function tick() {
      await fetch('/api/admin/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: '/dashboard' }) })
      const r = await fetch('/api/admin/presence')
      const d = await r.json()
      setOnlineUsers(new Set((d.online ?? []).map((p: any) => p.user_id)))
    }
    tick()
    intervalRef.current = setInterval(tick, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const now   = new Date()
  const hour  = now.getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Usuários online com detalhes
  const usersWithPresence = users.map(u => ({ ...u, isOnline: onlineUsers.has(u.id) }))
  const onlineList = usersWithPresence.filter(u => u.isOnline)

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 68%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(20px,3vw,32px)', marginBottom: 24, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(79,70,229,0.35)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <ParticleField />
        <HeartbeatLine />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                🚀 Plataforma Operacional · Time Comercial
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              {greet}, {userName}!
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', margin: '0 0 18px', maxWidth: 440, lineHeight: 1.6 }}>
              Central de controle da MedReview. Tudo que você precisa saber em um só lugar.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Sistema online</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <Users size={12} style={{ color: '#fff' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{onlineList.length} online agora</span>
              </div>
              <LiveTicker lastSaleAt={commercial.lastSaleAt} />
            </div>
          </div>
          <DualRingGauge pctGoal={commercial.pctCompanyGoal} pctMonth={commercial.pctMonthElapsed} />
        </div>
      </div>

      <InsightMural insights={commercial.companyInsights} />

      {/* KPIs comerciais — bento assimétrico, não 4 quadrados iguais */}
      <div className="sd-kpi-bento" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 12, marginBottom: 20, gridTemplateAreas: '"revenue today ticket" "revenue money money"' }}>
        <div style={{ gridArea: 'revenue' }}>
          <KpiCard icon={DollarSign} label="Receita do mês" rawValue={commercial.totalRevMonth} sub={`${commercial.totalSalesMonth} vendas`}
            grad="linear-gradient(135deg,#22c55e,#16a34a)" color="#22c55e" href="/intel" big trend={commercial.revenueByDay} />
        </div>
        <div style={{ gridArea: 'today' }}>
          <KpiCard icon={TrendingUp} label="Receita hoje" rawValue={commercial.totalRevToday} sub={`${commercial.totalSalesToday} vendas · ao vivo`}
            grad="linear-gradient(135deg,#3b82f6,#4f46e5)" color="#3b82f6" href="/telao" />
        </div>
        <div style={{ gridArea: 'ticket' }}>
          <KpiCard icon={Target} label="Ticket médio" rawValue={commercial.avgTicketAll} sub="média de todas as vendas do mês"
            grad="linear-gradient(135deg,#8b5cf6,#a855f7)" color="#8b5cf6" href="/intel" />
        </div>
        <div style={{ gridArea: 'money' }}>
          <KpiCard icon={AlertTriangle} label="Deixado na mesa" rawValue={commercial.totalMoneyLeft} sub={`${commercial.totalCertsMonth} embaixadores certificados`}
            grad="linear-gradient(135deg,#f97316,#ef4444)" color="#f97316" href="/telao" />
        </div>
      </div>

      {/* Por vertical */}
      {commercial.verticalBreakdown?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Por vertical</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <VerticalMiniBars title="Receita do mês" icon="💰" data={commercial.verticalBreakdown} valueKey="revenue" color="#22c55e" format={fmtBRL} />
            <VerticalMiniBars title="Ticket médio" icon="🎯" data={commercial.verticalBreakdown} valueKey="avgTicket" color="#8b5cf6" format={fmtBRL} />
            <VerticalMiniBars title="Deixado na mesa" icon="⚠️" data={commercial.verticalBreakdown} valueKey="moneyLeft" color="#f97316" format={fmtBRL} />
            <VerticalMiniBars title="Desconto médio" icon="🏷️" data={commercial.verticalBreakdown} valueKey="avgDiscountPct" color="#ef4444" format={v => `${v.toFixed(1)}%`} />
          </div>
        </div>
      )}

      <PulseDivider />

      {/* Forecast de recorrência até dezembro — componente de destaque */}
      <ForecastHero total={commercial.forecast} monthly={commercial.monthlyForecast} detail={commercial.forecastDetail} />

      {/* Row 2: Atividade semanal + Online agora */}
      <div className="sd-row2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, marginBottom: 16 }}>

        {/* Gráfico de receita semanal */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={15} style={{ color: '#22c55e' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Receita — últimos 7 dias</p>
            </div>
            <Link href="/telao" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#22c55e', textDecoration: 'none' }}>
              Ver telão <ArrowRight size={11} />
            </Link>
          </div>
          <RevenueChart data={commercial.revenueByDay} />
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[
              { label: 'Total 7 dias',   value: fmtBRL(commercial.revenueByDay.reduce((s, d) => s + d.revenue, 0)), color: '#22c55e' },
              { label: 'Média diária',   value: fmtBRL(commercial.revenueByDay.reduce((s, d) => s + d.revenue, 0) / 7), color: '#3b82f6' },
              { label: '% da meta',      value: `${commercial.pctCompanyGoal.toFixed(0)}%`, color: '#8b5cf6' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, minWidth: 80 }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: item.color, margin: 0, letterSpacing: '-0.02em' }}>{item.value}</p>
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Online agora */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Online agora</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 9px', borderRadius: 999 }}>
              {onlineList.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }} className="scrollbar-hide">
            {onlineList.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '20px 0' }}>
                Nenhum usuário ativo no momento
              </p>
            ) : (
              onlineList.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 11, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={u.name} url={u.avatar_url} size={30} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', border: '1.5px solid var(--card)', boxShadow: '0 0 5px #22c55e' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>Time {u.team ?? '—'}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>{u.pct}%</span>
                </div>
              ))
            )}
          </div>

          {/* Todos os usuários com indicador */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Todos os usuários</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }} className="scrollbar-hide">
              {usersWithPresence.slice(0, 8).map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <OnlineDot online={u.isOnline} />
                  <span style={{ fontSize: 12, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{u.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de produtos */}
      {commercial.productRanking?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ProductRankingCard data={commercial.productRanking} />
        </div>
      )}

      <PulseDivider />

      {/* Baralho de closers */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 24px', boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={15} style={{ color: '#eab308' }} />
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Prontuário dos Closers — {commercial.closerCards.length} no time</p>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Passe o mouse pra ver o diagnóstico · clique pra abrir o prontuário completo</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 20px' }}>Desempenho do mês, com insight gerado por IA — atualizado 1x por dia</p>

        {commercial.closerCards.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: '30px 0' }}>Nenhum closer cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', overflowX: 'auto', paddingTop: 24, paddingBottom: 30, paddingLeft: 10 }} className="scrollbar-hide">
            {commercial.closerCards.map((c, i) => (
              <DeckCard key={c.id} c={c} index={i} onOpen={() => setOpenCard(c)} />
            ))}
          </div>
        )}
      </div>

      {openCard && <CardModal c={openCard} onClose={() => setOpenCard(null)} />}

      {/* Row 3: Atividade recente + Progresso individual */}
      <div className="sd-row3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>

        {/* Feed de atividade recente */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HeartPulse size={14} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Atividade recente</p>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>últimos 7 dias</span>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }} className="scrollbar-hide">
            {loadingActivity ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: 14, height: 14, borderRadius: '50%', background: '#6366f1', margin: '0 auto' }} />
              </div>
            ) : activities.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhuma atividade nos últimos 7 dias.</p>
              </div>
            ) : activities.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 18px', borderBottom: i < activities.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--secondary) 40%, transparent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                {/* Ícone */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${a.color}18`, border: `1px solid ${a.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1.4 }}>
                    <strong style={{ fontWeight: 700 }}>{a.user?.name ?? 'Alguém'}</strong>{' '}
                    {a.type === 'completion'   && 'concluiu a trilha'}
                    {a.type === 'quiz'         && 'passou no quiz de'}
                    {a.type === 'video'        && 'assistiu'}
                    {a.type === 'step_created' && 'trilha criada:'}
                    {' '}<span style={{ color: a.color, fontWeight: 600 }}>"{a.subject}"</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{timeAgo(a.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking do mês */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={14} style={{ color: '#eab308' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Ranking do mês</p>
            </div>
            <Link href="/intel" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
              Ver tudo <ArrowRight size={11} />
            </Link>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }} className="scrollbar-hide">
            {commercial.closerCards.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhuma venda registrada este mês ainda.</p>
              </div>
            ) : commercial.closerCards.slice(0, 12).map((c, i) => {
              const tc = c.team === 'OAO'
                ? { dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
                : c.team === 'R1'
                  ? { dot: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' }
                  : { dot: '#6366f1', bg: 'rgba(99,102,241,0.1)' }
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

              return (
                <div key={c.id} onClick={() => setOpenCard(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < commercial.closerCards.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--secondary) 40%, transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                  <span style={{ width: 20, textAlign: 'center', fontSize: medal ? 15 : 11, fontWeight: 800, color: medal ? undefined : 'var(--muted-foreground)', flexShrink: 0 }}>{medal ?? `#${i + 1}`}</span>
                  <Avatar name={c.name} url={c.avatarUrl} size={32} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      {c.team && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: tc.bg, color: tc.dot, flexShrink: 0 }}>{c.team}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Bar pct={c.pctGoal} color={c.pctGoal >= 100 ? '#22c55e' : tc.dot} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.pctGoal >= 100 ? '#22c55e' : 'var(--foreground)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>{fmtBRL(c.revenue)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @media (max-width: 1024px) {
          .sd-row2 { grid-template-columns: 1fr !important; }
          .sd-row3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .sd-kpi-bento { grid-template-columns: 1fr 1fr !important; grid-template-areas: "revenue revenue" "today ticket" "money money" !important; }
        }
        @media (max-width: 480px) {
          .sd-kpi-bento { grid-template-columns: 1fr !important; grid-template-areas: "revenue" "today" "ticket" "money" !important; }
        }
      `}</style>
    </div>
  )
}
