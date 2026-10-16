import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hCreateCampaign, hListCampaigns } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Lista de campanhas (com fase, ganhadores e quantos concorrem) e criação (rascunho ou já publicando).
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hListCampaigns(createAdminClient())
  return NextResponse.json(r.json, { status: r.status })
}

export async function POST(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hCreateCampaign(createAdminClient(), a.userId, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
