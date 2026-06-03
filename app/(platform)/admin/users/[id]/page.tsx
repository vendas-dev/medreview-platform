import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UserForm } from '@/app/(platform)/admin/UserForm'

interface PageProps {
  params: { id: string }
}

export default async function EditUserPage({ params }: PageProps) {
  const { id } = params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') redirect('/dashboard')

  // Busca o usuário alvo — sem checar error para evitar false notFound
  const { data: target } = await supabase
    .from('profiles').select('*').eq('id', id).single()

  if (!target) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--muted-foreground)' }}>Usuário não encontrado.</p>
        <Link href="/admin" style={{ color: 'var(--foreground)', fontSize: 13, marginTop: 12, display: 'inline-block' }}>
          ← Voltar para usuários
        </Link>
      </div>
    )
  }

  const { data: modules } = await supabase
    .from('modules').select('*').eq('is_active', true).order('sort_order')

  const { data: perms } = await supabase
    .from('user_module_permissions')
    .select('module_id')
    .eq('user_id', id)
    .eq('granted', true)

  const granted = perms?.map(p => p.module_id) ?? []

  return (
    <div style={{ padding: '24px', maxWidth: 600, margin: '0 auto' }}>
      <Link href="/admin" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        marginBottom: 24, fontSize: 13, fontWeight: 600,
        color: 'var(--muted-foreground)', textDecoration: 'none',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={13} />
        </div>
        Voltar para usuários
      </Link>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Editar usuário</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>Atualize informações e permissões.</p>
      </div>
      <UserForm
        modules={modules ?? []}
        mode="edit"
        user={target as any}
        grantedModuleIds={granted}
        isSelf={user.id === id}
      />
    </div>
  )
}
