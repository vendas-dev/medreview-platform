'use client'
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TelaoEvent, Closer, Goal, MonthRevenue, VerticalId } from '@/lib/telao/types'
import { todayStart, monthStart, monthKey, todayKey } from '@/lib/telao/format'

interface LiveDataContext {
  events:       TelaoEvent[]
  closers:      Closer[]
  goals:        Goal[]
  monthRevenue: MonthRevenue
  latest:       TelaoEvent | null
  clearLatest:  () => void
  loading:      boolean
  refetch:      () => void
}

const Ctx = createContext<LiveDataContext>({
  events: [], closers: [], goals: [], monthRevenue: { overall: 0, byVertical: {} as any },
  latest: null, clearLatest: () => {}, loading: true, refetch: () => {},
})

export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const [events,       setEvents]       = useState<TelaoEvent[]>([])
  const [closers,      setClosers]      = useState<Closer[]>([])
  const [goals,        setGoals]        = useState<Goal[]>([])
  const [monthRevenue, setMonthRevenue] = useState<MonthRevenue>({ overall: 0, byVertical: {} as any })
  const [latest,       setLatest]       = useState<TelaoEvent | null>(null)
  const [loading,      setLoading]      = useState(true)
  const seenIds = useRef(new Set<string>())

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    // Eventos do dia
    const { data: eventsData } = await supabase
      .from('telao_events')
      .select('*')
      .gte('occurred_at', todayStart())
      .order('occurred_at', { ascending: false })
      .limit(500)

    // Closers
    const { data: closersData } = await supabase
      .from('closers')
      .select('*')
      .order('name')

    // Goals hoje + mês
    const { data: goalsData } = await supabase
      .from('telao_goals')
      .select('*')
      .in('period_key', [todayKey(), monthKey()])

    // Receita mensal
    const { data: monthData } = await supabase
      .from('telao_events')
      .select('value, vertical')
      .eq('event_type', 'sale')
      .gte('occurred_at', monthStart())
      .not('value', 'is', null)

    const mr: MonthRevenue = { overall: 0, byVertical: {} as Record<VerticalId, number> }
    for (const row of (monthData ?? [])) {
      const v = row.value ?? 0
      mr.overall += v
      const vk = row.vertical as VerticalId
      mr.byVertical[vk] = (mr.byVertical[vk] ?? 0) + v
    }

    const evs = (eventsData ?? []) as TelaoEvent[]
    evs.forEach(e => seenIds.current.add(e.id))

    setEvents(evs)
    setClosers((closersData ?? []) as Closer[])
    setGoals((goalsData ?? []) as Goal[])
    setMonthRevenue(mr)
    setLoading(false)
  }, [])

  // Fetch inicial + refetch em focus/visibility
  useEffect(() => {
    fetchAll()

    const onFocus = () => fetchAll()
    const onVis   = () => { if (document.visibilityState === 'visible') fetchAll() }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchAll])

  // ── Realtime ───────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('telao-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telao_events' }, (payload) => {
        const ev = payload.new as TelaoEvent
        if (seenIds.current.has(ev.id)) return
        seenIds.current.add(ev.id)

        // Só adiciona ao feed se for do dia atual
        const evDate = new Date(ev.occurred_at)
        const today  = new Date(); today.setHours(0,0,0,0)
        if (evDate >= today) {
          setEvents(prev => [ev, ...prev])
          setLatest(ev)
        }

        // Sempre incrementa receita mensal se for sale do mês corrente
        if (ev.event_type === 'sale' && ev.value) {
          const evMonth = new Date(ev.occurred_at)
          const now     = new Date()
          if (evMonth.getFullYear() === now.getFullYear() && evMonth.getMonth() === now.getMonth()) {
            setMonthRevenue(prev => ({
              overall:    prev.overall + (ev.value ?? 0),
              byVertical: {
                ...prev.byVertical,
                [ev.vertical]: (prev.byVertical[ev.vertical as VerticalId] ?? 0) + (ev.value ?? 0),
              },
            }))
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'telao_goals' }, () => {
        // Re-fetch goals quando houver mudança
        createClient()
          .from('telao_goals')
          .select('*')
          .in('period_key', [todayKey(), monthKey()])
          .then(({ data }) => { if (data) setGoals(data as Goal[]) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <Ctx.Provider value={{
      events, closers, goals, monthRevenue,
      latest, clearLatest: () => setLatest(null),
      loading, refetch: fetchAll,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLiveData() { return useContext(Ctx) }
