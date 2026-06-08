import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Users, ShieldCheck, UserCheck } from 'lucide-react'
import { UserRow } from './UserRow'
import { AdminHeader } from './AdminHeader'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: users } = await admin.from('profiles').select('*').order('created_at', { ascending: false })
  const total  = users?.length ?? 0
  const admins = users?.filter(u => u.role === 'superadmin').length ?? 0
  const ativos = users?.filter(u => u.is_active).length ?? 0

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 1040, margin: '0 auto' }}>
      <AdminHeader total={total} admins={admins} ativos={ativos} />
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(79,70,229,0.04) 0%,transparent 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Usuários</span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{total} registros</span>
        </div>
        <div>
          {users?.map(u => <UserRow key={u.id} user={u as any} currentUserId={user.id} />)}
          {(!users || users.length === 0) && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhum usuário cadastrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
