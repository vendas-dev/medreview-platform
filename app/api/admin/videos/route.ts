import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// SCHEMA REAL:
// onboarding_videos:   title, description, url, thumbnail_url, team, duration_min  (sem step_id, sem day_number)
// onboarding_materials: step_id, title, description, url, type, order_index        (sem thumbnail_url, sem day_number, sem updated_at)

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (p as any)?.role === 'superadmin' ? user : null
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body  = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('onboarding_videos')
    .insert({
      title:         body.title,
      description:   body.description ?? null,
      url:           body.url,
      thumbnail_url: body.thumbnail_url ?? null,
      team:          body.team ?? 'ambos',
      duration_min:  body.duration_min ? Number(body.duration_min) : null,
      is_active:     true,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ video: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body  = await req.json()
  const table = (body.table as string) || 'onboarding_videos'
  const admin = createAdminClient()

  let payload: Record<string, any>

  if (table === 'onboarding_videos') {
    payload = {
      title:         body.title,
      description:   body.description ?? null,
      url:           body.url,
      thumbnail_url: body.thumbnail_url ?? null,
      team:          body.team ?? 'ambos',
      updated_at:    new Date().toISOString(),
    }
  } else {
    // onboarding_materials — step_id É o campo que muda quando troca de trilha
    payload = {
      title:       body.title,
      description: body.description ?? null,
      url:         body.url,
      type:        body.type ?? 'video',
      step_id:     body.step_id,  // obrigatório para vincular à etapa correta
    }
  }

  const { data, error } = await admin
    .from(table)
    .update(payload)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ video: data })
}

export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, table } = await req.json()
  const admin = createAdminClient()
  await admin.from(table ?? 'onboarding_videos').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
