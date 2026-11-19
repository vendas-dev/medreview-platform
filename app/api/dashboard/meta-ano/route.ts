import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { computeRealizadoAno } from '@/lib/dashboard/metaAnoServer'

export const dynamic = 'force-dynamic'

// Meta do ano (Forecast): quanto já foi vendido de 1º de janeiro até hoje. Só superadmin (mesma regra do resto do forecast).
export async function GET() {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  try {
    return NextResponse.json(await computeRealizadoAno(createAdminClient()), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[forecast/meta-ano]', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao calcular a receita do ano' }, { status: 500 })
  }
}
