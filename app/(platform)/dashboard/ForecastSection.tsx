'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Clock, History, HeartPulse, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { DealsModal } from './ForecastDealsModal'
import type { DealsQuery } from '@/lib/dashboard/forecastDeals'
import type { YoYData } from '@/lib/dashboard/yoy'
import { ForecastYoY } from './ForecastYoY'
import { ForecastTop, VerticaisProjecao, FT_CSS } from './ForecastTop'
import { RotaChart } from './RotaChart'
import { MetaAnoForecast } from './MetaAnoForecast'

// ══════════════════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════════════════
type VKey = 'anest' | 'oft' | 'ortop' | 'r1'
interface Bucket { value: number; count: number }
type ByV = Record<VKey | 'outros', Bucket>
interface HourBucket { hour: number; label: string; value: number; count: number; byVertical: ByV }
interface LiveData {
  generatedAt: string; today: string
  links: { open: Bucket; byVertical: ByV; byHour: HourBucket[]; generatedCount: number; reissued: number; paid: Bucket; valid: Bucket }
  recurringPaidSince: number
  goals: {
    monthKey: string; daysInMonth: number; dayOfMonth: number; pctMonthElapsed: number
    geral: { meta: number; realizado: number }
    byVertical: Record<VKey, { meta: number; realizado: number }>
    realizadoOutros: number
  }
}
interface HistAgg { count: number; value: number; paidCount: number; paidValue: number }
interface HistoryData {
  today: string; from: string; to: string; days: string[]
  byVertical: Record<VKey, HistAgg & { daily: number[]; dailyValue: number[] }>
  outros: HistAgg; total: HistAgg; reissued: number
  lost: { count: number; value: number }   // negócios em "Perdido" (aviso do HubSpot) que ficaram de fora da conta
  // true quando o servidor respondeu no formato ANTIGO (sem receita / pago x não pago)
  legacy?: boolean
}

// O que a tela principal já carrega (page.tsx): serve pro 1º desenho, pro
// ritmo/recorrência do forecast e pro sinal vital.
export interface ForecastCommercial {
  totalRevMonth: number; metaGeralMes: number; metaPorVertical: Record<string, number>
  pctMonthElapsed: number; daysInMonthTotal: number
  dailyCumulative: { day: number; realizado: number; ritmoLinear: number }[]
  verticalBreakdown: { vertical: string; revenue: number }[]
  recorrenciaPrevistaMes: number; projecaoRestanteNovaVenda: number
  forecast: number; monthlyForecast: { label: string; ajustado: number }[]
  forecastDetail: { mrrAtual: number; persistenceRate: number; sampleSize: number; ativas: number; atrasadas: number; emRisco: number; completas: number; restamAPagarMes?: number; atrasadasMes?: number; jaPagasMes?: number }
}

// ══════════════════════════════════════════════════════════════════════
// Sistema visual — colorido, mas com disciplina:
//  • MARCA: índigo → violeta (cabeçalho, ícones, camadas do fechamento)
//  • VERTICALES: 4 cores médias; cada uma com um tom claro e um escuro MUITO
//    próximos (degradê curto — dá relevo sem virar neon)
//  • SEMÂNTICA: verde (à frente) e âmbar (atrás)
//  • Profundidade vem de sombra neutra e superfícies levemente degradê, nunca
//    de brilho colorido.
// ══════════════════════════════════════════════════════════════════════
const ACCENT = '#6366f1'
const BRAND_A = '#4f46e5'
const BRAND_B = '#7c3aed'
const brandGrad = `linear-gradient(135deg,${BRAND_A},${BRAND_B})`
const GOOD = '#16a34a'
const WARN = '#d97706'
const VERT: Record<VKey | 'outros', { label: string; short: string; init: string; color: string; from: string; to: string; ink: string }> = {
  anest:  { label: 'Anest-Review',  short: 'Anest',  init: 'AN', color: '#4f7be8', from: '#6f95f0', to: '#3f69d4', ink: '#4f7be8' },
  oft:    { label: 'Oft-Review',    short: 'Oft',    init: 'OF', color: '#dba21a', from: '#efbd3f', to: '#c58d0c', ink: '#b98708' },
  ortop:  { label: 'Ortop-Review',  short: 'Ortop',  init: 'OR', color: '#e67a38', from: '#f1975a', to: '#d3652a', ink: '#e07334' },
  r1:     { label: 'Med-Review R1', short: 'R1',     init: 'R1', color: '#8460e2', from: '#a184f0', to: '#6f4bd0', ink: '#7c58dc' },
  outros: { label: 'Sem vertical',  short: 'Outros', init: '··', color: '#94a3b8', from: '#b3c0d0', to: '#7f8ea3', ink: '#64748b' },
}
const ORDER: VKey[] = ['anest', 'oft', 'ortop', 'r1']
const DEALS_THEME = { vert: VERT, good: GOOD, warn: WARN, accent: ACCENT }
const vGradV = (k: VKey | 'outros') => `linear-gradient(180deg,${VERT[k].from},${VERT[k].to})`
const vGradH = (k: VKey | 'outros') => `linear-gradient(90deg,${VERT[k].to},${VERT[k].from})`
const vGradD = (k: VKey | 'outros') => `linear-gradient(135deg,${VERT[k].from},${VERT[k].to})`
// fundo do card levemente tingido pela cor da vertical (funciona no claro e no escuro)
const tint = (c: string, pct = 7) => `color-mix(in srgb, ${c} ${pct}%, var(--card))`
const cvar = (c: string) => ({ '--fc-c': c } as React.CSSProperties)

