import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hGaps } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'

// Lacunas: perguntas que a IA disse não ter documentado ou que receberam 👎 (do time todo; mostra só a pergunta, não a conversa).
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hGaps(createAdminClient())
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
