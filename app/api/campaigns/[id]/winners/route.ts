import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/campaigns/auth'
import { hCampaignWinnersView } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'

// O popup que abre ao clicar num aviso de campanha: SÓ os vencedores e os prêmios, sem valores de venda.
// Qualquer pessoa logada pode chamar, mas o servidor devolve SÓ o time dela (superadmin vê os times da campanha).
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await hCampaignWinnersView(createAdminClient(), s.userId, (await params).id)
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
