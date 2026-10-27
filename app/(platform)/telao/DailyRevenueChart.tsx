'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { VERTICALS, GOLD, VerticalId } from '@/lib/telao/types'
import { fmtBRL, monthStart } from '@/lib/telao/format'
import { todayInSaoPaulo } from '@/lib/timezone'
import { buildDailySeries, DaySale, fmtShort, niceMax } from '@/lib/telao/dailySeries'

// ══ Receita por dia do mês ═══════════════════════════════════════════════════
// Fica logo abaixo dos canais (Imparáveis / Self Checkout / Embaixadores). Uma barra por dia do mês corrente;
// trocar o painel (Geral → Anest…) refaz as barras só com aquela vertical, com transição suave.
// "Geral" soma a receita de TODAS as verticais em cada dia. Regras de cálculo: lib/telao/dailySeries.ts.

const MONO = "'JetBrains Mono',monospace"
const GROTESK = "'Space Grotesk',sans-serif"
const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// ── Histórico do mês ────────────────────────────────────────────────────────
// O Supabase entrega no máximo 1.000 linhas por consulta (e corta em silêncio). Num mês forte passa disso, então a busca
// é PAGINADA: pede de 1.000 em 1.000 e só para quando vem uma página vazia (funciona mesmo se o limite do servidor for menor).
const PAGE = 1000
const MAX_PAGES = 200
const REFRESH_MS = 10 * 60_000     // refaz o histórico a cada 10 min (correções em dias passados)
const STALE_MS = 2 * 60_000        // ao voltar pra aba, só refaz se o histórico tiver mais de 2 min
const COLS = 'id, occurred_at, value, vertical, closer_id, closer_name, is_self_checkout'

export interface MonthSales {
  rows: DaySale[]
  status: 'loading' | 'ready' | 'error'
  reload: () => void
}

export function useMonthSales(enabled: boolean, refreshKey = 0): MonthSales {
  const [state, setState] = useState<{ rows: DaySale[]; month: string | null; status: 'loading' | 'ready' | 'error' }>({ rows: [], month: null, status: 'loading' })
  const [, force] = useState(0)
  const seq = useRef(0)
  const fetchedAt = useRef(0)
  const startedAt = useRef(0)         // quando a última busca COMEÇOU (evita duas buscas seguidas pelo mesmo evento)
  const today = todayInSaoPaulo()
  const month = today.slice(0, 7)

  const load = useCallback(async () => {
    const my = ++seq.current
    startedAt.current = Date.now()
    const monthNow = todayInSaoPaulo().slice(0, 7)
    try {
      const supabase = createBrowserClient()
      const start = monthStart()
      const all: DaySale[] = []
      let from = 0
      for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await supabase.from('telao_events').select(COLS)
          .eq('event_type', 'sale').gte('occurred_at', start)
          .order('occurred_at', { ascending: true }).order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        const got = (data ?? []) as DaySale[]
        if (got.length === 0) break
        all.push(...got)
        from += got.length
      }
      if (my !== seq.current) return                                  // chegou uma busca mais nova: descarta esta
      fetchedAt.current = Date.now()
      setState({ rows: all, month: monthNow, status: 'ready' })
    } catch {
      if (my !== seq.current) return
      // mantém o que já tinha (se for do mesmo mês) e só avisa que a atualização falhou
      setState(s => ({ rows: s.month === monthNow ? s.rows : [], month: s.month === monthNow ? s.month : null, status: 'error' }))
    }
  }, [])

  // O "hoje" é recalculado a cada render; este relógio (e o foco/visibilidade) garante que um telão deixado aberto
  // na TV passe da meia-noite sozinho: o dia novo dispara a busca de novo e o dia que fechou entra no histórico.
  useEffect(() => {
    const bump = () => force(x => x + 1)
    const id = setInterval(bump, 30_000)
    window.addEventListener('focus', bump)
    return () => { clearInterval(id); window.removeEventListener('focus', bump) }
  }, [])

  useEffect(() => {
    if (!enabled) return
    load()
    const id = setInterval(load, REFRESH_MS)
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - Math.max(fetchedAt.current, startedAt.current) > STALE_MS) load() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); seq.current++ }
  }, [enabled, today, refreshKey, load])      // `today` na lista: virou o dia (ou o mês) → busca de novo

  const sameMonth = state.month === month
  return {
    rows: sameMonth ? state.rows : [],
    status: sameMonth || state.status === 'error' ? state.status : 'loading',
    reload: load,
  }
}

