import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { GoalsManager }      from './GoalsManager'

export default async function IntelGoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/intel')

  const today    = new Date().toISOString().slice(0, 10)
  const monthKey = today.slice(0, 7)

  const admin = createAdminClient()
  const [{ data: closers }, { data: goals }, { data: companyGoalsRaw }] = await Promise.all([
    admin.from('profiles').select('id, name, team').neq('role', 'superadmin').order('name'),
    admin.from('closer_goals').select('*').eq('month', monthKey),
    admin.from('company_goals').select('scope, goal_value').eq('month', monthKey),
  ])

  const goalsMap = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))
  const closersWithGoals = (closers ?? []).map((c: any) => ({ ...c, goal: goalsMap[c.id] ?? null }))
  const companyGoals = Object.fromEntries((companyGoalsRaw ?? []).map((g: any) => [g.scope, Number(g.goal_value) || 0]))

  return <GoalsManager closers={closersWithGoals} month={monthKey} companyGoals={companyGoals} />
}
