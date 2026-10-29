import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VendasIndividuaisClient } from './VendasIndividuaisClient'

export const dynamic = 'force-dynamic'
// "Vendas > Vendas Individuais" — só superadmin.
export default async function VendasIndividuaisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/dashboard')
  return <VendasIndividuaisClient />
}
