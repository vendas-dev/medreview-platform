import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { VideoManager } from './VideoManager'
import { VideoGrid } from './VideoGrid'

export default async function VideoaulasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  const query = supabase.from('onboarding_videos').select('*').eq('is_active', true).order('order_index')
  const { data: videos } = isAdmin
    ? await query
    : await query.in('team', userTeam ? [userTeam, 'ambos'] : ['ambos'])

  const { data: viewed } = await supabase
    .from('onboarding_video_views').select('video_id').eq('user_id', user.id)
  const viewedIds = viewed?.map((v: any) => v.video_id) ?? []

  return (
    <div style={{ padding: 24, maxWidth: 1024, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Videoaulas</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{videos?.length ?? 0} vídeos disponíveis</p>
        </div>
        {isAdmin && <VideoManager mode="create" />}
      </div>
      <VideoGrid videos={videos ?? []} viewedIds={viewedIds} />
    </div>
  )
}
