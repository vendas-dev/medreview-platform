import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, title } = await req.json()
  if (!id || !title?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  await supabase
    .from('onboarding_conversations')
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