// ══════════════════════════════════════════════════════════════════════
// Utilitários
// ══════════════════════════════════════════════════════════════════════
const fmtBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR')
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`
  return fmtBRL(v)
}
const fmtDM = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Área CLICÁVEL: abre o popup com os negócios por trás do número. Acessível pelo teclado (Enter / Espaço).
type Open = (q: DealsQuery) => void
const clickable = (onOpen: () => void, label: string) => ({
  role: 'button' as const, tabIndex: 0, 'aria-label': label, title: label,
  onClick: (e: React.MouseEvent) => { e.stopPropagation(); onOpen() },
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen() } },
})

function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 900, start = performance.now(), from = display
    let raf: number
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setDisplay(from + (value - from) * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{format(display)}</>
}

// Sobe quando o número REALMENTE muda (nunca na 1ª renderização)
function useFlash(sig: string | number) {
  const [k, setK] = useState(0)
  const prev = useRef(sig), first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; prev.current = sig; return }
    if (prev.current !== sig) { prev.current = sig; setK(x => x + 1) }
  }, [sig])
  return k
}
// Pulso discreto quando o dado muda — só um contorno que some em ~1s
function FlashRing({ k, radius = 16 }: { k: number; radius?: number }) {
  if (k === 0) return null
  return <motion.div key={k} initial={{ opacity: 0.55, boxShadow: `inset 0 0 0 1.5px ${ACCENT}` }} animate={{ opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }}
    style={{ position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none' }} />
}

// A resposta da API pode vir de uma versão anterior do cálculo (tela nova + servidor
// antigo, ou o contrário). Normaliza com valores seguros em vez de quebrar a tela
// inteira; se vier no formato antigo, marca `legacy` pra mostrar um aviso claro.
function normalizeHistory(raw: any): HistoryData | null {
  if (!raw || typeof raw !== 'object' || !raw.byVertical) return null
  const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const days: string[] = Array.isArray(raw.days) ? raw.days : []
  const zeros = () => days.map(() => 0)
  const agg = (a: any): HistAgg => ({ count: n(a?.count), value: n(a?.value), paidCount: n(a?.paidCount), paidValue: n(a?.paidValue) })
  const byVertical = Object.fromEntries((['anest', 'oft', 'ortop', 'r1'] as VKey[]).map(k => {
    const a = raw.byVertical?.[k]
    return [k, { ...agg(a), daily: Array.isArray(a?.daily) ? a.daily : zeros(), dailyValue: Array.isArray(a?.dailyValue) ? a.dailyValue : zeros() }]
  })) as HistoryData['byVertical']
  const legacy = typeof raw.total !== 'object' || raw.total === null
  return {
    today: String(raw.today ?? ''), from: String(raw.from ?? ''), to: String(raw.to ?? ''), days, byVertical,
    total: legacy ? { ...agg(null), count: n(raw.total) } : agg(raw.total),
    outros: typeof raw.outros === 'object' && raw.outros ? agg(raw.outros) : { ...agg(null), count: n(raw.outros) },
    reissued: n(raw.reissued), legacy,
    lost: { count: n(raw.lost?.count), value: n(raw.lost?.value) },
  }
}

function Shimmer({ h, r = 16 }: { h: number; r?: number }) {
  return <motion.div animate={{ opacity: [0.45, 0.9, 0.45] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ height: h, borderRadius: r, background: 'var(--secondary)', border: '1px solid var(--border)' }} />
}

// ══════════════════════════════════════════════════════════════════════
// Peças de layout
// ══════════════════════════════════════════════════════════════════════
// Ícone em degradê — sempre o mesmo formato, muda só a cor
function Tile({ size = 34, grad = brandGrad, radius, children }: { size?: number; grad?: string; radius?: number; children: React.ReactNode }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28), 0 2px 6px rgba(15,23,42,.16)' }}>
      {children}
    </div>
  )
}

function Block({ icon: Icon, title, subtitle, right, children }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section className="fc-panel" style={{ display: 'flex', flexDirection: 'column' }} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Tile size={38}><Icon size={18} /></Tile>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.015em' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>{children}</div>
    </motion.section>
  )
}

function Pill({ tone = 'neutral', onDark = false, onClick, label, children }: { tone?: 'neutral' | 'good' | 'warn'; onDark?: boolean; onClick?: () => void; label?: string; children: React.ReactNode }) {
  const c = tone === 'good' ? GOOD : tone === 'warn' ? WARN : null
  const bg = onDark ? 'rgba(255,255,255,.14)' : c ? `${c}14` : 'var(--card)'
  const bd = onDark ? 'rgba(255,255,255,.26)' : c ? `${c}38` : 'var(--border)'
  const fg = onDark ? '#fff' : c ?? 'var(--foreground)'
  const style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: 999, color: fg, background: bg, border: `1px solid ${bd}`, ...(c ? ({ '--fc-c': c } as React.CSSProperties) : null) }
  if (onClick) return <button type="button" onClick={onClick} className="fc-click fc-lift" title={label} aria-label={label} style={{ ...style, cursor: 'pointer', fontFamily: 'inherit' }}>{children}</button>
  return <span style={style}>{children}</span>
}

// ══════════════════════════════════════════════════════════════════════
// 3. LINKS EM ABERTO HOJE (ao vivo)
// ══════════════════════════════════════════════════════════════════════
function VerticalLiveCard({ k, bucket, total, idx, onOpen }: { k: VKey; bucket: Bucket; total: number; idx: number; onOpen: Open }) {
  const v = VERT[k]
  const flash = useFlash(`${bucket.value}|${bucket.count}`)
  const share = total > 0 ? (bucket.value / total) * 100 : 0
  return (
    <motion.div {...clickable(() => onOpen({ scope: 'today', status: 'unpaid', vertical: k }), `Ver os negócios em aberto de ${v.label}`)} className="fc-card fc-click" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.35 }} whileHover={{ y: -3 }}
      style={{ ...cvar(v.color), position: 'relative', overflow: 'hidden', background: tint(v.color, 6), padding: '16px 18px' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: vGradH(k) }} />
      <FlashRing k={flash} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Tile size={32} grad={vGradD(k)}><span style={{ fontSize: 11, fontWeight: 900 }}>{v.init}</span></Tile>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: v.ink, background: `${v.color}1c`, borderRadius: 8, padding: '3px 8px' }}>{share.toFixed(share >= 10 || share === 0 ? 0 : 1)}%</span>
      </div>
      <p style={{ fontSize: 'clamp(23px,2.3vw,28px)', fontWeight: 900, color: 'var(--foreground)', margin: '0 0 3px', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
        <CountUp value={bucket.value} format={fmtBRL} />
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
        <strong style={{ color: 'var(--foreground)', fontWeight: 800 }}>{bucket.count}</strong> {bucket.count === 1 ? 'link em aberto' : 'links em aberto'}
      </p>
    </motion.div>
  )
}

function HourTooltip({ h }: { h: HourBucket }) {
  const rows = ([...ORDER, 'outros'] as (VKey | 'outros')[]).filter(k => h.byVertical[k].count > 0)
  return (
    <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
      style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, zIndex: 40, pointerEvents: 'none', minWidth: 196, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '11px 13px', boxShadow: '0 12px 30px rgba(15,23,42,.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--foreground)' }}>{h.label}</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>{h.count} {h.count === 1 ? 'link' : 'links'}</span>
      </div>
      <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{fmtBRL(h.value)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: vGradD(k), flexShrink: 0 }} />
            <span style={{ color: 'var(--muted-foreground)', flex: 1 }}>{VERT[k].short}</span>
            <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{h.byVertical[k].count} · {fmtBRL(h.byVertical[k].value)}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function HourBar({ h, maxVal, plot, active, dim, onHover, onOpen }: { h: HourBucket; maxVal: number; plot: number; active: boolean; dim: boolean; onHover: (hour: number | null) => void; onOpen: Open }) {
  const barH = Math.max((h.value / maxVal) * plot, 34)
  const flash = useFlash(`${h.value}|${h.count}`)
  const segs = ([...ORDER, 'outros'] as (VKey | 'outros')[]).map(k => ({ k, val: h.byVertical[k].value })).filter(s => s.val > 0)
  const segTotal = segs.reduce((s, x) => s + x.val, 0)
  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 16 }} animate={{ opacity: dim ? 0.45 : 1, y: 0 }} exit={{ opacity: 0, y: 16, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      onMouseEnter={() => onHover(h.hour)} onMouseLeave={() => onHover(null)} {...clickable(() => onOpen({ scope: 'today', status: 'unpaid', hour: h.hour }), `Ver os negócios gerados às ${h.label}`)}
      style={{ flex: '1 1 0', minWidth: 34, maxWidth: 86, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', cursor: 'pointer', zIndex: 1 }}>
      <AnimatePresence>{active && <HourTooltip h={h} />}</AnimatePresence>
      <motion.span key={h.value} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', marginBottom: 5, whiteSpace: 'nowrap' }}>{fmtCompact(h.value)}</motion.span>
      <motion.div initial={{ height: 0 }} animate={{ height: barH }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}
        style={{ width: '100%', borderRadius: '11px 11px 5px 5px', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', position: 'relative', boxShadow: active ? `0 0 0 2px ${ACCENT}66, 0 8px 18px rgba(15,23,42,.16)` : '0 2px 6px rgba(15,23,42,.12)' }}>
        {segs.length > 0
          ? segs.map(s => <div key={s.k} className="fc-seg" title={`${VERT[s.k].label} · ${h.label} — clique pra ver só essa vertical`} onClick={e => { e.stopPropagation(); onOpen({ scope: 'today', status: 'unpaid', hour: h.hour, vertical: s.k }) }} style={{ height: `${(s.val / segTotal) * 100}%`, background: vGradV(s.k) }} />)
          : <div style={{ flex: 1, background: 'var(--border)' }} />}
        <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(15,23,42,.4)' }}>{h.count}</span>
        {flash > 0 && <motion.div key={flash} initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }} style={{ position: 'absolute', inset: 0, background: '#fff' }} />}
      </motion.div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? 'var(--foreground)' : 'var(--muted-foreground)', marginTop: 7 }}>{h.label}</span>
    </motion.div>
  )
}

function HourlyLinksChart({ hours, onOpen }: { hours: HourBucket[]; onOpen: Open }) {
  const [hover, setHover] = useState<number | null>(null)
  const PLOT = 164
  const maxVal = Math.max(...hours.map(h => h.value), 1)
  const hasOutros = hours.some(h => h.byVertical.outros.count > 0)
  if (hours.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '34px 12px' }}>
        <div style={{ display: 'inline-flex', marginBottom: 10 }}><Tile size={46} radius={15}><Link2 size={21} /></Tile></div>
        <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 3px' }}>Nenhum link em aberto hoje</p>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Assim que um closer gerar um link, ele aparece aqui na hora.</p>
      </div>
    )
  }
  return (
    <div>
      <div className="fc-hours" style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 10, height: PLOT + 58, paddingTop: 4 }}>
        {/* linhas de referência — só pra dar leitura de escala */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: 21 + (PLOT / 3) * i, borderTop: '1px dashed color-mix(in srgb, var(--foreground) 12%, transparent)', pointerEvents: 'none' }} />
        ))}
        <AnimatePresence>
          {hours.map(h => <HourBar key={h.hour} h={h} maxVal={maxVal} plot={PLOT} active={hover === h.hour} dim={hover !== null && hover !== h.hour} onHover={setHover} onOpen={onOpen} />)}
        </AnimatePresence>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {([...ORDER, ...(hasOutros ? ['outros' as const] : [])] as (VKey | 'outros')[]).map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: vGradD(k) }} />{VERT[k].short}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>número na barra = links · valor no topo = em aberto · clique pra ver os negócios</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 4. HISTÓRICO — últimos 15 dias (sem hoje): receita gerada, e quanto foi pago
// ══════════════════════════════════════════════════════════════════════
const PAID_GRAD = 'linear-gradient(90deg,#16a34a,#22c55e)'

// barra pago x não pago (por valor)
function PaidSplit({ value, paid, height = 8 }: { value: number; paid: number; height?: number }) {
  const pct = value > 0 ? Math.min((paid / value) * 100, 100) : 0
  return (
    <div style={{ height, borderRadius: 999, background: 'color-mix(in srgb, var(--foreground) 11%, transparent)', overflow: 'hidden' }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }} style={{ height: '100%', borderRadius: 999, background: PAID_GRAD }} />
    </div>
  )
}

function SplitRow({ paid, label, value, count, onClick }: { paid: boolean; label: string; value: number; count: number; onClick?: () => void }) {
  const row = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: paid ? GOOD : 'var(--muted-foreground)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: paid ? GOOD : 'transparent', border: paid ? 'none' : '1.5px solid var(--muted-foreground)' }} />{label}
      </span>
      <span style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
        <strong style={{ color: 'var(--foreground)', fontWeight: 800 }}>{fmtBRL(value)}</strong> · {count}
      </span>
    </div>
  )
  return onClick
    ? <div {...clickable(onClick, `Ver os negócios: ${label}`)} className="fc-click fc-lift" data-split={paid ? 'paid' : 'unpaid'} style={{ ...cvar(paid ? GOOD : WARN), borderRadius: 8, padding: '3px 6px', margin: '-3px -6px' }}>{row}</div>
    : row
}

// O total de tudo que foi gerado e quanto disso foi pago
function HistorySummary({ total, onOpen }: { total: HistoryData['total']; onOpen: Open }) {
  const unpaidValue = total.value - total.paidValue, unpaidCount = total.count - total.paidCount
  const conv = total.value > 0 ? (total.paidValue / total.value) * 100 : 0
  const Stat = ({ label, color, value, sub, q }: { label: string; color?: string; value: number; sub: string; q: DealsQuery }) => (
    <div {...clickable(() => onOpen(q), `Ver os negócios: ${label.replace(/^[✓○] /, '')}`)} className="fc-click fc-lift" data-stat={q.status} style={{ ...cvar(color ?? ACCENT), minWidth: 0, borderRadius: 12, padding: '6px 8px', margin: '-6px -8px' }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: color ?? 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 'clamp(20px,2.4vw,27px)', fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.035em', lineHeight: 1.05 }}><CountUp value={value} format={fmtBRL} /></p>
      <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0 }}>{sub}</p>
    </div>
  )
  return (
    <div className="fc-card" style={{ ...cvar('#16a34a'), padding: '16px 20px', marginBottom: 12 }}>
      <div className="fc-sum" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '12px 20px', marginBottom: 14 }}>
        <Stat q={{ scope: 'history', status: 'all' }} label="Total gerado" value={total.value} sub={`${fmtInt(total.count)} ${total.count === 1 ? 'link' : 'links'}`} />
        <Stat q={{ scope: 'history', status: 'paid' }} label="✓ Pago" color={GOOD} value={total.paidValue} sub={`${fmtInt(total.paidCount)} ${total.paidCount === 1 ? 'link' : 'links'} · ${conv.toFixed(conv >= 10 || conv === 0 ? 0 : 1)}% da receita`} />
        <Stat q={{ scope: 'history', status: 'unpaid' }} label="○ Ainda não pago" color={WARN} value={unpaidValue} sub={`${fmtInt(unpaidCount)} ${unpaidCount === 1 ? 'link' : 'links'}`} />
      </div>
      <PaidSplit value={total.value} paid={total.paidValue} height={10} />
    </div>
  )
}

function HistoryCard({ k, data, days, idx, onOpen }: { k: VKey; data: HistoryData['byVertical'][VKey]; days: string[]; idx: number; onOpen: Open }) {
  const v = VERT[k]
  const max = Math.max(...data.dailyValue, 1)
  const unpaidValue = data.value - data.paidValue, unpaidCount = data.count - data.paidCount
  const conv = data.value > 0 ? (data.paidValue / data.value) * 100 : 0
  return (
    <motion.div className="fc-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.35 }} whileHover={{ y: -3 }}
      style={{ ...cvar(v.color), position: 'relative', overflow: 'hidden', background: tint(v.color, 6), padding: '16px 18px' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: vGradH(k) }} />
      <div {...clickable(() => onOpen({ scope: 'history', status: 'all', vertical: k }), `Ver os negócios de ${v.label}`)} className="fc-click fc-lift" data-hcard={k} style={{ borderRadius: 12, margin: '-5px -7px 7px', padding: '5px 7px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Tile size={32} grad={vGradD(k)}><span style={{ fontSize: 11, fontWeight: 900 }}>{v.init}</span></Tile>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
      </div>

      <p style={{ fontSize: 'clamp(22px,2.3vw,28px)', fontWeight: 900, color: v.ink, margin: '0 0 2px', letterSpacing: '-0.035em', lineHeight: 1.05 }}>
        <CountUp value={data.value} format={fmtBRL} />
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 0 12px' }}>
        <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0 }}>
          <strong style={{ color: 'var(--foreground)', fontWeight: 800 }}>{fmtInt(data.count)}</strong> {data.count === 1 ? 'link gerado' : 'links gerados'}
        </p>
        {data.value > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: GOOD, background: `${GOOD}1a`, borderRadius: 8, padding: '3px 8px', whiteSpace: 'nowrap' }}>{conv.toFixed(conv >= 10 || conv === 0 ? 0 : 1)}% pago</span>}
      </div>

      </div>
      <PaidSplit value={data.value} paid={data.paidValue} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '10px 0 12px' }}>
        <SplitRow paid label="Pago" value={data.paidValue} count={data.paidCount} onClick={() => onOpen({ scope: 'history', status: 'paid', vertical: k })} />
        <SplitRow paid={false} label="Não pago" value={unpaidValue} count={unpaidCount} onClick={() => onOpen({ scope: 'history', status: 'unpaid', vertical: k })} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 26 }}>
        {data.dailyValue.map((n, i) => (
          <motion.div key={i} {...clickable(() => onOpen({ scope: 'history', status: 'all', vertical: k, day: days[i] }), `Ver os negócios de ${fmtDM(days[i])}`)} className="fc-seg" data-day={days[i]} title={`${fmtDM(days[i])} · ${fmtBRL(n)} · ${data.daily[i]} ${data.daily[i] === 1 ? 'link' : 'links'}`}
            initial={{ height: 0 }} animate={{ height: Math.max((n / max) * 26, n > 0 ? 3 : 2) }} transition={{ duration: 0.7, delay: 0.1 + i * 0.025, ease: 'easeOut' }}
            whileHover={{ opacity: 1 }}
            style={{ flex: 1, borderRadius: '3px 3px 1px 1px', background: n > 0 ? vGradV(k) : 'color-mix(in srgb, var(--foreground) 10%, transparent)', opacity: n > 0 ? 0.8 : 1, transformOrigin: 'bottom' }} />
        ))}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 5. SINAL VITAL DA RECORRÊNCIA
// ══════════════════════════════════════════════════════════════════════
function SmallRing({ pct, size = 82 }: { pct: number; size?: number }) {
  const r = size / 2 - 8, C = 2 * Math.PI * r, c = size / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs><linearGradient id="fcRing2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
        <motion.circle cx={c} cy={c} r={r} fill="none" stroke="url(#fcRing2)" strokeWidth={8} strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${(Math.min(pct, 100) / 100) * C} ${C}` }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1 }}>{pct.toFixed(0)}%</span>
        <span style={{ fontSize: 7.5, color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>aderência</span>
      </div>
    </div>
  )
}

