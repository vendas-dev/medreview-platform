import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hResolveGap } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// Marca a lacuna como tratada (documentada ou descartada) e ela sai da lista. Body: { resolved?: boolean }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const body = await req.json().catch(() => null)
  const r = await hResolveGap(createAdminClient(), (await params).id, body?.resolved !== false)
  return NextResponse.json(r.json, { status: r.status })
}
