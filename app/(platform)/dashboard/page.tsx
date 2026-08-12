export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SuperDashboard } from './SuperDashboard'
import { UserDashboard } from './UserDashboard'
import { ensureDailyInsights } from '@/lib/dashboard/closerInsights'
import { ensureCompanyInsights } from '@/lib/dashboard/companyInsights'
import { todayInSaoPaulo, monthBoundsSaoPaulo, dayBoundsSaoPaulo, addDaysToDateStr } from '@/lib/timezone'
import { eventMoneyLeftOnTable, extractCouponDiscountPct } from '@/lib/telao/format'
import { computeForecast, RecurringSale } from '@/lib/telao/forecast'

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
      { data: monthLeads },
      { data: allRecurringRaw },
      { data: prevMonthSales },
    ] = await Promise.all([
      admin2.from('profiles').select('id, name, team, avatar_url, hubspot_id').neq('role', 'superadmin'),
      admin2.from('telao_events')
        .select('closer_id, closer_hubspot_id, co_closer_id, co_closer_hubspot_id, value, occurred_at, sale_type, coupon_code, is_self_checkout, seller_type, is_recurring, installment_number, event_type, product, vertical')
        .eq('event_type', 'sale').gte('occurred_at', mStart).lte('occurred_at', mEnd)
        .limit(999999),
      admin2.from('telao_events')
        .select('closer_id, closer_hubspot_id')
        .eq('event_type', 'ambassador_certified').gte('occurred_at', mStart).lte('occurred_at', mEnd)
        .limit(999999),
      admin2.from('closer_goals').select('user_id, goal_sales').eq('month', monthKeyStr),
      admin2.from('hubspot_leads').select('owner_id').gte('created_at_hs', mStart).lte('created_at_hs', mEnd).limit(999999),
      // Histórico COMPLETO de recorrência (não limitado ao mês) — necessário
      // pro forecast mês a mês até dezembro, igual ao que já existe no /intel.
      admin2.from('telao_events')
        .select('subscription_id, installment_number, total_installments, value, occurred_at')
        .eq('event_type', 'sale').eq('is_recurring', true).not('subscription_id', 'is', null)
        .limit(999999),
      admin2.from('telao_events')
        .select('value, vertical, coupon_code, is_self_checkout, sale_type')
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

      const hasTopTicket = maxSingleSale > 0 && mySales.some((e: any) => (Number(e.value) || 0) === maxSingleSale)

      const badges: string[] = []
      if (goalSales > 0 && pctGoal >= 100) badges.push('meta_batida')
      if (salesCount > 0 && daysSinceLastSale !== null && daysSinceLastSale >= 3) badges.push('sem_vender')
      if (hasTopTicket) badges.push('maior_ticket')
      if (salesLast3Days >= 3) badges.push('em_alta')

      return {
        id: c.id, name: c.name, team: c.team, avatarUrl: c.avatar_url,
        revenue, salesCount, avgTicket, goalSales, pctGoal,
        daysSinceLastSale, myCerts, convRate, moneyLeft, badges, discountByVertical,
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
    const mrrAtual = salesMonth.filter((e: any) => e.is_recurring).reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
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
    const pctCompanyGoal = totalGoalMonth > 0 ? Math.min((totalRevMonth / totalGoalMonth) * 100, 100) : 0

    // Frase de IA por closer — cacheada 1x por dia, não recalculada a cada acesso.
    const insightsMap = await ensureDailyInsights(closerCards.map(c => ({
      id: c.id, name: c.name, team: c.team, revenue: c.revenue, salesCount: c.salesCount,
      goalSales: c.goalSales, pctGoal: c.pctGoal, avgTicket: c.avgTicket,
      daysSinceLastSale: c.daysSinceLastSale, rank: c.rank, myCerts: c.myCerts, moneyLeft: c.moneyLeft,
      discountByVertical: c.discountByVertical,
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
      .map(c => ({ name: c.name, revenue: c.revenue, pctGoal: c.pctGoal }))
    const riskClosersForInsight = closerCardsWithInsight.filter(c => c.daysSinceLastSale !== null && c.daysSinceLastSale >= 4)
      .sort((a, b) => (b.daysSinceLastSale ?? 0) - (a.daysSinceLastSale ?? 0)).slice(0, 3)
      .map(c => ({ name: c.name, daysSinceLastSale: c.daysSinceLastSale as number, pctGoal: c.pctGoal }))

    const companyInsights = await ensureCompanyInsights({
      totalRevMonth, totalRevPrevMonth, pctCompanyGoal, totalMoneyLeft,
      verticalNow: verticalBreakdown, verticalPrev: verticalPrevMonth,
      forecast: { ativas: forecastDetail.ativas, atrasadas: forecastDetail.atrasadas, emRisco: forecastDetail.emRisco, persistenceRate: forecastDetail.persistenceRate },
      topClosers: topClosersForInsight, riskClosers: riskClosersForInsight,
    })

    return (
      <SuperDashboard
        userName={userName}
        stats={{ totalUsers, totalSteps, totalMaterials, activeOnboarding, completedCount, avgCompletion, onlineCount, passedRate, totalConversations: conversations?.length ?? 0 }}
        users={userProgress}
        progressByDay={progressByDay}
        commercial={{
          totalRevMonth, totalSalesMonth, totalSalesToday, totalRevToday, avgTicketAll, totalMoneyLeft, totalCertsMonth,
          forecast: forecastUntilYearEnd, monthlyForecast, forecastDetail, revenueByDay, closerCards: closerCardsWithInsight,
          totalGoalMonth, pctCompanyGoal, productRanking, verticalBreakdown, lastSaleAt, pctMonthElapsed, companyInsights,
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
  ] = await Promise.all([
    admin3.from('profiles').select('id, hubspot_id').neq('role', 'superadmin'),
    admin3.from('telao_events')
      .select('closer_id, closer_hubspot_id, co_closer_id, co_closer_hubspot_id, value, occurred_at, sale_type, coupon_code, is_self_checkout, seller_type, is_recurring, installment_number, product, vertical, event_type')
      .eq('event_type', 'sale').gte('occurred_at', mStart3).lte('occurred_at', mEnd3).limit(999999),
    admin3.from('telao_events').select('closer_id, closer_hubspot_id')
      .eq('event_type', 'ambassador_certified').gte('occurred_at', mStart3).lte('occurred_at', mEnd3).limit(999999),
    admin3.from('closer_goals').select('goal_sales').eq('user_id', user.id).eq('month', monthKey3).maybeSingle(),
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
    />
  )
}
