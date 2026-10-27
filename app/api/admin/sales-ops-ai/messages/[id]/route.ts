import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hFeedback } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// 👍 / 👎 numa resposta da IA. Body: { feedback: 1 | -1 | null, note?: string }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hFeedback(createAdminClient(), a.userId, (await params).id, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
