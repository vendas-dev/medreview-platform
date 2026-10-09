'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { smoothPath } from './animations'
import { fmtBRL } from '@/lib/telao/format'

// ══ Kit de gráficos do Telão Completo ═════════════════════════════════════════
// Mesmo estilo das linhas/barras do Telão ao vivo (cartões "vidro" roxos,
// JetBrains Mono nos rótulos, linhas que se desenham, barras que crescem).

export interface Th { dark: boolean; text: string; muted: string; soft: string; grid: string; card: string; border: string; tipBg: string; track: string }
export const makeTheme = (dark: boolean): Th => dark
  ? { dark, text: '#fff', muted: '#9d8bc4', soft: 'rgba(196,181,253,.62)', grid: 'rgba(168,85,247,.13)', card: 'rgba(255,255,255,.028)', border: 'rgba(168,85,247,.16)', tipBg: 'rgba(20,6,40,.96)', track: 'rgba(168,85,247,.12)' }
  : { dark, text: '#1e0040', muted: '#5b21b6', soft: 'rgba(91,33,182,.72)', grid: 'rgba(109,40,217,.15)', card: 'rgba(255,255,255,.92)', border: 'rgba(109,40,217,.22)', tipBg: 'rgba(255,255,255,.98)', track: 'rgba(139,92,246,.16)' }

const MONO = "'JetBrains Mono',monospace"
const SANS = "'Space Grotesk',sans-serif"

export function fmtCompact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
  if (a >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: a >= 1e5 ? 0 : 1 })} mil`
  return `R$ ${Math.round(v)}`
}
export const fmtDM = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const fmtDayLong = (day: string) => `${WD[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${fmtDM(day)}`

// ── mede o espaço disponível: o gráfico desenha em pixels reais ───────────────
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

// ── Cartão (todo gráfico mora num) ───────────────────────────────────────────
export function Panel({ th, title, sub, right, children, accent, style, id, className }: { th: Th; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; accent?: string; style?: React.CSSProperties; id?: string; className?: string }) {
  return (
    <motion.section className={className} data-panel={id ?? title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: 20, padding: '16px 18px', backdropFilter: 'blur(10px)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, boxShadow: th.dark ? '0 0 40px rgba(88,28,135,.10)' : '0 6px 24px rgba(139,92,246,.10)', ...style }}>
      {accent && <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(${accent}${th.dark ? '1f' : '2b'},transparent 70%)`, pointerEvents: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10, position: 'relative', zIndex: 1 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, color: th.dark ? '#c084fc' : '#7c3aed', textTransform: 'uppercase', letterSpacing: '.13em', fontFamily: MONO }}>{title}</p>
          {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: th.muted, fontFamily: SANS }}>{sub}</p>}
        </div>
        {right}
      </div>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </motion.section>
  )
}

export function Legend({ th, items, onToggle, off }: { th: Th; items: { id: string; label: string; color: string }[]; onToggle?: (id: string) => void; off?: Set<string> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
      {items.map(i => {
        const hidden = off?.has(i.id)
        return (
          <button key={i.id} onClick={() => onToggle?.(i.id)} disabled={!onToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: onToggle ? 'pointer' : 'default', padding: 0, opacity: hidden ? 0.35 : 1, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: th.soft }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: i.color, flexShrink: 0 }} />{i.label}
          </button>
        )
      })}
    </div>
  )
}

function Tip({ th, x, y, w, children }: { th: Th; x: number; y: number; w: number; children: React.ReactNode }) {
  const flip = x > w * 0.62
  return (
    <div style={{ position: 'absolute', left: flip ? undefined : x + 14, right: flip ? w - x + 14 : undefined, top: Math.max(y, 4), zIndex: 5, pointerEvents: 'none', background: th.tipBg, border: `1px solid ${th.border}`, borderRadius: 10, padding: '8px 11px', boxShadow: '0 8px 28px rgba(0,0,0,.28)', fontFamily: MONO, fontSize: 10.5, color: th.text, minWidth: 130, backdropFilter: 'blur(8px)' }}>
      {children}
    </div>
  )
}
const Row = ({ color, label, value, bold }: { color?: string; label: string; value: string; bold?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'space-between', fontWeight: bold ? 900 : 600, marginTop: 2 }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>{color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}{label}</span><span>{value}</span>
  </div>
)

