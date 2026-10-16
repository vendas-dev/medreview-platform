import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/campaigns/auth'
import { hMarkRead } from '@/lib/campaigns/handlers'

export const dynamic = 'force-dynamic'

// Marca como lida SÓ as da pessoa logada. Body: { ids: string[] } ou { all: true }
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await hMarkRead(createAdminClient(), s.userId, await req.json().catch(() => ({})))
  return NextResponse.json(r.json, { status: r.status })
}
