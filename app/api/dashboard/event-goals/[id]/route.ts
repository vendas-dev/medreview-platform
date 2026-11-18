import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/dashboard/requireSuperadmin'
import { computeLive } from '@/lib/dashboard/eventGoals'
import { parseConfig, rangesOverlap } from '@/lib/dashboard/eventGoalsCore'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperadmin(); if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
  try {
    const live = await computeLive(auth.admin, id)
    return live ? NextResponse.json(live) : NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  } catch (e: any) { return NextResponse.json({ error: e.message ?? 'Erro' }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperadmin(); if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
  const parsed = parseConfig(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const { data: all } = await auth.admin.from('event_editions').select('id, name, start_date, end_date').neq('id', id)
  const clash = (all ?? []).find((e: any) => rangesOverlap(e, v))
  if (clash) return NextResponse.json({ error: `Já existe o evento "${clash.name}" nessas datas (não pode haver dois eventos no mesmo dia).` }, { status: 409 })
  const { data: upd, error } = await auth.admin.from('event_editions')
    .update({ name: v.name, event_name: v.event_name, vertical: v.vertical, start_date: v.start_date, end_date: v.end_date, notes: v.notes })
    .eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!upd?.length) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  const { error: e2 } = await auth.admin.rpc('event_save_config', { p_edition: id, p_closers: v.closers, p_goals: v.goals })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperadmin(); if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
  const { error } = await auth.admin.from('event_editions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
