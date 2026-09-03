import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — qualquer usuário logado pode ler (precisa pra calcular a urgência
// no próprio dashboard, não só o superadmin que configura).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin.from('link_followup_settings').select('cadence_minutes').eq('id', 1).maybeSingle()
  return NextResponse.json({ cadence_minutes: data?.cadence_minutes ?? 10 })
}

// POST — só superadmin pode alterar o valor.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Só o superadmin pode alterar a cadência' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const minutes = Number(body.cadence_minutes)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({ error: 'Valor inválido — informe um número de minutos maior que zero' }, { status: 400 })
  }

  const admin = createAdminClient()
  const rounded = Math.round(minutes)
  const { error } = await admin.from('link_followup_settings').upsert({
    id: 1, cadence_minutes: rounded, updated_at: new Date().toISOString(), updated_by: user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, cadence_minutes: rounded })
}
