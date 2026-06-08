'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createVideo } from '../actions'

function extractThumbnail(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return `https://img.youtube.com/vi/${u.pathname.slice(1)}/hqdefault.jpg`
    if (u.hostname.includes('youtube.com')) return `https://img.youtube.com/vi/${u.searchParams.get('v')}/hqdefault.jpg`
    if (u.hostname.includes('vimeo.com')) return `https://vumbnail.com/${u.pathname.split('/').pop()}.jpg`
    if (u.hostname.includes('loom.com')) return `https://cdn.loom.com/sessions/thumbnails/${u.pathname.split('/').pop()}-with-play.gif`
  } catch {}
  return ''
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
}

interface Step { id: string; title: string; day_number: number | null }

export function VideoManager({ mode, steps = [] }: { mode: 'create'; steps?: Step[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [thumbPreview, setThumbPreview] = useState('')

  function handleUrl(url: string) {
    setVideoUrl(url)
    const auto = extractThumbnail(url)
    if (auto) setThumbPreview(auto)
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    if (!formData.get('thumbnail_url') && thumbPreview) formData.set('thumbnail_url', thumbPreview)
    await createVideo(formData)
    setLoading(false)
    setOpen(false)
    setVideoUrl('')
    setThumbPreview('')
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(79,70,229,0.35)', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.45)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.35)' }}>
        <Plus size={14} /> Nova videoaula
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Nova videoaula</h2>
              <button onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                <X size={15} />
              </button>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={label}>Título *</label>
                <input name="title" required placeholder="Título da videoaula" style={inputStyle} />
              </div>
              <div>
                <label style={label}>Descrição</label>
                <textarea name="description" rows={2} style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }} />
              </div>
              <div>
                <label style={label}>URL do vídeo *</label>
                <input name="url" required type="url" value={videoUrl} onChange={e => handleUrl(e.target.value)}
                  placeholder="YouTube, Vimeo, Loom, Google Drive..." style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>Thumbnail extraída automaticamente do YouTube, Vimeo e Loom.</p>
              </div>

              {thumbPreview && (
                <div>
                  <label style={label}>Thumbnail detectada</label>
                  <img src={thumbPreview} alt="thumb" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', objectFit: 'cover', maxHeight: 140 }} />
                </div>
              )}

              <div>
                <label style={label}>Thumbnail personalizada (opcional)</label>
                <input name="thumbnail_url" type="url" placeholder="URL da imagem"
                  style={inputStyle} onChange={e => e.target.value && setThumbPreview(e.target.value)} />
              </div>

              {/* Vinculação com trilha */}
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  📚 Vincular à trilha (opcional)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Etapa da trilha</label>
                    <select name="step_id" style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Sem vínculo (avulso)</option>
                      {steps.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.day_number ? `Dia ${s.day_number} - ` : ''}{s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Dia da sequência</label>
                    <select name="day_number" style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Sem dia</option>
                      {Array.from({ length: 15 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>Dia {d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Time</label>
                  <select name="team" style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    <option value="ambos">Ambos</option>
                    <option value="OAO">OAO</option>
                    <option value="R1">R1</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Duração (min)</label>
                  <input name="duration_min" type="number" placeholder="Ex: 15" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button type="submit" disabled={loading}
                  style={{ flex: 1, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1, boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
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
