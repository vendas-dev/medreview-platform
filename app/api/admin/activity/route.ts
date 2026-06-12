import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Busca eventos recentes de múltiplas tabelas em paralelo
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // últimos 7 dias

  const [
    { data: completions },   // etapas concluídas
    { data: quizPasses },    // quizzes passados
    { data: videoWatches },  // vídeos assistidos
    { data: stepCreations }, // etapas criadas
  ] = await Promise.all([
    admin.from('onboarding_progress')
      .select('user_id, step_id, completed_at, status')
      .eq('status', 'concluido')
      .gte('completed_at', since)
      .order('completed_at', { ascending: false })
      .limit(20),

    admin.from('onboarding_quiz_attempts')
      .select('user_id, step_id, score, passed, created_at')
      .eq('passed', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    admin.from('onboarding_video_views')
      .select('user_id, video_id, watched_at, completed')
      .eq('completed', true)
      .gte('watched_at', since)
      .order('watched_at', { ascending: false })
      .limit(20),

    admin.from('onboarding_steps')
      .select('id, title, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Busca perfis de todos os user_ids mencionados
  const userIds = new Set<string>()
  ;(completions ?? []).forEach((e: any) => userIds.add(e.user_id))
  ;(quizPasses ?? []).forEach((e: any) => userIds.add(e.user_id))
  ;(videoWatches ?? []).forEach((e: any) => userIds.add(e.user_id))

  const { data: profiles } = userIds.size > 0
    ? await admin.from('profiles').select('id, name, avatar_url').in('id', Array.from(userIds))
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  // Busca títulos de steps e vídeos
  const stepIds = new Set<string>()
  ;(completions ?? []).forEach((e: any) => stepIds.add(e.step_id))
  ;(quizPasses ?? []).forEach((e: any) => stepIds.add(e.step_id))

  const { data: steps } = stepIds.size > 0
    ? await admin.from('onboarding_steps').select('id, title').in('id', Array.from(stepIds))
    : { data: [] }
  const stepMap = Object.fromEntries((steps ?? []).map((s: any) => [s.id, s]))

  const videoIds = new Set<string>()
  ;(videoWatches ?? []).forEach((e: any) => videoIds.add(e.video_id))

  const { data: videos } = videoIds.size > 0
    ? await admin.from('onboarding_videos').select('id, title').in('id', Array.from(videoIds))
    : { data: [] }
  const videoMap = Object.fromEntries((videos ?? []).map((v: any) => [v.id, v]))

  // Monta feed de atividades
  type Activity = { type: string; user: any; subject: string; time: string; icon: string; color: string }
  const activities: Activity[] = []

  ;(completions ?? []).forEach((e: any) => {
    const u = profileMap[e.user_id]
    const s = stepMap[e.step_id]
    if (u && s) activities.push({
      type: 'completion', user: u, subject: s.title,
      time: e.completed_at, icon: '🏆', color: '#22c55e',
    })
  })

  ;(quizPasses ?? []).forEach((e: any) => {
    const u = profileMap[e.user_id]
    const s = stepMap[e.step_id]
    if (u && s) activities.push({
      type: 'quiz', user: u, subject: s.title,
      time: e.created_at, icon: '✅', color: '#3b82f6',
    })
  })

  ;(videoWatches ?? []).forEach((e: any) => {
    const u = profileMap[e.user_id]
    const v = videoMap[e.video_id]
    if (u && v) activities.push({
      type: 'video', user: u, subject: v.title,
      time: e.watched_at, icon: '🎬', color: '#8b5cf6',
    })
  })

  ;(stepCreations ?? []).forEach((e: any) => {
    activities.push({
      type: 'step_created', user: { name: 'Admin', avatar_url: null }, subject: e.title,
      time: e.created_at, icon: '📚', color: '#f59e0b',
    })
  })

  // Ordena por tempo decrescente e pega os 30 mais recentes
  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return NextResponse.json({ activities: activities.slice(0, 30) })
}
