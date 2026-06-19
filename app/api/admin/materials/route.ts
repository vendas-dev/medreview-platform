import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (p as any)?.role === 'superadmin' ? user : null
}

// onboarding_materials colunas: step_id, title, description, url, type, order_index
// NÃO TEM: thumbnail_url, day_number, updated_at

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body  = await req.json()
  const admin = createAdminClient()

  const { data: last } = await admin
    .from('onboarding_materials').select('order_index')
    .eq('step_id', body.step_id)
    .order('order_index', { ascending: false }).limit(1).single()

  const { data, error } = await admin
    .from('onboarding_materials')
    .insert({
      step_id:     body.step_id,
      title:       body.title,
      description: body.description ?? null,
      url:         body.url,
      type:        body.type ?? 'outro',
      order_index: ((last as any)?.order_index ?? -1) + 1,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ material: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body  = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('onboarding_materials')
    .update({
      title:       body.title,
      description: body.description ?? null,
      url:         body.url,
      type:        body.type ?? 'outro',
      step_id:     body.step_id,
    })
    .eq('id', body.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ material: data })
}

export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await createAdminClient().from('onboarding_materials').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
