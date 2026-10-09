'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Settings, RefreshCw, Volume2, VolumeX, TrendingUp, Target, Zap, Repeat, Coins } from 'lucide-react'
import Link from 'next/link'
import { useLiveData, LiveDataProvider } from '@/hooks/useLiveData'
import { createClient } from '@/lib/supabase/client'
import { VERTICALS, GOLD, VerticalId, Closer } from '@/lib/telao/types'
import { fmtBRL, monthKey, todayKey } from '@/lib/telao/format'
import * as A from '@/lib/telao/analytics'
import {
  CountUp, TrendBadge, PaceThermometer, Clock, Ticker, MoneyLeftOnTable, Celebration, GoalCelebration, MonthGoalCelebration, CloserGoalCelebration,
  initAudio, loadCelebratedGoals, persistCelebratedGoal,
} from './animations'
import { Panel, Legend, LineChart, StackBars, ShareArea, Donut, HeatGrid, TileMap, HBars, makeTheme, fmtCompact, fmtDM, Th, StackKey } from './charts'

// ══ Telão Completo — visão dos fundadores ═════════════════════════════════════
// Histórico + acumulado, 5 painéis (Geral/Anest/Oft/Ortop/R1) que filtram TUDO.
// Sem placar do "hoje": o foco é o período. As celebrações de venda e de meta
// continuam ao vivo (vêm do mesmo provider do Telão: useLiveData).
// Regras de receita e classificação: lib/telao/analytics.ts (cabeçalho do arquivo).

const MONO = "'JetBrains Mono',monospace"
const SANS = "'Space Grotesk',sans-serif"
const PURPLE = '#a855f7'
const accentOf = (p: A.PanelId) => (p === 'geral' ? PURPLE : VERTICALS[p].accent)

const KIND_KEYS: StackKey[] = [
  { id: 'nova', label: 'Venda nova', color: '#8b5cf6' }, { id: 'recorrencia', label: 'Recorrência', color: '#14b8a6' }, { id: 'evento', label: 'Eventos', color: '#f43f5e' },
]
const CHAN_KEYS: StackKey[] = [
  { id: 'closer', label: A.CHANNEL_LABEL.closer, color: '#6366f1' }, { id: 'self', label: A.CHANNEL_LABEL.self, color: '#22c55e' }, { id: 'embaixador', label: A.CHANNEL_LABEL.embaixador, color: '#ec4899' },
]
const VERT_KEYS: StackKey[] = A.VERT_IDS.map(v => ({ id: v, label: VERTICALS[v].label, color: VERTICALS[v].accent }))
const PAY_COLORS: Record<A.PayKind, string> = { cartao: '#8b5cf6', pix: '#22c55e', boleto: '#f59e0b', outros: '#94a3b8' }

// ── Histórico de vendas (paginado: o banco entrega 1.000 por vez) ──────────────
const COLS = 'id,event_type,vertical,value,occurred_at,seller_type,is_self_checkout,sold_by_ambassador,is_recurring,installment_number,sale_type,coupon_code,desconto_ignorado,transferred_at,co_closer_id,product,state,payment_type,payment_installments,event_name'
const PAGE = 1000

function useHistory() {
  const [sales, setSales] = useState<A.Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const map = useRef(new Map<string, A.Sale>())
  const maxAt = useRef<string | null>(null)

  const commit = useCallback(() => {
    const arr = [...map.current.values()].sort((a, b) => a.at.localeCompare(b.at))
    maxAt.current = arr.length ? arr[arr.length - 1].at : null
    setSales(arr); setUpdatedAt(new Date()); setError(null)
  }, [])

  const full = useCallback(async () => {
    const supabase = createClient()
    try {
      const out = new Map<string, A.Sale>()
      // Avança pelo que REALMENTE veio e só para numa página vazia: se o banco limitar a resposta
      // a menos de 1.000 linhas, ainda assim lemos tudo (nunca mostra um histórico cortado em silêncio).
      for (let from = 0, i = 0; i < 800; i++) {
        const { data, error: err } = await supabase.from('telao_events').select(COLS).eq('event_type', 'sale')
          .order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1)
        if (err) throw err
        const got = (data ?? []) as A.RawSale[]
        if (got.length === 0) break
        for (const r of got) { const s = A.toSale(r); if (s) out.set(s.id, s) }
        from += got.length
      }
      map.current = out; commit()
    } catch (e: any) { setError(e?.message ?? 'Erro ao carregar o histórico') } finally { setLoading(false) }
  }, [commit])

  // só o que chegou depois do último evento conhecido (barato; roda a cada 30s e a cada venda nova)
  const incremental = useCallback(async () => {
    if (!maxAt.current) return full()
    const supabase = createClient()
    try {
      const { data, error: err } = await supabase.from('telao_events').select(COLS).eq('event_type', 'sale').gte('occurred_at', maxAt.current).order('occurred_at', { ascending: true }).limit(PAGE)
      if (err) throw err
      let changed = false
      for (const r of (data ?? []) as A.RawSale[]) { const s = A.toSale(r); if (s && !map.current.has(s.id)) { map.current.set(s.id, s); changed = true } }
      if (changed) commit()
    } catch { /* tenta de novo no próximo ciclo */ }
  }, [commit, full])

  useEffect(() => {
    full()
    const a = setInterval(incremental, 30_000), b = setInterval(full, 10 * 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') incremental() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(a); clearInterval(b); document.removeEventListener('visibilitychange', onVis) }
  }, [full, incremental])

  return { sales, loading, error, updatedAt, reload: full, refreshNew: incremental }
}

function useGoalsMap(): A.GoalMap {
  const [goals, setGoals] = useState<A.GoalMap>({})
  useEffect(() => {
    const supabase = createClient()
    const load = () => supabase.from('company_goals').select('month, scope, goal_value').then(({ data }: any) => {
      const m: A.GoalMap = {}
      for (const g of (data ?? []) as { month: string; scope: string; goal_value: number }[]) (m[g.month] ??= {})[g.scope] = Number(g.goal_value) || 0
      setGoals(m)
    })
    load(); const id = setInterval(load, 5 * 60_000); return () => clearInterval(id)
  }, [])
  return goals
}

// ── helpers de texto ─────────────────────────────────────────────────────────
const rangeText = (r: A.Range) => `${fmtDM(r.start)} – ${fmtDM(r.end)}/${r.end.slice(0, 4)}`
const compareLabel = (p: A.PresetId) => p === 'mes' ? 'mês anterior (mesmos dias)' : p === 'trimestre' ? 'trimestre anterior (mesmos dias)' : p === 'ano' ? 'mesmo período do ano anterior' : p === 'mes_ant' ? 'mês retrasado' : 'período anterior'
const pctText = (cur: number, prev: number) => { const c = A.pctChange(cur, prev); return c === null ? null : c }

