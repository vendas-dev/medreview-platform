import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { SimuladoClient }    from './SimuladoClient'

export default async function SimuladoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, name, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userName = (profile as any)?.name ?? ''
  const userTeam = (profile as any)?.team ?? 'ambos'

  const admin = createAdminClient()

  // Verificar se concluiu toda a trilha
  const teamFilter = userTeam !== 'ambos' ? [userTeam, 'ambos'] : ['ambos']
  const { data: allSteps } = await supabase
    .from('onboarding_steps').select('id').eq('is_active', true).in('team', teamFilter)
  const { data: progress } = await supabase
    .from('onboarding_progress').select('step_id, status').eq('user_id', user.id)

  const completedIds = new Set((progress ?? []).filter((p:any) => p.status === 'concluido').map((p:any) => p.step_id))
  const allDone      = (allSteps ?? []).every((s:any) => completedIds.has(s.id))

  if (!allDone && !isAdmin) redirect('/onboarding/trilha')

  // Buscar tentativas do usuário
  const { data: attempts } = await supabase
    .from('simulado_attempts').select('*').eq('user_id', user.id).order('completed_at')

  const attempt1 = (attempts ?? []).find((a:any) => a.simulado_numero === 1)
  const attempt2 = (attempts ?? []).find((a:any) => a.simulado_numero === 2)

  // Determinar qual simulado mostrar
  let simuladoNumero = 1
  if (attempt1 && !attempt1.passed && !attempt2) simuladoNumero = 2
  if (attempt1?.passed || attempt2)              simuladoNumero = 0

  // Buscar simulados do time do usuário OU 'ambos'
  // Prioridade: simulado específico do time > simulado ambos
  const { data: allSimulados } = await admin
    .from('simulados')
    .select('*, simulado_questions(*, simulado_answers(*))')
    .order('numero')

  // Filtra por team: prefere o do time específico, fallback para 'ambos'
  function getSimuladoForTeam(numero: number) {
    const specific = (allSimulados ?? []).find(s => s.numero === numero && s.team === userTeam)
    const generic  = (allSimulados ?? []).find(s => s.numero === numero && s.team === 'ambos')
    return specific ?? generic ?? null
  }

  const simulados = [getSimuladoForTeam(1), getSimuladoForTeam(2)].filter(Boolean)

  // Insight final
  const { data: finalInsight } = await supabase
    .from('user_insights').select('id').eq('user_id', user.id).eq('insight_type', 'final').maybeSingle()

  return (
    <SimuladoClient
      simuladoNumero={simuladoNumero}
      simulados={simulados as any}
      attempt1={attempt1 ?? null}
      attempt2={attempt2 ?? null}
      userName={userName}
      hasFinalInsight={!!finalInsight}
      isAdmin={isAdmin}
    />
  )
}
