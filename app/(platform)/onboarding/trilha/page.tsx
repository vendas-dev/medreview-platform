import { createClient }      from '@/lib/supabase/server'
import { redirect }          from 'next/navigation'
import { TrilhaViewClient }  from './TrilhaViewClient'

export const dynamic = 'force-dynamic'

export default async function TrilhaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const p = profile as any
  const isAdmin = p?.role === 'superadmin'

  const { data: stepsRaw } = await supabase
    .from('onboarding_steps')
    .select('*, onboarding_materials(count), onboarding_faqs(count), onboarding_questions(count)')
    .eq('is_active', true)
    .order('order_index')

  // Para não-admin: pré-filtra por time no servidor
  const allSteps = (stepsRaw ?? []) as any[]
  const steps = isAdmin
    ? allSteps
    : allSteps.filter(s => s.team === 'ambos' || s.team === p?.team)

  return <TrilhaViewClient steps={steps} isAdmin={isAdmin}/>
}
