import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { todayInSaoPaulo, monthBoundsSaoPaulo } from '@/lib/timezone'
import { computeGoalAudit } from '@/lib/dashboard/goalsAudit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/dashboard/goals-audit            → o mês atual
// GET /api/dashboard/goals-audit?month=2026-10
// Só superadmin (abra no navegador logado). Mostra as metas cadastradas em /intel/goals, a receita do mês e o % de meta que CADA seção do painel calcula,
// com os alertas de divergência. Só lê; não altera nada.
export async function GET(req: NextRequest) {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  const today = todayInSaoPaulo()
  const month = req.nextUrl.searchParams.get('month') ?? today.slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'month deve ser AAAA-MM' }, { status: 400 })

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const dayOfMonth = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : month < today.slice(0, 7) ? daysInMonth : 1
  const { start, end } = monthBoundsSaoPaulo(month)
  const admin = createAdminClient()

  try {
    const [companyRes, closerRes] = await Promise.all([
      admin.from('company_goals').select('scope, goal_value').eq('month', month),
      admin.from('closer_goals').select('user_id, goal_sales, goals_by_vertical, goal_ambassador').eq('month', month),
    ])
    if (companyRes.error) throw new Error(`company_goals: ${companyRes.error.message}`)
    if (closerRes.error) throw new Error(`closer_goals: ${closerRes.error.message}`)

    // TODAS as vendas do mês, em páginas de 1.000 (o Supabase corta em 1.000 por consulta)
    const sales: { value: number | null; vertical: string | null }[] = []
    for (let from = 0; from < 200_000; from += 1000) {
      const { data, error } = await admin.from('telao_events').select('id, value, vertical').eq('event_type', 'sale').gte('occurred_at', start).lte('occurred_at', end).order('id', { ascending: true }).range(from, from + 999)
      if (error) throw new Error(`vendas: ${error.message}`)
      sales.push(...((data ?? []) as any[]))
      if ((data ?? []).length < 1000) break
    }
    // …e a MESMA consulta que o dashboard faz (limit 999999), pra ver se ele está recebendo todas as vendas
    const simple = await admin.from('telao_events').select('value, vertical').eq('event_type', 'sale').gte('occurred_at', start).lte('occurred_at', end).limit(999999)
    const dashboardSales = simple.error ? null : { rows: (simple.data ?? []).length, sum: ((simple.data ?? []) as any[]).reduce((s, e) => s + (Number(e.value) || 0), 0) }

    const companyGoals = Object.fromEntries(((companyRes.data ?? []) as any[]).map(g => [g.scope, Number(g.goal_value) || 0]))
    return NextResponse.json(computeGoalAudit({ month, dayOfMonth, daysInMonth, companyGoals, closerGoals: (closerRes.data ?? []) as any[], sales, dashboardSales }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[goals-audit]', e?.message ?? e)
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
