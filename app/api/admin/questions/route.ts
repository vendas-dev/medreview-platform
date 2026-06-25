import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (data as any)?.role === 'superadmin' ? true : null
}

// ── POST: criar nova questão ──────────────────────────────────
export async function POST(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { step_id, question, explanation, answers } = await req.json()
  if (!step_id || !question?.trim())
    return NextResponse.json({ error: 'step_id e question obrigatórios' }, { status: 400 })

  const db = createAdminClient()

  const { count } = await db.from('onboarding_questions')
    .select('*', { count: 'exact', head: true }).eq('step_id', step_id)

  const { data: q, error: qErr } = await db
    .from('onboarding_questions')
    .insert({ step_id, question: question.trim(), explanation: explanation || null, order_index: count ?? 0 })
    .select('*').single()

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  if (answers?.length) {
    const rows = answers
      .filter((a: any) => (a.text || a.answer_text)?.trim())
      .map((a: any, i: number) => ({
        question_id: q.id,
        answer_text: (a.text ?? a.answer_text ?? '').trim(),
        is_correct:  !!a.is_correct,
        order_index: i,
      }))
    if (rows.length) {
      const { error: aErr } = await db.from('onboarding_answers').insert(rows)
      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    }
  }

  const { data: full } = await db
    .from('onboarding_questions')
    .select('*, onboarding_answers(*)')
    .eq('id', q.id).single()

  return NextResponse.json({ ok: true, question: full })
}

// ── PATCH: editar pergunta + respostas ────────────────────────
export async function PATCH(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { question_id, question, answers } = await req.json()
  if (!question_id || !question?.trim())
    return NextResponse.json({ error: 'question_id e question obrigatórios' }, { status: 400 })

  const db = createAdminClient()

  const { error: qErr } = await db
    .from('onboarding_questions')
    .update({ question: question.trim() })
    .eq('id', question_id)
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  if (answers?.length) {
    await db.from('onboarding_answers').delete().eq('question_id', question_id)
    const rows = answers
      .filter((a: any) => (a.answer_text || a.text)?.trim())
      .map((a: any, i: number) => ({
        question_id,
        answer_text: (a.answer_text ?? a.text ?? '').trim(),
        is_correct:  !!a.is_correct,
        order_index: i,
      }))
    if (rows.length) {
      const { error: aErr } = await db.from('onboarding_answers').insert(rows)
      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    }
  }

  const { data: updated } = await db
    .from('onboarding_questions')
    .select('*, onboarding_answers(*)')
    .eq('id', question_id).single()

  return NextResponse.json({ ok: true, question: updated })
}

// ── DELETE: apagar pergunta ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { question_id } = await req.json()
  if (!question_id)
    return NextResponse.json({ error: 'question_id obrigatório' }, { status: 400 })

  const db = createAdminClient()

  // Deletar respostas primeiro (previne FK constraint)
  await db.from('onboarding_answers').delete().eq('question_id', question_id)

  // Deletar a pergunta — .select() força o Supabase a reportar se deletou de verdade
  const { data: deleted, error } = await db
    .from('onboarding_questions')
    .delete()
    .eq('id', question_id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se não deletou nenhuma linha, é porque o ID não existe ou RLS bloqueou
  if (!deleted || deleted.length === 0)
    return NextResponse.json({ error: `Pergunta não encontrada (id: ${question_id})` }, { status: 404 })

  return NextResponse.json({ ok: true })
}
