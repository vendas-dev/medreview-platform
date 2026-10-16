import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hCampaignAction } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Body: { action: 'publish' | 'cancel' | 'duplicate' | 'refresh' | 'delivered', winnerId?, delivered?, shiftDays? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hCampaignAction(createAdminClient(), (await params).id, a.userId, await req.json().catch(() => ({})))
  return NextResponse.json(r.json, { status: r.status })
}
