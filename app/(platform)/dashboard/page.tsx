import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SuperDashboard } from './SuperDashboard'
import { UserDashboard } from './UserDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, name, team, avatar_url').eq('id', user.id).single()

  const isAdmin   = (profile as any)?.role === 'superadmin'
  const userName  = (profile as any)?.name ?? 'usuário'
  const userTeam  = (profile as any)?.team
  const avatarUrl = (profile as any)?.avatar_url ?? null

  // ── SUPERADMIN ──────────────────────────────────────────────
  if (isAdmin) {
    const admin = createAdminClient()

    const [
      { data: users },
      { data: steps },
      { data: progress },
      { data: conversations },
      { data: quizAttempts },
      { data: presence },
      { data: materials },
      { data: videos },
    ] = await Promise.all([
      admin.from('profiles').select('id, name, team, role, email, avatar_url').neq('role', 'superadmin'),
      admin.from('onboarding_steps').select('id, title, team, day_number').eq('is_active', true).order('day_number', { ascending: true, nullsFirst: false }),
      admin.from('onboarding_progress').select('user_id, step_id, status, completed_at'),
      admin.from('onboarding_conversations').select('id, user_id, created_at'),
      admin.from('onboarding_quiz_attempts').select('user_id, step_id, score, passed, created_at'),
      supabase.from('user_presence').select('user_id, last_seen').gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()),
      admin.from('onboarding_materials').select('id'),
      admin.from('onboarding_videos').select('id').eq('is_active', true),
    ])

    const totalUsers     = users?.length ?? 0
    const totalSteps     = steps?.length ?? 0
    const totalMaterials = (materials?.length ?? 0) + (videos?.length ?? 0)

    const onlineIds = new Set((presence ?? []).map((p: any) => p.user_id))

    const userProgress = users?.map(u => {
      const up   = (progress ?? []).filter((p: any) => p.user_id === u.id)
      const done = up.filter((p: any) => p.status === 'concluido').length
      const ts   = (steps ?? []).filter((s: any) => s.team === u.team || s.team === 'ambos')
      const pct  = ts.length > 0 ? Math.round((done / ts.length) * 100) : 0
      return { ...u, done, totalSteps: ts.length, pct, isOnline: onlineIds.has(u.id) }
    }) ?? []

    const activeOnboarding = userProgress.filter(u => u.done > 0 && u.pct < 100).length
    const completedCount   = userProgress.filter(u => u.pct === 100 && u.totalSteps > 0).length
    const avgCompletion    = totalUsers > 0
      ? Math.round(userProgress.reduce((s, u) => s + u.pct, 0) / totalUsers) : 0
    const onlineCount = userProgress.filter(u => u.isOnline).length

    const firstAttempts = (quizAttempts ?? []).reduce((acc: Record<string, any>, a: any) => {
      const key = `${a.user_id}-${a.step_id}`
      if (!acc[key] || new Date(a.created_at) < new Date(acc[key].created_at)) acc[key] = a
      return acc
    }, {})
    const firstArr   = Object.values(firstAttempts) as any[]
    const passedRate = firstArr.length > 0
      ? Math.round((firstArr.filter((a: any) => a.passed).length / firstArr.length) * 100) : 0

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })
    const progressByDay = last7Days.map(day => ({
      day: day.slice(5),
      completions: (progress ?? []).filter((p: any) => p.status === 'concluido' && p.completed_at?.startsWith(day)).length,
      quizzes:     (quizAttempts ?? []).filter((a: any) => a.created_at?.startsWith(day)).length,
    }))

    return (
      <SuperDashboard
        userName={userName}
        stats={{ totalUsers, totalSteps, totalMaterials, activeOnboarding, completedCount, avgCompletion, onlineCount, passedRate, totalConversations: conversations?.length ?? 0 }}
        users={userProgress}
        progressByDay={progressByDay}
      />
    )
  }

  // ── USUÁRIO COMUM ────────────────────────────────────────────
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const { data: steps } = await supabase
    .from('onboarding_steps')
    .select('id, title, day_number, estimated_minutes, team, completion_criteria, min_quiz_score')
    .eq('is_active', true)
    .in('team', teamFilter)
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('order_index')

  const { data: progress } = await supabase
    .from('onboarding_progress')
    .select('step_id, status, quiz_score, completed_at')
    .eq('user_id', user.id)

  const progressMap = new Map((progress ?? []).map((p: any) => [p.step_id, p]))
  const allSteps    = steps ?? []
  const total       = allSteps.length
  const completed   = allSteps.filter(s => progressMap.get(s.id)?.status === 'concluido').length
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0

  const stepsWithStatus = allSteps.map(s => ({
    ...s,
    status:       progressMap.get(s.id)?.status ?? 'nao_iniciado',
    quiz_score:   progressMap.get(s.id)?.quiz_score ?? null,
    completed_at: progressMap.get(s.id)?.completed_at ?? null,
  }))

  // Materiais não vistos das próximas etapas
  const { data: matViews } = await supabase
    .from('onboarding_material_views').select('material_id').eq('user_id', user.id)
  const checkedMats = new Set((matViews ?? []).map((v: any) => v.material_id))

  const pendingStepIds = stepsWithStatus
    .filter(s => s.status !== 'concluido').slice(0, 3).map(s => s.id)

  const { data: pendingMaterials } = pendingStepIds.length > 0
    ? await supabase.from('onboarding_materials').select('id, title, type, step_id')
        .in('step_id', pendingStepIds).limit(10)
    : { data: [] }

  const uncheckedMaterials = (pendingMaterials ?? []).filter((m: any) => !checkedMats.has(m.id))

  const { data: settings } = await supabase
    .from('onboarding_settings').select('track_mode')
    .eq('id', '00000000-0000-0000-0000-000000000001').single()
  const trailMode = (settings as any)?.track_mode ?? 'livre'

  return (
    <UserDashboard
      userName={userName}
      avatarUrl={avatarUrl}
      teamName={userTeam ?? ''}
      completed={completed}
      total={total}
      pct={pct}
      steps={stepsWithStatus}
      uncheckedMaterials={uncheckedMaterials ?? []}
      trailMode={trailMode}
    />
  )
}
