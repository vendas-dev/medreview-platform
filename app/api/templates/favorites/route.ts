import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase.from('template_favorites').select('template_id').eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favoriteIds: (data ?? []).map((r: any) => r.template_id) })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const templateId = body.template_id as string | undefined
  if (!templateId) return NextResponse.json({ error: 'template_id é obrigatório' }, { status: 400 })

  const { error } = await supabase.from('template_favorites')
    .upsert({ user_id: user.id, template_id: templateId }, { onConflict: 'user_id,template_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const templateId = body.template_id as string | undefined
  if (!templateId) return NextResponse.json({ error: 'template_id é obrigatório' }, { status: 400 })

  const { error } = await supabase.from('template_favorites')
    .delete().eq('user_id', user.id).eq('template_id', templateId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
