import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StepDetail } from './StepDetail'

export default async function StepDetailPage({ params }: { params: Promise<{ stepId: string }> }) {
  const { stepId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'

  const { data: step } = await supabase
    .from('onboarding_steps').select('*').eq('id', stepId).maybeSingle()

  if (!step) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--muted-foreground)', marginBottom: 16 }}>Etapa não encontrada.</p>
        <Link href="/onboarding/trilha" style={{ fontSize: 13, color: 'var(--foreground)', textDecoration: 'underline' }}>Voltar para trilha</Link>
      </div>
    )
  }

  const [{ data: materials }, { data: faqs }, { data: questions }, { data: userProgress }] = await Promise.all([
    supabase.from('onboarding_materials').select('*').eq('step_id', stepId).order('order_index'),
    supabase.from('onboarding_faqs').select('*').eq('step_id', stepId).order('order_index'),
    supabase.from('onboarding_questions').select('*, onboarding_answers(*)').eq('step_id', stepId).order('order_index'),
    supabase.from('onboarding_progress').select('*').eq('user_id', user.id).eq('step_id', stepId).maybeSingle(),
  ])

  return (
    <div style={{ padding: '16px 16px 40px', maxWidth: 860, margin: '0 auto' }}>
      <Link href="/onboarding/trilha" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', textDecoration: 'none' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        userProgress={userProgress}
      />
    </div>
  )
}
