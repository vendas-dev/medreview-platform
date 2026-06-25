import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CalculadoraView } from './CalculadoraView'

export default async function Calculadora2Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team ?? null

  return <CalculadoraView isAdmin={isAdmin} userTeam={userTeam} />
}