// ── Número que "rola" até o valor novo (igual ao CountUp do LiveWall) ───────
function CountUp({ value, format, duration = 700 }: { value: number; format: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current, to = value
    if (from === to) return
    prev.current = to
    const start = performance.now()
    let raf: number
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setDisplay(from + (to - from) * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{format(display)}</>
}

/** Conta quantas vezes o valor SUBIU (ignora a primeira carga) — dispara o brilho da barra de hoje a cada venda nova. */
function useRises(value: number): number {
  const prev = useRef<number | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (prev.current !== null && value > prev.current) setN(x => x + 1)
    prev.current = value
  }, [value])
  return n
}

/** Um número do cabeçalho. Fica FORA do componente do gráfico de propósito: declarado lá dentro, o React o trataria como
 *  um componente novo a cada atualização (recriando o bloco e fazendo o contador nunca animar). */
function Stat({ k, label, sub, color, children, text, muted2, dense = false, big = false }: { k: string; label: string; sub: string; color?: string; children: React.ReactNode; text: string; muted2: string; dense?: boolean; big?: boolean }) {
  // big (só no "ajustar à tela" e com largura de sobra): legenda MAIOR sem ficar mais ALTA — o "884 vendas" vai AO LADO do valor, na mesma linha.
  // A altura do cabeçalho não muda, então as barras do gráfico seguem exatamente do mesmo tamanho.
  if (big) return (
    <div data-stat={k} data-stat-big style={{ minWidth: 0 }}>
      <p style={{ margin: '0 0 1px', fontSize: 10, lineHeight: '12px', fontWeight: 900, color: muted2, textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: MONO, whiteSpace: 'nowrap' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, whiteSpace: 'nowrap' }}>
        <p style={{ margin: 0, fontSize: 21, lineHeight: '26px', fontWeight: 900, color: color ?? text, fontFamily: GROTESK, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{children}</p>
        <p style={{ margin: 0, fontSize: 11, lineHeight: '14px', color: muted2, fontFamily: MONO, whiteSpace: 'nowrap' }}>{sub}</p>
      </div>
    </div>
  )
  return (
    <div data-stat={k} style={{ minWidth: 0 }}>
      <p style={{ margin: dense ? '0 0 1px' : '0 0 3px', fontSize: dense ? 8 : 8.5, fontWeight: 900, color: muted2, textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: MONO, whiteSpace: 'nowrap' }}>{label}</p>
      <p style={{ margin: 0, fontSize: dense ? 15 : 19, fontWeight: 900, color: color ?? text, fontFamily: GROTESK, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{children}</p>
      <p style={{ margin: dense ? '1px 0 0' : '2px 0 0', fontSize: dense ? 8.5 : 9.5, color: muted2, fontFamily: MONO, whiteSpace: 'nowrap' }}>{sub}</p>
    </div>
  )
}

interface Props {
  sales: MonthSales
  todayEvents: DaySale[]            // eventos ao vivo de hoje (os mesmos do resto do telão)
  vf: VerticalId | null             // painel ativo (null = Geral)
  closerKeys: string[]              // filtro de closer da barra de filtros
  accent: string
  mounted: boolean                  // só calcula "hoje" depois de hidratar (evita erro de hydration na virada do dia)
  range?: { start: string; end: string } | null   // filtro de data ativo: o gráfico mostra SÓ as barras desse período (null = o mês inteiro)
  rangeRows?: DaySale[] | null      // vendas do período (a mesma busca do resto do telão); só no modo período
  rangeLoading?: boolean            // o período ainda está carregando
  height?: number | null            // modo "ajustar à tela": o quadro ocupa EXATAMENTE essa altura e as barras se esticam/encolhem nela (null = tamanho natural)
}

const LABELS_H = 38                     // faixa dos números de dia + dia da semana, embaixo das barras

export function DailyRevenueChart({ sales, todayEvents, vf, closerKeys, accent, mounted, range = null, rangeRows = null, rangeLoading = false, height = null }: Props) {
  const inRange = !!range && !!range.start
  const fill = height != null
  const reduce = useReducedMotion()
  const today = mounted ? todayInSaoPaulo() : ''
  const monthKey = today.slice(0, 7)
  const closerSig = closerKeys.join('|')

  const series = useMemo(() => mounted
    ? buildDailySeries({ monthKey, today, history: inRange ? (rangeRows ?? []) : sales.rows, todayEvents, vertical: vf, closerKeys, range: inRange ? range : null })
    : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mounted, monthKey, today, sales.rows, rangeRows, range?.start, range?.end, todayEvents, vf, closerSig])

  // largura disponível → define quantos rótulos cabem
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(0)
  const [H, setH] = useState(0)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const apply = (w: number, h: number) => { setW(Math.round(w)); setH(Math.round(h)) }
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width, e.contentRect.height))
    const r = el.getBoundingClientRect(); ro.observe(el); apply(r.width, r.height)
    return () => ro.disconnect()
  }, [mounted])
  const [hover, setHover] = useState<number | null>(null)
  const todayTotal = series?.days.find(d => d.isToday)?.total ?? 0
  const rises = useRises(todayTotal)

  // ── cores (o telão é só escuro — mesmas cores dos outros painéis) ──
  const text = '#fff'
  const muted = '#a898c9'
  const muted2 = '#9d8bc4'
  const grid = 'rgba(168,85,247,.16)'
  const shell: React.CSSProperties = {
    background: 'rgba(255,255,255,.02)',
    border: '1px solid rgba(168,85,247,.15)',
    borderRadius: 22, padding: '20px 22px', backdropFilter: 'blur(8px)',
    maxWidth: 'calc(100vw - 40px)',      // nunca mais largo que a tela (40px = o recuo lateral do telão), mesmo se a coluna for maior
  }
  const panelKey = vf ?? 'geral'
  const panelLabel = vf ? VERTICALS[vf].short : '★ GERAL'

  // no modo "ajustar à tela" o quadro fica mais compacto (menos margem interna e sem a linha de legenda) pra sobrar mais altura pras barras
  const boxStyle: React.CSSProperties = fill ? { ...shell, padding: '10px 16px 8px', height: height!, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : shell
  if (!mounted || !series) return <div data-daily-chart="pending" style={fill ? { ...shell, height: height! } : { ...shell, minHeight: 330 }} />

  const n = series.days.length
  const few = n <= 7                  // poucos dias (ex.: 1 dia): colunas largas e centralizadas, em vez de esticar uma barra na tela toda
  const compactW = W > 0 && W < 520
  const gutter = W >= 420 ? 40 : 0
  const slot = W > 0 ? (few ? 96 : (W - gutter) / n) : 24
  const startX = few ? gutter + Math.max(0, (W - gutter - n * slot) / 2) : gutter
  const dayEvery = slot >= 19 ? 1 : slot >= 11 ? 2 : 5
  const showWeekday = slot >= 19
  const labelMode: 'all-h' | 'all-v' | 'few' = slot >= 38 ? 'all-h' : slot >= 15 ? 'all-v' : 'few'
  const topPad = labelMode === 'few' ? 22 : (fill ? 40 : 38)
  const labelsH = fill ? 42 : LABELS_H          // faixa dos números de dia + dia da semana (maior no modo ajustado: números de 12px)
  // tamanho normal: 168 (128 em tela estreita). "Ajustar à tela": a altura que sobra na área do gráfico, menos o respiro de cima e a faixa dos dias
  const plotH = fill ? Math.max(64, Math.min(380, Math.floor(H - topPad - labelsH))) : (compactW ? 128 : 168)
  // quais números de dia aparecem: sempre o 1º, hoje e o último; os demais de N em N — mas sem colar num dos fixos
  // (ex.: com hoje = 19, o "20" some; com 31 dias, o "30" some), senão vira "1920" / "3031"
  const todayIdx = series.days.findIndex(d => d.isToday)
  const must = [1, todayIdx >= 0 ? todayIdx + 1 : -1, n].filter(x => x > 0)
  const minGap = Math.max(1, Math.ceil(dayEvery / 2))
  const showDay = (day: number) => must.includes(day) || (day % dayEvery === 0 && must.every(m => Math.abs(day - m) >= minGap))
  const top = niceMax(series.max)
  const hOf = (v: number) => (v <= 0 ? 0 : Math.max((v / top) * plotH, 4))
  const monthName = (() => { const s = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${monthKey}-01T12:00:00Z`)); return s.charAt(0).toUpperCase() + s.slice(1) })()
  const spring = (i: number) => reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 150, damping: 20, mass: 0.7, delay: Math.min(i * 0.012, 0.35) }
  const loading = inRange ? rangeLoading : (sales.status === 'loading' && sales.rows.length === 0)
  const failed = inRange ? false : sales.status === 'error'
  const empty = !loading && series.total <= 0 && !series.days.some(d => d.count > 0)
  const avgH = series.closedAvg != null ? hOf(series.closedAvg) : null
  const hoverDay = hover != null ? series.days[hover] : null
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  const periodText = inRange ? (range!.start === range!.end ? dm(range!.start) : `${dm(range!.start)} – ${dm(range!.end)}`) : monthName

  return (
    <motion.section data-daily-chart="ready" data-panel={panelKey} data-month={inRange ? undefined : monthKey} data-range={inRange ? `${range!.start}..${range!.end}` : undefined} data-total={series.total} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={boxStyle}
      aria-label={`Receita por dia de ${periodText}, painel ${panelLabel}: total ${fmtBRL(series.total)} em ${series.count} vendas`}>
      <style>{`@keyframes dcPulse{0%{box-shadow:0 0 0 0 ${accent}88}70%{box-shadow:0 0 0 7px ${accent}00}100%{box-shadow:0 0 0 0 ${accent}00}}@keyframes dcShimmer{0%,100%{opacity:.35}50%{opacity:.7}}@media(prefers-reduced-motion:reduce){[data-daily-chart] *{animation:none!important}}`}</style>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: fill ? 10 : 14, marginBottom: fill ? 2 : 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 26 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: MONO }}>📅 Receita por dia · {periodText}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={panelKey} data-panel-chip initial={{ opacity: 0, y: -5, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.92 }} transition={{ duration: 0.18 }}
              style={{ fontSize: 10, fontWeight: 900, color: accent, background: `${accent}22`, borderRadius: 8, padding: '3px 9px', fontFamily: MONO, letterSpacing: '.08em' }}>{panelLabel}</motion.span>
          </AnimatePresence>
          {closerKeys.length > 0 && <span data-closer-filter style={{ fontSize: 9, fontWeight: 800, color: muted2, border: `1px dashed ${grid}`, borderRadius: 8, padding: '2px 7px', fontFamily: MONO }}>filtro de closer ativo</span>}
        </div>
        <div style={{ display: 'flex', gap: fill ? (W >= 1180 ? 28 : 16) : 22, flexWrap: 'wrap' }}>
          <Stat dense={fill} big={fill && W >= 1180} k="total" label={inRange ? 'Total no período' : 'Total no mês'} text={text} muted2={muted2} color={accent} sub={loading ? 'carregando…' : `${series.count} ${series.count === 1 ? 'venda' : 'vendas'}`}>
            <CountUp value={series.total} format={fmtBRL} />
          </Stat>
          <Stat dense={fill} big={fill && W >= 1180} k="avg" label="Média por dia" text={text} muted2={muted2} sub={series.closedAvg == null ? (inRange ? 'dia em andamento' : '1º dia do mês') : `${series.closedDays} ${series.closedDays === 1 ? 'dia fechado' : 'dias fechados'}`}>
            {series.closedAvg == null ? '—' : <CountUp value={series.closedAvg} format={fmtBRL} />}
          </Stat>
          <Stat dense={fill} big={fill && W >= 1180} k="best" label="Melhor dia" text={text} muted2={muted2} color={series.best ? GOLD : undefined} sub={series.best ? `${WEEKDAY_LONG[series.best.weekday]} · ${series.best.count} ${series.best.count === 1 ? 'venda' : 'vendas'}` : 'sem vendas ainda'}>
            {series.best ? <>🔥 {dm(series.best.date)} · <CountUp value={series.best.total} format={fmtBRL} /></> : '—'}
          </Stat>
        </div>
      </div>

      {failed && (
        <div data-chart-error style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 12px', padding: '8px 12px', borderRadius: 12, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.4)', fontSize: 11, color: '#fcd34d', fontFamily: MONO }}>
          ⚠ Não consegui atualizar os dias anteriores do mês — {sales.rows.length > 0 ? 'mostrando a última leitura' : 'mostrando só hoje'}.
          <button type="button" onClick={sales.reload} style={{ marginLeft: 'auto', border: '1px solid rgba(245,158,11,.5)', background: 'transparent', color: 'inherit', borderRadius: 8, padding: '3px 10px', fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>Tentar de novo</button>
        </div>
      )}

      {/* Gráfico */}
      <div ref={wrapRef} style={fill ? { position: 'relative', flex: '1 1 0', minHeight: 0 } : { position: 'relative' }}>
        <div style={{ position: 'relative', paddingTop: topPad }}>
          {/* linhas de apoio + escala */}
          {gutter > 0 && [0.5, 1].map(f => (
            <div key={f} aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(${(f * plotH).toFixed(1)}px + ${labelsH}px)`, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={`${panelKey}-${f}-${top}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                  style={{ width: gutter - 6, textAlign: 'right', fontSize: fill ? 10 : 8.5, color: muted2, fontFamily: MONO, whiteSpace: 'nowrap' }}>{fmtShort(top * f)}</motion.span>
              </AnimatePresence>
              <div style={{ flex: 1, marginLeft: 6, borderTop: `1px dashed ${grid}` }} />
            </div>
          ))}
          <div aria-hidden style={{ position: 'absolute', left: gutter, right: 0, bottom: labelsH, borderTop: `1px solid ${grid}`, pointerEvents: 'none' }} />

          {/* linha da média dos dias fechados */}
          {avgH != null && series.closedAvg! > 0 && (
            <motion.div aria-hidden data-avg-line initial={false} animate={{ bottom: avgH + labelsH, opacity: 1 }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              style={{ position: 'absolute', left: gutter, right: 0, borderTop: `1.5px dashed ${accent}99`, pointerEvents: 'none', zIndex: 2, transition: 'border-color .4s' }}>
              <span style={{ position: 'absolute', right: 0, top: -17, fontSize: 8.5, fontWeight: 800, color: accent, fontFamily: MONO, background: 'rgba(10,0,21,.78)', padding: '1px 6px', borderRadius: 6 }}>média {fmtShort(series.closedAvg!)}</span>
            </motion.div>
          )}

          {/* colunas (uma por dia) */}
          <div role="img" aria-label={`Barras de receita diária de ${periodText}`} style={{ display: 'flex', alignItems: 'flex-end', paddingLeft: gutter, justifyContent: few ? 'center' : 'flex-start', gap: slot >= 22 ? (fill ? 3 : 5) : slot >= 14 ? 3 : 2 }}>
            {series.days.map((d, i) => {
              const h = hOf(d.total), hasSales = d.total > 0 || d.count > 0
              const weekend = d.weekday === 0 || d.weekday === 6
              const isBest = series.best?.date === d.date
              const showValue = hasSales && d.total > 0 && (labelMode !== 'few' || isBest || d.isToday)
              const barColor = weekend ? `${accent}99` : accent
              const showDayNum = showDay(i + 1)
              const fut = d.isFuture && !hasSales
              return (
                <div key={d.date} data-day={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
                  style={{ flex: few ? `0 0 ${slot}px` : 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                  <div style={{ width: '100%', height: plotH, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative' }}>
                    {showValue && (
                      <motion.span key={`${panelKey}-${d.total}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: reduce ? 0 : 0.25 }}
                        style={{
                          marginBottom: fill ? 5 : 4, fontSize: fill ? (labelMode === 'all-h' ? (slot >= 40 ? 12 : 11) : 11) : (labelMode === 'all-h' ? 9.5 : 9), fontWeight: isBest || d.isToday ? 900 : 700, fontFamily: MONO, whiteSpace: 'nowrap', lineHeight: 1,
                          color: isBest ? GOLD : d.isToday ? accent : muted, ...(labelMode === 'all-h' || labelMode === 'few' ? {} : { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }),
                        }}>{fmtShort(d.total)}</motion.span>
                    )}
                    {isBest && <span aria-hidden style={{ position: 'absolute', top: Math.max(plotH - h - (showValue ? (labelMode === 'all-v' ? 40 : 28) : 18), -30), left: '50%', transform: 'translateX(-50%)', fontSize: 11, lineHeight: 1 }}>🔥</span>}
                    <motion.div data-bar data-date={d.date} data-total={d.total} data-count={d.count}
                      initial={{ height: 0 }} animate={{ height: fut ? 3 : hasSales ? h : 3 }} transition={spring(i)}
                      style={{
                        position: 'relative', width: fill ? '88%' : '72%', maxWidth: few ? 56 : (fill ? Math.min(58, Math.max(30, slot * 0.88)) : 30), borderRadius: '5px 5px 2px 2px', overflow: 'hidden',
                        backgroundColor: fut ? 'transparent' : hasSales ? barColor : `${accent}33`,
                        backgroundImage: hasSales ? 'linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,0) 70%)' : 'none',
                        border: fut ? `1px dashed ${grid}` : isBest ? `1.5px solid ${GOLD}` : 'none',
                        boxShadow: d.isToday ? `0 0 14px ${accent}88` : isBest ? `0 0 12px ${GOLD}66` : 'none',
                        animation: d.isToday && !reduce ? 'dcPulse 2.4s ease-out infinite' : 'none',
                        filter: hover === i ? 'brightness(1.25)' : 'none', transition: 'background-color .45s ease, filter .15s ease, box-shadow .3s ease',
                      }}>
                      {d.isToday && rises > 0 && !reduce && <motion.span key={rises} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 1 }} style={{ position: 'absolute', inset: 0, background: '#fff' }} />}
                    </motion.div>
                  </div>
                  <span style={{ marginTop: fill ? 5 : 7, height: fill ? 14 : 12, fontSize: fill ? (slot >= 19 ? 12 : 10) : (slot >= 19 ? 10 : 9), lineHeight: fill ? '14px' : '12px', fontWeight: d.isToday ? 900 : 600, color: d.isToday ? accent : weekend ? muted2 : muted, fontFamily: MONO, opacity: showDayNum ? (d.isFuture ? 0.55 : 1) : 0 }}>{d.day}</span>
                  {showWeekday && <span style={{ height: fill ? 12 : 11, fontSize: fill ? 9.5 : 8, lineHeight: fill ? '12px' : '11px', color: d.isToday ? accent : muted2, opacity: weekend ? 0.9 : 0.5, fontFamily: MONO, fontWeight: weekend ? 800 : 500 }}>{d.isToday ? 'hoje' : WEEKDAY[d.weekday]}</span>}
                </div>
              )
            })}
          </div>

          {loading && (
            <div aria-hidden data-chart-loading style={{ position: 'absolute', left: gutter, right: 0, bottom: labelsH, height: plotH, display: 'flex', alignItems: 'flex-end', gap: 4, pointerEvents: 'none' }}>
              {series.days.map((d, i) => <div key={d.date} style={{ flex: 1, height: 18 + ((i * 37) % 70), borderRadius: '5px 5px 2px 2px', background: `${accent}2e`, animation: reduce ? 'none' : `dcShimmer 1.4s ease-in-out ${(i % 8) * 0.09}s infinite` }} />)}
            </div>
          )}
          {empty && (
            <p data-chart-empty style={{ position: 'absolute', left: gutter, right: 0, bottom: labelsH + plotH / 2 - 8, margin: 0, textAlign: 'center', fontSize: 12, color: muted2, fontFamily: MONO, pointerEvents: 'none' }}>Nenhuma venda neste painel no mês</p>
          )}

          {/* detalhe do dia (passar o mouse / tocar) */}
          <AnimatePresence>
            {hoverDay && (() => {
              const center = startX + (hover! + 0.5) * slot
              const left = Math.min(Math.max(center, gutter + 88), Math.max(W - 88, gutter + 88))
              return (
                <motion.div key="tip" data-tooltip initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                  style={{ position: 'absolute', left, bottom: labelsH + Math.min(hOf(hoverDay.total) + (labelMode === 'all-v' ? 46 : 26), plotH + 18), x: '-50%', zIndex: 5, pointerEvents: 'none', width: 'max-content', minWidth: 140, maxWidth: Math.max(W - 8, 140), padding: '8px 11px', borderRadius: 12, background: 'rgba(20,6,38,.96)', border: `1px solid ${accent}66`, boxShadow: '0 8px 24px rgba(0,0,0,.35)', whiteSpace: 'nowrap' }}>
                  <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: muted2, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.08em' }}>{WEEKDAY_LONG[hoverDay.weekday]} · {dm(hoverDay.date)}{hoverDay.isToday ? ' · hoje' : ''}</p>
                  <p style={{ margin: '3px 0 1px', fontSize: 16, fontWeight: 900, color: accent, fontFamily: GROTESK, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(hoverDay.total)}</p>
                  <p style={{ margin: 0, fontSize: 10, color: muted, fontFamily: MONO }}>{hoverDay.count} {hoverDay.count === 1 ? 'venda' : 'vendas'}{series.total > 0 && hoverDay.total > 0 ? ` · ${((hoverDay.total / series.total) * 100).toFixed(hoverDay.total / series.total >= 0.1 ? 0 : 1)}% do mês` : ''}</p>
                </motion.div>
              )
            })()}
          </AnimatePresence>
        </div>
      </div>

      {!fill && (
        <p style={{ margin: '12px 0 0', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 9, color: muted2, fontFamily: MONO, flexShrink: 0 }}>
          <span>▮ dia útil</span><span style={{ opacity: 0.75 }}>▮ fim de semana</span><span>┅ média dos dias fechados</span><span>horário de Brasília</span>
        </p>
      )}
    </motion.section>
  )
}
