import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { TelaoCompleto } from './TelaoCompleto'

// Telão Completo — visão dos fundadores/gestores. Só superadmin.
// Quem não é vai pro Telão normal (em vez de ver uma tela de erro).
export default async function TelaoCompletoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/telao')

  return <TelaoCompleto />
}
