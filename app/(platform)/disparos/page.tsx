import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { DisparosClient } from './DisparosClient'

export default async function DisparosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, name, hubspot_id').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'
  return <DisparosClient isAdmin={isAdmin} ownerName={(profile as any)?.name ?? ''} ownerHubspotId={(profile as any)?.hubspot_id ?? null} />
}
