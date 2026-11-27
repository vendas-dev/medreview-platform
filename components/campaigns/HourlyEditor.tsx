'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock, Plus, Repeat, Trash2 } from 'lucide-react'
import { HourlyCfg, HourlyRange } from '@/lib/campaigns/types'
import { exactSpan, HOURLY_MAX_RANGES, isExactHourly, slotRange, slotsOfDay, validateHourly } from '@/lib/campaigns/hourly'
import { Btn } from './ui'

// ══ Critério "Por hora" — telas do cadastro ═══════════════════════════════════════════════════════════════════
// HourlySchedule: quando valem as rodadas (dia completo 24h OU horários definidos) e quem ganha cada rodada.
// HourlyPrizes: um prêmio diferente por horário (o mesmo em todos os dias da campanha).
// Todo horário é horário de São Paulo (Brasília). Os intervalos são guardados em MINUTOS desde 00:00 (0..1440).

const PRESETS: { id: string; label: string; from: number; to: number }[] = [
  { id: 'comercial', label: 'Comercial 9h–18h', from: 540, to: 1080 },
  { id: 'manha', label: 'Manhã 8h–12h', from: 480, to: 720 },
  { id: 'tarde', label: 'Tarde 13h–18h', from: 780, to: 1080 },
  { id: 'noite', label: 'Noite 18h–22h', from: 1080, to: 1320 },
]
const MIN_CHIPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const pad = (n: number) => String(n).padStart(2, '0')
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const dnum = (day: string): number => Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000)
const addD = (day: string, n: number): string => new Date((dnum(day) + n) * 86400000).toISOString().slice(0, 10)
const fmtDM = (day: string): string => (DAY_RE.test(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : '—')
const absOf = (day: string | undefined, min: number): number => (day && DAY_RE.test(day) ? dnum(day) * 1440 + min : NaN)
/** Soma minutos a (dia, minuto) e devolve o novo (dia, minuto) — passando da meia-noite muda o dia. */
const plus = (day: string, min: number, delta: number): { day: string; min: number } => { const t = dnum(day) * 1440 + min + delta, dn = Math.floor(t / 1440); return { day: addD('1970-01-01', dn), min: t - dn * 1440 } }
const durMin = (m: number) => (m <= 0 ? '' : `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h` : ''}${m % 60 ? `${m % 60}min` : ''}`)
const clamp = (v: number) => (Number.isFinite(v) && v >= 0 ? Math.min(v, 1440) : 0)
const dur = (r: HourlyRange) => durMin(r.to - r.from)
const durExact = (r: HourlyRange) => durMin(absOf(r.endDay, r.to) - absOf(r.day, r.from))

/** Horário editável: digite a hora e os minutos (qualquer minuto, 00–59) ou abra o seletor. `end` = horário de FIM (aceita 24h = meia-noite do fim do dia).
 *  `onDone` roda quando a pessoa termina de editar (saiu dos campos ou fechou o seletor). */
function TimeField({ value, onChange, onDone, end, label, name }: { value: number; onChange: (m: number) => void; onDone?: () => void; end?: boolean; label: string; name: string }) {
  const v = clamp(value), h = Math.floor(v / 60), m = v % 60, maxH = end ? 24 : 23
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<{ h?: string; m?: string }>({}), [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const box = useRef<HTMLSpanElement>(null), pop = useRef<HTMLDivElement>(null), minRef = useRef<HTMLInputElement>(null)
  const commit = (nh: number, nm: number) => onChange(Math.min(nh, maxH) * 60 + (nh >= 24 ? 0 : nm))
  const close = () => { setOpen(false); onDone?.() }
  const toggle = () => {
    if (open) { close(); return }
    const r = box.current?.getBoundingClientRect(); if (!r) return
    const W = 280, H = 330, left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8)), below = r.bottom + 6, top = below + H > window.innerHeight && r.top - H - 6 > 8 ? r.top - H - 6 : below
    setPos({ left, top }); setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!pop.current?.contains(t) && !box.current?.contains(t)) { setOpen(false); onDone?.() } }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); onDone?.() } }
    const away = () => { setOpen(false); onDone?.() }
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key); window.addEventListener('resize', away); window.addEventListener('scroll', away, true)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); window.removeEventListener('resize', away); window.removeEventListener('scroll', away, true) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const blurOut = (e: React.FocusEvent) => { setDraft({}); if (!box.current?.contains(e.relatedTarget as Node) && !open) onDone?.() }
  const hours = Array.from({ length: maxH + 1 }, (_, x) => x)
  return (
    <span ref={box} className="hx-time" data-time-field={name}>
      <input className="hx-seg" inputMode="numeric" autoComplete="off" maxLength={2} aria-label={`${label}: hora`} data-hour-select={name} value={draft.h ?? pad(h)}
        onFocus={e => e.currentTarget.select()} onBlur={blurOut}
        onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 2); if (t !== '' && Number(t) > maxH) return; setDraft(d => ({ ...d, h: t })); if (t !== '') { commit(Number(t), m); if (t.length === 2 && Number(t) < 24) minRef.current?.focus() } }}
        onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setDraft({}); commit((h + (e.key === 'ArrowUp' ? 1 : -1) + maxH + 1) % (maxH + 1), m) } }} />
      <b className="hx-colon" aria-hidden>:</b>
      <input ref={minRef} className="hx-seg" inputMode="numeric" autoComplete="off" maxLength={2} aria-label={`${label}: minuto`} data-min-select={name} disabled={h >= 24} value={draft.m ?? pad(m)}
        onFocus={e => e.currentTarget.select()} onBlur={blurOut}
        onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 2); if (t !== '' && Number(t) > 59) return; setDraft(d => ({ ...d, m: t })); if (t !== '') commit(h, Number(t)) }}
        onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const step = e.shiftKey ? 15 : 1; setDraft({}); commit(h, (m + (e.key === 'ArrowUp' ? step : -step) + 60) % 60) } }} />
      <button type="button" className="hx-tb" aria-label={`${label}: abrir seletor de horário`} aria-expanded={open} data-time-open={name} onClick={toggle}><Clock size={15} /></button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={pop} className="hx-pop" role="dialog" aria-label={`Escolher horário: ${label}`} style={{ left: pos.left, top: pos.top }}>
          <p className="hx-pl">Hora</p>
          <div className="hx-grid">{hours.map(x => <button key={x} type="button" aria-pressed={h === x} data-pick-hour={x} onClick={() => commit(x, m)}>{pad(x)}</button>)}</div>
          <p className="hx-pl">Minutos <span>(ou digite qualquer valor no campo)</span></p>
          <div className="hx-chips">{MIN_CHIPS.map(x => <button key={x} type="button" aria-pressed={m === x} disabled={h >= 24} data-pick-min={x} onClick={() => commit(h, x)}>{pad(x)}</button>)}</div>
          <button type="button" className="hx-ok" onClick={close}>Pronto · {pad(h)}:{pad(m)}</button>
        </div>, document.body)}
    </span>
  )
}

const HX_CSS = `
.hx-time{display:inline-flex;align-items:center;gap:2px;height:44px;padding:0 4px 0 10px;border-radius:12px;border:1px solid var(--border);background:var(--card);transition:border-color .15s,box-shadow .15s}
.hx-time:hover{border-color:color-mix(in srgb,var(--foreground) 24%,var(--border))}
.hx-time:focus-within{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.18)}
.hx-seg{width:30px;height:30px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--foreground);font:inherit;font-size:15px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;outline:none;caret-color:#6366f1}
.hx-seg:focus{background:rgba(99,102,241,.14)}.hx-seg:disabled{opacity:.45}
.hx-colon{color:var(--muted-foreground);font-weight:800}
.hx-tb{margin-left:4px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:9px;background:transparent;color:var(--muted-foreground);cursor:pointer;transition:background .15s,color .15s}
.hx-tb:hover,.hx-tb[aria-expanded=true]{background:rgba(99,102,241,.14);color:#6366f1}
.hx-pop{position:fixed;z-index:2147483000;width:280px;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--border);box-shadow:0 20px 50px rgba(15,23,42,.28);animation:hxIn .14s ease-out;color:var(--foreground)}
@keyframes hxIn{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
.hx-pl{margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-foreground)}.hx-pl span{font-weight:600;letter-spacing:0;text-transform:none;opacity:.8}
.hx-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:14px}
.hx-chips{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:14px}
.hx-grid button,.hx-chips button{height:34px;border-radius:10px;border:1px solid var(--border);background:var(--secondary);color:var(--foreground);font:inherit;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;cursor:pointer;transition:background .12s,border-color .12s,color .12s,transform .08s}
.hx-grid button:hover:not(:disabled),.hx-chips button:hover:not(:disabled){border-color:#6366f1;background:rgba(99,102,241,.1)}
.hx-grid button:active,.hx-chips button:active{transform:scale(.94)}
.hx-grid button[aria-pressed=true],.hx-chips button[aria-pressed=true]{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent;color:#fff}
.hx-chips button:disabled{opacity:.4;cursor:not-allowed}
.hx-ok{width:100%;height:40px;border:0;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font:inherit;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 6px 16px rgba(99,102,241,.3)}
.hx-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:var(--card);border:1px solid var(--border)}
.hx-row.bad{border-color:#ef4444}
.hx-when{flex:1 1 360px;display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px}
.hx-pt{display:flex;flex-direction:column;gap:5px}.hx-pt>label{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.hx-pt-in{display:flex;flex-wrap:wrap;gap:8px}
.hx-date{width:auto;min-width:148px;font-weight:700;font-variant-numeric:tabular-nums}
.hx-arrow{align-self:flex-end;height:44px;display:inline-flex;align-items:center;color:var(--muted-foreground);font-weight:800}
.hx-tl{display:flex;flex-direction:column;gap:6px}.hx-tl-row{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:8px}.hx-tl-d{font-size:11px;font-weight:800;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
`

/** As 24 horas do dia numa faixa só: o que está colorido é o que vale na campanha. */
function DayBar({ cfg }: { cfg: HourlyCfg }) {
  const ranges = cfg.mode === 'full' ? [{ from: 0, to: 1440 }] : cfg.ranges.filter(r => r.from >= 0 && r.to > r.from && r.to <= 1440)
  const cover = (h: number) => ranges.reduce((a, r) => a + Math.max(0, Math.min(r.to, (h + 1) * 60) - Math.max(r.from, h * 60)), 0) / 60
  return (
    <div data-daybar aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 2 }}>
        {Array.from({ length: 24 }, (_, h) => { const f = cover(h); return <i key={h} data-daybar-cell={h} data-on={f > 0 ? '1' : '0'} style={{ height: 26, borderRadius: 5, background: f > 0 ? '#6366f1' : 'var(--border)', opacity: f > 0 ? 0.35 + 0.65 * f : 0.7, transition: 'background .2s, opacity .2s' }} /> })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)' }}>{['00h', '06h', '12h', '18h', '24h'].map(x => <span key={x}>{x}</span>)}</div>
    </div>
  )
}

/** Datas exatas: uma faixa de 24h por dia da campanha; o que está colorido é o que vale (passa da meia-noite sem confusão). */
function ExactTimeline({ cfg }: { cfg: HourlyCfg }) {
  const rs = cfg.ranges.filter(r => absOf(r.day, r.from) < absOf(r.endDay, r.to))
  const sp = exactSpan(cfg); if (!sp || rs.length === 0) return null
  const n = dnum(sp.ends_on) - dnum(sp.starts_on) + 1; if (n > 8) return <p data-daybar style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{fmtDM(sp.starts_on)} → {fmtDM(sp.ends_on)} · {n} dias</p>
  const cover = (day: string, h: number) => rs.reduce((a, r) => a + Math.max(0, Math.min(absOf(r.endDay, r.to), absOf(day, (h + 1) * 60)) - Math.max(absOf(r.day, r.from), absOf(day, h * 60))), 0) / 60
  return (
    <div data-daybar className="hx-tl" aria-hidden>
      {Array.from({ length: n }, (_, di) => { const day = addD(sp.starts_on, di); return (
        <div key={day} className="hx-tl-row" data-daybar-day={day}><span className="hx-tl-d">{fmtDM(day)}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 2 }}>{Array.from({ length: 24 }, (_, h) => { const f = cover(day, h); return <i key={h} data-daybar-cell={`${day}-${h}`} data-on={f > 0 ? '1' : '0'} style={{ height: 20, borderRadius: 4, background: f > 0 ? '#6366f1' : 'var(--border)', opacity: f > 0 ? 0.35 + 0.65 * Math.min(f, 1) : 0.7 }} /> })}</div>
        </div>) })}
      <div className="hx-tl-row"><span /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)' }}>{['00h', '06h', '12h', '18h', '24h'].map(x => <span key={x}>{x}</span>)}</div></div>
    </div>
  )
}

export function HourlySchedule({ cfg, onChange, days, baseDay }: { cfg: HourlyCfg; onChange: (c: HourlyCfg) => void; days: number; baseDay?: string }) {
  const set = (p: Partial<HourlyCfg>) => onChange({ ...cfg, ...p })
  const exact = isExactHourly(cfg), start0 = baseDay && DAY_RE.test(baseDay) ? baseDay : new Date().toISOString().slice(0, 10)
  const firstExact = (): HourlyRange => ({ day: start0, from: 540, to: 720, endDay: start0 })
  const setRange = (i: number, p: Partial<HourlyRange>) => set({ ranges: cfg.ranges.map((r, k) => (k === i ? { ...r, ...p } : r)) })
  const addRange = (r?: HourlyRange) => {
    if (exact) {                                     // datas exatas: o próximo intervalo começa onde o último termina (ou no dia-base)
      const lastEnd = cfg.ranges.reduce<{ day: string; min: number } | null>((a, x) => (x.endDay && DAY_RE.test(x.endDay) && (!a || absOf(x.endDay, x.to) > absOf(a.day, a.min)) ? { day: x.endDay, min: x.to } : a), null)
      const st = lastEnd ? (lastEnd.min >= 1440 ? { day: addD(lastEnd.day, 1), min: 0 } : lastEnd) : { day: start0, min: 540 }, en = plus(st.day, st.min, 180)
      set({ ranges: [...cfg.ranges, r ?? { day: st.day, from: st.min, to: en.min === 0 && en.day !== st.day ? 1440 : en.min, endDay: en.min === 0 && en.day !== st.day ? st.day : en.day }].slice(0, HOURLY_MAX_RANGES) })
      return
    }
    const last = cfg.ranges.reduce((a, x) => Math.max(a, x.to), 0), from = Math.min(last, 1380), nr = r ?? (cfg.ranges.length ? { from, to: Math.min(from + 180, 1440) } : { from: 540, to: 720 })
    set({ ranges: [...cfg.ranges, nr].slice(0, HOURLY_MAX_RANGES) })
  }
  const slots = slotsOfDay(cfg).length
  // só os avisos do HORÁRIO (os dias e os prêmios são cobrados nos outros passos)
  const errs = validateHourly({ starts_on: '2026-01-01', ends_on: '2026-01-01', hourly: cfg, prize: 'x', prize_mode: 'single', prizes: {}, teams: {} }, true)
  const bad = (i: number) => { const r = cfg.ranges[i]; return exact ? !(r && absOf(r.day, r.from) < absOf(r.endDay, r.to) && r.to <= 1440) : !(r && r.from >= 0 && r.to > r.from && r.to <= 1440) }
  return (
    <div data-hourly-block className="cb-card-in" style={{ gap: 18 }}>
      <style>{HX_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={18} /></span>
        <div>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: 'var(--foreground)' }}>Quando valem as rodadas?</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--muted-foreground)' }}>Em cada rodada, quem vender mais leva o prêmio. {exact && cfg.mode === 'ranges' ? 'Vale nas datas e horários que você definir abaixo, sempre no' : <>Vale para <strong style={{ color: 'var(--foreground)' }}>cada dia</strong> da campanha, sempre no</>} <strong style={{ color: 'var(--foreground)' }}>horário de São Paulo (Brasília)</strong>.</p>
        </div>
      </div>

      <div className="cp-seg" role="group" aria-label="Dia completo ou horários definidos" style={{ alignSelf: 'flex-start' }}>
        {([['full', '🌙 Dia completo (24h)'], ['ranges', '🕘 Horários definidos']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={cfg.mode === id} data-hourly-mode={id} onClick={() => set(id === 'full' ? { mode: id } : cfg.ranges.length === 0 ? { mode: id, exact: true, ranges: [firstExact()] } : { mode: id })}>{label}</button>
        ))}
      </div>

      {exact && cfg.mode === 'ranges' ? <ExactTimeline cfg={cfg} /> : <DayBar cfg={cfg} />}

      {cfg.mode === 'full' ? (
        <p data-hourly-full style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>As <strong style={{ color: 'var(--foreground)' }}>24 horas</strong> do dia valem: uma rodada a cada hora cheia (00h–01h, 01h–02h … 23h–24h).</p>
      ) : (
        <div data-hourly-ranges style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cp-seg" role="group" aria-label="Como definir os intervalos" style={{ alignSelf: 'flex-start' }}>
            {([['exact', <CalendarDays key="a" size={14} />, 'Datas e horários exatos'], ['daily', <Repeat key="b" size={14} />, 'Repete todo dia']] as const).map(([id, icon, label]) => (
              <button key={id} type="button" aria-pressed={(id === 'exact') === exact} data-hourly-kind={id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                onClick={() => {
                  if ((id === 'exact') === exact) return
                  if (id === 'exact') set({ exact: true, ranges: cfg.ranges.length ? cfg.ranges.filter(r => r.to > r.from).map(r => ({ day: start0, from: r.from, to: r.to, endDay: start0 })) : [firstExact()] })
                  else set({ exact: false, ranges: cfg.ranges.map(r => ({ from: r.from, to: r.endDay && r.day && r.endDay !== r.day ? 1440 : r.to })) })
                }}>{icon}{label}</button>))}
          </div>
          <p data-hourly-kind-hint style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            {exact ? <>Informe a <strong style={{ color: 'var(--foreground)' }}>data e a hora de início e de fim</strong> de cada intervalo (pode virar a meia-noite, ex.: 27/11 às 16h até 28/11 à 01h). <strong style={{ color: 'var(--foreground)' }}>As datas da campanha são definidas automaticamente por eles.</strong></> : <>Os mesmos horários valem em <strong style={{ color: 'var(--foreground)' }}>todos os dias</strong> entre o início e o fim da campanha (passo &ldquo;Quando acontece?&rdquo;).</>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted-foreground)' }}>Atalhos:</span>
            {PRESETS.map(p => <button key={p.id} type="button" className="cp-opt" data-hourly-preset={p.id} disabled={cfg.ranges.length >= HOURLY_MAX_RANGES} onClick={() => addRange(exact ? { day: start0, from: p.from, to: p.to, endDay: start0 } : { from: p.from, to: p.to })} style={{ height: 32, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>+ {p.label}</button>)}
            {exact && <button type="button" className="cp-opt" data-hourly-preset="virada" disabled={cfg.ranges.length >= HOURLY_MAX_RANGES} onClick={() => addRange({ day: start0, from: 1320, to: 120, endDay: addD(start0, 1) })} style={{ height: 32, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>+ Virada 22h–02h</button>}
          </div>
          {cfg.ranges.map((r, i) => exact ? (
            <div key={i} data-hourly-range={i} className={`hx-row${bad(i) ? ' bad' : ''}`}>
              <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 8, background: 'rgba(99,102,241,.14)', color: '#6366f1', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <div className="hx-when">
                <div className="hx-pt"><label htmlFor={`hx-d-${i}-from`}>Início</label>
                  <div className="hx-pt-in">
                    <input id={`hx-d-${i}-from`} className="cp-field hx-date" type="date" data-hourly-day={`${i}-from`} aria-label={`Intervalo ${i + 1}: data de início`} value={r.day ?? ''}
                      onChange={e => { const v = e.target.value; const keep = r.day && r.endDay && DAY_RE.test(r.day) && DAY_RE.test(r.endDay) ? dnum(r.endDay) - dnum(r.day) : 0; setRange(i, { day: v, endDay: v && DAY_RE.test(v) ? addD(v, Math.max(keep, 0)) : r.endDay }) }} />
                    <TimeField value={r.from} label={`Intervalo ${i + 1}, início`} name={`${i}-from`} onChange={m => setRange(i, { from: Math.min(m, 1439) })} />
                  </div>
                </div>
                <span className="hx-arrow" aria-hidden>→</span>
                <div className="hx-pt"><label htmlFor={`hx-d-${i}-to`}>Fim</label>
                  <div className="hx-pt-in">
                    <input id={`hx-d-${i}-to`} className="cp-field hx-date" type="date" data-hourly-day={`${i}-to`} aria-label={`Intervalo ${i + 1}: data de fim`} value={r.endDay ?? ''} min={r.day} onChange={e => setRange(i, { endDay: e.target.value })} />
                    <TimeField end value={r.to} label={`Intervalo ${i + 1}, fim`} name={`${i}-to`} onChange={m => setRange(i, { to: m })}
                      onDone={() => { /* terminou de digitar o fim: se ficou antes do início no mesmo dia, ele vai para o dia seguinte (virada da meia-noite) */
                        const cur = cfg.ranges[i]; if (cur && cur.day && cur.endDay === cur.day && DAY_RE.test(cur.day) && absOf(cur.endDay, cur.to) <= absOf(cur.day, cur.from) && cur.to < 1440) setRange(i, { endDay: addD(cur.day, 1) }) }} />
                  </div>
                </div>
              </div>
              <span data-hourly-dur={i} style={{ fontSize: 11.5, fontWeight: 800, color: bad(i) ? '#ef4444' : '#6366f1', background: bad(i) ? 'rgba(239,68,68,.1)' : 'rgba(99,102,241,.1)', padding: '3px 9px', borderRadius: 999 }}>{bad(i) ? 'fim antes do início' : durExact(r)}</span>
              <button type="button" className="cp-ib" data-hourly-del={i} aria-label={`Remover o intervalo ${i + 1}`} onClick={() => set({ ranges: cfg.ranges.filter((_, k) => k !== i) })} style={{ width: 34, height: 34, marginLeft: 'auto' }}><Trash2 size={14} /></button>
            </div>
          ) : (
            <div key={i} data-hourly-range={i} className={`hx-row${bad(i) ? ' bad' : ''}`}>
              <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 8, background: 'rgba(99,102,241,.14)', color: '#6366f1', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' }}>das</span>
              <TimeField value={r.from} label={`Intervalo ${i + 1}, início`} name={`${i}-from`} onChange={m => setRange(i, { from: m })} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' }}>às</span>
              <TimeField end value={r.to} label={`Intervalo ${i + 1}, fim`} name={`${i}-to`} onChange={m => setRange(i, { to: m })} />
              <span data-hourly-dur={i} style={{ fontSize: 11.5, fontWeight: 800, color: bad(i) ? '#ef4444' : '#6366f1', background: bad(i) ? 'rgba(239,68,68,.1)' : 'rgba(99,102,241,.1)', padding: '3px 9px', borderRadius: 999 }}>{bad(i) ? 'fim antes do início' : dur(r)}</span>
              <button type="button" className="cp-ib" data-hourly-del={i} aria-label={`Remover o intervalo ${i + 1}`} onClick={() => set({ ranges: cfg.ranges.filter((_, k) => k !== i) })} style={{ width: 34, height: 34, marginLeft: 'auto' }}><Trash2 size={14} /></button>
            </div>
          ))}
          <div><Btn size="sm" data-hourly-add disabled={cfg.ranges.length >= HOURLY_MAX_RANGES} onClick={() => addRange()}><Plus size={13} />Adicionar intervalo</Btn></div>

          <div role="group" aria-label="Como premiar dentro de cada intervalo" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 4 }}>
            {([['hour', '⏱️ Um prêmio por hora', 'Cada hora dentro do intervalo tem o seu ganhador (ex.: 09h–12h vira 3 rodadas).'], ['whole', '🎯 Um prêmio por intervalo', 'O intervalo inteiro é uma disputa só, com um ganhador.']] as const).map(([id, title, desc]) => (
              <button key={id} type="button" className="cp-opt" aria-pressed={cfg.split === id} data-hourly-split={id} onClick={() => set({ split: id })} style={{ padding: 14 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>{title}</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, lineHeight: 1.45 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div role="group" aria-label="Quem ganha cada rodada" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="cb-label">Quem ganha cada rodada?</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          {([['revenue', '💰 Quem vender mais', 'Maior valor em R$ dentro da rodada.'], ['count', '🔢 Quem fechar mais vendas', 'Maior quantidade de vendas dentro da rodada.']] as const).map(([id, title, desc]) => (
            <button key={id} type="button" className="cp-opt" aria-pressed={cfg.metric === id} data-hourly-metric={id} onClick={() => set({ metric: id })} style={{ padding: 14 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>{title}</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, lineHeight: 1.45 }}>{desc}</span>
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-foreground)' }}>Empate: vence quem tiver mais do outro número e, se persistir, quem chegou ao resultado primeiro. Cada time é apurado separado.</p>
      </div>

      {errs.length > 0 && <p data-hourly-errors style={{ margin: 0, padding: '10px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, fontWeight: 700, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.38)', color: '#b45309' }}>{errs.slice(0, 3).map((e, i) => <span key={i} style={{ display: 'block' }}>⚠ {e}</span>)}</p>}
      <p data-hourly-summary style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
        {slots > 0 && exact && cfg.mode === 'ranges' ? <>📊 <strong style={{ color: 'var(--foreground)' }}>{slots} {slots === 1 ? 'rodada' : 'rodadas'} no total</strong> = <strong style={{ color: 'var(--foreground)' }}>{slots} {slots === 1 ? 'prêmio' : 'prêmios'} por time</strong>.</> : slots > 0 ? <>📊 <strong style={{ color: 'var(--foreground)' }}>{slots} {slots === 1 ? 'rodada' : 'rodadas'} por dia</strong>{days > 0 ? <> × {days} {days === 1 ? 'dia' : 'dias'} = <strong style={{ color: 'var(--foreground)' }}>{slots * days} {slots * days === 1 ? 'prêmio' : 'prêmios'} por time</strong></> : ''}.</> : 'Defina os horários para ver quantas rodadas a campanha terá.'}
      </p>
    </div>
  )
}

/** Um prêmio por horário (igual em todos os dias). Escreve a MESMA lista em todos os times da campanha. */
export function HourlyPrizes({ cfg, list, onChange }: { cfg: HourlyCfg; list: string[]; onChange: (l: string[]) => void }) {
  const per = slotsOfDay(cfg), n = per.length
  const val = (i: number) => list[i] ?? ''
  const set = (i: number, v: string) => { const l = Array.from({ length: n }, (_, k) => val(k)); l[i] = v; onChange(l) }
  if (n === 0) return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-foreground)' }}>Defina os horários no passo 2 para escolher o prêmio de cada um.</p>
  const filled = per.filter((_, i) => val(i).trim()).length
  return (
    <div data-hourly-prizes style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: 'var(--muted-foreground)' }}><strong style={{ color: 'var(--foreground)' }}>{filled}/{n}</strong> horários com prêmio · o mesmo prêmio vale em todos os dias</span>
        <Btn size="sm" data-hourly-fill-first disabled={!val(0).trim()} onClick={() => onChange(Array.from({ length: n }, () => val(0)))}>Repetir o 1º em todos</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 8 }}>
        {per.map((s, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 'none', width: s.day ? 132 : 86, textAlign: 'center', padding: s.day ? '6px 0' : '10px 0', borderRadius: 10, background: 'rgba(99,102,241,.1)', color: '#6366f1', fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{s.day ? <>{fmtDM(s.day)}<br />{slotRange(s)}</> : slotRange(s)}</span>
            <input className="cp-field" data-hourly-prize={i} value={val(i)} maxLength={120} placeholder={`Prêmio de ${slotRange(s)}`} onChange={e => set(i, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}
