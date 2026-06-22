'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, HelpCircle, CheckSquare, ChevronDown, ChevronUp,
  Pencil, Trash2, X, Check, ExternalLink, Play,
  CheckCircle2, Circle, Lock, ArrowRight, Plus
} from 'lucide-react'
import { MaterialsManager, FaqManager, QuizManager } from './MaterialsManager'
import { submitQuiz } from '../../actions'

// ── Embed helpers ─────────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be'))    return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`
    if (u.hostname.includes('youtube.com')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1&rel=0`
    if (u.hostname.includes('vimeo.com'))   return `https://player.vimeo.com/video/${u.pathname.split('/').pop()}?autoplay=1`
    if (u.hostname.includes('loom.com'))    return `https://www.loom.com/embed/${u.pathname.split('/').pop()}?autoplay=1`
    if (u.hostname.includes('drive.google.com')) {
      const id = u.pathname.match(/\/d\/([^/]+)/)?.[1]
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
    if (u.hostname.includes('docs.google.com')) return url.replace('/edit', '/preview').replace('/pub', '/preview')
  } catch {}
  return null
}

function getThumbnail(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be'))    return `https://img.youtube.com/vi/${u.pathname.slice(1)}/hqdefault.jpg`
    if (u.hostname.includes('youtube.com')) return `https://img.youtube.com/vi/${u.searchParams.get('v')}/hqdefault.jpg`
    if (u.hostname.includes('vimeo.com'))   return `https://vumbnail.com/${u.pathname.split('/').pop()}.jpg`
    if (u.hostname.includes('loom.com'))    return `https://cdn.loom.com/sessions/thumbnails/${u.pathname.split('/').pop()}-with-play.gif`
  } catch {}
  return ''
}

const typeConfig: Record<string, { color: string; label: string }> = {
  video:        { color: '#ef4444', label: '🎬 Vídeo' },
  pdf:          { color: '#f59e0b', label: '📑 PDF' },
  documento:    { color: '#3b82f6', label: '📄 Documento' },
  apresentacao: { color: '#8b5cf6', label: '📊 Apresentação' },
  site:         { color: '#6366f1', label: '🌐 Site' },
  outro:        { color: '#6b7280', label: '📎 Arquivo' },
}

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 9,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}