// ══ 1. Acumulado (linha) com linha fantasma, meta e projeção ═══════════════════
export interface LineSeries { id: string; label: string; color: string; values: (number | null)[]; ghost?: boolean; area?: boolean }
export function LineChart({ th, xDays, series, goal, projection, height = 300, accent }: {
  th: Th; xDays: string[]; series: LineSeries[]; goal?: number | null
  projection?: { fromIdx: number; fromValue: number; toIdx: number; toValue: number } | null; height?: number; accent: string
}) {
  const [boxRef, box] = useBox<HTMLDivElement>()
  const [hov, setHov] = useState<number | null>(null)
  const W = Math.max(box.w, 280), H = Math.max(box.h, height)
  const padL = 56, padR = goal ? 74 : 16, padT = 14, padB = 26
  const n = xDays.length
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null))
  const ymax = Math.max(...all, goal ?? 0, projection?.toValue ?? 0, 1) * 1.08
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - v / ymax) * (H - padT - padB)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * ymax)
  const xTickIdx = useMemo(() => { const step = Math.max(Math.ceil(n / 8), 1); const idx: number[] = []; for (let i = 0; i < n; i += step) idx.push(i); if (n > 1 && idx[idx.length - 1] !== n - 1 && n - 1 - idx[idx.length - 1] >= step / 2) idx.push(n - 1); return idx }, [n])
  const main = series.find(s => !s.ghost)
  const ptsOf = (s: LineSeries) => s.values.map((v, i) => (v === null || i >= n ? null : { x: x(i), y: y(v), i })).filter(Boolean) as { x: number; y: number; i: number }[]

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - padL) / Math.max(W - padL - padR, 1)) * Math.max(n - 1, 1))
    setHov(Math.min(Math.max(i, 0), n - 1))
  }
  const mainVal = hov !== null ? main?.values[hov] ?? null : null
  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: height }}>
      <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHov(null)} style={{ position: 'absolute', left: 0, top: 0, cursor: 'crosshair', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`lc-${accent.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity=".38" /><stop offset="100%" stopColor={accent} stopOpacity="0" /></linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={th.grid} strokeWidth={1} strokeDasharray={i === 0 ? '0' : '2 5'} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={9.5} fontFamily={MONO} fontWeight={600} fill={th.soft}>{fmtCompact(t).replace('R$ ', '')}</text>
          </g>
        ))}
        {xTickIdx.map(i => <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize={9.5} fontFamily={MONO} fontWeight={hov === i ? 900 : 600} fill={hov === i ? th.text : th.soft}>{fmtDM(xDays[i])}</text>)}

        {goal ? (
          <g>
            <line x1={padL} x2={W - padR} y1={y(goal)} y2={y(goal)} stroke="#22c55e" strokeWidth={1.6} strokeDasharray="7 5" opacity={0.85} />
            <text x={W - padR + 6} y={y(goal) - 2} fontSize={10} fontWeight={900} fontFamily={MONO} fill="#22c55e">META</text>
            <text x={W - padR + 6} y={y(goal) + 10} fontSize={9.5} fontWeight={700} fontFamily={MONO} fill={th.soft}>{fmtCompact(goal).replace('R$ ', '')}</text>
          </g>
        ) : null}

        {series.map(s => {
          const pts = ptsOf(s); if (pts.length < 2) return null
          const d = smoothPath(pts)
          if (s.ghost) return <motion.path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: th.dark ? 0.55 : 0.7 }} transition={{ duration: 0.8 }} />
          const area = `${d} L ${pts[pts.length - 1].x},${y(0)} L ${pts[0].x},${y(0)} Z`
          return (
            <g key={s.id}>
              {s.area !== false && <motion.path d={area} fill={`url(#lc-${accent.replace('#', '')})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />}
              <motion.path d={d} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={5} fill={s.color} stroke={th.dark ? '#0a0015' : '#fff'} strokeWidth={2} />
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={11} fill={s.color} opacity={0.18} />
            </g>
          )
        })}

        {projection && (
          <g>
            <motion.line x1={x(projection.fromIdx)} y1={y(projection.fromValue)} x2={x(projection.toIdx)} y2={y(projection.toValue)} stroke={accent} strokeWidth={2.2} strokeDasharray="3 6" strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ duration: 0.8, delay: 0.6 }} />
            <circle cx={x(projection.toIdx)} cy={y(projection.toValue)} r={4.5} fill="none" stroke={accent} strokeWidth={2} />
            <text x={x(projection.toIdx) - 6} y={y(projection.toValue) - 9} textAnchor="end" fontSize={10} fontWeight={900} fontFamily={MONO} fill={accent}>projeção {fmtCompact(projection.toValue)}</text>
          </g>
        )}

        {hov !== null && <line x1={x(hov)} x2={x(hov)} y1={padT} y2={H - padB} stroke={th.soft} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />}
        {hov !== null && series.map(s => { const v = s.values[hov]; return v === null || v === undefined ? null : <circle key={s.id} cx={x(hov)} cy={y(v)} r={4.5} fill={s.color} stroke={th.dark ? '#0a0015' : '#fff'} strokeWidth={2} /> })}
      </svg>
      {hov !== null && (
        <Tip th={th} x={x(hov)} y={padT} w={W}>
          <div style={{ fontWeight: 900, marginBottom: 3 }}>{fmtDayLong(xDays[hov])}</div>
          {series.map(s => { const v = s.values[hov]; return v === null || v === undefined ? null : <Row key={s.id} color={s.color} label={s.label} value={fmtBRL(v)} bold={!s.ghost} /> })}
          {mainVal !== null && series.find(s => s.ghost)?.values[hov] != null && (() => { const g = series.find(s => s.ghost)!.values[hov] as number; return g > 0 ? <Row label="diferença" value={`${mainVal >= g ? '▲' : '▼'} ${Math.abs(((mainVal - g) / g) * 100).toFixed(0)}%`} bold /> : null })()}
        </Tip>
      )}
    </div>
  )
}

