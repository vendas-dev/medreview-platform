import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runChecks } from '@/lib/milestones/exams/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Chamado todo dia pela Vercel (cron). A Vercel envia "Authorization: Bearer <CRON_SECRET>"
// automaticamente quando a variável CRON_SECRET existe no projeto. Sem ela, a rota recusa tudo.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const s = await runChecks(createAdminClient())
    return NextResponse.json({ ok: true, inserted: s.inserted, updated: s.updated, staled: s.staled, sources: s.results.map(r => ({ name: r.source.name, status: r.status, found: r.items.length })) })
  } catch (e: any) {
    console.error('[cron exams] erro:', e?.message ?? e)
    return NextResponse.json({ error: 'Erro na verificação' }, { status: 500 })
  }
}
