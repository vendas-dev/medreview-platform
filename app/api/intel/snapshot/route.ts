import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Vercel Cron chama essa rota — protegida por CRON_SECRET
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  const snapshotDate = new Date(today)
  snapshotDate.setDate(snapshotDate.getDate() - 1) // ontem (dia já fechado)
  const dateStr = snapshotDate.toISOString().slice(0, 10)

  // Mês atual para filtros
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString()
  const prevMonthSameDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).toISOString()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Buscar todos os closers (com hubspot_id preenchido ou não)
  const { data: closers } = await admin
    .from('profiles')
    .select('id, hubspot_id, team')
    .neq('role', 'superadmin')

  if (!closers?.length) return NextResponse.json({ ok: true, processed: 0 })

  // Dias úteis do mês
  const totalBusinessDays = getBusinessDays(
    new Date(today.getFullYear(), today.getMonth(), 1),
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
  )
  const passedBusinessDays = getBusinessDays(
    new Date(today.getFullYear(), today.getMonth(), 1),
    today
  )

  let processed = 0

  for (const closer of closers) {
    try {
      // ── Vendas do mês (telao_events) ──────────────────────
      const { data: salesMonth } = await admin
        .from('telao_events')
        .select('value, occurred_at, vertical')
        .eq('closer_id', closer.id)
        .eq('event_type', 'sale')
        .gte('occurred_at', monthStart)

      const { data: salesPrevWeek } = await admin
        .from('telao_events')
        .select('value')
        .eq('closer_id', closer.id)
        .eq('event_type', 'sale')
        .gte('occurred_at', twoWeeksAgo)
        .lt('occurred_at', weekAgo)

      const { data: salesPrevMonthSameDate } = await admin
        .from('telao_events')
        .select('value')
        .eq('closer_id', closer.id)
        .eq('event_type', 'sale')
        .gte('occurred_at', prevMonthStart)
        .lte('occurred_at', prevMonthSameDate)

      const { data: salesWeek } = await admin
        .from('telao_events')
        .select('value')
        .eq('closer_id', closer.id)
        .eq('event_type', 'sale')
        .gte('occurred_at', weekAgo)

      const { data: allSalesMonth } = await admin
        .from('telao_events')
        .select('occurred_at')
        .eq('closer_id', closer.id)
        .eq('event_type', 'sale')
        .gte('occurred_at', monthStart)
        .order('occurred_at', { ascending: false })

      // Calcular métricas
      const revenueMonth     = sum(salesMonth)
      const revenueWeek      = sum(salesWeek)
      const revenuePrevWeek  = sum(salesPrevWeek)
      const revenuePrevMonth = sum(salesPrevMonthSameDate)
      const salesMonthCount  = salesMonth?.length ?? 0
      const salesWeekCount   = salesWeek?.length ?? 0

      const deltaWeek  = revenuePrevWeek  > 0 ? ((revenueWeek  - revenuePrevWeek)  / revenuePrevWeek)  * 100 : 0
      const deltaMonth = revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : 0

      // Projeção linear
      const revenueProjected = passedBusinessDays > 0
        ? (revenueMonth / passedBusinessDays) * totalBusinessDays
        : 0

      // Dias sem venda
      const daysSinceLastSale = allSalesMonth?.length
        ? Math.floor((today.getTime() - new Date(allSalesMonth[0].occurred_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      // Receita por vertical
      const revenueByVertical: Record<string, number> = {}
      for (const s of salesMonth ?? []) {
        if (s.vertical) {
          revenueByVertical[s.vertical] = (revenueByVertical[s.vertical] ?? 0) + (s.value ?? 0)
        }
      }

      // ── Meta do mês ───────────────────────────────────────
      const { data: goal } = await admin
        .from('closer_goals')
        .select('*')
        .eq('user_id', closer.id)
        .eq('month', monthKey)
        .single()

      const goalSales      = (goal as any)?.goal_sales      ?? 0
      const goalAmbassador = (goal as any)?.goal_ambassador ?? 0
      const goalsByVertical = (goal as any)?.goals_by_vertical ?? {}

      const pctGoal      = goalSales > 0 ? (revenueMonth / goalSales) * 100 : 0
      const willHitGoal  = revenueProjected >= goalSales
      const deficitOrSurplus = revenueProjected - goalSales

      // ── Leads do HubSpot ──────────────────────────────────
      let leadsMonth = 0, leadsOpen = 0, leadsLost = 0, conversionRate = 0

      if (closer.hubspot_id) {
        const { data: leads } = await admin
          .from('hubspot_leads')
          .select('deal_stage, created_at_hs')
          .eq('owner_id', closer.hubspot_id)
          .gte('created_at_hs', monthStart)

        leadsMonth = leads?.length ?? 0
        leadsOpen  = leads?.filter((l: any) => !['closedwon','closedlost'].includes(l.deal_stage ?? '')).length ?? 0
        leadsLost  = leads?.filter((l: any) => l.deal_stage === 'closedlost').length ?? 0
        conversionRate = leadsMonth > 0 ? (salesMonthCount / leadsMonth) * 100 : 0
      }

      // ── Salvar snapshot ───────────────────────────────────
      await admin.from('commercial_snapshots').upsert({
        snapshot_date:               dateStr,
        user_id:                     closer.id,
        revenue_today:               0, // hoje ainda não fechou
        revenue_week:                revenueWeek,
        revenue_month:               revenueMonth,
        sales_today:                 0,
        sales_week:                  salesWeekCount,
        sales_month:                 salesMonthCount,
        revenue_prev_week:           revenuePrevWeek,
        revenue_prev_month_same_date: revenuePrevMonth,
        delta_week_pct:              deltaWeek,
        delta_month_pct:             deltaMonth,
        revenue_projected:           revenueProjected,
        pct_goal:                    pctGoal,
        will_hit_goal:               willHitGoal,
        deficit_or_surplus:          deficitOrSurplus,
        leads_month:                 leadsMonth,
        leads_open:                  leadsOpen,
        leads_lost:                  leadsLost,
        conversion_rate:             conversionRate,
        revenue_by_vertical:         revenueByVertical,
        goal_sales:                  goalSales,
        goal_ambassador:             goalAmbassador,
        goals_by_vertical:           goalsByVertical,
        days_since_last_sale:        daysSinceLastSale,
        business_days_total:         totalBusinessDays,
        business_days_passed:        passedBusinessDays,
        business_days_remaining:     totalBusinessDays - passedBusinessDays,
      }, { onConflict: 'user_id,snapshot_date' })

      processed++
    } catch (e) {
      console.error(`Snapshot error for closer ${closer.id}:`, e)
    }
  }

  // Gerar insights globais e por closer
  await generateInsights(admin, monthStart, monthKey)

  return NextResponse.json({ ok: true, processed, date: dateStr })
}

// ── Helpers ────────────────────────────────────────────────
function sum(rows: any[] | null): number {
  return (rows ?? []).reduce((s, r) => s + (r.value ?? 0), 0)
}

function getBusinessDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

async function generateInsights(admin: any, monthStart: string, monthKey: string) {
  const today = new Date().toISOString().slice(0, 10)

  // Buscar snapshots de hoje de todos os closers
  const { data: snapshots } = await admin
    .from('commercial_snapshots')
    .select('*, profiles!inner(name, team, hubspot_id)')
    .eq('snapshot_date', today)

  if (!snapshots?.length) return

  // Montar contexto para a IA
  const context = snapshots.map((s: any) => ({
    nome:             s.profiles?.name,
    time:             s.profiles?.team,
    receita_mes:      s.revenue_month,
    meta_mes:         s.goal_sales,
    pct_meta:         s.pct_goal?.toFixed(1),
    projecao:         s.revenue_projected,
    vai_bater_meta:   s.will_hit_goal,
    deficit_surplus:  s.deficit_or_surplus,
    delta_semana_pct: s.delta_week_pct?.toFixed(1),
    delta_mes_pct:    s.delta_month_pct?.toFixed(1),
    leads_mes:        s.leads_month,
    conversao_pct:    s.conversion_rate?.toFixed(1),
    dias_sem_venda:   s.days_since_last_sale,
    dias_uteis_restantes: s.business_days_remaining,
  }))

  const prompt = `Você é um analista comercial especialista. Analise os dados abaixo de ${today} e gere insights de gestão objetivos e acionáveis em português.

DADOS DOS CLOSERS:
${JSON.stringify(context, null, 2)}

Gere um relatório com:
1. Alertas críticos (closers em risco de não bater meta, quedas bruscas de conversão, dias sem venda atípicos)
2. Destaques positivos (quem está acima da média, quem deve superar a meta)
3. Análise geral do time (pace coletivo, projeção de fechamento do time)
4. Recomendações práticas para a gestão

Seja direto, use números específicos, evite generalidades. Máximo 400 palavras.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''

    if (text) {
      await admin.from('commercial_insights').upsert({
        insight_date: today,
        scope:        'global',
        content:      text,
        model_used:   'claude-sonnet-4-6',
      }, { onConflict: 'insight_date,scope' })
    }

    // Insights individuais por closer
    for (const s of snapshots) {
      const closerCtx = {
        nome:             s.profiles?.name,
        time:             s.profiles?.team,
        receita_mes:      s.revenue_month,
        meta_mes:         s.goal_sales,
        pct_meta:         s.pct_goal?.toFixed(1),
        projecao:         s.revenue_projected,
        vai_bater_meta:   s.will_hit_goal,
        delta_semana_pct: s.delta_week_pct?.toFixed(1),
        leads_mes:        s.leads_month,
        conversao_pct:    s.conversion_rate?.toFixed(1),
        dias_sem_venda:   s.days_since_last_sale,
        dias_uteis_restantes: s.business_days_remaining,
        receita_por_vertical: s.revenue_by_vertical,
      }

      const closerPrompt = `Você é um coach comercial. Analise os dados abaixo de ${closerCtx.nome} em ${today} e gere um insight pessoal, direto e motivador em português.

DADOS:
${JSON.stringify(closerCtx, null, 2)}

Gere:
1. Situação atual (pace vs meta, tendência da semana)
2. Principal ponto de atenção
3. Uma recomendação prática e específica para hoje/amanhã

Tom: direto, encorajador mas realista. Máximo 150 palavras. Fale em primeira pessoa com o closer.`

      const closerRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 512,
          messages:   [{ role: 'user', content: closerPrompt }],
        }),
      })

      const closerData = await closerRes.json()
      const closerText = closerData.content?.[0]?.text ?? ''

      if (closerText) {
        await admin.from('commercial_insights').upsert({
          insight_date: today,
          scope:        s.user_id,
          content:      closerText,
          model_used:   'claude-sonnet-4-6',
        }, { onConflict: 'insight_date,scope' })
      }
    }
  } catch (e) {
    console.error('Insight generation error:', e)
  }
}