function VitalBlock({ total, monthly, detail }: { total: number; monthly: { label: string; ajustado: number }[]; detail: ForecastCommercial['forecastDetail'] }) {
  const [hov, setHov] = useState<number | null>(null)
  const d = detail ?? { mrrAtual: 0, persistenceRate: 0, sampleSize: 0, ativas: 0, atrasadas: 0, emRisco: 0, completas: 0 }
  const months = monthly ?? []
  const max = Math.max(...months.map(m => m.ajustado), 1)
  const PLOT = 112
  const tiles = [
    { label: 'restam a pagar este mês', count: d.restamAPagarMes ?? d.ativas,  color: GOOD,      Icon: HeartPulse },
    { label: 'atrasadas',               count: d.atrasadasMes ?? d.atrasadas, color: WARN,      Icon: Clock },
    { label: 'em risco',                count: d.emRisco,                      color: '#dc2626', Icon: AlertTriangle },
    { label: 'já pagas este mês',       count: d.jaPagasMes ?? d.completas,    color: ACCENT,    Icon: CheckCircle2 },
  ]
  return (
    <Block icon={HeartPulse} title="Sinal vital da recorrência" subtitle="Saúde das assinaturas e o que ainda deve entrar">
      <div className="fc-even" style={{ alignItems: 'stretch' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 'clamp(26px,3vw,33px)', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.035em', lineHeight: 1 }}><CountUp value={total} format={fmtBRL} /></p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '5px 0 0' }}>esperado até dezembro</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '7px 0 0' }}>Recebido este mês: <strong style={{ color: 'var(--foreground)' }}>{fmtBRL(d.mrrAtual)}</strong></p>
            </div>
            <SmallRing pct={d.persistenceRate} />
          </div>
          <div className="fc-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            {tiles.map(t => (
              <motion.div key={t.label} className="fc-card" whileHover={{ y: -2 }} style={{ ...cvar(t.color), display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: tint(t.color, 6) }}>
                <Tile size={32} grad={`linear-gradient(135deg,${t.color},${t.color}cc)`}><t.Icon size={16} /></Tile>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 19, fontWeight: 900, color: 'var(--foreground)', margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}><CountUp value={t.count} format={fmtInt} /></p>
                  <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.2 }}>{t.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="fc-card" style={{ ...cvar('#6366f1'), padding: '14px 16px 12px' }}>
          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Recorrência esperada por mês</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: PLOT + 46 }}>
            {months.map((m, i) => {
              const first = i === 0, active = hov === i
              return (
                <div key={m.label + i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                  style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10.5, fontWeight: active || first ? 800 : 600, color: active || first ? 'var(--foreground)' : 'var(--muted-foreground)', marginBottom: 4, whiteSpace: 'nowrap' }}>{fmtCompact(m.ajustado)}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: Math.max((m.ajustado / max) * PLOT, 4) }} transition={{ duration: 0.8, delay: i * 0.06, ease: 'easeOut' }}
                    style={{ width: '100%', maxWidth: 50, borderRadius: '9px 9px 3px 3px', background: 'linear-gradient(180deg,#8b5cf6,#4f46e5)', opacity: active ? 1 : first ? 0.95 : 0.55, transition: 'opacity .15s', boxShadow: active ? '0 6px 14px rgba(79,70,229,.25)' : 'none' }} />
                  <span style={{ fontSize: 10.5, color: active ? 'var(--foreground)' : 'var(--muted-foreground)', fontWeight: active ? 700 : 500, marginTop: 6 }}>{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Block>
  )
}

