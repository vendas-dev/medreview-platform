import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

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

  const { data: last } = await admin
    .from('onboarding_steps').select('order_index')
    .order('order_index', { ascending: false }).limit(1).single()

  const { data, error } = await admin
    .from('onboarding_steps')
    .insert({
      title:               body.title,
      description:         body.description || null,
      team:                body.team || 'ambos',
      day_number:          body.day_number ? Number(body.day_number) : null,
      estimated_minutes:   body.estimated_minutes ? Number(body.estimated_minutes) : null,
      completion_criteria: body.completion_criteria || 'visualizar',
      min_quiz_score:      Number(body.min_quiz_score || 70),
      max_attempts:        body.max_attempts ? Number(body.max_attempts) : null,
      order_index:         ((last as any)?.order_index ?? -1) + 1,
      is_active:           true,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/onboarding/trilha')
  // Retorna o objeto completo — essencial para onCreated atualizar o estado
  return NextResponse.json({ step: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body  = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('onboarding_steps')
    .update({
      title:               body.title,
      description:         body.description || null,
      team:                body.team || 'ambos',
      day_number:          body.day_number ? Number(body.day_number) : null,
      estimated_minutes:   body.estimated_minutes ? Number(body.estimated_minutes) : null,
      completion_criteria: body.completion_criteria || 'visualizar',
      min_quiz_score:      Number(body.min_quiz_score || 70),
      max_attempts:        body.max_attempts ? Number(body.max_attempts) : null,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', body.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/onboarding/trilha')
  return NextResponse.json({ step: data })
}

export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await createAdminClient().from('onboarding_steps').delete().eq('id', id)
  revalidatePath('/onboarding/trilha')
  return NextResponse.json({ ok: true })
}
