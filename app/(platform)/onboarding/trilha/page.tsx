import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { StepList }     from './StepList'
import { StepManager }  from './StepManager'

export default async function TrilhaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  // Usar sempre o supabase autenticado (sem createAdminClient que pode falhar)
  let stepsQuery = supabase
    .from('onboarding_steps')
    .select('*, onboarding_materials(count), onboarding_faqs(count), onboarding_questions(count)')
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('order_index')

  // Filtrar por time somente para usuários (admin vê tudo)
  if (!isAdmin && userTeam) {
    stepsQuery = stepsQuery.in('team', [userTeam, 'ambos']) as any
  }

  const { data: steps, error: stepsErr } = await stepsQuery
  if (stepsErr) console.error('[TrilhaPage] steps query:', stepsErr.message)

  let userProgress: any[]      = []
  let trailMode                = 'livre'
  let simuladoAttempts: any[]  = []
  let allStepsCompleted        = false

  if (!isAdmin) {
    const [progResult, settingsResult, attemptsResult] = await Promise.all([
      supabase.from('onboarding_progress').select('step_id, status, quiz_score').eq('user_id', user.id),
      supabase.from('onboarding_settings').select('track_mode').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
      supabase.from('simulado_attempts').select('simulado_numero, score, passed, correct_answers, wrong_answers, total_questions').eq('user_id', user.id),
    ])

    userProgress     = progResult.data ?? []
    trailMode        = (settingsResult.data as any)?.track_mode ?? (settingsResult.data as any)?.trail_mode ?? 'livre'
    simuladoAttempts = attemptsResult.data ?? []

    const completedIds = new Set(userProgress.filter(p => p.status === 'concluido').map(p => p.step_id))
    allStepsCompleted  = (steps ?? []).length > 0 && (steps ?? []).every(s => completedIds.has(s.id))
  }

  const total = steps?.length ?? 0

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 35%,#4f46e5 70%,#7c3aed 100%)', borderRadius: 20, padding: 'clamp(18px,3vw,28px)', marginBottom: 24, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'inline-block', marginBottom: 10 }}>
              {isAdmin ? '⚙️ Gestão da Trilha' : '🎯 Minha Trilha'}
            </span>
            <h1 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.025em' }}>
              {isAdmin ? 'Trilha de Aprendizado' : 'Sua jornada começa aqui! 🚀'}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0, maxWidth: 440, lineHeight: 1.6 }}>
              {isAdmin
                ? `${total} etapa${total !== 1 ? 's' : ''} cadastrada${total !== 1 ? 's' : ''}. Organize a melhor jornada de aprendizado.`
                : 'Cada etapa concluída é um passo a mais rumo a ser o melhor vendedor do time!'}
            </p>
          </div>
          {isAdmin && <StepManager mode="create" />}
        </div>
      </div>

      <StepList
        steps={steps ?? []}
        isAdmin={isAdmin}
        userProgress={userProgress}
        trailMode={trailMode}
        allStepsCompleted={allStepsCompleted}
        simuladoAttempts={simuladoAttempts}
      />
    </div>
  )
}
