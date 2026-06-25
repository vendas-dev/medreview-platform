import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { ProgressoView } from './ProgressoView'

export default async function ProgressoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, team').eq('id', user.id).single()
  const userTeam   = (profile as any)?.team
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const [
    { data: steps },
    { data: progress },
    { data: attempts },
    { data: avulsoViews },    // vídeos avulsos da biblioteca
    { data: materialViews },  // materiais marcados (trilha)
  ] = await Promise.all([
    supabase.from('onboarding_steps').select('*').eq('is_active', true)
      .in('team', teamFilter).order('order_index'),

    supabase.from('onboarding_progress').select('*').eq('user_id', user.id),

    supabase.from('onboarding_quiz_attempts').select('*').eq('user_id', user.id),

    // Vídeos avulsos — tabela original
    supabase.from('onboarding_video_views').select('*').eq('user_id', user.id),

    // Materiais da trilha marcados como concluídos (join para filtrar só type='video')
    supabase.from('onboarding_material_views')
      .select('*, onboarding_materials!inner(id, title, type)')
      .eq('user_id', user.id)
      .eq('completed', true),
  ])

  // Normalizar materiais de vídeo da trilha no mesmo formato de videoViews
  const trilhaVideoViews = (materialViews ?? [])
    .filter((mv: any) => mv.onboarding_materials?.type === 'video')
    .map((mv: any) => ({
      id:         mv.id,
      user_id:    mv.user_id,
      video_id:   mv.material_id,  // mapear material_id → video_id para compatibilidade
      completed:  mv.completed,
      watched_at: mv.viewed_at,
      _source:    'trilha',        // identificador de origem (opcional)
    }))

  // Combinar avulsos + vídeos da trilha
  const videoViews = [...(avulsoViews ?? []), ...trilhaVideoViews]

  return (
    <ProgressoView
      steps={steps ?? []}
      progress={progress ?? []}
      attempts={attempts ?? []}
      videoViews={videoViews}
    />
  )
}
