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

function matchName(a: string, b: string): boolean {
  if (!a || !b) return false
  const x = a.toLowerCase().trim(), y = b.toLowerCase().trim()
  return x === y || x.includes(y.split(' ')[0]) || y.includes(x.split(' ')[0])
}

// Cruzamento real: template → geração de link via deal_id
function analyzeTemplates(disparos: any[], links: any[]) {
  const linkDeals = new Set((links ?? []).map((l: any) => String(l.deal_id ?? '')).filter(Boolean))
  const tplMap: Record<string, { total: number; comLink: number }> = {}

  for (const d of (disparos ?? [])) {
    const tpl = d.template
    if (!tpl) continue
    if (!tplMap[tpl]) tplMap[tpl] = { total: 0, comLink: 0 }
    tplMap[tpl].total++
    if (d.id_negocio && linkDeals.has(String(d.id_negocio))) {
      tplMap[tpl].comLink++
    }
  }

  return Object.entries(tplMap)
    .map(([template, v]) => ({
      template,
      disparos:       v.total,
      deals_com_link: v.comLink,
      taxa_sucesso:   v.total > 0 ? Number(((v.comLink / v.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.taxa_sucesso - a.taxa_sucesso)
}

async function callClaude(prompt: string, max = 1024): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: max, messages: [{ role: 'user', content: prompt }] }),
  })
  return (await res.json()).content?.[0]?.text ?? null
}