// ══ Hero ═════════════════════════════════════════════════════════════════════
function Hero({ th, accent, panel, sum, prev, pace, rangeLabel, cmpLabel }: { th: Th; accent: string; panel: A.PanelId; sum: A.Summary; prev: A.Summary | null; pace: A.MonthPace | null; rangeLabel: string; cmpLabel: string }) {
  const vert = panel === 'geral' ? null : VERTICALS[panel]
  const heroText = th.dark ? '#e9d5ff' : '#3b0764', labelMuted = th.dark ? '#a78bfa' : '#6d28d9'
  const chips = [
    { label: 'Vendas', value: <CountUp value={sum.count} format={v => Math.round(v).toLocaleString('pt-BR')} />, color: accent, Icon: TrendingUp, trend: prev ? pctText(sum.count, prev.count) : null },
    { label: 'Ticket médio', value: fmtBRL(sum.ticket), color: accent, Icon: Target, trend: prev ? pctText(sum.ticket, prev.ticket) : null },
    { label: 'Média por dia', value: fmtBRL(sum.perDay), color: accent, Icon: Zap, trend: prev ? pctText(sum.perDay, prev.perDay) : null },
    { label: 'Recorrência', value: `${fmtBRL(sum.byKind.recorrencia.revenue)} · ${sum.recurrencePct.toFixed(0)}%`, color: '#14b8a6', Icon: Repeat, trend: null },
    { label: 'Deixado na mesa', value: fmtBRL(sum.left), color: '#f59e0b', Icon: Coins, trend: null },
  ]
  const ch = prev ? pctText(sum.revenue, prev.revenue) : null
  return (
    <div data-hero style={{ background: th.dark ? 'linear-gradient(135deg,rgba(88,28,135,.35),rgba(59,7,100,.25),rgba(15,3,25,.4))' : 'linear-gradient(135deg,rgba(196,181,253,.55),rgba(233,213,255,.65),rgba(255,255,255,.5))', border: th.dark ? '1px solid rgba(168,85,247,.25)' : '1px solid rgba(139,92,246,.35)', borderRadius: 24, padding: '20px 26px', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(20px)', boxShadow: th.dark ? '0 0 60px rgba(88,28,135,.2),inset 0 1px 0 rgba(255,255,255,.06)' : '0 8px 32px rgba(139,92,246,.18),inset 0 1px 0 rgba(255,255,255,.5)' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(${accent}${th.dark ? '22' : '33'},transparent 70%)`, pointerEvents: 'none' }} />
      {vert && <motion.img key={vert.id} src={vert.mascot} alt={vert.label} initial={{ opacity: 0, scale: 0.8, x: 20 }} animate={{ opacity: 0.16, scale: 1, x: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }} style={{ position: 'absolute', right: 16, bottom: 0, height: 120, objectFit: 'contain', filter: 'grayscale(.3)', pointerEvents: 'none', zIndex: 0 }} />}
      <div className="tc-hero-row" style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 28, alignItems: 'stretch', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, color: th.dark ? '#c084fc' : '#7c3aed', textTransform: 'uppercase', letterSpacing: '.14em', margin: '0 0 2px', fontFamily: MONO }}>{A.PANEL_LABEL[panel]} · {rangeLabel}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', margin: '4px 0 14px' }}>
            <p data-revenue style={{ fontSize: 48, fontWeight: 900, color: accent, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: SANS, letterSpacing: '-.03em', lineHeight: 1 }}><CountUp value={sum.revenue} format={fmtBRL} duration={900} /></p>
            <TrendBadge label={`vs ${cmpLabel}`} pct={ch} isDark={th.dark} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {chips.map(k => (
              <div key={k.label} data-kpi={k.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px 8px 10px', borderRadius: 14, background: th.dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.5)' }}>
                <div style={{ width: 26, height: 26, borderRadius: 9, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><k.Icon size={13} style={{ color: k.color }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: heroText, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.7 }}>{k.label}{k.trend !== null && <span style={{ color: k.trend >= 0 ? '#16a34a' : '#dc2626', marginLeft: 6 }}>{k.trend >= 0 ? '▲' : '▼'}{Math.abs(k.trend).toFixed(0)}%</span>}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div data-pace style={{ flex: '0 0 340px', maxWidth: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          {pace ? (<>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><PaceThermometer status={pace.done ? 'acima' : pace.status} isDark={th.dark} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 10px' }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: labelMuted, textTransform: 'uppercase', letterSpacing: '.1em', margin: 0, fontFamily: MONO, whiteSpace: 'nowrap' }}>Meta do mês · {A.PANEL_LABEL[panel]}</p>
              <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0, fontFamily: MONO, whiteSpace: 'nowrap' }}><span style={{ color: accent }}>{fmtBRL(pace.revenue)}</span><span style={{ color: labelMuted, fontWeight: 600 }}> / {fmtBRL(pace.goal)}</span></p>
            </div>
            <div style={{ position: 'relative', height: 14, background: th.dark ? 'rgba(168,85,247,.12)' : 'rgba(139,92,246,.18)', borderRadius: 999, overflow: 'visible' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pace.pct, 100)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 999, background: pace.done ? 'linear-gradient(90deg,#22c55e,#16a34a)' : `linear-gradient(90deg,${accent},${accent}cc)` }} />
              <div title={`esperado até hoje: ${fmtBRL(pace.expected)}`} style={{ position: 'absolute', top: -3, bottom: -3, left: `${Math.min((pace.expected / pace.goal) * 100, 100)}%`, width: 2, background: th.dark ? '#fff' : '#3b0764', borderRadius: 2, opacity: 0.85 }} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: pace.done ? '#16a34a' : labelMuted, margin: 0, fontFamily: MONO }}>
              {pace.done ? '✅ META BATIDA!' : <>{pace.pct.toFixed(0)}% · faltam <span style={{ color: accent, fontWeight: 900 }}>{fmtBRL(pace.remaining)}</span> · {fmtBRL(pace.perDayNeeded)}/dia</>}
            </p>
            {!pace.done && <p style={{ fontSize: 10.5, margin: 0, color: labelMuted, fontFamily: MONO }}>📈 No ritmo atual fecha em <strong style={{ color: accent }}>{fmtBRL(pace.projection)}</strong> ({pace.projectionPct.toFixed(0)}% da meta)</p>}
          </>) : (
            <p style={{ fontSize: 11.5, color: labelMuted, margin: 0, fontFamily: MONO, textAlign: 'right' }}>Meta do mês não cadastrada para {A.PANEL_LABEL[panel]}.<br /><Link href="/intel/goals" style={{ color: accent, fontWeight: 800 }}>Cadastrar em Metas →</Link></p>
          )}
        </div>
      </div>
    </div>
  )
}

// ══ Barra de período ═════════════════════════════════════════════════════════
const chipBase = (active: boolean, accent: string, th: Th): React.CSSProperties => ({ height: 28, padding: '0 12px', borderRadius: 8, border: `1px solid ${active ? accent + '88' : th.dark ? 'rgba(255,255,255,.08)' : 'rgba(109,40,217,.2)'}`, background: active ? accent + '1c' : 'transparent', color: active ? accent : th.muted, fontSize: 10.5, fontWeight: 800, cursor: 'pointer', fontFamily: MONO, letterSpacing: '.03em', whiteSpace: 'nowrap', transition: 'all .15s' })
function PeriodBar({ th, accent, preset, setPreset, custom, setCustom, gran, setGran, effGran, compare, setCompare, range, prevR, hasPrev }: {
  th: Th; accent: string; preset: A.PresetId; setPreset: (p: A.PresetId) => void; custom: A.Range; setCustom: (r: A.Range) => void
  gran: 'auto' | A.Gran; setGran: (g: 'auto' | A.Gran) => void; effGran: A.Gran; compare: boolean; setCompare: (b: boolean) => void; range: A.Range; prevR: A.Range | null; hasPrev: boolean
}) {
  const inp: React.CSSProperties = { height: 28, borderRadius: 8, border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: 11, fontFamily: MONO, padding: '0 8px', colorScheme: th.dark ? 'dark' : 'light' }
  return (
    <div data-periodbar style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 9, fontWeight: 900, color: th.muted, fontFamily: MONO, letterSpacing: '.14em' }}>PERÍODO</span>
      {A.PRESETS.map(p => <button key={p.id} data-preset={p.id} onClick={() => setPreset(p.id)} style={chipBase(preset === p.id, accent, th)}>{p.label}</button>)}
      <button data-preset="custom" onClick={() => setPreset('custom')} style={chipBase(preset === 'custom', accent, th)}>Personalizado</button>
      {preset === 'custom' && (<>
        <input data-custom="start" type="date" value={custom.start} max={custom.end} onChange={e => e.target.value && setCustom({ ...custom, start: e.target.value })} style={inp} />
        <span style={{ color: th.muted, fontSize: 11 }}>até</span>
        <input data-custom="end" type="date" value={custom.end} min={custom.start} onChange={e => e.target.value && setCustom({ ...custom, end: e.target.value })} style={inp} />
      </>)}
      <span style={{ width: 1, height: 18, background: th.border, margin: '0 4px' }} />
      <span style={{ fontSize: 9, fontWeight: 900, color: th.muted, fontFamily: MONO, letterSpacing: '.14em' }}>AGRUPAR</span>
      {(['auto', 'dia', 'semana', 'mes'] as const).map(g => <button key={g} data-gran={g} onClick={() => setGran(g)} style={chipBase(gran === g, accent, th)}>{g === 'auto' ? `Auto (${effGran})` : g === 'mes' ? 'Mês' : g === 'dia' ? 'Dia' : 'Semana'}</button>)}
      <span style={{ width: 1, height: 18, background: th.border, margin: '0 4px' }} />
      <button data-compare onClick={() => setCompare(!compare)} title={prevR ? `Comparando com ${rangeText(prevR)}` : 'Sem período anterior para este filtro'} style={{ ...chipBase(compare && !!prevR, '#22c55e', th), opacity: prevR ? 1 : 0.5 }}>
        {compare && prevR ? (hasPrev ? `✓ Comparar · ${rangeText(prevR)}` : '✓ Comparar · sem dados antes') : 'Comparar'}
      </button>
      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: th.muted, fontFamily: MONO, fontWeight: 700 }}>{rangeText(range)} · {A.rangeLength(range)} dias</span>
    </div>
  )
}

