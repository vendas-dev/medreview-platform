import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UserForm } from '@/app/(platform)/admin/UserForm'

export default async function NewUserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') redirect('/dashboard')
  const { data: modules } = await supabase.from('modules').select('*').eq('is_active', true).order('sort_order')

  return (
    <div style={{ padding: '24px', maxWidth: 600, margin: '0 auto' }}>
      <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', textDecoration: 'none' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={13} />
        </div>
        Voltar para usuários
      </Link>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Novo usuário</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>Crie um acesso para a plataforma operacional.</p>
      </div>
      <UserForm modules={modules ?? []} mode="create" />
    </div>
  )
}
