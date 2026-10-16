import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CampanhasClient } from './CampanhasClient'

// Administração → Campanhas. Só superadmin.
export default async function CampanhasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/dashboard')
  return <CampanhasClient />
}
