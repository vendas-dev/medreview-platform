import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function getSession(): Promise<{ userId: string; role: string | null } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { userId: user.id, role: (me as any)?.role ?? null }
}
/** Só superadmin passa. Devolve o erro HTTP pronto quando não passa. */
export async function requireSuper(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const s = await getSession()
  if (!s) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (s.role !== 'superadmin') return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, userId: s.userId }
}
