import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { VideoaulasClient } from './VideoaulasClient'

export default async function VideoaulasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const client = isAdmin ? createAdminClient() : supabase

  // Etapas visíveis
  const { data: allStepsRaw } = await client
    .from('onboarding_steps')
    .select('id, title, day_number, team')
    .eq('is_active', true)
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('order_index')

  const allSteps = (allStepsRaw ?? []) as { id: string; title: string; day_number: number | null; team: string }[]
  const visibleSteps = isAdmin ? allSteps : allSteps.filter(s => teamFilter.includes(s.team))
  const stepIds = visibleSteps.map(s => s.id)

  // Materiais de vídeo vinculados a etapas (Da Trilha)
  const { data: stepMaterials } = stepIds.length > 0
    ? await client
        .from('onboarding_materials')
        .select('*')
        .in('step_id', stepIds)
        .eq('type', 'video')
        .order('order_index')
    : { data: [] }

  // Vídeos avulsos
  const { data: avulsosRaw } = isAdmin
    ? await client.from('onboarding_videos').select('*').eq('is_active', true).order('order_index')
    : await client.from('onboarding_videos').select('*').eq('is_active', true).in('team', teamFilter).order('order_index')

  // Checks do usuário
  const { data: matViews } = await supabase
    .from('onboarding_material_views').select('material_id, completed').eq('user_id', user.id)
  const { data: vidViews } = await supabase
    .from('onboarding_video_views').select('video_id, completed').eq('user_id', user.id)

  const matChecked = new Set((matViews ?? []).filter((v: any) => v.completed).map((v: any) => v.material_id))
  const vidChecked = new Set((vidViews ?? []).filter((v: any) => v.completed).map((v: any) => v.video_id))
  const stepMap    = Object.fromEntries(visibleSteps.map(s => [s.id, s]))

  const trailVideos = (stepMaterials ?? []).map((m: any) => ({
    ...m,
    checked:  matChecked.has(m.id),
    stepInfo: stepMap[m.step_id] ?? null,
  }))

  const avulsos = (avulsosRaw ?? []).map((v: any) => ({
    ...v,
    checked: vidChecked.has(v.id),
  }))

  return (
    <VideoaulasClient
      initialTrail={trailVideos}
      initialAvulsos={avulsos}
      isAdmin={isAdmin}
      allSteps={visibleSteps}
    />
  )
}
