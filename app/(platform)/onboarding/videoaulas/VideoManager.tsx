'use client'
import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'

const inp: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

interface DropOption { value: string; label: string; emoji?: string }

function CustomDrop({
  value, onChange, options, placeholder = 'Selecionar...', minW = 160
}: {
  value: string; onChange: (v: string) => void
  options: DropOption[]; placeholder?: string; minW?: number
}) {
  const [open, setOpen] = React.useState(false)
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<React.CSSProperties>({})
  const sel = options.find(o => o.value === value)
  const active = !!value && value !== '' && value !== 'todos' && value !== 'avulso'

  React.useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function toggle() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const dropH = Math.min(options.length * 42 + 8, 280)
    const below  = window.innerHeight - r.bottom - 8
    setPos({
      position: 'fixed',
      left: r.left,
      width: Math.max(r.width, minW),
      zIndex: 9999,
      ...(below < dropH && r.top > dropH
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    })
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button ref={btnRef} type="button" onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, height: 38, padding: '0 12px 0 14px',
          borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          minWidth: minW, whiteSpace: 'nowrap',
          border: `1.5px solid ${open ? '#6366f1' : active ? 'rgba(99,102,241,.35)' : 'var(--border)'}`,
          background: open
            ? 'color-mix(in srgb, rgba(99,102,241,.08), var(--background))'
            : active
            ? 'color-mix(in srgb, rgba(99,102,241,.04), var(--background))'
            : 'var(--background)',
          color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 13, fontWeight: active ? 600 : 400,
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,.1)' : '0 1px 3px rgba(0,0,0,.06)',
          transition: 'all .15s',
        }}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sel?.label ?? placeholder}
        </span>
        <svg style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none',
          color: open || active ? '#6366f1' : 'var(--muted-foreground)' }}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && typeof document !== 'undefined' && (
        <div ref={listRef} style={{
          ...pos,
          background: 'var(--card)',
          border: '1.5px solid rgba(99,102,241,.18)',
          borderRadius: 13,
          boxShadow: '0 16px 48px rgba(0,0,0,.14), 0 4px 12px rgba(99,102,241,.08)',
          overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
        }}>
          <div style={{ padding: '4px 0', animation: 'cdDrop .13s ease' }}>
            <style>{`@keyframes cdDrop{from{opacity:0;transform:translateY(-5px) scale(.97)}to{opacity:1;transform:none}}`}</style>
            {options.map((opt, i) => {
              const isSel = opt.value === value
              return (
                <button key={opt.value} type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  style={{
                    width: '100%', padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: isSel
                      ? 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(124,58,237,.07))'
                      : 'transparent',
                    border: 'none',
                    borderBottom: i < options.length - 1
                      ? '1px solid color-mix(in srgb, var(--border) 50%, transparent)'
                      : 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    fontSize: 13, fontWeight: isSel ? 600 : 400,
                    color: isSel ? '#6366f1' : 'var(--foreground)',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.06)' }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span>{opt.label}</span>
                  {isSel && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
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
  steps?: Step[]
  onCreated?: (v: any) => void
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
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd       = new FormData(e.currentTarget)
    const isAvulso = selStep === 'avulso'
    const chosen   = isAvulso ? null : steps.find(s => s.id === selStep)

    try {
      if (isAvulso) {
        // ── AVULSO → onboarding_videos ──────────────────────────
        const res  = await fetch('/api/admin/videos', {
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
        const data = await res.json().catch(() => ({ error: `Erro HTTP ${res.status}` }))
        if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }

        onCreated?.({ ...data.video, checked: false, stepInfo: null })

      } else {
        // ── TRILHA → onboarding_materials ───────────────────────
        const res  = await fetch('/api/admin/materials', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step_id:     selStep,
            title:       fd.get('title'),
            description: (fd.get('description') as string) || null,
            url,
            type:        'video',
          }),
        })
        const data = await res.json().catch(() => ({ error: `Erro HTTP ${res.status}` }))
        if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }

        onCreated?.({
          ...data.material,
          checked:       false,
          thumbnail_url: thumbPv || getThumb(url) || null,
          stepInfo: chosen ? {
            id:         chosen.id,
            title:      chosen.title,
            day_number: chosen.day_number,
            team:       chosen.team,
          } : null,
        })
      }

      close()
    } catch (err: any) {
      setError('Erro de conexão: ' + (err.message ?? 'tente novamente'))
    } finally {
      setLoading(false)
    }
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
                  {selStep === 'avulso' ? 'Ficará na seção Avulsos' : 'Será vinculada à etapa selecionada'}
                </p>
              </div>
              <button onClick={close} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {error}</p>
                </div>
              )}

              <div>
                <label style={lbl}>Vincular à trilha</label>
                <CustomDrop
                  value={selStep}
                  onChange={setSelStep}
                  placeholder="Sem vínculo (avulso)"
                  minW={280}
                  options={[
                    { value: 'avulso', label: '📎 Sem vínculo (avulso)' },
                    ...sorted.map(s => ({
                      value: s.id,
                      label: s.day_number !== null ? `📅 Dia ${s.day_number} — ${s.title}` : s.title,
                    }))
                  ]}
                />
                {curStep?.day_number != null && (
                  <p style={{ fontSize: 11, color: '#6366f1', marginTop: 4, fontWeight: 600 }}>
                    📅 Será salvo como material de vídeo da etapa (Dia {curStep.day_number})
                  </p>
                )}
                {selStep === 'avulso' && (
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                    Aparecerá na seção "Avulsos" da biblioteca.
                  </p>
                )}
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
                {thumbPv && (
                  <img src={thumbPv} alt="thumb" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 9, marginTop: 8, border: '1px solid var(--border)' }} />
                )}
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>
                  Thumbnail extraída automaticamente do YouTube, Vimeo e Loom.
                </p>
              </div>

              {selStep === 'avulso' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Time</label>
                    <CustomDrop
                      value={team}
                      onChange={setTeam}
                      options={[
                        { value: 'ambos', label: '👥 Ambos os times' },
                        { value: 'OAO',   label: '🔵 Time OAO' },
                        { value: 'R1',    label: '🟣 Time R1' },
                      ]}
                    />
                  </div>
                  <div>
                    <label style={lbl}>Duração (min)</label>
                    <input name="duration_min" type="number" placeholder="Ex: 15" style={inp} onFocus={foc} onBlur={blr} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={close}
                  style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
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
