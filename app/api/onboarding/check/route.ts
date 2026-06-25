import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id, completed } = await req.json()

  if (type === 'material') {
    if (completed) {
      // Marcar material como visto
      const { error } = await supabase
        .from('onboarding_material_views')
        .upsert(
          { user_id: user.id, material_id: id, completed: true, viewed_at: new Date().toISOString() },
          { onConflict: 'user_id,material_id' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // Desmarcar
      await supabase
        .from('onboarding_material_views')
        .delete()
        .eq('user_id', user.id)
        .eq('material_id', id)
    }
  }

  if (type === 'video') {
    if (completed) {
      const { error } = await supabase
        .from('onboarding_video_views')
        .upsert(
          { user_id: user.id, video_id: id, completed: true, watched_at: new Date().toISOString() },
          { onConflict: 'user_id,video_id' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      await supabase
        .from('onboarding_video_views')
        .delete()
        .eq('user_id', user.id)
        .eq('video_id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
