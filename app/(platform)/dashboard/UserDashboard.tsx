'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Play, CheckCircle2, Circle, Lock, Clock, ArrowRight,
  BookOpen, Video, HelpCircle, Trophy, Zap, Target,
  ChevronRight, TrendingUp, AlertCircle, Star, Flame,
  DollarSign, AlertTriangle, Sparkles, Award, Stethoscope, ExternalLink
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)       return 'agora'
  if (diff < 3600)     return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 86400*7)  return `${Math.floor(diff / 86400)}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Avatar({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.35)', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.36), fontWeight: 800, color: '#fff', border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function StatusIcon({ done, blocked, isNext, active }: any) {
  if (done)    return <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
  if (blocked) return <Lock size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
  if (active || isNext) return (
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(79,70,229,0.4)' }}>
      <Play size={9} style={{ color: '#fff', fill: '#fff', marginLeft: 1 }} />
    </div>
  )
  return <Circle size={18} style={{ color: 'var(--border)', flexShrink: 0 }} />
}

// ── Formatação de moeda ────────────────────────────────────────
function fmtBRL(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Link direto pro negócio no HubSpot ──────────────────────────
function hubspotDealUrl(dealId: string): string {
  return `https://app.hubspot.com/contacts/48628516/record/0-3/${dealId}`
}

// ── Contador animado — conta do zero até o valor ────────────────
function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 1100, start = performance.now(), from = display
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

// ── Curva suave (mesma técnica usada no telão/dashboard) ────────
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

