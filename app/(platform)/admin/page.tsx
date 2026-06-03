import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, ShieldCheck, UserCheck } from 'lucide-react'
import { UserRow } from './UserRow'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/dashboard')
  const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  const total = users?.length ?? 0
  const admins = users?.filter(u => u.role === 'superadmin').length ?? 0
  const ativos = users?.filter(u => u.is_active).length ?? 0

  return (
    <div style={{ padding: 24, maxWidth: 1024, margin: '0 auto' }}>
      <style>{`
        .btn-solid { background: #111827; color: #ffffff; }
        .dark .btn-solid { background: #ffffff; color: #111827; }
        .btn-solid:hover { opacity: 0.85; transform: translateY(-1px); }
        .cancel-btn { background: transparent; color: var(--muted-foreground); border: 1.5px solid var(--border); }
        .cancel-btn:hover { background: var(--secondary); color: var(--foreground); }
        .submit-btn { background: #111827; color: #ffffff; }
        .dark .submit-btn { background: #ffffff; color: #111827; }
        .submit-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>Administração</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Gerencie usuários e permissões</p>
        </div>
        <Link href="/admin/users/new" className="btn-solid" style={{
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 40, padding: '0 18px', borderRadius: 10,
          fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <Plus size={15} /> Novo usuário
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {([
          { label: 'Total', value: total, Icon: Users, c: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
          { label: 'Superadmins', value: admins, Icon: ShieldCheck, c: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
          { label: 'Ativos', value: ativos, Icon: UserCheck, c: '#10b981', bg: 'rgba(16,185,129,.12)' },
        ] as const).map(({ label, value, Icon, c, bg }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon size={17} style={{ color: c }} />
            </div>
            <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Usuários</span>
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
