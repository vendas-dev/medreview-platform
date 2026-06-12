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

  const { data: q, error } = await admin.from('onboarding_questions')
    .insert({ step_id: body.step_id, question: body.question, explanation: body.explanation ?? null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (body.answers?.length) {
    await admin.from('onboarding_answers').insert(
      body.answers.map((a: any, i: number) => ({
        question_id: (q as any).id, answer_text: a.text,
        is_correct: a.is_correct, order_index: i,
      }))
    )
  }
  const { data: full } = await admin.from('onboarding_questions')
    .select('*, onboarding_answers(*)').eq('id', (q as any).id).single()
  return NextResponse.json({ question: full })
}
