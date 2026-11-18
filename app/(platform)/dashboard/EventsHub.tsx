'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, ListChecks, Radio } from 'lucide-react'
import { EventsSection } from './EventsSection'
import { EventLive } from './eventos/EventLive'
import { EventList } from './eventos/EventList'
import { EventEditor, draftFromLive, emptyDraft, type Draft } from './eventos/EventEditor'
import { EV_CSS, PINK, PURPLE, type EditionSummary, type LiveData } from './eventos/shared'
import { THEMES, themeVars } from './eventos/theme'

type View = { k: 'live'; id: string } | { k: 'list' } | { k: 'analysis' } | { k: 'edit'; id: string | null; draft: Draft; from?: string }

function HubTab({ cur, id, icon, label, go }: { cur: string; id: string; icon: React.ReactNode; label: string; go: () => void }) {
  return (
    <button role="tab" aria-selected={cur === id} onClick={go} className="ev-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
      color: cur === id ? '#fff' : 'var(--muted-foreground)', background: cur === id ? `linear-gradient(135deg,${PURPLE},${PINK})` : 'transparent' }}>{icon}{label}</button>)
}

/** Seção Eventos (superadmin): metas ao vivo, cadastro de edições e a Análise de Eventos de sempre. */
export function EventsHub({ initialData }: { initialData: any }) {
  const [view, setView] = useState<View | null>(null)
  const [list, setList] = useState<EditionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const first = useRef(true)

  const loadList = useCallback(async (spin = true): Promise<EditionSummary[]> => {
    if (spin) setLoading(true)
    try {
      const r = await fetch('/api/dashboard/event-goals', { cache: 'no-store' }); const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error?.includes('does not exist') || j.error?.includes('schema cache') ? 'As tabelas de metas ainda não foram criadas no banco (rode o arquivo SQL de metas de evento).' : j.error ?? 'Erro ao carregar eventos.'); return [] }
      setError(null); setList(j.editions ?? []); return j.editions ?? []
    } catch { setError('Sem conexão.'); return [] } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadList().then(es => {
    if (!first.current) return; first.current = false
    const live = es.find(e => e.status === 'andamento')
    setView(live ? { k: 'live', id: live.id } : { k: 'list' }) }) }, [loadList])

  // Lista aberta = números andando sozinhos (a cada 15 s), sem piscar a tela
  const inList = view?.k === 'list'
  useEffect(() => { if (!inList) return; const t = setInterval(() => { if (!document.hidden) loadList(false) }, 15000); return () => clearInterval(t) }, [inList, loadList])

  async function openEditor(id: string, duplicate: boolean) {
    setBusy(true)
    try {
      const r = await fetch(`/api/dashboard/event-goals/${id}`, { cache: 'no-store' }); const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Erro ao abrir o evento.'); return }
      setView({ k: 'edit', id: duplicate ? null : id, draft: draftFromLive(j as LiveData, duplicate), from: duplicate ? (j as LiveData).edition.name : undefined })
    } catch { setError('Sem conexão.') } finally { setBusy(false) }
  }

  const liveId = view?.k === 'live' ? view.id : list.find(e => e.status === 'andamento')?.id ?? null
  const tab = view?.k === 'analysis' ? 'analysis' : view?.k === 'live' ? 'live' : 'list'

  return (
    <div style={themeVars(THEMES.default)}>
      <style>{EV_CSS}</style>
      {view?.k !== 'edit' && (
        <div role="tablist" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 20, maxWidth: '100%', overflowX: 'auto' }}>
          <HubTab cur={tab} id="live" icon={<Radio size={14} />} label={liveId ? 'Ao vivo' : 'Evento'} go={() => { const id = liveId ?? list[0]?.id; setView(id ? { k: 'live', id } : { k: 'list' }) }} />
          <HubTab cur={tab} id="list" icon={<ListChecks size={14} />} label="Eventos e metas" go={() => { setView({ k: 'list' }); loadList() }} />
          <HubTab cur={tab} id="analysis" icon={<BarChart3 size={14} />} label="Análise" go={() => setView({ k: 'analysis' })} />
        </div>)}
      {busy && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>Abrindo…</div>}
      <motion.div key={view ? view.k + (view.k === 'live' ? view.id : '') : 'x'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        {!view && <div className="ev-skel" style={{ height: 220 }} />}
        {view?.k === 'analysis' && <EventsSection initialData={initialData} />}
        {view?.k === 'live' && <EventLive key={view.id} editionId={view.id} onEdit={() => openEditor(view.id, false)} />}
        {view?.k === 'list' && <EventList list={list} loading={loading} error={error}
          onOpen={id => setView({ k: 'live', id })} onEdit={id => openEditor(id, false)} onDuplicate={id => openEditor(id, true)}
          onNew={() => setView({ k: 'edit', id: null, draft: emptyDraft() })} onDeleted={() => loadList()} />}
        {view?.k === 'edit' && <EventEditor key={view.id ?? 'novo' + (view.from ?? '')} editionId={view.id} initial={view.draft} duplicatedFrom={view.from}
          onCancel={() => { setView({ k: 'list' }); loadList() }}
          onSaved={async id => { await loadList(); setView({ k: 'live', id }) }} />}
      </motion.div>
    </div>
  )
}
