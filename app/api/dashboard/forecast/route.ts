import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeForecastLive, computeForecastHistory } from '@/lib/dashboard/forecastAnalysis'

export const dynamic = 'force-dynamic'

// scope=live  → só o que muda a todo instante (links de hoje + meta x realizado).
//               É o que o painel pede a cada ~10s, então precisa ser leve.
// scope=full  → live + histórico de 15 dias. O histórico só muda na virada do
//               dia (hoje não entra nele), por isso não é recalculado a cada
//               atualização ao vivo.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const scope = req.nextUrl.searchParams.get('scope') === 'full' ? 'full' : 'live'
  const admin = createAdminClient()

  try {
    const [live, history] = await Promise.all([
      computeForecastLive(admin, req.nextUrl.searchParams.get('since')),
      scope === 'full' ? computeForecastHistory(admin) : Promise.resolve(undefined),
    ])
    return NextResponse.json({ ...live, history }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[forecast] erro:', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao calcular o forecast' }, { status: 500 })
  }
}
