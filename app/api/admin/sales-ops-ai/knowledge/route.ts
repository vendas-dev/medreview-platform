import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hListKnowledge, hCreateKnowledge } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'

// Base de processos (um item por processo). Body do POST: { title, category?, content?, links?: [{label,url}], is_active? }
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hListKnowledge(createAdminClient())
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hCreateKnowledge(createAdminClient(), a.userId, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
