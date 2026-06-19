'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

const inp: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

function SS({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inp, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
        onFocus={foc} onBlur={blr}>
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
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

interface Step { id: string; title: string; day_number: number | null; team: string }

export function VideoManager({ steps = [], onCreated }: {
  steps?: Step[]; onCreated?: (v: any) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [url,     setUrl]     = useState('')
  const [thumbPv, setThumbPv] = useState('')
  const [team,    setTeam]    = useState('ambos')
  const [selStep, setSelStep] = useState('avulso')

  const sorted = [...steps].sort((a, b) => {
    if (a.day_number === b.day_number) return a.title.localeCompare(b.title)
    if (a.day_number === null) return 1
    if (b.day_number === null) return -1
    return a.day_number - b.day_number
  })

  function handleUrl(v: string) { setUrl(v); const t = getThumb(v); if (t) setThumbPv(t) }
  function close() { setOpen(false); setUrl(''); setThumbPv(''); setSelStep('avulso'); setTeam('ambos'); setError('') }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd      = new FormData(e.currentTarget)
    const isAvulso = selStep === 'avulso'
    const chosen  = isAvulso ? null : steps.find(s => s.id === selStep)

    let res: Response, data: any

    if (isAvulso) {
      // Avulso → salva em onboarding_videos (sem step_id, sem day_number)
      res  = await fetch('/api/admin/videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         fd.get('title'),
          description:   (fd.get('description') as string) || null,
          url,
          thumbnail_url: thumbPv || getThumb(url) || null,
          team,
          duration_min:  fd.get('duration_min') ? Number(fd.get('duration_min')) : null,
        }),
      })
      data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }

      // Retorna como avulso — vai para lista de avulsos
      onCreated?.({ ...data.video, checked: false, stepInfo: null })
    } else {
      // Vinculado à etapa → salva em onboarding_materials (sem thumbnail_url, sem day_number)
      res  = await fetch('/api/admin/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_id:     selStep,
          title:       fd.get('title'),
          description: (fd.get('description') as string) || null,
          url,
          type:        'video',
        }),
      })
      data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }

      // Retorna como vídeo da trilha — vai para lista "Da Trilha"
      onCreated?.({
        ...data.material,
        checked:       false,
        thumbnail_url: thumbPv || getThumb(url) || null,
        stepInfo:      chosen ? { id: chosen.id, title: chosen.title, day_number: chosen.day_number, team: chosen.team } : null,
      })
    }

    close(); setLoading(false)
  }

  const curStep = selStep !== 'avulso' ? steps.find(s => s.id === selStep) : null

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(79,70,229,0.35)', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.45)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.35)' }}>
        <Plus size={14} /> Nova videoaula
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && close()}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 64px rgba(0,0,0,0.25)' }}>

            <div style={{ background: 'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius: '22px 22px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>Nova videoaula</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '3px 0 0' }}>
                  {selStep === 'avulso' ? 'Ficará na seção Avulsos' : `Vinculada a: ${curStep?.title ?? ''}`}
                </p>
              </div>
              <button onClick={close} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              {error && <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {error}</p></div>}

              {/* Select concatenado: define onde salva */}
              <div>
                <label style={lbl}>Vincular à trilha</label>
                <SS value={selStep} onChange={setSelStep}>
                  <option value="avulso">Sem vínculo (avulso)</option>
                  {sorted.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.day_number !== null ? `Dia ${s.day_number} - ${s.title}` : s.title}
                    </option>
                  ))}
                </SS>
                {selStep === 'avulso'
                  ? <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>Aparecerá na seção "Avulsos" da biblioteca.</p>
                  : curStep?.day_number && <p style={{ fontSize: 11, color: '#6366f1', marginTop: 4, fontWeight: 600 }}>📅 Será vinculada como material de vídeo — Dia {curStep.day_number}</p>
                }
              </div>

              <div>
                <label style={lbl}>Título *</label>
                <input name="title" required placeholder="Título da videoaula" style={inp} onFocus={foc} onBlur={blr} />
              </div>

              <div>
                <label style={lbl}>Descrição</label>
                <textarea name="description" rows={2} style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.55 }} onFocus={foc} onBlur={blr} />
              </div>

              <div>
                <label style={lbl}>URL do vídeo *</label>
                <input name="url" required type="url" value={url} onChange={e => handleUrl(e.target.value)}
                  placeholder="YouTube, Vimeo, Loom, Google Drive..." style={inp} onFocus={foc} onBlur={blr} />
                {thumbPv && <img src={thumbPv} alt="thumb" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 9, marginTop: 8, border: '1px solid var(--border)' }} />}
              </div>

              {selStep === 'avulso' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Time</label>
                    <SS value={team} onChange={setTeam}>
                      <option value="ambos">Ambos</option>
                      <option value="OAO">Time OAO</option>
                      <option value="R1">Time R1</option>
                    </SS>
                  </div>
                  <div>
                    <label style={lbl}>Duração (min)</label>
                    <input name="duration_min" type="number" placeholder="Ex: 15" style={inp} onFocus={foc} onBlur={blr} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={close} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex: 2, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
                  {loading ? 'Salvando...' : 'Adicionar videoaula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
