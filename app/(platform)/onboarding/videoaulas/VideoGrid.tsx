'use client'
import { useState, useMemo } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Play, X, CheckCircle2, Circle, Filter, Pencil, Trash2 } from 'lucide-react'

function getEmbed(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be'))    return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`
    if (u.hostname.includes('youtube.com')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1&rel=0`
    if (u.hostname.includes('vimeo.com'))   return `https://player.vimeo.com/video/${u.pathname.split('/').pop()}?autoplay=1`
    if (u.hostname.includes('loom.com'))    return `https://www.loom.com/embed/${u.pathname.split('/').pop()}?autoplay=1`
    if (u.hostname.includes('drive.google.com')) { const id = u.pathname.match(/\/d\/([^/]+)/)?.[1]; if (id) return `https://drive.google.com/file/d/${id}/preview` }
  } catch {}
  return url
}

function getThumb(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be'))    return `https://img.youtube.com/vi/${u.pathname.slice(1)}/hqdefault.jpg`
    if (u.hostname.includes('youtube.com')) { const id = u.searchParams.get('v'); if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg` }
    if (u.hostname.includes('vimeo.com'))   return `https://vumbnail.com/${u.pathname.split('/').pop()}.jpg`
    if (u.hostname.includes('loom.com'))    return `https://cdn.loom.com/sessions/thumbnails/${u.pathname.split('/').pop()}-with-play.gif`
  } catch {}
  return ''
}

const inp: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 11px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 12, fontFamily: 'inherit', outline: 'none',
}


