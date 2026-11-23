'use client'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { HourlyCfg, HourlyRange } from '@/lib/campaigns/types'
import { HOURLY_MAX_RANGES, slotRange, slotsOfDay, validateHourly } from '@/lib/campaigns/hourly'
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
const MINUTES = [0, 15, 30, 45]
const clamp = (v: number) => (Number.isFinite(v) && v >= 0 ? Math.min(v, 1440) : 0)
const dur = (r: HourlyRange) => { const m = r.to - r.from; return m <= 0 ? '' : `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h` : ''}${m % 60 ? `${m % 60}min` : ''}` }

/** Dois campos simples: hora e minuto. `end` = horário de FIM (vai de 01h a 24h; 24h = meia-noite do fim do dia). */
function TimeSelect({ value, onChange, end, label, name }: { value: number; onChange: (m: number) => void; end?: boolean; label: string; name: string }) {
  const v = clamp(value), h = Math.floor(v / 60), m = v % 60
  const hours = end ? Array.from({ length: 24 }, (_, i) => i + 1) : Array.from({ length: 24 }, (_, i) => i)
  const sel: React.CSSProperties = { width: 'auto', minWidth: 64, padding: '0 8px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <select className="cp-field" aria-label={`${label}: hora`} data-hour-select={name} value={h} style={sel} onChange={e => { const nh = Number(e.target.value); onChange(nh * 60 + (nh === 24 ? 0 : m)) }}>
        {hours.map(x => <option key={x} value={x}>{String(x).padStart(2, '0')}h</option>)}
      </select>
      <b style={{ color: 'var(--muted-foreground)' }}>:</b>
      <select className="cp-field" aria-label={`${label}: minuto`} data-min-select={name} value={MINUTES.includes(m) ? m : 0} disabled={h === 24} style={sel} onChange={e => onChange(h * 60 + Number(e.target.value))}>
        {MINUTES.map(x => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
      </select>
    </span>
  )
}

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

export function HourlySchedule({ cfg, onChange, days }: { cfg: HourlyCfg; onChange: (c: HourlyCfg) => void; days: number }) {
  const set = (p: Partial<HourlyCfg>) => onChange({ ...cfg, ...p })
  const setRange = (i: number, p: Partial<HourlyRange>) => set({ ranges: cfg.ranges.map((r, k) => (k === i ? { ...r, ...p } : r)) })
  const addRange = (r?: HourlyRange) => {
    const last = cfg.ranges.reduce((a, x) => Math.max(a, x.to), 0), from = Math.min(last, 1380), nr = r ?? (cfg.ranges.length ? { from, to: Math.min(from + 180, 1440) } : { from: 540, to: 720 })
    set({ ranges: [...cfg.ranges, nr].slice(0, HOURLY_MAX_RANGES) })
  }
  const slots = slotsOfDay(cfg).length
  // só os avisos do HORÁRIO (os dias e os prêmios são cobrados nos outros passos)
  const errs = validateHourly({ starts_on: '2026-01-01', ends_on: '2026-01-01', hourly: cfg, prize: 'x', prize_mode: 'single', prizes: {}, teams: {} }, true)
  const bad = (i: number) => { const r = cfg.ranges[i]; return !(r && r.from >= 0 && r.to > r.from && r.to <= 1440) }
  return (
    <div data-hourly-block className="cb-card-in" style={{ gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={18} /></span>
        <div>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: 'var(--foreground)' }}>Quando valem as rodadas?</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--muted-foreground)' }}>Em cada rodada, quem vender mais leva o prêmio. Vale para <strong style={{ color: 'var(--foreground)' }}>cada dia</strong> da campanha, sempre no <strong style={{ color: 'var(--foreground)' }}>horário de São Paulo (Brasília)</strong>.</p>
        </div>
      </div>

      <div className="cp-seg" role="group" aria-label="Dia completo ou horários definidos" style={{ alignSelf: 'flex-start' }}>
        {([['full', '🌙 Dia completo (24h)'], ['ranges', '🕘 Horários definidos']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={cfg.mode === id} data-hourly-mode={id} onClick={() => set({ mode: id, ranges: id === 'ranges' && cfg.ranges.length === 0 ? [{ from: 540, to: 720 }] : cfg.ranges })}>{label}</button>
        ))}
      </div>

      <DayBar cfg={cfg} />

      {cfg.mode === 'full' ? (
        <p data-hourly-full style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>As <strong style={{ color: 'var(--foreground)' }}>24 horas</strong> do dia valem: uma rodada a cada hora cheia (00h–01h, 01h–02h … 23h–24h).</p>
      ) : (
        <div data-hourly-ranges style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted-foreground)' }}>Atalhos:</span>
            {PRESETS.map(p => <button key={p.id} type="button" className="cp-opt" data-hourly-preset={p.id} disabled={cfg.ranges.length >= HOURLY_MAX_RANGES} onClick={() => addRange({ from: p.from, to: p.to })} style={{ height: 32, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>+ {p.label}</button>)}
          </div>
          {cfg.ranges.map((r, i) => (
            <div key={i} data-hourly-range={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--card)', border: `1px solid ${bad(i) ? '#ef4444' : 'var(--border)'}` }}>
              <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 8, background: 'rgba(99,102,241,.14)', color: '#6366f1', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' }}>das</span>
              <TimeSelect value={r.from} label={`Intervalo ${i + 1}, início`} name={`${i}-from`} onChange={m => setRange(i, { from: m })} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' }}>às</span>
              <TimeSelect value={r.to} end label={`Intervalo ${i + 1}, fim`} name={`${i}-to`} onChange={m => setRange(i, { to: m })} />
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
        {slots > 0 ? <>📊 <strong style={{ color: 'var(--foreground)' }}>{slots} {slots === 1 ? 'rodada' : 'rodadas'} por dia</strong>{days > 0 ? <> × {days} {days === 1 ? 'dia' : 'dias'} = <strong style={{ color: 'var(--foreground)' }}>{slots * days} {slots * days === 1 ? 'prêmio' : 'prêmios'} por time</strong></> : ''}.</> : 'Defina os horários para ver quantas rodadas a campanha terá.'}
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
            <span style={{ flex: 'none', width: 86, textAlign: 'center', padding: '10px 0', borderRadius: 10, background: 'rgba(99,102,241,.1)', color: '#6366f1', fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{slotRange(s)}</span>
            <input className="cp-field" data-hourly-prize={i} value={val(i)} maxLength={120} placeholder={`Prêmio de ${slotRange(s)}`} onChange={e => set(i, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}
