import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { LiveWall }     from './LiveWall'

export default async function TelaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar se é admin
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  const isAdmin = !!roleRow

  return <LiveWall isAdmin={isAdmin} />
}
