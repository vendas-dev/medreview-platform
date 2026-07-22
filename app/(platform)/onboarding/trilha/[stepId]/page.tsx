import { createClient }       from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft }          from 'lucide-react'
import { StepDetail }         from './StepDetail'
import { computeUnlockedStepIds } from '@/lib/onboarding/trilhaSequence'

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
  // Usa a MESMA função da listagem (lib/onboarding/trilhaSequence) — ordena
  // por Dia da trilha primeiro, depois por order_index dentro do dia. Antes,
  // esse arquivo tinha uma checagem própria que ordenava só por order_index
  // (ignorando o Dia), o que travava o usuário numa etapa de um dia mais
  // adiante só porque ela tinha sido criada antes no sistema.
  if (!isAdmin) {
    const { data: settings } = await supabase
      .from('onboarding_settings')
      .select('track_mode')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if ((settings as any)?.track_mode === 'sequencial') {
      const { data: allStepsRaw } = await supabase
        .from('onboarding_steps')
        .select('id, day_number, order_index, team')
        .eq('is_active', true)

      const userTeam = p?.team ?? null
      const teamSteps = (allStepsRaw ?? []).filter(
        (s: any) => s.team === 'ambos' || s.team === userTeam
      )

      const { data: progressRows } = await supabase
        .from('onboarding_progress').select('step_id, status').eq('user_id', user.id)
      const progressMap = Object.fromEntries((progressRows ?? []).map((r: any) => [r.step_id, r.status]))

      const unlocked = computeUnlockedStepIds(teamSteps, progressMap)
      if (!unlocked.has(stepId)) redirect('/onboarding/trilha')
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
