import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { SimuladosAdmin }    from './SimuladosAdmin'

export default async function SimuladosAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: simulados } = await admin
    .from('simulados')
    .select('*, simulado_questions(*, simulado_answers(*))')
    .order('numero')

  // Analytics: attempts + perfis
  const { data: attempts } = await admin
    .from('simulado_attempts')
    .select('*, profiles(name, email)')
    .order('completed_at', { ascending: false })

  // Insights
  const { data: insights } = await admin
    .from('user_insights')
    .select('*, profiles(name), onboarding_steps(title, day_number)')
    .order('created_at', { ascending: false })

  return (
    <SimuladosAdmin
      simulados={simulados ?? []}
      attempts={attempts ?? []}
      insights={insights ?? []}
    />
  )
}