function StyledSelectInline({ name, defaultValue, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <select name={name} defaultValue={defaultValue ?? ''}
        style={{ ...inp, paddingRight: 28, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

function CheckButton({ checked, onClick, label }: { checked: boolean; onClick: (e: React.MouseEvent) => void; label: string }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 9, border: `1.5px solid ${checked ? '#22c55e' : 'var(--border)'}`, background: checked ? 'rgba(34,197,94,0.1)' : 'var(--secondary)', color: checked ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.18s', boxShadow: checked ? '0 2px 8px rgba(34,197,94,0.2)' : 'var(--shadow-xs)' }}
      title={checked ? 'Clique para desmarcar' : 'Clique para marcar como concluído'}>
      {checked ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> : <Circle size={14} />}
      {checked ? 'Concluído' : label}
    </button>
  )
}

// ── MaterialCardInline ────────────────────────────────────────
function MaterialCardInline({ mat, isAdmin, onDeleted, onUpdated, onCheck, allSteps = [] }: any) {
  const [playing,  setPlaying]  = useState(false)
  const [checked,  setChecked]  = useState(mat.checked ?? false)
  const [deleting, setDeleting] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [selStep,  setSelStep]  = useState<string>(mat.step_id ?? '')

  const thumb    = getThumbnail(mat.url)
  const embedUrl = getEmbedUrl(mat.url)
  const tc       = typeConfig[mat.type] ?? typeConfig.outro

  async function handleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !checked
    setChecked(next)
    onCheck(mat.id, next)
    await fetch('/api/onboarding/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'material', id: mat.id, completed: next }) })
  }

  async function handleDelete() {
    setSaving(true)
    await fetch('/api/admin/materials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mat.id }) })
    onDeleted(mat.id)
    setSaving(false)
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload: any = { id: mat.id, title: fd.get('title'), description: (fd.get('description') as string) || null, url: fd.get('url'), type: fd.get('type'), step_id: selStep || mat.step_id }
    const res = await fetch('/api/admin/materials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { onUpdated({ ...mat, ...payload, step_id: selStep || mat.step_id }); setEditing(false) }
    setSaving(false)
  }

  if (editing) return (
    <div style={{ background: 'var(--card)', border: '1.5px solid rgba(99,102,241,0.3)', borderRadius: 13, padding: '14px 16px', boxShadow: '0 4px 14px rgba(79,70,229,0.08)' }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>✏️ Editando material</p>
      <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Título *</label><input name="title" required defaultValue={mat.title} style={inp} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</label><textarea name="description" defaultValue={mat.description ?? ''} rows={2} style={{ ...inp, height: 'auto', padding: '7px 12px', resize: 'vertical' }} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>URL *</label><input name="url" required defaultValue={mat.url} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</label>
            <StyledSelectInline name="type" defaultValue={mat.type}><option value="video">🎬 Vídeo</option><option value="documento">📄 Documento</option><option value="pdf">📑 PDF</option><option value="apresentacao">📊 Apresentação</option><option value="site">🌐 Site</option><option value="outro">📎 Outro</option></StyledSelectInline>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Etapa da trilha</label>
            <div style={{ position: 'relative' }}>
              <select value={selStep} onChange={e => setSelStep(e.target.value)} style={{ ...inp, paddingRight: 28, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', fontSize: 12 }}>
                {[...allSteps].sort((a: any, b: any) => { if (a.day_number === b.day_number) return a.title.localeCompare(b.title); if (a.day_number === null) return 1; if (b.day_number === null) return -1; return a.day_number - b.day_number }).map((s: any) => (<option key={s.id} value={s.id}>{s.day_number !== null ? `Dia ${s.day_number} - ${s.title}` : s.title}</option>))}
              </select>
              <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={() => setEditing(false)} style={{ height: 32, padding: '0 13px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? '...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )

  if (deleting) return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 13, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{mat.title}"</strong>?</p>
      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={() => setDeleting(false)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={handleDelete} disabled={saving} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
      </div>
    </div>
  )

  return (
    <>
      {playing && embedUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && setPlaying(false)}>
          <div style={{ width: '100%', maxWidth: 900, background: 'var(--card)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{mat.title}</p>
              <button onClick={() => setPlaying(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}><X size={14} /></button>
            </div>
            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
              <iframe src={embedUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen" allowFullScreen />
            </div>
          </div>
        </div>
      )}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', transition: 'all 0.15s', boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', opacity: checked ? 0.65 : 1 }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = tc.color + '50'; el.style.boxShadow = `0 4px 16px ${tc.color}12, var(--shadow-sm)` }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'var(--shadow-xs)' }}>
        <div style={{ height: 4, background: tc.color, flexShrink: 0 }} />
        {thumb && mat.type === 'video' && (
          <div onClick={() => setPlaying(true)} style={{ position: 'relative', height: 130, cursor: 'pointer', background: '#000', overflow: 'hidden', flexShrink: 0 }}>
            <img src={thumb} alt={mat.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={17} style={{ color: '#111', marginLeft: 2 }} />
              </div>
            </div>
          </div>
        )}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7, minHeight: 20 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: tc.color + '18', color: tc.color }}>{tc.label}</span>
            {mat.day_number && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff' }}>Dia {mat.day_number}</span>}
            {checked && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>✓ Concluído</span>}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px', lineHeight: 1.4 }}>{mat.title}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5, flex: 1, minHeight: 0 }}>{mat.description ?? ''}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <button onClick={() => embedUrl ? setPlaying(true) : window.open(mat.url, '_blank')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>
              {mat.type === 'video' ? <><Play size={10} /> Assistir</> : <><ExternalLink size={10} /> Abrir</>}
            </button>
            {isAdmin && (
              <>
                <button onClick={() => setEditing(true)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}><Pencil size={11} /></button>
                <button onClick={() => setDeleting(true)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}><Trash2 size={11} /></button>
              </>
            )}
            {!isAdmin && (<div style={{ marginLeft: 'auto' }}><CheckButton checked={checked} onClick={handleCheck} label="Marcar concluído" /></div>)}
          </div>
        </div>
      </div>
    </>
  )
}

// ── FaqCard ───────────────────────────────────────────────────
function FaqCard({ faq, isAdmin, expanded, onToggle, onDeleted, onUpdated }: any) {
  const [editing,  setEditing]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function handleDelete() { setSaving(true); await fetch('/api/admin/faqs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: faq.id }) }); onDeleted(faq.id); setSaving(false) }
  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = { id: faq.id, question: fd.get('question'), answer: fd.get('answer') }
    const res = await fetch('/api/admin/faqs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { onUpdated({ ...faq, ...payload }); setEditing(false) }
    setSaving(false)
  }

  if (editing) return (
    <div style={{ background: 'var(--card)', border: '1.5px solid rgba(99,102,241,0.3)', borderRadius: 13, padding: '14px 16px' }}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pergunta *</label><input name="question" required defaultValue={faq.question} style={inp} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resposta *</label><textarea name="answer" required defaultValue={faq.answer} rows={5} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical', lineHeight: 1.6 }} /></div>
        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setEditing(false)} style={{ height: 32, padding: '0 13px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? '...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )

  if (deleting) return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir esta FAQ?</p>
      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={() => setDeleting(false)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={handleDelete} disabled={saving} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, overflow: 'hidden', boxShadow: 'var(--shadow-xs)', transition: 'border-color 0.15s' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.2)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onToggle} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{faq.question}</span>
          {expanded ? <ChevronUp size={14} style={{ color: '#6366f1', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />}
        </button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4, paddingRight: 10, flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}><Pencil size={11} /></button>
            <button onClick={() => setDeleting(true)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}><Trash2 size={11} /></button>
          </div>
        )}
      </div>
      {expanded && <div style={{ padding: '10px 16px 14px', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.65, borderTop: '1px solid var(--border)' }}>{faq.answer}</div>}
    </div>
  )
}

// ── StepDetail principal ──────────────────────────────────────
export function StepDetail({
  step, materials: initMaterials, faqs: initFaqs, questions: initQuestions,
  isAdmin, stepId, userProgress, checkedMaterials: initChecked = [],
  trailMode = 'livre', nextStep, userName, userAvatarUrl, allSteps = [],
}: any) {
  const router       = useRouter()
  const s            = step
  const isSequential = trailMode === 'sequencial'

  const [activeTab,   setActiveTab]   = useState<'materiais'|'faqs'|'quiz'>('materiais')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const [materials,   setMaterials]   = useState(initMaterials.map((m: any) => ({ ...m, checked: initChecked.includes(m.id) })))
  const [faqs,        setFaqs]        = useState(initFaqs)

  // ── CORREÇÃO 1: questions agora é estado local ──────────────
  // Antes era prop estática — agora atualiza em tempo real ao adicionar/remover
  const [localQuestions, setLocalQuestions] = useState(initQuestions ?? [])

  const [checkedSet,      setCheckedSet]      = useState<Set<string>>(new Set(initChecked))
  const allMaterialsChecked = materials.length === 0 || materials.every((m: any) => checkedSet.has(m.id))

  const alreadyPassed  = userProgress?.status === 'concluido' || userProgress?.quiz_score >= s.min_quiz_score
  const [quizFinished, setQuizFinished] = useState(alreadyPassed)
  const [quizScore,    setQuizScore]    = useState(userProgress?.quiz_score ?? 0)
  const [quizStarted,  setQuizStarted]  = useState(false)
  const [currentQ,     setCurrentQ]     = useState(0)
  const [selectedAns,  setSelectedAns]  = useState<Record<string,string>>({})
  const [submitting,   setSubmitting]   = useState(false)
  const [showExpl,     setShowExpl]     = useState(false)

  function handleMaterialCheck(id: string, checked: boolean) {
    setCheckedSet(prev => { const s = new Set(prev); checked ? s.add(id) : s.delete(id); return s })
    setMaterials((prev: any) => prev.map((m: any) => m.id === id ? { ...m, checked } : m))
  }

  const canAdvance = !isSequential || (allMaterialsChecked && quizFinished && quizScore >= s.min_quiz_score)

  function selectAnswer(qId: string, aId: string) { setSelectedAns(prev => ({ ...prev, [qId]: aId })); setShowExpl(true) }

  function nextQuestion() {
    setShowExpl(false)
    if (currentQ < localQuestions.length - 1) setCurrentQ(q => q + 1)
    else finishQuiz()
  }

  async function finishQuiz() {
    setSubmitting(true)
    // CORREÇÃO: usa localQuestions (estado reativo) em vez da prop original
    const correct = localQuestions.filter((q: any) => {
      const sel = selectedAns[q.id]
      return q.onboarding_answers?.find((a: any) => a.id === sel)?.is_correct
    }).length
    const score  = Math.round((correct / localQuestions.length) * 100)
    const passed = score >= s.min_quiz_score
    setQuizScore(score); setQuizFinished(true)
    await submitQuiz(stepId, selectedAns, score, passed)
    setSubmitting(false)
  }

  function handleNextStep() {
    if (!nextStep) { router.push('/onboarding/trilha'); return }
    router.push(`/onboarding/trilha/${nextStep.id}`)
  }

  const teamColor = s.team === 'OAO' ? '#3b82f6' : s.team === 'R1' ? '#8b5cf6' : '#22c55e'
  const teamGrad  = s.team === 'OAO' ? 'linear-gradient(135deg,#3b82f6,#4f46e5)' : s.team === 'R1' ? 'linear-gradient(135deg,#8b5cf6,#a855f7)' : 'linear-gradient(135deg,#22c55e,#16a34a)'

  // CORREÇÃO: count das tabs usa localQuestions.length (reativo)
  const tabs = [
    { id: 'materiais', label: 'Materiais', icon: FileText,    count: materials.length },
    { id: 'faqs',      label: 'FAQs',      icon: HelpCircle,  count: faqs.length },
    { id: 'quiz',      label: 'Quiz',      icon: CheckSquare, count: localQuestions.length },
  ]

  const currentQuestion = localQuestions[currentQ]
  const selectedAnswer  = currentQuestion ? selectedAns[currentQuestion.id] : null
  const isCorrect       = selectedAnswer && currentQuestion?.onboarding_answers?.find((a: any) => a.id === selectedAnswer)?.is_correct

  return (
    <div>
      {/* Header da etapa */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 22px', marginBottom: 16, position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: teamGrad }} />
        <div style={{ paddingTop: 8, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>{s.title}</h1>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `${teamColor}15`, color: teamColor, border: `1px solid ${teamColor}30` }}>{s.team}</span>
              {s.day_number && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: teamGrad, color: '#fff' }}>Dia {s.day_number}</span>}
              {(userProgress?.status === 'concluido') && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>✓ Concluído</span>}
            </div>
            {s.description && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 8px' }}>{s.description}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {s.estimated_minutes && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>⏱ {s.estimated_minutes} min</span>}
              {localQuestions.length > 0 && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>🎯 Nota mínima: {s.min_quiz_score}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de progresso sequencial */}
      {isSequential && !isAdmin && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {allMaterialsChecked ? <CheckCircle2 size={15} style={{ color: '#22c55e' }} /> : <Circle size={15} style={{ color: 'var(--muted-foreground)' }} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: allMaterialsChecked ? '#16a34a' : 'var(--muted-foreground)' }}>
              {allMaterialsChecked ? 'Materiais concluídos' : `Materiais: ${Array.from(checkedSet).filter(id => materials.some((m: any) => m.id === id)).length}/${materials.length}`}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {quizFinished && quizScore >= s.min_quiz_score ? <CheckCircle2 size={15} style={{ color: '#22c55e' }} /> : <Circle size={15} style={{ color: 'var(--muted-foreground)' }} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: quizFinished && quizScore >= s.min_quiz_score ? '#16a34a' : 'var(--muted-foreground)' }}>
              {localQuestions.length > 0 ? (quizFinished ? `Quiz: ${quizScore}%` : 'Quiz pendente') : 'Sem quiz'}
            </span>
          </div>
          {canAdvance && (
            <>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <button onClick={handleNextStep} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 9, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(34,197,94,0.3)', marginLeft: 'auto' }}>
                {nextStep ? `Próxima: ${nextStep.title.slice(0, 25)}${nextStep.title.length > 25 ? '...' : ''}` : 'Finalizar trilha'} <ArrowRight size={12} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: 4, boxShadow: 'var(--shadow-xs)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: 10, border: 'none', background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent', color: active ? '#fff' : 'var(--muted-foreground)', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: active ? '0 4px 12px rgba(79,70,229,0.3)' : 'none' }}>
              <Icon size={13} />
              {tab.label}
              {tab.count > 0 && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: active ? 'rgba(255,255,255,0.25)' : 'var(--secondary)', color: active ? '#fff' : 'var(--muted-foreground)' }}>{tab.count}</span>}
            </button>
          )
        })}
      </div>

      {/* Aba materiais */}
      {activeTab === 'materiais' && (
        <div>
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <MaterialsManager stepId={stepId} allSteps={allSteps} onCreated={(m: any) => setMaterials((prev: any) => [...prev, { ...m, checked: false }])} />
            </div>
          )}
          {materials.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}><p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{isAdmin ? 'Nenhum material ainda. Adicione o primeiro!' : 'Nenhum material disponível nesta etapa.'}</p></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap: 14 }}>
                {materials.map((m: any) => (
                  <MaterialCardInline key={m.id} mat={m} isAdmin={isAdmin} allSteps={allSteps}
                    onCheck={handleMaterialCheck}
                    onDeleted={(id: string) => setMaterials((prev: any) => prev.filter((x: any) => x.id !== id))}
                    onUpdated={(updated: any) => setMaterials((prev: any) => prev.map((x: any) => x.id === updated.id ? { ...updated, checked: x.checked } : x))}
                  />
                ))}
              </div>
          }
        </div>
      )}

      {/* Aba FAQs */}
      {activeTab === 'faqs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <FaqManager stepId={stepId} mode="create" onCreated={(f: any) => setFaqs((prev: any) => [...prev, f])} />
            </div>
          )}
          {faqs.map((f: any) => (
            <FaqCard key={f.id} faq={f} isAdmin={isAdmin} expanded={expandedFaq === f.id}
              onToggle={() => setExpandedFaq(expandedFaq === f.id ? null : f.id)}
              onDeleted={(id: string) => setFaqs((prev: any) => prev.filter((x: any) => x.id !== id))}
              onUpdated={(updated: any) => setFaqs((prev: any) => prev.map((x: any) => x.id === updated.id ? updated : x))}
            />
          ))}
          {faqs.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '24px', textAlign: 'center' }}>Nenhuma FAQ adicionada.</p>}
        </div>
      )}

      {/* Aba Quiz */}
      {activeTab === 'quiz' && (
        <div>
          {isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* CORREÇÃO 2: QuizManager SEMPRE visível, não só quando vazio */}
              {/* CORREÇÃO 3: onCreated adiciona ao estado local imediatamente */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <QuizManager stepId={stepId} mode="create"
                  onCreated={(q: any) => setLocalQuestions((prev: any) => [...prev, q])} />
              </div>
              {localQuestions.map((q: any, qi: number) => (
                <div key={q.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{qi + 1}. {q.question}</p>
                    {/* Botão de remover questão em tempo real */}
                    <button onClick={async () => {
                      await fetch('/api/admin/questions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q.id }) })
                      setLocalQuestions((prev: any) => prev.filter((x: any) => x.id !== q.id))
                    }} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', flexShrink: 0, transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
                      title="Remover questão">
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.onboarding_answers?.map((a: any) => (
                      <div key={a.id} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, background: a.is_correct ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: a.is_correct ? '#16a34a' : 'var(--muted-foreground)', border: `1px solid ${a.is_correct ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}>
                        {a.is_correct ? '✓ ' : ''}{a.answer_text}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '8px 0 0', padding: '7px 12px', background: 'var(--secondary)', borderRadius: 8 }}>💡 {q.explanation}</p>}
                </div>
              ))}
              {localQuestions.length === 0 && <div style={{ textAlign: 'center', padding: '32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}><p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhuma questão ainda. Use o botão acima para adicionar a primeira.</p></div>}
            </div>
          ) : localQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}><p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Quiz ainda não disponível para esta etapa.</p></div>
          ) : quizFinished ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '40px 32px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>{quizScore >= s.min_quiz_score ? '🏆' : '💪'}</div>
              <h2 style={{ fontSize: 30, fontWeight: 900, color: quizScore >= s.min_quiz_score ? '#22c55e' : '#f59e0b', margin: '0 0 8px', letterSpacing: '-0.03em' }}>{quizScore}%</h2>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>{quizScore >= s.min_quiz_score ? 'Aprovado! Você arrasou! 🎉' : 'Continue tentando!'}</p>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 28 }}>Nota mínima: {s.min_quiz_score}%</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { setQuizFinished(false); setQuizStarted(false); setCurrentQ(0); setSelectedAns({}); setShowExpl(false) }} style={{ height: 40, padding: '0 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar novamente</button>
                {canAdvance && <button onClick={handleNextStep} style={{ height: 40, padding: '0 22px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>{nextStep ? 'Próxima etapa' : 'Finalizar trilha'} <ArrowRight size={14} /></button>}
                {!canAdvance && isSequential && !allMaterialsChecked && <div style={{ padding: '8px 14px', borderRadius: 9, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: '#d97706', fontWeight: 600 }}>⚠ Conclua todos os materiais para avançar</div>}
              </div>
            </div>
          ) : !quizStarted ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '40px 32px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}><CheckSquare size={28} style={{ color: '#fff' }} /></div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--foreground)', marginBottom: 8 }}>Quiz — {s.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 8 }}>{localQuestions.length} questões · Nota mínima: {s.min_quiz_score}%</p>
              {isSequential && !allMaterialsChecked && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 20, fontSize: 12, color: '#d97706', fontWeight: 600 }}><Lock size={12} /> Conclua todos os materiais antes de fazer o quiz</div>}
              <br />
              <button onClick={() => setQuizStarted(true)} disabled={isSequential && !allMaterialsChecked}
                style={{ height: 48, padding: '0 36px', borderRadius: 13, background: isSequential && !allMaterialsChecked ? 'var(--secondary)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: isSequential && !allMaterialsChecked ? 'var(--muted-foreground)' : '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: isSequential && !allMaterialsChecked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: isSequential && !allMaterialsChecked ? 'none' : '0 6px 20px rgba(79,70,229,0.4)', marginTop: 8 }}>
                {isSequential && !allMaterialsChecked ? '🔒 Bloqueado' : 'Iniciar Quiz 🚀'}
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Questão {currentQ + 1} de {localQuestions.length}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{Math.round((currentQ / localQuestions.length) * 100)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', width: `${(currentQ / localQuestions.length) * 100}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 18, lineHeight: 1.5 }}>{currentQuestion?.question}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
                {currentQuestion?.onboarding_answers?.map((a: any) => {
                  const isSel = selectedAnswer === a.id, isCorr = a.is_correct
                  let bg = 'var(--secondary)', border = 'var(--border)', color = 'var(--foreground)'
                  if (showExpl && isSel && isCorr)  { bg = 'rgba(34,197,94,0.1)';  border = '#22c55e'; color = '#16a34a' }
                  if (showExpl && isSel && !isCorr) { bg = 'rgba(239,68,68,0.08)'; border = '#ef4444'; color = '#ef4444' }
                  if (showExpl && !isSel && isCorr) { bg = 'rgba(34,197,94,0.06)'; border = 'rgba(34,197,94,0.4)'; color = '#16a34a' }
                  return (
                    <button key={a.id} onClick={() => !selectedAnswer && selectAnswer(currentQuestion.id, a.id)} disabled={!!selectedAnswer}
                      style={{ width: '100%', padding: '11px 15px', borderRadius: 11, border: `1.5px solid ${border}`, background: bg, color, fontSize: 13, fontWeight: isSel ? 700 : 500, cursor: selectedAnswer ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, background: isSel ? border : 'transparent', color: isSel ? 'white' : border }}>
                        {showExpl && isCorr ? '✓' : showExpl && isSel ? '✗' : ''}
                      </span>
                      {a.answer_text}
                    </button>
                  )
                })}
              </div>
              {showExpl && currentQuestion?.explanation && (
                <div style={{ padding: '11px 14px', borderRadius: 11, background: isCorrect ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`, marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: isCorrect ? '#16a34a' : '#ef4444', margin: '0 0 3px', fontWeight: 700 }}>{isCorrect ? '✓ Correto!' : '✗ Errou desta vez'}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>💡 {currentQuestion.explanation}</p>
                </div>
              )}
              {showExpl && (
                <button onClick={nextQuestion} disabled={submitting} style={{ width: '100%', height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
                  {currentQ < localQuestions.length - 1 ? 'Próxima questão →' : submitting ? 'Calculando...' : 'Ver resultado 🏆'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
