'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CommercialAnalysis } from './CommercialAnalysis'
import {
  Users, Target, TrendingUp,
  ArrowRight, X, Sparkles, Stethoscope, HeartPulse, ClipboardList, ChevronDown
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

// ── Mesma informação do LiveTicker acima, só que na moldura de "chip com
// ícone + duas linhas" usada no novo header — pra bater com as outras duas.
function LiveTickerChip({ lastSaleAt }: { lastSaleAt: string | null }) {
  const [, forceTick] = useState(0)
  useEffect(() => { const id = setInterval(() => forceTick(t => t + 1), 30000); return () => clearInterval(id) }, [])
  if (!lastSaleAt) return null
  const diffMs = Date.now() - new Date(lastSaleAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  const label = mins < 1 ? 'agora mesmo' : mins < 60 ? `há ${mins}min` : `há ${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}min` : ''}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
      <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.25 }}>Última venda {label}</p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.25 }}>Quando o foco vira resultado</p>
      </div>
    </div>
  )
}

// ── Anel duplo — % da meta (externo) vs % do mês decorrido (interno) ──
// ── Raios de luz radiais atrás do foguete — dão o efeito "explosão de luz"
// do fundo, sem precisar de uma imagem pronta ──────────────────────────
function RadialRays() {
  const rays = useMemo(() => Array.from({ length: 14 }, (_, i) => i * (360 / 14)), [])
  return (
    <div style={{ position: 'absolute', top: '30%', right: 'clamp(220px,30vw,350px)', width: 420, height: 420, transform: 'translate(30%,-45%)', pointerEvents: 'none' }}>
      <svg viewBox="0 0 420 420" style={{ width: '100%', height: '100%', opacity: 0.5 }}>
        {rays.map(deg => (
          <line key={deg} x1="210" y1="210" x2="210" y2="0"
            stroke="url(#rayGrad)" strokeWidth="2"
            transform={`rotate(${deg} 210 210)`} />
        ))}
        <defs>
          <linearGradient id="rayGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(196,181,253,0.35)" />
            <stop offset="100%" stopColor="rgba(196,181,253,0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// ── Foguete com trilha de luz e faíscas — o elemento de impacto do header.
// Desenhado em SVG (sem imagem externa), flutuando suavemente. ─────────
function RocketIllustration() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const sparks = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i, t: i / 10, offset: (Math.random() - 0.5) * 22, size: 1.5 + Math.random() * 2, delay: Math.random() * 2,
  })), [])
  return (
    <motion.div
      animate={{ y: [0, -10, 0], rotate: [-2, 2, -2] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ position: 'absolute', top: '8%', right: 'clamp(200px,26vw,320px)', width: 'clamp(150px,20vw,270px)', height: 'clamp(200px,26vw,360px)', pointerEvents: 'none', zIndex: 1 }}>
      <svg viewBox="0 0 200 320" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id="trailGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rocketBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e0e7ff" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>

        {/* Trilha de luz atrás do foguete */}
        <path d="M 100,120 C 60,180 30,230 -10,300" fill="none" stroke="url(#trailGrad)" strokeWidth="20" strokeLinecap="round" opacity="0.55" />
        {mounted && sparks.map(s => (
          <motion.circle key={s.id}
            cx={100 - s.t * 110 + s.offset} cy={120 + s.t * 180}
            r={s.size} fill="#e9d5ff"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }} />
        ))}

        {/* Corpo do foguete */}
        <g transform="rotate(28 100 100)">
          <path d="M100,20 C118,45 124,75 124,100 L76,100 C76,75 82,45 100,20 Z" fill="url(#rocketBody)" />
          <circle cx="100" cy="78" r="13" fill="#312e81" stroke="#c4b5fd" strokeWidth="3" />
          <path d="M76,90 L48,125 L76,112 Z" fill="#7c3aed" />
          <path d="M124,90 L152,125 L124,112 Z" fill="#7c3aed" />
          <rect x="82" y="98" width="36" height="14" rx="4" fill="#a5b4fc" />
          {/* Chama */}
          <motion.path d="M88,112 C88,140 100,160 100,160 C100,160 112,140 112,112 Z" fill="#fbbf24"
            animate={{ scaleY: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }} transition={{ duration: 0.5, repeat: Infinity }}
            style={{ transformOrigin: '100px 112px' }} />
        </g>
      </svg>
    </motion.div>
  )
}

