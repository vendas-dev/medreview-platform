import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingHub } from './OnboardingHub'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, name, team').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'
  const userName = (profile as any)?.name?.split(' ')[0] ?? 'usuário'

  const { data: steps } = await supabase
    .from('onboarding_steps').select('id').eq('is_active', true)
  const { data: progress } = await supabase
    .from('onboarding_progress').select('status').eq('user_id', user.id)

  const completed = progress?.filter((p: any) => p.status === 'concluido').length ?? 0
  const total = steps?.length ?? 0
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return <OnboardingHub isAdmin={isAdmin} userName={userName} completed={completed} total={total} pct={pct} />
}