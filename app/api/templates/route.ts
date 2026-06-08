import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('templates').insert({
    name: body.name, hubspot_name: body.hubspot_name || null,
    content: body.content, team: body.team, variables: body.variables,
    created_by: user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const admin = createAdminClient()
  await admin.from('templates').update({
    name: body.name, hubspot_name: body.hubspot_name || null,
    content: body.content, team: body.team, variables: body.variables,
    updated_at: new Date().toISOString(),
  }).eq('id', body.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  const admin = createAdminClient()
  await admin.from('templates').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
