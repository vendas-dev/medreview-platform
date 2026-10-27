import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hUpdateKnowledge, hDeleteKnowledge } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hUpdateKnowledge(createAdminClient(), a.userId, (await params).id, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
export async function DELETE(_: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hDeleteKnowledge(createAdminClient(), a.userId, (await params).id)
  return NextResponse.json(r.json, { status: r.status })
}