// ══ 2. Barras empilhadas por período ═══════════════════════════════════════
export interface StackKey { id: string; label: string; color: string }
export function StackBars({ th, labels, stacks, keys, height = 260, off }: { th: Th; labels: string[]; stacks: number[][]; keys: StackKey[]; height?: number; off?: Set<string> }) {
  const [boxRef, box] = useBox<HTMLDivElement>()
  const [hov, setHov] = useState<number | null>(null)
  const W = Math.max(box.w, 260), H = Math.max(box.h, height), padL = 52, padR = 8, padT = 10, padB = 24
  const vis = keys.map((k, ki) => ({ k, ki })).filter(({ k }) => !off?.has(k.id))
  const totals = stacks.map(st => vis.reduce((a, { ki }) => a + (st[ki] ?? 0), 0))
  const ymax = Math.max(...totals, 1) * 1.08
  const n = labels.length, slot = (W - padL - padR) / Math.max(n, 1), bw = Math.min(slot * 0.74, 44)
  const y = (v: number) => padT + (1 - v / ymax) * (H - padT - padB)
  const step = Math.max(Math.ceil(n / 10), 1)
  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: height }}>
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} onMouseLeave={() => setHov(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <g key={i}><line x1={padL} x2={W - padR} y1={y(f * ymax)} y2={y(f * ymax)} stroke={th.grid} strokeWidth={1} strokeDasharray={i === 0 ? '0' : '2 5'} />
            <text x={padL - 8} y={y(f * ymax) + 3.5} textAnchor="end" fontSize={9.5} fontFamily={MONO} fontWeight={600} fill={th.soft}>{fmtCompact(f * ymax).replace('R$ ', '')}</text></g>
        ))}
        {stacks.map((st, i) => {
          const cx = padL + slot * i + slot / 2
          let acc = 0
          return (
            <g key={i} onMouseEnter={() => setHov(i)} style={{ cursor: 'pointer' }}>
              <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {vis.map(({ k, ki }, vi) => {
                const v = st[ki] ?? 0; if (v <= 0) return null
                const y0 = y(acc), y1 = y(acc + v); acc += v
                const isTop = vi === vis.length - 1 || vis.slice(vi + 1).every(({ ki: kk }) => (st[kk] ?? 0) <= 0)
                return <motion.rect key={k.id} x={cx - bw / 2} width={bw} rx={isTop ? 3 : 0} fill={k.color} opacity={hov === null || hov === i ? 1 : 0.45}
                  initial={{ y: y(0), height: 0 }} animate={{ y: y1, height: Math.max(y0 - y1, 0.5) }} transition={{ duration: 0.55, delay: Math.min(i * 0.015, 0.5), ease: 'easeOut' }} />
              })}
              {i % step === 0 && <text x={cx} y={H - 7} textAnchor="middle" fontSize={9.5} fontFamily={MONO} fontWeight={hov === i ? 900 : 600} fill={hov === i ? th.text : th.soft}>{labels[i]}</text>}
            </g>
          )
        })}
      </svg>
      {hov !== null && (
        <Tip th={th} x={padL + slot * hov + slot / 2} y={padT} w={W}>
          <div style={{ fontWeight: 900, marginBottom: 3 }}>{labels[hov]}</div>
          {[...vis].reverse().map(({ k, ki }) => (stacks[hov][ki] ?? 0) > 0 ? <Row key={k.id} color={k.color} label={k.label} value={fmtBRL(stacks[hov][ki])} /> : null)}
          <div style={{ borderTop: `1px solid ${th.border}`, marginTop: 5, paddingTop: 4 }}><Row label="total" value={fmtBRL(totals[hov])} bold /></div>
        </Tip>
      )}
    </div>
  )
}

