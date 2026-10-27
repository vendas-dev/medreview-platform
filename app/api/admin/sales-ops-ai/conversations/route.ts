import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hListConversations } from '@/lib/salesops/handlers'

export const dynamic = 'force-dynamic'

// Lista as conversas do PRÓPRIO superadmin (fixadas primeiro, depois as mais recentes). ?q= busca no título e no conteúdo; ?limit= e ?offset= paginam.
export async function GET(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const sp = req.nextUrl.searchParams
  const r = await hListConversations(createAdminClient(), a.userId, { q: sp.get('q') ?? '', limit: Number(sp.get('limit') ?? 40), offset: Number(sp.get('offset') ?? 0) })
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
