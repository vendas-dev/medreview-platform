import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConfigForm } from './ConfigForm'

export default async function ConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/onboarding')

  const { data: settings } = await supabase
    .from('onboarding_settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  // Mapeia track_mode (nome no banco) → trail_mode (nome usado no ConfigForm)
  const mappedSettings = settings
    ? { ...settings, trail_mode: (settings as any).track_mode }
    : null

  return (
    <div style={{ padding: 'clamp(16px,3vw,32px)', maxWidth: 720, margin: '0 auto' }}>
      <ConfigForm settings={mappedSettings as any} />
    </div>
  )
}
