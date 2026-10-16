import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCampaignTick } from '@/lib/campaigns/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// OPCIONAL: reforço da apuração automática (que já roda quando as pessoas abrem a plataforma).
// Protegida pelo mesmo CRON_SECRET das outras rotinas agendadas.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json({ ok: true, ...(await runCampaignTick(createAdminClient())) }) }
  catch (e: any) { console.error('[cron campanhas]', e?.message ?? e); return NextResponse.json({ error: 'Erro na apuração' }, { status: 500 }) }
}