// ── Mini gráfico de linha (receita pessoal, últimos 7 dias) ─────
function MyRevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const W = 700, H = 90, padX = 10, padY = 18
  const max = Math.max(...data.map(d => d.revenue), 1)
  const step = (W - padX * 2) / (data.length - 1)
  const pts = data.map((d, i) => ({ x: padX + i * step, y: padY + (H - padY - 14) * (1 - d.revenue / max) }))
  const linePath = smoothPath(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`
  return (
    <svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="myRevGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity=".3" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={areaPath} fill="url(#myRevGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
      <motion.path d={linePath} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      {pts.map((p, i) => {
        const isLast = i === pts.length - 1
        const isHovered = hovered === i
        return (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
            <motion.circle cx={p.x} cy={p.y} r={isHovered ? 6 : isLast ? 4.5 : 3} fill={isHovered || isLast ? '#22c55e' : 'var(--card)'} stroke="#22c55e" strokeWidth={1.5}
              animate={{ r: isHovered ? 6 : isLast ? 4.5 : 3 }} transition={{ duration: 0.15 }} />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={isHovered ? 12.5 : 11} fontWeight={isHovered || isLast ? 800 : 600} fill={isHovered || isLast ? '#22c55e' : 'var(--muted-foreground)'}>
              {data[i].revenue >= 1000 ? `${(data[i].revenue / 1000).toFixed(1)}k` : data[i].revenue.toFixed(0)}
            </text>
            <text x={p.x} y={H + 16} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">{data[i].day}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── "Seu ritmo" — transforma números isolados (ticket médio, vendas no
// mês) numa interpretação: no ritmo certo pra bater a meta, ou não. Cálculo
// 100% derivado de `commercial`, sem nenhum dado novo do backend.
function MyPaceCard({ commercial }: { commercial: NonNullable<Props['commercial']> }) {
  if (commercial.goalSales <= 0) return null

  const now = new Date()
  const diaAtual = now.getDate()
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const diasRestantes = Math.max(diasNoMes - diaAtual + 1, 1)

  const ritmoAtual = commercial.salesCount / diaAtual
  const receitaRestante = Math.max(commercial.goalSales - commercial.revenue, 0)
  const vendasRestantesEstimadas = commercial.avgTicket > 0 ? receitaRestante / commercial.avgTicket : 0
  const ritmoNecessario = vendasRestantesEstimadas / diasRestantes
  const acimaDoRitmo = ritmoNecessario > 0 ? ((ritmoAtual - ritmoNecessario) / ritmoNecessario) * 100 : null
  const noRitmo = acimaDoRitmo === null || acimaDoRitmo >= 0

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>⚡ Seu ritmo</p>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 18px' }}>
        {noRitmo ? 'Você está vendendo no ritmo certo (ou acima) para bater sua meta.' : 'Seu ritmo atual está abaixo do necessário para bater a meta este mês.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div>
          <p style={{ fontSize: 21, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{fmtBRL(commercial.avgTicket)}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Ticket médio</p>
        </div>
        <div>
          <p style={{ fontSize: 21, fontWeight: 900, color: noRitmo ? '#22c55e' : '#f97316', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{ritmoAtual.toFixed(1)} venda/dia</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Ritmo atual</p>
        </div>
        <div>
          <p style={{ fontSize: 21, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{ritmoNecessario.toFixed(1)} venda/dia</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Ritmo necessário</p>
        </div>
      </div>
      {acimaDoRitmo !== null && (
        <p style={{ fontSize: 12.5, fontWeight: 700, color: noRitmo ? '#16a34a' : '#ea580c', margin: '16px 0 0' }}>
          {acimaDoRitmo >= 0 ? '+' : ''}{acimaDoRitmo.toFixed(0)}% {acimaDoRitmo >= 0 ? 'acima' : 'abaixo'} do ritmo necessário
        </p>
      )}
      {acimaDoRitmo === null && ritmoAtual > 0 && (
        <p style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', margin: '16px 0 0' }}>Meta já garantida no ritmo atual 🎉</p>
      )}
    </div>
  )
}

// ── Mini barras por vertical (só as vendas dele) ────────────────
function MyVerticalBars({ data }: { data: { vertical: string; revenue: number; count: number }[] }) {
  if (data.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '30px 0' }}>Nenhuma venda registrada este mês ainda.</p>
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
      {data.map((d, i) => {
        const h = Math.max((d.revenue / max) * 74, d.revenue > 0 ? 6 : 2)
        const shortLabel = d.vertical.replace('-Review', '')
        return (
          <div key={d.vertical} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#8b5cf6', whiteSpace: 'nowrap' }}>{fmtBRL(d.revenue)}</span>
            <motion.div initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.65, delay: i * 0.08, ease: 'easeOut' }}
              style={{ width: '100%', minHeight: 3, borderRadius: '5px 5px 0 0', background: 'linear-gradient(180deg,#8b5cf6,#8b5cf699)', marginTop: 4 }} />
            <span style={{ fontSize: 8.5, color: 'var(--muted-foreground)', marginTop: 6, textAlign: 'center', lineHeight: 1.2 }}>{shortLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── KPI pessoal compacto ─────────────────────────────────────────
function MyKpiCard({ icon: Icon, label, rawValue, format = fmtBRL, sub, grad, color }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--shadow-sm)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
      <div style={{ width: 38, height: 38, borderRadius: 11, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, boxShadow: `0 4px 12px ${color}35` }}>
        <Icon size={16} style={{ color: '#fff' }} />
      </div>
      <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1, letterSpacing: '-0.03em' }}>
        <CountUp value={rawValue} format={format} />
      </p>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 10, color, marginTop: 4, fontWeight: 700 }}>{sub}</p>}
    </motion.div>
  )
}

// ── Resumo do mês — linguagem natural, calculada a partir dos mesmos
// números que já vêm em `commercial` (nada de novo do backend). O insight
// gerado pela IA continua exibido, só que como nota secundária — não
// removi nada, só dei mais peso ao que é direto e humano primeiro.
function MonthSummary({ commercial }: { commercial: NonNullable<Props['commercial']> }) {
  let insight: { resumo?: string; destaque?: string | null; atencao?: string | null } = {}
  try { insight = commercial.insight ? JSON.parse(commercial.insight) : {} } catch { insight = { resumo: commercial.insight } }

  const hasGoal = commercial.goalSales > 0
  const overGoalPct = hasGoal ? commercial.pctGoal - 100 : null

  // Vertical onde o desconto médio dele está mais abaixo da média do time
  // (ou seja, o melhor resultado em disciplina de desconto)
  const bestDiscount = commercial.discountByVertical.length > 0
    ? [...commercial.discountByVertical].sort((a, b) => (a.avgPct - a.companyAvgPct) - (b.avgPct - b.companyAvgPct))[0]
    : null
  const bestDiscountGap = bestDiscount ? bestDiscount.companyAvgPct - bestDiscount.avgPct : 0

  const headline = !hasGoal
    ? 'Confira como está seu mês até agora.'
    : commercial.pctGoal >= 100
      ? 'Você já bateu sua meta. 🔥'
      : `Faltam ${fmtBRL(commercial.goalSales - commercial.revenue)} para bater a meta.`

  return (
    <div>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Seu mês até agora</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.01em' }}>{headline}</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.5 }}>
        {fmtMoneyCompact(commercial.revenue)} vendidos{overGoalPct !== null ? ` — ${Math.abs(overGoalPct).toFixed(0)}% ${overGoalPct >= 0 ? 'acima' : 'abaixo'} do objetivo.` : '.'}
      </p>
      {bestDiscount && bestDiscountGap > 0.5 && (
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', lineHeight: 1.5 }}>
          Seu melhor resultado está vindo da <strong style={{ color: '#fff' }}>{bestDiscount.vertical}</strong>, onde seu desconto médio está {bestDiscountGap.toFixed(1)} p.p. abaixo da média do time.
        </p>
      )}
      {insight.resumo && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', gap: 7 }}>
            <Sparkles size={12} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.4 }}>{insight.resumo}</p>
          </div>
          {insight.destaque && <p style={{ fontSize: 11, color: '#dcfce7', margin: 0, paddingLeft: 4, opacity: 0.85 }}>✅ {insight.destaque}</p>}
          {insight.atencao && <p style={{ fontSize: 11, color: '#fef3c7', margin: 0, paddingLeft: 4, opacity: 0.85 }}>⚠️ {insight.atencao}</p>}
        </div>
      )}
    </div>
  )
}

// ── A carta principal — premium e editorial. Sem avatar (já está na
// sidebar), sem grid de indicadores duplicado (já tem no grid de KPIs logo
// abaixo) — só o essencial: quem, quanto, contra qual meta, e por quê.
function MyBigCard({ userName, avatarUrl, teamName, commercial }: { userName: string; avatarUrl?: string | null; teamName: string; commercial: NonNullable<Props['commercial']> }) {
  const teamColor = teamName === 'R1' ? '#8b5cf6' : teamName === 'OAO' ? '#3b82f6' : '#6366f1'
  const firstName = userName.split(' ')[0]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{ background: `linear-gradient(135deg,${teamColor}ee,${teamColor}bb)`, borderRadius: 22, padding: 'clamp(22px,3vw,32px)', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: `0 16px 48px ${teamColor}44` }}>
      <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 28, flexWrap: 'wrap' }}>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Avatar name={userName} url={avatarUrl} size={40} />
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{firstName}</p>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '2px 10px', borderRadius: 999 }}>#{commercial.rank} de {commercial.totalClosers} · Time {teamName || '—'}</span>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>Receita este mês</p>
          <p style={{ fontSize: 'clamp(32px,4.5vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1 }}>
            <CountUp value={commercial.revenue} format={fmtBRL} />
          </p>
          {commercial.goalSales > 0 && (
            <div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(commercial.pctGoal, 100)}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                  style={{ height: '100%', background: commercial.pctGoal >= 100 ? '#4ade80' : '#fff', borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{commercial.pctGoal.toFixed(0)}% da meta ({fmtBRL(commercial.goalSales)})</span>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 260, borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 28 }} className="mybigcard-divider">
          <MonthSummary commercial={commercial} />
        </div>
      </div>
    </motion.div>
  )
}

// ── Widget de links expirando/vencidos — pra cobrar leads a tempo ────

// Deal_name às vezes vem como "Nome | email@algo.com" — separa pra dar
// destaque ao nome e deixar o e-mail como informação secundária.
function parseDealName(dealName: string | null): { primary: string; secondary: string | null } {
  if (!dealName) return { primary: 'Sem nome', secondary: null }
  const parts = dealName.split('|').map(s => s.trim()).filter(Boolean)
  if (parts.length > 1) return { primary: parts[0], secondary: parts.slice(1).join(' · ') }
  return { primary: dealName, secondary: null }
}

function spDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function urgencyInfo(expiresAt: string | null): { label: string; color: string; bg: string; dot: string } {
  if (!expiresAt) return { label: '—', color: '#94a3b8', bg: 'rgba(148,163,184,.1)', dot: '⚪' }
  const now = new Date(), target = new Date(expiresAt)
  const time = target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (target.getTime() < now.getTime()) {
    const daysAgo = Math.max(1, Math.round((now.getTime() - target.getTime()) / 86400000))
    return { label: `Expirado há ${daysAgo}d`, color: '#f87171', bg: 'rgba(248,113,113,.12)', dot: '🔴' }
  }
  const todayStr = spDateStr(now), tomorrowStr = spDateStr(new Date(now.getTime() + 86400000)), targetStr = spDateStr(target)
  if (targetStr === todayStr)    return { label: `Hoje · ${time}`,   color: '#fb923c', bg: 'rgba(251,146,60,.12)', dot: '🟠' }
  if (targetStr === tomorrowStr) return { label: `Amanhã · ${time}`, color: '#fbbf24', bg: 'rgba(251,191,36,.12)', dot: '🟡' }
  const daysAhead = Math.ceil((target.getTime() - now.getTime()) / 86400000)
  return { label: `Em ${daysAhead}d`, color: '#94a3b8', bg: 'rgba(148,163,184,.1)', dot: '⚪' }
}

function fmtMoneyCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')} mi`
  if (v >= 1_000) return `R$ ${(v / 1000).toFixed(0)}k`
  return fmtBRL(v)
}

