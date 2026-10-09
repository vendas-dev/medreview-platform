import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadExamData } from '@/lib/milestones/exams/server'

export const dynamic = 'force-dynamic'

// Qualquer usuário logado lê as datas verificadas (closers e superadmin).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isSuper = (me as any)?.role === 'superadmin'
  try {
    const data = await loadExamData(createAdminClient(), isSuper)
    return NextResponse.json({ ...data, isSuper }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[exams] erro ao carregar:', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao carregar as provas de título' }, { status: 500 })
  }
}
