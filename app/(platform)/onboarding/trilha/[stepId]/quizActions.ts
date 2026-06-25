'use server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Verifica se usuário é superadmin e retorna cliente admin
async function getDb() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') throw new Error('Sem permissão')
  return createAdminClient()
}

// ── Deletar pergunta ──────────────────────────────────────────
export async function deleteQuizQuestion(question_id: string): Promise<{ ok: boolean }> {
  const db = await getDb()

  // Apagar respostas primeiro (FK sem CASCADE)
  const { error: aErr } = await db
    .from('onboarding_answers')
    .delete()
    .eq('question_id', question_id)
  if (aErr) throw new Error('Erro ao apagar respostas: ' + aErr.message)

  // Apagar a pergunta e verificar se realmente apagou
  const { data: deleted, error: qErr } = await db
    .from('onboarding_questions')
    .delete()
    .eq('id', question_id)
    .select('id')

  if (qErr) throw new Error('Erro ao apagar pergunta: ' + qErr.message)
  if (!deleted || deleted.length === 0)
    throw new Error(`Pergunta não encontrada no banco (id: ${question_id})`)

  return { ok: true }
}

// ── Atualizar pergunta ────────────────────────────────────────
export async function updateQuizQuestion(
  question_id: string,
  question: string,
  answers: { answer_text: string; is_correct: boolean }[]
): Promise<{ ok: boolean; question: any }> {
  const db = await getDb()

  const { error: qErr } = await db
    .from('onboarding_questions')
    .update({ question: question.trim() })
    .eq('id', question_id)
  if (qErr) throw new Error('Erro ao atualizar pergunta: ' + qErr.message)

  // Recriar respostas
  await db.from('onboarding_answers').delete().eq('question_id', question_id)
  const rows = answers
    .filter(a => a.answer_text?.trim())
    .map((a, i) => ({ question_id, answer_text: a.answer_text.trim(), is_correct: a.is_correct, order_index: i }))

  if (rows.length) {
    const { error: aErr } = await db.from('onboarding_answers').insert(rows)
    if (aErr) throw new Error('Erro ao salvar respostas: ' + aErr.message)
  }

  const { data: updated } = await db
    .from('onboarding_questions')
    .select('*, onboarding_answers(*)')
    .eq('id', question_id)
    .single()

  return { ok: true, question: updated }
}