// ══ 3. Participação (100% empilhado, áreas suaves) ═════════════════════════════
export function ShareArea({ th, labels, parts, keys, height = 230 }: { th: Th; labels: string[]; parts: number[][]; keys: StackKey[]; height?: number }) {
  const [boxRef, box] = useBox<HTMLDivElement>()
  const [hov, setHov] = useState<number | null>(null)
  const W = Math.max(box.w, 260), H = height, padL = 36, padR = 8, padT = 8, padB = 24
  const n = labels.length
  if (n < 2) return <p style={{ margin: 'auto', fontSize: 12, color: th.muted, fontFamily: SANS }}>Escolha um período maior para ver a evolução da participação.</p>
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (p: number) => padT + (1 - p) * (H - padT - padB)
  const norm = parts.map(row => { const t = row.reduce((a, b) => a + b, 0); return row.map(v => (t > 0 ? v / t : 0)) })
  const hasData = (i: number) => parts[i].some(v => v > 0)
  // acumula de baixo pra cima
  const lower: number[][] = norm.map(() => []), upper: number[][] = norm.map(() => [])
  keys.forEach((_, ki) => norm.forEach((row, i) => { const lo = ki === 0 ? 0 : upper[i][ki - 1]; lower[i][ki] = lo; upper[i][ki] = lo + row[ki] }))
  const step = Math.max(Math.ceil(n / 8), 1)
  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', height: H }}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHov(null)}
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHov(Math.min(Math.max(Math.round(((e.clientX - r.left - padL) / Math.max(W - padL - padR, 1)) * (n - 1)), 0), n - 1)) }}>
        {[0, 0.5, 1].map(p => <g key={p}><line x1={padL} x2={W - padR} y1={y(p)} y2={y(p)} stroke={th.grid} strokeDasharray={p === 0 ? '0' : '2 5'} /><text x={padL - 6} y={y(p) + 3.5} textAnchor="end" fontSize={9.5} fontFamily={MONO} fill={th.soft} fontWeight={600}>{Math.round(p * 100)}%</text></g>)}
        {keys.map((k, ki) => {
          const up = norm.map((_, i) => ({ x: x(i), y: y(upper[i][ki]) })), lo = norm.map((_, i) => ({ x: x(i), y: y(lower[i][ki]) })).reverse()
          const d = `${smoothPath(up)} ${smoothPath(lo).replace(/^M/, 'L')} Z`
          return <motion.path key={k.id} d={d} fill={k.color} opacity={0.9} stroke={th.dark ? 'rgba(10,0,21,.5)' : 'rgba(255,255,255,.6)'} strokeWidth={0.8} initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ duration: 0.6, delay: ki * 0.08 }} />
        })}
        {labels.map((l, i) => i % step === 0 && <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize={9.5} fontFamily={MONO} fontWeight={hov === i ? 900 : 600} fill={hov === i ? th.text : th.soft}>{l}</text>)}
        {hov !== null && <line x1={x(hov)} x2={x(hov)} y1={padT} y2={H - padB} stroke={th.text} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
      </svg>
      {hov !== null && hasData(hov) && (
        <Tip th={th} x={x(hov)} y={padT} w={W}>
          <div style={{ fontWeight: 900, marginBottom: 3 }}>{labels[hov]}</div>
          {[...keys].reverse().map((k) => { const ki = keys.indexOf(k); return norm[hov][ki] > 0 ? <Row key={k.id} color={k.color} label={k.label} value={`${(norm[hov][ki] * 100).toFixed(0)}% · ${fmtCompact(parts[hov][ki])}`} /> : null })}
        </Tip>
      )}
    </div>
  )
}

