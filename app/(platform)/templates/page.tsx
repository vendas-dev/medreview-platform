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
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  const client = isAdmin ? createAdminClient() : supabase

  let query = client.from('templates').select('*').eq('is_active', true).order('created_at', { ascending: false })

  // Usuário comum: filtra pelo time
  if (!isAdmin && userTeam) {
    query = query.in('team', [userTeam, 'ambos'])
  }

  const { data: templates } = await query

  return (
    <TemplatesView
      templates={templates ?? []}
      isAdmin={isAdmin}
      userTeam={userTeam}
    />
  )
}
