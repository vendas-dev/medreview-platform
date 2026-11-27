'use client'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Search, Wand2, X, Users, CalendarDays, Target, AlertTriangle } from 'lucide-react'
import {
  Avatar, EV_CSS, mix, GREEN, GOLD, PINK, PURPLE, MoneyInput, brl, btnGhost, btnPrimary, cardStyle, fmtDay, weekday, type LiveData,
} from './shared'
import { distribute, eventDays, isDateStr } from '@/lib/dashboard/eventGoalsCore'
import { VERTICAL_THEME_LIST, themeOf, themeVars } from './theme'

interface Cand { id: string; name: string; avatar_url: string | null; team: string | null; hubspot_id: string | null; isCloser: boolean }
interface NameOpt { name: string; count: number; last: string }
export interface Draft {
  vertical: string | null
  name: string; event_name: string; start_date: string; end_date: string; notes: string | null
  closers: string[]
  total?: number
  days: Record<number, number | undefined>
  closerTotals: Record<string, number | undefined>
  cells: Record<string, Record<number, number | undefined>>
}
export const emptyDraft = (): Draft => ({ vertical: null, name: '', event_name: '', start_date: '', end_date: '', notes: null, closers: [], days: {}, closerTotals: {}, cells: {} })

/** Edição: carrega tudo; Duplicar: leva closers e metas (por nº do dia) mas deixa nome e datas pra preencher. */
export function draftFromLive(l: LiveData, duplicate: boolean): Draft {
  const idx = (d: string) => l.days.indexOf(d)
  const cells: Draft['cells'] = {}
  for (const [cid, m] of Object.entries(l.goals.cells)) for (const [d, v] of Object.entries(m)) if (idx(d) >= 0) (cells[cid] ??= {})[idx(d)] = v
  const days: Draft['days'] = {}
  for (const [d, v] of Object.entries(l.goals.days)) if (idx(d) >= 0) days[idx(d)] = v
  return {
    vertical: l.edition.vertical ?? null,
    name: duplicate ? '' : l.edition.name, event_name: duplicate ? '' : l.edition.event_name,
    start_date: duplicate ? '' : l.edition.start_date, end_date: duplicate ? '' : l.edition.end_date, notes: l.edition.notes,
    closers: l.closers.map(c => c.id), total: l.goals.total ?? undefined, days, closerTotals: { ...l.goals.closers }, cells,
  }
}

const TEAMS = [
  { key: 'OAO', label: 'Time OAO', color: '#38bdf8' }, { key: 'R1', label: 'Time R1', color: '#a855f7' }, { key: 'OUTROS', label: 'Sem time', color: '#94a3b8' },
]
const teamKey = (t: string | null) => { const u = (t ?? '').trim().toUpperCase(); return u === 'OAO' || u === 'R1' ? u : 'OUTROS' }
const sum = (xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)

