import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: completions },
    { data: quizzes },
    { data: videoWatches },
  ] = await Promise.all([
    supabase.from('onboarding_progress')
      .select('step_id, status, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'concluido')
      .gte('completed_at', since)
      .order('completed_at', { ascending: false })
      .limit(20),

    supabase.from('onboarding_quiz_attempts')
      .select('step_id, score, passed, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase.from('onboarding_video_views')
      .select('video_id, watched_at, completed')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('watched_at', since)
      .order('watched_at', { ascending: false })
      .limit(20),
  ])

  // Busca títulos
  const stepIds = [
    ...(completions ?? []).map((c: any) => c.step_id),
    ...(quizzes ?? []).map((q: any) => q.step_id),
  ]
  const videoIds = (videoWatches ?? []).map((v: any) => v.video_id)

  const [{ data: steps }, { data: videos }] = await Promise.all([
    stepIds.length > 0
      ? supabase.from('onboarding_steps').select('id, title').in('id', [...new Set(stepIds)])
      : Promise.resolve({ data: [] }),
    videoIds.length > 0
      ? supabase.from('onboarding_videos').select('id, title').in('id', [...new Set(videoIds)])
      : Promise.resolve({ data: [] }),
  ])

  const stepMap  = Object.fromEntries((steps  ?? []).map((s: any) => [s.id, s.title]))
  const videoMap = Object.fromEntries((videos ?? []).map((v: any) => [v.id, v.title]))

  type Activity = { type: string; subject: string; time: string; icon: string; color: string; detail?: string }
  const activities: Activity[] = []

  ;(completions ?? []).forEach((c: any) => {
    const title = stepMap[c.step_id]
    if (title) activities.push({ type: 'completion', subject: title, time: c.completed_at, icon: '🏆', color: '#22c55e' })
  })

  ;(quizzes ?? []).forEach((q: any) => {
    const title = stepMap[q.step_id]
    if (title) activities.push({
      type: 'quiz', subject: title, time: q.created_at,
      icon: q.passed ? '✅' : '📝', color: q.passed ? '#3b82f6' : '#f59e0b',
      detail: `${q.score}%`,
    })
  })

  ;(videoWatches ?? []).forEach((v: any) => {
    const title = videoMap[v.video_id]
    if (title) activities.push({ type: 'video', subject: title, time: v.watched_at, icon: '🎬', color: '#8b5cf6' })
  })

  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return NextResponse.json({ activities: activities.slice(0, 20) })
}