// ══ 4. Rosca ══════════════════════════════════════════════════════════════════
export function Donut({ th, slices, centerTop, centerBottom, size = 168 }: { th: Th; slices: { id: string; label: string; color: string; value: number }[]; centerTop: string; centerBottom: string; size?: number }) {
  const [hov, setHov] = useState<string | null>(null)
  const total = slices.reduce((a, s) => a + s.value, 0)
  const r = size / 2 - 14, C = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={th.track} strokeWidth={16} />
        {total > 0 && slices.map(s => {
          const frac = s.value / total, dash = frac * C, off = -acc * C; acc += frac
          if (frac <= 0) return null
          return <motion.circle key={s.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={hov === s.id ? 20 : 16} strokeLinecap="butt" strokeDashoffset={off}
            initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${Math.max(dash - 1.5, 0)} ${C - Math.max(dash - 1.5, 0)}` }} transition={{ duration: 0.9, ease: 'easeOut' }}
            onMouseEnter={() => setHov(s.id)} onMouseLeave={() => setHov(null)} style={{ cursor: 'pointer', transition: 'stroke-width .15s' }} />
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none', padding: 24 }}>
        {(() => { const h = hov ? slices.find(s => s.id === hov) : null; return (<>
          <span style={{ fontSize: size * 0.115, fontWeight: 900, color: h?.color ?? th.text, fontFamily: SANS, letterSpacing: '-.02em', lineHeight: 1.1 }}>{h ? `${total > 0 ? ((h.value / total) * 100).toFixed(0) : 0}%` : centerTop}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: th.muted, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{h ? h.label : centerBottom}</span></>) })()}
      </div>
    </div>
  )
}

// ══ 5. Mapa de calor (dia da semana × hora) ═══════════════════════════════════
export function HeatGrid({ th, cells, counts, max, accent, cell = 22, highlight }: { th: Th; cells: number[][]; counts: number[][]; max: number; accent: string; cell?: number; highlight?: { weekday: number; hour: number } | null }) {
  const hours = Array.from({ length: 24 }, (_, h) => h)
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(24,minmax(0,1fr))', gap: cell <= 14 ? 1.5 : 2, alignItems: 'center' }}>
      <span />
      {hours.map(h => <span key={h} style={{ fontSize: 8, fontFamily: MONO, color: th.soft, textAlign: 'center', fontWeight: 600 }}>{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>)}
      {order.map((d, ri) => (
        <div key={d} style={{ display: 'contents' }}>
          <span style={{ fontSize: 9, fontFamily: MONO, color: th.soft, fontWeight: 700 }}>{days[d]}</span>
          {hours.map(h => {
            const v = cells[d][h], f = max > 0 ? Math.sqrt(v / max) : 0
            const top = !!highlight && highlight.weekday === d && highlight.hour === h
            return <div key={h} data-heat-cell={top ? 'top' : undefined} title={`${days[d]} ${String(h).padStart(2, '0')}h · ${fmtBRL(v)} · ${counts[d][h]} venda(s)`}
              style={{ height: cell, borderRadius: cell <= 14 ? 3 : 4, background: v > 0 ? accent : th.track, opacity: top ? 1 : v > 0 ? 0.16 + f * 0.84 : th.dark ? 0.5 : 0.7,
                ...(top ? { boxShadow: `0 0 0 2px ${th.dark ? '#fff' : '#3b0764'}, 0 0 14px ${accent}`, position: 'relative', zIndex: 2, animation: 'hmTop 1.8s ease-in-out infinite' } : { animation: `hmIn .4s ease-out ${(ri * 24 + h) * 4}ms both` }) }} />
          })}
        </div>
      ))}
      <style>{`@keyframes hmIn{from{opacity:0;transform:scale(.6)}to{transform:scale(1)}}@keyframes hmTop{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}@media (prefers-reduced-motion:reduce){[data-heat-cell]{animation:none!important}}`}</style>
    </div>
  )
}

// ══ 6. Cartograma do Brasil (um quadrado por estado, posição aproximada) ════════
const TILES: Record<string, [number, number]> = {
  RR: [0, 2], AP: [0, 3],
  AM: [1, 1], PA: [1, 2], MA: [1, 3], CE: [1, 4], RN: [1, 5],
  AC: [2, 0], RO: [2, 1], TO: [2, 2], PI: [2, 3], PE: [2, 4], PB: [2, 5],
  MT: [3, 1], GO: [3, 2], BA: [3, 3], AL: [3, 4],
  MS: [4, 1], DF: [4, 2], MG: [4, 3], SE: [4, 4],
  SP: [5, 2], RJ: [5, 3], ES: [5, 4],
  PR: [6, 1], SC: [6, 2], RS: [6, 3],
}
export function TileMap({ th, data, accent }: { th: Th; data: { uf: string; revenue: number; count: number }[]; accent: string }) {
  const m = new Map(data.map(d => [d.uf, d])); const max = Math.max(...data.map(d => d.revenue), 1)
  const cell = 'minmax(0,1fr)'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(6,${cell})`, gridTemplateRows: 'repeat(7,auto)', gap: 4 }}>
      {Object.entries(TILES).map(([uf, [row, col]]) => {
        const d = m.get(uf), f = d ? Math.sqrt(d.revenue / max) : 0
        return (
          <motion.div key={uf} data-uf={uf} title={d ? `${uf} · ${fmtBRL(d.revenue)} · ${d.count} venda(s)` : `${uf} · sem vendas`}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (row * 6 + col) * 0.012, type: 'spring', stiffness: 260, damping: 20 }}
            style={{ gridRow: row + 1, gridColumn: col + 1, borderRadius: 8, height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: d ? accent : th.track, opacity: d ? 0.2 + f * 0.8 : th.dark ? 0.45 : 0.6, color: d && f > 0.45 ? '#fff' : th.text, lineHeight: 1.05 }}>
            <span style={{ fontSize: 10, fontWeight: 900, fontFamily: MONO }}>{uf}</span>
            {d && <span style={{ fontSize: 8, fontWeight: 700, fontFamily: MONO }}>{fmtCompact(d.revenue).replace('R$ ', '')}</span>}
          </motion.div>
        )
      })}
    </div>
  )
}

// ══ 7. Lista de barras horizontais ═══════════════════════════════════════════
export function HBars({ th, items, color, fmt = fmtBRL }: { th: Th; items: { label: string; value: number; sub?: string; color?: string }[]; color: string; fmt?: (v: number) => string }) {
  const max = Math.max(...items.map(i => i.value), 1)
  if (!items.length) return <p style={{ margin: 'auto', fontSize: 12, color: th.muted, fontFamily: SANS }}>Sem dados no período.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((it, i) => (
        <div key={it.label} data-hbar={it.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: th.text, fontFamily: SANS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={it.label}>{it.label}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: it.color ?? color, fontFamily: MONO, whiteSpace: 'nowrap' }}>{fmt(it.value)}{it.sub ? <span style={{ color: th.soft, fontWeight: 600 }}> · {it.sub}</span> : null}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: th.track, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 999, background: it.color ?? color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
