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
  const supabase = await createClient()
  const { data: last } = await supabase
    .from('onboarding_steps').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  await supabase.from('onboarding_steps').insert({
    title:               formData.get('title'),
    description:         formData.get('description') || null,
    estimated_minutes:   formData.get('estimated_minutes') ? Number(formData.get('estimated_minutes')) : null,
    team:                formData.get('team'),
    completion_criteria: formData.get('completion_criteria'),
    min_quiz_score:      Number(formData.get('min_quiz_score') || 70),
    max_attempts:        formData.get('max_attempts') ? Number(formData.get('max_attempts')) : null,
    order_index:         ((last as any)?.order_index ?? -1) + 1,
  })
  revalidatePath('/onboarding/trilha')
}

export async function updateStep(formData: FormData) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_steps').update({
    title:               formData.get('title'),
    description:         formData.get('description') || null,
    estimated_minutes:   formData.get('estimated_minutes') ? Number(formData.get('estimated_minutes')) : null,
    team:                formData.get('team'),
    completion_criteria: formData.get('completion_criteria'),
    min_quiz_score:      Number(formData.get('min_quiz_score') || 70),
    max_attempts:        formData.get('max_attempts') ? Number(formData.get('max_attempts')) : null,
    updated_at:          new Date().toISOString(),
  }).eq('id', formData.get('id') as string)
  revalidatePath('/onboarding/trilha')
}

export async function deleteStep(id: string) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('onboarding_steps').delete().eq('id', id)
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

// ── Materials ──────────────────────────────────────────────
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
  const supabase = await createClient()
  await supabase.from('onboarding_faqs').update({
    question:   formData.get('question'),
    answer:     formData.get('answer'),
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id') as string)
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
  revalidatePath('/onboarding')
}

export async function markMaterialViewed(materialId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('onboarding_material_views').upsert({
    user_id: user.id, material_id: materialId,
  }, { onConflict: 'user_id,material_id', ignoreDuplicates: true })
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
  await supabase.from('onboarding_progress').upsert({
    user_id: user.id, step_id: stepId,
    status: passed ? 'concluido' : 'em_andamento',
    ...(passed ? { completed_at: new Date().toISOString() } : {}),
    quiz_score: score, quiz_attempts: attempts,
  }, { onConflict: 'user_id,step_id' })
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
