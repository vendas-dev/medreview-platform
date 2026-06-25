import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { simulado_id, simulado_numero, answers_log } = await req.json()
    if (!simulado_id || !answers_log) return NextResponse.json({ error: 'dados incompletos' }, { status: 400 })

    const admin = createAdminClient()

    // Verificar se já existe tentativa para este simulado
    const { data: existing } = await admin.from('simulado_attempts')
      .select('id').eq('user_id', user.id).eq('simulado_id', simulado_id).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Simulado já realizado' }, { status: 409 })

    // Buscar perguntas e respostas corretas
    const { data: questions } = await admin
      .from('simulado_questions')
      .select('id, simulado_answers(*)')
      .eq('simulado_id', simulado_id)

    if (!questions) return NextResponse.json({ error: 'Perguntas não encontradas' }, { status: 404 })

    // Calcular score
    let correct = 0
    const total = questions.length
    for (const q of questions) {
      const chosen_id = answers_log[q.id]
      const correct_answer = (q.simulado_answers as any[]).find((a: any) => a.is_correct)
      if (chosen_id && correct_answer && chosen_id === correct_answer.id) correct++
    }
    const wrong  = total - correct
    const score  = total > 0 ? Math.round((correct / total) * 100) : 0

    // Buscar nota mínima do simulado
    const { data: sim } = await admin.from('simulados').select('nota_minima').eq('id', simulado_id).single()
    const passed = score >= (sim?.nota_minima ?? 70)

    const { data, error } = await admin.from('simulado_attempts').insert({
      user_id: user.id, simulado_id, simulado_numero,
      score, total_questions: total, correct_answers: correct,
      wrong_answers: wrong, passed, answers_log,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, score, correct, wrong, total, passed, data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