// ══ Insights ═════════════════════════════════════════════════════════════════
function InsightsPanel({ th, insights, accent }: { th: Th; insights: A.Insight[]; accent: string }) {
  const toneColor = { good: '#22c55e', warn: '#f59e0b', info: accent }
  return (
    <Panel th={th} title="Leitura do período" sub="Calculada pelos números, sem chute" accent={accent} className="tc-s4" id="insights">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map((i, k) => (
          <motion.div key={i.id} data-insight={i.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + k * 0.07 }}
            style={{ display: 'flex', gap: 10, padding: '9px 11px', borderRadius: 12, background: th.dark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.65)', borderLeft: `3px solid ${toneColor[i.tone]}` }}>
            <span style={{ fontSize: 15, lineHeight: 1.25, flexShrink: 0 }}>{i.icon}</span>
            <span style={{ fontSize: 12, color: th.text, fontFamily: SANS, lineHeight: 1.4, fontWeight: 500 }}>{i.text}</span>
          </motion.div>
        ))}
      </div>
    </Panel>
  )
}

// ══ Composição da receita ═══════════════════════════════════════════════════
function CompositionPanel({ th, sum, cur, accent }: { th: Th; sum: A.Summary; cur: A.Sale[]; accent: string }) {
  const events = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of cur) if (s.kind === 'evento') m.set(s.eventName ?? 'Sem nome', (m.get(s.eventName ?? 'Sem nome') ?? 0) + s.value)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, value]) => ({ label, value }))
  }, [cur])
  const total = Math.max(sum.revenue, 1)
  return (
    <Panel th={th} title="Composição da receita" sub="Tudo é receita — aqui está como ela entrou" accent={accent} className="tc-s5" id="composicao">
      <div style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden', background: th.track, marginBottom: 12 }}>
        {KIND_KEYS.map(k => <motion.div key={k.id} initial={{ width: 0 }} animate={{ width: `${(sum.byKind[k.id as A.RevKind].revenue / total) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} style={{ background: k.color }} title={k.label} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
        {KIND_KEYS.map(k => { const v = sum.byKind[k.id as A.RevKind]; return (
          <div key={k.id} data-kind={k.id} style={{ padding: '8px 10px', borderRadius: 12, background: th.dark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.65)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9.5, fontWeight: 800, color: th.soft, fontFamily: MONO, textTransform: 'uppercase' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: k.color }} />{k.label}</span>
            <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 900, color: k.color, fontFamily: SANS, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(v.revenue)}</p>
            <p style={{ margin: 0, fontSize: 9.5, color: th.muted, fontFamily: MONO }}>{((v.revenue / total) * 100).toFixed(0)}% · {v.count} vendas</p>
          </div>) })}
      </div>
      <MoneyLeftOnTable value={sum.left} totalRevenue={sum.revenue} isDark={th.dark} />
      {events.length > 0 && (<div style={{ marginTop: 12 }}>
        <p style={{ margin: '0 0 7px', fontSize: 9.5, fontWeight: 900, color: th.muted, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.1em' }}>Eventos que mais venderam</p>
        <HBars th={th} items={events} color="#f43f5e" />
      </div>)}
    </Panel>
  )
}

// ══ Metas do mês (sempre o mês corrente) ═════════════════════════════════════
function GoalsPanel({ th, goals, sales, panel, today, accent }: { th: Th; goals: A.GoalMap; sales: A.Sale[]; panel: A.PanelId; today: string; accent: string }) {
  const month = A.monthOf(today)
  const scopes: A.PanelId[] = panel === 'geral' ? ['geral', ...A.VERT_IDS] : [panel]
  const rows = scopes.map(sc => {
    const goal = goals[month]?.[A.GOAL_SCOPE[sc]] ?? 0
    const ss = sc === 'geral' ? sales : sales.filter(s => s.vertical === sc)
    return { sc, goal, pace: A.monthPace(ss, goal, today), revenue: ss.filter(s => A.monthOf(s.day) === month).reduce((a, s) => a + s.value, 0) }
  })
  const stColor = { acima: '#22c55e', 'no-ritmo': '#eab308', abaixo: '#ef4444' }
  return (
    <Panel th={th} title="Metas do mês" sub={`${A.PANEL_LABEL[panel]} · mês corrente, independente do período escolhido`} accent={accent} className="tc-s5" id="metas">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(r => {
          const c = accentOf(r.sc), p = r.pace
          return (
            <div key={r.sc} data-goal={r.sc}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: c, fontFamily: MONO, textTransform: 'uppercase' }}>{r.sc === 'geral' ? '★ Geral' : VERTICALS[r.sc].short}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: th.soft, fontFamily: MONO }}>{p ? <><span style={{ color: th.text, fontWeight: 900 }}>{fmtCompact(r.revenue)}</span> / {fmtCompact(r.goal)}</> : 'sem meta cadastrada'}</span>
              </div>
              {p ? (<>
                <div style={{ position: 'relative', height: 12, borderRadius: 999, background: th.track }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(p.pct, 100)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 999, background: p.done ? 'linear-gradient(90deg,#22c55e,#16a34a)' : `linear-gradient(90deg,${c},${c}cc)` }} />
                  <div title={`esperado até hoje: ${fmtBRL(p.expected)}`} style={{ position: 'absolute', top: -3, bottom: -3, left: `${Math.min((p.expected / p.goal) * 100, 100)}%`, width: 2, background: th.text, borderRadius: 2, opacity: 0.8 }} />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: p.done ? '#22c55e' : stColor[p.status], fontFamily: MONO }}>{p.done ? '🏆 batida' : `${p.pct.toFixed(0)}% · ${p.status === 'acima' ? 'acima do ritmo' : p.status === 'no-ritmo' ? 'no ritmo' : 'abaixo do ritmo'}`}</span>
                  {!p.done && <span style={{ fontSize: 10, color: th.muted, fontFamily: MONO }}>projeção {fmtCompact(p.projection)} ({p.projectionPct.toFixed(0)}%)</span>}
                </div>
              </>) : null}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ══ Receita por região e estado ══════════════════════════════════════════════
const MEDALS = ['🥇', '🥈', '🥉']
function RegionPanel({ th, uf, accent }: { th: Th; uf: ReturnType<typeof A.byUF>; accent: string }) {
  const { regions } = useMemo(() => A.byRegion(uf.items), [uf])
  const top3 = useMemo(() => A.topStates(uf.items, 3), [uf])
  const lab: React.CSSProperties = { margin: '0 0 8px', fontSize: 9.5, fontWeight: 900, color: th.muted, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.1em' }
  return (
    <Panel th={th} title="Receita por região e estado" sub={`% sobre as vendas com estado informado (${uf.coveragePct.toFixed(0)}% do total)`} accent={accent} className="tc-s7" id="mapa">
      <div className="tc-region-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,300px) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        <TileMap th={th} data={uf.items} accent={accent} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div>
            <p style={lab}>Por região · % do total</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {regions.map((r, i) => (
                <div key={r.region} data-region={r.region}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: i === 0 ? 900 : 700, color: i === 0 ? accent : th.text, fontFamily: SANS }}>{r.label}{r.topUF && r.revenue > 0 ? <span style={{ fontSize: 9.5, color: th.soft, fontFamily: MONO, fontWeight: 600 }}> · {r.topUF.uf} lidera</span> : null}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: th.text, fontFamily: MONO, whiteSpace: 'nowrap' }}><span data-pct style={{ color: i === 0 ? accent : th.text }}>{r.sharePct.toFixed(r.sharePct >= 10 ? 0 : 1)}%</span><span style={{ color: th.soft, fontWeight: 600 }}> · {fmtCompact(r.revenue).replace('R$ ', 'R$ ')}</span></span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: th.track, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${r.sharePct}%` }} transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 999, background: accent, opacity: i === 0 ? 1 : 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={lab}>Top 3 estados · % do total</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {top3.map((st, i) => (
                <motion.div key={st.uf} data-top-state={st.uf} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', borderRadius: 12, background: th.dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.65)', borderLeft: `3px solid ${accent}` }}>
                  <span style={{ fontSize: 17 }}>{MEDALS[i]}</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: th.text, fontFamily: SANS, minWidth: 28 }}>{st.uf}</span>
                  <span style={{ fontSize: 10, color: th.soft, fontFamily: MONO, flex: 1 }}>{A.REGION_LABEL[st.region]} · {fmtCompact(st.revenue)}</span>
                  <span data-pct style={{ fontSize: 14, fontWeight: 900, color: accent, fontFamily: SANS }}>{st.sharePct.toFixed(1)}%</span>
                </motion.div>
              ))}
              {top3.length === 0 && <p style={{ margin: 0, fontSize: 11.5, color: th.muted, fontFamily: SANS }}>Sem vendas com estado informado no período.</p>}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ══ Forma de pagamento: à vista × parcelado + formas mais usadas ═══════════════
