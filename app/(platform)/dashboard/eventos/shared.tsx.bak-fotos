'use client'
import { useEffect, useId, useRef, useState } from 'react'

// Cores do evento: vêm de variáveis CSS (--ev-a / --ev-b) definidas pelo visual da vertical (theme.ts).
export const PINK = 'var(--ev-a)'
export const PURPLE = 'var(--ev-b)'
export const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
export const GOLD = '#f59e0b'
export const GREEN = '#22c55e'

export interface Closer { id: string; name: string; avatar_url: string | null; team: string | null; hubspot_id: string | null }
export interface Bucket { value: number; count: number }
export interface ProductRow { product: string; value: number; count: number; byDay: Record<string, Bucket> }
export interface LiveData {
  serverTime: string; today: string; status: 'proximo' | 'andamento' | 'encerrado'
  edition: { id: string; name: string; event_name: string; vertical?: string | null; start_date: string; end_date: string; notes: string | null }
  days: string[]; closers: Closer[]
  goals: { total: number | null; days: Record<string, number>; closers: Record<string, number>; cells: Record<string, Record<string, number>> }
  actual: {
    total: Bucket; byDay: Record<string, Bucket>; outside: Bucket; others: Bucket
    byCloser: Record<string, Bucket & { byDay: Record<string, Bucket> }>
    products: ProductRow[]
    recent: { id?: string | number | null; value: number; closer_id: string | null; occurred_at: string; product: string | null }[]
  }
}
export interface EditionSummary {
  id: string; name: string; event_name: string; vertical?: string | null; start_date: string; end_date: string
  status: 'proximo' | 'andamento' | 'encerrado'; closersCount: number
  goalTotal: number | null; realized: number; salesCount: number
}

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
export const brl = (v: number) => 'R$ ' + nf0.format(Math.round(v))
export const brlCompact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi'
  if (a >= 1e4) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
  return brl(v)
}
export const pctOf = (v: number, goal: number | null | undefined) => (goal && goal > 0 ? (v / goal) * 100 : null)
export const fmtDay = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const weekday = (d: string) => WD[new Date(d + 'T12:00:00Z').getUTCDay()]
export const fmtRange = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} a ${fmtDay(b)}`)
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
export const firstName = (n: string) => n.split(/\s+/)[0] || n
export const timeSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/** Número que "rola" até o novo valor (respeita prefers-reduced-motion). */
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || from.current === target) { from.current = target; setV(target); return }
    const a = from.current, t0 = performance.now(); let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3)
      const cur = a + (target - a) * e; from.current = cur; setV(cur)
      if (k < 1) raf = requestAnimationFrame(tick); else { from.current = target; setV(target) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** Detecta aumento do valor (venda nova): devolve { k, delta } por alguns segundos; nunca na 1ª carga. */
export function useFlash(value: number, resetKey: string = '', ms = 2400) {
  const prev = useRef(value)
  const prevKey = useRef(resetKey)
  const [f, setF] = useState<{ k: number; delta: number } | null>(null)
  useEffect(() => {
    if (prevKey.current !== resetKey) { prevKey.current = resetKey; prev.current = value; return }   // trocou de dia/visão: não é venda nova
    if (value > prev.current + 0.004) {
      const delta = value - prev.current; prev.current = value
      setF({ k: Date.now(), delta })
      const t = setTimeout(() => setF(null), ms)
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value, resetKey, ms])
  return f
}

export function Money({ value, compact }: { value: number; compact?: boolean }) {
  const v = useCountUp(value)
  return <>{compact ? brlCompact(v) : brl(v)}</>
}

export function Avatar({ c, size = 44, ring }: { c: { name: string; avatar_url: string | null }; size?: number; ring?: string }) {
  const [bad, setBad] = useState(false)
  const base: React.CSSProperties = { width: size, height: size, borderRadius: '50%', flex: 'none', boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }
  if (c.avatar_url && !bad)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.avatar_url} alt="" onError={() => setBad(true)} style={{ ...base, objectFit: 'cover' }} />
  return (
    <div aria-hidden style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800,
      fontSize: size * 0.38, background: `linear-gradient(135deg, ${PURPLE}, ${PINK})` }}>{initials(c.name)}</div>
  )
}

/** Anel de progresso (passa de 100% com cor de conquista). */
export function Ring({ pct, size = 160, stroke = 14, color = PINK, track = 'rgba(255,255,255,0.14)', children }: {
  pct: number | null; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct ?? 0))
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: color }} /><stop offset="1" style={{ stopColor: (pct ?? 0) >= 100 ? GOLD : PURPLE }} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

/** Campo de valor em R$ (inteiro). Vazio = sem meta. */
export function MoneyInput({ value, onChange, placeholder = '—', width, ariaLabel, accent }: {
  value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; width?: number | string; ariaLabel?: string; accent?: boolean
}) {
  return (
    <div style={{ position: 'relative', width: width ?? '100%' }}>
      <span aria-hidden style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--muted-foreground)', pointerEvents: 'none' }}>R$</span>
      <input inputMode="numeric" aria-label={ariaLabel} placeholder={placeholder}
        value={value === undefined ? '' : nf0.format(value)}
        onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); onChange(d === '' ? undefined : Number(d)) }}
        style={{ width: '100%', padding: '9px 10px 9px 30px', borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: 'right',
          background: 'var(--secondary)', color: 'var(--foreground)', border: `1px solid ${accent ? mix(PINK, 40) : 'var(--border)'}`, outline: 'none', fontVariantNumeric: 'tabular-nums' }}
        className="ev-inp" />
    </div>
  )
}

export const cardStyle: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow-sm)' }
export const BTN = 'ev-btn'
export const btnGhost: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
export const btnPrimary: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${PURPLE}, ${PINK})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 6px 18px ${mix(PINK, 30)}` }

