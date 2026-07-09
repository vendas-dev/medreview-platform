import { createClient }      from '@/lib/supabase/server'
import { redirect }          from 'next/navigation'
import { TrilhaViewClient }  from './TrilhaViewClient'
import { computeUnlockedStepIds } from '@/lib/onboarding/trilhaSequence'

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

  // Trilha sequencial: admin vê tudo liberado (precisa gerenciar/pré-visualizar
  // livremente). Pro usuário, respeita o "Modo da Trilha" configurado em
  // /onboarding/config — só trava se estiver em modo sequencial.
  let unlockedStepIds: string[] | null = null
  if (!isAdmin) {
    const { data: settings } = await supabase
      .from('onboarding_settings').select('track_mode')
      .eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle()
    const trackMode = (settings as any)?.track_mode ?? 'sequencial'

    if (trackMode === 'sequencial') {
      const { data: progressRows } = await supabase
        .from('onboarding_progress').select('step_id, status').eq('user_id', user.id)
      const progressMap = Object.fromEntries((progressRows ?? []).map((r: any) => [r.step_id, r.status]))
      unlockedStepIds = Array.from(computeUnlockedStepIds(steps, progressMap))
    }
  }

  return <TrilhaViewClient steps={steps} isAdmin={isAdmin} unlockedStepIds={unlockedStepIds}/>
}
