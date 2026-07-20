import { createClient }       from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft }          from 'lucide-react'
import { StepDetail }         from './StepDetail'

export const dynamic = 'force-dynamic'

export default async function StepDetailPage(
  props: { params: Promise<{ stepId: string }> }
) {
  const { stepId } = await props.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const p       = profile as any
  const isAdmin = p?.role === 'superadmin'

  const { data: step } = await supabase
    .from('onboarding_steps').select('*').eq('id', stepId).single()
  if (!step) notFound()

  // ── Verificação de modo sequencial ────────────────────────
  // IMPORTANTE: filtrar steps pelo time do usuário antes de checar o índice.
  // Sem esse filtro, steps OAO-only bloqueiam o primeiro step visível do R1.
  if (!isAdmin) {
    const { data: settings } = await supabase
      .from('onboarding_settings')
      .select('track_mode')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if ((settings as any)?.track_mode === 'sequencial') {
      // Buscar todos os steps VISÍVEIS para o time deste usuário
      const { data: allSteps } = await supabase
        .from('onboarding_steps')
        .select('id, order_index, team')
        .eq('is_active', true)
        .order('order_index')

      // Filtrar apenas os que o usuário pode ver (mesmo time ou 'ambos')
      const userTeam = p?.team ?? null
      const visibleSteps = (allSteps ?? []).filter(
        (s: any) => s.team === 'ambos' || s.team === userTeam
      )

      // Posição desta etapa dentro dos steps VISÍVEIS ao usuário
      const stepIndex = visibleSteps.findIndex((s: any) => s.id === stepId)

      // Se não é a primeira etapa visível, verificar se a anterior foi concluída
      if (stepIndex > 0) {
        const prevStep = visibleSteps[stepIndex - 1]
        const { data: prevProgress } = await supabase
          .from('onboarding_progress')
          .select('status')
          .eq('user_id', user.id)
          .eq('step_id', prevStep.id)
          .maybeSingle()

        if (!prevProgress || (prevProgress as any).status !== 'concluido') {
          // Etapa anterior não concluída → redirecionar para a trilha
          redirect('/onboarding/trilha')
        }
      }
      // stepIndex === 0: é a primeira etapa visível → sempre acessível
    }
  }

  const [
    { data: materials },
    { data: faqs },
    { data: questions },
    { data: userProgress },
    { data: materialViews },
  ] = await Promise.all([
    supabase.from('onboarding_materials').select('*').eq('step_id', stepId).order('order_index'),
    supabase.from('onboarding_faqs').select('*').eq('step_id', stepId).order('created_at'),
    supabase.from('onboarding_questions').select('*, onboarding_answers(*)').eq('step_id', stepId).order('created_at'),
    supabase.from('onboarding_progress').select('*').eq('user_id', user.id).eq('step_id', stepId).maybeSingle(),
    supabase.from('onboarding_material_views').select('material_id').eq('user_id', user.id),
  ])

  const viewedMaterialIds = (materialViews ?? []).map((v: any) => v.material_id)

  return (
    <div style={{ padding:24, maxWidth:860, margin:'0 auto' }}>
      <Link href="/onboarding/trilha"
        style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:24, fontSize:13, fontWeight:600, color:'var(--muted-foreground)', textDecoration:'none' }}>
        <div style={{ width:28, height:28, borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ArrowLeft size={13}/>
        </div>
        Voltar para trilha
      </Link>

      <StepDetail
        step={step}
        materials={materials ?? []}
        faqs={faqs ?? []}
        questions={questions ?? []}
        isAdmin={isAdmin}
        stepId={stepId}
        userProgress={userProgress}
        viewedMaterialIds={viewedMaterialIds}
      />
    </div>
  )
}
