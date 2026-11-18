import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Só superadmin passa. Devolve { admin, userId } ou { error: NextResponse }. */
export async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) } as const
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) } as const
  return { admin: createAdminClient(), userId: user.id } as const
}
