import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StepDetail } from './StepDetail'

export default async function StepDetailPage({
  params,
}: {
  params: Promise<{ stepId: string }>
}) {
  const { stepId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin   = (profile as any)?.role === 'superadmin'
  const userTeam  = (profile as any)?.team
  const userName  = (profile as any)?.name ?? ''
  const avatarUrl = (profile as any)?.avatar_url ?? null

  const { data: step } = await supabase
    .from('onboarding_steps').select('*').eq('id', stepId).maybeSingle()

  if (!step) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--muted-foreground)', marginBottom: 16 }}>Etapa não encontrada.</p>
        <Link href="/onboarding/trilha" style={{ fontSize: 13, color: 'var(--foreground)', textDecoration: 'underline' }}>
          Voltar para trilha
        </Link>
      </div>
    )
  }

  const client = isAdmin ? createAdminClient() : supabase

  const [
    { data: materials },
    { data: faqs },
    { data: questions },
  ] = await Promise.all([
    client.from('onboarding_materials').select('*').eq('step_id', stepId).order('order_index'),
    client.from('onboarding_faqs').select('*').eq('step_id', stepId).order('order_index'),
    client.from('onboarding_questions').select('*, onboarding_answers(*)').eq('step_id', stepId).order('order_index'),
  ])

  // Progresso do usuário nesta etapa
  const { data: stepProgress } = await supabase
    .from('onboarding_progress')
    .select('status, quiz_score, completed_at')
    .eq('user_id', user.id)
    .eq('step_id', stepId)
    .maybeSingle()

  // Checks de materiais desta etapa
  const materialIds = (materials ?? []).map((m: any) => m.id)
  const { data: matViews } = materialIds.length > 0
    ? await supabase.from('onboarding_material_views')
        .select('material_id, completed')
        .eq('user_id', user.id)
        .in('material_id', materialIds)
    : { data: [] }
  const checkedMaterials = new Set(
    (matViews ?? []).filter((v: any) => v.completed).map((v: any) => v.material_id)
  )

  // Config do onboarding (trail_mode / track_mode)
  const { data: settings } = await supabase
    .from('onboarding_settings')
    .select('track_mode')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()
  const trailMode = (settings as any)?.track_mode ?? 'livre'

  // Todas as etapas do time para navegação sequencial
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']
  const { data: allSteps } = await (isAdmin
    ? createAdminClient()
    : supabase
  ).from('onboarding_steps')
    .select('id, title, day_number, order_index, team')
    .eq('is_active', true)
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('order_index')

  const visibleSteps = isAdmin
    ? (allSteps ?? [])
    : (allSteps ?? []).filter((s: any) => teamFilter.includes(s.team))

  const currentIdx   = visibleSteps.findIndex((s: any) => s.id === stepId)
  const nextStep     = currentIdx >= 0 && currentIdx < visibleSteps.length - 1
    ? visibleSteps[currentIdx + 1]
    : null

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 860, margin: '0 auto' }}>
      <Link href="/onboarding/trilha"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22, fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', textDecoration: 'none' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-xs)' }}>
          <ArrowLeft size={13} />
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
        userProgress={stepProgress}
        checkedMaterials={Array.from(checkedMaterials)}
        trailMode={trailMode}
        nextStep={nextStep}
        allSteps={visibleSteps as any}
        userName={userName}
        userAvatarUrl={avatarUrl}
      />
    </div>
  )
}
