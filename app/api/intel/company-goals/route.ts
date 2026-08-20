import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') return null
  return user
}

// GET /api/intel/company-goals?month=2026-08
// Devolve { goals: { geral: number, 'Anest-Review': number, ... } }
export async function GET(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month é obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('company_goals').select('scope, goal_value').eq('month', month)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const goals = Object.fromEntries((data ?? []).map((g: any) => [g.scope, Number(g.goal_value) || 0]))
  return NextResponse.json({ goals })
}

// POST { month: '2026-08', goals: { geral: 1000000, 'Anest-Review': 200000, ... } }
// Salva/atualiza todos os escopos enviados de uma vez.
export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const month = body?.month as string | undefined
  const goals = body?.goals as Record<string, number> | undefined
  if (!month || !goals || Object.keys(goals).length === 0) {
    return NextResponse.json({ error: 'month e goals são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const rows = Object.entries(goals).map(([scope, goal_value]) => ({
    month, scope, goal_value: Number(goal_value) || 0, updated_at: new Date().toISOString(),
  }))

  const { error } = await admin.from('company_goals').upsert(rows, { onConflict: 'month,scope' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
