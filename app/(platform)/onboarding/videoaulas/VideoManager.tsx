'use client'
import { useState } from 'react'
import { Plus, X, Link as LinkIcon } from 'lucide-react'
import { createVideo } from '../actions'

function extractThumbnail(url: string): string {
  try {
    const u = new URL(url)
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId = ''
      if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1)
      } else {
        videoId = u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? ''
      }
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://vumbnail.com/${id}.jpg`
    }
    // Loom
    if (u.hostname.includes('loom.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://cdn.loom.com/sessions/thumbnails/${id}-with-play.gif`
    }
  } catch {}
  return ''
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6,
}

export function VideoManager({ mode }: { mode: 'create' }) {
  const [open, setOpen]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [videoUrl, setVideoUrl]   = useState('')
  const [thumbPreview, setThumbPreview] = useState('')

  function handleUrlChange(url: string) {
    setVideoUrl(url)
    if (url) {
      const auto = extractThumbnail(url)
      if (auto) setThumbPreview(auto)
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    // Se não tiver thumbnail manual mas tiver auto, usa a auto
    if (!formData.get('thumbnail_url') && thumbPreview) {
      formData.set('thumbnail_url', thumbPreview)
    }
    await createVideo(formData)
    setLoading(false)
    setOpen(false)
    setVideoUrl('')
    setThumbPreview('')
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 10, background: 'var(--foreground)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
        <Plus size={15} /> Nova videoaula
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Nova videoaula</h2>
              <button onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Título *</label>
                <input name="title" required placeholder="Título da videoaula" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea name="description" rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>URL do vídeo *</label>
                <input name="url" required type="url"
                  placeholder="YouTube, Vimeo, Loom, Google Drive..."
                  value={videoUrl}
                  onChange={e => handleUrlChange(e.target.value)}
                  style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>
                  A thumbnail será extraída automaticamente do YouTube, Vimeo e Loom.
                </p>
              </div>

              {/* Preview da thumbnail automática */}
              {thumbPreview && (
                <div>
                  <label style={labelStyle}>Thumbnail detectada automaticamente</label>
                  <img src={thumbPreview} alt="thumbnail" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', objectFit: 'cover', maxHeight: 160 }} />
                </div>
              )}

              <div>
                <label style={labelStyle}>Thumbnail personalizada (URL) — opcional</label>
                <input name="thumbnail_url" type="url" placeholder="https://... (substitui a automática)"
                  style={inputStyle}
                  onChange={e => e.target.value && setThumbPreview(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Time</label>
                  <div style={{ position: 'relative' }}>
                    <select name="team" style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: 36 }}>
                      <option value="ambos">Ambos</option>
                      <option value="OAO">OAO</option>
                      <option value="R1">R1</option>
                    </select>
                    <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Duração (min)</label>
                  <input name="duration_min" type="number" placeholder="Ex: 15" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button type="button" onClick={() => setOpen(false)}
                  style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 1, height: 42, borderRadius: 10, background: 'var(--foreground)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