function LinkAlerts({ alerts }: { alerts: NonNullable<Props['linkAlerts']> }) {
  const { expiringSoon, expired } = alerts
  if (expiringSoon.length === 0 && expired.length === 0) return null

  const now = new Date()
  const todayStr = spDateStr(now), tomorrowStr = spDateStr(new Date(now.getTime() + 86400000))
  const hoje    = expiringSoon.filter((l: any) => l.expires_at && spDateStr(new Date(l.expires_at)) === todayStr)
  const amanha  = expiringSoon.filter((l: any) => l.expires_at && spDateStr(new Date(l.expires_at)) === tomorrowStr)
  const totalAguardando = [...expiringSoon, ...expired].reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ hoje: true, amanha: true, vencidos: false })
  function toggle(key: string) { setOpenSections(s => ({ ...s, [key]: !s[key] })) }

  function Row({ l }: { l: any }) {
    const { primary, secondary } = parseDealName(l.deal_name)
    const u = urgencyInfo(l.expires_at)
    const [hovered, setHovered] = useState(false)
    return (
      <div onClick={() => l.deal_id && window.open(hubspotDealUrl(l.deal_id), '_blank')}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 14px', cursor: l.deal_id ? 'pointer' : 'default', transition:'background .1s', background: hovered ? 'var(--secondary)' : 'transparent' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--foreground)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{primary}</p>
          {(l.product_name || secondary) && <p style={{ fontSize:9.5, color:'var(--muted-foreground)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.product_name ?? secondary}</p>}
        </div>
        <span style={{ fontSize:13, fontWeight:900, color:'var(--foreground)', flexShrink:0 }}>{fmtBRL(l.deal_value)}</span>
        <span style={{ fontSize:9.5, fontWeight:800, padding:'2px 7px', borderRadius:999, background:u.bg, color:u.color, flexShrink:0, whiteSpace:'nowrap' }}>{u.dot} {u.label}</span>
        {l.deal_id && (
          <span style={{ fontSize:10, fontWeight:700, color:'#818cf8', opacity: hovered ? 1 : 0.3, transition:'opacity .15s', flexShrink:0, display:'flex', alignItems:'center', gap:2 }}>
            <ExternalLink size={11}/>
          </span>
        )}
      </div>
    )
  }

  function Section({ id, emoji, label, count, rows }: { id: string; emoji: string; label: string; count: number; rows: any[] }) {
    if (count === 0) return null
    const open = openSections[id]
    return (
      <div>
        <button onClick={() => toggle(id)}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'transparent', border:'none', borderTop:'1px solid var(--border)', cursor:'pointer', padding:'8px 14px', fontFamily:'inherit' }}>
          <span style={{ fontSize:10, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.05em' }}>{emoji} {label} — {count}</span>
          <span style={{ fontSize:11, fontWeight:700, color:'#6366f1' }}>{open ? '▲' : '▼'}</span>
        </button>
        {open && rows.map((l: any) => <Row key={l.id} l={l} />)}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
      <div style={{ padding: '15px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertCircle size={14} style={{ color: '#d97706' }} />
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Links pendentes</p>
        </div>
        <p style={{ fontSize: 17, fontWeight: 900, color: '#d97706', margin: '0 0 10px' }}>
          {fmtMoneyCompact(totalAguardando)} <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>em potencial aguardando ação</span>
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:6, height:28, padding:'0 12px', borderRadius:999, background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.3)', color:'#d97706', fontSize:11, fontWeight:800 }}>
            🟡 {hoje.length + amanha.length} urgente{(hoje.length + amanha.length) !== 1 ? 's' : ''}
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:6, height:28, padding:'0 12px', borderRadius:999, background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)', color:'#f87171', fontSize:11, fontWeight:800 }}>
            🔴 {expired.length} vencido{expired.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <Section id="hoje"     emoji="🟠" label="Vencem hoje"   count={hoje.length}    rows={hoje}/>
      <Section id="amanha"   emoji="🟡" label="Vencem amanhã" count={amanha.length}  rows={amanha}/>
      <Section id="vencidos" emoji="🔴" label="Vencidos sem reemissão" count={expired.length} rows={expired}/>
    </div>
  )
}

// ── "Atenção" — distila os sinais mais importantes (links vencidos, meta)
// num painel curto, tipo assistente. Não busca nada novo — só reorganiza
// os mesmos dados de `linkAlerts` e `commercial` que já chegam por prop.
function AttentionPanel({ linkAlerts, commercial }: { linkAlerts?: Props['linkAlerts']; commercial?: Props['commercial'] }) {
  const items: { color: string; bg: string; border: string; title: string; sub?: string }[] = []

  if (linkAlerts) {
    const { expiringSoon, expired } = linkAlerts
    if (expired.length > 0) {
      const potencial = expired.reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)
      items.push({
        color: '#f87171', bg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.25)',
        title: `${expired.length} link${expired.length !== 1 ? 's' : ''} vencido${expired.length !== 1 ? 's' : ''}`,
        sub: `${fmtMoneyCompact(potencial)} em potencial parado`,
      })
    }
    const now = new Date(), todayStr = spDateStr(now)
    const hojeList = expiringSoon.filter((l: any) => l.expires_at && spDateStr(new Date(l.expires_at)) === todayStr)
    if (hojeList.length > 0) {
      const top = [...hojeList].sort((a: any, b: any) => (Number(b.deal_value) || 0) - (Number(a.deal_value) || 0))[0]
      const { primary } = parseDealName(top.deal_name)
      items.push({
        color: '#fbbf24', bg: 'rgba(251,191,36,.08)', border: 'rgba(251,191,36,.25)',
        title: hojeList.length === 1 ? '1 link vence hoje' : `${hojeList.length} links vencem hoje`,
        sub: `${primary} · ${fmtBRL(top.deal_value)}`,
      })
    }
  }

  if (commercial && commercial.goalSales > 0 && commercial.pctGoal >= 100) {
    items.push({
      color: '#4ade80', bg: 'rgba(74,222,128,.08)', border: 'rgba(74,222,128,.25)',
      title: `Você está ${(commercial.pctGoal - 100).toFixed(0)}% acima da meta`,
      sub: 'Continue nesse ritmo até o fim do mês.',
    })
  }

  if (items.length === 0) return null

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 18px', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        <Zap size={14} style={{ color: '#f59e0b' }} />
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Atenção</p>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>· {items.length} coisa{items.length !== 1 ? 's' : ''} precisa{items.length === 1 ? '' : 'm'} da sua atenção</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: it.bg, border: `1px solid ${it.border}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{it.title}</p>
              {it.sub && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{it.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


interface Step {
  id: string; title: string; day_number?: number | null
  estimated_minutes?: number | null; status: string
  quiz_score?: number | null; completed_at?: string | null
  completion_criteria?: string
}

interface Props {
  userName: string; avatarUrl?: string | null; teamName: string
  completed: number; total: number; pct: number
  steps: Step[]; uncheckedMaterials: any[]
  trailMode: string
  commercial?: {
    revenue: number; salesCount: number; avgTicket: number; goalSales: number; pctGoal: number
    revToday: number; salesTodayCount: number; moneyLeft: number; certsCount: number
    daysSinceLastSale: number | null; rank: number; totalClosers: number
    discountByVertical: { vertical: string; avgPct: number; companyAvgPct: number; count: number }[]
    verticalBreakdown: { vertical: string; revenue: number; count: number }[]
    revenueByDay: { day: string; revenue: number }[]
    insight: string
  }
  linkAlerts?: {
    expiringSoon: { id: string; deal_id: string | null; deal_name: string | null; deal_value: number | null; expires_at: string | null }[]
    expired: { id: string; deal_id: string | null; deal_name: string | null; deal_value: number | null; expires_at: string | null }[]
  }
}

export function UserDashboard({ userName, avatarUrl, teamName, completed, total, pct, steps, uncheckedMaterials, trailMode, commercial, linkAlerts }: Props) {
  const [activities, setActivities] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetch('/api/onboarding/my-activity')
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const hour      = new Date().getHours()
  const greet     = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = userName.split(' ')[0]
  const allDone   = pct === 100 && total > 0
  const isSeq     = trailMode === 'sequencial'

  const pending    = steps.filter(s => s.status !== 'concluido')
  const inProgress = steps.find(s => s.status === 'em_andamento')
  const nextStep   = pending[0]
  const current    = inProgress ?? nextStep

  function isBlocked(s: Step) {
    if (!isSeq) return false
    const idx = steps.findIndex(x => x.id === s.id)
    return idx > 0 && steps[idx - 1].status !== 'concluido'
  }

  // Pendências
  const tasks: { text: string; icon: any; color: string; href: string }[] = []
  uncheckedMaterials.slice(0, 3).forEach(m => {
    tasks.push({ text: `Assistir "${m.title}"`, icon: m.type === 'video' ? Video : BookOpen, color: m.type === 'video' ? '#8b5cf6' : '#3b82f6', href: `/onboarding/trilha/${m.step_id}` })
  })
  if (current?.completion_criteria?.includes('quiz')) {
    tasks.push({ text: `Finalizar avaliação: "${current.title}"`, icon: HelpCircle, color: '#f59e0b', href: `/onboarding/trilha/${current.id}` })
  }
  if (tasks.length === 0 && pending.length > 0) {
    tasks.push({ text: `Continuar: "${pending[0].title}"`, icon: Play, color: '#6366f1', href: `/onboarding/trilha/${pending[0].id}` })
  }

  // Sequência de dias para exibir cabeçalho
  let lastDay: number | null | undefined = undefined

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1080, margin: '0 auto' }}>

      {/* ── MEU DESEMPENHO COMERCIAL ─────────────────────────── */}
      {commercial && (
        <>
          <MyBigCard userName={userName} avatarUrl={avatarUrl} teamName={teamName} commercial={commercial} />

          <AttentionPanel linkAlerts={linkAlerts} commercial={commercial} />

          {linkAlerts && <LinkAlerts alerts={linkAlerts} />}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }} className="my-kpi-grid">
            <MyKpiCard icon={DollarSign} label="Receita do mês" rawValue={commercial.revenue} sub={`${commercial.salesCount} vendas`} grad="linear-gradient(135deg,#22c55e,#16a34a)" color="#22c55e" />
            <MyKpiCard icon={TrendingUp} label="Receita hoje" rawValue={commercial.revToday} sub={`${commercial.salesTodayCount} vendas`} grad="linear-gradient(135deg,#3b82f6,#4f46e5)" color="#3b82f6" />
            <MyKpiCard icon={Target} label="Ticket médio" rawValue={commercial.avgTicket} sub="só 1ª parcela de cada venda" grad="linear-gradient(135deg,#8b5cf6,#a855f7)" color="#8b5cf6" />
            <MyKpiCard icon={AlertTriangle} label="Deixado na mesa" rawValue={commercial.moneyLeft} sub={teamName === 'R1' ? `${commercial.certsCount} embaixadores certificados` : undefined} grad="linear-gradient(135deg,#f97316,#ef4444)" color="#f97316" />
          </div>

          <div className="my-row2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 8px' }}>📈 Minha receita — últimos 7 dias</p>
              <MyRevenueChart data={commercial.revenueByDay} />
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 14px' }}>🩺 Minhas vendas por vertical</p>
              <MyVerticalBars data={commercial.verticalBreakdown.filter(v => v.count > 0)} />
            </div>
          </div>

          <MyPaceCard commercial={commercial} />

          {commercial.discountByVertical.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 22px', boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px' }}>🏷️ Meu desconto médio por vertical</p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {commercial.discountByVertical.map(d => (
                  <div key={d.vertical} style={{ minWidth: 140, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 3px' }}>{d.vertical}</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#ef4444', margin: 0 }}>{d.avgPct.toFixed(1)}%</p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>time: {d.companyAvgPct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GRID PRINCIPAL ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>

        {/* ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Barra de progresso da trilha — junto com o resto do conteúdo
              de trilha, não mais competindo lá no topo com o comercial */}
          <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 28%,#4f46e5 65%,#7c3aed 100%)', borderRadius: 18, padding: 'clamp(16px,2.4vw,22px)', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 32px rgba(79,70,229,0.28)' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                  {allDone ? 'Trilha concluída! 🏆' : 'Sua Trilha Comercial'}
                </p>
              </div>

              {/* Barra de progresso fina, inline */}
              <div style={{ flex: '2 1 260px', minWidth: 180 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>{completed}/{total} módulos</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{pct}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    background: allDone ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#a78bfa,#818cf8,#fff)',
                    width: `${pct}%`, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
              </div>

              {/* CTA único, compacto */}
              {!allDone && current && (
                <Link href={`/onboarding/trilha/${current.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 11, background: '#fff', cursor: 'pointer', transition: 'all 0.18s', boxShadow: '0 3px 12px rgba(0,0,0,0.18)' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none' }}>
                    <Play size={12} style={{ color: '#4f46e5', fill: '#4f46e5' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#4f46e5', whiteSpace: 'nowrap' }}>
                      {inProgress ? 'Continuar' : 'Começar'}
                    </span>
                    <ArrowRight size={12} style={{ color: '#4f46e5' }} />
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Continue de onde parou */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>
                  <Target size={14} style={{ color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>📚 Trilha Comercial</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Progresso: {completed}/{total} módulos</p>
                </div>
              </div>
              <Link href="/onboarding/trilha" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1', textDecoration: 'none', padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}>
                Ver tudo <ArrowRight size={11} />
              </Link>
            </div>

            <div style={{ padding: '8px 0' }}>
              {steps.slice(0, 7).map((s, idx) => {
                const done    = s.status === 'concluido'
                const active  = s.status === 'em_andamento'
                const blocked = isBlocked(s)
                const isNext  = !done && !blocked && idx === steps.findIndex(x => x.status !== 'concluido')

                // Cabeçalho de dia
                const showDayHeader = s.day_number && s.day_number !== lastDay
                if (showDayHeader) lastDay = s.day_number

                return (
                  <div key={s.id}>
                    {showDayHeader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px 4px', marginTop: idx > 0 ? 2 : 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                          Dia {s.day_number}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}

                    {done || blocked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '1px solid var(--border)', opacity: blocked ? 0.4 : 0.7 }}>
                        <StatusIcon done={done} blocked={blocked} isNext={false} active={false} />
                        <p style={{ flex: 1, fontSize: 13, fontWeight: 500, color: done ? 'var(--muted-foreground)' : 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
                          {s.title}
                        </p>
                        {done && s.completed_at && (
                          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>✓</span>
                        )}
                      </div>
                    ) : (
                      <Link href={`/onboarding/trilha/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)', background: isNext ? 'rgba(99,102,241,0.04)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.07)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isNext ? 'rgba(99,102,241,0.04)' : 'transparent'}>
                          <StatusIcon done={false} blocked={false} isNext={isNext} active={active} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <p style={{ fontSize: 13, fontWeight: isNext ? 700 : 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                              {isNext && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', flexShrink: 0 }}>PRÓXIMO</span>}
                              {active && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>EM ANDAMENTO</span>}
                            </div>
                            {s.estimated_minutes && <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>⏱ {s.estimated_minutes} min</p>}
                          </div>
                          <ChevronRight size={14} style={{ color: isNext ? '#6366f1' : 'var(--muted-foreground)', flexShrink: 0 }} />
                        </div>
                      </Link>
                    )}
                  </div>
                )
              })}
              {steps.length > 7 && (
                <div style={{ padding: '10px 18px' }}>
                  <Link href="/onboarding/trilha" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
                    + {steps.length - 7} etapas restantes →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Pendências */}
          {tasks.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={14} style={{ color: '#d97706' }} />
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Pendências</p>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>{tasks.length}</span>
              </div>
              {tasks.map((t, i) => {
                const Icon = t.icon
                return (
                  <Link key={i} href={t.href} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: t.color + '14', border: `1px solid ${t.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} style={{ color: t.color }} />
                      </div>
                      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.4 }}>{t.text}</p>
                      <ArrowRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* KPIs pessoais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Concluídas', value: completed, color: '#22c55e', grad: 'linear-gradient(90deg,#22c55e,#16a34a)', icon: '🏆' },
              { label: 'Restantes',  value: pending.length, color: '#6366f1', grad: 'linear-gradient(90deg,#4f46e5,#7c3aed)', icon: '🎯' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.grad }} />
                <p style={{ fontSize: 11, margin: '6px 0 4px' }}>{k.icon}</p>
                <p style={{ fontSize: 28, fontWeight: 900, color: k.color, margin: '0 0 2px', letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Acesso rápido */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', boxShadow: 'var(--shadow-xs)' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acesso rápido</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: '/onboarding',            emoji: '🏠', label: 'Início Onboarding', color: '#4f46e5' },
                { href: '/onboarding/trilha',     emoji: '📚', label: 'Minha Trilha',       color: '#3b82f6' },
                { href: '/onboarding/videoaulas', emoji: '🎬', label: 'Videoaulas',         color: '#8b5cf6' },
                { href: '/onboarding/copilot',    emoji: '🤖', label: 'Medy',             color: '#ec4899' },
                { href: '/onboarding/progresso',  emoji: '📈', label: 'Meu Progresso',      color: '#22c55e' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', transition: 'all 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = item.color + '45'; el.style.background = item.color + '08'; el.style.transform = 'translateX(3px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--background)'; el.style.transform = 'none' }}>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{item.label}</span>
                    <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Atividades pessoais */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Minhas atividades</p>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }} className="scrollbar-hide">
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#6366f1', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                </div>
              ) : activities.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>Nenhuma atividade ainda.</p>
                  <Link href="/onboarding/trilha" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>Começar agora →</Link>
                </div>
              ) : activities.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < activities.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb,var(--secondary) 40%,transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{a.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--foreground)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                      {a.type === 'completion' && <><strong>Concluiu</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'quiz'       && <><strong>{a.detail && parseInt(a.detail) >= 70 ? 'Passou' : 'Fez quiz'}</strong> em &ldquo;{a.subject}&rdquo;{a.detail ? ` · ${a.detail}` : ''}</>}
                      {a.type === 'video'      && <><strong>Assistiu</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'material'   && <><strong>Concluiu material</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'simulado'   && <><strong>{a.detail && parseFloat(a.detail) >= 70 ? '🏅 Aprovado no' : '📋 Realizou o'}</strong> {a.subject}{a.detail ? ` · ${a.detail}` : ''}</>}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>{timeAgo(a.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @media (max-width: 1024px) { .my-row2 { grid-template-columns: 1fr !important; } }
        @media (max-width: 768px) { .my-kpi-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 480px) { .my-kpi-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
