import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ModulesManager } from './ModulesManager'

export default async function ModulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') redirect('/dashboard')
  const admin = createAdminClient()
  const { data: modules } = await admin.from('modules').select('*').order('sort_order')
  return (
    <div style={{ padding: '24px 16px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Módulos</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Gerencie os módulos disponíveis na plataforma.</p>
      </div>
      <ModulesManager modules={modules ?? []} />
    </div>
  )
}
