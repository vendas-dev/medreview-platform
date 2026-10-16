import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { hAdminNotifications, hSendNotification } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'

// Histórico dos últimos avisos (quantos receberam e quantos já leram) e envio de um aviso novo.
export async function GET() {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hAdminNotifications(createAdminClient())
  return NextResponse.json(r.json, { status: r.status })
}

export async function POST(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  const r = await hSendNotification(createAdminClient(), a.userId, await req.json().catch(() => null))
  return NextResponse.json(r.json, { status: r.status })
}
