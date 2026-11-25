'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, Search } from 'lucide-react'
import { Avatar } from '@/app/(platform)/dashboard/eventos/shared'
import { EVENT_MAX_CLOSERS, EVENT_NAME_MAX } from '@/lib/campaigns/event'
import type { EventCfg, Team } from '@/lib/campaigns/types'
import { Btn } from './ui'

// ══ Quem vai ao evento — mesma escolha do cadastro de eventos (Dashboard → Eventos): foto de cada closer, por time ═══
// Só OAO e R1 concorrem em campanhas. Marcar alguém aqui define quem participa E quem recebe os avisos da campanha.

interface Cand { id: string; name: string; avatar_url: string | null; team: string | null; isCloser: boolean }
interface Edition { id: string; name: string; start_date: string; end_date: string; closersCount: number }
const TEAM_UI: { key: Team; label: string; color: string }[] = [{ key: 'OAO', label: 'Time OAO', color: '#6366f1' }, { key: 'R1', label: 'Time R1', color: '#ec4899' }]
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export function EventPicker({ value, onChange, onDates }: {
  value: EventCfg
  /** `counts` = quantos closers escolhidos há em cada time (a tela usa para ligar/desligar o time e sugerir o nº de premiados). */
  onChange: (next: EventCfg, counts: Record<Team, number>) => void
  /** Ao importar um evento já cadastrado, as datas dele (início e fim) — a tela pode aproveitar para as datas da campanha. */
  onDates?: (start: string, end: string) => void
}) {
  const [cands, setCands] = useState<Cand[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [eds, setEds] = useState<Edition[] | null>(null)
  const [edsOpen, setEdsOpen] = useState(false)
  const [edsErr, setEdsErr] = useState<string | null>(null)
  const [busyEd, setBusyEd] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let off = false
    fetch('/api/dashboard/event-goals/options', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (off) return
      if (j?.error) setErr(j.error); else setCands((j.candidates ?? []) as Cand[])
    }).catch(() => !off && setErr('Não consegui carregar a lista de closers.'))
    return () => { off = true }
  }, [])
  useEffect(() => {
    if (!edsOpen) return
    const k = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setEdsOpen(false) }
    document.addEventListener('mousedown', k); return () => document.removeEventListener('mousedown', k)
  }, [edsOpen])

  const teamOf = (id: string): Team | null => { const t = String(cands?.find(c => c.id.toLowerCase() === id)?.team ?? '').trim().toUpperCase(); return t === 'OAO' || t === 'R1' ? t : null }
  const counts = (ids: string[]): Record<Team, number> => { const c: Record<Team, number> = { OAO: 0, R1: 0 }; for (const id of ids) { const t = teamOf(id); if (t) c[t]++ }; return c }
  const emit = (closers: string[], name = value.name) => onChange({ name, closers: closers.slice(0, EVENT_MAX_CLOSERS) }, counts(closers))
  const has = (id: string) => value.closers.includes(id.toLowerCase())
  const toggle = (id: string) => emit(has(id) ? value.closers.filter(x => x !== id.toLowerCase()) : [...value.closers, id.toLowerCase()])

  const visible = useMemo(() => (cands ?? []).filter(c => (showAll || c.isCloser || has(c.id)) && c.name.toLowerCase().includes(q.trim().toLowerCase())), [cands, showAll, q, value.closers]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = value.closers.map(id => cands?.find(c => c.id.toLowerCase() === id) ?? null)
  const unknown = cands ? chosen.filter(c => !c).length : 0

  const openEditions = async () => {
    setEdsOpen(o => !o)
    if (eds || edsErr) return
    try {
      const r = await fetch('/api/dashboard/event-goals', { cache: 'no-store' }); const j = await r.json()
      if (!r.ok || j?.error) setEdsErr(j?.error ?? 'Não consegui listar os eventos.'); else setEds((j.editions ?? []) as Edition[])
    } catch { setEdsErr('Não consegui listar os eventos.') }
  }
  const importEdition = async (e: Edition) => {
    setBusyEd(e.id)
    try {
      const r = await fetch(`/api/dashboard/event-goals/${e.id}`, { cache: 'no-store' }); const j = await r.json()
      if (!r.ok || !j?.closers) { setEdsErr(j?.error ?? 'Não consegui abrir esse evento.'); return }
      const ids = (j.closers as { id: string }[]).map(c => String(c.id).toLowerCase())
      const name = String(j.edition?.name ?? e.name).slice(0, EVENT_NAME_MAX)
      emit(ids, name)
      onDates?.(String(j.edition?.start_date ?? e.start_date).slice(0, 10), String(j.edition?.end_date ?? e.end_date).slice(0, 10))
      setEdsOpen(false)
    } catch { setEdsErr('Não consegui abrir esse evento.') } finally { setBusyEd(null) }
  }

  return (
    <div data-event-picker style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label className="cw-field">
        <span className="cw-label" style={{ display: 'flex', justifyContent: 'space-between' }}>Nome do evento (opcional)<span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}>{value.name.length}/{EVENT_NAME_MAX}</span></span>
        <input className="cp-field" data-f="event-name" value={value.name} maxLength={EVENT_NAME_MAX} placeholder="Ex.: Congresso Brasileiro de Anestesiologia" onChange={e => emit(value.closers, e.target.value)} />
      </label>

      <div className="cw-field">
        <span className="cw-label">Quem vai ao evento · {value.closers.length} {value.closers.length === 1 ? 'closer' : 'closers'}</span>
        {value.closers.length > 0 ? (
          <div data-event-chosen className="cw-ev-sel">
            <div className="cw-ev-stack">{chosen.filter(Boolean).slice(0, 8).map(c => <Avatar key={c!.id} c={c!} size={34} />)}</div>
            <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginLeft: 8 }}>{chosen.filter(Boolean).slice(0, 4).map(c => c!.name.split(' ')[0]).join(', ')}{value.closers.length > 4 ? ` e mais ${value.closers.length - 4}` : ''}</span>
          </div>
        ) : <p className="cw-note" data-event-empty>Ninguém escolhido ainda. Clique nas fotos abaixo — só quem for marcado concorre e recebe os avisos desta campanha.</p>}
      </div>

      <div className="cw-ev-top">
        <div className="cw-ev-search"><Search size={15} /><input className="cp-field" data-f="event-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pelo nome" /></div>
        <label style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> mostrar todos (não só closers)
        </label>
        <div ref={popRef} style={{ position: 'relative' }}>
          <Btn size="sm" data-event-import onClick={openEditions} aria-expanded={edsOpen}><CalendarDays size={14} />Usar um evento cadastrado<ChevronDown size={13} /></Btn>
          {edsOpen && (
            <div className="cw-ev-pop" role="listbox" data-event-list>
              {edsErr && <p className="cw-note cw-note--warn" style={{ margin: 4 }}>{edsErr}</p>}
              {!eds && !edsErr && <p className="cw-note" style={{ margin: 4 }}>Carregando eventos…</p>}
              {eds && eds.length === 0 && <p className="cw-note" style={{ margin: 4 }}>Nenhum evento cadastrado em Dashboard → Eventos.</p>}
              {(eds ?? []).map(e => (
                <button key={e.id} type="button" data-event-ed={e.name} disabled={busyEd !== null} onClick={() => importEdition(e)}>
                  <CalendarDays size={16} style={{ flex: 'none', color: 'var(--muted-foreground)' }} />
                  <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13 }}>{e.name}</b><small>{fmt(e.start_date)} a {fmt(e.end_date)} · {e.closersCount} {e.closersCount === 1 ? 'closer' : 'closers'}</small></span>
                  {busyEd === e.id && <small>abrindo…</small>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {err && <p className="cw-note cw-note--warn">{err}</p>}
      {!cands && !err && <p className="cw-note">Carregando os closers…</p>}
      {unknown > 0 && <p className="cw-note cw-note--warn" data-event-unknown>{unknown} {unknown === 1 ? 'pessoa escolhida não está' : 'pessoas escolhidas não estão'} mais na lista de ativos (ficam de fora da apuração).</p>}

      {cands && (
        <div className="cw-ev-cols">
          {TEAM_UI.map(tm => {
            const col = visible.filter(c => String(c.team ?? '').trim().toUpperCase() === tm.key), sel = col.filter(c => has(c.id)).length
            return (
              <div key={tm.key} className="cw-ev-col" data-event-team={tm.key} style={{ borderColor: `${tm.color}55`, background: `linear-gradient(180deg,${tm.color}12,var(--background) 55%)` }}>
                <div className="cw-ev-col-h">
                  <span style={{ width: 10, height: 10, borderRadius: 4, background: tm.color }} />
                  <b>{tm.label} <small>· {sel}/{col.length}</small></b>
                  {col.length > 0 && <Btn size="sm" onClick={() => emit(sel === col.length ? value.closers.filter(id => !col.some(c => c.id.toLowerCase() === id)) : [...new Set([...value.closers, ...col.map(c => c.id.toLowerCase())])])}>{sel === col.length ? 'Limpar' : 'Marcar todos'}</Btn>}
                </div>
                <div className="cw-ev-grid">
                  {col.map(c => (
                    <button key={c.id} type="button" className="cw-ev-tile" aria-pressed={has(c.id)} data-closer={c.name} onClick={() => toggle(c.id)}>
                      {has(c.id) && <span className="cw-tick"><Check size={11} strokeWidth={3.5} /></span>}
                      <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar c={c} size={52} /></div>
                      <div className="cw-ev-nm">{c.name}</div>
                    </button>
                  ))}
                  {col.length === 0 && <p style={{ gridColumn: '1/-1', margin: 0, padding: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>Ninguém neste time{q ? ' para essa busca' : ''}.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-foreground)' }}>Cada time é apurado separado, como nas outras campanhas — só que entre os closers escolhidos.</p>
    </div>
  )
}
