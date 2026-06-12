import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Considera online quem fez heartbeat nos últimos 3 minutos
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Upsert na tabela user_presence
  await supabase.from('user_presence').upsert({
    user_id:    user.id,
    last_seen:  new Date().toISOString(),
    page:       (await req.json().catch(() => ({}))).page ?? '/',
  }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()

  const { data } = await supabase
    .from('user_presence')
    .select('user_id, last_seen, page')
    .gte('last_seen', threshold)

  return NextResponse.json({ online: data ?? [] })
}
