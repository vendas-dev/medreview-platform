import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, is_active } = await req.json()
  const admin = createAdminClient()
  await admin.from('modules').update({ is_active }).eq('id', id)
  return NextResponse.json({ ok: true })
}
