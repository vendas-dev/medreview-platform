import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runChecks } from '@/lib/milestones/exams/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Botão "Verificar agora" (superadmin). Body opcional: { sourceId } pra verificar só uma fonte.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : undefined
  try {
    const s = await runChecks(createAdminClient(), { sourceId })
    return NextResponse.json({
      ok: true, inserted: s.inserted, updated: s.updated, staled: s.staled,
      sources: s.results.map(r => ({ name: r.source.name, status: r.status, found: r.items.length, message: r.message })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[exams] erro na verificação:', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao verificar as fontes' }, { status: 500 })
  }
}