function DualRingGauge({ pctGoal, pctMonth }: { pctGoal: number; pctMonth: number }) {
  const R1 = 32, R2 = 22
  const C1 = 2 * Math.PI * R1, C2 = 2 * Math.PI * R2
  const diff = pctGoal - pctMonth
  const ahead = diff >= 0
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <div style={{ position: 'relative', width: 92, height: 92 }}>
        <svg width="92" height="92" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="46" cy="46" r={R1} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
          <motion.circle cx="46" cy="46" r={R1} fill="none" stroke="#4ade80" strokeWidth="8" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C1}` }} animate={{ strokeDasharray: `${(pctGoal / 100) * C1} ${C1}` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
          <circle cx="46" cy="46" r={R2} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <motion.circle cx="46" cy="46" r={R2} fill="none" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C2}` }} animate={{ strokeDasharray: `${(pctMonth / 100) * C2} ${C2}` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{pctGoal.toFixed(0)}%</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>da meta</span>
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: ahead ? '#4ade80' : '#f87171' }}>{ahead ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}pp</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>vs ritmo do mês</span>
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
      const eased = 1 - Math.pow(1 - t, 3)
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
// ── Meta x Realizado — contexto que faltava pro número de receita sozinho ──
function MetaRealizadoCard({ meta, realizado, evolucao, diasNoMes }: {
  meta: number; realizado: number
  evolucao: { day: number; realizado: number; ritmoLinear: number }[]
  diasNoMes: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const pct = meta > 0 ? (realizado / meta) * 100 : 0
  const acimaOuNoRitmo = evolucao.length > 0 && evolucao[evolucao.length - 1].realizado >= evolucao[evolucao.length - 1].ritmoLinear

  const W = 700, H = 140, padX = 10, padY = 18
  // Escala pelo range real dos dados visíveis (realizado + ritmo), não pela
  // meta inteira — se a meta for muito maior que o realizado até agora, usar
  // a meta como referência espreme as duas linhas lá embaixo, quase retas.
  const maxVal = Math.max(...evolucao.map(d => Math.max(d.realizado, d.ritmoLinear)), 1)
  const pts = evolucao.map(d => ({ x: padX + ((d.day - 1) / Math.max(diasNoMes - 1, 1)) * (W - padX * 2), y: padY + (H - padY - 6) * (1 - d.realizado / maxVal) }))
  const ritmoPts = evolucao.map(d => ({ x: padX + ((d.day - 1) / Math.max(diasNoMes - 1, 1)) * (W - padX * 2), y: padY + (H - padY - 6) * (1 - d.ritmoLinear / maxVal) }))
  const linePath = smoothPath(pts)
  const areaPath = pts.length > 1 ? `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z` : ''
  const ritmoLinePath = ritmoPts.length > 1 ? `M ${ritmoPts[0].x},${ritmoPts[0].y} L ${ritmoPts[ritmoPts.length - 1].x},${ritmoPts[ritmoPts.length - 1].y}` : ''

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 18px', boxShadow: 'var(--shadow-sm)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Target size={15} style={{ color: '#6366f1' }} />
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Meta x Realizado</p>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <p style={{ fontSize: 'clamp(24px,3vw,30px)', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
            <CountUp value={realizado} format={fmtBRL} />
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
            realizado de <strong style={{ color: 'var(--foreground)' }}>{fmtBRL(meta)}</strong> de meta
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: pct >= 100 ? '#22c55e' : acimaOuNoRitmo ? '#3b82f6' : '#f97316', margin: 0 }}>{pct.toFixed(1)}%</p>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>da meta</p>
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: 12 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: pct >= 100 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#4f46e5,#6366f1)' }} />
      </div>

      {evolucao.length > 1 && (
        <div style={{ width: '100%', overflow: 'visible' }}>
          <svg width="100%" height={H + 8} viewBox={`0 0 ${W} ${H + 8}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity=".3" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Linha de ritmo ideal da meta — reta pontilhada, referência */}
            <path d={ritmoLinePath} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 5" opacity={0.7} />
            <motion.path d={areaPath} fill="url(#metaGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
            <motion.path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
            {pts.map((p, i) => {
              const isLast = i === pts.length - 1
              const isHovered = hovered === i
              if (!isLast && !isHovered && i % Math.max(Math.ceil(pts.length / 8), 1) !== 0) {
                return <circle key={i} cx={p.x} cy={p.y} r={12} fill="transparent" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }} />
              }
              return (
                <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                  <motion.circle cx={p.x} cy={p.y} r={isHovered ? 6 : isLast ? 4.5 : 2.5} fill={isHovered || isLast ? '#6366f1' : 'var(--card)'} stroke="#6366f1" strokeWidth={1.5}
                    animate={{ r: isHovered ? 6 : isLast ? 4.5 : 2.5 }} transition={{ duration: 0.15 }} />
                  {(isHovered || isLast) && (
                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={11} fontWeight={800} fill="#6366f1">
                      {evolucao[i].realizado >= 1000 ? `${(evolucao[i].realizado / 1000).toFixed(1)}k` : evolucao[i].realizado.toFixed(0)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}
      <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0', textAlign: 'center' }}>linha pontilhada = ritmo ideal pra bater a meta</p>
    </div>
  )
}

// ── Forecast de fechamento do mês — o gráfico mais importante: "nesse
// ritmo, onde vamos terminar o mês?" ──────────────────────────────────
function ClosingForecastCard({ realizado, recorrenciaPrevista, ritmoNovaVenda, forecast, meta, pctVsMeta }: {
  realizado: number; recorrenciaPrevista: number; ritmoNovaVenda: number; forecast: number; meta: number; pctVsMeta: number
}) {
  const maxVal = Math.max(forecast, meta, 1)
  const acimaDaMeta = pctVsMeta >= 0
  const bars = [
    { label: 'Realizado', value: realizado, color: '#22c55e' },
    { label: 'Forecast', value: forecast, color: acimaDaMeta ? '#3b82f6' : '#f97316' },
    { label: 'Meta', value: meta, color: '#6366f1' },
  ]
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 18px', boxShadow: 'var(--shadow-sm)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <TrendingUp size={15} style={{ color: '#3b82f6' }} />
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Forecast de fechamento do mês</p>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 16px' }}>Nesse ritmo, onde a empresa termina o mês</p>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12, height: 74 }}>
        {bars.map((b, i) => (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: b.color, marginBottom: 4 }}><CountUp value={b.value} format={fmtBRL} /></span>
            <motion.div initial={{ height: 0 }} animate={{ height: Math.max((b.value / maxVal) * 64, 4) }} transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
              style={{ width: '100%', maxWidth: 64, borderRadius: '8px 8px 0 0', background: `linear-gradient(180deg,${b.color},${b.color}99)`, boxShadow: `0 4px 12px ${b.color}35` }} />
            <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 6, fontWeight: 700 }}>{b.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: acimaDaMeta ? 'rgba(34,197,94,0.08)' : 'rgba(249,115,22,0.08)', border: `1px solid ${acimaDaMeta ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)'}`, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{acimaDaMeta ? '📈' : '📉'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: acimaDaMeta ? '#22c55e' : '#f97316' }}>
          Projeção: {acimaDaMeta ? '+' : ''}{pctVsMeta.toFixed(1)}% {acimaDaMeta ? 'acima' : 'abaixo'} da meta
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>💵 Já realizado</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{fmtBRL(realizado)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>💓 Recorrência ainda prevista esse mês</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{fmtBRL(recorrenciaPrevista)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>🚀 Projeção de vendas novas no ritmo atual</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{fmtBRL(ritmoNovaVenda)}</span>
        </div>
      </div>
    </div>
  )
}


function ForecastHero({ total, monthly, detail }: {
  total: number
  monthly?: { label: string; ajustado: number }[]
  detail?: { mrrAtual: number; persistenceRate: number; sampleSize: number; ativas: number; atrasadas: number; emRisco: number; completas: number }
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const safeMonthly = monthly ?? []
  const safeDetail  = detail ?? { mrrAtual: 0, persistenceRate: 0, sampleSize: 0, ativas: 0, atrasadas: 0, emRisco: 0, completas: 0, restamAPagarMes: 0, atrasadasMes: 0, jaPagasMes: 0 }
  // Mesma técnica/proporção do RevenueChart — pra ter a mesma "cara" dos
  // outros gráficos do dashboard, em vez de um tratamento visual próprio.
  const W = 700, H = 90, padX = 10, padY = 18
  const max = Math.max(...safeMonthly.map(d => d.ajustado), 1)
  const min = Math.min(...safeMonthly.map(d => d.ajustado), 0)
  const range = Math.max(max - min, 1)
  const step = safeMonthly.length > 1 ? (W - padX * 2) / (safeMonthly.length - 1) : 0
  const pts = safeMonthly.map((d, i) => ({ x: padX + i * step, y: padY + (H - padY - 14) * (1 - (d.ajustado - min) / range) }))
  const linePath = smoothPath(pts)
  const areaPath = pts.length > 1 ? `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z` : ''

  // 'restam a pagar', 'atrasadas' e 'já pagas' agora são recortados pro MÊS
  // ATUAL (mudam de verdade dia a dia), não mais uma foto da vida inteira da
  // base de assinaturas. 'Em risco' continua sendo um sinal de todo o
  // histórico — é sobre saúde/churn, faz sentido independente do mês.
  const healthItems = [
    { label: 'restam a pagar este mês', count: safeDetail.restamAPagarMes ?? safeDetail.ativas, emoji: '💚' },
    { label: 'atrasadas',               count: safeDetail.atrasadasMes ?? safeDetail.atrasadas, emoji: '⏰' },
    { label: 'em risco',                count: safeDetail.emRisco,                              emoji: '⚠️' },
    { label: 'já pagas este mês',       count: safeDetail.jaPagasMes ?? safeDetail.completas,    emoji: '✅' },
  ].filter(h => h.count > 0)

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 18px', boxShadow: 'var(--shadow-sm)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeartPulse size={15} style={{ color: '#0d9488' }} />
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Sinal vital da recorrência</p>
        </div>
        <Link href="/intel" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#0d9488', textDecoration: 'none' }}>
          Ver detalhe <ArrowRight size={11} />
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 'clamp(26px,3vw,32px)', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
          <CountUp value={total} format={fmtBRL} />
        </p>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>esperado até dezembro</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
        Recebido este mês: <strong style={{ color: 'var(--foreground)' }}>{fmtBRL(safeDetail.mrrAtual)}</strong>
        {' · '}aderência histórica <strong style={{ color: '#0d9488' }}>{safeDetail.persistenceRate.toFixed(0)}%</strong>
      </p>

      {safeMonthly.length > 1 && (
        <div style={{ width: '100%', overflow: 'visible', marginTop: 8 }}>
          <svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity=".3" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path d={areaPath} fill="url(#fcGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
            <motion.path d={linePath} fill="none" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
            {pts.map((p, i) => {
              const isFirst = i === 0 // mês mais próximo/confiável — o que importa mais aqui
              const isHovered = hovered === i
              return (
                <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                  {isHovered && (
                    <line x1={p.x} y1={padY - 4} x2={p.x} y2={H} stroke="#0d9488" strokeWidth={1} strokeDasharray="3 3" opacity={0.35} />
                  )}
                  <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                  <motion.circle cx={p.x} cy={p.y} r={isHovered ? 6 : isFirst ? 4.5 : 3} fill={isHovered || isFirst ? '#0d9488' : 'var(--card)'} stroke="#0d9488" strokeWidth={1.5}
                    animate={{ r: isHovered ? 6 : isFirst ? 4.5 : 3 }} transition={{ duration: 0.15 }}
                    initial={{ scale: 0 }} style={{ scale: 1 }} />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={isHovered ? 12.5 : 11} fontWeight={isHovered || isFirst ? 800 : 600} fill={isHovered || isFirst ? '#0d9488' : 'var(--muted-foreground)'}>
                    {safeMonthly[i].ajustado >= 1000 ? `${(safeMonthly[i].ajustado / 1000).toFixed(1)}k` : safeMonthly[i].ajustado.toFixed(0)}
                  </text>
                  <text x={p.x} y={H + 16} textAnchor="middle" fontSize={10} fontWeight={isHovered ? 800 : 400} fill={isHovered ? '#0d9488' : 'var(--muted-foreground)'}>{safeMonthly[i].label}</text>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {healthItems.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {healthItems.map(h => (
            <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 12 }}>{h.emoji}</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                <strong style={{ color: 'var(--foreground)' }}>{h.count}</strong> {h.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Mural de insights de IA — nível de empresa ────────────────
// Paleta por GRAVIDADE, não por "tipo de ação" como antes (que deixava tudo
// vermelho/laranja e parecia emergência igual pra tudo). O dado que vem do
// backend hoje só tem 3 categorias (alerta/oportunidade/destaque) — dentro
// de "alerta", uma heurística de texto separa Crítico de Atenção, olhando
// padrões como "caiu/queda X%" ou "sem vender há N dias". Isso é só uma
// classificação de apresentação; se quiser que a própria IA já devolva o
// nível de gravidade (mais preciso), isso exigiria mudar o gerador dos
// insights (fora do escopo de design).
const SEVERITY_STYLE = {
  critico: { label: 'Crítico',       emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.22)' },
  aviso:   { label: 'Atenção',       emoji: '🟠', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.22)' },
  info:    { label: 'Oportunidade',  emoji: '🔵', color: '#3b82f6', bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.22)' },
} as const

function classifySeverity(ins: { type: string; titulo: string; motivo: string | null }): keyof typeof SEVERITY_STYLE {
  if (ins.type !== 'alerta') return 'info'
  const text = `${ins.titulo} ${ins.motivo ?? ''}`.toLowerCase()
  const hasDropLanguage = /(caiu|queda|abaixo|despenc)/.test(text)
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/)
  const pct = pctMatch ? parseFloat(pctMatch[1]) : 0
  const daysMatch = text.match(/(\d+)\s*dias?/)
  const days = daysMatch ? parseInt(daysMatch[1]) : 0
  const isBigDrop = hasDropLanguage && pct >= 25
  const isLongInactive = days >= 6 && /sem vender|sem vendas|inativ/.test(text)
  return (isBigDrop || isLongInactive) ? 'critico' : 'aviso'
}

function InsightRow({ ins, severity, isOpen, onToggle, isLast }: {
  ins: { type: 'alerta' | 'oportunidade' | 'destaque'; titulo: string; motivo: string | null; sugestao: string | null }
  severity: keyof typeof SEVERITY_STYLE; isOpen: boolean; onToggle: () => void; isLast: boolean
}) {
  const s = SEVERITY_STYLE[severity]
  const hasDetail = !!(ins.motivo || ins.sugestao)
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <button onClick={onToggle} disabled={!hasDetail}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: 'transparent', border: 'none', cursor: hasDetail ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
        onMouseEnter={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: severity === 'critico' ? `0 0 6px ${s.color}` : 'none' }} />
        <span style={{ fontSize: 15, flexShrink: 0 }}>{s.emoji}</span>
        <p style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.4 }}>{ins.titulo}</p>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '3px 9px', borderRadius: 999, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
          {s.label}
        </span>
        {hasDetail && (
          <ChevronDown size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && hasDetail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 16px 16px 46px' }}>
              {ins.motivo && (
                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>Provável motivo</span>
                  <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.5 }}>{ins.motivo}</p>
                </div>
              )}
              {ins.sugestao && (
                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>Sugestão</span>
                  <p style={{ fontSize: 12.5, color: 'var(--foreground)', margin: '3px 0 0', lineHeight: 1.5, fontWeight: 600 }}>{ins.sugestao}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function InsightMural({ insights }: { insights: { type: 'alerta' | 'oportunidade' | 'destaque'; titulo: string; motivo: string | null; sugestao: string | null }[] }) {
  // Aberto por padrão só o primeiro item de maior gravidade — o resto começa
  // recolhido, pra não repetir a poluição visual de antes.
  const classified = useMemo(() => (insights ?? []).map(ins => ({ ins, severity: classifySeverity(ins) })), [insights])
  const order: Record<string, number> = { critico: 0, aviso: 1, info: 2 }
  const sorted = useMemo(() => [...classified].sort((a, b) => order[a.severity] - order[b.severity]), [classified])
  const firstCriticalIdx = sorted.findIndex(x => x.severity === 'critico')
  const [openIdx, setOpenIdx] = useState<number | null>(firstCriticalIdx >= 0 ? firstCriticalIdx : (sorted.length > 0 ? 0 : null))

  if (!insights || insights.length === 0) return null

  const counts = { critico: sorted.filter(x => x.severity === 'critico').length, aviso: sorted.filter(x => x.severity === 'aviso').length, info: sorted.filter(x => x.severity === 'info').length }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <Stethoscope size={15} style={{ color: '#a855f7' }} />
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Diagnóstico do Dia</p>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· gerado 1x por dia, olhando o painel inteiro</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['critico', 'aviso', 'info'] as const).filter(k => counts[k] > 0).map(k => (
            <span key={k} style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_STYLE[k].color, background: SEVERITY_STYLE[k].bg, border: `1px solid ${SEVERITY_STYLE[k].border}`, padding: '2px 8px', borderRadius: 999 }}>
              {counts[k]} {SEVERITY_STYLE[k].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {sorted.map(({ ins, severity }, i) => (
          <InsightRow key={i} ins={ins} severity={severity} isOpen={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} isLast={i === sorted.length - 1} />
        ))}
      </div>
    </div>
  )
}

// ── Divisor de pulso — pequeno toque de identidade médica entre seções ──
function PulseDivider() {
  const pathD = 'M0,10 L40,10 L48,10 L53,2 L58,18 L63,10 L72,10 L200,10'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 12px', opacity: 0.5 }}>
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
        width: 155, height: 225, flexShrink: 0, marginLeft: index === 0 ? 0 : -52,
        cursor: 'pointer', position: 'relative', perspective: 1200,
        transform: hovered ? 'rotate(0deg) translateY(-18px) scale(1.06)' : `rotate(${rot}deg)`,
        transition: 'transform .3s ease', zIndex: hovered ? 999 : index,
      }}>
      <motion.div
        animate={{ rotateY: hovered ? 180 : 0 }}
        transition={{ duration: 0.55, ease: 'easeInOut' }}
        style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}>

        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', boxShadow: hovered ? '0 20px 40px rgba(0,0,0,.25)' : 'var(--shadow-md)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${teamColor},${teamColor}88)` }} />
          {topBadge && (
            <div title={topBadge.label} style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%', background: 'var(--card)', border: `1.5px solid ${topBadge.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
              {topBadge.emoji}
            </div>
          )}
          <div style={{ padding: '17px 12px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: teamColor, background: `${teamColor}18`, padding: '2px 10px', borderRadius: 999, marginBottom: 10 }}>{c.team ?? '—'}</span>
            <Avatar name={c.name} url={c.avatarUrl} size={56} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '10px 0 2px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{c.name}</p>
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '0 0 10px' }}>#{c.rank} no ranking</p>
            <div style={{ marginTop: 'auto', width: '100%', textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: c.pctGoal >= 100 ? '#22c55e' : 'var(--foreground)', margin: 0, lineHeight: 1 }}>{c.pctGoal.toFixed(0)}%</p>
              <p style={{ fontSize: 9, color: 'var(--muted-foreground)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>da meta</p>
            </div>
          </div>
        </div>

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
  commercialAnalysisInitial: any
  commercial: {
    totalRevMonth: number; totalSalesMonth: number; totalSalesToday: number; totalRevToday: number
    avgTicketAll: number; totalMoneyLeft: number; totalCertsMonth: number
    forecast: number; monthlyForecast: { label: string; ajustado: number }[]
    forecastDetail: { mrrAtual: number; persistenceRate: number; sampleSize: number; ativas: number; atrasadas: number; emRisco: number; completas: number; restamAPagarMes?: number; atrasadasMes?: number; jaPagasMes?: number }
    revenueByDay: { day: string; revenue: number }[]
    closerCards: any[]; totalGoalMonth: number; pctCompanyGoal: number
    productRanking: { product: string; vertical: string; count: number; rev: number }[]
    verticalBreakdown: { vertical: string; revenue: number; count: number; avgTicket: number; moneyLeft: number; avgDiscountPct: number }[]
    lastSaleAt: string | null
    pctMonthElapsed: number
    companyInsights: { type: 'alerta' | 'oportunidade' | 'destaque'; titulo: string; motivo: string | null; sugestao: string | null }[]
    metaGeralMes: number
    metaPorVertical: Record<string, number>
    forecastFechamentoMes: number
    projecaoRestanteNovaVenda: number
    recorrenciaPrevistaMes: number
    pctForecastVsMeta: number
    dailyCumulative: { day: number; realizado: number; ritmoLinear: number }[]
    daysInMonthTotal: number
  }
}

export function SuperDashboard({ userName, stats, users, progressByDay, commercial, commercialAnalysisInitial }: Props) {
  const [activities, setActivities] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [openCard, setOpenCard] = useState<any | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/admin/activity')
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoadingActivity(false) })
      .catch(() => setLoadingActivity(false))
  }, [])

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

  const usersWithPresence = users.map(u => ({ ...u, isOnline: onlineUsers.has(u.id) }))
  const onlineList = usersWithPresence.filter(u => u.isOnline)

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ background: 'linear-gradient(160deg,#0f0524 0%,#1e0a4a 35%,#2e1065 65%,#3b1590 100%)', borderRadius: 22, padding: 'clamp(18px,2.6vw,30px)', marginBottom: 18, position: 'relative', overflow: 'hidden', boxShadow: '0 20px 56px rgba(46,16,101,0.5)', minHeight: 190 }}>
        {/* Data — canto superior direito, discreta */}
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <RadialRays />
        <ParticleField />
        <RocketIllustration />
        <HeartbeatLine />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 13px', borderRadius: 999, background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: '1px solid rgba(196,181,253,0.3)' }}>
                <Sparkles size={11} /> Gestão360
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(18px,2.6vw,22px)', fontWeight: 800, color: '#fff', margin: '0 0 2px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {greet}, {userName}! 👋
            </h1>
            <h2 style={{
              fontSize: 'clamp(24px,3.6vw,34px)', fontWeight: 900, margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1.1,
              background: 'linear-gradient(90deg,#c4b5fd,#a78bfa,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Vamos pra cima hoje?
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', margin: '0 0 16px', maxWidth: 420, lineHeight: 1.55 }}>
              Acompanhe os principais indicadores e impulsione os resultados do nosso time.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />, label: 'Sistema online', sub: 'Todos os sistemas operando', labelColor: '#4ade80' },
                { icon: <Users size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />, label: `${onlineList.length} online agora`, sub: 'Conectados no sistema', labelColor: '#fff' },
              ].map((chip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                  {chip.icon}
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 800, color: chip.labelColor, margin: 0, lineHeight: 1.25 }}>{chip.label}</p>
                    <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.25 }}>{chip.sub}</p>
                  </div>
                </div>
              ))}
              <LiveTickerChip lastSaleAt={commercial.lastSaleAt} />
            </div>
          </div>

          {/* Painel da meta — moldura própria, como na referência.
              Usa a MESMA base do card "Meta x Realizado" mais abaixo
              (meta oficial da empresa, não a soma das metas individuais
              dos closers) — senão os dois números do dashboard podem
              contradizer um ao outro. */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(196,181,253,0.25)', borderRadius: 18, padding: '16px 22px', backdropFilter: 'blur(10px)', textAlign: 'center', flexShrink: 0 }}>
            <DualRingGauge
              pctGoal={commercial.metaGeralMes > 0 ? Math.min((commercial.totalRevMonth / commercial.metaGeralMes) * 100, 100) : 0}
              pctMonth={commercial.pctMonthElapsed} />
          </div>
        </div>
      </div>

      <InsightMural insights={commercial.companyInsights} />

      <CommercialAnalysis initialData={commercialAnalysisInitial} />

      <PulseDivider />

      <div className="sd-row-meta" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 12, marginBottom: 12 }}>
        <MetaRealizadoCard meta={commercial.metaGeralMes} realizado={commercial.totalRevMonth} evolucao={commercial.dailyCumulative} diasNoMes={commercial.daysInMonthTotal} />
        <ClosingForecastCard realizado={commercial.totalRevMonth} recorrenciaPrevista={commercial.recorrenciaPrevistaMes} ritmoNovaVenda={commercial.projecaoRestanteNovaVenda}
          forecast={commercial.forecastFechamentoMes} meta={commercial.metaGeralMes} pctVsMeta={commercial.pctForecastVsMeta} />
      </div>

      <div className="sd-row2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 12, marginBottom: 12 }}>

        <ForecastHero total={commercial.forecast} monthly={commercial.monthlyForecast} detail={commercial.forecastDetail} />

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '15px 17px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
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

      <PulseDivider />

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
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

      <div className="sd-row3" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HeartPulse size={14} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Atividade recente</p>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>últimos 7 dias</span>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 0' }} className="scrollbar-hide">
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

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @media (max-width: 1024px) {
          .sd-row2 { grid-template-columns: 1fr !important; }
          .sd-row-meta { grid-template-columns: 1fr !important; }
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