export const STATUS_META = {
  andamento: { label: 'Em andamento', color: GREEN },
  proximo:   { label: 'Próximo',      color: '#8b5cf6' },
  encerrado: { label: 'Encerrado',    color: '#94a3b8' },
} as const
export function StatusChip({ status }: { status: keyof typeof STATUS_META }) {
  const m = STATUS_META[status]
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    color: m.color, background: m.color + '1f', border: `1px solid ${m.color}40` }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, animation: status === 'andamento' ? 'evPulse 1.6s infinite' : undefined }} />{m.label}</span>
}

export const EV_CSS = `
@keyframes evFloat{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-10px) rotate(1.5deg)}}
@keyframes evDrift{from{background-position:0 0}to{background-position:160px 80px}}
@keyframes evPop{0%{transform:scale(1)}35%{transform:scale(1.045)}100%{transform:scale(1)}}
@keyframes evDelta{0%{opacity:0;transform:translateY(12px) scale(.9)}15%{opacity:1;transform:translateY(0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}
@keyframes evGlow{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ev-a) 70%,transparent)}100%{box-shadow:0 0 0 18px transparent}}
@keyframes evSheen{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
.ev-pop{animation:evPop .7s cubic-bezier(.22,1,.36,1)}
.ev-glow{animation:evGlow 1.4s ease-out 2}
.ev-float{animation:evFloat 6s ease-in-out infinite}
.ev-drift{animation:evDrift 28s linear infinite}
.ev-delta{animation:evDelta 2.4s ease both}
.ev-btn{transition:transform .18s ease, box-shadow .18s ease, filter .18s ease, background .18s ease}
.ev-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.06);box-shadow:var(--shadow-md)}
.ev-btn:active:not(:disabled){transform:translateY(0) scale(.98)}
.ev-tile{transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease}
.ev-tile:hover{transform:translateY(-3px) scale(1.02);box-shadow:var(--shadow-md)}
.ev-ava{transition:transform .25s cubic-bezier(.22,1,.36,1)}
.ev-card:hover .ev-ava,.ev-tile:hover .ev-ava{transform:scale(1.08) rotate(-3deg)}
.ev-bar{position:relative;overflow:hidden}
.ev-bar::after{content:"";position:absolute;inset:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:evSheen 3.2s ease-in-out infinite}
.ev-row{transition:background .2s ease, transform .2s ease}
.ev-row:hover{background:var(--secondary);transform:translateX(3px)}
.ev-hov{transition:transform .2s ease, box-shadow .2s ease}
.ev-hov:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
@media (max-width:700px){.ev-mascot{width:96px!important;opacity:.9}}
@media (prefers-reduced-motion:reduce){.ev-float,.ev-drift,.ev-bar::after,.ev-pop,.ev-glow,.ev-delta{animation:none!important}}
@keyframes evPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.5)}}
@keyframes evRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes evToast{0%{opacity:0;transform:translateY(-14px) scale(.96)}12%,85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-8px)}}
@keyframes evConf{0%{transform:translate3d(0,-10vh,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),105vh,0) rotate(720deg);opacity:.9}}
@keyframes evShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
.ev-inp:focus{border-color:var(--ev-a)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--ev-a) 18%,transparent)}
.ev-rise{animation:evRise .45s cubic-bezier(.22,1,.36,1) both}
.ev-card{transition:transform .2s ease, box-shadow .2s ease}
.ev-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.ev-skel{background:linear-gradient(90deg,var(--secondary) 25%,var(--border) 50%,var(--secondary) 75%);background-size:200% 100%;animation:evShine 1.6s linear infinite;border-radius:14px}
@media (prefers-reduced-motion:reduce){.ev-rise,.ev-card,.ev-skel,.ev-btn,.ev-tile,.ev-row,.ev-hov{animation:none!important;transition:none!important}}
`