// ══════════════════════════════════════════════════════════════════════
// A SEÇÃO
// ══════════════════════════════════════════════════════════════════════
const CSS = `
@keyframes fcPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
.fc-panel{background:linear-gradient(180deg,var(--secondary),color-mix(in srgb,var(--secondary) 55%,var(--card)));border:1px solid var(--border);border-radius:22px;padding:22px 24px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.05)}
.fc-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 4px 14px rgba(15,23,42,.05);transition:border-color .18s ease,box-shadow .18s ease}
.fc-card:hover{border-color:color-mix(in srgb,var(--fc-c,#6366f1) 48%,var(--border));box-shadow:0 2px 4px rgba(15,23,42,.06),0 10px 26px rgba(15,23,42,.1)}
.dark .fc-panel{box-shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.28)}
.dark .fc-card{box-shadow:0 1px 2px rgba(0,0,0,.3),0 4px 14px rgba(0,0,0,.25)}
.dark .fc-card:hover{box-shadow:0 2px 4px rgba(0,0,0,.35),0 10px 26px rgba(0,0,0,.4)}
.fc-stack{display:flex;flex-direction:column;gap:16px}
.fc-g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.fc-two{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px}
.fc-even{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media(max-width:1020px){.fc-g4{grid-template-columns:repeat(2,minmax(0,1fr))}.fc-two,.fc-even{grid-template-columns:minmax(0,1fr)}}
@media(max-width:700px){.fc-leg{grid-template-columns:minmax(0,1fr)!important}}
@media(max-width:640px){.fc-sum{grid-template-columns:minmax(0,1fr)!important}}
@media(max-width:560px){.fc-g4{grid-template-columns:minmax(0,1fr)}.fc-hours{overflow-x:auto}.fc-tiles{grid-template-columns:minmax(0,1fr)!important}}
.fc-click{cursor:pointer;transition:box-shadow .18s ease,filter .18s ease,background-color .18s ease}
.fc-click:hover{box-shadow:0 6px 18px color-mix(in srgb,var(--fc-c,#6366f1) 22%,transparent);filter:brightness(1.02)}
.fc-lift{transition:transform .18s ease,box-shadow .18s ease,filter .18s ease,background-color .18s ease}
.fc-lift:hover{transform:translateY(-2px)}
.fc-click:active{transform:scale(.985)}
.fc-click:focus-visible{outline:2px solid var(--fc-c,#6366f1);outline-offset:3px}
.fc-seg{cursor:pointer;transition:filter .15s ease}.fc-seg:hover{filter:brightness(1.18) saturate(1.1)}
.fc-linkbtn{background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;transition:color .15s ease}.fc-linkbtn:hover{color:var(--foreground)}
@media(prefers-reduced-motion:reduce){.fc-click,.fc-lift,.fc-seg{transition:none}.fc-lift:hover{transform:none}}
`

