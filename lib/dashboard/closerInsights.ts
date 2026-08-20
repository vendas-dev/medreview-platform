// Frase de IA por closer no baralho do dashboard inicial (superadmin).
//
// Gerada UMA VEZ POR DIA (horário de São Paulo) — não a cada abertura do
// dashboard. A primeira pessoa a abrir a página naquele dia dispara a
// geração de quem ainda não tem frase hoje; os acessos seguintes só leem o
// que já foi calculado. Os NÚMEROS de cada carta (receita, meta, ranking...)
// já são calculados ao vivo em page.tsx — aqui só cuidamos da frase de IA,
// que é a parte cara/lenta (chamada à Anthropic).

import { createAdminClient } from '@/lib/supabase/admin'
import { todayInSaoPaulo } from '@/lib/timezone'

export interface CloserCardInput {
  id:                 string
  name:               string
  team:               string | null
  revenue:            number
  salesCount:         number
  goalSales:          number
  pctGoal:            number
  avgTicket:          number
  daysSinceLastSale:  number | null
  rank:               number
  myCerts:            number
  moneyLeft:          number
  // Desconto médio concedido por vertical (só verticais onde já vendeu),
  // com a média da empresa naquela vertical do lado, pra IA poder comparar
  // ("acima/abaixo do normal do time"), não só citar o número isolado.
  discountByVertical: { vertical: string; avgPct: number; companyAvgPct: number; count: number }[]
  // Em que condição (à vista/parcelado/Nx sem juros) esse closer mais gera
  // os links de pagamento — vem da tabela de links, independente de ter
  // convertido ou não. Ajuda a IA a falar de padrão de negociação, não só
  // de desconto concedido.
  paymentModeBreakdown: { mode: string; count: number; pct: number }[]
}

// Recebe as cartas já calculadas (page.tsx) e devolve um mapa id → frase de
// IA, gerando (e cacheando) só as que ainda não existem hoje.
export async function ensureDailyInsights(cards: CloserCardInput[]): Promise<Record<string, string>> {
  if (cards.length === 0) return {}

  const admin = createAdminClient()
  const today = todayInSaoPaulo()
  const ids   = cards.map(c => c.id)

  const { data: existing } = await admin
    .from('closer_daily_insights')
    .select('user_id, insight_text')
    .eq('card_date', today)
    .in('user_id', ids)

  const map = Object.fromEntries((existing ?? []).map((r: any) => [r.user_id, r.insight_text]))
  const missing = cards.filter(c => !map[c.id])

  if (missing.length > 0) {
    const generated = await Promise.all(missing.map(async c => ({ id: c.id, text: await generateInsight(c) })))

    const { error } = await admin.from('closer_daily_insights').upsert(
      generated.map(g => ({ user_id: g.id, card_date: today, insight_text: g.text })),
      { onConflict: 'user_id,card_date' }
    )
    if (error) console.error('[closerInsights] erro ao salvar cache:', error.message)

    generated.forEach(g => { map[g.id] = g.text })
  }

  return map
}

async function generateInsight(c: CloserCardInput): Promise<string> {
  if (c.salesCount === 0 && c.goalSales === 0) {
    return JSON.stringify({ resumo: 'Sem dados suficientes ainda este mês.', destaque: null, atencao: null })
  }

  // A empresa só trabalha com embaixadores na vertical R1 — o time OAO não
  // tem esse programa. Não faz sentido citar "0 embaixadores" pro OAO como
  // se fosse uma falha; pra eles, essa linha simplesmente não entra no prompt.
  const isR1Team = c.team === 'R1'

  const discountLines = c.discountByVertical.length > 0
    ? c.discountByVertical.map(d =>
        d.count > 0
          ? `${d.vertical}: closer dá em média ${d.avgPct.toFixed(1)}% de desconto (média do time nessa vertical: ${d.companyAvgPct.toFixed(1)}%)`
          : `${d.vertical}: nunca concedeu desconto`
      ).join('; ')
    : null

  const paymentModeLine = c.paymentModeBreakdown.length > 0
    ? c.paymentModeBreakdown.map(p => `${p.mode}: ${p.pct.toFixed(0)}% dos links (${p.count})`).join('; ')
    : null

  const prompt = [
    'Analise o desempenho deste closer no mês e devolva um JSON puro (sem markdown, sem texto',
    'fora do JSON), com estes 3 campos, todos curtos (máximo 16 palavras cada), em português,',
    'terceira pessoa, com números reais:',
    '',
    '"resumo": frase geral de desempenho (receita, % da meta, ritmo)',
    '"destaque": UM ponto forte específico com número real (ou null se não houver nada notável)',
    '"atencao": UM ponto de atenção/risco/oportunidade específico com número real (ou null se não houver).',
    '  Se o padrão de desconto por vertical for notável (bem acima ou bem abaixo da média do time em',
    '  alguma vertical), pode ser esse o ponto de atenção — mas só se for realmente destacável. O padrão',
    '  de condição de pagamento (ex: closer que só gera parcelado, nunca à vista) também pode virar',
    '  destaque ou atenção, se for um padrão forte.',
    '',
    'IMPORTANTE: "dias desde a última venda" é literalmente isso — quantos dias faz desde a venda mais',
    'recente dela (0 significa que vendeu hoje). NÃO é "dias sem vender no mês" nem implica nada sobre',
    'os outros dias do mês. Frases corretas: "não vende há 4 dias" ou "vendeu hoje". Frase ERRADA (não',
    'use): "apenas X dia(s) sem vender no mês" — isso muda o sentido do dado.',
    '',
    `Nome: ${c.name}`,
    `Time: ${c.team ?? '—'}`,
    `Receita do mês: R$ ${c.revenue.toFixed(0)}`,
    `Meta do mês: R$ ${c.goalSales.toFixed(0)} (${c.pctGoal.toFixed(0)}% atingido)`,
    `Vendas no mês: ${c.salesCount}`,
    `Ticket médio: R$ ${c.avgTicket.toFixed(0)}`,
    `Dias desde a última venda dela (0 = vendeu hoje): ${c.daysSinceLastSale === null ? 'nenhuma venda ainda este mês' : c.daysSinceLastSale}`,
    `Posição no ranking do time: #${c.rank}`,
    // Embaixadores: só existe pro time R1 — pro OAO, nem entra no prompt.
    ...(isR1Team ? [`Embaixadores certificados: ${c.myCerts}`] : []),
    `Dinheiro deixado na mesa (desconto): R$ ${c.moneyLeft.toFixed(0)}`,
    ...(discountLines ? [`Desconto por vertical: ${discountLines}`] : []),
    ...(paymentModeLine ? [`Condição de pagamento mais usada nos links gerados: ${paymentModeLine}`] : []),
    '',
    'Responda APENAS com o objeto JSON, sem aspas triplas, sem markdown.',
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
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    let raw = data.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? ''
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) raw = match[0]
    const parsed = JSON.parse(raw)
    return JSON.stringify({
      resumo: parsed.resumo ?? 'Sem insight disponível no momento.',
      destaque: parsed.destaque ?? null,
      atencao: parsed.atencao ?? null,
    })
  } catch {
    return JSON.stringify({ resumo: 'Sem insight disponível no momento.', destaque: null, atencao: null })
  }
}
