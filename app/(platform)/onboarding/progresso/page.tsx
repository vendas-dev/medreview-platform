import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgressoView } from './ProgressoView'

export default async function ProgressoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, team').eq('id', user.id).single()
  const userTeam = (profile as any)?.team
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const { data: steps } = await supabase
    .from('onboarding_steps').select('*').eq('is_active', true)
    .in('team', teamFilter).order('order_index')

  const { data: progress } = await supabase
    .from('onboarding_progress').select('*').eq('user_id', user.id)

  const { data: attempts } = await supabase
    .from('onboarding_quiz_attempts').select('*').eq('user_id', user.id)

  const { data: videoViews } = await supabase
    .from('onboarding_video_views').select('*').eq('user_id', user.id)

  return (
    <ProgressoView
      steps={steps ?? []}
      progress={progress ?? []}
      attempts={attempts ?? []}
      videoViews={videoViews ?? []}
    />
  )
}
