import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { computeYoY } from '@/lib/dashboard/yoyServer'

export const dynamic = 'force-dynamic'

// Forecast → "este mês × o mesmo mês do ano passado": receita por dia e por vertical dos dois meses. Só superadmin (mesma regra do resto do forecast).
export async function GET() {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  try {
    return NextResponse.json(await computeYoY(createAdminClient()), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[forecast/yoy]', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao calcular o comparativo com o ano passado' }, { status: 500 })
  }
}
