import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/campaigns/auth'
import { hListNotifications } from '@/lib/campaigns/handlers'
import { maybeTick } from '@/lib/campaigns/server'

export const dynamic = 'force-dynamic'

// O sininho: as últimas 30 notificações da PESSOA LOGADA + quantas ainda não foram lidas.
// Aproveita a visita pra apurar as campanhas (no máx. 1× a cada 5 min, não importa quantos estejam online).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  after(async () => { try { await maybeTick(admin) } catch (e: any) { console.error('[campanhas] tick:', e?.message ?? e) } })
  const r = await hListNotifications(admin, s.userId)
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
