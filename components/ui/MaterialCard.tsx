'use client'
import { useState } from 'react'
import { X, ExternalLink, FileText, Play, Globe, File, Presentation } from 'lucide-react'

type FileType = 'video' | 'pdf' | 'drive' | 'site' | 'doc' | 'apresentacao' | 'outro'

function detectType(url: string, declaredType?: string): FileType {
  if (!url) return 'outro'
  const u = url.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com') || u.includes('loom.com')) return 'video'
  if (u.includes('drive.google.com')) return 'drive'
  if (u.endsWith('.pdf') || u.includes('pdf')) return 'pdf'
  if (u.includes('docs.google.com/presentation') || u.includes('slides.google.com')) return 'apresentacao'
  if (u.includes('docs.google.com')) return 'doc'
  if (declaredType === 'video') return 'video'
  if (declaredType === 'pdf') return 'pdf'
  if (declaredType === 'apresentacao') return 'apresentacao'
  if (declaredType === 'documento') return 'doc'
  if (declaredType === 'site') return 'site'
  return 'outro'
}

function getEmbedUrl(url: string, type: FileType): string | null {
  try {
    const u = new URL(url)
    if (type === 'video') {
      if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`
      if (u.hostname.includes('youtube.com')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1&rel=0`
      if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').pop()}?autoplay=1`
      if (u.hostname.includes('loom.com')) return `https://www.loom.com/embed/${u.pathname.split('/').pop()}?autoplay=1`
    }
    if (type === 'drive') {
      const fileId = u.pathname.match(/\/d\/([^/]+)/)?.[1]
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`
    }
    if (type === 'pdf') return url
    if (type === 'doc' || type === 'apresentacao') {
      if (u.hostname.includes('docs.google.com')) {
        return url.replace('/edit', '/preview').replace('/pub', '/preview')
      }
    }
    if (type === 'site') return url
  } catch {}
  return null
}

function getThumbnail(url: string, type: FileType): string | null {
  try {
    const u = new URL(url)
    if (type === 'video') {
      if (u.hostname.includes('youtu.be')) return `https://img.youtube.com/vi/${u.pathname.slice(1)}/hqdefault.jpg`
      if (u.hostname.includes('youtube.com')) return `https://img.youtube.com/vi/${u.searchParams.get('v')}/hqdefault.jpg`
      if (u.hostname.includes('vimeo.com')) return `https://vumbnail.com/${u.pathname.split('/').pop()}.jpg`
      if (u.hostname.includes('loom.com')) return `https://cdn.loom.com/sessions/thumbnails/${u.pathname.split('/').pop()}-with-play.gif`
    }
  } catch {}
  return null
}

const typeConfig: Record<FileType, { icon: any; label: string; color: string; bg: string; canEmbed: boolean }> = {
  video:        { icon: Play,         label: 'Vídeo',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   canEmbed: true },
  pdf:          { icon: FileText,     label: 'PDF',           color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  canEmbed: true },
  drive:        { icon: File,         label: 'Google Drive',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   canEmbed: true },
  doc:          { icon: FileText,     label: 'Documento',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  canEmbed: true },
  apresentacao: { icon: Presentation, label: 'Apresentação',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', canEmbed: true },
  site:         { icon: Globe,        label: 'Site',          color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  canEmbed: true },
  outro:        { icon: File,         label: 'Arquivo',       color: '#7480a0', bg: 'rgba(116,128,160,0.1)', canEmbed: false },
}

interface Props {
  title: string
  url: string
  description?: string | null
  type?: string
  checked?: boolean
  onCheck?: (checked: boolean) => void
  stepTag?: string
  dayTag?: number | null
}

export function MaterialCard({ title, url, description, type, checked, onCheck, stepTag, dayTag }: Props) {
  const [open, setOpen] = useState(false)
  const [localChecked, setLocalChecked] = useState(checked ?? false)

  const fileType = detectType(url, type)
  const cfg = typeConfig[fileType]
  const embedUrl = getEmbedUrl(url, fileType)
  const thumb = getThumbnail(url, fileType)
  const Icon = cfg.icon

  async function toggleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !localChecked
    setLocalChecked(next)
    onCheck?.(next)
  }

  const canOpen = embedUrl || fileType !== 'outro'

  return (
    <>
      {/* Modal inline */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ width: '100%', maxWidth: 920, background: 'var(--card)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} style={{ color: cfg.color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                  {description && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{description}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <ExternalLink size={13} />
                </a>
                <button onClick={() => setOpen(false)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}>
                  <X size={15} />
                </button>
              </div>
            </div>
            {/* Conteúdo */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 300 }}>
              {embedUrl ? (
                fileType === 'video'
                  ? <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
                      <iframe src={embedUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen" allowFullScreen />
                    </div>
                  : <iframe src={embedUrl} style={{ width: '100%', height: '100%', minHeight: 480, border: 'none' }} allowFullScreen />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={28} style={{ color: cfg.color }} />
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Este tipo de arquivo não pode ser visualizado inline.</p>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 20px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                    <ExternalLink size={14} /> Abrir arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', transition: 'all 0.18s', opacity: localChecked ? 0.6 : 1 }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = cfg.color + '50'; el.style.boxShadow = `0 4px 16px ${cfg.color}15`; el.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'none'; el.style.transform = 'none' }}>
        {/* Barra de tipo */}
        <div style={{ height: 3, background: cfg.bg, borderBottom: `1px solid ${cfg.color}20` }}>
          <div style={{ height: '100%', width: '60%', background: cfg.color, borderRadius: '0 999px 999px 0', opacity: 0.7 }} />
        </div>

        {/* Thumbnail se vídeo */}
        {thumb && (
          <div onClick={() => setOpen(true)} style={{ position: 'relative', paddingTop: '45%', cursor: 'pointer', background: '#000', overflow: 'hidden' }}>
            <img src={thumb} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={18} style={{ color: '#111', marginLeft: 3 }} />
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div style={{ padding: '12px 14px' }}>
          {/* Tags */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              <Icon size={9} /> {cfg.label}
            </span>
            {stepTag && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                📚 {stepTag}
              </span>
            )}
            {dayTag && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff' }}>
                Dia {dayTag}
              </span>
            )}
            {localChecked && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                ✓ Concluído
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
            {title}
          </p>
          {description && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
              {description}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <button onClick={() => canOpen ? setOpen(true) : window.open(url, '_blank')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 7, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
              <Icon size={11} /> {fileType === 'video' ? 'Assistir' : fileType === 'pdf' ? 'Ver PDF' : fileType === 'site' ? 'Abrir' : 'Visualizar'}
            </button>
            {onCheck && (
              <button onClick={toggleCheck}
                style={{ width: 28, height: 28, borderRadius: 7, border: `1.5px solid ${localChecked ? '#22c55e' : 'var(--border)'}`, background: localChecked ? '#22c55e' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: localChecked ? '#fff' : 'var(--muted-foreground)', transition: 'all 0.15s' }}
                title={localChecked ? 'Desmarcar' : 'Marcar como concluído'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
