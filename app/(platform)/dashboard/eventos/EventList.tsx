'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Pencil, Plus, Trash2, Users, Radio, Play } from 'lucide-react'
import { themeOf, themeVars } from './theme'
import { EV_CSS, Money, GREEN, GOLD, PINK, PURPLE, StatusChip, brl, btnGhost, btnPrimary, cardStyle, fmtRange, pctOf, type EditionSummary } from './shared'

export function EventList({ list, loading, error, onOpen, onEdit, onDuplicate, onNew, onDeleted }: {
  list: EditionSummary[]; loading: boolean; error: string | null
  onOpen: (id: string) => void; onEdit: (id: string) => void; onDuplicate: (id: string) => void; onNew: () => void; onDeleted: () => void
}) {
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function del(id: string) {
    setBusy(true); setErr(null)
    const r = await fetch(`/api/dashboard/event-goals/${id}`, { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    if (!r || !r.ok) { setErr('Não foi possível excluir.'); return }
    setConfirm(null); onDeleted()
  }
  const groups: { key: EditionSummary['status']; title: string }[] = [{ key: 'andamento', title: 'Em andamento' }, { key: 'proximo', title: 'Próximos' }, { key: 'encerrado', title: 'Encerrados' }]
  return (
    <div>
      <style>{EV_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Eventos e metas</h2>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 3 }}>Cadastre cada edição, escolha quem vai e defina as metas em R$.</div></div>
        <button className="ev-btn" onClick={onNew} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Novo evento</button>
      </div>
      {(error || err) && <div style={{ ...cardStyle, padding: 14, color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error ?? err}</div>}
      {loading && !list.length && <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>{[0, 1, 2].map(i => <div key={i} className="ev-skel" style={{ height: 170 }} />)}</div>}
      {!loading && !error && !list.length && (
        <div style={{ ...cardStyle, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 42 }}>🎯</div>
          <h3 style={{ margin: '8px 0 6px', color: 'var(--foreground)', fontSize: 18 }}>Nenhum evento cadastrado ainda</h3>
          <p style={{ margin: '0 auto 18px', maxWidth: 420, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Crie o primeiro evento, escolha os closers que vão e defina as metas. Nos próximos anos é só duplicar a edição anterior.</p>
          <button onClick={onNew} style={btnPrimary}>Criar primeiro evento</button></div>)}
      {groups.map(g => { const items = list.filter(e => e.status === g.key); if (!items.length) return null; return (
        <section key={g.key} style={{ marginBottom: 26 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{g.title} · {items.length}</h3>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))' }}>
            {items.map((e, i) => { const p = pctOf(e.realized, e.goalTotal); const hit = p !== null && p >= 100; const th = themeOf(e.vertical); return (
              <motion.div key={e.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30, delay: i * 0.05 }}
                className="ev-card" style={{ ...themeVars(th), ...cardStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: e.status === 'andamento' ? `1px solid ${GREEN}66` : cardStyle.border }}>
                <div style={{ position: 'relative', overflow: 'hidden', background: th.hero, color: '#fff', padding: '16px 16px 14px', minHeight: 86 }}>
                  <div aria-hidden className="ev-drift" style={{ position: 'absolute', inset: 0, backgroundImage: th.pattern }} />
                  {th.mascot && <img src={th.mascot} alt="" className="ev-ava" style={{ position: 'absolute', right: 10, bottom: -6, height: 84, objectFit: 'contain', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.4))' }} />}
                  <div style={{ position: 'relative', paddingRight: th.mascot ? 80 : 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{e.name}</div>
                    <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>{fmtRange(e.start_date, e.end_date)} · <Users size={11} style={{ verticalAlign: -1 }} /> {e.closersCount}{e.vertical ? ` · ${th.label}` : ''}</div>
                    <div style={{ marginTop: 8 }}><StatusChip status={e.status} /></div>
                  </div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}><Money value={e.realized} /></span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: hit ? GREEN : 'var(--muted-foreground)' }}>{p === null ? 'sem meta' : Math.floor(p) + '%'}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{e.goalTotal !== null ? `meta ${brl(e.goalTotal)} · ` : ''}{e.salesCount} vendas</div>
                    <div style={{ height: 7, borderRadius: 99, background: 'var(--secondary)', overflow: 'hidden', marginTop: 8 }}>
                      <motion.div className="ev-bar" initial={{ width: 0 }} animate={{ width: `${Math.min(100, p ?? 0)}%` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%', borderRadius: 99, background: hit ? `linear-gradient(90deg,${GREEN},${GOLD})` : `linear-gradient(90deg,${PURPLE},${PINK})` }} /></div></div>
                  {confirm === e.id
                    ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#ef4444' }}>Excluir “{e.name}” e suas metas?
                      <button className="ev-btn" disabled={busy} onClick={() => del(e.id)} style={{ ...btnGhost, color: '#ef4444', border: '1px solid #ef444466', padding: '6px 10px' }}>Sim, excluir</button>
                      <button className="ev-btn" onClick={() => setConfirm(null)} style={{ ...btnGhost, padding: '6px 10px' }}>Não</button></div>
                    : <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      <button className="ev-btn" onClick={() => onOpen(e.id)} style={{ ...btnPrimary, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{e.status === 'andamento' ? <Radio size={14} /> : <Play size={14} />} {e.status === 'andamento' ? 'Ao vivo' : 'Abrir'}</button>
                      <button className="ev-btn" onClick={() => onEdit(e.id)} style={{ ...btnGhost, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Pencil size={13} /> Editar</button>
                      <button className="ev-btn" onClick={() => onDuplicate(e.id)} title="Criar nova edição com os mesmos closers e metas" style={{ ...btnGhost, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Copy size={13} /> Duplicar</button>
                      <button className="ev-btn" onClick={() => setConfirm(e.id)} aria-label="Excluir" style={{ ...btnGhost, padding: '8px 10px', marginLeft: 'auto' }}><Trash2 size={13} /></button></div>}
                </div>
              </motion.div>) })}
          </div></section>) })}
    </div>
  )
}
