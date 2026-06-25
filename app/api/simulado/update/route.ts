import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if ((profile as any)?.role !== 'superadmin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { id, nota_minima, titulo, descricao, team } = body

    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const updates: any = {}
    if (nota_minima !== undefined) updates.nota_minima = Number(nota_minima)
    if (titulo      !== undefined) updates.titulo      = titulo
    if (descricao   !== undefined) updates.descricao   = descricao
    if (team        !== undefined) updates.team        = team

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('simulados')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
