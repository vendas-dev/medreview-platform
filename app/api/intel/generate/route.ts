import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (p as any)?.role === 'superadmin' ? user : null
}

// Mapeamento de slug → nome de exibição
const VERT_LABEL: Record<string, string> = {
  medreview:   'Med-Review R1',
  anestreview: 'Anest-Review',
  oftreview:   'Oft-Review',
  ortoprev:    'Ortop-Review',
}
function vLabel(k: string) { return VERT_LABEL[k] ?? k }

async function callClaude(prompt: string, maxTokens = 1024): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens: maxTokens, messages:[{ role:'user', content: prompt }] }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? null
}

function parseJSON(raw: string): any | null {
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
  try { return JSON.parse(cleaned) } catch { return null }
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin    = createAdminClient()
  const today    = new Date().toISOString().slice(0, 10)
  const monthKey = today.slice(0, 7)
  const [y, m]   = monthKey.split('-').map(Number)
  const mStart   = new Date(y, m - 1, 1).toISOString()
  const mEnd     = new Date(y, m, 0, 23, 59, 59).toISOString()

  const [{ data: closers }, { data: allSales }, { data: allLeads }, { data: goals }] = await Promise.all([
    admin.from('profiles').select('id, name, team, hubspot_id').neq('role', 'superadmin').order('name'),
    admin.from('telao_events').select('closer_id, closer_name, closer_hubspot_id, value, vertical').eq('event_type','sale').gte('occurred_at', mStart).lte('occurred_at', mEnd),
    admin.from('hubspot_leads').select('owner_id, deal_stage').gte('created_at_hs', mStart).lte('created_at_hs', mEnd),
    admin.from('closer_goals').select('*').eq('month', monthKey),
  ])

  const goalsMap = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))

  const context = (closers ?? []).map((c: any) => {
    const sales = (allSales ?? []).filter((e: any) =>
      e.closer_id === c.id ||
      (c.hubspot_id && e.closer_hubspot_id === c.hubspot_id) ||
      (e.closer_name && c.name && e.closer_name.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()))
    )
    const leads  = (allLeads ?? []).filter((l: any) => c.hubspot_id && l.owner_id === c.hubspot_id)
    const goal   = goalsMap[c.id]
    const rev    = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const goalV  = Number(goal?.goal_sales ?? 0)

    // Montar receita por vertical com labels corretos
    const byVert: Record<string, number> = {}
    sales.forEach((e: any) => { if (e.vertical) byVert[vLabel(e.vertical)] = (byVert[vLabel(e.vertical)] ?? 0) + (Number(e.value) || 0) })

    return {
      id: c.id, nome: c.name, time: c.team,
      receita_mes: rev, meta_mes: goalV,
      pct_meta: goalV > 0 ? Number(((rev / goalV) * 100).toFixed(1)) : null,
      vendas: sales.length,
      leads_mes: leads.length,
      conversao_pct: leads.length > 0 ? Number(((sales.length / leads.length) * 100).toFixed(1)) : null,
      por_vertical: byVert,
    }
  })

  // ── 1. Insight global ─────────────────────────────────────
  const globalPrompt = `Você é um analista comercial. Analise os dados abaixo e retorne SOMENTE JSON válido, sem markdown.

Data: ${today}
DADOS: ${JSON.stringify(context.map(({ id, ...rest }) => rest))}

Retorne EXATAMENTE neste formato:
{"alertas_criticos":[{"closer":"nome","texto":"frase direta com números reais"}],"atencao":[{"closer":"nome","texto":"frase direta com números reais"}],"destaques":[{"closer":"nome","texto":"frase direta com números reais"}],"resumo_time":"2-3 frases sobre o time com números","recomendacao":"uma ação específica e prática para hoje"}

Regras: máximo 2 itens por lista, frases curtas, use os dados reais.`

  const globalRaw  = await callClaude(globalPrompt)
  const globalData = globalRaw ? parseJSON(globalRaw) : null

  if (globalData) {
    await admin.from('commercial_insights').upsert(
      { insight_date: today, scope: 'global', content: JSON.stringify(globalData), model_used: 'claude-sonnet-4-6' },
      { onConflict: 'insight_date,scope' }
    )
  }

  // ── 2. Insights individuais por closer ────────────────────
  const closerInsights: Record<string, any> = {}

  for (const c of context) {
    const closerPrompt = `Você é um coach comercial. Analise os dados abaixo de ${c.nome} e retorne SOMENTE JSON válido, sem markdown.

Data: ${today}
DADOS: ${JSON.stringify({ nome:c.nome, time:c.time, receita_mes:c.receita_mes, meta_mes:c.meta_mes, pct_meta:c.pct_meta, vendas:c.vendas, leads_mes:c.leads_mes, conversao_pct:c.conversao_pct, por_vertical:c.por_vertical })}

Retorne EXATAMENTE neste formato:
{"situacao":"1-2 frases diretas sobre o momento atual com números reais","destaque":"o principal ponto positivo ou oportunidade","alerta":"o principal ponto de atenção (se houver, senão null)","acao":"uma ação concreta e específica para os próximos dias"}

Sem elogios genéricos. Fale em primeira pessoa com o consultor. Use números dos dados.`

    const closerRaw  = await callClaude(closerPrompt, 512)
    const closerData = closerRaw ? parseJSON(closerRaw) : null

    if (closerData) {
      await admin.from('commercial_insights').upsert(
        { insight_date: today, scope: c.id, content: JSON.stringify(closerData), model_used: 'claude-sonnet-4-6' },
        { onConflict: 'insight_date,scope' }
      )
      closerInsights[c.id] = closerData
    }
  }

  return NextResponse.json({ ok: true, global: globalData, closers: closerInsights })
}
