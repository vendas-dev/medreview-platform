import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { lerMetaRadar, spDate } from '@/lib/dashboard/yoyServer'

export const dynamic = 'force-dynamic'

// "Meta do Radar" do mês de hoje (Brasília). GET lê; PUT { meta } grava (só superadmin). A meta cadastrada em company_goals NÃO muda.
export async function GET() {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  const month = spDate(new Date().toISOString()).slice(0, 7)
  return NextResponse.json({ month, meta: await lerMetaRadar(createAdminClient(), month) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request) {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  let body: any; try { body = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 }) }
  const meta = Number(body?.meta)
  if (!Number.isFinite(meta) || meta <= 0 || meta > 1_000_000_000) return NextResponse.json({ error: 'Informe uma meta maior que zero (até R$ 1 bilhão).' }, { status: 400 })
  const month = spDate(new Date().toISOString()).slice(0, 7)
  const { error } = await createAdminClient().from('forecast_radar_meta').upsert({ month, meta: Math.round(meta * 100) / 100, updated_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'month' })
  if (error) { console.error('[radar-meta]', error.message); return NextResponse.json({ error: 'Não foi possível salvar. A tabela forecast_radar_meta foi criada?' }, { status: 500 }) }
  return NextResponse.json({ month, meta: Math.round(meta * 100) / 100 })
}