// Todas as % saem da receita TOTAL do período, e a lista termina em "Demais formas" +
// "Sem forma informada" — então as linhas sempre fecham em 100% (nada some em silêncio).
const PAY_ROW_COLOR: Record<A.PayRow['kind'], string> = { avista: '#22c55e', parcelado: '#8b5cf6', outras: '#94a3b8', 'sem-info': '#64748b' }
const pctFmt = (v: number) => `${v.toFixed(v >= 10 || v === 0 ? 0 : 1)}%`
function PaymentPanel({ th, ps, pay, accent }: { th: Th; ps: A.PayStructure; pay: ReturnType<typeof A.byPayment>; accent: string }) {
  const base = Math.max(ps.total, 1)
  const bd = useMemo(() => A.payBreakdown(ps, 5), [ps])
  const noInfo = ps.unknown.revenue > 0.005
  const cards = [
    { id: 'avista', label: 'À vista', color: '#22c55e', rev: ps.avista.revenue, n: ps.avista.count, note: 'Pix, boleto e cartão em 1x' },
    { id: 'parcelado', label: 'Parcelado', color: '#8b5cf6', rev: ps.parcelado.revenue, n: ps.parcelado.count, note: ps.parcelado.avgInstallments ? `média de ${ps.parcelado.avgInstallments.toFixed(1)} parcelas` : 'cartão/boleto em 2x ou mais' },
  ]
  const lab: React.CSSProperties = { margin: '0 0 8px', fontSize: 9.5, fontWeight: 900, color: th.muted, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.1em' }
  const donutSlices = [...pay.items.map(i => ({ id: i.kind, label: A.PAY_LABEL[i.kind], color: PAY_COLORS[i.kind], value: i.revenue })), ...(noInfo ? [{ id: 'nd', label: 'Não informado', color: '#64748b', value: ps.unknown.revenue }] : [])]
  const donutTop = [...donutSlices].sort((x, y) => y.value - x.value)[0]
  return (
    <Panel th={th} title="Forma de pagamento" accent={accent} className="tc-s6" id="pagamento"
      sub={noInfo ? `${ps.coveragePct.toFixed(0)}% da receita tem forma informada · o resto aparece como "Sem forma informada"` : '100% da receita com forma de pagamento informada'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginBottom: 10 }}>
        {cards.map(c => (
          <div key={c.id} data-pay={c.id} style={{ padding: '11px 14px', borderRadius: 14, background: `${c.color}14`, border: `1px solid ${c.color}40` }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: c.color, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.08em' }}>{c.label}</span>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: th.text, fontFamily: SANS, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(c.rev)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10.5, color: th.soft, fontFamily: MONO }}><strong data-pct style={{ color: c.color }}>{pctFmt((c.rev / base) * 100)}</strong> · {c.n.toLocaleString('pt-BR')} vendas · {c.note}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: th.track, marginBottom: noInfo ? 6 : 14 }}>
        {[...cards.map(c => ({ id: c.id, color: c.color, rev: c.rev })), ...(noInfo ? [{ id: 'nd', color: '#64748b', rev: ps.unknown.revenue }] : [])].map(c => <motion.div key={c.id} initial={{ width: 0 }} animate={{ width: `${(c.rev / base) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ background: c.color }} />)}
      </div>
      {noInfo && <p data-pay-noinfo style={{ margin: '0 0 12px', fontSize: 10.5, color: th.soft, fontFamily: MONO }}>⚪ Sem forma informada: <strong style={{ color: th.text }}>{fmtBRL(ps.unknown.revenue)}</strong> ({pctFmt((ps.unknown.revenue / base) * 100)}) · {ps.unknown.count} vendas — não dá pra classificar como à vista ou parcelado</p>}
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Donut th={th} size={128} centerTop={donutTop ? `${((donutTop.value / base) * 100).toFixed(0)}%` : '—'} centerBottom={donutTop ? donutTop.label : 'sem dados'} slices={donutSlices} />
          <Legend th={th} items={donutSlices.map(i => ({ id: i.id, label: `${i.label} · ${fmtCompact(i.value).replace('R$ ', '')}`, color: i.color }))} />
        </div>
        <div style={{ flex: 1, minWidth: 230 }}>
          <p style={lab}>Formas mais usadas · % da receita do período</p>
          <HBars th={th} color={accent} items={bd.rows.map(r => ({ label: r.label, value: r.revenue, sub: `${pctFmt((r.revenue / base) * 100)} · ${r.count} vendas`, color: PAY_ROW_COLOR[r.kind] }))} />
          <div data-pay-total style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${th.border}`, fontFamily: MONO, fontSize: 11, fontWeight: 800, color: th.text }}>
            <span>= Total do período</span><span>{fmtBRL(bd.total)} · 100%</span>
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ══ Quando a empresa vende: mapa compacto + ranking (melhor dia, melhor horário, top momentos) ══
const WD_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WD_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]
function HeatPanel({ th, heat, accent }: { th: Th; heat: A.Heat; accent: string }) {
  const hi = useMemo(() => A.heatHighlights(heat, 5), [heat])
  const best = hi.top[0]
  const dayMax = Math.max(...hi.days, 1), hourMax = Math.max(...hi.hours, 1)
  const card = { padding: '11px 14px 10px', borderRadius: 16, background: `${accent}14`, border: `1px solid ${accent}44`, minWidth: 0 } as const
  const lab: React.CSSProperties = { margin: '0 0 7px', fontSize: 9.5, fontWeight: 900, color: th.muted, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.1em' }
  return (
    <Panel th={th} title="Quando a empresa vende" sub="receita por dia da semana × hora · horário de São Paulo" accent={accent} className="tc-s6" id="calor">
      <HeatGrid th={th} cells={heat.cells} counts={heat.counts} max={heat.max} accent={accent} cell={13} highlight={best ?? null} />
      {!best ? <p style={{ margin: '12px 0 0', fontSize: 12, color: th.muted }}>Sem vendas no período.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            <div data-heat-day style={card}>
              <span style={{ fontSize: 9.5, fontWeight: 900, color: accent, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.1em' }}>📅 Melhor dia</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '3px 0 7px' }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: th.text, fontFamily: SANS, letterSpacing: '-.02em' }}>{WD_FULL[hi.day!.weekday]}</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: accent, fontFamily: SANS }}><span data-pct>{hi.day!.pct.toFixed(0)}%</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 30 }}>
                {WD_ORDER.map(d => (
                  <div key={d} title={`${WD_FULL[d]} · ${fmtBRL(hi.days[d])}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 2 }}>
                    <motion.div initial={{ height: 0 }} animate={{ height: Math.max((hi.days[d] / dayMax) * 20, hi.days[d] > 0 ? 2 : 1) }} transition={{ duration: 0.6, delay: 0.1 + d * 0.03 }} style={{ width: '100%', borderRadius: '3px 3px 0 0', background: accent, opacity: d === hi.day!.weekday ? 1 : 0.32 }} />
                    <span style={{ fontSize: 7.5, fontFamily: MONO, color: d === hi.day!.weekday ? th.text : th.soft, fontWeight: d === hi.day!.weekday ? 900 : 600, lineHeight: 1 }}>{WD_LETTER[d]}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 10, color: th.soft, fontFamily: MONO }}>{fmtBRL(hi.day!.revenue)} da receita do período</p>
            </div>
            <div data-heat-hour style={card}>
              <span style={{ fontSize: 9.5, fontWeight: 900, color: accent, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.1em' }}>🕒 Melhor horário</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '3px 0 7px' }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: th.text, fontFamily: SANS, letterSpacing: '-.02em' }}>{String(hi.hour!.hour).padStart(2, '0')}h</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: accent, fontFamily: SANS }}><span data-pct>{hi.hour!.pct.toFixed(0)}%</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 30 }}>
                {hi.hours.map((v, h) => (
                  <div key={h} title={`${String(h).padStart(2, '0')}h · ${fmtBRL(v)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 2 }}>
                    <motion.div initial={{ height: 0 }} animate={{ height: Math.max((v / hourMax) * 20, v > 0 ? 2 : 1) }} transition={{ duration: 0.6, delay: 0.1 + h * 0.012 }} style={{ width: '100%', borderRadius: '2px 2px 0 0', background: accent, opacity: h === hi.hour!.hour ? 1 : 0.32 }} />
                    <span style={{ fontSize: 7, fontFamily: MONO, color: th.soft, lineHeight: 1, height: 7 }}>{h % 6 === 0 ? h : ''}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 10, color: th.soft, fontFamily: MONO }}>{fmtBRL(hi.hour!.revenue)} da receita do período</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <p style={lab}>🏆 Ranking dos melhores momentos · dia + horário</p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6 }}>
              {hi.top.map((x, i) => (
                <motion.div key={`${x.weekday}-${x.hour}`} data-heat-rank={i + 1} data-heat-best={i === 0 ? '' : undefined} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }}
                  style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10, padding: i === 0 ? '10px 12px' : '7px 12px', borderRadius: 12, background: i === 0 ? `${accent}22` : th.dark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.65)', border: i === 0 ? `1px solid ${accent}66` : '1px solid transparent' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(x.pct / hi.top[0].pct) * 100}%` }} transition={{ duration: 0.8, delay: 0.25 + i * 0.07, ease: 'easeOut' }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: `${accent}${i === 0 ? '26' : '14'}`, zIndex: 0 }} />
                  <span style={{ position: 'relative', zIndex: 1, width: 26, textAlign: 'center', fontSize: i < 3 ? (i === 0 ? 20 : 17) : 11, fontWeight: 900, fontFamily: MONO, color: th.soft }}>{i < 3 ? MEDALS[i] : `${i + 1}º`}</span>
                  <span style={{ position: 'relative', zIndex: 1, flex: 1, fontSize: i === 0 ? 17 : 13.5, fontWeight: 900, color: th.text, fontFamily: SANS, letterSpacing: '-.01em' }}>{WD_FULL[x.weekday]} · {String(x.hour).padStart(2, '0')}h{i === 0 && <span style={{ marginLeft: 8, fontSize: 9.5, color: accent, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.08em' }}>🔥 melhor momento</span>}</span>
                  <span style={{ position: 'relative', zIndex: 1, textAlign: 'right', fontFamily: MONO, lineHeight: 1.25 }}>
                    <strong style={{ display: 'block', fontSize: i === 0 ? 14 : 12, color: i === 0 ? accent : th.text }}>{fmtBRL(x.revenue)}</strong>
                    <span style={{ fontSize: 9.5, color: th.soft }}><span data-pct>{x.pct.toFixed(1)}%</span> da receita · {x.count} vendas</span>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

// ══ Tela ═════════════════════════════════════════════════════════════════════
function TelaoCompletoInner() {
  const live = useLiveData()
  const { events, closers, goals: liveGoals, monthRevenue, latest, clearLatest, loading: liveLoading, refetch } = live
  const hist = useHistory()
  const goalsMap = useGoalsMap()

  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState('')
  const [panel, setPanel] = useState<A.PanelId>('geral')
  const [preset, setPreset] = useState<A.PresetId>('mes')
  const [custom, setCustom] = useState<A.Range>({ start: '', end: '' })
  const [granPref, setGranPref] = useState<'auto' | A.Gran>('auto')
  const [compare, setCompare] = useState(true)
  const [offKinds, setOffKinds] = useState<Set<string>>(new Set())
  const [audioOn, setAudio] = useState(false)
  const [isDark, setIsDark] = useState(true)

  // celebrações (mesmos 3 tipos do Telão ao vivo + meta do mês da empresa/vertical)
  const [celeb, setCeleb] = useState<typeof latest>(null)
  const [metaCeleb, setMetaCeleb] = useState<{ vertical: VerticalId | null; value: number } | null>(null)
  const [monthCeleb, setMonthCeleb] = useState<{ vertical: VerticalId | null; value: number } | null>(null)
  const [closerGoalCeleb, setCloserGoalCeleb] = useState<{ closer: Closer | null; name: string; value: number } | null>(null)
  const [closerMonthlyGoals, setCloserMonthlyGoals] = useState<{ closerId: string; name: string; goal: number }[]>([])
  const [monthSalesRaw, setMonthSalesRaw] = useState<{ value: number; closer_id: string | null; closer_hubspot_id: string | null }[]>([])
  const celebrated = useRef(new Set<string>())
  const monthBaseline = useRef(false)

  useEffect(() => { setMounted(true); setToday(A.todaySP()); celebrated.current = loadCelebratedGoals() }, [])
  useEffect(() => { const id = setInterval(() => setToday(A.todaySP()), 60_000); return () => clearInterval(id) }, [])
  useEffect(() => {
    const check = () => { const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim(); setIsDark(!(bg.includes('f0') || bg.includes('ff') || bg.includes('240') || bg.includes('248'))) }
    check(); const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    return () => obs.disconnect()
  }, [])
  const th = useMemo(() => makeTheme(isDark), [isDark])
  const accent = accentOf(panel)
  const T = today || '2000-01-01'      // antes de carregar não existe "hoje" — evita calcular com período vazio

  // atalhos 1-5 trocam o painel (útil na TV)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      const i = Number(e.key); if (i >= 1 && i <= 5) setPanel(A.PANELS[i - 1])
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── celebração de venda (mesmo caminho do Telão) + atualiza os gráficos logo depois ──
  useEffect(() => {
    if (!latest) return
    setCeleb(latest); clearLatest()
    const id = setTimeout(() => hist.refreshNew(), 1500)
    return () => clearTimeout(id)
  }, [latest]) // eslint-disable-line react-hooks/exhaustive-deps

  // meta do DIA batida (geral ou vertical) — igual ao Telão ao vivo
  const todayRevByScope = useMemo(() => {
    const map: Record<string, number> = { geral: 0 }
    events.filter(e => e.event_type === 'sale').forEach(e => { map.geral += e.value ?? 0; map[e.vertical] = (map[e.vertical] ?? 0) + (e.value ?? 0) })
    return map
  }, [events])
  useEffect(() => {
    if (!mounted) return
    for (const g of liveGoals.filter(x => x.period === 'day' && x.period_key === todayKey())) {
      if (!g.target_value || g.target_value <= 0) continue
      const scope = g.vertical ?? 'geral', rev = todayRevByScope[scope] ?? 0, key = `${todayKey()}-${scope}`
      if (rev >= g.target_value && !celebrated.current.has(key)) { persistCelebratedGoal(key, celebrated.current); setMetaCeleb({ vertical: g.vertical as VerticalId | null, value: rev }); break }
    }
  }, [todayRevByScope, liveGoals, mounted])

  // meta do MÊS batida (empresa/vertical). O que já estava batido ao abrir a tela NÃO comemora de novo.
  useEffect(() => {
    if (!mounted || liveLoading) return
    const mg = liveGoals.filter(g => g.period === 'month' && g.period_key === monthKey() && g.target_value > 0)
    if (mg.length === 0) return
    const rev = (g: typeof mg[number]) => (g.vertical ? monthRevenue.byVertical[g.vertical as VerticalId] ?? 0 : monthRevenue.overall)
    const keyOf = (g: typeof mg[number]) => `${monthKey()}-mes-${g.vertical ?? 'geral'}`
    if (!monthBaseline.current) { monthBaseline.current = true; mg.filter(g => rev(g) >= g.target_value).forEach(g => persistCelebratedGoal(keyOf(g), celebrated.current)); return }
    for (const g of mg) {
      if (rev(g) >= g.target_value && !celebrated.current.has(keyOf(g))) { persistCelebratedGoal(keyOf(g), celebrated.current); setMonthCeleb({ vertical: g.vertical as VerticalId | null, value: rev(g) }); break }
    }
  }, [monthRevenue, liveGoals, mounted, liveLoading])

  // meta do mês de cada closer — mesma busca/ponte (hubspot_id) do Telão ao vivo
  const byId = useMemo(() => Object.fromEntries(closers.map(c => [c.id, c])) as Record<string, Closer>, [closers])
  const byHubId = useMemo(() => Object.fromEntries(closers.filter(c => c.hubspot_id).map(c => [String(c.hubspot_id), c])) as Record<string, Closer>, [closers])
  useEffect(() => {
    if (closers.length === 0) return
    const supabase = createClient()
    Promise.all([supabase.from('closer_goals').select('user_id, goal_sales').eq('month', monthKey()), supabase.from('profiles').select('id, hubspot_id')]).then(([{ data: g }, { data: p }]: any) => {
      const hub = Object.fromEntries((p ?? []).map((x: any) => [x.id, x.hubspot_id]))
      setCloserMonthlyGoals((g ?? []).map((x: any) => { const h = hub[x.user_id]; const c = h ? closers.find(k => k.hubspot_id && String(k.hubspot_id) === String(h)) : null; return c ? { closerId: c.id, name: c.name, goal: Number(x.goal_sales) || 0 } : null }).filter(Boolean))
    })
  }, [closers])
  useEffect(() => {
    const supabase = createClient()
    supabase.from('telao_events').select('value, closer_id, closer_hubspot_id').eq('event_type', 'sale').gte('occurred_at', `${monthKey()}-01T00:00:00-03:00`).then(({ data }: any) => setMonthSalesRaw((data ?? []) as any))
  }, [latest, mounted])
  const closerMonthRevenue = useMemo(() => {
    const m: Record<string, number> = {}
    monthSalesRaw.forEach(e => { const c = (e.closer_id && byId[e.closer_id]) || (e.closer_hubspot_id && byHubId[String(e.closer_hubspot_id)]) || null; if (c) m[c.id] = (m[c.id] ?? 0) + (e.value ?? 0) })
    return m
  }, [monthSalesRaw, byId, byHubId])
  useEffect(() => {
    if (!mounted || closerMonthlyGoals.length === 0) return
    for (const g of closerMonthlyGoals) {
      if (g.goal <= 0) continue
      const rev = closerMonthRevenue[g.closerId] ?? 0, key = `${monthKey()}-closer-${g.closerId}`
      if (rev >= g.goal && !celebrated.current.has(key)) { persistCelebratedGoal(key, celebrated.current); setCloserGoalCeleb({ closer: byId[g.closerId] ?? null, name: g.name, value: rev }); break }
    }
  }, [closerMonthRevenue, closerMonthlyGoals, mounted, byId])

  // ── dados da tela ───────────────────────────────────────────────────────────
  const sales = hist.sales
  const firstDay = sales[0]?.day ?? T
  const range = useMemo(() => A.resolvePreset(preset, T, firstDay, custom.start ? custom : undefined), [preset, T, firstDay, custom])
  useEffect(() => { if (today && !custom.start) setCustom({ start: A.monthStartOf(today), end: today }) }, [today, custom.start])
  const prevR = useMemo(() => (compare ? A.previousRange(preset, range) : null), [compare, preset, range])
  const effGran: A.Gran = granPref === 'auto' ? A.suggestGran(range) : granPref

  const cur = useMemo(() => A.filterSales(sales, panel, range), [sales, panel, range])
  const prevSales = useMemo(() => (prevR ? A.filterSales(sales, panel, prevR) : []), [sales, panel, prevR])
  const hasPrev = prevSales.length > 0
  const sum = useMemo(() => A.summarize(cur, A.rangeLength(range)), [cur, range])
  const prevSum = useMemo(() => (hasPrev && prevR ? A.summarize(prevSales, A.rangeLength(prevR)) : null), [hasPrev, prevSales, prevR])

  const panelAll = useMemo(() => (panel === 'geral' ? sales : sales.filter(s => s.vertical === panel)), [sales, panel])
  const goalThisMonth = goalsMap[A.monthOf(T)]?.[A.GOAL_SCOPE[panel]] ?? 0
  const pace = useMemo(() => A.monthPace(panelAll, goalThisMonth, T), [panelAll, goalThisMonth, T])
  const heat = useMemo(() => A.heatmap(cur), [cur])
  const insights = useMemo(() => A.buildInsights({ panel, sum, prev: prevSum, pace, heat }), [panel, sum, prevSum, pace, heat])

  // gráfico acumulado — no "Este mês" estende até o fim do mês (mostra o futuro vazio, a meta e a projeção)
  const monthMode = preset === 'mes'
  const chartRange = monthMode ? { start: range.start, end: A.monthEndOf(range.start) } : range
  const chartPrev = monthMode && compare ? (() => { const pm = A.addMonths(A.monthOf(range.start), -1); return { start: `${pm}-01`, end: A.monthEndOf(`${pm}-01`) } })() : prevR
  const cum = useMemo(() => A.cumulativeDaily(cur, chartRange, T), [cur, chartRange.start, chartRange.end, T]) // eslint-disable-line react-hooks/exhaustive-deps
  const cumPrev = useMemo(() => (chartPrev && hasPrev ? A.cumulativeDaily(A.filterSales(sales, panel, chartPrev), chartPrev, '9999-12-31') : null), [chartPrev?.start, chartPrev?.end, hasPrev, sales, panel]) // eslint-disable-line react-hooks/exhaustive-deps
  const goalRange = A.goalForRange(goalsMap, range, panel)
  const singleMonth = A.monthOf(range.start) === A.monthOf(range.end)
  const lastIdx = cum.values.reduce((a: number, v, i) => (v !== null ? i : a), -1)
  const projection = monthMode && pace && !pace.done && lastIdx >= 0 ? { fromIdx: lastIdx, fromValue: cum.values[lastIdx] as number, toIdx: cum.days.length - 1, toValue: pace.projection } : null

  const buckets = useMemo(() => A.bucketize(cur, range, effGran), [cur, range, effGran])
  const shareGran: A.Gran = effGran === 'dia' && A.rangeLength(range) > 14 ? 'semana' : effGran
  const shareBuckets = useMemo(() => (shareGran === effGran ? buckets : A.bucketize(cur, range, shareGran)), [shareGran, effGran, buckets, cur, range])
  const carry = (rows: number[][]) => { let last: number[] | null = null; return rows.map(r => { if (r.some(v => v > 0)) { last = r; return r } return last ?? r }) }
  const vertShare = carry(shareBuckets.map(b => A.VERT_IDS.map(v => b.byVertical[v])))
  const chanShare = carry(shareBuckets.map(b => (['closer', 'self', 'embaixador'] as A.Channel[]).map(c => b.byChannel[c])))
  const cumVert = useMemo(() => A.cumulativeBy(cur, range, T, s => s.vertical, A.VERT_IDS), [cur, range, T])
  const cumKind = useMemo(() => A.cumulativeBy(cur, range, T, s => s.kind, ['nova', 'recorrencia', 'evento'] as const), [cur, range, T])
  const cumChan = useMemo(() => A.cumulativeBy(cur, range, T, s => s.channel, ['closer', 'self', 'embaixador'] as const), [cur, range, T])
  const uf = useMemo(() => A.byUF(cur), [cur])
  const pay = useMemo(() => A.byPayment(cur), [cur])
  const prods = useMemo(() => A.topProducts(cur, 6), [cur])
  const payS = useMemo(() => A.payStructure(cur), [cur])
  const toggleKind = (id: string) => setOffKinds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const cmpLabel = compareLabel(preset)
  const rangeLabel = `${A.PRESETS.find(p => p.id === preset)?.label ?? 'Personalizado'} (${rangeText(range)})`
  const loadingAll = !mounted || hist.loading || !today

  return (
    <div style={{ background: th.dark ? '#0a0015' : '#f7f3ff', minHeight: '100vh', color: th.text, fontFamily: SANS, position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:rgba(88,28,135,.1);}::-webkit-scrollbar-thumb{background:rgba(168,85,247,.4);border-radius:999px;}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .tc-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
        .tc-grid>*{grid-column:span 12}
        @media(min-width:1100px){.tc-s3{grid-column:span 3}.tc-s4{grid-column:span 4}.tc-s5{grid-column:span 5}.tc-s6{grid-column:span 6}.tc-s7{grid-column:span 7}.tc-s8{grid-column:span 8}}
        @media(max-width:960px){.tc-hero-row{flex-direction:column!important}}
        @media(max-width:780px){.tc-region-grid{grid-template-columns:1fr!important}}
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: th.dark ? 'radial-gradient(ellipse at 20% 50%,rgba(88,28,135,.12),transparent 50%)' : 'radial-gradient(ellipse at 10% 30%,rgba(139,92,246,.15),transparent 50%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, backgroundImage: th.dark ? 'radial-gradient(rgba(168,85,247,.04) 1px,transparent 1px)' : 'radial-gradient(rgba(109,40,217,.12) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

      {/* Cabeçalho */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: th.dark ? 'rgba(10,0,21,.92)' : 'rgba(237,233,254,.97)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${th.border}`, padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(168,85,247,.8)', letterSpacing: '.16em', fontFamily: MONO }}>TELÃO COMPLETO</span>
            {panel !== 'geral' && <span style={{ fontSize: 10, fontWeight: 900, color: accent, letterSpacing: '.1em', fontFamily: MONO }}>· {VERTICALS[panel].short}</span>}
          </div>
          <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
            {A.PANELS.map((id, i) => {
              const active = panel === id, c = accentOf(id)
              return <motion.button key={id} data-panel-tab={id} whileTap={{ scale: 0.96 }} onClick={() => setPanel(id)} title={`Atalho: ${i + 1}`}
                style={{ height: 28, padding: '0 14px', borderRadius: 8, border: `1px solid ${active ? c + '88' : th.dark ? 'rgba(255,255,255,.07)' : 'rgba(109,40,217,.2)'}`, background: active ? c + '18' : 'transparent', color: active ? c : th.muted, fontSize: 10.5, fontWeight: 900, cursor: 'pointer', fontFamily: MONO, letterSpacing: '.07em', transition: 'all .2s' }}>
                {id === 'geral' ? '★ GERAL' : id === 'medreview' ? 'R1' : VERTICALS[id].short}
              </motion.button>
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { onClick: () => { if (!audioOn) { initAudio(); setAudio(true) } else setAudio(false) }, node: audioOn ? <Volume2 size={13} /> : <VolumeX size={13} />, label: 'Som', on: audioOn },
              { onClick: () => { hist.reload(); refetch() }, node: <RefreshCw size={13} style={{ animation: hist.loading || liveLoading ? 'spin 1s linear infinite' : 'none' }} />, label: 'Atualizar', on: false },
            ].map(b => <motion.button key={b.label} aria-label={b.label} whileTap={{ scale: 0.95 }} onClick={b.onClick} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(168,85,247,.15)', background: b.on ? 'rgba(168,85,247,.12)' : 'rgba(255,255,255,.02)', color: b.on ? '#c4b5fd' : '#9d8bc4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{b.node}</motion.button>)}
            <Link href="/intel/goals" style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(168,85,247,.15)', background: 'rgba(255,255,255,.02)', color: '#9d8bc4', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: MONO }}><Settings size={12} /> Meta</Link>
            <motion.button aria-label="Tela cheia" whileTap={{ scale: 0.95 }} onClick={() => document.documentElement.requestFullscreen?.()} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(168,85,247,.15)', background: 'rgba(255,255,255,.02)', color: '#9d8bc4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={13} /></motion.button>
            <Clock isDark={th.dark} />
          </div>
        </div>
        {!loadingAll && <PeriodBar th={th} accent={accent} preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} gran={granPref} setGran={setGranPref} effGran={effGran} compare={compare} setCompare={setCompare} range={range} prevR={prevR} hasPrev={hasPrev} />}
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}><Ticker events={events} /></div>

      <div data-telao-completo style={{ position: 'relative', zIndex: 1, padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {hist.error && <p role="alert" style={{ margin: 0, padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)', color: '#fca5a5', fontSize: 12, fontFamily: MONO }}>Não consegui carregar o histórico ({hist.error}). Tentando de novo em instantes.</p>}
        {loadingAll ? (
          <div data-loading style={{ height: 220, borderRadius: 24, background: th.card, border: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.muted, fontFamily: MONO, fontSize: 12 }}>Carregando o histórico de vendas…</div>
        ) : (<>
          <Hero th={th} accent={accent} panel={panel} sum={sum} prev={prevSum} pace={pace} rangeLabel={rangeLabel} cmpLabel={cmpLabel} />

          <div className="tc-grid">
            <Panel th={th} title="Receita acumulada" accent={accent} className="tc-s8" id="acumulado"
              sub={`${A.PANEL_LABEL[panel]} · soma dia a dia${monthMode ? ' · até o fim do mês' : ''}${cumPrev ? ` · linha tracejada = ${cmpLabel}` : ''}`}
              right={<Legend th={th} items={[{ id: 'a', label: 'Realizado', color: accent }, ...(cumPrev ? [{ id: 'b', label: 'Comparação', color: th.dark ? '#e9d5ff' : '#6d28d9' }] : []), ...(goalRange.complete && singleMonth ? [{ id: 'c', label: 'Meta', color: '#22c55e' }] : [])]} />}>
              {sum.count === 0 ? <p style={{ margin: 'auto', color: th.muted, fontSize: 12.5 }}>Nenhuma venda neste período.</p> :
                <LineChart th={th} xDays={cum.days} accent={accent} height={310} goal={goalRange.complete && singleMonth ? goalRange.total : null} projection={projection}
                  series={[
                    ...(cumPrev ? [{ id: 'prev', label: cmpLabel, color: th.dark ? '#e9d5ff' : '#6d28d9', values: cumPrev.values, ghost: true }] : []),
                    { id: 'cur', label: A.PANEL_LABEL[panel], color: accent, values: cum.values },
                  ]} />}
            </Panel>
            <InsightsPanel th={th} insights={insights.slice(0, 8)} accent={accent} />

            <Panel th={th} title="Receita por período" accent={accent} className="tc-s7" id="periodo"
              sub={`agrupado por ${effGran === 'dia' ? 'dia' : effGran === 'semana' ? 'semana (começa na segunda)' : 'mês'} · empilhado por origem`}
              right={<Legend th={th} items={KIND_KEYS} onToggle={toggleKind} off={offKinds} />}>
              <StackBars th={th} labels={buckets.map(b => b.label)} keys={KIND_KEYS} off={offKinds} height={270}
                stacks={buckets.map(b => [b.byKind.nova, b.byKind.recorrencia, b.byKind.evento])} />
            </Panel>
            <CompositionPanel th={th} sum={sum} cur={cur} accent={accent} />

            {panel === 'geral' ? (
              <Panel th={th} title="Comparativo acumulado por vertical" sub="quem puxa a receita — soma dia a dia, uma linha por vertical" accent={accent} className="tc-s6" id="acum-vertical" right={<Legend th={th} items={VERT_KEYS} />}>
                <LineChart th={th} xDays={cumVert.anestreview.days} accent={accent} height={250}
                  series={A.VERT_IDS.map(v => ({ id: v, label: VERTICALS[v].label, color: VERTICALS[v].accent, values: cumVert[v].values, area: false }))} />
              </Panel>
            ) : (
              <Panel th={th} title="Comparativo acumulado por origem" sub="venda nova × recorrência × eventos — soma dia a dia" accent={accent} className="tc-s6" id="acum-origem" right={<Legend th={th} items={KIND_KEYS} />}>
                <LineChart th={th} xDays={cumKind.nova.days} accent={accent} height={250}
                  series={KIND_KEYS.map(k => ({ id: k.id, label: k.label, color: k.color, values: cumKind[k.id as A.RevKind].values, area: false }))} />
              </Panel>
            )}
            <Panel th={th} title="Comparativo acumulado por canal" sub="Imparáveis × Self Checkout × Embaixadores — soma dia a dia" accent={accent} className="tc-s6" id="acum-canal" right={<Legend th={th} items={CHAN_KEYS} />}>
              <LineChart th={th} xDays={cumChan.closer.days} accent={accent} height={250}
                series={CHAN_KEYS.map(k => ({ id: k.id, label: k.label, color: k.color, values: cumChan[k.id as A.Channel].values, area: false }))} />
            </Panel>

            {panel === 'geral' ? (
              <Panel th={th} title="Participação por vertical" sub={`quanto cada vertical pesa na receita · ${shareGran === 'semana' ? 'por semana' : shareGran === 'mes' ? 'por mês' : 'por dia'}`} accent={accent} className="tc-s6" id="verticais" right={<Legend th={th} items={VERT_KEYS} />}>
                <div style={{ marginBottom: 14 }}>
                  <HBars th={th} color={accent} items={A.VERT_IDS.map(v => ({ label: VERTICALS[v].label, value: sum.byVertical[v].revenue, sub: `${sum.revenue > 0 ? ((sum.byVertical[v].revenue / sum.revenue) * 100).toFixed(0) : 0}%${prevSum && prevSum.byVertical[v].revenue > 0 ? ` · ${sum.byVertical[v].revenue >= prevSum.byVertical[v].revenue ? '▲' : '▼'}${Math.abs(((sum.byVertical[v].revenue - prevSum.byVertical[v].revenue) / prevSum.byVertical[v].revenue) * 100).toFixed(0)}%` : ''}`, color: VERTICALS[v].accent })).sort((a, b) => b.value - a.value)} />
                </div>
                <ShareArea th={th} labels={shareBuckets.map(b => b.label)} parts={vertShare} keys={VERT_KEYS} height={190} />
              </Panel>
            ) : (
              <Panel th={th} title="Produtos que mais vendem" sub={`${VERTICALS[panel].label} · por receita no período`} accent={accent} className="tc-s6" id="produtos">
                <HBars th={th} color={accent} items={prods.map(p => ({ label: p.product, value: p.revenue, sub: `${p.count} vendas` }))} />
              </Panel>
            )}

            <Panel th={th} title="Canais de venda" sub={`de onde vem a receita · ${shareGran === 'semana' ? 'por semana' : shareGran === 'mes' ? 'por mês' : 'por dia'}`} accent={accent} className="tc-s6" id="canais" right={<Legend th={th} items={CHAN_KEYS} />}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <Donut th={th} size={150} centerTop={fmtCompact(sum.revenue).replace('R$ ', '')} centerBottom="no período"
                  slices={CHAN_KEYS.map(k => ({ id: k.id, label: k.label, color: k.color, value: sum.byChannel[k.id as A.Channel].revenue }))} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <HBars th={th} color={accent} items={CHAN_KEYS.map(k => ({ label: k.label, value: sum.byChannel[k.id as A.Channel].revenue, sub: `${sum.revenue > 0 ? ((sum.byChannel[k.id as A.Channel].revenue / sum.revenue) * 100).toFixed(0) : 0}% · ${sum.byChannel[k.id as A.Channel].count} vendas`, color: k.color })).sort((a, b) => b.value - a.value)} />
                </div>
              </div>
              <ShareArea th={th} labels={shareBuckets.map(b => b.label)} parts={chanShare} keys={CHAN_KEYS} height={150} />
            </Panel>

            <GoalsPanel th={th} goals={goalsMap} sales={sales} panel={panel} today={today} accent={accent} />
            <RegionPanel th={th} uf={uf} accent={accent} />

            <PaymentPanel th={th} ps={payS} pay={pay} accent={accent} />
            <HeatPanel th={th} heat={heat} accent={accent} />
          </div>

          <p style={{ margin: 0, textAlign: 'center', fontSize: 10, color: th.muted, fontFamily: MONO }}>
            Base: {sales.length.toLocaleString('pt-BR')} vendas desde {firstDay.split('-').reverse().join('/')} · atualizado {hist.updatedAt?.toLocaleTimeString('pt-BR') ?? '—'} · horário de São Paulo · receita = todas as vendas (recorrência inclusa)
          </p>
        </>)}
      </div>

      {/* Celebrações — as mesmas do Telão ao vivo */}
      <AnimatePresence>{celeb && <Celebration key={celeb.id} ev={celeb} byId={byId} byHubId={byHubId} onDone={() => setCeleb(null)} />}</AnimatePresence>
      <AnimatePresence>{metaCeleb && <GoalCelebration key={`d-${metaCeleb.vertical}-${metaCeleb.value}`} vertical={metaCeleb.vertical} value={metaCeleb.value} onDone={() => setMetaCeleb(null)} />}</AnimatePresence>
      <AnimatePresence>{monthCeleb && <MonthGoalCelebration key={`m-${monthCeleb.vertical}-${monthCeleb.value}`} vertical={monthCeleb.vertical} value={monthCeleb.value} onDone={() => setMonthCeleb(null)} />}</AnimatePresence>
      <AnimatePresence>{closerGoalCeleb && <CloserGoalCelebration key={`c-${closerGoalCeleb.name}-${closerGoalCeleb.value}`} closer={closerGoalCeleb.closer} name={closerGoalCeleb.name} value={closerGoalCeleb.value} onDone={() => setCloserGoalCeleb(null)} />}</AnimatePresence>
    </div>
  )
}

export function TelaoCompleto() {
  return <LiveDataProvider><TelaoCompletoInner /></LiveDataProvider>
}
