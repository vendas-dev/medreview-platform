import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const formData  = await req.formData()
  const mode      = formData.get('mode') as string
  const name      = formData.get('name') as string
  const email     = formData.get('email') as string
  const password  = formData.get('password') as string
  const role      = formData.get('role') as string
  const job_role  = (formData.get('job_role') as string) || null
  const team      = (formData.get('team') as string) || null
  const hubspot_id = (formData.get('hubspot_id') as string) || null  // ← novo
  const modules   = JSON.parse((formData.get('modules') as string) || '[]') as string[]
  const userId    = formData.get('userId') as string | null
  const avatar    = formData.get('avatar') as File | null

  // Upload de avatar
  let avatar_url: string | undefined
  if (avatar && avatar.size > 0) {
    const ext = avatar.name.split('.').pop() ?? 'jpg'
    const targetId = userId ?? 'new'
    const path = `avatars/${targetId}-${Date.now()}.${ext}`
    const bytes = await avatar.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('avatars')
      .upload(path, bytes, { contentType: avatar.type, upsert: true })
    if (!uploadErr) {
      const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
      avatar_url = urlData.publicUrl
    }
  }

  if (mode === 'create') {
    const { data: authData, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await admin.from('profiles').insert({
      id: authData.user.id, name, email, role,
      job_role, team,
      hubspot_id,                              // ← salva o HubSpot ID
      ...(avatar_url ? { avatar_url } : {}),
    } as any)

    // Também salva o hubspot_id no closer correspondente (se existir)
    if (hubspot_id && job_role === 'closer') {
      await admin.from('closers')
        .update({ hubspot_id })
        .eq('hubspot_id', hubspot_id)
    }

    if (modules.length > 0) {
      await admin.from('user_module_permissions').insert(
        modules.map(mid => ({
          user_id: authData.user.id, module_id: mid, granted: true, granted_by: user.id,
        })) as any
      )
    }
  } else {
    await admin.from('profiles').update({
      name, email, role, job_role, team,
      hubspot_id,                              // ← atualiza o HubSpot ID
      ...(avatar_url ? { avatar_url } : {}),
    } as any).eq('id', userId!)

    if (password?.trim()) {
      await admin.auth.admin.updateUserById(userId!, { password })
    }

    await admin.from('user_module_permissions').delete().eq('user_id', userId!)
    if (modules.length > 0) {
      await admin.from('user_module_permissions').insert(
        modules.map(mid => ({
          user_id: userId!, module_id: mid, granted: true, granted_by: user.id,
        })) as any
      )
    }
  }

  return NextResponse.json({ ok: true })
}
