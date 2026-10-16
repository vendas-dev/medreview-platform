import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hRecipients } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'

// Lista de pessoas que podem receber uma notificação (pro seletor da tela de envio).
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hRecipients(createAdminClient())
  return NextResponse.json(r.json, { status: r.status })
}
