import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { UserForm } from '../../UserForm'

export default async function EditUserPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: modules } = await admin.from('modules').select('*').eq('is_active', true).order('sort_order')

  // Modo criação — id ausente ou "new"
  const isNew = !id || id === 'new'

  if (isNew) {
    return (
      <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Novo usuário</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Preencha os dados para criar a conta.</p>
        </div>
        <UserForm modules={modules ?? []} mode="create" />
      </div>
    )
  }

  // Modo edição — busca o usuário
  const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single()
  if (!profile) redirect('/admin')

  const { data: grants } = await admin
    .from('user_module_permissions')
    .select('module_id')
    .eq('user_id', id)
    .eq('granted', true)

  const grantedModuleIds = grants?.map((g: any) => g.module_id) ?? []
  const isSelf = user.id === id

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Editar usuário</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Atualize os dados de {(profile as any).name}.</p>
      </div>
      <UserForm
        modules={modules ?? []}
        mode="edit"
        user={profile as any}
        grantedModuleIds={grantedModuleIds}
        isSelf={isSelf}
      />
    </div>
  )
}
