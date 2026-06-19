'use client'
import { useState } from 'react'
import { VideoManager } from './VideoManager'
import { VideoGrid } from './VideoGrid'

interface Step { id: string; title: string; day_number: number | null; team: string }

interface Props {
  initialTrail:   any[]
  initialAvulsos: any[]
  isAdmin:        boolean
  allSteps:       Step[]
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

function enrich(v: any): any {
  if (v.thumbnail_url) return v
  const t = getThumb(v.url ?? '')
  return t ? { ...v, thumbnail_url: t } : v
}

export function VideoaulasClient({ initialTrail, initialAvulsos, isAdmin, allSteps }: Props) {
  // Estado vive AQUI — VideoGrid só recebe props e dispara callbacks
  const [trail,   setTrail]   = useState<any[]>((initialTrail   ?? []).map(enrich))
  const [avulsos, setAvulsos] = useState<any[]>((initialAvulsos ?? []).map(enrich))

  // Novo vídeo criado pelo VideoManager
  function handleCreated(video: any) {
    const enriched = enrich(video)
    if (enriched.stepInfo) setTrail(prev => [...prev, enriched])
    else                   setAvulsos(prev => [...prev, enriched])
  }

  // Vídeo editado no VideoGrid
  function handleUpdated(updated: any, type: 'trail' | 'avulso') {
    const enriched = enrich(updated)
    if (type === 'trail')   setTrail(prev   => prev.map(v => v.id === enriched.id ? { ...v, ...enriched } : v))
    else                    setAvulsos(prev => prev.map(v => v.id === enriched.id ? { ...v, ...enriched } : v))
  }

  // Vídeo excluído no VideoGrid
  function handleDeleted(id: string, type: 'trail' | 'avulso') {
    if (type === 'trail') setTrail(prev   => prev.filter(v => v.id !== id))
    else                  setAvulsos(prev => prev.filter(v => v.id !== id))
  }

  // Check/uncheck de vídeo assistido
  function handleChecked(id: string, checked: boolean, type: 'trail' | 'avulso') {
    if (type === 'trail') setTrail(prev   => prev.map(v => v.id === id ? { ...v, checked } : v))
    else                  setAvulsos(prev => prev.map(v => v.id === id ? { ...v, checked } : v))
  }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Videoaulas</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
            {trail.length + avulsos.length} vídeo{trail.length + avulsos.length !== 1 ? 's' : ''} disponíveis
          </p>
        </div>
        {isAdmin && <VideoManager steps={allSteps} onCreated={handleCreated} />}
      </div>

      {/* VideoGrid NÃO tem useState para os arrays — recebe tudo via props */}
      <VideoGrid
        trailVideos={trail}
        avulsos={avulsos}
        isAdmin={isAdmin}
        allSteps={allSteps}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onChecked={handleChecked}
      />
    </div>
  )
}