export function EventEditor({ editionId, initial, duplicatedFrom, onCancel, onSaved }: {
  editionId: string | null; initial: Draft; duplicatedFrom?: string; onCancel: () => void; onSaved: (id: string) => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const [cands, setCands] = useState<Cand[]>([])
  const [names, setNames] = useState<NameOpt[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [q, setQ] = useState(''); const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null)
  const [sugOpen, setSugOpen] = useState(false)

  useEffect(() => { let off = false
    fetch('/api/dashboard/event-goals/options', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (off) return; if (j.error) setLoadErr(j.error); else { setCands(j.candidates ?? []); setNames(j.eventNames ?? []) } }).catch(() => !off && setLoadErr('Não foi possível carregar a lista de closers.'))
    return () => { off = true } }, [])

  const datesOk = isDateStr(d.start_date) && isDateStr(d.end_date) && d.end_date >= d.start_date
  const days = useMemo(() => (datesOk ? eventDays(d.start_date, d.end_date) : []), [d.start_date, d.end_date, datesOk])
  const chosen = d.closers.map(id => cands.find(c => c.id === id) ?? { id, name: 'Closer', avatar_url: null, team: null, hubspot_id: null, isCloser: true })
  const set = (patch: Partial<Draft>) => setD(p => ({ ...p, ...patch }))
  const toggle = (id: string) => set({ closers: d.closers.includes(id) ? d.closers.filter(x => x !== id) : [...d.closers, id] })
  const setCell = (cid: string, i: number, v: number | undefined) => setD(p => ({ ...p, cells: { ...p.cells, [cid]: { ...p.cells[cid], [i]: v } } }))

  const problems: string[] = []
  if (!d.vertical) problems.push('Escolha a vertical do evento')
  if (!d.name.trim()) problems.push('Dê um nome ao evento')
  if (!d.event_name.trim()) problems.push('Informe o nome do evento nas vendas')
  if (!datesOk) problems.push('Informe as datas de início e fim')
  else if (days.length > 31) problems.push('O evento pode ter no máximo 31 dias')

  async function save() {
    if (problems.length) return
    setSaving(true); setErr(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goals: any[] = []
    if (d.total !== undefined) goals.push({ scope: 'total', amount: d.total })
    days.forEach((day, i) => { const v = d.days[i]; if (v !== undefined) goals.push({ scope: 'day', day, amount: v }) })
    for (const cid of d.closers) {
      if (d.closerTotals[cid] !== undefined) goals.push({ scope: 'closer', profile_id: cid, amount: d.closerTotals[cid] })
      days.forEach((day, i) => { const v = d.cells[cid]?.[i]; if (v !== undefined) goals.push({ scope: 'closer_day', day, profile_id: cid, amount: v }) })
    }
    try {
      const res = await fetch(editionId ? `/api/dashboard/event-goals/${editionId}` : '/api/dashboard/event-goals', {
        method: editionId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical: d.vertical, name: d.name, event_name: d.event_name, start_date: d.start_date, end_date: d.end_date, notes: d.notes, closers: d.closers, goals }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error ?? 'Não foi possível salvar.'); setSaving(false); return }
      onSaved(j.id ?? editionId)
    } catch { setErr('Sem conexão. Tente de novo.'); setSaving(false) }
  }

  const visibleCands = cands.filter(c => (showAll || c.isCloser || d.closers.includes(c.id)) && c.name.toLowerCase().includes(q.trim().toLowerCase()))
  const closersSumByDay = (i: number) => sum(d.closers.map(c => d.cells[c]?.[i]))

  const theme = themeOf(d.vertical)
  return (
    <div style={themeVars(theme)}>
      <style>{EV_CSS}</style>
      <button className="ev-btn" onClick={onCancel} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}><ArrowLeft size={14} /> Voltar</button>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{editionId ? 'Editar evento e metas' : 'Novo evento'}</h2>
      {duplicatedFrom && <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--muted-foreground)' }}>Copiado de <b>{duplicatedFrom}</b>: closers e metas vieram junto (por número do dia). Ajuste o que precisar.</p>}

      {/* 1 · evento */}
      <Step n={1} icon={<CalendarDays size={16} />} title="Dados do evento">
        <div style={{ marginBottom: 18 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 8 }}>De qual vertical é o evento? <span style={{ fontWeight: 500 }}>(define cores, ícone e mascote da tela)</span></span>
          <div role="radiogroup" aria-label="Vertical" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            {VERTICAL_THEME_LIST.map(t => { const on = d.vertical === t.id; return (
              <button key={t.id} role="radio" aria-checked={on} onClick={() => set({ vertical: t.id })} className="ev-tile"
                style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', color: on ? '#fff' : 'var(--foreground)',
                  background: on ? t.hero : 'var(--card)', border: `2px solid ${on ? t.a : 'var(--border)'}`, boxShadow: on ? `0 10px 28px ${t.a}55` : 'var(--shadow-xs)' }}>
                {on && <span aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: t.pattern, opacity: .9 }} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.mascot && <img src={t.mascot} alt="" className="ev-ava" style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', background: t.a + '33', boxShadow: `0 0 0 2px ${t.a}` }} />}
                <span style={{ position: 'relative', fontWeight: 800, fontSize: 14 }}>{t.label}</span>
                {on && <span style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: t.a, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3} /></span>}
              </button>) })}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <Field label="Nome do evento (como vai aparecer aqui)"><input value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Ex.: Congresso X 2026" style={inputStyle} /></Field>
          <Field label="Nome do evento nas vendas" hint="Igual ao campo “nome do evento” da venda — acento e maiúscula não importam.">
            <input value={d.event_name} onChange={e => set({ event_name: e.target.value })} placeholder="Ex.: Congresso X 2026" style={inputStyle} list="ev-names" />
            <datalist id="ev-names">{names.map(n => <option key={n.name} value={n.name}>{n.count} vendas</option>)}</datalist>
          </Field>
          <Field label="Primeiro dia"><input type="date" value={d.start_date} onChange={e => set({ start_date: e.target.value, end_date: d.end_date && d.end_date >= e.target.value ? d.end_date : e.target.value })} style={inputStyle} /></Field>
          <Field label="Último dia"><input type="date" value={d.end_date} min={d.start_date || undefined} onChange={e => set({ end_date: e.target.value })} style={inputStyle} /></Field>
        </div>
        {names.length > 0 && <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Nomes já usados nas vendas:</span>
          {names.slice(0, 6).map(n => <button key={n.name} onClick={() => set({ event_name: n.name, name: d.name || n.name })} style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }}>{n.name} <span style={{ opacity: .6 }}>· {n.count}</span></button>)}</div>}
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Conta como venda do evento: venda com o <b>nome do evento preenchido</b> (cupom EV_ ou não). EV_ sem nome fica de fora até o nome ser preenchido. Reembolsada sai do placar. Dias em horário de Brasília.</p>
      </Step>

      {/* 2 · closers */}
      <Step n={2} icon={<Users size={16} />} title={`Quem vai ao evento · ${d.closers.length} ${d.closers.length === 1 ? 'closer' : 'closers'}`}>
        {loadErr && <Warn>{loadErr}</Warn>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}><Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted-foreground)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pelo nome" style={{ ...inputStyle, paddingLeft: 34 }} /></div>
          <label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> mostrar todos os usuários (não só closers)</label>
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', alignItems: 'start' }}>
          {TEAMS.map(tm => {
            const col = visibleCands.filter(c => teamKey(c.team) === tm.key)
            if (tm.key === 'OUTROS' && !col.length) return null
            const sel = col.filter(c => d.closers.includes(c.id)).length
            return (
              <div key={tm.key} className="ev-hov" style={{ borderRadius: 18, border: `1px solid ${tm.color}55`, background: `linear-gradient(180deg,${tm.color}14,transparent 60%)`, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 4, background: tm.color }} />
                  <b style={{ fontSize: 14, color: 'var(--foreground)', flex: 1 }}>{tm.label} <span style={{ fontWeight: 600, color: 'var(--muted-foreground)', fontSize: 12 }}>· {sel}/{col.length}</span></b>
                  {col.length > 0 && <button className="ev-btn" onClick={() => set({ closers: sel === col.length ? d.closers.filter(id => !col.some(c => c.id === id)) : [...d.closers, ...col.filter(c => !d.closers.includes(c.id)).map(c => c.id)] })}
                    style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>{sel === col.length ? 'Limpar' : 'Marcar todos'}</button>}
                </div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))' }}>
                  {col.map(c => { const on = d.closers.includes(c.id); return (
                    <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={on} className="ev-tile" style={{ position: 'relative', padding: '12px 6px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                      background: on ? `linear-gradient(160deg,${mix(PURPLE, 14)},${mix(PINK, 14)})` : 'var(--card)', border: `2px solid ${on ? PINK : 'var(--border)'}`, color: 'var(--foreground)' }}>
                      {on && <span style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: PINK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3} /></span>}
                      <div style={{ display: 'flex', justifyContent: 'center' }} className="ev-ava"><Avatar c={c} size={50} /></div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 7, lineHeight: 1.2 }}>{c.name}</div></button>) })}
                  {!col.length && <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--muted-foreground)', padding: 8 }}>Ninguém neste time{q ? ' para essa busca' : ''}.</div>}
                </div>
              </div>)
          })}
        </div>
        {!visibleCands.length && !loadErr && <div style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: 12 }}>Ninguém encontrado. Marque “mostrar todos os usuários”.</div>}
      </Step>

      {/* 3 · metas */}
      <Step n={3} icon={<Target size={16} />} title="Metas em R$"
        action={<button onClick={() => setSugOpen(true)} disabled={!days.length || !chosen.length} className="ev-btn" style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !days.length || !chosen.length ? .5 : 1 }}><Wand2 size={14} /> Distribuir meta (sugestão)</button>}>
        {!days.length || !chosen.length
          ? <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Informe as datas e escolha os closers para liberar a grade de metas.</p>
          : <>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Cada valor é definido por você — nada é preenchido sozinho. Campo vazio = sem meta. Embaixo de cada valor aparece a <b>soma das partes</b> para você conferir (clique para usar a soma).</p>
            <div style={{ overflowX: 'auto', margin: '0 -4px', padding: '0 4px' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: '0 8px', minWidth: 160 + 150 * (days.length + 1), width: '100%' }}>
                <thead><tr>
                  <th style={thL}>&nbsp;</th><th style={th}>Total do evento</th>
                  {days.map(day => <th key={day} style={th}>{weekday(day)} {fmtDay(day)}</th>)}
                </tr></thead>
                <tbody>
                  <tr>
                    <td style={{ ...tdL, fontWeight: 800, color: PINK }}>🏆 Meta geral</td>
                    <td style={td}><MoneyInput accent value={d.total} onChange={v => set({ total: v })} ariaLabel="Meta total do evento" />
                      <Sum label="dias somam" v={sum(days.map((_, i) => d.days[i]))} cur={d.total} onUse={v => set({ total: v })} /></td>
                    {days.map((_, i) => <td key={i} style={td}><MoneyInput accent value={d.days[i]} onChange={v => set({ days: { ...d.days, [i]: v } })} ariaLabel={`Meta geral do dia ${i + 1}`} />
                      <Sum label="closers somam" v={closersSumByDay(i)} cur={d.days[i]} onUse={v => set({ days: { ...d.days, [i]: v } })} /></td>)}
                  </tr>
                  {chosen.map(c => (
                    <tr key={c.id}>
                      <td style={tdL}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar c={c} size={30} /><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{c.name}</span></div></td>
                      <td style={td}><MoneyInput value={d.closerTotals[c.id]} onChange={v => set({ closerTotals: { ...d.closerTotals, [c.id]: v } })} ariaLabel={`Meta total de ${c.name}`} />
                        <Sum label="dias somam" v={sum(days.map((_, i) => d.cells[c.id]?.[i]))} cur={d.closerTotals[c.id]} onUse={v => set({ closerTotals: { ...d.closerTotals, [c.id]: v } })} /></td>
                      {days.map((_, i) => <td key={i} style={td}><MoneyInput value={d.cells[c.id]?.[i]} onChange={v => setCell(c.id, i, v)} ariaLabel={`Meta de ${c.name} no dia ${i + 1}`} /></td>)}
                    </tr>))}
                </tbody>
              </table>
            </div>
          </>}
      </Step>

      {/* barra de salvar */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 40, marginTop: 16, padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 -6px 24px rgba(0,0,0,.10)' }}>
        <div style={{ margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ flex: '1 1 240px', fontSize: 12, color: err ? '#ef4444' : problems.length ? GOLD : GREEN, fontWeight: 600 }}>
            {err ?? (problems.length ? problems[0] : 'Tudo certo — as metas só valem depois de salvar.')}</div>
          <button className="ev-btn" onClick={onCancel} style={btnGhost}>Cancelar</button>
          <button className="ev-btn" onClick={save} disabled={saving || problems.length > 0} style={{ ...btnPrimary, opacity: saving || problems.length ? .55 : 1, cursor: saving || problems.length ? 'not-allowed' : 'pointer' }}>{saving ? 'Salvando…' : 'Salvar evento'}</button>
        </div>
      </div>

      {sugOpen && <Suggest days={days} closers={chosen} initialTotal={d.total} onClose={() => setSugOpen(false)}
        onApply={(p) => { set(p); setSugOpen(false) }} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)', outline: 'none' }
const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center', padding: '0 6px 4px', whiteSpace: 'nowrap' }
const thL: React.CSSProperties = { ...th, position: 'sticky', left: 0, background: 'var(--card)', zIndex: 2, minWidth: 150 }
const td: React.CSSProperties = { padding: '0 6px', verticalAlign: 'top', minWidth: 140 }
const tdL: React.CSSProperties = { ...td, position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1, minWidth: 150, verticalAlign: 'middle' }

function Step({ n, title, action, children }: { n: number; icon?: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="ev-rise" style={{ ...cardStyle, padding: 'clamp(16px,2.4vw,24px)', marginTop: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, background: `linear-gradient(135deg,${PURPLE},${PINK})`, color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>{title}</h3>{action}</div>{children}</section>
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>{label}</span>{children}
    {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>{hint}</span>}</label>
}
function Warn({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: GOLD + '1f', color: GOLD, fontSize: 13, marginBottom: 12 }}><AlertTriangle size={14} />{children}</div>
}
function Sum({ label, v, cur, onUse }: { label: string; v: number; cur: number | undefined; onUse: (v: number) => void }) {
  if (!v) return null
  const diff = (cur ?? 0) - v; const ok = cur !== undefined && diff === 0
  return <button type="button" onClick={() => onUse(v)} title="Usar esta soma como meta" style={{ display: 'block', width: '100%', marginTop: 4, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, textAlign: 'right', color: ok ? GREEN : cur === undefined ? 'var(--muted-foreground)' : diff > 0 ? GOLD : '#ef4444' }}>
    {label} {brl(v)}{ok ? ' ✓' : cur !== undefined ? ` (${diff > 0 ? 'sobra' : 'passa'} ${brl(Math.abs(diff))})` : ''}</button>
}

/** "Distribuir meta": só calcula uma PRÉVIA com pesos que você ajusta; só entra na grade ao confirmar (e só vale depois de Salvar). */
function Suggest({ days, closers, initialTotal, onClose, onApply }: {
  days: string[]; closers: { id: string; name: string; avatar_url: string | null }[]; initialTotal?: number; onClose: () => void
  onApply: (p: Pick<Draft, 'total' | 'days' | 'closerTotals' | 'cells'>) => void
}) {
  const [total, setTotal] = useState<number | undefined>(initialTotal)
  const [wd, setWd] = useState<number[]>(days.map(() => 1))
  const [wc, setWc] = useState<number[]>(closers.map(() => 1))
  const dayAmt = useMemo(() => distribute(total ?? 0, wd), [total, wd])
  const cellAmt = useMemo(() => dayAmt.map(a => distribute(a, wc)), [dayAmt, wc])
  const wInput = (v: number, on: (n: number) => void, label: string) => <input type="number" min={0} step={0.5} value={v} aria-label={label} onChange={e => on(Math.max(0, Number(e.target.value) || 0))}
    style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--foreground)', fontSize: 13, textAlign: 'center' }} />
  return (
    <div role="dialog" aria-modal="true" aria-label="Sugestão de distribuição" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 'min(920px,100%)', maxHeight: '92vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--foreground)', flex: 1 }}>Distribuir meta — sugestão</h3>
          <button onClick={onClose} aria-label="Fechar" style={{ ...btnGhost, padding: 8 }}><X size={16} /></button></div>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5, margin: '8px 0 16px' }}>Informe a meta do evento e o <b>peso</b> de cada dia e de cada closer (peso 2 recebe o dobro do peso 1; peso 0 não recebe). É só uma prévia: você ajusta tudo na grade depois e nada é salvo sem clicar em “Salvar evento”.</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <b style={{ fontSize: 13, color: 'var(--foreground)' }}>Meta do evento</b><div style={{ width: 200 }}><MoneyInput accent value={total} onChange={setTotal} ariaLabel="Meta do evento" /></div></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: '0 6px', width: '100%', minWidth: 120 + 120 * days.length }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Peso</th>
              {days.map((day, i) => <th key={day} style={th}><div>{weekday(day)} {fmtDay(day)}</div><div style={{ marginTop: 4 }}>{wInput(wd[i], n => setWd(w => w.map((x, k) => (k === i ? n : x))), `Peso do dia ${i + 1}`)}</div>
                <div style={{ fontSize: 12, color: PINK, marginTop: 4, textTransform: 'none' }}>{brl(dayAmt[i] ?? 0)}</div></th>)}
              <th style={th}>Total closer</th></tr></thead>
            <tbody>{closers.map((c, ci) => (
              <tr key={c.id}><td style={{ padding: '0 6px', whiteSpace: 'nowrap' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar c={c} size={26} /><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.name.split(' ')[0]}</span>
                {wInput(wc[ci], n => setWc(w => w.map((x, k) => (k === ci ? n : x))), `Peso de ${c.name}`)}</div></td>
                {days.map((_, i) => <td key={i} style={{ textAlign: 'center', fontSize: 13, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{brl(cellAmt[i]?.[ci] ?? 0)}</td>)}
                <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{brl(cellAmt.reduce((a, row) => a + (row[ci] ?? 0), 0))}</td></tr>))}</tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button disabled={!total} style={{ ...btnPrimary, opacity: total ? 1 : .5 }} onClick={() => {
            const dm: Record<number, number> = {}; dayAmt.forEach((a, i) => (dm[i] = a))
            const cells: Draft['cells'] = {}, ct: Draft['closerTotals'] = {}
            closers.forEach((c, ci) => { cells[c.id] = {}; let s = 0; days.forEach((_, i) => { const v = cellAmt[i]?.[ci] ?? 0; cells[c.id][i] = v; s += v }); ct[c.id] = Math.round(s * 100) / 100 })
            onApply({ total, days: dm, closerTotals: ct, cells })
          }}>Aplicar na grade (substitui os valores atuais)</button></div>
      </div>
    </div>
  )
}
