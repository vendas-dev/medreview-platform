import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hGetConversation, hPatchConversation, hDeleteConversation } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// Mensagens de uma conversa, renomear/fixar e excluir — sempre só das conversas do próprio usuário.
export async function GET(_: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hGetConversation(createAdminClient(), a.userId, (await params).id)
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hPatchConversation(createAdminClient(), a.userId, (await params).id, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
export async function DELETE(_: NextRequest, { params }: Ctx) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hDeleteConversation(createAdminClient(), a.userId, (await params).id)
  return NextResponse.json(r.json, { status: r.status })
}
