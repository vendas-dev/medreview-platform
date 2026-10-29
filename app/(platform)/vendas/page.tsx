import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MinhasVendasClient } from './MinhasVendasClient'

export const dynamic = 'force-dynamic'
// "Minhas Vendas" — a tabela de vendas do closer logado. Superadmin usa a seção "Vendas" (/admin/vendas).
export default async function MinhasVendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, team').eq('id', user.id).single()
  if ((profile as any)?.role === 'superadmin') redirect('/admin/vendas')
  return <MinhasVendasClient team={(profile as any)?.team ?? null} />
}
