import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { ajustesValidos, lerConfigRadar, spDate } from '@/lib/dashboard/yoyServer'

export const dynamic = 'force-dynamic'

// Configuração do Radar do mês de hoje (Brasília): a "Meta do Radar" e os ajustes manuais do plano. Só superadmin. A meta cadastrada em company_goals NÃO muda.
const mesAtual = () => spDate(new Date().toISOString()).slice(0, 7)
export async function GET() {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  const month = mesAtual()
  return NextResponse.json({ month, ...(await lerConfigRadar(createAdminClient(), month)) }, { headers: { 'Cache-Control': 'no-store' } })
}

/** PUT { meta?, ajustes? }: grava só o que veio. ajustes = [{ dia, planejada, para }] (a lista inteira; [] limpa). */
export async function PUT(req: Request) {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  let body: any; try { body = await req.json() } catch { return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 }) }
  const admin = createAdminClient(), month = mesAtual(), atual = await lerConfigRadar(admin, month)
  let meta = atual.meta, ajustes = atual.ajustes
  if (body?.meta !== undefined) {
    const m = Number(body.meta)
    if (!Number.isFinite(m) || m <= 0 || m > 1_000_000_000) return NextResponse.json({ error: 'Informe uma meta maior que zero (até R$ 1 bilhão).' }, { status: 400 })
    meta = Math.round(m * 100) / 100
  }
  if (body?.ajustes !== undefined) {
    if (!Array.isArray(body.ajustes)) return NextResponse.json({ error: 'Ajustes inválidos.' }, { status: 400 })
    ajustes = ajustesValidos(body.ajustes, month)
    if (ajustes.length !== body.ajustes.length) return NextResponse.json({ error: 'Ajuste inválido: use dias do mês, dias diferentes e valor ≥ 0.' }, { status: 400 })
  }
  if (!(meta > 0)) return NextResponse.json({ error: 'Defina primeiro a Meta do Radar.' }, { status: 400 })
  const { error } = await admin.from('forecast_radar_meta').upsert({ month, meta, ajustes, updated_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'month' })
  if (error) { console.error('[radar-meta]', error.message); return NextResponse.json({ error: 'Não foi possível salvar. Rodou o SQL forecast_radar_meta?' }, { status: 500 }) }
  return NextResponse.json({ month, meta, ajustes })
}
