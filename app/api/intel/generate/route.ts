export const maxDuration = 60

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

// Para vendas: somente UUID/hubspot_id — sem nome (evita atribuição cruzada)
function matchSales(all: any[], c: any) {
  return (all ?? []).filter((e: any) =>
    (e.closer_id && e.closer_id === c.id) ||
    (c.hubspot_id && e.closer_hubspot_id && e.closer_hubspot_id === c.hubspot_id)
  )
}

// Para disparos/links (sem UUID): nome completo exato
function matchByFullName(name: string, profileName: string): boolean {
  if (!name || !profileName) return false
  return name.toLowerCase().trim() === profileName.toLowerCase().trim()
}

function analyzeTemplates(disparos: any[], links: any[]) {
  const linkDeals = new Set((links ?? []).map((l: any) => String(l.deal_id ?? '')).filter(Boolean))
  const tplMap: Record<string, { total: number; comLink: number }> = {}
  for (const d of (disparos ?? [])) {
    const tpl = d.template
    if (!tpl) continue
    if (!tplMap[tpl]) tplMap[tpl] = { total: 0, comLink: 0 }
    tplMap[tpl].total++
    if (d.id_negocio && linkDeals.has(String(d.id_negocio))) tplMap[tpl].comLink++
  }
  return Object.entries(tplMap)
    .map(([template, v]) => ({
      template,
      disparos: v.total,
      deals_com_link: v.comLink,
      taxa_sucesso: v.total > 0 ? Number(((v.comLink / v.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.taxa_sucesso - a.taxa_sucesso)
}

function parseJSON(raw: string | null): any | null {
  if (!raw) return null
  try {
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    // Tentar parse direto primeiro
    try { return JSON.parse(clean) } catch {}
    // Extrair o maior bloco JSON da resposta
    const matches = [...clean.matchAll(/\{[\s\S]*?\}/g)]
    for (const m of matches.reverse()) { // maior primeiro
      try { return JSON.parse(m[0]) } catch {}
    }
    // Fallback: extrair entre primeira { e última }
    const start = clean.indexOf('{'), end = clean.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try { return JSON.parse(clean.slice(start, end + 1)) } catch {}
    }
    return null
  } catch { return null }
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
    admin.from('profiles').select('id,name,team,hubspot_id').neq('role','superadmin').order('name'),
    admin.from('telao_events').select('closer_id,closer_hubspot_id,value,vertical').eq('event_type','sale').gte('occurred_at',mStart).lte('occurred_at',mEnd),
    admin.from('hubspot_leads').select('owner_id,deal_stage').gte('created_at_hs',mStart).lte('created_at_hs',mEnd),
    admin.from('closer_goals').select('*').eq('month',monthKey),
    admin.from('disparos').select('proprietario,template,id_negocio').gte('data_disparo',mStart).lte('data_disparo',mEnd),
    admin.from('geracoes_links').select('owner_name,deal_value,deal_id').gte('generated_at',mStart).lte('generated_at',mEnd),
  ])

  const goalsMap     = Object.fromEntries((goals ?? []).map((g: any) => [g.user_id, g]))
  const templateRank = analyzeTemplates(allDisparos ?? [], allLinks ?? [])

  const context = (closers ?? []).map((c: any) => {
    const sales    = matchSales(allSales ?? [], c)
    const leads    = (allLeads ?? []).filter((l: any) => c.hubspot_id && l.owner_id === c.hubspot_id)
    const disparos = (allDisparos ?? []).filter((d: any) => matchByFullName(d.proprietario ?? '', c.name))
    const links    = (allLinks ?? []).filter((l: any) => matchByFullName(l.owner_name ?? '', c.name))
    const goal     = goalsMap[c.id]
    const rev      = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
    const goalV    = Number(goal?.goal_sales ?? 0)
    const valLinks = links.reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)
    const tpls     = analyzeTemplates(disparos, links)

    return {
      nome: c.name, time: c.team,
      receita_mes: rev, meta_mes: goalV,
      pct_meta: goalV > 0 ? Number(((rev / goalV) * 100).toFixed(1)) : null,
      vendas: sales.length,
      leads_mes: leads.length,
      conversao_leads: leads.length > 0 ? Number(((sales.length / leads.length) * 100).toFixed(1)) : null,
      disparos_mes: disparos.length,
      links_gerados: links.length,
      valor_links: valLinks,
      pipeline_pendente: Math.max(valLinks - rev, 0),
      melhor_template: tpls[0] ?? null,
    }
  })

  const totalValorLinks = (allLinks ?? []).reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)

  // Uma única chamada Claude para o insight global do time
  const userMsg = [
    'Você é um analista comercial sênior. Analise os dados abaixo e retorne APENAS um JSON puro, sem markdown.',
    '',
    'Data: ' + today,
    'CLOSERS: ' + JSON.stringify(context),
    'TEMPLATES DO TIME: ' + JSON.stringify(templateRank.slice(0, 5)),
    'TOTAIS: disparos=' + (allDisparos ?? []).length + ', links=' + (allLinks ?? []).length + ', valor_links=R$' + totalValorLinks.toFixed(0),
    '',
    'CAMPOS DO JSON:',
    '',
    'alertas_criticos: array {closer, texto}. Use **negrito** em nomes e dados. Ex: "**Ana Clara** fez 82 disparos sem nenhuma venda"',
    'atencao: array {closer, texto}. Mesmo formato com **negrito** nos pontos-chave.',
    'destaques: array {closer, texto}. Destaque numeros de performance com **negrito**.',
    '',
    'resumo_time: string com topicos em bullets. Um topico por linha, comecando com "- ". Use **negrito** em valores, nomes e percentuais. Ex: "- **Receita total: R$ 132k** - OAO domina com **R$ 122k** (92%)\\n- Pipeline pendente: **R$ 74k** em links nao convertidos"',
    '',
    'analise_templates: string com cada template em uma linha "- ", com taxa de sucesso em **negrito**. Ex: "- **Anest-abordagem**: **50%** taxa (10->5 links)\\n- **Multi-retorno**: **0,8%** - 118 disparos para 1 link, revisar"',
    '',
    'recomendacoes: array de strings. Cada item completo com contexto, dado justificador e acao especifica. Use **negrito** nos nomes e numeros-chave. Inclua TODAS as recomendacoes necessarias.',
    '',
    'Retorne SOMENTE o JSON.',
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
        max_tokens: 4096,
        system: 'Retorne APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois.',
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    const aiData = await res.json()
    const global = parseJSON(aiData.content?.[0]?.text ?? '')

    if (!global) {
      return NextResponse.json({ error: 'IA retornou formato inválido' }, { status: 500 })
    }

    await admin.from('commercial_insights').upsert(
      { insight_date: today, scope: 'global', content: JSON.stringify(global), model_used: 'claude-sonnet-4-6' },
      { onConflict: 'insight_date,scope' }
    )

    return NextResponse.json({ ok: true, global })

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: 500 })
  }
}
