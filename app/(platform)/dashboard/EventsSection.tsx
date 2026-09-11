'use client'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { PartyPopper, DollarSign, TrendingUp, Target, AlertTriangle, X, Calendar } from 'lucide-react'

function fmtBRL(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const fmtInt = (v: number) => Math.round(v).toString()

// ── Paleta cíclica pras categorias dinâmicas (eventos, canais) — nunca sabe
// de antemão quantos eventos/closers vão existir, então usa uma paleta fixa
// que repete se precisar.
const PALETTE = ['#ec4899', '#8b5cf6', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#06b6d4', '#f43f5e', '#a855f7', '#14b8a6']
const colorAt = (i: number) => PALETTE[i % PALETTE.length]

// ── Contador animado — mesmo padrão usado no resto do dashboard ────────
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

const PERIODS = [
  { id: 'hoje', label: 'Hoje' }, { id: 'ontem', label: 'Ontem' }, { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' }, { id: 'mes_passado', label: 'Mês passado' }, { id: 'custom', label: 'Intervalo' },
]

const ACCENT = '#ec4899' // rosa — cor de identidade da seção de Eventos

// ── Dropdown customizado — botão com estado visual + painel flutuante
// animado, mesmo padrão de qualidade usado em outras telas do sistema
// (Templates), agora com a paleta rosa/roxo da seção de Eventos.
interface DropOpt { value: string; label: string }
function FilterDropdown({ value, onChange, options, placeholder, minW = 150 }: {
  value: string; onChange: (v: string) => void; options: DropOpt[]; placeholder: string; minW?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})
  const sel = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const dropH = Math.min(options.length * 42 + 60, 320)
    const below = window.innerHeight - r.bottom - 8
    setPos({
      position: 'fixed', left: r.left, width: Math.max(r.width, minW), zIndex: 9999,
      ...(below < dropH && r.top > dropH ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    })
    setOpen(o => !o)
  }

  const active = !!value
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} type="button" onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          height: 36, padding: '0 12px 0 14px', borderRadius: 10, cursor: 'pointer',
          border: `1.5px solid ${open ? ACCENT : active ? ACCENT + '55' : 'var(--border)'}`,
          background: open ? `color-mix(in srgb, ${ACCENT} 8%, var(--background))` : active ? `color-mix(in srgb, ${ACCENT} 5%, var(--background))` : 'var(--background)',
          color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
          minWidth: minW, whiteSpace: 'nowrap',
          boxShadow: open ? `0 0 0 3px ${ACCENT}1a` : 'none',
          transition: 'all .15s',
        }}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sel?.label ?? placeholder}
        </span>
        <svg style={{ flexShrink: 0, color: open || active ? ACCENT : 'var(--muted-foreground)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && (
        <div ref={ref} style={{
          ...pos, background: 'var(--card)', border: `1.5px solid ${ACCENT}33`, borderRadius: 13,
          boxShadow: `0 16px 44px rgba(0,0,0,.16), 0 4px 14px ${ACCENT}22`, overflow: 'hidden', maxHeight: 300, overflowY: 'auto',
        }}>
          <style>{`@keyframes evtDrop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div style={{ animation: 'evtDrop .15s ease' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              style={{
                width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                background: !value ? `linear-gradient(135deg, ${ACCENT}1a, #8b5cf61a)` : 'transparent',
                border: 'none', borderBottom: `1px solid color-mix(in srgb, var(--border) 60%, transparent)`,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: !value ? 700 : 500, color: !value ? ACCENT : 'var(--muted-foreground)',
              }}
              onMouseEnter={e => { if (value) (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${ACCENT} 6%, transparent)` }}
              onMouseLeave={e => { if (value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <span>{placeholder}</span>
              {!value && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
            </button>
            {options.map((opt, i) => {
              const isS = opt.value === value
              return (
                <button key={`${i}-${opt.value}`} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
                  style={{
                    width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: isS ? `linear-gradient(135deg, ${ACCENT}1a, #8b5cf61a)` : 'transparent',
                    border: 'none', borderBottom: i < options.length - 1 ? `1px solid color-mix(in srgb, var(--border) 60%, transparent)` : 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: isS ? 700 : 400, color: isS ? ACCENT : 'var(--foreground)',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isS) (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${ACCENT} 6%, transparent)` }}
                  onMouseLeave={e => { if (!isS) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                  {isS && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
              )
            })}
            {options.length === 0 && (
              <p style={{ padding: '14px', margin: 0, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>Nenhuma opção pro período/filtros atuais</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiMiniEvt({ icon: Icon, label, rawValue, format = fmtBRL, grad, color, flashKey }: any) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
      {/* Anel de destaque — pisca sozinho a cada atualização real de dado
          (flashKey), sem remontar o card nem interromper a contagem suave
          do CountUp abaixo. */}
      <motion.div key={flashKey} initial={{ opacity: 0.6, boxShadow: `inset 0 0 0 2px ${color}` }} animate={{ opacity: 0 }} transition={{ duration: 1, ease: 'easeOut' }}
        style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none' }} />
      <div style={{ width: 38, height: 38, borderRadius: 11, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${color}35`, marginBottom: 10 }}>
        <Icon size={16} style={{ color: '#fff' }} />
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.03em' }}>
        <CountUp value={rawValue} format={format} />
      </p>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
    </div>
  )
}

