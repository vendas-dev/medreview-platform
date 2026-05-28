import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: permissions } = await supabase
    .from('user_module_permissions')
    .select('granted, modules(key, label, url, icon, description)')
    .eq('user_id', user.id)
    .eq('granted', true)

  const modules = permissions?.map((p: any) => p.modules).filter(Boolean) ?? []

  return <DashboardClient profile={profile} modules={modules} />
}
