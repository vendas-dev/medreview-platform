'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Maximize2, Minimize2, Pencil, Trophy, Sparkles, WifiOff, Crown, Users, ShoppingBag, ChevronDown } from 'lucide-react'
import {
  Avatar, EV_CSS, GOLD, GREEN, PINK, PURPLE, Money, Ring, StatusChip, brl, brlCompact, btnGhost, cardStyle,
  firstName, fmtDay, fmtRange, mix, pctOf, timeSP, useFlash, weekday, type Closer, type LiveData,
} from './shared'
import { themeOf, themeVars, type EventTheme } from './theme'

const POLL_MS = 8000
const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const
type Scope = 'all' | string  // 'all' ou 'YYYY-MM-DD'

export function EventLive({ editionId, onEdit }: { editionId: string; onEdit: () => void }) {
  const [data, setData] = useState<LiveData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [scope, setScope] = useState<Scope>('all')
  const [toast, setToast] = useState<{ k: number; text: string } | null>(null)
  const [confetti, setConfetti] = useState(0)
  const [full, setFull] = useState(false)
  const rid = useRef(0)
  const prev = useRef<{ total: number; lastKey: string; pct: number | null } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const scopeSet = useRef(false)

  const load = useCallback(async () => {
    const my = ++rid.current
    try {
      const res = await fetch(`/api/dashboard/event-goals/${editionId}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (my !== rid.current) return
      if (!res.ok) { setErr(j.error ?? 'Não foi possível carregar o evento.'); setOffline(true); return }
      const d = j as LiveData
      setErr(null); setOffline(false); setData(d)
      if (!scopeSet.current) { scopeSet.current = true; if (d.status === 'andamento' && d.days.includes(d.today) && d.days.length > 1) setScope(d.today) }
      const r0 = d.actual.recent[0]
      const lastKey = r0 ? `${r0.id ?? r0.occurred_at}|${r0.value}` : ''
      const pct = pctOf(d.actual.total.value, d.goals.total)
      const p = prev.current
      if (p) {
        if (lastKey && lastKey !== p.lastKey && d.actual.total.value > p.total && r0) {
          const who = d.closers.find(c => c.id === r0.closer_id)
          setToast({ k: Date.now(), text: `${who ? firstName(who.name) : 'Nova venda'} • ${brl(r0.value)}` })
        }
        if (pct !== null && pct >= 100 && (p.pct ?? 0) < 100) setConfetti(Date.now())
      }
      prev.current = { total: d.actual.total.value, lastKey, pct }
    } catch { if (my === rid.current) setOffline(true) }
  }, [editionId])

  useEffect(() => { load()
    const t = setInterval(load, POLL_MS); const vis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); rid.current += 1 } }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t) }, [toast])
  useEffect(() => { if (!confetti) return; const t = setTimeout(() => setConfetti(0), 6000); return () => clearTimeout(t) }, [confetti])
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])

  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else boxRef.current?.requestFullscreen?.().catch(() => {}) }
  const theme = themeOf(data?.edition.vertical)

  const view = useMemo(() => {
    if (!data) return null
    const day = scope === 'all' ? null : scope
    const value = day ? data.actual.byDay[day]?.value ?? 0 : data.actual.total.value
    const count = day ? data.actual.byDay[day]?.count ?? 0 : data.actual.total.count
    const goal = day ? data.goals.days[day] ?? null : data.goals.total
    const rows = data.closers.map(c => {
      const a = data.actual.byCloser[c.id]
      const v = day ? a?.byDay[day]?.value ?? 0 : a?.value ?? 0
      const n = day ? a?.byDay[day]?.count ?? 0 : a?.count ?? 0
      const g = day ? data.goals.cells[c.id]?.[day] ?? null : data.goals.closers[c.id] ?? null
      return { c, v, n, g, pct: pctOf(v, g) }
    }).sort((a, b) => b.v - a.v || a.c.name.localeCompare(b.c.name))
    const products = (data.actual.products ?? []).map(p => ({
      name: p.product, value: day ? p.byDay[day]?.value ?? 0 : p.value, count: day ? p.byDay[day]?.count ?? 0 : p.count,
    })).filter(p => p.value > 0 || p.count > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    return { day, value, count, goal, pct: pctOf(value, goal), rows, products }
  }, [data, scope])
  const heroFlash = useFlash(view?.value ?? 0, scope)

  if (!data && !err) return <LiveSkeleton />
  if (!data || !view) return <div style={{ ...cardStyle, padding: 32, textAlign: 'center', color: 'var(--muted-foreground)' }}>{err}</div>
  const { edition } = data
  const hit = view.pct !== null && view.pct >= 100
  const remaining = view.goal !== null ? Math.max(0, view.goal - view.value) : null
  const ticket = view.count ? view.value / view.count : 0
  const maxV = Math.max(1, ...view.rows.map(r => r.v))

  return (
    <div ref={boxRef} style={{ ...themeVars(theme), position: 'relative', background: full ? 'var(--background)' : undefined, padding: full ? 24 : 0, overflow: full ? 'auto' : undefined, minHeight: full ? '100vh' : undefined }}>
      <style>{EV_CSS}</style>
      {/* cabeçalho */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {theme.mascot && <motion.img src={theme.mascot} alt="" initial={{ scale: .6, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={SPRING}
          style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', background: mix(PINK, 18), boxShadow: `0 0 0 3px ${mix(PINK, 55)}, 0 8px 22px ${mix(PINK, 35)}` }} />}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{edition.name}</h2>
            <StatusChip status={data.status} />
            {edition.vertical && <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: PINK, background: mix(PINK, 14), border: `1px solid ${mix(PINK, 35)}` }}>{theme.label}</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>{fmtRange(edition.start_date, edition.end_date)} · horário de Brasília</div>
        </div>
        {offline && <span title={err ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: GOLD, fontWeight: 600 }}><WifiOff size={14} /> reconectando…</span>}
        <button className="ev-btn" onClick={toggleFull} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{full ? 'Sair' : 'Tela cheia'}</button>
        {!full && <button className="ev-btn" onClick={onEdit} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Pencil size={14} /> Editar metas</button>}
      </div>

      {/* abas de dia */}
      <div role="tablist" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px 8px', marginBottom: 8 }}>
        <ScopeTab active={scope === 'all'} onClick={() => setScope('all')} top="Evento todo" value={data.actual.total.value} />
        {data.days.map(d => <ScopeTab key={d} active={scope === d} onClick={() => setScope(d)} live={d === data.today && data.status === 'andamento'}
          top={`${weekday(d)} ${fmtDay(d)}`} value={data.actual.byDay[d]?.value ?? 0} />)}
      </div>

      {/* destaque */}
      <div className="ev-rise" style={{ borderRadius: 24, padding: 'clamp(20px,3vw,34px)', color: '#fff', position: 'relative', overflow: 'hidden',
        background: hit ? theme.heroHit : theme.hero, boxShadow: `var(--shadow-lg), 0 18px 50px ${mix(PINK, 22)}`, transition: 'background .6s' }}>
        <div aria-hidden className="ev-drift" style={{ position: 'absolute', inset: 0, backgroundImage: theme.pattern, opacity: .9,
          WebkitMaskImage: 'linear-gradient(100deg,transparent 15%,#000 85%)', maskImage: 'linear-gradient(100deg,transparent 15%,#000 85%)' }} />
        <div aria-hidden style={{ position: 'absolute', right: -80, top: -90, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,.2),transparent 70%)' }} />
        {theme.mascot && <img src={theme.mascot} alt="" className="ev-mascot ev-float" style={{ position: 'absolute', right: 'clamp(8px,3vw,36px)', bottom: 0, width: 'clamp(130px,17vw,230px)', objectFit: 'contain',
          filter: 'drop-shadow(0 14px 28px rgba(0,0,0,.45))', pointerEvents: 'none' }} />}
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(20px,4vw,48px)', paddingRight: theme.mascot ? 'clamp(0px,14vw,200px)' : 0 }}>
          <Ring pct={view.pct} size={190} stroke={16} color={hit ? GOLD : PINK}>
            {view.pct === null ? <div style={{ fontSize: 13, opacity: .8, textAlign: 'center', padding: 14 }}>defina a<br />meta</div> : <>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{Math.floor(view.pct)}<span style={{ fontSize: 20 }}>%</span></div>
              <div style={{ fontSize: 11, opacity: .8, marginTop: 4 }}>{hit ? 'META BATIDA' : 'da meta'}</div></>}
          </Ring>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', opacity: .75 }}>{view.day ? `VENDIDO · ${weekday(view.day).toUpperCase()} ${fmtDay(view.day)}` : 'VENDIDO NO EVENTO'}</div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div key={heroFlash?.k ?? 0} className={heroFlash ? 'ev-pop' : undefined} style={{ fontSize: 'clamp(38px,7vw,68px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}><Money value={view.value} /></div>
              {heroFlash && <span key={'d' + heroFlash.k} className="ev-delta" style={{ position: 'absolute', left: '100%', top: 4, marginLeft: 12, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                fontSize: 16, fontWeight: 900, color: '#052e16', background: '#86efac', boxShadow: '0 6px 18px rgba(34,197,94,.45)' }}>+{brl(heroFlash.delta)}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', marginTop: 10, fontSize: 14 }}>
              {view.goal !== null && <span style={{ opacity: .9 }}>Meta <b>{brl(view.goal)}</b></span>}
              {remaining !== null && !hit && <span style={{ opacity: .9 }}>Faltam <b style={{ color: '#fde68a' }}>{brl(remaining)}</b></span>}
              {hit && view.goal !== null && <span style={{ color: '#fde68a', fontWeight: 700 }}><Trophy size={14} style={{ verticalAlign: -2 }} /> +{brl(view.value - view.goal)} acima da meta</span>}
              <span style={{ opacity: .9 }}><b>{view.count}</b> {view.count === 1 ? 'venda' : 'vendas'}</span>
              {view.count > 0 && <span style={{ opacity: .9 }}>Ticket médio <b>{brl(ticket)}</b></span>}
            </div>
            {view.count === 0 && <div style={{ marginTop: 12, fontSize: 14, opacity: .85, fontStyle: 'italic' }}>{theme.tagline}</div>}
          </div>
        </div>
      </div>

      {/* dias (só na visão do evento todo) */}
      {scope === 'all' && data.days.length > 1 && (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginTop: 14 }}>
          {data.days.map((d, i) => <DayCard key={d} i={i} d={d} v={data.actual.byDay[d]?.value ?? 0} g={data.goals.days[d] ?? null}
            today={d === data.today && data.status === 'andamento'} onClick={() => setScope(d)} />)}
        </div>
      )}

      {/* closers + feed */}
      <div className="ev-split" style={{ display: 'grid', gap: 16, marginTop: 18, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <SectionTitle icon={<Users size={16} />} title="Closers" sub={view.day ? `meta de ${weekday(view.day)} ${fmtDay(view.day)}` : 'meta total do evento'} />
          {view.rows.length === 0
            ? <div style={{ ...cardStyle, padding: 28, textAlign: 'center', color: 'var(--muted-foreground)' }}>Nenhum closer escalado. Use “Editar metas” para escolher quem vai.</div>
            : <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
              {view.rows.map((r, i) => <CloserCard key={r.c.id} rank={i + 1} r={r} maxV={maxV} scope={scope} />)}
            </div>}
          {(data.actual.others.count > 0 || data.actual.outside.count > 0) && (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 12, lineHeight: 1.5 }}>
              {data.actual.others.count > 0 && <>Self-checkout e vendas de quem não está na escalação: <b>{brl(data.actual.others.value)}</b> ({data.actual.others.count}) — contam na meta geral. </>}
              {data.actual.outside.count > 0 && <>Vendas do evento fora dos dias cadastrados: <b>{brl(data.actual.outside.value)}</b> ({data.actual.outside.count}) — contam só no total.</>}
            </p>)}
        </div>
        <div style={{ minWidth: 0 }}>
          <SectionTitle icon={<Sparkles size={16} />} title="Últimas vendas" sub="ao vivo" />
          <div style={{ ...cardStyle, padding: 6, overflow: 'hidden' }}>
            {data.actual.recent.length === 0 && <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>Aguardando a primeira venda do evento…</div>}
            <AnimatePresence initial={false}>
              {data.actual.recent.slice(0, 8).map(s => {
                const who = data.closers.find(c => c.id === s.closer_id)
                return (
                  <motion.div key={`${s.id ?? s.occurred_at}|${s.value}`} layout="position"
                    initial={{ opacity: 0, y: 56, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .96, transition: { duration: .18 } }} transition={SPRING}
                    className="ev-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12 }}>
                    {who ? <Avatar c={who} size={32} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--secondary)', flex: 'none' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who ? firstName(who.name) : 'Self-checkout'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{timeSP(s.occurred_at)}{s.product ? ` · ${s.product}` : ''}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{brl(s.value)}</div>
                  </motion.div>)
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* produtos */}
      <ProductRanking scope={scope} items={view.products} total={view.value} dayLabel={view.day ? `${weekday(view.day)} ${fmtDay(view.day)}` : 'evento todo'} theme={theme} />

      <style>{`.ev-split{grid-template-columns:minmax(0,1fr) 340px}@media (max-width: 1000px){.ev-split{grid-template-columns:minmax(0,1fr)}}`}</style>

      <AnimatePresence>
        {toast && <motion.div key={toast.k} role="status" initial={{ opacity: 0, y: -24, scale: .9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={SPRING}
          style={{ position: 'fixed', top: 18, right: 18, zIndex: 80, padding: '12px 18px', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15,
            background: `linear-gradient(135deg,${PURPLE},${PINK})`, boxShadow: `0 12px 32px ${mix(PINK, 45)}` }}>🎉 {toast.text}</motion.div>}
      </AnimatePresence>
      {confetti > 0 && <Confetti key={confetti} colors={[PINK, PURPLE, GOLD, GREEN, '#38bdf8']} />}
    </div>
  )
}

function DayCard({ i, d, v, g, today, onClick }: { i: number; d: string; v: number; g: number | null; today: boolean; onClick: () => void }) {
  const p = pctOf(v, g); const f = useFlash(v)
  return (
    <motion.button layout onClick={onClick} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.06 }} whileTap={{ scale: .98 }}
      className={`ev-card ${f ? 'ev-glow' : ''}`} style={{ ...cardStyle, padding: 16, textAlign: 'left', cursor: 'pointer', outline: today ? `2px solid ${mix(PINK, 35)}` : undefined, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>
        <span>{weekday(d)} {fmtDay(d)}{today ? ' · hoje' : ''}</span>
        <span style={{ color: p !== null && p >= 100 ? GREEN : 'var(--foreground)' }}>{p === null ? 'sem meta' : Math.floor(p) + '%'}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '6px 0 2px', fontVariantNumeric: 'tabular-nums' }}><Money value={v} /></div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{g !== null ? `meta ${brl(g)}` : '—'}</div>
      <Bar pct={p} />
      {f && <span key={f.k} className="ev-delta" style={{ position: 'absolute', right: 12, top: 34, fontSize: 12, fontWeight: 800, color: GREEN }}>+{brl(f.delta)}</span>}
    </motion.button>
  )
}

function ScopeTab({ active, onClick, top, value, live }: { active: boolean; onClick: () => void; top: string; value: number; live?: boolean }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className="ev-btn" style={{ flex: 'none', position: 'relative', padding: '9px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', minWidth: 104,
      border: '1px solid ' + (active ? 'transparent' : 'var(--border)'), color: active ? '#fff' : 'var(--foreground)', background: active ? 'transparent' : 'var(--card)', boxShadow: active ? 'none' : 'var(--shadow-xs)' }}>
      {active && <motion.span layoutId="ev-scope-pill" transition={SPRING} style={{ position: 'absolute', inset: 0, borderRadius: 14, background: `linear-gradient(135deg,${PURPLE},${PINK})`, boxShadow: `0 6px 18px ${mix(PINK, 32)}` }} />}
      <span style={{ position: 'relative', display: 'block' }}>
        <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{top}{live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#fff' : GREEN, animation: 'evPulse 1.6s infinite' }} />}</span>
        <span style={{ display: 'block', fontSize: 11, opacity: active ? .85 : .65, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{brlCompact(value)}</span>
      </span>
    </button>
  )
}

function Bar({ pct, height = 8 }: { pct: number | null; height?: number }) {
  const p = Math.max(0, Math.min(100, pct ?? 0)); const hit = (pct ?? 0) >= 100
  return <div style={{ height, borderRadius: 99, background: 'var(--secondary)', overflow: 'hidden', marginTop: 10 }}>
    <motion.div className="ev-bar" initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%', borderRadius: 99,
      background: hit ? `linear-gradient(90deg,${GREEN},${GOLD})` : `linear-gradient(90deg,${PURPLE},${PINK})` }} /></div>
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px 10px', color: 'var(--foreground)' }}>
    <span style={{ color: PINK, alignSelf: 'center', display: 'flex' }}>{icon}</span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
    {sub && <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{sub}</span>}</div>
}

function CloserCard({ r, rank, maxV, scope }: { scope: string; r: { c: Closer; v: number; n: number; g: number | null; pct: number | null }; rank: number; maxV: number }) {
  const hit = r.pct !== null && r.pct >= 100
  const lead = rank === 1 && r.v > 0
  const f = useFlash(r.v, scope)
  return (
    <motion.div layout transition={SPRING} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      className={`ev-card ${f ? 'ev-glow' : ''}`} style={{ ...cardStyle, padding: 16, position: 'relative',
        border: hit ? `1px solid ${GREEN}66` : lead ? `1px solid ${GOLD}66` : cardStyle.border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }} className="ev-ava">
          <Avatar c={r.c} size={52} ring={hit ? GREEN : lead ? GOLD : undefined} />
          {lead && <Crown size={16} color={GOLD} fill={GOLD} style={{ position: 'absolute', top: -12, left: 18 }} aria-label="líder" />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.c.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.n} {r.n === 1 ? 'venda' : 'vendas'}{r.c.team ? ` · ${r.c.team}` : ''}</div>
        </div>
        <motion.div key={rank} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ fontSize: 12, fontWeight: 800, color: hit ? GREEN : 'var(--muted-foreground)' }}>#{rank}</motion.div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}><Money value={r.v} /></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: hit ? GREEN : 'var(--muted-foreground)' }}>{r.pct === null ? 'sem meta' : hit ? '✓ bateu' : Math.floor(r.pct) + '%'}</span>
      </div>
      {r.g !== null ? <>
        <Bar pct={r.pct} />
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>{hit ? `meta ${brl(r.g)} · +${brl(r.v - r.g)}` : `meta ${brl(r.g)} · faltam ${brl(r.g - r.v)}`}</div>
      </> : <div style={{ height: 8, borderRadius: 99, background: 'var(--secondary)', overflow: 'hidden', marginTop: 10 }}>
        <div className="ev-bar" style={{ width: `${(r.v / maxV) * 100}%`, height: '100%', background: `linear-gradient(90deg,${PURPLE},${PINK})`, transition: 'width 1s' }} /></div>}
      {f && <span key={f.k} className="ev-delta" style={{ position: 'absolute', right: 14, top: 8, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 900, color: '#052e16', background: '#86efac' }}>+{brl(f.delta)}</span>}
    </motion.div>
  )
}

const MEDAL = ['#fbbf24', '#cbd5e1', '#d97706']
function ProductRanking({ scope, items, total, dayLabel, theme }: { scope: string; items: { name: string; value: number; count: number }[]; total: number; dayLabel: string; theme: EventTheme }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 8)
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div style={{ marginTop: 20 }}>
      <SectionTitle icon={<ShoppingBag size={16} />} title="Produtos mais vendidos" sub={dayLabel} />
      <div style={{ ...cardStyle, padding: 'clamp(12px,2vw,20px)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: theme.pattern, opacity: .35, filter: 'invert(1)', mixBlendMode: 'overlay', pointerEvents: 'none' }} />
        {items.length === 0 && <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)', position: 'relative' }}>Os produtos vendidos vão aparecer aqui, do mais vendido pro menos.</div>}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <AnimatePresence initial={false}>
            {shown.map((p, i) => <ProductRow key={p.name} scope={scope} p={p} i={i} max={max} share={total > 0 ? (p.value / total) * 100 : 0} />)}
          </AnimatePresence>
        </div>
        {items.length > 8 && <button className="ev-btn" onClick={() => setAll(a => !a)} style={{ ...btnGhost, position: 'relative', marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <ChevronDown size={14} style={{ transform: all ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /> {all ? 'Mostrar menos' : `Ver todos (${items.length})`}</button>}
      </div>
    </div>
  )
}

function ProductRow({ scope, p, i, max, share }: { scope: string; p: { name: string; value: number; count: number }; i: number; max: number; share: number }) {
  const f = useFlash(p.value, scope)
  return (
    <motion.div layout transition={SPRING} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="ev-row" style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 12, position: 'relative' }}>
      <div style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900,
        color: i < 3 ? '#1f2937' : 'var(--muted-foreground)', background: i < 3 ? MEDAL[i] : 'var(--secondary)' }}>{i + 1}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px 8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flex: 'none' }}>{p.count} {p.count === 1 ? 'venda' : 'vendas'} · {share >= 1 ? Math.round(share) : share.toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'var(--secondary)', overflow: 'hidden', marginTop: 6 }}>
          <motion.div className="ev-bar" initial={{ width: 0 }} animate={{ width: `${(p.value / max) * 100}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%', borderRadius: 99,
            background: i === 0 ? `linear-gradient(90deg,${GOLD},${PINK})` : `linear-gradient(90deg,${PURPLE},${PINK})` }} /></div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 92 }}><Money value={p.value} /></div>
      {f && <span key={f.k} className="ev-delta" style={{ position: 'absolute', right: 10, top: -4, fontSize: 11, fontWeight: 900, color: GREEN }}>+{brl(f.delta)}</span>}
    </motion.div>
  )
}

function Confetti({ colors }: { colors: string[] }) {
  const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  const pieces = Array.from({ length: 70 }, (_, i) => ({
    i, left: rnd(i, 1) * 100, dx: (rnd(i, 2) - 0.5) * 240, delay: rnd(i, 3) * 1.2, dur: 3 + rnd(i, 4) * 2.5, c: colors[i % colors.length], w: 6 + rnd(i, 5) * 6 }))
  return <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90, overflow: 'hidden' }}>
    {pieces.map(p => <span key={p.i} style={{ position: 'absolute', top: 0, left: `${p.left}%`, width: p.w, height: p.w * 1.6, background: p.c, borderRadius: 2,
      animation: `evConf ${p.dur}s ${p.delay}s ease-in forwards`, ['--dx' as string]: `${p.dx}px`, opacity: 0 }} />)}</div>
}

function LiveSkeleton() {
  return <div><style>{EV_CSS}</style>
    <div className="ev-skel" style={{ height: 34, width: 280, marginBottom: 16 }} />
    <div className="ev-skel" style={{ height: 230, borderRadius: 24 }} />
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', marginTop: 16 }}>
      {[0, 1, 2].map(i => <div key={i} className="ev-skel" style={{ height: 150 }} />)}</div></div>
}