// ── Rosca (donut) — pra "proporção do total": receita por evento, receita
// por canal. Mesma técnica usada no Painel Comercial (arco em SVG), com
// legenda ao lado mostrando cada fatia.
function DonutChart({ data, format, size = 158, thickness = 25, flashKey, emptyLabel }: {
  data: { label: string; value: number; color: string }[]; format: (v: number) => string
  size?: number; thickness?: number; flashKey: number; emptyLabel: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total <= 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '40px 0' }}>{emptyLabel}</p>
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let offsetAcc = 0
  const filtered = data.filter(d => d.value > 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {filtered.map((d, i) => {
            const frac = d.value / total
            const dash = frac * circumference
            const offset = offsetAcc
            offsetAcc += dash
            return (
              <motion.circle key={`${flashKey}-${i}-${d.label}`} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06, duration: 0.5 }} />
            )
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', padding: '0 10px' }}>
          <span style={{ fontSize: Math.max(12, Math.min(16, size * 0.1)), fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.1 }}>
            <CountUp value={total} format={format} />
          </span>
          <span style={{ fontSize: 8.5, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>total</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 130, maxHeight: size, overflowY: 'auto' }} className="scrollbar-hide">
        {data.slice(0, 8).map((d, i) => (
          <motion.div key={`${i}-${d.label}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: 'var(--foreground)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--foreground)', flexShrink: 0 }}>{format(d.value)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Colunas verticais — pra comparar valores lado a lado (quantidade de
// vendas por evento). Rolagem horizontal se tiver muitos eventos.
function VerticalBarChart({ items, format, emptyLabel, flashKey }: {
  items: { label: string; value: number; color: string }[]; format: (v: number) => string; emptyLabel: string; flashKey: number
}) {
  if (items.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '40px 0' }}>{emptyLabel}</p>
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div key={flashKey} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 178, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
      {items.map((it, i) => {
        const h = Math.max((it.value / max) * 128, it.value > 0 ? 8 : 2)
        return (
          <div key={`${i}-${it.label}`} title={`${it.label}: ${format(it.value)}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', minWidth: 58, flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: it.color, marginBottom: 5, whiteSpace: 'nowrap' }}>{format(it.value)}</span>
            <motion.div initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
              style={{ width: '100%', maxWidth: 42, borderRadius: '9px 9px 3px 3px', background: `linear-gradient(180deg,${it.color},${it.color}99)`, boxShadow: `0 4px 12px ${it.color}35` }} />
            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 7, textAlign: 'center', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Ranking estilizado — pra listas ordenadas com contexto extra (produtos:
// vertical + evento). Top 3 ganham medalha e destaque, resto numerado.
function RankedList({ items, format, color, emptyLabel, flashKey }: {
  items: { label: string; sub?: string; value: number }[]
  format: (v: number) => string; color: string; emptyLabel: string; flashKey: number
}) {
  if (items.length === 0) return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '40px 0' }}>{emptyLabel}</p>
  const max = Math.max(...items.map(i => i.value), 1)
  const medal = ['#fbbf24', '#cbd5e1', '#fb923c']
  return (
    <div key={flashKey} style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }} className="scrollbar-hide">
      {items.map((it, i) => {
        const top3 = i < 3
        return (
          <motion.div key={`${i}-${it.label}-${it.sub ?? ''}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: i * 0.03 }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 11, background: top3 ? `${color}0d` : 'transparent', border: top3 ? `1px solid ${color}22` : '1px solid transparent' }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: top3 ? 13 : 10.5, fontWeight: 900, color: top3 ? medal[i] : 'var(--muted-foreground)', flexShrink: 0 }}>
              {top3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--foreground)', flexShrink: 0 }}>{format(it.value)}</span>
              </div>
              {it.sub && <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>{it.sub}</span>}
              <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginTop: 4 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.03 }}
                  style={{ height: '100%', background: top3 ? medal[i] : color, borderRadius: 999 }} />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

interface EventsData {
  totalRevenue: number; totalSales: number; avgTicket: number; moneyLeft: number
  byEvent: { eventName: string; revenue: number; count: number }[]
  productRanking: { product: string; vertical: string; eventName: string; count: number; revenue: number }[]
  channelRanking: { label: string; revenue: number; count: number; isCloser: boolean }[]
  filterOptions: { verticals: { value: string; label: string }[]; eventCategories: string[]; eventNames: string[]; closers: { key: string; name: string }[] }
  label: string
}

export function EventsSection({ initialData }: { initialData: EventsData }) {
  const [period,        setPeriod]        = useState('mes')
  const [customStart,   setCustomStart]   = useState('')
  const [customEnd,     setCustomEnd]     = useState('')
  const [vertical,      setVertical]      = useState('')
  const [eventCategory, setEventCategory] = useState('')
  const [eventName,     setEventName]     = useState('')
  const [closer,        setCloser]        = useState('')
  const [data,          setData]          = useState<EventsData>(initialData)
  const [loading,       setLoading]       = useState(false)
  // Sobe a cada vez que os NÚMEROS realmente mudam (não a cada fetch) — é
  // isso que dispara a animação sutil nos gráficos/KPIs, tanto quando o
  // usuário troca um filtro quanto quando uma venda nova chega sozinha
  // via polling, sem precisar mexer em nada.
  const [flashKey, setFlashKey] = useState(0)
  const prevSignature = useRef<string>('')
  // Contador de requisição — toda busca (troca de filtro OU polling) pega um
  // número novo antes de disparar. Quando a resposta chega, só é aplicada se
  // ainda for a busca MAIS RECENTE; senão é descartada. Sem isso, uma busca
  // antiga que demora mais pra responder pode chegar DEPOIS de uma busca mais
  // nova e sobrescrever o resultado certo com um desatualizado — era
  // exatamente o "volta pro resultado de antes" que estava acontecendo.
  const requestIdRef = useRef(0)

  function applyData(d: EventsData) {
    const signature = JSON.stringify([d.totalRevenue, d.totalSales, d.avgTicket, d.moneyLeft])
    if (signature !== prevSignature.current) {
      prevSignature.current = signature
      setFlashKey(k => k + 1)
    }
    setData(d)
  }

  function buildParams() {
    const params = new URLSearchParams({ period })
    if (period === 'custom') { params.set('start', customStart); params.set('end', customEnd || customStart) }
    if (vertical)      params.set('vertical', vertical)
    if (eventCategory) params.set('event_category', eventCategory)
    if (eventName)      params.set('event_name', eventName)
    if (closer)         params.set('closer', closer)
    return params
  }

  // Dispara uma busca com um número de sequência próprio — usado tanto pela
  // troca de filtro quanto pelo polling, garantindo que os dois nunca
  // conseguem se atropelar um ao outro.
  function fetchAndApply(showLoading: boolean) {
    const myRequestId = ++requestIdRef.current
    if (showLoading) setLoading(true)
    fetch(`/api/dashboard/events-analysis?${buildParams()}`)
      .then(r => r.json())
      .then(d => {
        if (myRequestId !== requestIdRef.current) return // resposta atrasada de uma busca antiga — descarta
        applyData(d)
        if (showLoading) setLoading(false)
      })
      .catch(() => { if (showLoading) setLoading(false) })
  }

  // Busca ao trocar qualquer filtro
  useEffect(() => {
    // Estado inicial (mês, sem filtro nenhum) já veio pronto do servidor —
    // evita um fetch extra logo no primeiro carregamento da página.
    if (period === 'mes' && !customStart && !vertical && !eventCategory && !eventName && !closer) {
      requestIdRef.current++ // invalida qualquer busca em andamento — esse resultado local já é o certo
      applyData(initialData); return
    }
    if (period === 'custom' && !customStart) return // aguarda o usuário escolher a data inicial

    fetchAndApply(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd, vertical, eventCategory, eventName, closer, initialData])

  // Polling de segurança — busca de novo a cada 20s, com os MESMOS filtros
  // já selecionados, sem indicador de "carregando" (silencioso). É assim
  // que uma venda nova aparece sozinha sem precisar trocar de filtro nem
  // recarregar a página — e o flashKey acima detecta a mudança e anima.
  useEffect(() => {
    const id = setInterval(() => fetchAndApply(false), 20_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd, vertical, eventCategory, eventName, closer])

  const hasFilters = !!(vertical || eventCategory || eventName || closer || period !== 'mes')

  function limpar() {
    setPeriod('mes'); setCustomStart(''); setCustomEnd('')
    setVertical(''); setEventCategory(''); setEventName(''); setCloser('')
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <PartyPopper size={16} style={{ color: ACCENT }} />
        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Eventos</p>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· {data.label}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 16px' }}>Vendas com cupom de evento (EV_) — presencial e online</p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--secondary)', borderRadius: 11, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {PERIODS.map(p => {
            const active = period === p.id
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                style={{ height: 30, padding: '0 13px', borderRadius: 8, border: 'none', background: active ? `linear-gradient(135deg,${ACCENT},#8b5cf6)` : 'transparent', color: active ? '#fff' : 'var(--muted-foreground)', fontSize: 11.5, fontWeight: active ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: active ? `0 3px 10px ${ACCENT}45` : 'none', transition: 'all .15s' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--card)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                {p.label}
              </button>
            )
          })}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
            <Calendar size={13} style={{ color: 'var(--muted-foreground)' }} />
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ height: 36, padding: '0 10px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}1a` }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }} />
            <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', fontWeight: 600 }}>até</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ height: 36, padding: '0 10px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}1a` }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }} />
          </div>
        )}

        <FilterDropdown value={vertical} onChange={setVertical} placeholder="Todas verticais"
          options={data.filterOptions.verticals.map(v => ({ value: v.value, label: v.label }))} minW={155} />

        <FilterDropdown value={eventCategory} onChange={setEventCategory} placeholder="Todos os tipos"
          options={data.filterOptions.eventCategories.map(v => ({ value: v, label: v }))} minW={145} />

        <FilterDropdown value={eventName} onChange={setEventName} placeholder="Todos os eventos"
          options={data.filterOptions.eventNames.map(v => ({ value: v, label: v }))} minW={170} />

        <FilterDropdown value={closer} onChange={setCloser} placeholder="Todos os closers"
          options={data.filterOptions.closers.map(c => ({ value: c.key, label: c.name }))} minW={160} />

        {hasFilters && (
          <button onClick={limpar}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 13px', borderRadius: 10, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)', color: '#f87171', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.12)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.06)' }}>
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="evt-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <KpiMiniEvt icon={DollarSign}    label="Receita de evento (total)" rawValue={data.totalRevenue} grad={`linear-gradient(135deg,${ACCENT},#db2777)`} color={ACCENT} flashKey={flashKey} />
        <KpiMiniEvt icon={TrendingUp}    label="Vendas de evento"          rawValue={data.totalSales}   format={fmtInt} grad="linear-gradient(135deg,#8b5cf6,#7c3aed)" color="#8b5cf6" flashKey={flashKey} />
        <KpiMiniEvt icon={Target}        label="Ticket médio"              rawValue={data.avgTicket}    grad="linear-gradient(135deg,#3b82f6,#2563eb)" color="#3b82f6" flashKey={flashKey} />
        <KpiMiniEvt icon={AlertTriangle} label="Deixado na mesa"           rawValue={data.moneyLeft}    grad="linear-gradient(135deg,#f97316,#ea580c)" color="#f97316" flashKey={flashKey} />
      </div>

      {/* Gráficos — donut (proporção), colunas verticais (comparação),
          ranking (produtos, com contexto de vertical+evento), donut (canal) */}
      <div className="evt-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
        <div style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px' }}>💰 Receita por evento</p>
          <DonutChart flashKey={flashKey} format={fmtBRL} emptyLabel="Sem vendas de evento no período."
            data={data.byEvent.map((e, i) => ({ label: e.eventName, value: e.revenue, color: colorAt(i) }))} />
        </div>
        <div style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px' }}>🎟️ Vendas por evento</p>
          <VerticalBarChart flashKey={flashKey} format={fmtInt} emptyLabel="Sem vendas de evento no período."
            items={data.byEvent.map((e, i) => ({ label: e.eventName, value: e.count, color: colorAt(i) }))} />
        </div>
        <div style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px' }}>🏆 Produtos mais vendidos (qtd)</p>
          <RankedList flashKey={flashKey} format={fmtInt} color="#eab308" emptyLabel="Sem vendas de evento no período."
            items={data.productRanking.map(p => ({ label: p.product, sub: `${p.vertical} · ${p.eventName}`, value: p.count }))} />
        </div>
        <div style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px' }}>📡 Vendas por canal</p>
          <DonutChart flashKey={flashKey} format={fmtBRL} emptyLabel="Sem vendas de evento no período."
            data={data.channelRanking.map((c, i) => ({ label: c.label, value: c.revenue, color: colorAt(i) }))} />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .evt-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 768px) { .evt-kpis { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </div>
  )
}
