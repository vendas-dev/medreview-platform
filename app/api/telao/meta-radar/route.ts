import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeYoY } from '@/lib/dashboard/yoyServer'
import { radarOf } from '@/lib/dashboard/yoy'
import { usaMetaRadarHoje } from '@/lib/telao/metaRadarHoje'

export const dynamic = 'force-dynamic'

// Telão → a "Meta de hoje" do Radar (Operação), só nas datas da exceção (lib/telao/metaRadarHoje.ts). Qualquer usuário logado (o telão é aberto a todos); devolve só esse número.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const d = await computeYoY(createAdminClient())
    if (!usaMetaRadarHoje(d.today)) return NextResponse.json({ date: d.today, meta: null }, { headers: { 'Cache-Control': 'no-store' } })
    const r = radarOf(d, 'total'), hoje = r.ok ? r.linhas.find(l => l.date === d.today) : undefined
    return NextResponse.json({ date: d.today, meta: hoje && hoje.ajustada > 0 ? hoje.ajustada : null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('[telao/meta-radar]', e instanceof Error ? e.message : e)
    return NextResponse.json({ date: null, meta: null }, { status: 500 })
  }
}
