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
    .from('onboarding_settings').select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001').single()

  return <ConfigForm settings={settings as any} />
}
