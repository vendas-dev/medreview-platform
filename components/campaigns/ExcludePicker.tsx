'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Check, Search, Users } from 'lucide-react'
import { Avatar } from '@/app/(platform)/dashboard/eventos/shared'
import { EXCLUDE_MAX } from '@/lib/campaigns/event'
import type { Team } from '@/lib/campaigns/types'
import { Btn } from './ui'

// ══ Quem irá participar? — todos já vêm marcados; clicar na foto tira a pessoa (foto apagada = fica DE FORA) ═══
// Serve para qualquer campanha de times. Ex.: a campanha "de casa", sem quem foi ao evento.

interface Cand { id: string; name: string; avatar_url: string | null; team: string | null; isCloser: boolean }
const TEAM_UI: { key: Team; label: string; color: string }[] = [{ key: 'OAO', label: 'Time OAO', color: '#6366f1' }, { key: 'R1', label: 'Time R1', color: '#ec4899' }]

export function ExcludePicker({ value, teams, onChange, onCounts }: {
  /** ids (minúsculos) de quem fica DE FORA */
  value: string[]
  /** times que participam da campanha (só esses aparecem) */
  teams: Team[]
  /** `counts` = quantos closers continuam participando em cada time */
  onChange: (next: string[], counts: Record<Team, number>) => void
  onCounts?: (counts: Record<Team, number>) => void
}) {
  const [cands, setCands] = useState<Cand[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(value.length > 0)
  const [q, setQ] = useState('')

  useEffect(() => {
    let off = false
    fetch('/api/dashboard/event-goals/options', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (off) return
      if (j?.error) setErr(j.error); else setCands(((j.candidates ?? []) as Cand[]).filter(c => c.isCloser))
    }).catch(() => !off && setErr('Não consegui carregar a lista de closers.'))
    return () => { off = true }
  }, [])

  const teamOf = (c: Cand): Team | null => { const t = String(c.team ?? '').trim().toUpperCase(); return t === 'OAO' || t === 'R1' ? t : null }
  const out = (id: string) => value.includes(id.toLowerCase())
  const countsFor = (excl: string[]): Record<Team, number> => {
    const c: Record<Team, number> = { OAO: 0, R1: 0 }
    for (const p of cands ?? []) { const t = teamOf(p); if (t && !excl.includes(p.id.toLowerCase())) c[t]++ }
    return c
  }
  const emit = (next: string[]) => onChange(next.slice(0, EXCLUDE_MAX), countsFor(next))
  const toggle = (id: string) => emit(out(id) ? value.filter(x => x !== id.toLowerCase()) : [...value, id.toLowerCase()])
  const cKey = cands ? JSON.stringify(countsFor(value)) : ''
  useEffect(() => { if (cands) onCounts?.(JSON.parse(cKey)) }, [cKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownTeams = TEAM_UI.filter(t => teams.includes(t.key))
  const inScope = useMemo(() => (cands ?? []).filter(c => { const t = teamOf(c); return !!t && teams.includes(t) }), [cands, teams]) // eslint-disable-line react-hooks/exhaustive-deps
  const nOut = inScope.filter(c => out(c.id)).length, total = inScope.length
  const outPeople = inScope.filter(c => out(c.id))

  return (
    <div data-exclude-picker className="cw-ex cw-adv" style={{ overflow: 'visible' }}>
      <button type="button" data-exclude-toggle aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Users size={18} style={{ flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>Quem irá participar? <small data-exclude-summary>· {!cands ? 'carregando…' : nOut === 0 ? `todos os ${total} closers` : `${total - nOut} de ${total} · ${nOut} ${nOut === 1 ? 'fica de fora' : 'ficam de fora'}`}</small></span>
        {nOut > 0 && <span className="cw-ev-stack" style={{ marginRight: 4 }}>{outPeople.slice(0, 4).map(c => <span key={c.id} style={{ opacity: .45, filter: 'grayscale(1)' }}><Avatar c={c} size={26} /></span>)}</span>}
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--muted-foreground)' }} />
      </button>
      {open && (
        <div className="cw-adv-b" style={{ gap: 16 }}>
          <p className="cw-note" style={{ margin: 0 }}>Todos começam marcados. <strong>Clique na foto de quem NÃO vai participar</strong> — ela fica apagada, a pessoa não concorre e não recebe nenhum aviso desta campanha.</p>
          {err && <p className="cw-note cw-note--warn">{err}</p>}
          {!cands && !err && <p className="cw-note">Carregando os closers…</p>}
          {cands && (
            <>
              <div className="cw-ev-top">
                <div className="cw-ev-search"><Search size={15} /><input className="cp-field" data-f="exclude-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pelo nome" /></div>
                {nOut > 0 && <Btn size="sm" data-exclude-reset onClick={() => emit([])}>Voltar todos</Btn>}
              </div>
              <div className="cw-ev-cols">
                {shownTeams.map(tm => {
                  const all = inScope.filter(c => teamOf(c) === tm.key), col = all.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase()))
                  const stay = all.filter(c => !out(c.id)).length
                  return (
                    <div key={tm.key} className="cw-ev-col" data-exclude-team={tm.key} style={{ borderColor: `${tm.color}55`, background: `linear-gradient(180deg,${tm.color}12,var(--background) 55%)` }}>
                      <div className="cw-ev-col-h">
                        <span style={{ width: 10, height: 10, borderRadius: 4, background: tm.color }} />
                        <b>{tm.label} <small>· {stay}/{all.length} participam</small></b>
                        {all.length > 0 && <Btn size="sm" onClick={() => emit(stay === 0 ? value.filter(id => !all.some(c => c.id.toLowerCase() === id)) : [...new Set([...value, ...all.map(c => c.id.toLowerCase())])])}>{stay === 0 ? 'Marcar todos' : 'Tirar todos'}</Btn>}
                      </div>
                      <div className="cw-ev-grid">
                        {col.map(c => (
                          <button key={c.id} type="button" className="cw-ev-tile" aria-pressed={!out(c.id)} data-participant={c.name} data-out={out(c.id) ? '1' : '0'} title={out(c.id) ? 'Fora da campanha — clique para voltar' : 'Participa — clique para tirar'} onClick={() => toggle(c.id)}>
                            {!out(c.id) && <span className="cw-tick"><Check size={11} strokeWidth={3.5} /></span>}
                            <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar c={c} size={52} /></div>
                            <div className="cw-ev-nm">{c.name}</div>
                            {out(c.id) && <div className="cw-ex-out">fora</div>}
                          </button>
                        ))}
                        {col.length === 0 && <p style={{ gridColumn: '1/-1', margin: 0, padding: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>Ninguém neste time{q ? ' para essa busca' : ''}.</p>}
                      </div>
                      {all.length > 0 && stay === 0 && <p className="cw-note cw-note--warn" style={{ margin: '10px 0 0' }}>Todo o time {tm.key} está de fora — ninguém concorre nele.</p>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
