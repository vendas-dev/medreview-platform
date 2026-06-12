import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMissionCenter } from './UserMissionCenter'
import { OnboardingHub } from './OnboardingHub'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, role, team, avatar_url').eq('id', user.id).single()

  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team
  const userName = (profile as any)?.name ?? 'usuário'
  const avatarUrl = (profile as any)?.avatar_url ?? null

  // Admin vê o hub de gestão
  if (isAdmin) {
    return <OnboardingHub isAdmin={true} userName={userName} completed={0} total={0} pct={0} />
  }

  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  // Todas as etapas visíveis
  const { data: steps } = await supabase
    .from('onboarding_steps')
    .select('id, title, description, day_number, estimated_minutes, team, completion_criteria, min_quiz_score')
    .eq('is_active', true)
    .in('team', teamFilter)
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('order_index')

  // Progresso do usuário
  const { data: progress } = await supabase
    .from('onboarding_progress')
    .select('step_id, status, quiz_score, completed_at')
    .eq('user_id', user.id)

  const progressMap = new Map((progress ?? []).map((p: any) => [p.step_id, p]))
  const allSteps    = steps ?? []
  const total       = allSteps.length
  const completed   = allSteps.filter(s => progressMap.get(s.id)?.status === 'concluido').length
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0

  // Etapas com status para missões
  const stepsWithStatus = allSteps.map(s => ({
    ...s,
    status:    progressMap.get(s.id)?.status ?? 'nao_iniciado',
    quiz_score: progressMap.get(s.id)?.quiz_score ?? null,
    completed_at: progressMap.get(s.id)?.completed_at ?? null,
  }))

  // Pendências: materiais não vistos + quiz não feito
  const { data: matViews } = await supabase
    .from('onboarding_material_views')
    .select('material_id')
    .eq('user_id', user.id)
  const checkedMats = new Set((matViews ?? []).map((v: any) => v.material_id))

  // Materiais das etapas em andamento
  const inProgressIds = stepsWithStatus
    .filter(s => s.status === 'em_andamento' || s.status === 'nao_iniciado')
    .slice(0, 3)
    .map(s => s.id)

  const { data: pendingMaterials } = inProgressIds.length > 0
    ? await supabase
        .from('onboarding_materials')
        .select('id, title, type, step_id')
        .in('step_id', inProgressIds)
        .limit(10)
    : { data: [] }

  const uncheckedMats = (pendingMaterials ?? []).filter((m: any) => !checkedMats.has(m.id))

  // Config do onboarding
  const { data: settings } = await supabase
    .from('onboarding_settings')
    .select('track_mode')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()
  const trailMode = (settings as any)?.track_mode ?? 'livre'

  return (
    <UserMissionCenter
      userName={userName}
      avatarUrl={avatarUrl}
      completed={completed}
      total={total}
      pct={pct}
      steps={stepsWithStatus}
      uncheckedMaterials={uncheckedMats ?? []}
      trailMode={trailMode}
      teamName={userTeam ?? ''}
    />
  )
}
