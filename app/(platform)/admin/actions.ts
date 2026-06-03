'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') redirect('/dashboard')
  return { supabase, user }
}

export async function createUser(formData: FormData) {
  const { user: cu } = await assertAdmin()
  const admin = createAdminClient()

  const name      = formData.get('name') as string
  const email     = formData.get('email') as string
  const role      = formData.get('role') as string
  const password  = formData.get('password') as string
  const moduleIds = formData.getAll('modules') as string[]
  const job_role  = (formData.get('job_role') as string) || null
  const team      = (formData.get('team') as string) || null

  const { data: authData, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  })
  if (error) throw new Error(error.message)

  await admin.from('profiles').insert({
    id: authData.user.id, name, email, role, job_role, team,
  } as any)

  if (moduleIds.length > 0) {
    await admin.from('user_module_permissions').insert(
      moduleIds.map(mid => ({
        user_id: authData.user.id, module_id: mid, granted: true, granted_by: cu.id,
      })) as any
    )
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function updateUser(formData: FormData) {
  const { user: cu } = await assertAdmin()
  const admin = createAdminClient()

  const userId    = formData.get('userId') as string
  const name      = formData.get('name') as string
  const email     = formData.get('email') as string
  const role      = formData.get('role') as string
  const password  = formData.get('password') as string
  const moduleIds = formData.getAll('modules') as string[]
  const job_role  = (formData.get('job_role') as string) || null
  const team      = (formData.get('team') as string) || null

  await admin.from('profiles').update({ name, email, role, job_role, team } as any).eq('id', userId)

  if (password?.trim()) {
    await admin.auth.admin.updateUserById(userId, { password })
  }

  await admin.from('user_module_permissions').delete().eq('user_id', userId)
  if (moduleIds.length > 0) {
    await admin.from('user_module_permissions').insert(
      moduleIds.map(mid => ({
        user_id: userId, module_id: mid, granted: true, granted_by: cu.id,
      })) as any
    )
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await assertAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update({ is_active: isActive } as any).eq('id', userId)
  revalidatePath('/admin')
}

export async function deleteUser(userId: string) {
  const { user: cu } = await assertAdmin()
  const admin = createAdminClient()

  if (userId === cu.id) throw new Error('Não é possível excluir seu próprio usuário.')

  await admin.from('user_module_permissions').delete().eq('user_id', userId)
  await admin.from('profiles').delete().eq('id', userId)
  await admin.auth.admin.deleteUser(userId)

  revalidatePath('/admin')
}