import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id, completed } = await req.json()

  if (type === 'material') {
    await supabase.from('onboarding_material_views').upsert({
      user_id: user.id, material_id: id, completed,
      viewed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,material_id' })
  } else if (type === 'video') {
    await supabase.from('onboarding_video_views').upsert({
      user_id: user.id, video_id: id, completed,
      watched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' })
  }

  return NextResponse.json({ ok: true })
}
