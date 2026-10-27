import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hGetSettings, hPutSettings } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'

// Prompt geral, tom, limite de resposta, modelo e perguntas sugeridas (compartilhado pelo time de Sales Ops).
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hGetSettings(createAdminClient())
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
export async function PUT(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hPutSettings(createAdminClient(), a.userId, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
