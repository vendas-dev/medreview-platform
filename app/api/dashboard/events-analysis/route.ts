import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeEventsAnalysis } from '@/lib/dashboard/eventsAnalysis'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const admin = createAdminClient()

  const result = await computeEventsAnalysis(admin, {
    period:        searchParams.get('period') ?? 'mes',
    customStart:   searchParams.get('start') ?? undefined,
    customEnd:     searchParams.get('end') ?? undefined,
    vertical:      searchParams.get('vertical') ?? '',
    eventCategory: searchParams.get('event_category') ?? '',
    eventName:     searchParams.get('event_name') ?? '',
    closer:        searchParams.get('closer') ?? '',
  })

  return NextResponse.json(result)
}
