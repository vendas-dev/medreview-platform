import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { LiveWall }     from './LiveWall'

export default async function TelaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name, hubspot_id, team')
    .eq('id', user.id)
    .single()

  const isAdmin       = (profile as any)?.role === 'superadmin'
  const userHubspotId = (profile as any)?.hubspot_id ?? null
  const userTeam      = (profile as any)?.team ?? null

  // Vincular closer via HubSpot ID
  let userCloserId: string | null = null
  if (!isAdmin && userHubspotId) {
    const { data: closer } = await supabase
      .from('closers').select('id').eq('hubspot_id', userHubspotId).single()
    userCloserId = closer?.id ?? null
  }

  // Fallback por nome
  if (!isAdmin && !userCloserId) {
    const userName = (profile as any)?.name ?? ''
    if (userName) {
      const norm = userName.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').trim()
      const { data: closer } = await supabase
        .from('closers').select('id').ilike('normalized_name', norm).single()
      userCloserId = closer?.id ?? null
    }
  }

  return <LiveWall isAdmin={isAdmin} userCloserId={userCloserId} userHubspotId={userHubspotId} userTeam={userTeam} />
}
