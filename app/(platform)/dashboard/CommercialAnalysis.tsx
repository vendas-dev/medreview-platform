'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { PieChart, TrendingUp, Award, CalendarClock, DollarSign, Target, AlertTriangle } from 'lucide-react'

const PERIODS = [
  { id: 'hoje',   label: 'Hoje' },
  { id: 'ontem',  label: 'Ontem' },
  { id: 'semana', label: 'Essa semana' },
  { id: 'mes',    label: 'Este mês' },
]

function fmtBRL(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Contador animado — reaproveitado do resto do dashboard ─────
function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 900, start = performance.now(), from = display
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

// ── Avatar mini (mesmo padrão do resto do dashboard) ────────────
function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#eab308,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.36), fontWeight: 700, color: '#fff', flexShrink: 0, border: '2px solid var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
      {initials || '?'}
    </div>
  )
}

// ── KPI compacto (dentro da grade filtrada) ─────────────────────
function KpiMini({ icon: Icon, label, rawValue, sub, grad, color, href, big, format = fmtBRL }: any) {
  const content = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: big ? '20px 22px' : '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', height: '100%', display: 'flex', flexDirection: 'column', transition: 'all .18s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--shadow-sm)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
      <div style={{ width: big ? 42 : 38, height: big ? 42 : 38, borderRadius: 11, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${color}35`, marginBottom: big ? 16 : 10 }}>
        <Icon size={big ? 18 : 16} style={{ color: '#fff' }} />
      </div>
      <p style={{ fontSize: big ? 'clamp(26px,3vw,34px)' : 24, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1, letterSpacing: '-0.03em' }}>
        <CountUp value={rawValue} format={format} />
      </p>
      <p style={{ fontSize: big ? 12 : 11, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: big ? 11 : 10, color, marginTop: 4, fontWeight: 700 }}>{sub}</p>}
    </motion.div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>{content}</Link> : content
}

// ── Rosca — mesma técnica do /intel, com animação de desenho ──
function DonutChart({ data, size = 170, thickness = 28 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total <= 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '40px 0' }}>Sem vendas no período.</p>
  const r = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let offsetAcc = 0
  const filtered = data.filter(d => d.value > 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {filtered.map((d, i) => {
            const frac = d.value / total
            const dash = frac * circumference
            const offset = offsetAcc
            offsetAcc += dash
            return (
              <motion.circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1, duration: 0.5 }} />
            )
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', padding: '0 8px' }}>
          <span style={{ fontSize: Math.max(13, Math.min(19, size * 0.11)), fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.1 }}>
            <CountUp value={total} format={fmtBRL} />
          </span>
          <span style={{ fontSize: 9, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>total</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
        {data.map((d, i) => (
          <motion.div key={d.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600, flex: 1 }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)' }}>{fmtBRL(d.value)}</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', minWidth: 32, textAlign: 'right' }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Nova vs recorrente — barra segmentada animada ──────────────
function NovaVsRecorrenteBar({ nova, recorrente }: { nova: { rev: number; count: number }; recorrente: { rev: number; count: number } }) {
  const total = nova.rev + recorrente.rev
  const pctNova = total > 0 ? (nova.rev / total) * 100 : 0
  const pctRec  = total > 0 ? (recorrente.rev / total) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#22c55e', margin: 0, letterSpacing: '-0.02em' }}>{fmtBRL(nova.rev)}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Nova · {nova.count} vendas</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#8b5cf6', margin: 0, letterSpacing: '-0.02em' }}>{fmtBRL(recorrente.rev)}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Recorrente · {recorrente.count} vendas</p>
        </div>
      </div>
      <div style={{ height: 14, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pctNova}%` }} transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ height: '100%', background: 'linear-gradient(90deg,#16a34a,#22c55e)' }} />
        <motion.div initial={{ width: 0 }} animate={{ width: `${pctRec}%` }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          style={{ height: '100%', background: 'linear-gradient(90deg,#7c3aed,#8b5cf6)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{pctNova.toFixed(0)}%</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>{pctRec.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ── Embaixadores certificados por closer — com foto, centralizado ──
function CertsByCloserBars({ data }: { data: { name: string; count: number; avatarUrl: string | null }[] }) {
  if (data.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '50px 0' }}>Nenhuma certificação no período.</p>
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 170, overflowX: 'auto', justifyContent: data.length <= 6 ? 'center' : 'flex-start', paddingBottom: 4, paddingTop: 8 }} className="scrollbar-hide">
      {data.map((d, i) => {
        const h = Math.max((d.count / max) * 100, 10)
        return (
          <div key={d.name} title={`${d.name}: ${d.count}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', minWidth: 72, flexShrink: 0 }}>
            <Avatar name={d.name} url={d.avatarUrl} size={40} />
            <span style={{ fontSize: 13, fontWeight: 900, color: '#eab308', marginTop: 6 }}>{d.count}</span>
            <motion.div initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
              style={{ width: 36, minHeight: 6, borderRadius: '7px 7px 0 0', background: 'linear-gradient(180deg,#fbbf24,#eab308)', marginTop: 4, boxShadow: '0 4px 10px rgba(234,179,8,0.3)' }} />
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 6, textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name.split(' ')[0]}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Distribuição por dia da semana e por horário, com destaque no top ──
function WeekdayHourChart({ byWeekday, byHour, topDay, topHour }: {
  byWeekday: { label: string; rev: number; count: number }[]
  byHour: { hour: number; rev: number; count: number }[]
  topDay: { label: string; rev: number } | undefined
  topHour: { hour: number; rev: number } | undefined
}) {
  const maxDay  = Math.max(...byWeekday.map(d => d.rev), 1)
  const maxHour = Math.max(...byHour.map(d => d.rev), 1)
  return (
    <div>
      {(topDay?.rev ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>🏆 Top dia</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: '2px 0 0' }}>{topDay?.label} <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>{fmtBRL(topDay?.rev ?? 0)}</span></p>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>⏰ Top horário</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: '2px 0 0' }}>{String(topHour?.hour ?? 0).padStart(2, '0')}h <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 700 }}>{fmtBRL(topHour?.rev ?? 0)}</span></p>
          </div>
        </div>
      )}

      <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>Por dia da semana</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60, marginBottom: 20 }}>
        {byWeekday.map((d, i) => {
          const isTop = d.label === topDay?.label && d.rev === topDay?.rev && d.rev > 0
          const h = Math.max((d.rev / maxDay) * 44, d.rev > 0 ? 4 : 2)
          return (
            <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <motion.div initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.55, delay: i * 0.05, ease: 'easeOut' }}
                style={{ width: '100%', minHeight: 3, borderRadius: '4px 4px 0 0', background: isTop ? 'linear-gradient(180deg,#4ade80,#16a34a)' : 'linear-gradient(180deg,#22c55e55,#16a34a33)', boxShadow: isTop ? '0 0 10px rgba(34,197,94,0.5)' : 'none' }} />
              <span style={{ fontSize: 9, color: isTop ? '#22c55e' : 'var(--muted-foreground)', fontWeight: isTop ? 800 : 400, marginTop: 4 }}>{d.label}</span>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>Por horário</p>
      {/* Cada barra fica numa coluna de largura fixa igual, com o rótulo sempre
          reservado embaixo (vazio quando não é múltiplo de 3) — assim as
          barras ficam sempre alinhadas com o eixo, em vez de "pular" espaço
          quando o rótulo de uma hora não aparece. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 58 }}>
        {byHour.map((d, i) => {
          const isTop = d.hour === topHour?.hour && d.rev > 0
          const h = Math.max((d.rev / maxHour) * 40, d.rev > 0 ? 3 : 1)
          const showLabel = d.hour % 3 === 0
          return (
            <div key={d.hour} title={`${String(d.hour).padStart(2, '0')}h: ${fmtBRL(d.rev)}`}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <motion.div initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.4, delay: i * 0.015, ease: 'easeOut' }}
                style={{ width: '100%', minHeight: 2, borderRadius: '2px 2px 0 0', background: isTop ? 'linear-gradient(180deg,#60a5fa,#2563eb)' : 'linear-gradient(180deg,#3b82f655,#2563eb33)', boxShadow: isTop ? '0 0 8px rgba(59,130,246,0.5)' : 'none' }} />
              <span style={{ fontSize: 7.5, color: isTop ? '#3b82f6' : 'var(--muted-foreground)', fontWeight: isTop ? 800 : 400, marginTop: 3, height: 10, lineHeight: '10px' }}>
                {showLabel ? `${d.hour}h` : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Ranking de produtos — mesmo pódium do resto do sistema ──────
function ProductRankingMini({ data }: { data: { product: string; vertical: string; count: number; rev: number }[] }) {
  if (!data || data.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '40px 0' }}>Sem vendas no período.</p>
  const top3 = data.slice(0, 3)
  const rest = data.slice(3, 5)
  const visualOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as typeof top3
  const rankOf = (p: typeof top3[0]) => top3.indexOf(p)
  const PODIUM_HEIGHT = [78, 58, 44]
  const MEDAL = ['🥇', '🥈', '🥉']
  const GRAD  = ['linear-gradient(180deg,#fbbf24,#d97706)', 'linear-gradient(180deg,#cbd5e1,#94a3b8)', 'linear-gradient(180deg,#fb923c,#c2410c)']
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: rest.length > 0 ? 14 : 0 }}>
        {visualOrder.map((p, idx) => {
          const rank = rankOf(p)
          return (
            <motion.div key={`${p.product}-${p.vertical}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08, type: 'spring', stiffness: 240, damping: 22 }}
              whileHover={{ y: -5 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 90, cursor: 'default' }}>
              <span style={{ fontSize: 16 }}>{MEDAL[rank]}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--foreground)', textAlign: 'center', marginTop: 3, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.product}</span>
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 1 }}>{p.vertical}</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--foreground)', marginTop: 3 }}><CountUp value={p.rev} format={fmtBRL} /></span>
              <motion.div whileHover={{ boxShadow: '0 6px 20px rgba(0,0,0,.22)' }} transition={{ duration: 0.2 }}
                style={{ width: '100%', height: PODIUM_HEIGHT[rank], background: GRAD[rank], borderRadius: '8px 8px 0 0', marginTop: 6, boxShadow: '0 3px 10px rgba(0,0,0,.12)' }} />
            </motion.div>
          )
        })}
      </div>
      {rest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rest.map((p, i) => (
            <motion.div key={`${p.product}-${p.vertical}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
              whileHover={{ x: 3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, background: 'var(--secondary)', cursor: 'default' }}>
              <span style={{ width: 16, textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: 'var(--muted-foreground)', flexShrink: 0 }}>{i + 4}º</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{p.product}</span>
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', marginLeft: 6 }}>{p.vertical}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', flexShrink: 0 }}><CountUp value={p.rev} format={fmtBRL} /></span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Performance dos closers — comparação completa, não só receita ──
function CloserPerformanceTable({ data }: { data: { id: string; name: string; avatarUrl: string | null; revenue: number; salesCount: number; avgTicket: number; convRate: number; moneyLeft: number; avgDiscountPct: number }[] }) {
  if (data.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '40px 0' }}>Nenhuma venda no período.</p>
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)
  const avgDiscountAll = data.reduce((s, d) => s + d.avgDiscountPct, 0) / data.length
  const avgConvAll = data.reduce((s, d) => s + d.convRate, 0) / data.length
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 680 }}>
        <thead>
          <tr>
            {['Closer', 'Receita', 'Ticket médio', 'Conversão', 'Deixado na mesa', 'Desconto médio'].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '0 10px 10px', fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => {
            const highDiscountHighRev = c.avgDiscountPct > avgDiscountAll * 1.3 && c.revenue > maxRevenue * 0.4
            const greatConversion = c.convRate > avgConvAll * 1.3 && c.convRate > 0
            return (
              <motion.tr key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={c.name} url={c.avatarUrl} size={26} />
                    <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{c.name}</span>
                    {highDiscountHighRev && <span title="Vende muito, mas com desconto bem acima da média" style={{ fontSize: 11 }}>⚠️</span>}
                    {greatConversion && <span title="Conversão mais de 30% acima da média do time" style={{ fontSize: 11 }}>⭐</span>}
                  </div>
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <div style={{ width: 50, height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(c.revenue / maxRevenue) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.04 }}
                        style={{ height: '100%', background: 'linear-gradient(90deg,#16a34a,#22c55e)' }} />
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--foreground)', minWidth: 68 }}>{fmtBRL(c.revenue)}</span>
                  </div>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', color: 'var(--foreground)', fontWeight: 600 }}>{fmtBRL(c.avgTicket)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: c.convRate > avgConvAll ? '#22c55e' : 'var(--foreground)' }}>{c.convRate > 0 ? `${c.convRate.toFixed(0)}%` : '—'}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: c.moneyLeft > 0 ? '#f97316' : 'var(--muted-foreground)' }}>{fmtBRL(c.moneyLeft)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: c.avgDiscountPct > avgDiscountAll * 1.3 ? '#ef4444' : 'var(--foreground)' }}>{c.avgDiscountPct > 0 ? `${c.avgDiscountPct.toFixed(1)}%` : '—'}</td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Card "por vertical" com hover animado (card sobe, barra brilha) ──
function VerticalMetricCard({ title, icon, color, format, data, valueKey }: { title: string; icon: string; color: string; format: (v: number) => string; data: any[]; valueKey: string }) {
  const [hoveredCard, setHoveredCard] = useState(false)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const max = Math.max(...data.map((d: any) => d[valueKey]), 1)
  return (
    <div onMouseEnter={() => setHoveredCard(true)} onMouseLeave={() => { setHoveredCard(false); setHoveredBar(null) }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', boxShadow: hoveredCard ? 'var(--shadow-md)' : 'var(--shadow-sm)', transform: hoveredCard ? 'translateY(-3px)' : 'none', transition: 'box-shadow .25s ease, transform .25s ease' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 14px' }}>{icon} {title}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
        {data.map((d: any, i: number) => {
          const h = Math.max((d[valueKey] / max) * 74, d[valueKey] > 0 ? 6 : 2)
          const isHovered = hoveredBar === i
          return (
            <div key={d.vertical} onMouseEnter={() => setHoveredBar(i)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}>
              <motion.span animate={{ scale: isHovered ? 1.18 : 1 }} transition={{ duration: 0.18 }}
                style={{ fontSize: 9, fontWeight: 800, color, whiteSpace: 'nowrap', display: 'inline-block' }}>{format(d[valueKey])}</motion.span>
              <motion.div initial={{ height: 0 }} animate={{ height: h, scaleX: isHovered ? 1.12 : 1 }} transition={{ height: { duration: 0.6, delay: i * 0.06, ease: 'easeOut' }, scaleX: { duration: 0.18 } }}
                style={{ width: '100%', minHeight: 3, borderRadius: '5px 5px 0 0', background: isHovered ? color : `linear-gradient(180deg,${color},${color}99)`, marginTop: 4, boxShadow: isHovered ? `0 4px 14px ${color}55` : 'none', transformOrigin: 'bottom' }} />
              <span style={{ fontSize: 8.5, color: isHovered ? color : 'var(--muted-foreground)', fontWeight: isHovered ? 800 : 400, marginTop: 6, textAlign: 'center', transition: 'color .15s' }}>{d.vertical.replace('-Review', '')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Skeleton({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
        style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)' }} />
    </div>
  )
}

const CARD_STYLE: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }

interface InitialData {
  kpis: { totalRevenue: number; totalSales: number; avgTicket: number; moneyLeft: number; revenueToday: number; salesToday: number; certsCount: number }
  verticalBreakdown: { vertical: string; revenue: number; count: number; avgTicket: number; moneyLeft: number; avgDiscountPct: number }[]
  productRanking: { product: string; vertical: string; count: number; rev: number }[]
  closerPerformance: { id: string; name: string; avatarUrl: string | null; revenue: number; salesCount: number; avgTicket: number; convRate: number; moneyLeft: number; avgDiscountPct: number }[]
  byType: { closer: { rev: number; count: number }; ambassador: { rev: number; count: number }; selfcheckout: { rev: number; count: number }; ambassadorCloser: { rev: number; count: number } }
  novaVsRecorrente: { nova: { rev: number; count: number }; recorrente: { rev: number; count: number } }
  certsRanking: { name: string; count: number; avatarUrl: string | null }[]
  byWeekday: { label: string; rev: number; count: number }[]
  byHour: { hour: number; rev: number; count: number }[]
  topDay: { label: string; rev: number } | undefined
  topHour: { hour: number; rev: number } | undefined
  label: string
}

export function CommercialAnalysis({ initialData }: { initialData: InitialData }) {
  const [period, setPeriod] = useState('mes')
  const [data, setData]     = useState<InitialData>(initialData)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (period === 'mes') { setData(initialData); return } // já temos do servidor, sem precisar buscar de novo
    setLoading(true)
    fetch(`/api/dashboard/commercial-analysis?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarClock size={15} style={{ color: '#6366f1' }} />
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Painel Comercial</p>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· {data.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {PERIODS.map(p => {
            const active = period === p.id
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                style={{ position: 'relative', height: 30, padding: '0 14px', borderRadius: 9, border: 'none', background: 'transparent', color: active ? '#fff' : 'var(--muted-foreground)', fontSize: 12, fontWeight: active ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s', overflow: 'hidden' }}>
                {active && (
                  <motion.div layoutId="period-pill" transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', zIndex: 0 }} />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* KPIs — bento, agora dentro do filtro */}
      <div className="ca-kpi-bento" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 12, marginBottom: 20, gridTemplateAreas: '"revenue today ticket" "revenue money money"', opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <div style={{ gridArea: 'revenue' }}>
          <KpiMini icon={DollarSign} label="Receita do período" rawValue={data.kpis.totalRevenue} sub={`${data.kpis.totalSales} vendas novas`}
            grad="linear-gradient(135deg,#22c55e,#16a34a)" color="#22c55e" href="/intel" big />
        </div>
        <div style={{ gridArea: 'today' }}>
          <KpiMini icon={TrendingUp} label="Receita hoje" rawValue={data.kpis.revenueToday} sub={`${data.kpis.salesToday} vendas · ao vivo`}
            grad="linear-gradient(135deg,#3b82f6,#4f46e5)" color="#3b82f6" href="/telao" />
        </div>
        <div style={{ gridArea: 'ticket' }}>
          <KpiMini icon={Target} label="Ticket médio" rawValue={data.kpis.avgTicket} sub="média das vendas do período"
            grad="linear-gradient(135deg,#8b5cf6,#a855f7)" color="#8b5cf6" href="/intel" />
        </div>
        <div style={{ gridArea: 'money' }}>
          <KpiMini icon={AlertTriangle} label="Deixado na mesa" rawValue={data.kpis.moneyLeft} sub={`${data.kpis.certsCount} embaixadores certificados`}
            grad="linear-gradient(135deg,#f97316,#ef4444)" color="#f97316" href="/telao" />
        </div>
      </div>

      {/* Por vertical — também dentro do filtro */}
      <div style={{ marginBottom: 20, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Por vertical</p>
        <div className="ca-vert-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { title: 'Receita', icon: '💰', key: 'revenue', color: '#22c55e', format: fmtBRL },
            { title: 'Ticket médio', icon: '🎯', key: 'avgTicket', color: '#8b5cf6', format: fmtBRL },
            { title: 'Deixado na mesa', icon: '⚠️', key: 'moneyLeft', color: '#f97316', format: fmtBRL },
            { title: 'Desconto médio', icon: '🏷️', key: 'avgDiscountPct', color: '#ef4444', format: (v: number) => `${v.toFixed(1)}%` },
          ].map(cfg => (
            <VerticalMetricCard key={cfg.key} title={cfg.title} icon={cfg.icon} color={cfg.color} format={cfg.format}
              data={data.verticalBreakdown} valueKey={cfg.key} />
          ))}
        </div>
      </div>

      {/* Os 4 gráficos de análise */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }} className="ca-grid">
        <motion.div key={`tipo-${period}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} style={CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <PieChart size={14} style={{ color: '#a855f7' }} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Vendas por tipo</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 14px' }}>{data.label}</p>
          <DonutChart size={170} thickness={28} data={[
            { label: 'Closer',              value: data.byType.closer.rev,           color: '#6366f1' },
            { label: 'Embaixador',          value: data.byType.ambassador.rev,       color: '#a855f7' },
            { label: 'Embaixador + Closer', value: data.byType.ambassadorCloser.rev, color: '#ec4899' },
            { label: 'Self-checkout',       value: data.byType.selfcheckout.rev,     color: '#94a3b8' },
          ]} />
        </motion.div>

        <motion.div key={`novarec-${period}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.03 }} style={CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <TrendingUp size={14} style={{ color: '#22c55e' }} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Receita nova vs recorrente</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 14px' }}>{data.label}</p>
          <NovaVsRecorrenteBar nova={data.novaVsRecorrente.nova} recorrente={data.novaVsRecorrente.recorrente} />
        </motion.div>

        <motion.div key={`certs-${period}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.06 }} style={CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Award size={14} style={{ color: '#eab308' }} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Embaixadores certificados por closer</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 14px' }}>{data.label} · do maior pro menor</p>
          <CertsByCloserBars data={data.certsRanking} />
        </motion.div>

        <motion.div key={`diahora-${period}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.09 }} style={CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <CalendarClock size={14} style={{ color: '#3b82f6' }} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Distribuição por dia e horário</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 14px' }}>{data.label}</p>
          <WeekdayHourChart byWeekday={data.byWeekday} byHour={data.byHour} topDay={data.topDay} topHour={data.topHour} />
        </motion.div>
      </div>

      <motion.div key={`performance-${period}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.1 }}
        style={{ ...CARD_STYLE, marginTop: 12, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TrendingUp size={14} style={{ color: '#22c55e' }} />
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Performance dos closers</p>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 14px' }}>{data.label} · quem vende mais e por quê</p>
        <CloserPerformanceTable data={data.closerPerformance} />
      </motion.div>

      <motion.div key={`produtos-${period}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.12 }}
        style={{ ...CARD_STYLE, marginTop: 12, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Award size={14} style={{ color: '#eab308' }} />
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Produtos mais vendidos</p>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 14px' }}>{data.label} · top 5 por receita</p>
        <ProductRankingMini data={data.productRanking} />
      </motion.div>

      <style>{`
        @media (max-width: 900px) { .ca-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 768px) { .ca-kpi-bento { grid-template-columns: 1fr 1fr !important; grid-template-areas: "revenue revenue" "today ticket" "money money" !important; } .ca-vert-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 480px) { .ca-kpi-bento { grid-template-columns: 1fr !important; grid-template-areas: "revenue" "today" "ticket" "money" !important; } .ca-vert-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
