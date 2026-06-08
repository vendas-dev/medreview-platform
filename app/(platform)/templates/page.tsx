import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TemplatesView } from './TemplatesView'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  let query = isAdmin
    ? createAdminClient().from('templates').select('*').order('created_at', { ascending: false })
    : supabase.from('templates').select('*').eq('is_active', true).order('created_at', { ascending: false })

  const { data: templates } = await query

  return <TemplatesView templates={templates ?? []} isAdmin={isAdmin} userTeam={userTeam} />
}
