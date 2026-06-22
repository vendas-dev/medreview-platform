import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TrilhaClient } from './TrilhaClient'

export default async function TrilhaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  const client     = isAdmin ? createAdminClient() : supabase
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const stepsQuery = isAdmin
    ? client.from('onboarding_steps')
        .select(`*, onboarding_materials(count), onboarding_faqs(count), onboarding_questions(count)`)
        .eq('is_active', true)
        .order('day_number', { ascending: true, nullsFirst: false })
        .order('order_index')
    : client.from('onboarding_steps')
        .select(`*, onboarding_materials(count), onboarding_faqs(count), onboarding_questions(count)`)
        .eq('is_active', true)
        .in('team', teamFilter)
        .order('day_number', { ascending: true, nullsFirst: false })
        .order('order_index')

  const { data: steps } = await stepsQuery

  let userProgress: any[] = []
  let trailMode = 'livre'

  if (!isAdmin) {
    const { data: prog } = await supabase
      .from('onboarding_progress')
      .select('step_id, status, quiz_score')
      .eq('user_id', user.id)
    userProgress = prog ?? []

    // ── CORREÇÃO: campo correto é track_mode, não trail_mode ──
    const { data: settings } = await supabase
      .from('onboarding_settings')
      .select('track_mode')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()
    trailMode = (settings as any)?.track_mode ?? 'livre'
  }

  return (
    <TrilhaClient
      initialSteps={steps ?? []}
      isAdmin={isAdmin}
      userProgress={userProgress}
      trailMode={trailMode}
    />
  )
}
