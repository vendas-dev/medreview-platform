'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Role } from '@/types/database'

export async function createUser(formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (profile?.role !== 'superadmin') {
    throw new Error('Sem permissão')
  }

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const role = formData.get('role') as Role
  const password = formData.get('password') as string
  const moduleIds = formData.getAll('modules') as string[]

  const { data: authData, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (error) throw new Error(error.message)

  await admin.from('profiles').insert({
    id: authData.user.id,
    name,
    email,
    role,
  })

  if (moduleIds.length > 0) {
    await admin.from('user_module_permissions').insert(
      moduleIds.map(moduleId => ({
        user_id: authData.user.id,
        module_id: moduleId,
        granted: true,
        granted_by: currentUser.id,
      }))
    )
  }

  await admin.from('audit_logs').insert({
    user_id: currentUser.id,
    action: 'user_created',
    target_id: authData.user.id,
    metadata: { name, email, role, modules: moduleIds },
  })

  revalidatePath('/admin')
  redirect('/admin')
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/login')

  await admin.from('profiles').update({ is_active: isActive }).eq('id', userId)

  await admin.from('audit_logs').insert({
    user_id: currentUser.id,
    action: isActive ? 'user_updated' : 'user_deactivated',
    target_id: userId,
    metadata: { is_active: isActive },
  })

  revalidatePath('/admin')
}
