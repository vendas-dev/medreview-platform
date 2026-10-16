import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hDeleteCampaign, hGetCampaign, hPatchCampaign } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
type Ctx = { params: Promise<{ id: string }> }

// Detalhe (com o ranking AO VIVO), edição e exclusão. As travas de edição/exclusão estão em lib/campaigns/handlers.ts.
export async function GET(_: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hGetCampaign(createAdminClient(), (await params).id)
  return NextResponse.json(r.json, { status: r.status })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hPatchCampaign(createAdminClient(), (await params).id, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hDeleteCampaign(createAdminClient(), (await params).id)
  return NextResponse.json(r.json, { status: r.status })
}
