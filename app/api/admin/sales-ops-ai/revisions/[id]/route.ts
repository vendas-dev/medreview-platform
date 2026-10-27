import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hRestoreRevision } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// Restaura uma versão (e registra a restauração como uma nova versão — nada se perde).
export async function POST(_: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hRestoreRevision(createAdminClient(), a.userId, (await params).id)
  return NextResponse.json(r.json, { status: r.status })
}
