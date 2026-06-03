import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardView } from './DashboardView'

export default async function DashboardOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/onboarding')

  const { data: users }     = await supabase.from('profiles').select('id, name, team, role').neq('role', 'superadmin')
  const { data: progress }  = await supabase.from('onboarding_progress').select('user_id, status, quiz_score')
  const { data: convs }     = await supabase.from('onboarding_conversations').select('id')
  const { data: msgs }      = await supabase.from('onboarding_messages').select('id')
  const { data: vviews }    = await supabase.from('onboarding_video_views').select('completed')
  const { data: steps }     = await supabase.from('onboarding_steps').select('id, team')

  return (
    <DashboardView
      users={users ?? []}
      progress={progress ?? []}
      totalConversations={convs?.length ?? 0}
      totalMessages={msgs?.length ?? 0}
      videoViews={vviews ?? []}
      steps={steps ?? []}
    />
  )
}
