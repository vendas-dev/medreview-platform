import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrocasCloserClient } from './TrocasCloserClient'

export const dynamic = 'force-dynamic'
// "Trocas de Venda" do closer: solicitar e acompanhar. Superadmin usa /admin/vendas/trocas.
export default async function TrocasCloserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, team').eq('id', user.id).single()
  if ((profile as any)?.role === 'superadmin') redirect('/admin/vendas/trocas')
  return <TrocasCloserClient team={(profile as any)?.team ?? null} />
}
