import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hChat } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Envia uma pergunta e devolve a resposta em STREAMING (uma linha JSON por evento: start · delta · done · error).
// Body: { conversationId?: string, message?: string, regenerate?: boolean }
export async function POST(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hChat(createAdminClient(), a.userId, await req.json().catch(() => null))
  if ('stream' in r) return new Response(r.stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } })
  return NextResponse.json(r.json, { status: r.status })
}
