export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SuperDashboard } from './SuperDashboard'
import { UserDashboard } from './UserDashboard'
import { ensureDailyInsights } from '@/lib/dashboard/closerInsights'
import { ensureCompanyInsights } from '@/lib/dashboard/companyInsights'
import { todayInSaoPaulo, monthBoundsSaoPaulo, dayBoundsSaoPaulo, addDaysToDateStr, weekdayInSaoPaulo, hourInSaoPaulo } from '@/lib/timezone'
import { eventMoneyLeftOnTable, extractCouponDiscountPct } from '@/lib/telao/format'
import { computeForecast, computeRemainingMonthRecurring, RecurringSale } from '@/lib/telao/forecast'

// Mesmo critério de match usado no telão/intel: closer_id OU hubspot_id (com
// trim), nunca só nome — nome sozinho já causou bug de contagem antes.
function matchesCloser(e: { closer_id?: string|null; closer_hubspot_id?: string|null; co_closer_id?: string|null; co_closer_hubspot_id?: string|null }, c: { id:string; hubspot_id:string|null }) {
  if (e.closer_id && e.closer_id === c.id) return true
  if (c.hubspot_id && e.closer_hubspot_id && String(e.closer_hubspot_id).trim() === String(c.hubspot_id).trim()) return true
  if (e.co_closer_id && e.co_closer_id === c.id) return true
  if (c.hubspot_id && e.co_closer_hubspot_id && String(e.co_closer_hubspot_id).trim() === String(c.hubspot_id).trim()) return true
  return false
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, name, team, avatar_url, hubspot_id').eq('id', user.id).single()

  const isAdmin   = (profile as any)?.role === 'superadmin'
  const userName  = (profile as any)?.name ?? 'usuário'
  const userTeam  = (profile as any)?.team
  const avatarUrl = (profile as any)?.avatar_url ?? null

  // ── SUPERADMIN ──────────────────────────────────────────────
  if (isAdmin) {
    const admin = createAdminClient()

    const [
      { data: users },
      { data: steps },
      { data: progress },
      { data: conversations },
      { data: quizAttempts },
      { data: presence },
      { data: materials },
      { data: videos },
    ] = await Promise.all([
      admin.from('profiles').select('id, name, team, role, email, avatar_url').neq('role', 'superadmin'),
      admin.from('onboarding_steps').select('id, title, team, day_number').eq('is_active', true).order('day_number', { ascending: true, nullsFirst: false }),
      admin.from('onboarding_progress').select('user_id, step_id, status, completed_at'),
      admin.from('onboarding_conversations').select('id, user_id, created_at'),
      admin.from('onboarding_quiz_attempts').select('user_id, step_id, score, passed, created_at'),
      supabase.from('user_presence').select('user_id, last_seen').gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()),
      admin.from('onboarding_materials').select('id'),
      admin.from('onboarding_videos').select('id').eq('is_active', true),
    ])

    const totalUsers     = users?.length ?? 0
    const totalSteps     = steps?.length ?? 0
    const totalMaterials = (materials?.length ?? 0) + (videos?.length ?? 0)

    const onlineIds = new Set((presence ?? []).map((p: any) => p.user_id))

    const userProgress = users?.map(u => {
      const up   = (progress ?? []).filter((p: any) => p.user_id === u.id)
      const done = up.filter((p: any) => p.status === 'concluido').length
      const ts   = (steps ?? []).filter((s: any) => s.team === u.team || s.team === 'ambos')
      const pct  = ts.length > 0 ? Math.round((done / ts.length) * 100) : 0
      return { ...u, done, totalSteps: ts.length, pct, isOnline: onlineIds.has(u.id) }
    }) ?? []

    const activeOnboarding = userProgress.filter(u => u.done > 0 && u.pct < 100).length
    const completedCount   = userProgress.filter(u => u.pct === 100 && u.totalSteps > 0).length
    const avgCompletion    = totalUsers > 0
      ? Math.round(userProgress.reduce((s, u) => s + u.pct, 0) / totalUsers) : 0
    const onlineCount = userProgress.filter(u => u.isOnline).length

    const firstAttempts = (quizAttempts ?? []).reduce((acc: Record<string, any>, a: any) => {
      const key = `${a.user_id}-${a.step_id}`
      if (!acc[key] || new Date(a.created_at) < new Date(acc[key].created_at)) acc[key] = a
      return acc
    }, {})
    const firstArr   = Object.values(firstAttempts) as any[]
    const passedRate = firstArr.length > 0
      ? Math.round((firstArr.filter((a: any) => a.passed).length / firstArr.length) * 100) : 0

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })
    const progressByDay = last7Days.map(day => ({
      day: day.slice(5),
      completions: (progress ?? []).filter((p: any) => p.status === 'concluido' && p.completed_at?.startsWith(day)).length,
      quizzes:     (quizAttempts ?? []).filter((a: any) => a.created_at?.startsWith(day)).length,
    }))

    // ── Dados COMERCIAIS — baralho de closers ────────────────────
    const today       = todayInSaoPaulo()
    const monthKeyStr = today.slice(0, 7)
    const { start: mStart, end: mEnd } = monthBoundsSaoPaulo(monthKeyStr)
    const { start: tStart, end: tEnd } = dayBoundsSaoPaulo(today)

    // Mês anterior — só pra comparação nos insights de empresa (ticket médio,
    // receita por vertical subindo/caindo).
    const [prevYearNum0, prevMonthNum0] = monthKeyStr.split('-').map(Number)
    const prevMonthKeyStr = prevMonthNum0 === 1 ? `${prevYearNum0 - 1}-12` : `${prevYearNum0}-${String(prevMonthNum0 - 1).padStart(2, '0')}`
    const { start: prevMStart, end: prevMEnd } = monthBoundsSaoPaulo(prevMonthKeyStr)

    const admin2 = createAdminClient()
    const [
      { data: closerProfiles },
      { data: monthSales },
      { data: monthCerts },
      { data: closerGoals },
      { data: companyGoalsRaw },
      { data: monthLeads },
      { data: allRecurringRaw },
      { data: prevMonthSales },
    ] = await Promise.all([
      admin2.from('profiles').select('id, name, team, avatar_url, hubspot_id').neq('role', 'superadmin'),
      admin2.from('telao_events')
        .select('closer_id, closer_hubspot_id, co_closer_id, co_closer_hubspot_id, value, occurred_at, sale_type, coupon_code, is_self_checkout, seller_type, sold_by_ambassador, is_recurring, installment_number, event_type, product, vertical')
        .eq('event_type', 'sale').gte('occurred_at', mStart).lte('occurred_at', mEnd)
        .limit(999999),
      admin2.from('telao_events')
        .select('closer_id, closer_hubspot_id')
        .eq('event_type', 'ambassador_certified').gte('occurred_at', mStart).lte('occurred_at', mEnd)
        .limit(999999),
      admin2.from('closer_goals').select('user_id, goal_sales').eq('month', monthKeyStr),
      admin2.from('company_goals').select('scope, goal_value').eq('month', monthKeyStr),
      admin2.from('hubspot_leads').select('owner_id').gte('created_at_hs', mStart).lte('created_at_hs', mEnd).limit(999999),
      // Histórico COMPLETO de recorrência (não limitado ao mês) — necessário
      // pro forecast mês a mês até dezembro, igual ao que já existe no /intel.
      admin2.from('telao_events')
        .select('subscription_id, installment_number, total_installments, value, occurred_at')
        .eq('event_type', 'sale').eq('is_recurring', true).not('subscription_id', 'is', null)
        .limit(999999),
      admin2.from('telao_events')
        .select('value, vertical, coupon_code, is_self_checkout, sale_type, product')
        .eq('event_type', 'sale').gte('occurred_at', prevMStart).lte('occurred_at', prevMEnd)
        .limit(999999),
    ])

    const closers      = (closerProfiles ?? []) as any[]
    const salesMonth   = (monthSales ?? []) as any[]
    const certsMonth   = (monthCerts ?? []) as any[]
    const goalsMap     = Object.fromEntries((closerGoals ?? []).map((g: any) => [g.user_id, g.goal_sales ?? 0]))
    const leadsMonth   = (monthLeads ?? []) as any[]

    // Maior venda única do mês (empresa toda), pra dar o selo "💰 maior ticket"
    const maxSingleSale = salesMonth.reduce((max: number, e: any) => Math.max(max, Number(e.value) || 0), 0)

    const VERT_LABEL: Record<string, string> = {
      medreview: 'Med-Review R1', anestreview: 'Anest-Review', oftreview: 'Oft-Review',
      ortoprev: 'Ortop-Review', ortopreview: 'Ortop-Review',
    }
    const vLabel = (k: string) => VERT_LABEL[k] ?? k
    const ALL_VERTICALS = ['Anest-Review', 'Oft-Review', 'Ortop-Review', 'Med-Review R1']

    // Desconto médio da EMPRESA por vertical — usado como referência de
    // comparação ("closer X está acima/abaixo da média do time"). Só conta
    // venda de closer de verdade (não self-checkout) com cupom válido.
    const companyDiscountByVertical: Record<string, { sum: number; count: number }> = {}
    salesMonth.forEach((e: any) => {
      if (e.is_self_checkout) return
      const pct = extractCouponDiscountPct(e.coupon_code)
      if (pct === null) return
      const vlabel = vLabel(e.vertical ?? 'outros')
      if (!companyDiscountByVertical[vlabel]) companyDiscountByVertical[vlabel] = { sum: 0, count: 0 }
      companyDiscountByVertical[vlabel].sum += pct
      companyDiscountByVertical[vlabel].count++
    })
    const companyAvgDiscount = (vlabel: string) => {
      const d = companyDiscountByVertical[vlabel]
      return d && d.count > 0 ? d.sum / d.count : 0
    }

    // Links gerados no mês — pra saber em qual condição (à vista/parcelado/
    // sem juros) cada closer mais costuma gerar, e alimentar a IA com isso.
    const { data: monthLinksRaw } = await admin2.from('geracoes_links')
      .select('owner_hubspot_id, payment_mode, installments_no_interest')
      .gte('generated_at', mStart).lte('generated_at', mEnd).limit(999999)
    const monthLinks = (monthLinksRaw ?? []) as any[]
    const paymentModeLabel = (r: { payment_mode: string | null; installments_no_interest: number | null }): string | null => {
      if (!r.payment_mode) return null
      if (r.payment_mode === 'a_vista') return 'À vista'
      if (r.payment_mode === 'parcelado') return 'Parcelado'
      if (r.payment_mode === 'sem_juros') return `${r.installments_no_interest ?? 3}x sem juros`
      return r.payment_mode
    }

    const closerCards = closers.map((c: any) => {
      const mySales = salesMonth.filter((e: any) => matchesCloser(e, c))
      const revenue = mySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const salesCount = mySales.length
      // Ticket médio só considera a 1ª parcela de cada venda — parcelas
      // recorrentes 2+ não entram, senão distorce a média pra baixo (mesma
      // regra já usada no /intel). Receita e contagem de vendas acima
      // continuam somando TUDO, isso aqui é só pro ticket médio.
      const myNovaSales = mySales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
      const myNovaRev = myNovaSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const avgTicket = myNovaSales.length > 0 ? myNovaRev / myNovaSales.length : 0
      const goalSales = Number(goalsMap[c.id] ?? 0)
      const pctGoal = goalSales > 0 ? (revenue / goalSales) * 100 : 0

      const sorted = [...mySales].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      const lastSaleAt = sorted[0]?.occurred_at ?? null
      const daysSinceLastSale = lastSaleAt
        ? Math.floor((Date.now() - new Date(lastSaleAt).getTime()) / 86400000)
        : null

      const salesLast3Days = mySales.filter((e: any) =>
        Date.now() - new Date(e.occurred_at).getTime() < 3 * 86400000
      ).length

      const myCerts = certsMonth.filter((e: any) => matchesCloser(e, c)).length
      const myLeads = leadsMonth.filter((l: any) =>
        c.hubspot_id && l.owner_id != null && String(l.owner_id).trim() === String(c.hubspot_id).trim()
      ).length
      const convRate = myLeads > 0 ? (salesCount / myLeads) * 100 : 0

      const moneyLeft = mySales.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)

      // Desconto médio concedido por esse closer, por vertical — só onde
      // ele efetivamente vendeu (não mostra vertical em que nunca atuou).
      const myVerticals = [...new Set(mySales.map((e: any) => vLabel(e.vertical ?? 'outros')))]
      const discountByVertical = myVerticals.map(vlabel => {
        const salesInVert = mySales.filter((e: any) => vLabel(e.vertical ?? 'outros') === vlabel && !e.is_self_checkout)
        const withDiscount = salesInVert.map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
        const avgPct = withDiscount.length > 0 ? withDiscount.reduce((s, p) => s + p, 0) / withDiscount.length : 0
        return { vertical: vlabel, avgPct, companyAvgPct: companyAvgDiscount(vlabel), count: withDiscount.length }
      })

      // Condição de pagamento que esse closer mais gera nos links (à vista/
      // parcelado/sem juros) — pra IA analisar padrão de negociação, não só desconto.
      const myLinks = monthLinks.filter((l: any) => c.hubspot_id && l.owner_hubspot_id && String(l.owner_hubspot_id).trim() === String(c.hubspot_id).trim())
      const paymentModeCounts: Record<string, number> = {}
      myLinks.forEach((l: any) => {
        const label = paymentModeLabel(l)
        if (!label) return
        paymentModeCounts[label] = (paymentModeCounts[label] ?? 0) + 1
      })
      const paymentModeBreakdown = Object.entries(paymentModeCounts)
        .map(([mode, count]) => ({ mode, count, pct: myLinks.length > 0 ? (count / myLinks.length) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)

      const hasTopTicket = maxSingleSale > 0 && mySales.some((e: any) => (Number(e.value) || 0) === maxSingleSale)

      const badges: string[] = []
      if (goalSales > 0 && pctGoal >= 100) badges.push('meta_batida')
      if (salesCount > 0 && daysSinceLastSale !== null && daysSinceLastSale >= 3) badges.push('sem_vender')
      if (hasTopTicket) badges.push('maior_ticket')
      if (salesLast3Days >= 3) badges.push('em_alta')

      return {
        id: c.id, name: c.name, team: c.team, avatarUrl: c.avatar_url, hubspot_id: c.hubspot_id,
        revenue, salesCount, avgTicket, goalSales, pctGoal,
        daysSinceLastSale, myCerts, convRate, moneyLeft, badges, discountByVertical, paymentModeBreakdown,
      }
    }).sort((a, b) => b.revenue - a.revenue).map((c, i) => ({ ...c, rank: i + 1 }))

    const totalRevMonth   = salesMonth.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)

    // Última venda da empresa toda — pro contador vivo do header ("há Xmin").
    const sortedAllSales = [...salesMonth].sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    const lastSaleAt = sortedAllSales[0]?.occurred_at ?? null

    // % do mês já decorrido (dias corridos) — usado no anel interno do header,
    // pra comparar "ritmo da meta" com "ritmo do calendário".
    const [yearNum, monthNum] = monthKeyStr.split('-').map(Number)
    const daysInMonthTotal = new Date(yearNum, monthNum, 0).getDate()
    const dayOfMonth = Number(today.slice(8, 10))
    const pctMonthElapsed = Math.min((dayOfMonth / daysInMonthTotal) * 100, 100)

    const totalSalesMonth = salesMonth.length
    const todaySales       = salesMonth.filter((e: any) => e.occurred_at >= tStart && e.occurred_at <= tEnd)
    const totalSalesToday  = todaySales.length
    const totalRevToday    = todaySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    // Mesma regra: ticket médio só com vendas 'nova' (1ª parcela), receita e
    // contagem de vendas continuam somando tudo (nova + recorrente).
    const novaSalesAll = salesMonth.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
    const novaRevAll = novaSalesAll.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const avgTicketAll    = novaSalesAll.length > 0 ? novaRevAll / novaSalesAll.length : 0
    const totalMoneyLeft  = salesMonth.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
    const totalCertsMonth = certsMonth.length

    // Ranking de produtos mais vendidos — mesma lógica do /intel: agrupado por
    // produto+vertical (produtos repetem nome entre verticais diferentes).
    const productMap: Record<string, { product: string; vertical: string; count: number; rev: number }> = {}
    salesMonth.forEach((e: any) => {
      if (!e.product) return
      const vlabel = vLabel(e.vertical ?? 'outros')
      if (vlabel === 'outros') return
      const key = `${e.product}|||${vlabel}`
      if (!productMap[key]) productMap[key] = { product: e.product, vertical: vlabel, count: 0, rev: 0 }
      productMap[key].count++
      productMap[key].rev += Number(e.value) || 0
    })
    const productRanking = Object.values(productMap).sort((a, b) => b.rev - a.rev).slice(0, 5)

    // Receita diária dos últimos 7 dias (fuso de SP), pro gráfico de atividade
    const revenueByDay = Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDaysToDateStr(today, -(6 - i))
      const { start, end } = dayBoundsSaoPaulo(dateStr)
      const rev = salesMonth.filter((e: any) => e.occurred_at >= start && e.occurred_at <= end)
        .reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      return { day: dateStr.slice(5), revenue: rev }
    })

    // Forecast de recorrência até dezembro — mesma lógica do /intel (não é
    // extrapolação simples do ritmo do mês; é projeção mês a mês baseada no
    // histórico de parcelas recorrentes, já descontando taxa de cancelamento).
    const recurringForForecast: RecurringSale[] = (allRecurringRaw ?? [])
      .filter((e: any) => e.subscription_id && e.installment_number && e.total_installments)
      .map((e: any) => ({
        subscription_id: e.subscription_id, installment_number: e.installment_number,
        total_installments: e.total_installments, value: Number(e.value) || 0, occurred_at: e.occurred_at,
      }))
    // Mesma regra usada em todo o resto do sistema (ticket médio, contagem de
    // vendas, "receita nova vs recorrente"): 'recorrente' é parcela 2+, não
    // "is_recurring=true" — senão a 1ª parcela de uma assinatura nova entrava
    // aqui também, e esse número ficava divergente do card "nova vs recorrente".
    const mrrAtual = salesMonth.filter((e: any) => (e.sale_type ?? 'nova') === 'recorrente').reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const forecastResult = computeForecast(recurringForForecast, mrrAtual)
    const forecastUntilYearEnd = forecastResult.parcelasRestantesAjustado
    const monthlyForecast = forecastResult.monthlyForecast
    const forecastDetail = {
      mrrAtual: forecastResult.mrrAtual,
      persistenceRate: forecastResult.persistenceRate,
      sampleSize: forecastResult.sampleSize,
      ativas: forecastResult.ativas,
      atrasadas: forecastResult.atrasadas,
      emRisco: forecastResult.emRisco,
      completas: forecastResult.completas,
    }

    const totalGoalMonth = Object.values(goalsMap).reduce((s: number, v: any) => s + (Number(v) || 0), 0)

    // ── Meta Geral / por vertical — preenchidas direto pelo admin em
    // /intel/goals, independentes da soma das metas individuais dos closers.
    // Se ainda não foi preenchida esse mês, cai pra soma das metas dos
    // closers (totalGoalMonth) como aproximação razoável, em vez de ficar
    // zerada — assim o gráfico "Meta x Realizado" sempre mostra algo útil.
    const companyGoalsMap = Object.fromEntries((companyGoalsRaw ?? []).map((g: any) => [g.scope, Number(g.goal_value) || 0]))
    const metaGeralMes = companyGoalsMap['geral'] > 0 ? companyGoalsMap['geral'] : totalGoalMonth
    const metaPorVertical: Record<string, number> = Object.fromEntries(ALL_VERTICALS.map(v => [v, companyGoalsMap[v] ?? 0]))

    // ── Forecast de fechamento do mês — o mais importante dos dois pedidos.
    // Realizado (já ganho, fixo) + duas projeções pro que ainda falta:
    //  1. Recorrência que ainda deve cair DENTRO do mês (não é a projeção até
    //     dezembro, é só o que falta receber nos dias que restam desse mês).
    //  2. Ritmo atual de vendas NOVAS, extrapolado pros dias que faltam —
    //     "se continuar vendendo no ritmo médio diário de hoje até aqui,
    //     quanto mais vou fechar até o fim do mês".
    const diasRestantesMes = Math.max(daysInMonthTotal - dayOfMonth, 0)
    const ritmoDiarioNovaVenda = dayOfMonth > 0 ? novaRevAll / dayOfMonth : 0
    const projecaoRestanteNovaVenda = ritmoDiarioNovaVenda * diasRestantesMes
    const recorrenciaPrevistaMes = computeRemainingMonthRecurring(forecastResult.states, forecastResult.persistenceRate, new Date())
    const forecastFechamentoMes = totalRevMonth + projecaoRestanteNovaVenda + recorrenciaPrevistaMes
    const pctForecastVsMeta = metaGeralMes > 0 ? ((forecastFechamentoMes - metaGeralMes) / metaGeralMes) * 100 : 0

    // ── Série diária acumulada do mês (dia 1 até hoje) — pra linha de
    // evolução do "Meta x Realizado", comparando com o ritmo linear da meta.
    const dailyCumulative: { day: number; realizado: number; ritmoLinear: number }[] = []
    let acumulado = 0
    for (let d = 1; d <= dayOfMonth; d++) {
      const dateStr = `${monthKeyStr}-${String(d).padStart(2, '0')}`
      const { start: dStart, end: dEnd } = dayBoundsSaoPaulo(dateStr)
      const revDia = salesMonth.filter((e: any) => e.occurred_at >= dStart && e.occurred_at <= dEnd)
        .reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      acumulado += revDia
      dailyCumulative.push({ day: d, realizado: acumulado, ritmoLinear: metaGeralMes > 0 ? (metaGeralMes / daysInMonthTotal) * d : 0 })
    }
    const pctCompanyGoal = totalGoalMonth > 0 ? Math.min((totalRevMonth / totalGoalMonth) * 100, 100) : 0

    // Frase de IA por closer — cacheada 1x por dia, não recalculada a cada acesso.
    const insightsMap = await ensureDailyInsights(closerCards.map(c => ({
      id: c.id, name: c.name, team: c.team, revenue: c.revenue, salesCount: c.salesCount,
      goalSales: c.goalSales, pctGoal: c.pctGoal, avgTicket: c.avgTicket,
      daysSinceLastSale: c.daysSinceLastSale, rank: c.rank, myCerts: c.myCerts, moneyLeft: c.moneyLeft,
      discountByVertical: c.discountByVertical, paymentModeBreakdown: c.paymentModeBreakdown,
    })))
    const closerCardsWithInsight = closerCards.map(c => ({ ...c, insight: insightsMap[c.id] ?? '' }))

    // Breakdown por vertical (receita, ticket médio, dinheiro deixado na mesa,
    // desconto médio) — pros gráficos "por vertical" abaixo dos KPIs gerais.
    const verticalBreakdown = ALL_VERTICALS.map(vlabel => {
      const salesInVert = salesMonth.filter((e: any) => vLabel(e.vertical ?? 'outros') === vlabel)
      const rev = salesInVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const count = salesInVert.length
      // Ticket médio só com vendas novas (mesma regra de sempre); receita e
      // contagem acima continuam somando tudo.
      const novaInVert = salesInVert.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
      const novaRevInVert = novaInVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const avgTicket = novaInVert.length > 0 ? novaRevInVert / novaInVert.length : 0
      const moneyLeftVert = salesInVert.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
      return { vertical: vlabel, revenue: rev, count, avgTicket, moneyLeft: moneyLeftVert, avgDiscountPct: companyAvgDiscount(vlabel) }
    })
    // Segurança: se alguma venda tiver uma vertical que não bate com nenhuma
    // das 4 conhecidas (nula, ou valor cru não mapeado), ela entrava no total
    // geral mas sumia do gráfico por vertical — a soma dos 4 nunca batia com
    // o total nesse caso. Agora ela entra num balde "Outros" em vez de ser
    // descartada, garantindo que a soma sempre reconcilia com o total.
    const outrasVendas = salesMonth.filter((e: any) => !ALL_VERTICALS.includes(vLabel(e.vertical ?? 'outros')))
    if (outrasVendas.length > 0) {
      const rev = outrasVendas.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const moneyLeftVert = outrasVendas.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
      const novaOutras = outrasVendas.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
      const novaRevOutras = novaOutras.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      verticalBreakdown.push({
        vertical: 'Outros', revenue: rev, count: outrasVendas.length,
        avgTicket: novaOutras.length > 0 ? novaRevOutras / novaOutras.length : 0,
        moneyLeft: moneyLeftVert, avgDiscountPct: 0,
      })
    }

    // Mesmo cálculo de "por vertical", mas pro mês anterior — só pra
    // comparação nos insights de empresa (não é exibido em gráfico nenhum).
    const prevSales = (prevMonthSales ?? []) as any[]
    const avgDiscountForSales = (sales: any[]) => {
      const withDiscount = sales.filter((e: any) => !e.is_self_checkout)
        .map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
      return withDiscount.length > 0 ? withDiscount.reduce((s, p) => s + p, 0) / withDiscount.length : 0
    }
    const verticalPrevMonth = ALL_VERTICALS.map(vlabel => {
      const salesInVert = prevSales.filter((e: any) => vLabel(e.vertical ?? 'outros') === vlabel)
      const rev = salesInVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      const count = salesInVert.length
      const novaInVert = salesInVert.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
      const novaRevInVert = novaInVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
      return { vertical: vlabel, revenue: rev, count, avgTicket: novaInVert.length > 0 ? novaRevInVert / novaInVert.length : 0, avgDiscountPct: avgDiscountForSales(salesInVert) }
    })
    const totalRevPrevMonth = prevSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)

    // Top closers e closers em risco (sem vender há dias) — dão contexto pra
    // IA citar nomes específicos nos insights de empresa, se fizer sentido.
    const topClosersForInsight = [...closerCardsWithInsight].sort((a, b) => b.revenue - a.revenue).slice(0, 3)
      .map(c => ({ name: c.name, revenue: c.revenue, pctGoal: c.pctGoal, pctOfTotalRev: totalRevMonth > 0 ? (c.revenue / totalRevMonth) * 100 : 0 }))
    const riskClosersForInsight = closerCardsWithInsight.filter(c => c.daysSinceLastSale !== null && c.daysSinceLastSale >= 4)
      .sort((a, b) => (b.daysSinceLastSale ?? 0) - (a.daysSinceLastSale ?? 0)).slice(0, 3)
      .map(c => ({ name: c.name, daysSinceLastSale: c.daysSinceLastSale as number, pctGoal: c.pctGoal }))

    // Desconto geral (todas as verticais juntas) por closer, pra achar quem
    // foge muito da média do time — sinal diferente de "por vertical".
    const closerOverallDiscount = closers.map((c: any) => {
      const mySales = salesMonth.filter((e: any) => matchesCloser(e, c) && !e.is_self_checkout)
      const withDiscount = mySales.map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
      const avgPct = withDiscount.length > 0 ? withDiscount.reduce((s, p) => s + p, 0) / withDiscount.length : 0
      return { name: c.name, avgPct, count: withDiscount.length }
    }).filter(c => c.count > 0)
    const companyAvgDiscountOverall = closerOverallDiscount.length > 0
      ? closerOverallDiscount.reduce((s, c) => s + c.avgPct, 0) / closerOverallDiscount.length : 0
    const discountOutliers = closerOverallDiscount
      .filter(c => companyAvgDiscountOverall > 0 && c.avgPct > companyAvgDiscountOverall * 1.3)
      .sort((a, b) => b.avgPct - a.avgPct).slice(0, 2)
      .map(c => ({ name: c.name, avgPct: c.avgPct, companyAvgPct: companyAvgDiscountOverall }))

    // Produtos que mais caíram vs mês anterior (mesmo produto+vertical nos
    // dois meses) — só entra se de fato existia no mês anterior, pra não
    // confundir "produto novo" com "produto em queda".
    const prevProductMap: Record<string, number> = {}
    prevSales.forEach((e: any) => {
      if (!e.product) return
      const vlabel = vLabel(e.vertical ?? 'outros')
      if (vlabel === 'outros') return
      const key = `${e.product}|||${vlabel}`
      prevProductMap[key] = (prevProductMap[key] ?? 0) + (Number(e.value) || 0)
    })
    const productDeltas = productRanking
      .map(p => {
        const key = `${p.product}|||${p.vertical}`
        const prevRev = prevProductMap[key] ?? 0
        const deltaPct = prevRev > 0 ? ((p.rev - prevRev) / prevRev) * 100 : null
        return { product: p.product, vertical: p.vertical, revNow: p.rev, revPrev: prevRev, deltaPct }
      })
      .filter(p => p.deltaPct !== null && p.deltaPct < -15)
      .sort((a, b) => (a.deltaPct as number) - (b.deltaPct as number)).slice(0, 2)

    const companyInsights = await ensureCompanyInsights({
      totalRevMonth, totalRevPrevMonth, pctCompanyGoal, totalMoneyLeft,
      verticalNow: verticalBreakdown, verticalPrev: verticalPrevMonth,
      forecast: { ativas: forecastDetail.ativas, atrasadas: forecastDetail.atrasadas, emRisco: forecastDetail.emRisco, persistenceRate: forecastDetail.persistenceRate },
      topClosers: topClosersForInsight, riskClosers: riskClosersForInsight,
      discountOutliers, productDeltas,
    })

    // ── Dados do "Painel Comercial" (filtro Hoje/Ontem/Semana/Mês) —
    // calculados aqui só pro período padrão "mês", pra já vir pronto sem
    // precisar de um fetch extra no primeiro carregamento da página. Quando
    // o usuário troca de período no cliente, o componente busca da API.
    const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const byType = {
      closer: { rev: 0, count: 0 }, ambassador: { rev: 0, count: 0 },
      selfcheckout: { rev: 0, count: 0 }, ambassadorCloser: { rev: 0, count: 0 },
    }
    salesMonth.forEach((e: any) => {
      const v = Number(e.value) || 0
      const isAmbassador = (e as any).sold_by_ambassador || e.seller_type === 'ambassador'
      if (e.is_self_checkout || e.seller_type === 'self_checkout') { byType.selfcheckout.rev += v; byType.selfcheckout.count++ }
      else if (isAmbassador && e.co_closer_id) { byType.ambassadorCloser.rev += v; byType.ambassadorCloser.count++ }
      else if (isAmbassador) { byType.ambassador.rev += v; byType.ambassador.count++ }
      else { byType.closer.rev += v; byType.closer.count++ }
    })

    const novaVsRecorrente = { nova: { rev: 0, count: 0 }, recorrente: { rev: 0, count: 0 } }
    salesMonth.forEach((e: any) => {
      const v = Number(e.value) || 0
      const key: 'nova' | 'recorrente' = (e.sale_type ?? 'nova') === 'recorrente' ? 'recorrente' : 'nova'
      novaVsRecorrente[key].rev += v
      novaVsRecorrente[key].count++
    })

    const certsByCloserMap: Record<string, { name: string; count: number; avatarUrl: string | null }> = {}
    certsMonth.forEach((e: any) => {
      const closer = closers.find((c: any) => matchesCloser(e, c))
      const key  = closer?.id ?? e.closer_hubspot_id ?? 'desconhecido'
      const name = closer?.name ?? 'Desconhecido'
      if (!certsByCloserMap[key]) certsByCloserMap[key] = { name, count: 0, avatarUrl: closer?.avatar_url ?? null }
      certsByCloserMap[key].count++
    })
    const certsRankingForAnalysis = Object.values(certsByCloserMap).sort((a, b) => b.count - a.count)

    const byWeekday = WEEKDAY_LABELS.map(l => ({ label: l, rev: 0, count: 0 }))
    const byHour    = Array.from({ length: 24 }, (_, h) => ({ hour: h, rev: 0, count: 0 }))
    salesMonth.forEach((e: any) => {
      const v  = Number(e.value) || 0
      const wd = weekdayInSaoPaulo(e.occurred_at)
      const h  = hourInSaoPaulo(e.occurred_at)
      byWeekday[wd].rev += v; byWeekday[wd].count++
      byHour[h].rev += v; byHour[h].count++
    })
    const topDay  = [...byWeekday].sort((a, b) => b.rev - a.rev)[0]
    const topHour = [...byHour].sort((a, b) => b.rev - a.rev)[0]

    // ── Performance por closer — reaproveita os números já calculados em
    // closerCards (revenue/avgTicket/convRate/moneyLeft). Aqui usamos o
    // CLOSER ORIGINAL (com hubspot_id), não o card já reduzido — o bug de
    // "desconto médio sempre vazio" era exatamente esse: matchesCloser
    // precisa do hubspot_id, e o card devolvido antes não levava esse campo.
    const closerPerformanceForAnalysis = closerCardsWithInsight.filter(c => c.salesCount > 0 || c.revenue > 0).map(c => {
      const mySales = salesMonth.filter((e: any) => matchesCloser(e, c))
      const withDiscount = mySales.filter((e: any) => !e.is_self_checkout)
        .map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
      const avgDiscountPct = withDiscount.length > 0 ? withDiscount.reduce((s, p) => s + p, 0) / withDiscount.length : 0
      return { id: c.id, name: c.name, avatarUrl: c.avatarUrl, revenue: c.revenue, salesCount: c.salesCount, avgTicket: c.avgTicket, convRate: c.convRate, moneyLeft: c.moneyLeft, avgDiscountPct }
    }).sort((a, b) => b.revenue - a.revenue)

    const commercialAnalysisInitial = {
      kpis: {
        totalRevenue: totalRevMonth, totalSales: novaSalesAll.length, avgTicket: avgTicketAll, moneyLeft: totalMoneyLeft,
        revenueToday: totalRevToday, salesToday: todaySales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova').length, certsCount: totalCertsMonth,
      },
      verticalBreakdown, productRanking,
      closerPerformance: closerPerformanceForAnalysis,
      byType, novaVsRecorrente, certsRanking: certsRankingForAnalysis,
      byWeekday, byHour, topDay, topHour, label: 'Este mês',
    }

    return (
      <SuperDashboard
        userName={userName}
        stats={{ totalUsers, totalSteps, totalMaterials, activeOnboarding, completedCount, avgCompletion, onlineCount, passedRate, totalConversations: conversations?.length ?? 0 }}
        users={userProgress}
        progressByDay={progressByDay}
        commercialAnalysisInitial={commercialAnalysisInitial}
        commercial={{
          totalRevMonth, totalSalesMonth, totalSalesToday, totalRevToday, avgTicketAll, totalMoneyLeft, totalCertsMonth,
          forecast: forecastUntilYearEnd, monthlyForecast, forecastDetail, revenueByDay, closerCards: closerCardsWithInsight,
          totalGoalMonth, pctCompanyGoal, productRanking, verticalBreakdown, lastSaleAt, pctMonthElapsed, companyInsights,
          metaGeralMes, metaPorVertical, forecastFechamentoMes, projecaoRestanteNovaVenda, recorrenciaPrevistaMes,
          pctForecastVsMeta, dailyCumulative, daysInMonthTotal,
        }}
      />
    )
  }

  // ── USUÁRIO COMUM ────────────────────────────────────────────
  const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

  const { data: steps } = await supabase
    .from('onboarding_steps')
    .select('id, title, day_number, estimated_minutes, team, completion_criteria, min_quiz_score')
    .eq('is_active', true)
    .in('team', teamFilter)
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('order_index')

  const { data: progress } = await supabase
    .from('onboarding_progress')
    .select('step_id, status, quiz_score, completed_at')
    .eq('user_id', user.id)

  const progressMap = new Map((progress ?? []).map((p: any) => [p.step_id, p]))
  const allSteps    = steps ?? []
  const total       = allSteps.length
  const completed   = allSteps.filter(s => progressMap.get(s.id)?.status === 'concluido').length
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0

  const stepsWithStatus = allSteps.map(s => ({
    ...s,
    status:       progressMap.get(s.id)?.status ?? 'nao_iniciado',
    quiz_score:   progressMap.get(s.id)?.quiz_score ?? null,
    completed_at: progressMap.get(s.id)?.completed_at ?? null,
  }))

  // Materiais não vistos das próximas etapas
  const { data: matViews } = await supabase
    .from('onboarding_material_views').select('material_id').eq('user_id', user.id)
  const checkedMats = new Set((matViews ?? []).map((v: any) => v.material_id))

  const pendingStepIds = stepsWithStatus
    .filter(s => s.status !== 'concluido').slice(0, 3).map(s => s.id)

  const { data: pendingMaterials } = pendingStepIds.length > 0
    ? await supabase.from('onboarding_materials').select('id, title, type, step_id')
        .in('step_id', pendingStepIds).limit(10)
    : { data: [] }

  const uncheckedMaterials = (pendingMaterials ?? []).filter((m: any) => !checkedMats.has(m.id))

  const { data: settings } = await supabase
    .from('onboarding_settings').select('track_mode')
    .eq('id', '00000000-0000-0000-0000-000000000001').single()
  const trailMode = (settings as any)?.track_mode ?? 'livre'

  // ── Comercial pessoal (só os dados dele) ─────────────────────
  const admin3 = createAdminClient()
  const meHubspotId = (profile as any)?.hubspot_id ?? null
  const me = { id: user.id, hubspot_id: meHubspotId }

  const today3 = todayInSaoPaulo()
  const monthKey3 = today3.slice(0, 7)
  const { start: mStart3, end: mEnd3 } = monthBoundsSaoPaulo(monthKey3)
  const { start: tStart3, end: tEnd3 } = dayBoundsSaoPaulo(today3)

  const VERT_LABEL3: Record<string, string> = {
    medreview: 'Med-Review R1', anestreview: 'Anest-Review', oftreview: 'Oft-Review',
    ortoprev: 'Ortop-Review', ortopreview: 'Ortop-Review',
  }
  const vLabel3 = (k: string) => VERT_LABEL3[k] ?? k
  const ALL_VERTICALS3 = ['Anest-Review', 'Oft-Review', 'Ortop-Review', 'Med-Review R1']

  const [
    { data: allClosersForRank },
    { data: monthSalesAll },
    { data: myCertsRaw },
    { data: myGoalRaw },
    { data: myPendingLinksRaw },
  ] = await Promise.all([
    admin3.from('profiles').select('id, hubspot_id').neq('role', 'superadmin'),
    admin3.from('telao_events')
      .select('closer_id, closer_hubspot_id, co_closer_id, co_closer_hubspot_id, value, occurred_at, sale_type, coupon_code, is_self_checkout, seller_type, is_recurring, installment_number, product, vertical, event_type')
      .eq('event_type', 'sale').gte('occurred_at', mStart3).lte('occurred_at', mEnd3).limit(999999),
    admin3.from('telao_events').select('closer_id, closer_hubspot_id')
      .eq('event_type', 'ambassador_certified').gte('occurred_at', mStart3).lte('occurred_at', mEnd3).limit(999999),
    admin3.from('closer_goals').select('goal_sales').eq('user_id', user.id).eq('month', monthKey3).maybeSingle(),
    // Links dele que ainda não converteram nem foram superados por outro
    // link do mesmo negócio — candidatos a "expirando" ou "vencido".
    admin3.from('geracoes_links')
      .select('id, deal_id, deal_name, deal_value, expires_at, generated_at, coupon_code, owner_name, owner_hubspot_id, product_name')
      .is('converted_at', null).is('superseded_by_link_id', null)
      .not('expires_at', 'is', null)
      .limit(999999),
  ])

  const allSales3 = monthSalesAll ?? []
  const mySales3 = allSales3.filter((e: any) => matchesCloser(e, me))
  const myRevenue = mySales3.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const mySalesCount = mySales3.length
  const myNovaSales = mySales3.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
  const myAvgTicket = myNovaSales.length > 0 ? myNovaSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0) / myNovaSales.length : 0
  const myGoalSales = Number((myGoalRaw as any)?.goal_sales ?? 0)
  const myPctGoal = myGoalSales > 0 ? (myRevenue / myGoalSales) * 100 : 0
  const myTodaySales = mySales3.filter((e: any) => e.occurred_at >= tStart3 && e.occurred_at <= tEnd3)
  const myRevToday = myTodaySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const myMoneyLeft = mySales3.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)
  const myCertsCount = (myCertsRaw ?? []).filter((e: any) => matchesCloser(e, me)).length

  const sorted3 = [...mySales3].sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  const myDaysSinceLastSale = sorted3[0]?.occurred_at
    ? Math.floor((Date.now() - new Date(sorted3[0].occurred_at).getTime()) / 86400000) : null

  // Ranking — mesma receita de todo mundo, só pra saber a posição dele
  const rankList = (allClosersForRank ?? []).map((c: any) => {
    const s = allSales3.filter((e: any) => matchesCloser(e, c))
    return { id: c.id, revenue: s.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0) }
  }).sort((a, b) => b.revenue - a.revenue)
  const myRank = rankList.findIndex(r => r.id === user.id) + 1

  // Desconto médio por vertical (só o dele) — mesma regra do baralho do superadmin
  const myVerticalsUsed = [...new Set(mySales3.map((e: any) => vLabel3(e.vertical ?? 'outros')))]
  const myDiscountByVertical = myVerticalsUsed.map(vlabel => {
    const inVert = mySales3.filter((e: any) => vLabel3(e.vertical ?? 'outros') === vlabel && !e.is_self_checkout)
    const withDiscount = inVert.map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
    const avgPct = withDiscount.length > 0 ? withDiscount.reduce((s, p) => s + p, 0) / withDiscount.length : 0
    // Média do time nessa vertical, pra comparação
    const teamInVert = allSales3.filter((e: any) => vLabel3(e.vertical ?? 'outros') === vlabel && !e.is_self_checkout)
    const teamDiscount = teamInVert.map((e: any) => extractCouponDiscountPct(e.coupon_code)).filter((p: any) => p !== null) as number[]
    const companyAvgPct = teamDiscount.length > 0 ? teamDiscount.reduce((s, p) => s + p, 0) / teamDiscount.length : 0
    return { vertical: vlabel, avgPct, companyAvgPct, count: withDiscount.length }
  })

  // Receita por vertical (só dele) — pro gráfico "meu desempenho por vertical"
  const myVerticalBreakdown = ALL_VERTICALS3.map(vlabel => {
    const inVert = mySales3.filter((e: any) => vLabel3(e.vertical ?? 'outros') === vlabel)
    const rev = inVert.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    return { vertical: vlabel, revenue: rev, count: inVert.length }
  })

  // Receita dele nos últimos 7 dias
  const myRevenueByDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDaysToDateStr(today3, i - 6)
    const { start, end } = dayBoundsSaoPaulo(d)
    const dayRev = mySales3.filter((e: any) => e.occurred_at >= start && e.occurred_at <= end)
      .reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    return { day: d.slice(5).split('-').reverse().join('/'), revenue: dayRev }
  })

  // ── Links dele que expiram hoje/amanhã, e vencidos sem reemissão ──
  // Mesmo critério de escopo do LinksClient: hubspot_id primeiro, nome como
  // fallback pros registros antigos sem hubspot_id preenchido.
  const nameNorm = (userName ?? '').trim().toLowerCase()
  const myPendingLinksRawScoped = (myPendingLinksRaw ?? []).filter((l: any) =>
    (meHubspotId && l.owner_hubspot_id && String(l.owner_hubspot_id).trim() === String(meHubspotId).trim()) ||
    (!l.owner_hubspot_id && nameNorm && String(l.owner_name ?? '').trim().toLowerCase() === nameNorm)
  )
  // Se o mesmo negócio (deal_id) tem mais de um link pendente — reemissão
  // antes do anterior vencer, ou link gerado errado e corrigido — mostra só
  // o mais recente, senão o mesmo negócio aparece duplicado na lista.
  const myPendingLinksByDeal = new Map<string, any>()
  myPendingLinksRawScoped.forEach((l: any) => {
    const key = l.deal_id ?? l.id
    const existing = myPendingLinksByDeal.get(key)
    if (!existing || l.generated_at > existing.generated_at) myPendingLinksByDeal.set(key, l)
  })
  const myPendingLinks = [...myPendingLinksByDeal.values()]

  const { start: tStart3b, end: tEnd3b } = dayBoundsSaoPaulo(today3)
  const tomorrow3 = addDaysToDateStr(today3, 1)
  const { end: tomorrowEnd3 } = dayBoundsSaoPaulo(tomorrow3)
  const nowIso = new Date().toISOString()

  const linksExpiringSoon = myPendingLinks
    .filter((l: any) => l.expires_at >= tStart3b && l.expires_at <= tomorrowEnd3)
    .sort((a: any, b: any) => a.expires_at.localeCompare(b.expires_at))
  const linksExpired = myPendingLinks
    .filter((l: any) => l.expires_at < nowIso)
    .sort((a: any, b: any) => b.expires_at.localeCompare(a.expires_at))

  // Insight de IA pessoal — mesmo gerador/cache usado no baralho do superadmin,
  // só que passando um array com um closer só (ele mesmo).
  const myInsightsMap = await ensureDailyInsights([{
    id: user.id, name: userName, team: userTeam ?? null, revenue: myRevenue, salesCount: mySalesCount,
    goalSales: myGoalSales, pctGoal: myPctGoal, avgTicket: myAvgTicket, daysSinceLastSale: myDaysSinceLastSale,
    rank: myRank, myCerts: myCertsCount, moneyLeft: myMoneyLeft, discountByVertical: myDiscountByVertical,
  }])
  const myInsight = myInsightsMap[user.id] ?? ''

  return (
    <UserDashboard
      userName={userName}
      avatarUrl={avatarUrl}
      teamName={userTeam ?? ''}
      completed={completed}
      total={total}
      pct={pct}
      steps={stepsWithStatus}
      uncheckedMaterials={uncheckedMaterials ?? []}
      trailMode={trailMode}
      commercial={{
        revenue: myRevenue, salesCount: mySalesCount, avgTicket: myAvgTicket, goalSales: myGoalSales,
        pctGoal: myPctGoal, revToday: myRevToday, salesTodayCount: myTodaySales.length, moneyLeft: myMoneyLeft,
        certsCount: myCertsCount, daysSinceLastSale: myDaysSinceLastSale, rank: myRank, totalClosers: rankList.length,
        discountByVertical: myDiscountByVertical, verticalBreakdown: myVerticalBreakdown, revenueByDay: myRevenueByDay,
        insight: myInsight,
      }}
      linkAlerts={{ expiringSoon: linksExpiringSoon, expired: linksExpired }}
    />
  )
}
