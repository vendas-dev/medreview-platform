'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath }    from 'next/cache'
import { redirect }          from 'next/navigation'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') redirect('/dashboard')
  return { supabase, user }
}

// ── Settings ───────────────────────────────────────────────
export async function saveSettings(formData: FormData) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_settings').update({
    welcome_message:    formData.get('welcome_message'),
    tone:               formData.get('tone'),
    extra_instructions: formData.get('extra_instructions'),
    track_mode:         formData.get('track_mode'),
    updated_at:         new Date().toISOString(),
  }).eq('id', '00000000-0000-0000-0000-000000000001')
  revalidatePath('/onboarding/config')
}

// ── Steps ──────────────────────────────────────────────────
export async function createStep(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data: last } = await admin
    .from('onboarding_steps').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const { error } = await admin.from('onboarding_steps').insert({
    title:               formData.get('title'),
    description:         formData.get('description') || null,
    estimated_minutes:   formData.get('estimated_minutes') ? Number(formData.get('estimated_minutes')) : null,
    team:                formData.get('team'),
    day_number:          formData.get('day_number') ? Number(formData.get('day_number')) : null,
    completion_criteria: formData.get('completion_criteria'),
    min_quiz_score:      Number(formData.get('min_quiz_score') || 70),
    max_attempts:        formData.get('max_attempts') ? Number(formData.get('max_attempts')) : null,
    order_index:         ((last as any)?.order_index ?? -1) + 1,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/onboarding/trilha')
}

export async function updateStep(formData: FormData) {
  await assertAdmin()
  // Usar adminClient: o client comum é bloqueado por RLS silenciosamente aqui
  // (mesmo bug já corrigido no deleteStep — "salva" sem erro, mas não grava).
  const admin = createAdminClient()
  const { error } = await admin.from('onboarding_steps').update({
    title:               formData.get('title'),
    description:         formData.get('description') || null,
    estimated_minutes:   formData.get('estimated_minutes') ? Number(formData.get('estimated_minutes')) : null,
    team:                formData.get('team'),
    day_number:          formData.get('day_number') ? Number(formData.get('day_number')) : null,
    completion_criteria: formData.get('completion_criteria'),
    min_quiz_score:      Number(formData.get('min_quiz_score') || 70),
    max_attempts:        formData.get('max_attempts') ? Number(formData.get('max_attempts')) : null,
    updated_at:          new Date().toISOString(),
  }).eq('id', formData.get('id') as string)
  if (error) throw new Error(error.message)
  revalidatePath('/onboarding/trilha')
}

export async function deleteStep(id: string) {
  await assertAdmin()
  // Usar adminClient para garantir bypass de RLS (corrige bug de algumas etapas não excluindo)
  const admin = createAdminClient()
  // Soft delete: desativa em vez de excluir fisicamente para preservar integridade referencial
  const { error } = await admin
    .from('onboarding_steps')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/onboarding/trilha')
}

export async function reorderSteps(orderedIds: string[]) {
  await assertAdmin()
  const supabase = await createClient()
  await Promise.all(orderedIds.map((id, index) =>
    supabase.from('onboarding_steps').update({ order_index: index }).eq('id', id)
  ))
  revalidatePath('/onboarding/trilha')
}

// Troca o order_index entre exatamente 2 etapas (usado pelo mover pra cima/baixo,
// escopado ao dia). Não renumera a lista inteira, então nunca embaralha outros dias.
export async function swapStepOrder(idA: string, idB: string) {
  await assertAdmin()
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('onboarding_steps')
    .select('id, order_index')
    .in('id', [idA, idB])
  const a = (rows as any[])?.find(r => r.id === idA)
  const b = (rows as any[])?.find(r => r.id === idB)
  if (!a || !b) return
  await Promise.all([
    supabase.from('onboarding_steps').update({ order_index: b.order_index }).eq('id', a.id),
    supabase.from('onboarding_steps').update({ order_index: a.order_index }).eq('id', b.id),
  ])
  revalidatePath('/onboarding/trilha')
}

// ── Materials ──────────────────────────────────────────────

export async function duplicateStep(id: string) {
  await assertAdmin()
  const admin = createAdminClient()

  // Buscar etapa original
  const { data: orig } = await admin
    .from('onboarding_steps').select('*').eq('id', id).single()
  if (!orig) throw new Error('Etapa não encontrada')

  const origOrder = (orig as any).order_index as number

  // Abrir espaço: incrementar order_index de todas as etapas após a original.
  // (Sem depender de RPC — mais previsível e não quebra se a function não existir no banco.)
  const { data: after } = await admin
    .from('onboarding_steps')
    .select('id, order_index')
    .eq('is_active', true)
    .gt('order_index', origOrder)
    .order('order_index', { ascending: false })
  for (const s of (after ?? [])) {
    await admin.from('onboarding_steps')
      .update({ order_index: (s as any).order_index + 1 })
      .eq('id', (s as any).id)
  }

  // Inserir cópia logo abaixo da original
  const { data: nova, error } = await admin.from('onboarding_steps').insert({
    title:               `${(orig as any).title} (cópia)`,
    description:         (orig as any).description,
    estimated_minutes:   (orig as any).estimated_minutes,
    team:                (orig as any).team,
    day_number:          (orig as any).day_number,
    completion_criteria: (orig as any).completion_criteria,
    min_quiz_score:      (orig as any).min_quiz_score,
    max_attempts:        (orig as any).max_attempts,
    order_index:         origOrder + 1,
    is_active:           true,
  }).select().single()

  if (error) throw new Error(error.message)
  revalidatePath('/onboarding/trilha')
  return nova
}

export async function createMaterial(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const stepId = formData.get('step_id') as string

  const { data: last } = await admin
    .from('onboarding_materials').select('order_index')
    .eq('step_id', stepId).order('order_index', { ascending: false }).limit(1).single()

  const thumbUrl = formData.get('thumbnail_url') as string || null

  // Tentar inserir COM thumbnail_url primeiro, fallback sem se coluna não existir
  let { error } = await admin.from('onboarding_materials').insert({
    step_id:       stepId,
    title:         formData.get('title'),
    description:   formData.get('description') || null,
    url:           formData.get('url'),
    type:          formData.get('type'),
    thumbnail_url: thumbUrl,
    order_index:   ((last as any)?.order_index ?? -1) + 1,
  })

  // Se falhou por causa da coluna thumbnail_url não existir, tenta sem ela
  if (error && error.message.includes('thumbnail_url')) {
    const { error: error2 } = await admin.from('onboarding_materials').insert({
      step_id:     stepId,
      title:       formData.get('title'),
      description: formData.get('description') || null,
      url:         formData.get('url'),
      type:        formData.get('type'),
      order_index: ((last as any)?.order_index ?? -1) + 1,
    })
    if (error2) throw new Error(error2.message)
  } else if (error) {
    throw new Error(error.message)
  }
  revalidatePath(`/onboarding/trilha/${stepId}`)
}


export async function updateMaterial(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const id     = formData.get('id') as string
  const stepId = formData.get('step_id') as string

  const thumbUrl = formData.get('thumbnail_url') as string | null
  const { error } = await admin.from('onboarding_materials').update({
    title:         formData.get('title'),
    description:   formData.get('description') || null,
    url:           formData.get('url'),
    type:          formData.get('type'),
    thumbnail_url: thumbUrl || null,
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath(`/onboarding/trilha/${stepId}`)
}

export async function deleteMaterial(id: string, stepId: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_materials').delete().eq('id', id)
  revalidatePath(`/onboarding/trilha/${stepId}`)
}

// ── FAQs ───────────────────────────────────────────────────
export async function createFaq(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const stepId = formData.get('step_id') as string

  const { error } = await admin.from('onboarding_faqs').insert({
    step_id:  stepId,
    question: formData.get('question'),
    answer:   formData.get('answer'),
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/onboarding/trilha/${stepId}`)
}

export async function updateFaq(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('onboarding_faqs').update({
    question:   formData.get('question'),
    answer:     formData.get('answer'),
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id') as string)
  if (error) throw new Error(error.message)
  revalidatePath(`/onboarding/trilha/${formData.get('step_id')}`)
}

export async function deleteFaq(id: string, stepId: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_faqs').delete().eq('id', id)
  revalidatePath(`/onboarding/trilha/${stepId}`)
}

// ── Questions & Answers ────────────────────────────────────
export async function createQuestion(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const stepId = formData.get('step_id') as string

  const { data: q, error: qErr } = await admin.from('onboarding_questions').insert({
    step_id:     stepId,
    question:    formData.get('question'),
    explanation: formData.get('explanation') || null,
  }).select().single()

  if (qErr) throw new Error(qErr.message)

  const answers = JSON.parse(formData.get('answers') as string)
  if (q && answers?.length) {
    const { error: aErr } = await admin.from('onboarding_answers').insert(
      answers.map((a: any, i: number) => ({
        question_id: (q as any).id,
        answer_text: a.text,
        is_correct:  a.is_correct,
        order_index: i,
      }))
    )
    if (aErr) throw new Error(aErr.message)
  }

  revalidatePath(`/onboarding/trilha/${stepId}`)
}

export async function updateQuestion(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const id = formData.get('id') as string
  const stepId = formData.get('step_id') as string

  // Atualizar o enunciado
  const { error: qErr } = await admin.from('onboarding_questions').update({
    question:    formData.get('question'),
    explanation: formData.get('explanation') || null,
  }).eq('id', id)
  if (qErr) throw new Error(qErr.message)

  // Substituir as alternativas: deletar as antigas, inserir as novas
  await admin.from('onboarding_answers').delete().eq('question_id', id)
  const answers = JSON.parse(formData.get('answers') as string)
  if (answers?.length) {
    const { error: aErr } = await admin.from('onboarding_answers').insert(
      answers.map((a: any, i: number) => ({
        question_id: id,
        answer_text: a.text,
        is_correct:  a.is_correct,
        order_index: i,
      }))
    )
    if (aErr) throw new Error(aErr.message)
  }

  revalidatePath(`/onboarding/trilha/${stepId}`)
}

export async function deleteQuestion(id: string, stepId: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_questions').delete().eq('id', id)
  revalidatePath(`/onboarding/trilha/${stepId}`)
}

// ── Videos ─────────────────────────────────────────────────
export async function createVideo(formData: FormData) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_videos').insert({
    title:         formData.get('title'),
    description:   formData.get('description') || null,
    url:           formData.get('url'),
    thumbnail_url: formData.get('thumbnail_url') || null,
    team:          formData.get('team'),
    duration_min:  formData.get('duration_min') ? Number(formData.get('duration_min')) : null,
  })
  revalidatePath('/onboarding/videoaulas')
}

export async function updateVideo(formData: FormData) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_videos').update({
    title:         formData.get('title'),
    description:   formData.get('description') || null,
    url:           formData.get('url'),
    thumbnail_url: formData.get('thumbnail_url') || null,
    team:          formData.get('team'),
    duration_min:  formData.get('duration_min') ? Number(formData.get('duration_min')) : null,
    updated_at:    new Date().toISOString(),
  }).eq('id', formData.get('id') as string)
  revalidatePath('/onboarding/videoaulas')
}

export async function deleteVideo(id: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_videos').delete().eq('id', id)
  revalidatePath('/onboarding/videoaulas')
}

// ── Progress ───────────────────────────────────────────────
export async function startStep(stepId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('onboarding_progress').upsert({
    user_id: user.id, step_id: stepId,
    status: 'em_andamento', started_at: new Date().toISOString(),
  }, { onConflict: 'user_id,step_id', ignoreDuplicates: false })
  await maybeCompleteStep(supabase, user.id, stepId)
  revalidatePath('/onboarding')
}

// Decide se a etapa deve ser marcada como concluída, de acordo com o
// completion_criteria dela:
//  - apenas_visualizar: sem conteúdo — completa só de entrar na etapa
//  - visualizar: precisa ter material(is) cadastrado(s) e todos vistos
//  - quiz: precisa passar no quiz
//  - ambos: as duas coisas acima
// Chamado ao ver material, ao terminar o quiz e ao iniciar a etapa — sem
// isso, etapas de "visualizar material" ou sem conteúdo nunca fechavam.
async function maybeCompleteStep(supabase: any, userId: string, stepId: string) {
  const { data: step } = await supabase
    .from('onboarding_steps').select('completion_criteria').eq('id', stepId).single()
  const criteria = (step as any)?.completion_criteria ?? 'visualizar'

  if (criteria === 'apenas_visualizar') {
    await supabase.from('onboarding_progress').upsert({
      user_id: userId, step_id: stepId,
      status: 'concluido', completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,step_id' })
    return
  }

  let materialsOk = true
  if (criteria === 'visualizar' || criteria === 'ambos') {
    const { data: materials } = await supabase.from('onboarding_materials').select('id').eq('step_id', stepId)
    const total = (materials ?? []).length
    if (total === 0) {
      // Critério exige material, mas nenhum foi cadastrado — configuração
      // incompleta, não deixa completar sozinho (evita "falso concluído").
      materialsOk = false
    } else {
      const ids = (materials ?? []).map((m: any) => m.id)
      const { data: views } = await supabase.from('onboarding_material_views')
        .select('material_id').eq('user_id', userId).in('material_id', ids)
      materialsOk = (views ?? []).length >= total
    }
  }

  let quizOk = true
  if (criteria === 'quiz' || criteria === 'ambos') {
    const { data: passedAttempt } = await supabase.from('onboarding_quiz_attempts')
      .select('id').eq('user_id', userId).eq('step_id', stepId).eq('passed', true).limit(1).maybeSingle()
    quizOk = !!passedAttempt
  }

  if (materialsOk && quizOk) {
    await supabase.from('onboarding_progress').upsert({
      user_id: userId, step_id: stepId,
      status: 'concluido', completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,step_id' })
  }
}

// Revalida se a etapa deve fechar sempre que o usuário abre a página dela —
// cobre o caso de uma etapa que já estava "em andamento" e o critério de
// conclusão foi trocado depois (ex: pra 'apenas_visualizar'), sem precisar
// de nenhuma ação manual extra do usuário.
export async function ensureStepCompletion(stepId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await maybeCompleteStep(supabase, user.id, stepId)
}

export async function markMaterialViewed(materialId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('onboarding_material_views').upsert({
    user_id: user.id, material_id: materialId,
  }, { onConflict: 'user_id,material_id', ignoreDuplicates: true })

  const { data: material } = await supabase
    .from('onboarding_materials').select('step_id').eq('id', materialId).single()
  if ((material as any)?.step_id) await maybeCompleteStep(supabase, user.id, (material as any).step_id)
}

// Flashcards (ex-FAQ) — marcação pessoal de "acertei/errei", só o próprio
// usuário vê (RLS restringe por user_id). Clicar de novo no mesmo estado
// desmarca (status = null).
export async function setFaqReview(faqId: string, status: 'correct' | 'wrong' | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (status === null) {
    await supabase.from('onboarding_faq_reviews').delete()
      .eq('user_id', user.id).eq('faq_id', faqId)
    return
  }
  await supabase.from('onboarding_faq_reviews').upsert({
    user_id: user.id, faq_id: faqId, status, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,faq_id' })
}

export async function submitQuiz(stepId: string, answers: Record<string, string>, score: number, passed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('onboarding_quiz_attempts').insert({
    user_id: user.id, step_id: stepId, score, passed, answers,
  })
  const { data: prog } = await supabase
    .from('onboarding_progress').select('quiz_attempts').eq('user_id', user.id).eq('step_id', stepId).single()
  const attempts = ((prog as any)?.quiz_attempts ?? 0) + 1

  // Só fecha a etapa direto aqui se o critério for exatamente 'quiz'. Se for
  // 'ambos' (ou 'visualizar' com quiz sobrando), quem decide é o
  // maybeCompleteStep abaixo, que também exige o material visto.
  const { data: stepRow } = await supabase.from('onboarding_steps').select('completion_criteria').eq('id', stepId).single()
  const criteria = (stepRow as any)?.completion_criteria ?? 'visualizar'
  const closesHere = passed && criteria === 'quiz'

  await supabase.from('onboarding_progress').upsert({
    user_id: user.id, step_id: stepId,
    status: closesHere ? 'concluido' : 'em_andamento',
    ...(closesHere ? { completed_at: new Date().toISOString() } : {}),
    quiz_score: score, quiz_attempts: attempts,
  }, { onConflict: 'user_id,step_id' })

  if (passed) await maybeCompleteStep(supabase, user.id, stepId)
  revalidatePath('/onboarding')
}

export async function markVideoWatched(videoId: string, timeWatched: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('onboarding_video_views').upsert({
    user_id: user.id, video_id: videoId,
    watched_at: new Date().toISOString(),
    time_watched_min: timeWatched, completed: true,
  }, { onConflict: 'user_id,video_id' })
}
