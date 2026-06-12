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

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body  = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('onboarding_faqs')
    .insert({ step_id: body.step_id, question: body.question, answer: body.answer })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ faq: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body  = await req.json()
  const admin = createAdminClient()
  await admin.from('onboarding_faqs')
    .update({ question: body.question, answer: body.answer })
    .eq('id', body.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  const admin = createAdminClient()
  await admin.from('onboarding_faqs').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
