'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { TrendingUp, Flag, Target, Link2, Clock, History, HeartPulse, ArrowRight, CheckCircle2, AlertTriangle, Repeat, Zap } from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { composeClosingForecast, LINKS_WEIGHT } from '@/lib/dashboard/forecastMath'

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
const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const pctText = (p: number) => `${p >= 100 ? Math.round(p) : p.toFixed(1)}%`

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
  }
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C ${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`
  }
  return d
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

function Pill({ tone = 'neutral', onDark = false, children }: { tone?: 'neutral' | 'good' | 'warn'; onDark?: boolean; children: React.ReactNode }) {
  const c = tone === 'good' ? GOOD : tone === 'warn' ? WARN : null
  const bg = onDark ? 'rgba(255,255,255,.14)' : c ? `${c}14` : 'var(--card)'
  const bd = onDark ? 'rgba(255,255,255,.26)' : c ? `${c}38` : 'var(--border)'
  const fg = onDark ? '#fff' : c ?? 'var(--foreground)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: 999, color: fg, background: bg, border: `1px solid ${bd}` }}>
      {children}
    </span>
  )
}

function LiveBadge({ updatedAt, error }: { updatedAt: number | null; error: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const secs = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null
  const stale = error || (secs !== null && secs > 45)
  const dot = stale ? '#fbbf24' : '#4ade80'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 999, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', fontSize: 10.5, fontWeight: 800, color: '#fff', letterSpacing: '.07em', backdropFilter: 'blur(6px)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, animation: stale ? 'none' : 'fcPulse 2s ease-in-out infinite' }} />
      {stale ? 'RECONECTANDO' : 'AO VIVO'}
      {secs !== null && !stale && <span style={{ fontWeight: 600, opacity: 0.75, letterSpacing: 0 }}>· há {secs}s</span>}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════
// CABEÇALHO — degradê índigo profundo (mesma família do hero do dashboard)
// ══════════════════════════════════════════════════════════════════════
function HeroStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: '12px 20px', minWidth: 164, backdropFilter: 'blur(10px)' }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.66)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>{label}</p>
      <p style={{ fontSize: 25, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{children}</p>
    </div>
  )
}

function SectionHero({ ready, projecao, meta, pctVsMeta, today, updatedAt, error }: {
  ready: boolean; projecao: number; meta: number; pctVsMeta: number; today?: string; updatedAt: number | null; error: boolean
}) {
  const up = pctVsMeta >= 0
  return (
    <header style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, padding: '28px 30px', marginBottom: 16, color: '#fff',
      background: 'linear-gradient(125deg,#1e1b4b 0%,#312e81 45%,#4338ca 100%)', boxShadow: '0 12px 32px rgba(49,46,129,.26)' }}>
      {/* textura e formas bem discretas — dão profundidade sem chamar atenção */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.09) 1px, transparent 1px)', backgroundSize: '22px 22px', WebkitMaskImage: 'linear-gradient(100deg,transparent 25%,#000 100%)', maskImage: 'linear-gradient(100deg,transparent 25%,#000 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -110, right: -70, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -150, left: '36%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(167,139,250,.12)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <div style={{ width: 58, height: 58, borderRadius: 18, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backdropFilter: 'blur(8px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}>
            <TrendingUp size={28} style={{ color: '#fff' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>Forecast</h2>
              <LiveBadge updatedAt={updatedAt} error={error} />
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.72)', margin: '8px 0 0' }}>
              Para onde o mês está indo e o que está entrando agora{today ? ` · ${fmtDate(today)}` : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <HeroStat label="Projeção de fechamento">{ready ? <CountUp value={projecao} format={fmtBRL} /> : '—'}</HeroStat>
          <HeroStat label="Meta do mês">{meta > 0 ? fmtBRL(meta) : '—'}</HeroStat>
          {ready && meta > 0 && (
            <HeroStat label="Projeção vs meta">
              <span style={{ color: up ? '#86efac' : '#fcd34d' }}>{up ? '+' : ''}{pctVsMeta.toFixed(1).replace('.', ',')}%</span>
            </HeroStat>
          )}
        </div>
      </div>
    </header>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 1. FECHAMENTO DO MÊS — 4 camadas somadas
// ══════════════════════════════════════════════════════════════════════
type Closing = ReturnType<typeof composeClosingForecast>
const STRIPES = 'repeating-linear-gradient(135deg,rgba(139,92,246,.62) 0 6px,rgba(139,92,246,.30) 6px 12px)'

function ClosingBlock({ f, meta, dias, linksCount }: { f: Closing; meta: number; dias: number; linksCount: number }) {
  const up = f.pctVsMeta >= 0
  const max = Math.max(f.projecao, meta, 1) * 1.04
  const metaPos = meta > 0 ? (meta / max) * 100 : null
  const layers = [
    { key: 'real',  label: 'Já realizado',          sub: 'vendas do mês até agora',                                   value: f.realizado,   bar: 'linear-gradient(90deg,#4338ca,#4f46e5)', tile: 'linear-gradient(135deg,#4f46e5,#4338ca)', Icon: CheckCircle2, iconColor: '#fff' },
    { key: 'rec',   label: 'Recorrência a receber', sub: 'assinaturas que ainda caem até o fim do mês',               value: f.recorrencia, bar: 'linear-gradient(90deg,#5b5ff0,#7479f6)', tile: 'linear-gradient(135deg,#6e72f5,#5b5ff0)', Icon: Repeat,       iconColor: '#fff' },
    { key: 'links', label: 'Links em aberto',       sub: `${linksCount} ${linksCount === 1 ? 'link válido' : 'links válidos'}, não pagos e não vencidos`, value: f.links, bar: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', tile: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', Icon: Link2, iconColor: '#fff' },
    { key: 'ritmo', label: 'Ritmo de vendas',       sub: dias > 0 ? `${fmtBRL(f.ritmoDia)}/dia × ${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}` : 'último dia do mês, sem dias restantes', value: f.ritmo, bar: STRIPES, tile: STRIPES, Icon: Zap, iconColor: '#6d28d9' },
  ]
  return (
    <Block icon={Flag} title="Fechamento do mês" subtitle="A soma de quatro camadas até o fim do mês">
      {/* barra de camadas + marcador da meta */}
      <div style={{ position: 'relative', paddingTop: 30, marginBottom: 20 }}>
        <div style={{ display: 'flex', height: 30, borderRadius: 999, overflow: 'hidden', background: 'var(--border)', boxShadow: 'inset 0 1px 3px rgba(15,23,42,.12)' }}>
          {layers.map((l, i) => (
            <motion.div key={l.key} title={`${l.label}: ${fmtBRL(l.value)}`} initial={{ width: 0 }} animate={{ width: `${(l.value / max) * 100}%` }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: 'easeOut' }} style={{ height: '100%', background: l.bar, boxShadow: i < layers.length - 1 ? 'inset -2px 0 0 var(--secondary)' : 'none' }} />
          ))}
        </div>
        {metaPos !== null && (
          <div style={{ position: 'absolute', left: `${metaPos}%`, top: 0, bottom: -4, width: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: -1, top: 22, bottom: 0, width: 2, borderRadius: 2, background: 'var(--foreground)', opacity: 0.8 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, transform: 'translateX(-50%)', fontSize: 10.5, fontWeight: 800, color: 'var(--foreground)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(15,23,42,.08)' }}>Meta · {fmtCompact(meta)}</span>
          </div>
        )}
      </div>

      <div className="fc-leg" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginBottom: 14 }}>
        {layers.map((l, i) => (
          <motion.div key={l.key} className="fc-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.35 }} whileHover={{ y: -2 }}
            style={{ ...cvar('#6366f1'), display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px' }}>
            <Tile size={38} grad={l.tile}><l.Icon size={18} style={{ color: l.iconColor }} /></Tile>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{l.label}</p>
              <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{l.sub}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.025em' }}>{fmtBRL(l.value)}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, margin: '2px 0 0' }}>{f.projecao > 0 ? Math.round((l.value / f.projecao) * 100) : 0}%</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '18px 24px', borderRadius: 18, color: '#fff', background: 'linear-gradient(125deg,#312e81 0%,#4338ca 55%,#6d28d9 100%)', boxShadow: '0 10px 26px rgba(67,56,202,.24)' }}>
        <div style={{ position: 'absolute', top: -70, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.78)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>= Projeção de fechamento</p>
          {meta > 0 && (
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.82)', margin: '5px 0 0' }}>
              {up ? <>meta de <strong style={{ color: '#fff' }}>{fmtBRL(meta)}</strong> superada</> : <>faltam <strong style={{ color: '#fff' }}>{fmtBRL(f.faltaPraMeta)}</strong> pra meta de {fmtBRL(meta)}</>}
            </p>
          )}
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {meta > 0 && <Pill onDark>{up ? '▲' : '▼'} {Math.abs(f.pctVsMeta).toFixed(1).replace('.', ',')}% {up ? 'acima' : 'abaixo'} da meta</Pill>}
          <span style={{ fontSize: 'clamp(28px,3.6vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}><CountUp value={f.projecao} format={fmtBRL} /></span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '10px 2px 0' }}>
        {LINKS_WEIGHT === 1 ? 'Os links em aberto entram pelo valor cheio. Nem todos serão pagos, e o ritmo pode já incluir parte deles.' : `Os links em aberto entram com peso de ${Math.round(LINKS_WEIGHT * 100)}% do valor.`}
      </p>
    </Block>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 2. META DO MÊS
// ══════════════════════════════════════════════════════════════════════
function PaceRing({ pctGoal, pctMonth, c1, c2, size = 140 }: { pctGoal: number; pctMonth: number; c1: string; c2: string; size?: number }) {
  const R1 = size / 2 - 10, R2 = R1 - 17
  const C1 = 2 * Math.PI * R1, C2 = 2 * Math.PI * R2, c = size / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="fcRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} /></linearGradient>
        </defs>
        <circle cx={c} cy={c} r={R1} fill="none" stroke="var(--border)" strokeWidth={12} />
        <motion.circle cx={c} cy={c} r={R1} fill="none" stroke="url(#fcRingGrad)" strokeWidth={12} strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${C1}` }} animate={{ strokeDasharray: `${(Math.min(pctGoal, 100) / 100) * C1} ${C1}` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        <circle cx={c} cy={c} r={R2} fill="none" stroke="var(--border)" strokeWidth={6} opacity={0.6} />
        <motion.circle cx={c} cy={c} r={R2} fill="none" stroke="var(--muted-foreground)" strokeWidth={6} strokeLinecap="round" opacity={0.6}
          initial={{ strokeDasharray: `0 ${C2}` }} animate={{ strokeDasharray: `${(Math.min(pctMonth, 100) / 100) * C2} ${C2}` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.21, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1, letterSpacing: '-0.03em' }}><CountUp value={pctGoal} format={v => `${Math.round(v)}%`} /></span>
        <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>da meta</span>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fc-card" style={{ ...cvar('#6366f1'), padding: '10px 14px', background: tint(ACCENT, 6) }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  )
}

// Mede o tamanho real do espaço disponível — o gráfico desenha em pixels reais
// (sem esticar texto nem linhas) e ocupa o quadro inteiro.
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

// Evolução da receita no mês contra o ritmo ideal. O eixo vai até a META: a
// linha tracejada (ritmo ideal) sobe até ela no último dia do mês, e a linha
// cheia (realizado) mostra onde você está. A distância entre as duas é o que
// importa — e agora o gráfico usa o quadro inteiro pra ela ficar legível.
function EvolutionChart({ meta, daysInMonth, series }: { meta: number; daysInMonth: number; series: { day: number; realizado: number }[] }) {
  const [boxRef, box] = useBox<HTMLDivElement>()
  const [hov, setHov] = useState<number | null>(null)
  const today = series[series.length - 1].day
  const shown = hov ?? today
  const idealAt = (d: number) => (meta * d) / daysInMonth
  const real = series.find(s => s.day === shown)?.realizado ?? null
  const ideal = idealAt(shown)
  const diff = real !== null ? real - ideal : null

  const W = Math.max(box.w, 300), H = Math.max(box.h, 150)
  const padL = 8, padR = 66, padT = 18, padB = 24
  const ymax = Math.max(meta, ...series.map(s => s.realizado)) * 1.05 || 1
  const x = (d: number) => padL + ((d - 1) / Math.max(daysInMonth - 1, 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - v / ymax) * (H - padT - padB)
  const pts = series.map(s => ({ x: x(s.day), y: y(s.realizado) }))
  const line = smoothPath(pts)
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1].x},${y(0)} L ${pts[0].x},${y(0)} Z` : ''
  const ticks = [1, 5, 10, 15, 20, 25, 30].filter(d => d < daysInMonth - 1).concat(daysInMonth)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const d = Math.round(1 + ((e.clientX - r.left - padL) / (W - padL - padR)) * (daysInMonth - 1))
    setHov(Math.min(Math.max(d, 1), daysInMonth))
  }

  return (
    <div className="fc-card" style={{ ...cvar('#6366f1'), padding: '14px 16px 10px', flex: 1, minHeight: 270, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px 14px', flexWrap: 'wrap', marginBottom: 4 }}>
        <p style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
          Evolução no mês <span style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>· dia {shown}{hov === null ? ' (hoje)' : ''}</span>
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px 14px', flexWrap: 'wrap', fontSize: 11.5, color: 'var(--muted-foreground)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--foreground)" strokeWidth="2.4" strokeDasharray="5 4" /></svg>
            Ritmo ideal <strong style={{ color: 'var(--foreground)' }}>{fmtBRL(ideal)}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={ACCENT} strokeWidth="3.4" strokeLinecap="round" /></svg>
            Realizado <strong style={{ color: 'var(--foreground)' }}>{real !== null ? fmtBRL(real) : '—'}</strong>
          </span>
          {diff !== null && <Pill tone={diff >= 0 ? 'good' : 'warn'}>{diff >= 0 ? '▲ +' : '▼ −'}{fmtCompact(Math.abs(diff))}</Pill>}
        </div>
      </div>

      <div ref={boxRef} style={{ flex: '1 1 0', minHeight: 190, overflow: 'hidden' }}>
        <svg width={W} height={H} style={{ display: 'block', cursor: 'crosshair' }} onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
          <defs>
            <linearGradient id="fcEvo2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".34" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient>
            <linearGradient id="fcEvoLine2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient>
          </defs>

          {/* referências de 25/50/75/100% da meta */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <g key={f}>
              <line x1={padL} x2={W - padR} y1={y(meta * f)} y2={y(meta * f)} stroke="var(--border)" strokeWidth={1} strokeDasharray={f === 1 ? '0' : '2 5'} />
              <text x={W - padR + 8} y={y(meta * f) + (f === 1 ? -1 : 3.5)} fontSize={f === 1 ? 11 : 10} fontWeight={f === 1 ? 800 : 600} fill={f === 1 ? 'var(--foreground)' : 'var(--muted-foreground)'}>{f === 1 ? 'Meta' : fmtCompact(meta * f)}</text>
              {f === 1 && <text x={W - padR + 8} y={y(meta) + 11} fontSize={10} fontWeight={600} fill="var(--muted-foreground)">{fmtCompact(meta)}</text>}
            </g>
          ))}

          <motion.path d={area} fill="url(#fcEvo2)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />

          {/* RITMO IDEAL — tracejado em destaque, até a meta no último dia do mês */}
          {/* (aparece por opacidade: a animação de "desenhar" (pathLength) troca o tracejado por linha cheia) */}
          <motion.line x1={x(1)} y1={y(idealAt(1))} x2={x(daysInMonth)} y2={y(idealAt(daysInMonth))} stroke="var(--foreground)" strokeWidth={2.4} strokeDasharray="8 6" strokeLinecap="round"
            initial={{ opacity: 0 }} animate={{ opacity: 0.92 }} transition={{ duration: 0.8, delay: 0.2 }} />

          {/* REALIZADO — linha cheia */}
          <motion.path d={line} fill="none" stroke="url(#fcEvoLine2)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />

          {/* guia de hover */}
          {hov !== null && <line x1={x(hov)} x2={x(hov)} y1={padT - 6} y2={H - padB} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />}
          {hov !== null && <circle cx={x(hov)} cy={y(ideal)} r={4.5} fill="var(--card)" stroke="var(--foreground)" strokeWidth={2.2} />}
          {real !== null && <>
            {hov === null && <circle cx={x(shown)} cy={y(real)} r={10} fill={ACCENT} opacity={0.2} />}
            <circle cx={x(shown)} cy={y(real)} r={5.2} fill="#7c3aed" stroke="var(--card)" strokeWidth={2.6} />
          </>}

          {ticks.map(d => <text key={d} x={x(d)} y={H - 7} fontSize={10} fontWeight={600} textAnchor="middle" fill={d === shown ? 'var(--foreground)' : 'var(--muted-foreground)'}>{d}</text>)}
        </svg>
      </div>
    </div>
  )
}

function MetaOverall({ meta, realizado, pctMonth, dayOfMonth, daysInMonth, evolucao }: {
  meta: number; realizado: number; pctMonth: number; dayOfMonth: number; daysInMonth: number
  evolucao: { day: number; realizado: number; ritmoLinear: number }[]
}) {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0
  const diffPP = pct - pctMonth
  const status: 'done' | 'ahead' | 'onpace' | 'behind' = pct >= 100 ? 'done' : Math.abs(diffPP) < 1 ? 'onpace' : diffPP > 0 ? 'ahead' : 'behind'
  const [r1, r2] = status === 'behind' ? ['#f59e0b', '#d97706'] : status === 'done' || status === 'ahead' ? ['#22c55e', '#16a34a'] : ['#6366f1', '#8b5cf6']
  const falta = Math.max(meta - realizado, 0)
  const diasRestantes = Math.max(daysInMonth - dayOfMonth + 1, 1)

  return (
    <Block icon={Target} title="Meta do mês" subtitle={`Dia ${dayOfMonth} de ${daysInMonth} · ${Math.round(pctMonth)}% do mês decorrido`}>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <PaceRing pctGoal={pct} pctMonth={pctMonth} c1={r1} c2={r2} />
        <div style={{ flex: 1, minWidth: 210 }}>
          <p style={{ fontSize: 'clamp(26px,3vw,33px)', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}><CountUp value={realizado} format={fmtBRL} /></p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '5px 0 10px' }}>realizado de {meta > 0 ? <strong style={{ color: 'var(--foreground)' }}>{fmtBRL(meta)}</strong> : 'uma meta ainda não definida'}</p>
          {meta > 0 && (
            <>
              <div style={{ marginBottom: 10 }}>
                <Pill tone={status === 'behind' ? 'warn' : status === 'onpace' ? 'neutral' : 'good'}>
                  {status === 'done' ? '🎯 Meta batida' : status === 'onpace' ? '● No ritmo do mês' : status === 'ahead' ? `▲ ${Math.abs(diffPP).toFixed(0)}pp à frente do ritmo` : `▼ ${Math.abs(diffPP).toFixed(0)}pp atrás do ritmo`}
                </Pill>
              </div>
              {falta > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                  <MiniStat label="Faltam" value={fmtBRL(falta)} />
                  <MiniStat label="Por dia (c/ hoje)" value={fmtBRL(falta / diasRestantes)} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {meta > 0 && evolucao.length > 1 && (
        <EvolutionChart meta={meta} daysInMonth={daysInMonth} series={evolucao.map(d => ({ day: d.day, realizado: d.realizado }))} />
      )}
    </Block>
  )
}

function MetaVerticalRow({ k, meta, realizado, pctMonth, idx }: { k: VKey; meta: number; realizado: number; pctMonth: number; idx: number }) {
  const v = VERT[k]
  const flash = useFlash(Math.round(realizado))
  const hasMeta = meta > 0
  const pct = hasMeta ? (realizado / meta) * 100 : 0
  const expected = hasMeta ? meta * (pctMonth / 100) : 0
  const delta = realizado - expected
  const near = hasMeta && Math.abs(delta) < meta * 0.01
  const ahead = delta >= 0
  return (
    <motion.div className="fc-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06, duration: 0.35 }} whileHover={{ y: -2 }}
      style={{ ...cvar(v.color), position: 'relative', background: tint(v.color, 6), padding: '13px 16px' }}>
      <FlashRing k={flash} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Tile size={32} grad={vGradD(k)}><span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.02em' }}>{v.init}</span></Tile>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', flex: 1 }}>{v.label}</span>
        {hasMeta
          ? <span style={{ fontSize: 22, fontWeight: 900, color: v.ink, letterSpacing: '-0.03em', lineHeight: 1 }}><CountUp value={pct} format={pctText} /></span>
          : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>meta não definida</span>}
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 999, background: 'color-mix(in srgb, var(--foreground) 9%, transparent)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${hasMeta ? Math.min(pct, 100) : 0}%` }} transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.06 }}
          style={{ height: '100%', borderRadius: 999, background: vGradH(k) }} />
        {hasMeta && <div title={`esperado até hoje: ${fmtBRL(expected)}`} style={{ position: 'absolute', top: -4, bottom: -4, left: `${Math.min(pctMonth, 100)}%`, width: 2, borderRadius: 2, background: 'var(--foreground)', opacity: 0.55 }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
          <strong style={{ color: 'var(--foreground)', fontWeight: 800 }}><CountUp value={realizado} format={fmtBRL} /></strong>{hasMeta && <> de {fmtBRL(meta)}</>}
        </span>
        {hasMeta && (
          <span style={{ fontSize: 11, fontWeight: 700, color: near ? 'var(--muted-foreground)' : ahead ? GOOD : WARN }}>
            {near ? '● no ritmo' : `${ahead ? '▲' : '▼'} ${fmtBRL(Math.abs(delta))} ${ahead ? 'à frente' : 'atrás'}`}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function MetaByVertical({ goals, pctMonth }: { goals: Record<VKey, { meta: number; realizado: number }>; pctMonth: number }) {
  const anyMeta = ORDER.some(k => goals[k].meta > 0)
  return (
    <Block icon={Target} title="Meta por vertical" subtitle="O traço marca quanto já deveria ter sido feito hoje">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ORDER.map((k, i) => <MetaVerticalRow key={k} k={k} meta={goals[k].meta} realizado={goals[k].realizado} pctMonth={pctMonth} idx={i} />)}
      </div>
      {!anyMeta && (
        <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '12px 0 0', textAlign: 'center' }}>
          Nenhuma meta por vertical neste mês. <Link href="/intel/goals" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Definir em Metas</Link>
        </p>
      )}
    </Block>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 3. LINKS EM ABERTO HOJE (ao vivo)
// ══════════════════════════════════════════════════════════════════════
function VerticalLiveCard({ k, bucket, total, idx }: { k: VKey; bucket: Bucket; total: number; idx: number }) {
  const v = VERT[k]
  const flash = useFlash(`${bucket.value}|${bucket.count}`)
  const share = total > 0 ? (bucket.value / total) * 100 : 0
  return (
    <motion.div className="fc-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.35 }} whileHover={{ y: -3 }}
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

function HourBar({ h, maxVal, plot, active, dim, onHover }: { h: HourBucket; maxVal: number; plot: number; active: boolean; dim: boolean; onHover: (hour: number | null) => void }) {
  const barH = Math.max((h.value / maxVal) * plot, 34)
  const flash = useFlash(`${h.value}|${h.count}`)
  const segs = ([...ORDER, 'outros'] as (VKey | 'outros')[]).map(k => ({ k, val: h.byVertical[k].value })).filter(s => s.val > 0)
  const segTotal = segs.reduce((s, x) => s + x.val, 0)
  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 16 }} animate={{ opacity: dim ? 0.45 : 1, y: 0 }} exit={{ opacity: 0, y: 16, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      onMouseEnter={() => onHover(h.hour)} onMouseLeave={() => onHover(null)}
      style={{ flex: '1 1 0', minWidth: 34, maxWidth: 86, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', cursor: 'pointer', zIndex: 1 }}>
      <AnimatePresence>{active && <HourTooltip h={h} />}</AnimatePresence>
      <motion.span key={h.value} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', marginBottom: 5, whiteSpace: 'nowrap' }}>{fmtCompact(h.value)}</motion.span>
      <motion.div initial={{ height: 0 }} animate={{ height: barH }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}
        style={{ width: '100%', borderRadius: '11px 11px 5px 5px', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', position: 'relative', boxShadow: active ? `0 0 0 2px ${ACCENT}66, 0 8px 18px rgba(15,23,42,.16)` : '0 2px 6px rgba(15,23,42,.12)' }}>
        {segs.length > 0
          ? segs.map(s => <div key={s.k} style={{ height: `${(s.val / segTotal) * 100}%`, background: vGradV(s.k) }} />)
          : <div style={{ flex: 1, background: 'var(--border)' }} />}
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(15,23,42,.4)' }}>{h.count}</span>
        {flash > 0 && <motion.div key={flash} initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }} style={{ position: 'absolute', inset: 0, background: '#fff' }} />}
      </motion.div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? 'var(--foreground)' : 'var(--muted-foreground)', marginTop: 7 }}>{h.label}</span>
    </motion.div>
  )
}

function HourlyLinksChart({ hours }: { hours: HourBucket[] }) {
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
          {hours.map(h => <HourBar key={h.hour} h={h} maxVal={maxVal} plot={PLOT} active={hover === h.hour} dim={hover !== null && hover !== h.hour} onHover={setHover} />)}
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
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>número na barra = links · valor no topo = em aberto</span>
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

function SplitRow({ paid, label, value, count }: { paid: boolean; label: string; value: number; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: paid ? GOOD : 'var(--muted-foreground)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: paid ? GOOD : 'transparent', border: paid ? 'none' : '1.5px solid var(--muted-foreground)' }} />{label}
      </span>
      <span style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
        <strong style={{ color: 'var(--foreground)', fontWeight: 800 }}>{fmtBRL(value)}</strong> · {count}
      </span>
    </div>
  )
}

// O total de tudo que foi gerado e quanto disso foi pago
function HistorySummary({ total }: { total: HistoryData['total'] }) {
  const unpaidValue = total.value - total.paidValue, unpaidCount = total.count - total.paidCount
  const conv = total.value > 0 ? (total.paidValue / total.value) * 100 : 0
  const Stat = ({ label, color, value, sub }: { label: string; color?: string; value: number; sub: string }) => (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: color ?? 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 'clamp(20px,2.4vw,27px)', fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.035em', lineHeight: 1.05 }}><CountUp value={value} format={fmtBRL} /></p>
      <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0 }}>{sub}</p>
    </div>
  )
  return (
    <div className="fc-card" style={{ ...cvar('#16a34a'), padding: '16px 20px', marginBottom: 12 }}>
      <div className="fc-sum" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '12px 20px', marginBottom: 14 }}>
        <Stat label="Total gerado" value={total.value} sub={`${fmtInt(total.count)} ${total.count === 1 ? 'link' : 'links'}`} />
        <Stat label="✓ Pago" color={GOOD} value={total.paidValue} sub={`${fmtInt(total.paidCount)} ${total.paidCount === 1 ? 'link' : 'links'} · ${conv.toFixed(conv >= 10 || conv === 0 ? 0 : 1)}% da receita`} />
        <Stat label="○ Ainda não pago" value={unpaidValue} sub={`${fmtInt(unpaidCount)} ${unpaidCount === 1 ? 'link' : 'links'}`} />
      </div>
      <PaidSplit value={total.value} paid={total.paidValue} height={10} />
    </div>
  )
}

function HistoryCard({ k, data, days, idx }: { k: VKey; data: HistoryData['byVertical'][VKey]; days: string[]; idx: number }) {
  const v = VERT[k]
  const max = Math.max(...data.dailyValue, 1)
  const unpaidValue = data.value - data.paidValue, unpaidCount = data.count - data.paidCount
  const conv = data.value > 0 ? (data.paidValue / data.value) * 100 : 0
  return (
    <motion.div className="fc-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.35 }} whileHover={{ y: -3 }}
      style={{ ...cvar(v.color), position: 'relative', overflow: 'hidden', background: tint(v.color, 6), padding: '16px 18px' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: vGradH(k) }} />
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

      <PaidSplit value={data.value} paid={data.paidValue} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '10px 0 12px' }}>
        <SplitRow paid label="Pago" value={data.paidValue} count={data.paidCount} />
        <SplitRow paid={false} label="Não pago" value={unpaidValue} count={unpaidCount} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 26 }}>
        {data.dailyValue.map((n, i) => (
          <motion.div key={i} title={`${fmtDM(days[i])} · ${fmtBRL(n)} · ${data.daily[i]} ${data.daily[i] === 1 ? 'link' : 'links'}`}
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
    <Block icon={HeartPulse} title="Sinal vital da recorrência" subtitle="Saúde das assinaturas e o que ainda deve entrar"
      right={<Link href="/intel" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: ACCENT, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ver detalhe <ArrowRight size={12} /></Link>}>
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
`

export function ForecastSection({ commercial }: { commercial: ForecastCommercial }) {
  const [live, setLive] = useState<LiveData | null>(null)
  const [history, setHistory] = useState<HistoryData | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState(false)
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

  useEffect(() => { load('full') }, [load])

  useEffect(() => {
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const id = setInterval(() => { if (visible()) load('live') }, 10_000)
    const idFull = setInterval(() => { if (visible()) load('full') }, 600_000)
    const onVis = () => { if (visible()) load('live') }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); clearInterval(idFull); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  // Empurrão imediato: venda nova ou link gerado/pago atualiza na hora. Sem
  // realtime liberado, o ciclo de 10s continua garantindo a atualização.
  useEffect(() => {
    let supabase: any, channel: any, timer: any
    try {
      supabase = createBrowserClient()
      const kick = () => { clearTimeout(timer); timer = setTimeout(() => load('live'), 500) }
      channel = supabase.channel(`forecast-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telao_events' }, kick)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'geracoes_links' }, kick)
        .subscribe()
    } catch { /* sem realtime — o ciclo de 10s cobre */ }
    return () => { clearTimeout(timer); try { supabase?.removeChannel(channel) } catch { /* noop */ } }
  }, [load])

  // metas: ao vivo quando chegou; senão, o que a tela principal já trouxe
  const goals = live?.goals ?? (() => {
    const byLabel = Object.fromEntries((commercial.verticalBreakdown ?? []).map(v => [v.vertical, v.revenue]))
    const g = (label: string) => ({ meta: commercial.metaPorVertical?.[label] ?? 0, realizado: byLabel[label] ?? 0 })
    return {
      monthKey: '', daysInMonth: commercial.daysInMonthTotal, dayOfMonth: Math.max(1, Math.round((commercial.pctMonthElapsed / 100) * commercial.daysInMonthTotal)),
      pctMonthElapsed: commercial.pctMonthElapsed,
      geral: { meta: commercial.metaGeralMes, realizado: commercial.totalRevMonth },
      byVertical: { anest: g('Anest-Review'), oft: g('Oft-Review'), ortop: g('Ortop-Review'), r1: g('Med-Review R1') } as Record<VKey, { meta: number; realizado: number }>,
      realizadoOutros: 0,
    }
  })()

  const evolucao = (commercial.dailyCumulative ?? []).map((d, i, arr) => i === arr.length - 1 ? { ...d, realizado: goals.geral.realizado } : d)

  // ── Forecast de fechamento: realizado + recorrência + links em aberto + ritmo
  const diasRestantes = Math.max(goals.daysInMonth - goals.dayOfMonth, 0)
  const closing = composeClosingForecast({
    realizado: goals.geral.realizado,
    recorrenciaPrevista: commercial.recorrenciaPrevistaMes,
    recorrenciaPagaDesdeCarga: live?.recurringPaidSince ?? 0,
    linksValidos: live?.links.valid.value ?? 0,
    ritmoRestante: commercial.projecaoRestanteNovaVenda,
    meta: goals.geral.meta,
    diasRestantes,
  })

  const openTotal = live?.links.open.value ?? 0
  const outros = live?.links.byVertical.outros

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 26, padding: 'clamp(14px,2vw,24px)', boxShadow: 'var(--shadow-sm)', marginBottom: 14 }}>
      <style>{CSS}</style>

      <SectionHero ready={!!live} projecao={closing.projecao} meta={goals.geral.meta} pctVsMeta={closing.pctVsMeta} today={live?.today} updatedAt={updatedAt} error={error} />

      <div className="fc-stack">
        {/* 1 — onde vamos fechar */}
        {live
          ? <ClosingBlock f={closing} meta={goals.geral.meta} dias={diasRestantes} linksCount={live.links.valid.count} />
          : <Shimmer h={420} r={22} />}

        {/* 2 — como estamos contra a meta */}
        <div className="fc-two">
          <MetaOverall meta={goals.geral.meta} realizado={goals.geral.realizado} pctMonth={goals.pctMonthElapsed} dayOfMonth={goals.dayOfMonth} daysInMonth={goals.daysInMonth} evolucao={evolucao} />
          <MetaByVertical goals={goals.byVertical} pctMonth={goals.pctMonthElapsed} />
        </div>

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
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>Em aberto agora</p>
                  <p style={{ fontSize: 'clamp(30px,3.8vw,40px)', fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.045em', lineHeight: 1 }}><CountUp value={openTotal} format={fmtBRL} /></p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Pill>{live.links.open.count} {live.links.open.count === 1 ? 'link aguardando' : 'links aguardando'}</Pill>
                    <Pill>{live.links.generatedCount} {live.links.generatedCount === 1 ? 'gerado' : 'gerados'} hoje</Pill>
                    <Pill tone="good">✓ {live.links.paid.count} {live.links.paid.count === 1 ? 'pago' : 'pagos'}{live.links.paid.value > 0 ? ` · ${fmtBRL(live.links.paid.value)}` : ''}</Pill>
                  </div>
                  {live.links.reissued > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      ↻ {live.links.reissued} {live.links.reissued === 1 ? 'reemissão' : 'reemissões'} do mesmo negócio — vale só a mais recente
                    </span>
                  )}
                </div>
              </div>
              <div className="fc-g4" style={{ marginBottom: outros && outros.count > 0 ? 6 : 16 }}>
                {ORDER.map((k, i) => <VerticalLiveCard key={k} k={k} bucket={live.links.byVertical[k]} total={openTotal} idx={i} />)}
              </div>
              {outros && outros.count > 0 && (
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 16px', textAlign: 'right' }}>
                  + {outros.count} {outros.count === 1 ? 'link' : 'links'} sem vertical identificada ({fmtBRL(outros.value)}), contam no total e no gráfico
                </p>
              )}
              <div className="fc-card" style={{ ...cvar('#6366f1'), padding: '18px 20px' }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>Links gerados por hora</p>
                <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '0 0 8px' }}>Só as horas com geração · passe o mouse pra ver por vertical</p>
                <HourlyLinksChart hours={live.links.byHour} />
              </div>
            </>
          )}
        </Block>

        {/* 4 — o que já aconteceu */}
        <Block icon={History} title="Links gerados nos últimos 15 dias"
          subtitle={history ? `${fmtDM(history.from)} a ${fmtDM(history.to)} · sem hoje · um por negócio (reemissão vale a mais recente) · conta todos, pagos ou não` : 'Carregando…'}
          right={history ? <Pill>{fmtInt(history.total.count)} {history.total.count === 1 ? 'link' : 'links'} no total</Pill> : undefined}>
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
                <HistorySummary total={history.total} />
                <div className="fc-g4">{ORDER.map((k, i) => <HistoryCard key={k} k={k} data={history.byVertical[k]} days={history.days} idx={i} />)}</div>
              </>
            )
          )}
          {history && !history.legacy && (history.outros.count > 0 || history.reissued > 0) && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '10px 0 0', textAlign: 'right' }}>
              {history.outros.count > 0 && <>+ {history.outros.count} {history.outros.count === 1 ? 'link' : 'links'} sem vertical identificada ({fmtBRL(history.outros.value)}), já no total</>}
              {history.outros.count > 0 && history.reissued > 0 && ' · '}
              {history.reissued > 0 && <>↻ {history.reissued} {history.reissued === 1 ? 'reemissão' : 'reemissões'} do mesmo negócio contadas uma vez</>}
            </p>
          )}
        </Block>

        {/* 5 — saúde da recorrência */}
        <VitalBlock total={commercial.forecast} monthly={commercial.monthlyForecast} detail={commercial.forecastDetail} />
      </div>
    </div>
  )
}
