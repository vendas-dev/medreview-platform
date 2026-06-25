import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: completions },
    { data: quizzes },
    { data: videoViews },
    { data: materialViews },
    { data: simulados },
  ] = await Promise.all([
    supabase.from('onboarding_progress')
      .select('step_id, status, completed_at')
      .eq('user_id', user.id).eq('status', 'concluido')
      .gte('completed_at', since).order('completed_at', { ascending: false }).limit(20),

    supabase.from('onboarding_quiz_attempts')
      .select('step_id, score, passed, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(20),

    // Vídeos da biblioteca de videoaulas
    supabase.from('onboarding_video_views')
      .select('video_id, watched_at, completed')
      .eq('user_id', user.id).eq('completed', true)
      .gte('watched_at', since).order('watched_at', { ascending: false }).limit(20),

    // Materiais marcados como vistos (com join para pegar o type)
    supabase.from('onboarding_material_views')
      .select('material_id, viewed_at, onboarding_materials!inner(id, title, type)')
      .eq('user_id', user.id)
      .gte('viewed_at', since).order('viewed_at', { ascending: false }).limit(20),

    // Simulados realizados
    supabase.from('simulado_attempts')
      .select('simulado_numero, score, passed, completed_at')
      .eq('user_id', user.id)
      .gte('completed_at', since).order('completed_at', { ascending: false }).limit(5),
  ])

  // Buscar títulos das etapas
  const stepIds = [
    ...(completions ?? []).map((c: any) => c.step_id),
    ...(quizzes     ?? []).map((q: any) => q.step_id),
  ]
  const videoIds    = (videoViews    ?? []).map((v: any) => v.video_id)
  const materialIds = (materialViews ?? []).map((m: any) => m.material_id)

  const [{ data: steps }, { data: videos }, { data: materials }] = await Promise.all([
    stepIds.length    > 0 ? supabase.from('onboarding_steps').select('id, title').in('id', [...new Set(stepIds)]) : Promise.resolve({ data: [] }),
    videoIds.length   > 0 ? supabase.from('onboarding_videos').select('id, title').in('id', [...new Set(videoIds)]) : Promise.resolve({ data: [] }),
    materialIds.length> 0 ? supabase.from('onboarding_materials').select('id, title').in('id', [...new Set(materialIds)]) : Promise.resolve({ data: [] }),
  ])

  const stepMap     = Object.fromEntries((steps     ?? []).map((s: any) => [s.id, s.title]))
  const videoMap    = Object.fromEntries((videos    ?? []).map((v: any) => [v.id, v.title]))
  const materialMap = Object.fromEntries((materials ?? []).map((m: any) => [m.id, m.title]))

  type Activity = { type: string; subject: string; time: string; icon: string; color: string; detail?: string }
  const activities: Activity[] = []

  ;(completions ?? []).forEach((c: any) => {
    const title = stepMap[c.step_id]
    if (title) activities.push({ type:'completion', subject:title, time:c.completed_at, icon:'🏆', color:'#22c55e' })
  })
  ;(quizzes ?? []).forEach((q: any) => {
    const title = stepMap[q.step_id]
    if (title) activities.push({ type:'quiz', subject:title, time:q.created_at, icon:q.passed?'✅':'📝', color:q.passed?'#3b82f6':'#f59e0b', detail:`${q.score}%` })
  })
  ;(videoViews ?? []).forEach((v: any) => {
    const title = videoMap[v.video_id]
    if (title) activities.push({ type:'video', subject:title, time:v.watched_at, icon:'🎬', color:'#8b5cf6' })
  })
  ;(materialViews ?? []).forEach((m: any) => {
    // Pegar o tipo do material via join
    const mat     = (m.onboarding_materials as any)
    const title   = mat?.title ?? materialMap[m.material_id]
    const matType = mat?.type ?? 'outro'
    if (!title) return

    if (matType === 'video') {
      // Vídeo da trilha — conta como 'video' (aparece no gráfico de vídeos assistidos)
      activities.push({ type:'video', subject:title, time:m.viewed_at, icon:'🎬', color:'#8b5cf6' })
    } else {
      // PDF, documento, etc — conta como 'material'
      activities.push({ type:'material', subject:title, time:m.viewed_at, icon:'📚', color:'#6366f1' })
    }
  })
  ;(simulados ?? []).forEach((s: any) => {
    activities.push({
      type:'simulado', subject:`Simulado Final ${s.simulado_numero}`,
      time:s.completed_at, icon:s.passed?'🏅':'📋',
      color:s.passed?'#22c55e':'#f59e0b', detail:`${s.score}%`
    })
  })

  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return NextResponse.json({ activities: activities.slice(0, 20) })
}
