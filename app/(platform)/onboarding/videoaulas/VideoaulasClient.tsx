'use client'
import { useState } from 'react'
import { VideoManager } from './VideoManager'
import { VideoGrid } from './VideoGrid'

interface TrailVideo {
  id: string; title: string; description: string | null; url: string
  thumbnail_url: string | null; checked: boolean; step_id?: string | null
  stepInfo: { id: string; title: string; day_number: number | null; team: string } | null
}
interface AvulsoVideo {
  id: string; title: string; description: string | null; url: string
  thumbnail_url: string | null; team: string; duration_min: number | null; checked: boolean
}
interface Step { id: string; title: string; day_number: number | null; team: string }

interface Props {
  initialTrail: TrailVideo[]
  initialAvulsos: AvulsoVideo[]
  isAdmin: boolean
  allSteps: Step[]
}

export function VideoaulasClient({ initialTrail, initialAvulsos, isAdmin, allSteps }: Props) {
  const [trail,   setTrail]   = useState<TrailVideo[]>(initialTrail)
  const [avulsos, setAvulsos] = useState<AvulsoVideo[]>(initialAvulsos)

  function handleCreated(video: any) {
    // Se tem stepInfo → é da trilha (onboarding_materials)
    // Se não tem → é avulso (onboarding_videos)
    if (video.stepInfo) {
      setTrail(prev => [...prev, video as TrailVideo])
    } else {
      setAvulsos(prev => [...prev, video as AvulsoVideo])
    }
  }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Videoaulas
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
            {trail.length + avulsos.length} vídeo{trail.length + avulsos.length !== 1 ? 's' : ''} disponíveis
          </p>
        </div>
        {isAdmin && (
          <VideoManager
            steps={allSteps}
            onCreated={handleCreated}
          />
        )}
      </div>

      <VideoGrid
        trailVideos={trail}
        avulsos={avulsos}
        isAdmin={isAdmin}
        allSteps={allSteps}
      />
    </div>
  )
}
