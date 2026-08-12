export const maxDuration = 30

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { todayInSaoPaulo, monthBoundsSaoPaulo } from '@/lib/timezone'
import { eventMoneyLeftOnTable } from '@/lib/telao/format'

function matchesCloser(e: { closer_id?: string|null; closer_hubspot_id?: string|null; co_closer_id?: string|null; co_closer_hubspot_id?: string|null }, c: { id:string; hubspot_id:string|null }) {
  if (e.closer_id && e.closer_id === c.id) return true
  if (c.hubspot_id && e.closer_hubspot_id && String(e.closer_hubspot_id).trim() === String(c.hubspot_id).trim()) return true
  if (e.co_closer_id && e.co_closer_id === c.id) return true
  if (c.hubspot_id && e.co_closer_hubspot_id && String(e.co_closer_hubspot_id).trim() === String(c.hubspot_id).trim()) return true
  return false
}

// Insight curto (1 frase) por closer, pro card do baralho no dashboard inicial.
// Só quem já viu essa carta hoje que gera de verdade — fica em cache no banco
// (mesma tabela/local do insight do /intel) até virar o dia.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { closerId } = await req.json()
  if (!closerId) return NextResponse.json({ error: 'closerId obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const today = todayInSaoPaulo()
  const scope = `deck-${closerId}`

  // Já foi gerado hoje? Devolve na hora, sem chamar IA de novo.
  const { data: cached } = await admin
    .from('commercial_insights').select('content').eq('insight_date', today).eq('scope', scope).maybeSingle()
  if (cached?.content) {
    return NextResponse.json({ ok: true, content: cached.content, cached: true })
  }

  const { data: closer } = await admin
    .from('profiles').select('id, name, team, hubspot_id').eq('id', closerId).single()
  if (!closer) return NextResponse.json({ error: 'Closer não encontrado' }, { status: 404 })

  const monthKey = today.slice(0, 7)
  const { start: mStart, end: mEnd } = monthBoundsSaoPaulo(monthKey)

  const [{ data: sales }, { data: certs }, { data: goal }] = await Promise.all([
    admin.from('telao_events')
      .select('closer_id, closer_hubspot_id, co_closer_id, co_closer_hubspot_id, value, occurred_at, coupon_code, is_self_checkout, seller_type, is_recurring, installment_number, event_type, sale_type')
      .eq('event_type', 'sale').gte('occurred_at', mStart).lte('occurred_at', mEnd)
      .limit(999999),
    admin.from('telao_events')
      .select('closer_id, closer_hubspot_id')
      .eq('event_type', 'ambassador_certified').gte('occurred_at', mStart).lte('occurred_at', mEnd)
      .limit(999999),
    admin.from('closer_goals').select('goal_sales').eq('user_id', closerId).eq('month', monthKey).maybeSingle(),
  ])

  const c = closer as any
  const mySales = (sales ?? []).filter((e: any) => matchesCloser(e, c))
  const revenue = mySales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const salesCount = mySales.length
  // Ticket médio só com a 1ª parcela de cada venda (mesma regra do resto do
  // sistema) — receita/contagem acima continuam somando tudo.
  const myNovaSales = mySales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova')
  const myNovaRev = myNovaSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const avgTicket = myNovaSales.length > 0 ? myNovaRev / myNovaSales.length : 0
  const goalSales = Number((goal as any)?.goal_sales ?? 0)
  const pctGoal = goalSales > 0 ? (revenue / goalSales) * 100 : 0
  const sorted = [...mySales].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  const lastSaleAt = sorted[0]?.occurred_at ?? null
  const daysSinceLastSale = lastSaleAt ? Math.floor((Date.now() - new Date(lastSaleAt).getTime()) / 86400000) : null
  const myCerts = (certs ?? []).filter((e: any) => matchesCloser(e, c)).length
  const moneyLeft = mySales.reduce((s: number, e: any) => s + eventMoneyLeftOnTable(e), 0)

  const ctx = {
    nome: c.name, time: c.team,
    receita_mes: Math.round(revenue), vendas_mes: salesCount, ticket_medio: Math.round(avgTicket),
    meta: goalSales, pct_meta: goalSales > 0 ? Math.round(pctGoal) : null,
    dias_sem_vender: daysSinceLastSale,
    embaixadores_certificados: c.team === 'R1' ? myCerts : null,
    dinheiro_deixado_na_mesa: Math.round(moneyLeft),
  }

  const systemMsg = 'Você é um analista comercial direto e objetivo. Responda em UMA frase só, sem introdução, sem markdown, sem aspas.'
  const userMsg = [
    `Dados de ${c.name} (time ${c.team}) neste mês: ${JSON.stringify(ctx)}`,
    '',
    'Escreva UMA frase curta (máx. 25 palavras) com o insight mais útil e acionável pra um gestor sobre essa pessoa.',
    'Priorize: se está em risco de meta, se não vende há dias, se tem destaque positivo, ou uma sugestão prática.',
    'Fale na terceira pessoa (ex: "Ana está a 60% da meta e não vende há 3 dias — vale um check-in").',
    'Use os números reais. Não repita todos os dados, escolha o mais relevante.',
  ].join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: systemMsg,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    const aiData = await res.json()
    const content = (aiData.content?.[0]?.text ?? '').trim().replace(/^["']|["']$/g, '')

    if (!content) return NextResponse.json({ error: 'IA não retornou conteúdo' }, { status: 500 })

    await admin.from('commercial_insights').upsert(
      { insight_date: today, scope, content, model_used: 'claude-sonnet-4-6' },
      { onConflict: 'insight_date,scope' }
    )

    return NextResponse.json({ ok: true, content, cached: false })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao gerar insight' }, { status: 500 })
  }
}
