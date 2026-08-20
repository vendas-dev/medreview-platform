'use client'
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TelaoEvent, Closer, Goal, MonthRevenue, VerticalId } from '@/lib/telao/types'
import { todayStart, monthStart, monthKey, todayKey } from '@/lib/telao/format'
import { todayInSaoPaulo } from '@/lib/timezone'

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

    // ── Metas ──────────────────────────────────────────────────
    // Não são mais definidas no telão (/telao/settings) — agora vêm sempre
    // de /intel/goals (tabela company_goals: "Meta Geral" e "Metas por
    // Vertical", por mês). Sintetizamos aqui o mesmo formato de Goal que o
    // resto do telão já espera (period/period_key/vertical/target_value),
    // pra não precisar mexer em GoalBar nem no restante do componente.
    const monthKeyStr = monthKey()
    const { data: companyGoalsRaw } = await supabase
      .from('company_goals')
      .select('scope, goal_value')
      .eq('month', monthKeyStr)
    const goalMap = Object.fromEntries((companyGoalsRaw ?? []).map((g: any) => [g.scope, Number(g.goal_value) || 0]))

    // company_goals usa o nome por extenso da vertical (ex: "Anest-Review"),
    // o telão usa a chave curta (ex: "anestreview") — precisa converter.
    const VERT_LABEL_TO_KEY: Record<string, VerticalId> = {
      'Med-Review R1': 'medreview', 'Anest-Review': 'anestreview',
      'Oft-Review': 'oftreview', 'Ortop-Review': 'ortopreview',
    }

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

    // Meta do dia = (meta mensal − já realizado no mês) ÷ dias restantes
    // (incluindo hoje) — não é uma divisão fixa por 30, ela "respira" com o
    // ritmo real: atrasou, a meta diária sobe; adiantou, desce. Dá o norte
    // de quanto precisa vender HOJE pra continuar no caminho de bater a meta.
    const todaySP = todayInSaoPaulo()
    const [anoSP, mesSP] = todaySP.split('-').map(Number)
    const diasNoMes    = new Date(anoSP, mesSP, 0).getDate()
    const diaAtual      = Number(todaySP.slice(8, 10))
    const diasRestantes = Math.max(diasNoMes - diaAtual + 1, 1) // +1 inclui hoje

    function metaDoDia(metaMensal: number, jaRealizadoNoMes: number): number {
      if (metaMensal <= 0) return 0
      const restante = Math.max(metaMensal - jaRealizadoNoMes, 0)
      return restante / diasRestantes
    }

    const synthGoals: Goal[] = []
    const metaGeralMensal = goalMap['geral'] ?? 0
    if (metaGeralMensal > 0) {
      synthGoals.push({ id: 'geral-month', period: 'month', period_key: monthKeyStr, vertical: null, target_value: metaGeralMensal } as unknown as Goal)
      synthGoals.push({ id: 'geral-day',   period: 'day',   period_key: todayKey(),  vertical: null, target_value: metaDoDia(metaGeralMensal, mr.overall) } as unknown as Goal)
    }
    for (const [label, key] of Object.entries(VERT_LABEL_TO_KEY)) {
      const metaVert = goalMap[label] ?? 0
      if (metaVert <= 0) continue
      synthGoals.push({ id: `${key}-month`, period: 'month', period_key: monthKeyStr, vertical: key, target_value: metaVert } as unknown as Goal)
      synthGoals.push({ id: `${key}-day`,   period: 'day',   period_key: todayKey(),  vertical: key, target_value: metaDoDia(metaVert, mr.byVertical[key] ?? 0) } as unknown as Goal)
    }

    const evs = (eventsData ?? []) as TelaoEvent[]
    evs.forEach(e => seenIds.current.add(e.id))

    setEvents(evs)
    setClosers((closersData ?? []) as Closer[])
    setGoals(synthGoals)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_goals' }, () => {
        // Metas mudaram em /intel/goals — refaz a busca completa (ela já
        // recalcula a meta do dia com base no realizado mais atual).
        fetchAll()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

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
