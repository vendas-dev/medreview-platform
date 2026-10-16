import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hPreview } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Prévia do criador: quantas pessoas concorrem e quem lideraria HOJE com as vendas que já existem.
export async function POST(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hPreview(createAdminClient(), await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
