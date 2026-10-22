import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { computeForecastDeals, parseDealsQuery } from '@/lib/dashboard/forecastDeals'

export const dynamic = 'force-dynamic'

// Lista de negócios por trás de um número do forecast (o popup que abre ao clicar).
//   ?scope=today|history  &status=all|paid|unpaid|lost  [&vertical=anest|oft|ortop|r1|outros]  [&hour=0-23 (today)]  [&day=AAAA-MM-DD (history)]
// Só superadmin (mesma regra da rota do forecast).
export async function GET(req: NextRequest) {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  const parsed = parseDealsQuery(req.nextUrl.searchParams)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    const r = await computeForecastDeals(createAdminClient(), parsed.query)
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[forecast/deals]', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao listar os negócios' }, { status: 500 })
  }
}
