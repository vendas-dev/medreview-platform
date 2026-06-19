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
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const client = isAdmin ? createAdminClient() : supabase

  const stepsQuery = isAdmin
    ? client.from('onboarding_steps').select(`
        *,
        onboarding_materials(count),
        onboarding_faqs(count),
        onboarding_questions(count)
      `).eq('is_active', true).order('day_number', { ascending: true, nullsFirst: false }).order('order_index')
    : client.from('onboarding_steps').select(`
        *,
        onboarding_materials(count),
        onboarding_faqs(count),
        onboarding_questions(count)
      `).eq('is_active', true).in('team', teamFilter).order('day_number', { ascending: true, nullsFirst: false }).order('order_index')

  const { data: steps } = await stepsQuery

  return (
    <TrilhaClient
      steps={steps ?? []}
      isAdmin={isAdmin}
    />
  )
}