// ── VideoCard individual ──────────────────────────────────────
function VideoCard({ video, type, allSteps = [], isAdmin, onCheck, onUpdated, onDeleted }: {
  video: any; type: 'trail' | 'avulso'
  allSteps?: { id: string; title: string; day_number: number | null }[]
  isAdmin: boolean
  onCheck:   (id: string, v: boolean) => void
  onUpdated: (v: any) => void
  onDeleted: (id: string) => void
}) {
  const [playing,  setPlaying]  = useState(false)
  const [checked,  setChecked]  = useState(video.checked ?? false)
  const [editing,  setEditing]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editErr,  setEditErr]  = useState('')
  const [selStep,  setSelStep]  = useState<string>((video as any).step_id ?? 'avulso')
  const [editTeam, setEditTeam] = useState((video as any).team ?? 'ambos')

  const thumb = video.thumbnail_url || getThumb(video.url ?? '')

  const sortedSteps = [...allSteps].sort((a, b) => {
    if (a.day_number === b.day_number) return a.title.localeCompare(b.title)
    if (a.day_number === null) return 1
    if (b.day_number === null) return -1
    return a.day_number - b.day_number
  })

  async function toggleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !checked; setChecked(next); onCheck(video.id, next)
    await fetch('/api/onboarding/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: type === 'avulso' ? 'video' : 'material', id: video.id, completed: next }) })
  }

  async function handleDelete() {
    setSaving(true)
    const table = type === 'avulso' ? 'onboarding_videos' : 'onboarding_materials'
    await fetch('/api/admin/videos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: video.id, table }) })
    onDeleted(video.id)
    setSaving(false)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setEditErr('')
    const fd     = new FormData(e.currentTarget)
    const isAv   = selStep === 'avulso'
    const chosen = isAv ? null : allSteps.find(s => s.id === selStep)
    const table  = type === 'avulso' ? 'onboarding_videos' : 'onboarding_materials'

    const payload: any = {
      id: video.id, table,
      title:       fd.get('title'),
      description: (fd.get('description') as string) || null,
      url:         fd.get('url'),
    }
    if (type === 'avulso') payload.team = editTeam
    if (type === 'trail')  { payload.type = (video as any).type ?? 'video'; payload.step_id = isAv ? null : selStep }

    const res  = await fetch('/api/admin/videos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setEditErr(data.error ?? 'Erro ao salvar'); setSaving(false); return }

    onUpdated({
      ...video, ...payload,
      thumbnail_url: getThumb(payload.url) || video.thumbnail_url,
      stepInfo: chosen ? { id: chosen.id, title: chosen.title, day_number: chosen.day_number } : null,
    })
    setEditing(false); setSaving(false)
  }

  const stepInfo = (video as any).stepInfo
  const teamLabel = type === 'avulso' ? ((video as any).team === 'ambos' ? 'Ambos' : `Time ${(video as any).team}`) : (stepInfo?.team === 'ambos' ? 'Ambos' : `Time ${stepInfo?.team ?? ''}`)

  if (editing) return (
    <div style={{ background: 'var(--card)', border: '1.5px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>✏️ Editando vídeo</p>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {editErr && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {editErr}</p>}
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Título *</label><input name="title" required defaultValue={video.title} style={inp} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</label><textarea name="description" defaultValue={video.description ?? ''} rows={2} style={{ ...inp, height: 'auto', padding: '7px 11px', resize: 'vertical', lineHeight: 1.5 }} /></div>
        <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>URL *</label><input name="url" required defaultValue={video.url} style={inp} /></div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vincular à trilha</label>
          <div style={{ position: 'relative' }}>
            <select value={selStep} onChange={e => setSelStep(e.target.value)}
              style={{ ...inp, paddingRight: 28, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
              <option value="avulso">Sem vínculo (avulso)</option>
              {sortedSteps.map(s => (
                <option key={s.id} value={s.id}>{s.day_number !== null ? `Dia ${s.day_number} - ${s.title}` : s.title}</option>
              ))}
            </select>
            <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>

        {type === 'avulso' && (
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</label>
            <div style={{ position: 'relative' }}>
              <select value={editTeam} onChange={e => setEditTeam(e.target.value)} style={{ ...inp, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
                <option value="ambos">Ambos</option><option value="OAO">OAO</option><option value="R1">R1</option>
              </select>
              <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={() => setEditing(false)} style={{ height: 32, padding: '0 13px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? '...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )

  if (deleting) return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 13, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{video.title}"</strong>?</p>
      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={() => setDeleting(false)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={handleDelete} disabled={saving} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>Excluir</button>
      </div>
    </div>
  )

  return (
    <>
      {playing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setPlaying(false)}>
          <div style={{ width: '100%', maxWidth: 900, background: 'var(--card)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{video.title}</p>
              <button onClick={() => setPlaying(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}><X size={15} /></button>
            </div>
            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
              <iframe src={getEmbed(video.url)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen" allowFullScreen />
            </div>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', transition: 'all 0.18s', opacity: checked ? 0.65 : 1 }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; el.style.transform = 'translateY(-2px)'; el.style.borderColor = 'rgba(99,102,241,0.3)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'none'; el.style.transform = 'none'; el.style.borderColor = 'var(--border)' }}>

        <div onClick={() => setPlaying(true)} style={{ position: 'relative', height: 160, background: 'color-mix(in srgb,var(--foreground) 8%,var(--card))', cursor: 'pointer', flexShrink: 0 }}>
          {thumb
            ? <img src={thumb} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={22} style={{ color: '#6366f1', marginLeft: 3 }} />
                </div>
              </div>
          }
          {checked && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Assistido</div>}
          <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>{teamLabel}</div>
          {isAdmin && (
            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setEditing(true)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 0.12s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.9)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}><Pencil size={12} /></button>
              <button onClick={() => setDeleting(true)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 0.12s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.9)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}><Trash2 size={12} /></button>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 14px' }}>
          {stepInfo && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepInfo.title}</span>
              {stepInfo.day_number && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff' }}>Dia {stepInfo.day_number}</span>}
            </div>
          )}
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{video.title}</p>
          {video.description && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5 }}>{video.description}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setPlaying(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}><Play size={10} /> Assistir</button>
            <button onClick={toggleCheck} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${checked ? '#22c55e' : 'var(--border)'}`, background: checked ? 'rgba(34,197,94,0.1)' : 'var(--secondary)', color: checked ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {checked ? <><CheckCircle2 size={12} /> Assistido</> : <><Circle size={12} /> Marcar</>}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── VideoGrid principal ───────────────────────────────────────
interface GridProps {
  trailVideos: any[]   // ← props direto, SEM useState aqui
  avulsos:     any[]   // ← props direto, SEM useState aqui
  isAdmin:     boolean
  allSteps?:   { id: string; title: string; day_number: number | null }[]
  onUpdated?:  (v: any, type: 'trail' | 'avulso') => void
  onDeleted?:  (id: string, type: 'trail' | 'avulso') => void
  onChecked?:  (id: string, checked: boolean, type: 'trail' | 'avulso') => void
}

export function VideoGrid({ trailVideos, avulsos, isAdmin, allSteps = [], onUpdated, onDeleted, onChecked }: GridProps) {
  const [filterDay,  setFilterDay]  = useState('todos')
  const [filterStep, setFilterStep] = useState('todos')

  const availableDays = useMemo(() => {
    const days = new Set<number>()
    trailVideos.forEach(v => { if (v.stepInfo?.day_number) days.add(v.stepInfo.day_number) })
    return Array.from(days).sort((a, b) => a - b)
  }, [trailVideos])

  const availableSteps = useMemo(() => {
    const map = new Map<string, string>()
    trailVideos.forEach(v => {
      if (!v.stepInfo) return
      if (filterDay !== 'todos' && String(v.stepInfo.day_number) !== filterDay) return
      map.set(v.stepInfo.id, v.stepInfo.title)
    })
    return Array.from(map.entries())
  }, [trailVideos, filterDay])

  const filteredTrail = useMemo(() => trailVideos.filter(v => {
    if (filterDay  !== 'todos' && String(v.stepInfo?.day_number) !== filterDay)  return false
    if (filterStep !== 'todos' && v.stepInfo?.id !== filterStep) return false
    return true
  }), [trailVideos, filterDay, filterStep])

  function handleDayChange(day: string) { setFilterDay(day); setFilterStep('todos') }
  const hasFilters = filterDay !== 'todos' || filterStep !== 'todos'

  function Section({ title, desc, videos, type }: { title: string; desc: string; videos: any[]; type: 'trail' | 'avulso' }) {
    return (
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>{title}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{desc}</p>
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>{videos.length}</span>
        </div>
        {videos.length === 0
          ? <div style={{ padding: '28px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{type === 'trail' && hasFilters ? 'Nenhum vídeo com esses filtros.' : 'Nenhum vídeo disponível ainda.'}</p>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(260px,100%),1fr))', gap: 16 }}>
              {videos.map(v => (
                <VideoCard key={v.id} video={v} type={type} allSteps={allSteps} isAdmin={isAdmin}
                  onCheck={(id, c) => onChecked?.(id, c, type)}
                  onUpdated={u => onUpdated?.(u, type)}
                  onDeleted={id => onDeleted?.(id, type)}
                />
              ))}
            </div>
        }
      </div>
    )
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', marginBottom: 22, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Filter size={13} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtrar trilha</span>
        </div>
        <CustomSelect value={filterDay} onChange={handleDayChange} minWidth={155} options={[{ value:'todos', label:'Todos os dias' }, ...availableDays.map(d => ({ value:String(d), label:`📅 Dia ${d}` }))]} />
        <CustomSelect value={filterStep} onChange={setFilterStep} minWidth={190} options={[{ value:'todos', label: filterDay==='todos' ? 'Todas as etapas' : `Todas do Dia ${filterDay}` }, ...availableSteps.map(([id,title]) => ({ value:id, label:title }))]} />
        {hasFilters && (
          <button onClick={() => { setFilterDay('todos'); setFilterStep('todos') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <X size={11} /> Limpar
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
          {filteredTrail.length} da trilha · {avulsos.length} avulsos
        </span>
      </div>

      <Section title="📚 Da Trilha" desc="Vídeos vinculados às etapas de aprendizado" videos={filteredTrail} type="trail" />
      <Section title="🎬 Avulsos"  desc="Videoaulas extras e materiais complementares" videos={avulsos} type="avulso" />
    </div>
  )
}
