import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hListRevisions } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'

// Histórico de versões. ?kind=prompt  ou  ?kind=knowledge&ref=<id do processo>
export async function GET(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const sp = req.nextUrl.searchParams
  const r = await hListRevisions(createAdminClient(), { kind: sp.get('kind') ?? '', refId: sp.get('ref') })
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