function parseJSON(raw: string | null): any | null {
  if (!raw) return null
  try { return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) } catch { return null }
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

  const [
    { data: closers }, { data: allSales }, { data: allLeads },
    { data: goals }, { data: allDisparos }, { data: allLinks },
  ] = await Promise.all([
    admin.from('profiles').select('id,name,team,hubspot_id').neq('role', 'superadmin').order('name'),
    admin.from('telao_events').select('closer_id,closer_name,closer_hubspot_id,value,vertical').eq('event_type', 'sale').gte('occurred_at', mStart).lte('occurred_at', mEnd),
    admin.from('hubspot_leads').select('owner_id,deal_stage').gte('created_at_hs', mStart).lte('created_at_hs', mEnd),
    admin.from('closer_goals').select('*').eq('month', monthKey),
    // Incluir id_negocio para cruzamento com links
    admin.from('disparos').select('proprietario,template,vertical,data_disparo,id_negocio').gte('data_disparo', mStart).lte('data_disparo', mEnd),
    // Incluir deal_id para cruzamento com disparos
    admin.from('geracoes_links').select('owner_name,deal_value,vertical,product_name,deal_id').gte('generated_at', mStart).lte('generated_at', mEnd),
  ])

  const goalsMap = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))

  // Análise de templates para o time inteiro
  const templateRanking = analyzeTemplates(allDisparos ?? [], allLinks ?? [])
  const topTemplate     = templateRanking[0] ?? null
  const worstTemplate   = templateRanking.filter(t => t.disparos >= 3).at(-1) ?? null

  const context = (closers ?? []).map((c: any) => {
    const sales    = (allSales ?? []).filter((e: any) =>
      e.closer_id === c.id ||
      (c.hubspot_id && e.closer_hubspot_id === c.hubspot_id) ||
      (e.closer_name && matchName(e.closer_name, c.name))
    )
    const leads    = (allLeads ?? []).filter((l: any) => c.hubspot_id && l.owner_id === c.hubspot_id)
    const disparos = (allDisparos ?? []).filter((d: any) => matchName(d.proprietario ?? '', c.name))
    const links    = (allLinks ?? []).filter((l: any) => matchName(l.owner_name ?? '', c.name))
    const goal     = goalsMap[c.id]

    const rev      = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const goalV    = Number(goal?.goal_sales ?? 0)
    const valLinks = links.reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)

    // Análise de templates deste closer especificamente
    const closerTemplates = analyzeTemplates(disparos, links)
    const melhorTemplate  = closerTemplates[0] ?? null

    return {
      id: c.id, nome: c.name, time: c.team,
      receita_mes: rev, meta_mes: goalV,
      pct_meta: goalV > 0 ? Number(((rev / goalV) * 100).toFixed(1)) : null,
      vendas: sales.length,
      leads_mes: leads.length,
      conversao_leads: leads.length > 0 ? Number(((sales.length / leads.length) * 100).toFixed(1)) : null,
      disparos_mes: disparos.length,
      links_gerados: links.length,
      valor_links: valLinks,
      pipeline_pendente: Math.max(valLinks - rev, 0),
      // Template com maior conversão disparo→link para este closer
      melhor_template: melhorTemplate ? {
        nome: melhorTemplate.template,
        taxa_sucesso: melhorTemplate.taxa_sucesso,
        deals_com_link: melhorTemplate.deals_com_link,
        total_disparos: melhorTemplate.disparos,
      } : null,
    }
  })

  const totalValorLinks = (allLinks ?? []).reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)

  const prompt = `Você é um analista comercial sênior. Faça uma análise COMPLETA e DETALHADA dos dados abaixo. Retorne SOMENTE JSON válido, sem markdown.

Data: ${today}

DADOS DOS CLOSERS: ${JSON.stringify(context.map(({ id, ...r }) => r))}

ANÁLISE DE TEMPLATES (cruzamento real disparo→link via deal_id):
${JSON.stringify(templateRanking)}

Retorne EXATAMENTE neste formato JSON (sem limitar o número de itens — traga TODOS os insights relevantes):
{
  "alertas_criticos": [{"closer":"nome","texto":"análise detalhada com números — o que está errado e por quê"}],
  "atencao": [{"closer":"nome","texto":"análise com contexto e números — o que precisa de atenção e qual o risco"}],
  "destaques": [{"closer":"nome","texto":"análise positiva com números — por que está bem e o que sustenta isso"}],
  "resumo_time": "análise completa do time: receita total, comparação entre closers, quem lidera, ritmo de fechamento, projeção coletiva, estado do pipeline de links, atividade de disparos",
  "analise_templates": "análise das taxas de sucesso dos templates (se houver dados): quais performam melhor, quais precisam revisão — com os números reais de taxa",
  "recomendacoes": ["ação 1 específica", "ação 2 específica", "ação 3 específica"]
}

ANALISE TUDO — não deixe nenhum dado sem usar:
- Vendas vs meta de cada closer (pct_meta, receita_mes, projecao, meta_mes)
- Ritmo diário projetado vs dias úteis restantes
- Quem está no caminho, quem está em risco, quem já bateu
- Pipeline de links gerados vs receita fechada (pipeline_pendente) — oportunidades em aberto
- Conversão de leads HubSpot
- Disparos enviados e qual template teve maior taxa de sucesso (deals_com_link / disparos)
- Comparação entre closers do mesmo time
- Projeções realistas de fechamento do mês

Use os números reais em todos os textos. Quanto mais específico e detalhado, melhor.`

  const globalData = parseJSON(await callClaude(prompt))

  if (globalData) {
    await admin.from('commercial_insights').upsert(
      { insight_date: today, scope: 'global', content: JSON.stringify(globalData), model_used: 'claude-sonnet-4-6' },
      { onConflict: 'insight_date,scope' }
    )
  }

  // Insights individuais por closer
  const closerInsights: Record<string, any> = {}
  for (const c of context) {
    const { id, ...cd } = c
    const raw = await callClaude(`Analise os dados de ${c.nome} e retorne SOMENTE JSON válido, sem markdown.

DADOS: ${JSON.stringify(cd)}

Formato EXATO:
{
  "situacao": "análise completa da situação de ${c.nome}: receita fechada, % da meta, projeção de fechamento do mês, ritmo atual vs necessário para bater meta",
  "pipeline": "análise do pipeline: leads HubSpot recebidos, conversão, links gerados com valor pendente",
  "atividade": "análise de disparos e templates: quantos enviou, qual template teve melhor taxa de sucesso com os números reais",
  "destaque": "ponto positivo mais relevante com número que sustente",
  "alerta": "ponto de atenção mais crítico com número, ou null se estiver bem",
  "acao": "2-3 ações específicas e práticas para os próximos dias baseadas nos dados"
}

REGRAS:
- Fale diretamente com ${c.nome} usando segunda pessoa: "${c.nome}, você..."
- Use TODOS os dados disponíveis — não deixe campo sem analisar
- Seja específico com os números
- Se pipeline_pendente for alto, mencione os links que precisam acompanhamento`, 768)

    const data = parseJSON(raw)
    if (data) {
      await admin.from('commercial_insights').upsert(
        { insight_date: today, scope: id, content: JSON.stringify(data), model_used: 'claude-sonnet-4-6' },
        { onConflict: 'insight_date,scope' }
      )
      closerInsights[id] = data
    }
  }

  return NextResponse.json({ ok: true, global: globalData, closers: closerInsights })
}
