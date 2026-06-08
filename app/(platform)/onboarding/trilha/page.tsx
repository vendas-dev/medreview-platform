import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StepManager } from './StepManager'
import { StepList } from './StepList'

export default async function TrilhaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'

  const { data: steps } = await supabase
    .from('onboarding_steps')
    .select(`
      id, title, description, estimated_minutes, team, order_index,
      onboarding_materials(count),
      onboarding_faqs(count),
      onboarding_questions(count)
    `)
    .eq('is_active', true)
    .order('order_index')

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>
            Trilha de Aprendizado
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {steps?.length ?? 0} etapas cadastradas
          </p>
        </div>
        {isAdmin && <StepManager mode="create" />}
      </div>
      <StepList steps={steps ?? []} isAdmin={isAdmin} />
    </div>
  )
}
