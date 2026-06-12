import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Usa track_mode (nome real da coluna no banco)
  const payload = {
    welcome_message:    body.welcome_message    ?? null,
    tone:               body.tone               ?? 'didatico',
    track_mode:         body.trail_mode         ?? 'livre',   // frontend envia trail_mode, banco usa track_mode
    extra_instructions: body.extra_instructions ?? null,
    updated_at:         new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('onboarding_settings')
    .select('id')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  if (existing) {
    const { error } = await supabase
      .from('onboarding_settings')
      .update(payload)
      .eq('id', '00000000-0000-0000-0000-000000000001')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await supabase
      .from('onboarding_settings')
      .insert({ id: '00000000-0000-0000-0000-000000000001', ...payload })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('onboarding_settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  return NextResponse.json({ settings: data })
}
