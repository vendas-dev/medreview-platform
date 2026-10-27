import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hPromptPreview } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'

// O prompt EXATAMENTE como a IA o recebe (regras + prompt geral + base de processos ativos) e o tamanho estimado em tokens.
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hPromptPreview(createAdminClient(), a.userId)
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
