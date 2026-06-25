import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'

  const date = req.nextUrl.searchParams.get('date') ??
    new Date().toISOString().slice(0, 10)

  if (isAdmin) {
    // Gestão vê o insight global
    const { data } = await supabase
      .from('commercial_insights')
      .select('*')
      .eq('insight_date', date)
      .eq('scope', 'global')
      .single()
    return NextResponse.json({ insight: data })
  } else {
    // Closer vê o próprio insight
    const { data } = await supabase
      .from('commercial_insights')
      .select('*')
      .eq('insight_date', date)
      .eq('scope', user.id)
      .single()
    return NextResponse.json({ insight: data })
  }
}