export function ForecastSection({ commercial }: { commercial: ForecastCommercial }) {
  const [live, setLive] = useState<LiveData | null>(null)
  const [history, setHistory] = useState<HistoryData | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState(false)
  // A leitura ÚNICA do mês e do ano passado (dia da semana com dia da semana): alimenta o topo, o gráfico, as cartas, a tabela e o Radar. Por isso todos mostram o mesmo número.
  const [yoy, setYoy] = useState<YoYData | null>(null)
  const [yoyAt, setYoyAt] = useState<number | null>(null)
  const [yoyError, setYoyError] = useState(false)
  const [dealsQ, setDealsQ] = useState<DealsQuery | null>(null)          // o que foi clicado → abre o popup de negócios
  const openDeals = useCallback((q: DealsQuery) => setDealsQ(q), [])
  const closeDeals = useCallback(() => setDealsQ(null), [])
  // Quando a tela carregou: a recorrência "prevista" vem do servidor nesse
  // instante, então o que de recorrência foi pago DEPOIS disso sai dela (senão
  // contaria duas vezes: uma em "realizado" e outra em "a receber").
  const mountedAt = useRef(new Date().toISOString())
  // Toda busca pega um número novo; o AO VIVO só é aplicado se ainda for a
  // mais recente. O histórico é independente da ordem, então sempre entra.
  const reqRef = useRef(0)
  const historyDayRef = useRef<string | null>(null)

  const load = useCallback(async (scope: 'live' | 'full') => {
    const my = ++reqRef.current
    try {
      const res = await fetch(`/api/dashboard/forecast?scope=${scope}&since=${encodeURIComponent(mountedAt.current)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json()
      const hist = d.history ? normalizeHistory(d.history) : null
      if (hist) { setHistory(hist); historyDayRef.current = hist.today }
      if (my !== reqRef.current) return
      setLive(d); setUpdatedAt(Date.now()); setError(false)
      if (historyDayRef.current && d.today !== historyDayRef.current) load('full')   // virou o dia
    } catch {
      if (my === reqRef.current) setError(true)
    }
  }, [])

  const yoyReq = useRef(0)
  const loadYoy = useCallback(async () => {
    const my = ++yoyReq.current
    try {
      const res = await fetch('/api/dashboard/forecast/yoy', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json()
      if (my !== yoyReq.current) return
      setYoy(d); setYoyAt(Date.now()); setYoyError(false)
    } catch { if (my === yoyReq.current) setYoyError(true) }
  }, [])

  useEffect(() => { load('full'); loadYoy() }, [load, loadYoy])

  useEffect(() => {
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const id = setInterval(() => { if (visible()) load('live') }, 10_000)
    const idFull = setInterval(() => { if (visible()) load('full') }, 600_000)
    const idYoy = setInterval(() => { if (visible()) loadYoy() }, 30_000)      // venda nova entra sozinha no topo, no gráfico, na tabela e no Radar
    const onVis = () => { if (visible()) { load('live'); loadYoy() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); clearInterval(idFull); clearInterval(idYoy); document.removeEventListener('visibilitychange', onVis) }
  }, [load, loadYoy])

  // Empurrão imediato: venda nova ou link gerado/pago atualiza na hora. Sem
  // realtime liberado, o ciclo de 10s continua garantindo a atualização.
  useEffect(() => {
    let supabase: any, channel: any, timer: any
    try {
      supabase = createBrowserClient()
      const kick = () => { clearTimeout(timer); timer = setTimeout(() => { load('live'); loadYoy() }, 700) }
      channel = supabase.channel(`forecast-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telao_events' }, kick)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'geracoes_links' }, kick)
        .subscribe()
    } catch { /* sem realtime — o ciclo de 10s cobre */ }
    return () => { clearTimeout(timer); try { supabase?.removeChannel(channel) } catch { /* noop */ } }
  }, [load, loadYoy])

  const openTotal = live?.links.open.value ?? 0
  const outros = live?.links.byVertical.outros

  return (
    <>
    {/* a meta do ano abre a página: essencial (60 mi) e desafio (72 mi) */}
    <div className="fc-ano" style={{ marginBottom: 14 }}><MetaAnoForecast /></div>
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 26, padding: 'clamp(14px,2vw,24px)', boxShadow: 'var(--shadow-sm)', marginBottom: 14 }}>
      <style>{CSS}</style><style>{FT_CSS}</style>

      {/* 1 — onde vamos fechar: UM número (a projeção), o que o explica e a barra da meta */}
      <ForecastTop data={yoy} updatedAt={yoyAt ?? updatedAt} error={yoyError && error} recorrencia={commercial.recorrenciaPrevistaMes} links={live ? { value: live.links.valid.value, count: live.links.valid.count } : null} />

      <div className="fc-stack">
        {/* 2 — o caminho até a meta: receita acumulada, ano passado e rota */}
        {yoy ? <RotaChart data={yoy} /> : <Shimmer h={360} r={22} />}

        {/* 3 — cada vertical: projeção contra a meta */}
        <VerticaisProjecao data={yoy} />

        {/* 3 — o que está entrando agora */}
        <Block icon={Link2} title="Links em aberto hoje" subtitle="Um por negócio (se o link foi reemitido, vale o mais recente) · o que é pago sai daqui sozinho e o valor abaixa">
          {!live ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Shimmer h={64} />
              <div className="fc-g4">{[0, 1, 2, 3].map(i => <Shimmer key={i} h={116} r={16} />)}</div>
              <Shimmer h={260} />
              {error && <p style={{ fontSize: 12, color: WARN, textAlign: 'center', margin: 0 }}>Não consegui carregar agora. Tentando de novo…</p>}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16, padding: '16px 20px', borderRadius: 18, background: `linear-gradient(120deg,${ACCENT}16,${ACCENT}06 70%,transparent)`, border: `1px solid ${ACCENT}26` }}>
                <div {...clickable(() => openDeals({ scope: 'today', status: 'unpaid' }), 'Ver os negócios aguardando pagamento')} className="fc-click fc-lift" data-today="open" style={{ ...cvar(ACCENT), borderRadius: 14, padding: '6px 10px', margin: '-6px -10px' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>Em aberto agora</p>
                  <p style={{ fontSize: 'clamp(30px,3.8vw,40px)', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.045em', lineHeight: 1 }}><CountUp value={openTotal} format={fmtBRL} /></p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Pill onClick={() => openDeals({ scope: 'today', status: 'unpaid' })} label="Ver os negócios aguardando pagamento">{live.links.open.count} {live.links.open.count === 1 ? 'link aguardando' : 'links aguardando'}</Pill>
                    <Pill onClick={() => openDeals({ scope: 'today', status: 'all' })} label="Ver todos os negócios com link gerado hoje">{live.links.generatedCount} {live.links.generatedCount === 1 ? 'gerado' : 'gerados'} hoje</Pill>
                    <Pill tone="good" onClick={() => openDeals({ scope: 'today', status: 'paid' })} label="Ver os negócios já pagos hoje">✓ {live.links.paid.count} {live.links.paid.count === 1 ? 'pago' : 'pagos'}{live.links.paid.value > 0 ? ` · ${fmtBRL(live.links.paid.value)}` : ''}</Pill>
                  </div>
                  {live.links.reissued > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      ↻ {live.links.reissued} {live.links.reissued === 1 ? 'reemissão' : 'reemissões'} do mesmo negócio — vale só a mais recente
                    </span>
                  )}
                </div>
              </div>
              <div className="fc-g4" style={{ marginBottom: outros && outros.count > 0 ? 6 : 16 }}>
                {ORDER.map((k, i) => <VerticalLiveCard key={k} k={k} bucket={live.links.byVertical[k]} total={openTotal} idx={i} onOpen={openDeals} />)}
              </div>
              {outros && outros.count > 0 && (
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 16px', textAlign: 'right' }}>
                  <button type="button" className="fc-linkbtn" data-today="outros" onClick={() => openDeals({ scope: 'today', status: 'unpaid', vertical: 'outros' })}>+ {outros.count} {outros.count === 1 ? 'link' : 'links'} sem vertical identificada ({fmtBRL(outros.value)})</button>, contam no total e no gráfico
                </p>
              )}
              <div className="fc-card" style={{ ...cvar('#6366f1'), padding: '18px 20px' }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>Links gerados por hora</p>
                <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '0 0 8px' }}>Só as horas com geração · passe o mouse pra ver por vertical</p>
                <HourlyLinksChart hours={live.links.byHour} onOpen={openDeals} />
              </div>
            </>
          )}
        </Block>

        {/* 4 — o que já aconteceu */}
        <Block icon={History} title="Links gerados nos últimos 15 dias"
          subtitle={history ? `${fmtDM(history.from)} a ${fmtDM(history.to)} · sem hoje · um por negócio (reemissão vale a mais recente) · conta todos, pagos ou não, menos os negócios em "Perdido"${history.lost.count > 0 ? ` (${fmtInt(history.lost.count)} de fora)` : ''}` : 'Carregando…'}
          right={history ? (
            <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill onClick={() => openDeals({ scope: 'history', status: 'all' })} label="Ver todos os negócios do período">{fmtInt(history.total.count)} {history.total.count === 1 ? 'link' : 'links'} no total</Pill>
              {history.lost.count > 0 && <Pill tone="warn" onClick={() => openDeals({ scope: 'history', status: 'lost' })} label="Ver os negócios em Perdido (fora da conta)">⊘ {fmtInt(history.lost.count)} em Perdido</Pill>}
            </span>
          ) : undefined}>
          {!history ? (
            <>
              <div style={{ marginBottom: 12 }}><Shimmer h={104} r={16} /></div>
              <div className="fc-g4">{[0, 1, 2, 3].map(i => <Shimmer key={i} h={250} r={16} />)}</div>
            </>
          ) : (
            history.legacy ? (
              <div style={{ padding: '16px 18px', borderRadius: 14, background: `${WARN}12`, border: `1px solid ${WARN}40` }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: WARN, margin: '0 0 4px' }}>Histórico em formato antigo</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>
                  O servidor ainda está com a versão anterior do cálculo (sem receita nem pago × não pago). Atualize e publique o arquivo{' '}
                  <code style={{ fontSize: 11.5, color: 'var(--foreground)' }}>lib/dashboard/forecastAnalysis.ts</code> junto com esta tela.
                </p>
              </div>
            ) : (
              <>
                <HistorySummary total={history.total} onOpen={openDeals} />
                <div className="fc-g4">{ORDER.map((k, i) => <HistoryCard key={k} k={k} data={history.byVertical[k]} days={history.days} idx={i} onOpen={openDeals} />)}</div>
              </>
            )
          )}
          {history && !history.legacy && (history.outros.count > 0 || history.reissued > 0) && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '10px 0 0', textAlign: 'right' }}>
              {history.outros.count > 0 && <><button type="button" className="fc-linkbtn" data-hist="outros" onClick={() => openDeals({ scope: 'history', status: 'all', vertical: 'outros' })}>+ {history.outros.count} {history.outros.count === 1 ? 'link' : 'links'} sem vertical identificada ({fmtBRL(history.outros.value)})</button>, já no total</>}
              {history.outros.count > 0 && history.reissued > 0 && ' · '}
              {history.reissued > 0 && <>↻ {history.reissued} {history.reissued === 1 ? 'reemissão' : 'reemissões'} do mesmo negócio contadas uma vez</>}
            </p>
          )}
        </Block>

        {/* 5 — saúde da recorrência */}
        <VitalBlock total={commercial.forecast} monthly={commercial.monthlyForecast} detail={commercial.forecastDetail} />

        {/* 6 — este mês × o mesmo mês do ano passado: tabela acumulada + gráficos dia a dia (total e por vertical) */}
        <ForecastYoY data={yoy} error={yoyError} onRetry={loadYoy} />
      </div>

      <DealsModal query={dealsQ} onClose={closeDeals} theme={DEALS_THEME} />
    </div>
    </>
  )
}
