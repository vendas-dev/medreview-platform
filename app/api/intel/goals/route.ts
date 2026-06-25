import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (p as any)?.role === 'superadmin' ? user : null
}

// GET /api/intel/goals?month=2026-06
export async function GET(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const month = req.nextUrl.searchParams.get('month') ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const admin = createAdminClient()

  const [{ data: closers }, { data: goals }] = await Promise.all([
    admin.from('profiles')
      .select('id, name, team')
      .neq('role', 'superadmin')
      .order('name'),
    admin.from('closer_goals')
      .select('*')
      .eq('month', month),
  ])

  const goalsMap = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))

  const result = (closers ?? []).map((c: any) => ({
    ...c,
    goal: goalsMap[c.id] ?? null,
  }))

  return NextResponse.json({ closers: result, month })
}

// POST /api/intel/goals
export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { user_id, month, goal_sales, goal_ambassador, goals_by_vertical } = body

  if (!user_id || !month) {
    return NextResponse.json({ error: 'user_id e month obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('closer_goals')
    .upsert(
      {
        user_id,
        month,
        goal_sales:        goal_sales        ?? 0,
        goal_ambassador:   goal_ambassador    ?? 0,
        goals_by_vertical: goals_by_vertical  ?? {},
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'user_id,month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ goal: data })
}
