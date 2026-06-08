import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const client = isAdmin ? createAdminClient() : supabase

  // Vídeos da trilha: materiais do tipo 'video' dentro das etapas
  const stepsQuery = await client
    .from('onboarding_steps')
    .select('id, title, day_number, team')
    .eq('is_active', true)
    .order('order_index')

  const steps = stepsQuery.data ?? []
  const visibleSteps = isAdmin ? steps : steps.filter((s: any) => s.team === 'ambos' || teamFilter.includes(s.team))

  // Materiais de vídeo de cada etapa
  const stepIds = visibleSteps.map((s: any) => s.id)
  const { data: stepMaterials } = stepIds.length > 0
    ? await client.from('onboarding_materials').select('*').in('step_id', stepIds).eq('type', 'video').order('order_index')
    : { data: [] }

  // Vídeos avulsos (tabela onboarding_videos)
  const avulsosQuery = isAdmin
    ? client.from('onboarding_videos').select('*').eq('is_active', true).order('order_index')
    : client.from('onboarding_videos').select('*').eq('is_active', true).in('team', teamFilter).order('order_index')
  const { data: avulsosVideos } = await avulsosQuery

  // Check do usuário
  const { data: matViews } = await supabase
    .from('onboarding_material_views').select('material_id, completed').eq('user_id', user.id)
  const { data: vidViews } = await supabase
    .from('onboarding_video_views').select('video_id, completed').eq('user_id', user.id)

  const matChecked = new Set(matViews?.filter((v: any) => v.completed).map((v: any) => v.material_id) ?? [])
  const vidChecked = new Set(vidViews?.filter((v: any) => v.completed).map((v: any) => v.video_id) ?? [])

  // Enriquece materiais com info da etapa
  const stepMap = Object.fromEntries(visibleSteps.map((s: any) => [s.id, s]))
  const enrichedMaterials = (stepMaterials ?? []).map((m: any) => ({
    ...m,
    stepInfo: stepMap[m.step_id] ?? null,
    checked: matChecked.has(m.id),
  }))

  const enrichedAvulsos = (avulsosVideos ?? []).map((v: any) => ({
    ...v,
    checked: vidChecked.has(v.id),
  }))

  return (
    <div className="page-wrap" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Videoaulas</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {enrichedMaterials.length + enrichedAvulsos.length} vídeo{enrichedMaterials.length + enrichedAvulsos.length !== 1 ? 's' : ''} disponíveis
          </p>
        </div>
        {isAdmin && <VideoManager mode="create" />}
      </div>

      <VideoGrid
        trailVideos={enrichedMaterials}
        avulsos={enrichedAvulsos}
        isAdmin={isAdmin}
      />
    </div>
  )
}
