import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MedMidiaView } from './MedMidiaView'

export default async function MedMidiaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  const client = isAdmin ? createAdminClient() : supabase

  let query = client.from('medmidia').select('*').eq('is_active', true).order('created_at', { ascending: false })

  // Usuário comum: filtra pelo time — mesma regra de templates (vê o
  // próprio time + "ambos"). Vertical não restringe acesso (um closer OAO
  // vende nas 3 verticais), só serve de filtro dentro da tela.
  if (!isAdmin && userTeam) {
    query = query.in('team', [userTeam, 'ambos'])
  }

  const { data: itens } = await query

  return (
    <MedMidiaView
      itens={itens ?? []}
      isAdmin={isAdmin}
      userTeam={userTeam}
    />
  )
}
