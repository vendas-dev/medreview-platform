import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardView } from './DashboardView'

export default async function DashboardOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/onboarding')

  // Usa admin client para ver tudo sem RLS
  const admin = createAdminClient()

  const [
    { data: users },
    { data: steps },
    { data: progress },
    { data: convs },
    { data: msgs },
    { data: vviews },
    { data: attempts },
  ] = await Promise.all([
    admin.from('profiles').select('id, name, team, role, email').neq('role', 'superadmin'),
    admin.from('onboarding_steps').select('id, title, team').eq('is_active', true).order('order_index'),
    admin.from('onboarding_progress').select('user_id, step_id, status, quiz_score, completed_at'),
    admin.from('onboarding_conversations').select('id, user_id'),
    admin.from('onboarding_messages').select('id'),
    admin.from('onboarding_video_views').select('user_id, completed'),
    admin.from('onboarding_quiz_attempts').select('user_id, step_id, score, passed'),
  ])

  return (
    <DashboardView
      users={users ?? []}
      steps={steps ?? []}
      progress={progress ?? []}
      totalConversations={convs?.length ?? 0}
      totalMessages={msgs?.length ?? 0}
      videoViews={vviews ?? []}
      attempts={attempts ?? []}
    />
  )
}
