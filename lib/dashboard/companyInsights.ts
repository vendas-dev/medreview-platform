// Mural de insights de IA em nível de empresa (dashboard inicial, superadmin).
//
// Gerado UMA VEZ POR DIA (horário de São Paulo) — igual ao insight por closer,
// mas aqui é uma linha só, compartilhada por todo mundo que olha o dashboard
// naquele dia (não é por usuário). A primeira pessoa a abrir o dashboard
// naquele dia dispara a geração; os acessos seguintes só leem o cache.

import { createAdminClient } from '@/lib/supabase/admin'
import { todayInSaoPaulo } from '@/lib/timezone'

export interface CompanyInsight {
  type:     'alerta' | 'oportunidade' | 'destaque'
  titulo:   string
  motivo:   string | null
  sugestao: string | null
}

export interface VerticalSnapshot {
  vertical:       string
  revenue:        number
  count:          number
  avgTicket:      number
  avgDiscountPct: number
}

export interface CompanyInsightInput {
  totalRevMonth:      number
  totalRevPrevMonth:  number
  pctCompanyGoal:     number
  totalMoneyLeft:     number
  verticalNow:        VerticalSnapshot[]
  verticalPrev:       VerticalSnapshot[]
  forecast:           { ativas: number; atrasadas: number; emRisco: number; persistenceRate: number }
  topClosers:         { name: string; revenue: number; pctGoal: number }[]
  riskClosers:        { name: string; daysSinceLastSale: number; pctGoal: number }[]
}

export async function ensureCompanyInsights(input: CompanyInsightInput): Promise<CompanyInsight[]> {
  const admin = createAdminClient()
  const today = todayInSaoPaulo()

  const { data: existing } = await admin
    .from('company_daily_insights').select('insights').eq('insight_date', today).maybeSingle()

  if (existing?.insights) return existing.insights as CompanyInsight[]

  const insights = await generateInsights(input)

  const { error } = await admin.from('company_daily_insights')
    .upsert({ insight_date: today, insights }, { onConflict: 'insight_date' })
  if (error) console.error('[companyInsights] erro ao salvar cache:', error.message)

  return insights
}

async function generateInsights(input: CompanyInsightInput): Promise<CompanyInsight[]> {
  if (input.totalRevMonth === 0 && input.verticalNow.every(v => v.count === 0)) {
    return [{ type: 'destaque', titulo: 'Sem dados suficientes ainda este mês.', motivo: null, sugestao: null }]
  }

  const vertLines = input.verticalNow.map(v => {
    const prev = input.verticalPrev.find(p => p.vertical === v.vertical)
    const ticketDelta = prev && prev.avgTicket > 0 ? ((v.avgTicket - prev.avgTicket) / prev.avgTicket) * 100 : null
    return [
      `${v.vertical}: receita R$ ${v.revenue.toFixed(0)} (${v.count} vendas), ticket médio R$ ${v.avgTicket.toFixed(0)}`,
      ticketDelta !== null ? ` (${ticketDelta >= 0 ? '+' : ''}${ticketDelta.toFixed(0)}% vs mês anterior)` : '',
      `, desconto médio ${v.avgDiscountPct.toFixed(1)}%`,
    ].join('')
  }).join('\n')

  const prompt = [
    'Você é um analista comercial sênior olhando o painel de uma empresa de cursos médicos (verticais:',
    'Anest-Review, Oft-Review, Ortop-Review, Med-Review R1). Analise os números abaixo e devolva um',
    'JSON puro (array, sem markdown, sem texto fora do array) com 3 a 5 insights REALMENTE relevantes',
    '— só inclua algo se houver um padrão notável (queda/subida expressiva, desconto fora do padrão,',
    'risco de meta, assinatura em risco). Não invente insight genérico se os números forem normais.',
    '',
    'Cada item do array: { "type": "alerta"|"oportunidade"|"destaque", "titulo": string (máx 12 palavras,',
    'direto, com o número real), "motivo": string ou null (máx 14 palavras, causa provável), "sugestao":',
    'string ou null (máx 14 palavras, ação concreta) }.',
    '',
    `Receita do mês: R$ ${input.totalRevMonth.toFixed(0)} (mês anterior: R$ ${input.totalRevPrevMonth.toFixed(0)})`,
    `% da meta da empresa atingido: ${input.pctCompanyGoal.toFixed(0)}%`,
    `Dinheiro deixado na mesa (desconto) no mês: R$ ${input.totalMoneyLeft.toFixed(0)}`,
    '',
    'Por vertical (mês atual vs anterior):',
    vertLines,
    '',
    `Assinaturas recorrentes: ${input.forecast.ativas} ativas, ${input.forecast.atrasadas} atrasadas, ${input.forecast.emRisco} em risco (aderência histórica: ${input.forecast.persistenceRate.toFixed(0)}%)`,
    '',
    input.topClosers.length > 0 ? `Top closers do mês: ${input.topClosers.map(c => `${c.name} (R$ ${c.revenue.toFixed(0)}, ${c.pctGoal.toFixed(0)}% da meta)`).join('; ')}` : '',
    input.riskClosers.length > 0 ? `Closers sem vender há dias: ${input.riskClosers.map(c => `${c.name} (${c.daysSinceLastSale} dias, ${c.pctGoal.toFixed(0)}% da meta)`).join('; ')}` : '',
    '',
    'Responda APENAS com o array JSON.',
  ].filter(Boolean).join('\n')

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
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    let raw = data.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? ''
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) raw = match[0]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('resposta não é um array')
    return parsed.slice(0, 5).map((p: any) => ({
      type: ['alerta', 'oportunidade', 'destaque'].includes(p.type) ? p.type : 'destaque',
      titulo: p.titulo ?? 'Insight indisponível',
      motivo: p.motivo ?? null,
      sugestao: p.sugestao ?? null,
    }))
  } catch {
    return [{ type: 'destaque', titulo: 'Não foi possível gerar os insights agora.', motivo: null, sugestao: null }]
  }
}
