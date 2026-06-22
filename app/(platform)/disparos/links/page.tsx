import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { LinksClient }  from '../LinksClient'

export default async function LinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'
  return <LinksClient isAdmin={isAdmin} />
}
