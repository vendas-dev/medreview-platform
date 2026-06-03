'use client'
import { Play, Clock } from 'lucide-react'

interface Video {
  id: string
  title: string
  description: string | null
  url: string
  thumbnail_url: string | null
  team: string
  duration_min: number | null
}

export function VideoGrid({ videos, viewedIds }: { videos: Video[]; viewedIds: string[] }) {
  if (videos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Nenhuma videoaula disponível.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {videos.map(v => {
        const watched = viewedIds.includes(v.id)
        return (
          <div key={v.id}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'
              el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.boxShadow = 'none'
              el.style.transform = 'none'
            }}
          >
            <div style={{ position: 'relative', paddingTop: '56.25%', background: 'color-mix(in srgb, var(--foreground) 6%, var(--card))' }}>
              {v.thumbnail_url
                ? <img src={v.thumbnail_url} alt={v.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
                  </div>
              }
              {watched && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(16,185,129,0.9)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
                  ✓ Assistido
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                {v.team}
              </div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {v.title}
              </p>
              {v.description && (
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                  {v.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {v.duration_min && (
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> {v.duration_min} min
                  </span>
                )}
                <a href={v.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 8, background: 'var(--foreground)', color: 'var(--card)', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginLeft: 'auto' }}>
                  <Play size={11} /> Assistir
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
