'use client'
import { useState } from 'react'
import { Play, Clock, X, CheckCircle2, Circle, Tag } from 'lucide-react'

interface TrailVideo {
  id: string; title: string; description: string | null; url: string
  thumbnail_url: string | null; checked: boolean
  stepInfo: { id: string; title: string; day_number: number | null; team: string } | null
}
interface AvulsoVideo {
  id: string; title: string; description: string | null; url: string
  thumbnail_url: string | null; team: string; duration_min: number | null; checked: boolean
}

function getEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`
    if (u.hostname.includes('youtube.com')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1&rel=0`
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').pop()}?autoplay=1`
    if (u.hostname.includes('loom.com')) return `https://www.loom.com/embed/${u.pathname.split('/').pop()}?autoplay=1`
    if (u.hostname.includes('drive.google.com')) {
      const id = u.pathname.match(/\/d\/([^/]+)/)?.[1]
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
  } catch {}
  return url
}

function VideoCard({ video, type, onCheck }: {
  video: TrailVideo | AvulsoVideo; type: 'trail'|'avulso'; onCheck: (id: string, checked: boolean) => void
}) {
  const [playing, setPlaying] = useState(false)
  const [checked, setChecked] = useState(video.checked)

  async function toggleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !checked
    setChecked(next)
    await fetch('/api/onboarding/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type === 'avulso' ? 'video' : 'material', id: video.id, completed: next }),
    })
    onCheck(video.id, next)
  }

  const stepInfo = type === 'trail' ? (video as TrailVideo).stepInfo : null
  const team = type === 'avulso' ? (video as AvulsoVideo).team : stepInfo?.team ?? 'ambos'
  const teamColor = team === 'OAO' ? '#3b82f6' : team === 'R1' ? '#8b5cf6' : '#22c55e'

  return (
    <>
      {playing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(8px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setPlaying(false)}>
          <div style={{ width:'100%', maxWidth:900, background:'var(--card)', borderRadius:20, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize:15, fontWeight:700, color:'var(--foreground)', margin:0 }}>{video.title}</p>
                {stepInfo && <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'2px 0 0' }}>📚 {stepInfo.title}{stepInfo.day_number ? ` · Dia ${stepInfo.day_number}` : ''}</p>}
              </div>
              <button onClick={() => setPlaying(false)} style={{ width:34, height:34, borderRadius:9, border:'none', background:'var(--secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--foreground)' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ position:'relative', paddingTop:'56.25%', background:'#000' }}>
              <iframe src={getEmbedUrl(video.url)} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }} allow="autoplay; fullscreen" allowFullScreen />
            </div>
            {video.description && <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)' }}><p style={{ fontSize:13, color:'var(--muted-foreground)', margin:0 }}>{video.description}</p></div>}
          </div>
        </div>
      )}

      {/* Card com altura fixa para padronizar */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', cursor:'pointer', transition:'all 0.18s', opacity: checked ? 0.65 : 1, display:'flex', flexDirection:'column' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow='0 6px 24px rgba(79,70,229,0.12)'; el.style.transform='translateY(-2px)'; el.style.borderColor='rgba(99,102,241,0.3)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow='none'; el.style.transform='none'; el.style.borderColor='var(--border)' }}>

        {/* Thumbnail — altura fixa */}
        <div onClick={() => setPlaying(true)} style={{ position:'relative', height:160, background:'color-mix(in srgb, var(--foreground) 8%, var(--card))', flexShrink:0 }}>
          {video.thumbnail_url
            ? <img src={video.thumbnail_url} alt={video.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Play size={22} style={{ color:'#6366f1', marginLeft:3 }} />
                </div>
              </div>
          }
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s', background:'rgba(0,0,0,0)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
          </div>
          {checked && (
            <div style={{ position:'absolute', top:8, right:8, background:'rgba(34,197,94,0.9)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, display:'flex', alignItems:'center', gap:4 }}>
              <CheckCircle2 size={10} /> Assistido
            </div>
          )}
          <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.7)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6 }}>
            {team === 'ambos' ? 'Ambos' : `Time ${team}`}
          </div>
        </div>

        {/* Info — altura fixa com flex */}
        <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', flex:1 }}>
          {/* Tags sempre no topo da info */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7, minHeight:20 }}>
            {stepInfo && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:5, background:'rgba(99,102,241,0.1)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.2)', whiteSpace:'nowrap', overflow:'hidden', maxWidth:120, textOverflow:'ellipsis' }}>
                <Tag size={8} /> {stepInfo.title}
              </span>
            )}
            {stepInfo?.day_number && (
              <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:5, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', whiteSpace:'nowrap' }}>
                Dia {stepInfo.day_number}
              </span>
            )}
          </div>

          <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', margin:'0 0 4px', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, lineHeight:1.4 }}>
            {video.title}
          </p>

          {/* Descrição com altura fixa para 2 linhas mesmo quando vazio */}
          <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 0', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, lineHeight:1.5, minHeight:33, flex:1 }}>
            {video.description ?? ''}
          </p>

          {/* Footer sempre na base */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginTop:10, paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <button onClick={() => setPlaying(true)}
              style={{ display:'inline-flex', alignItems:'center', gap:5, height:28, padding:'0 12px', borderRadius:7, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit' }}>
              <Play size={10} /> Assistir
            </button>
            {/* Check SEMPRE no mesmo lugar — canto direito do footer */}
            <button onClick={toggleCheck}
              style={{ width:28, height:28, borderRadius:7, border:`1.5px solid ${checked ? '#22c55e' : 'var(--border)'}`, background:checked ? '#22c55e' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:checked ? '#fff' : 'var(--muted-foreground)', transition:'all 0.15s', flexShrink:0 }}
              title={checked ? 'Desmarcar como assistido' : 'Marcar como assistido'}>
              {checked
                ? <CheckCircle2 size={14} />
                : <Circle size={14} />
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function VideoGrid({ trailVideos, avulsos, isAdmin }: {
  trailVideos: TrailVideo[]; avulsos: AvulsoVideo[]; isAdmin: boolean
}) {
  const [tvs, setTvs] = useState(trailVideos)
  const [avs, setAvs] = useState(avulsos)

  return (
    <div>
      {/* Da Trilha */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div>
            <p style={{ fontSize:16, fontWeight:800, color:'var(--foreground)', margin:'0 0 2px', letterSpacing:'-0.02em' }}>📚 Da Trilha</p>
            <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>Vídeos vinculados às etapas de aprendizado</p>
          </div>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ fontSize:11, color:'var(--muted-foreground)', flexShrink:0 }}>{tvs.length} vídeo{tvs.length!==1?'s':''}</span>
        </div>
        {tvs.length === 0
          ? <div style={{ padding:'32px', textAlign:'center', background:'var(--card)', border:'1px solid var(--border)', borderRadius:14 }}><p style={{ fontSize:13, color:'var(--muted-foreground)' }}>Nenhum vídeo da trilha disponível.</p></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(260px,100%),1fr))', gap:16 }}>
              {tvs.map(v => <VideoCard key={v.id} video={v} type="trail" onCheck={(id,c) => setTvs(prev => prev.map(x => x.id===id ? {...x,checked:c} : x))} />)}
            </div>
        }
      </div>

      {/* Avulsos */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div>
            <p style={{ fontSize:16, fontWeight:800, color:'var(--foreground)', margin:'0 0 2px', letterSpacing:'-0.02em' }}>🎬 Avulsos</p>
            <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>Videoaulas extras e materiais complementares</p>
          </div>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ fontSize:11, color:'var(--muted-foreground)', flexShrink:0 }}>{avs.length} vídeo{avs.length!==1?'s':''}</span>
        </div>
        {avs.length === 0
          ? <div style={{ padding:'32px', textAlign:'center', background:'var(--card)', border:'1px solid var(--border)', borderRadius:14 }}><p style={{ fontSize:13, color:'var(--muted-foreground)' }}>Nenhuma videoaula avulsa disponível.</p></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(260px,100%),1fr))', gap:16 }}>
              {avs.map(v => <VideoCard key={v.id} video={v} type="avulso" onCheck={(id,c) => setAvs(prev => prev.map(x => x.id===id ? {...x,checked:c} : x))} />)}
            </div>
        }
      </div>
    </div>
  )
}
