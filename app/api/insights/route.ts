import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { step_id, day_number, insight_type, content } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: 'content obrigatório' }, { status: 400 })
    if (!['step','final'].includes(insight_type)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin.from('user_insights').insert({
      user_id:      user.id,
      step_id:      step_id ?? null,
      day_number:   day_number ?? null,
      insight_type,
      content:      content.trim(),
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
