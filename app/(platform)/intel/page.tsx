import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { IntelView }    from './IntelView'

export default async function IntelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, role, name, team, hubspot_id').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const today    = new Date().toISOString().slice(0, 10)
  const monthKey = today.slice(0, 7)

  if (isAdmin) {
    const [{ data: snapshots }, { data: insight }, { data: closers }] = await Promise.all([
      supabase.from('commercial_snapshots')
        .select('*, profiles!inner(name, team)')
        .eq('snapshot_date', today)
        .order('revenue_month', { ascending: false }),
      supabase.from('commercial_insights')
        .select('content, created_at')
        .eq('insight_date', today).eq('scope', 'global').single(),
      supabase.from('profiles')
        .select('id, name, team').neq('role', 'superadmin').order('name'),
    ])
    return (
      <IntelView isAdmin={true} profile={profile as any}
        snapshots={snapshots ?? []} insightText={(insight as any)?.content ?? null}
        insightDate={today} closers={closers ?? []} goal={null}/>
    )
  }

  // Closer view
  const [{ data: snapshot }, { data: insight }, { data: goal }] = await Promise.all([
    supabase.from('commercial_snapshots')
      .select('*').eq('user_id', user.id).eq('snapshot_date', today).single(),
    supabase.from('commercial_insights')
      .select('content, created_at').eq('insight_date', today).eq('scope', user.id).single(),
    supabase.from('closer_goals')
      .select('*').eq('user_id', user.id).eq('month', monthKey).single(),
  ])
  return (
    <IntelView isAdmin={false} profile={profile as any}
      snapshots={snapshot ? [snapshot as any] : []} insightText={(insight as any)?.content ?? null}
      insightDate={today} closers={[]} goal={goal as any}/>
  )
}
