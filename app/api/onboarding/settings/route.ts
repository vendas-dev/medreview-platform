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

  // Tenta UPDATE primeiro
  const { data: existing } = await supabase
    .from('onboarding_settings')
    .select('id')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  if (existing) {
    const { error } = await supabase
      .from('onboarding_settings')
      .update({
        welcome_message:    body.welcome_message,
        tone:               body.tone,
        trail_mode:         body.trail_mode,
        extra_instructions: body.extra_instructions,
        is_active:          body.is_active,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    if (error) {
      console.error('settings update error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  } else {
    // Primeira vez — faz INSERT
    const { error } = await supabase
      .from('onboarding_settings')
      .insert({
        id:                 '00000000-0000-0000-0000-000000000001',
        welcome_message:    body.welcome_message,
        tone:               body.tone,
        trail_mode:         body.trail_mode,
        extra_instructions: body.extra_instructions,
        is_active:          body.is_active ?? true,
      })

    if (error) {
      console.error('settings insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
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
