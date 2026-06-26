import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const VERT_LABEL: Record<string,string> = {
  medreview:'Med-Review R1', anestreview:'Anest-Review',
  oftreview:'Oft-Review', ortoprev:'Ortop-Review',
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('name,team,hubspot_id').eq('id', user.id).single()

  const admin     = createAdminClient()
  const today     = new Date().toISOString().slice(0, 10)
  const monthKey  = today.slice(0, 7)
  const [y, m]    = monthKey.split('-').map(Number)
  const mStart    = new Date(y, m - 1, 1).toISOString()
  const mEnd      = new Date(y, m, 0, 23, 59, 59).toISOString()
  const hubId     = (profile as any)?.hubspot_id ?? null
  const uName     = (profile as any)?.name ?? ''
  const firstName = uName.split(' ')[0]

  const [
    { data: salesById }, { data: salesByHub },
    { data: leads }, { data: goal },
    { data: disparos }, { data: links },
  ] = await Promise.all([
    admin.from('telao_events').select('id,value,vertical').eq('event_type','sale').eq('closer_id',user.id).gte('occurred_at',mStart).lte('occurred_at',mEnd),
    hubId ? admin.from('telao_events').select('id,value,vertical').eq('event_type','sale').eq('closer_hubspot_id',hubId).gte('occurred_at',mStart).lte('occurred_at',mEnd) : Promise.resolve({ data: [] }),
    hubId ? admin.from('hubspot_leads').select('deal_stage').eq('owner_id',hubId).gte('created_at_hs',mStart).lte('created_at_hs',mEnd) : Promise.resolve({ data: [] }),
    admin.from('closer_goals').select('goal_sales').eq('user_id',user.id).eq('month',monthKey).maybeSingle(),
    admin.from('disparos').select('template,id_negocio').ilike('proprietario', '%' + firstName + '%').gte('data_disparo',mStart).lte('data_disparo',mEnd),
    admin.from('geracoes_links').select('deal_value,deal_id').ilike('owner_name', '%' + firstName + '%').gte('generated_at',mStart).lte('generated_at',mEnd),
  ])

  const salesMap = new Map()
  ;[...(salesById ?? []), ...(salesByHub ?? [])].forEach((e: any) => salesMap.set(e.id, e))
  const sales = Array.from(salesMap.values())

  const rev       = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const goalSales = Number((goal as any)?.goal_sales ?? 0)
  const valLinks  = (links ?? []).reduce((s: number, l: any) => s + (Number(l.deal_value) || 0), 0)
  const tplRank   = analyzeTemplates(disparos ?? [], links ?? [])

  const now   = new Date()
  const bizT  = (() => { let c=0; const d=new Date(y,m-1,1),e=new Date(y,m,0); while(d<=e){if(d.getDay()&&d.getDay()<6)c++;d.setDate(d.getDate()+1)} return c })()
  const bizP  = (() => { let c=0; const d=new Date(y,m-1,1); while(d<=now&&d.getMonth()===m-1){if(d.getDay()&&d.getDay()<6)c++;d.setDate(d.getDate()+1)} return c })()
  const bizL  = Math.max(bizT - bizP, 0)
  const proj  = bizP > 0 ? Math.round((rev / bizP) * bizT) : 0

  const ctx = {
    nome: uName,
    time: (profile as any)?.team,
    receita_mes: rev,
    meta_mes: goalSales,
    pct_meta: goalSales > 0 ? Number(((rev / goalSales) * 100).toFixed(1)) : null,
    vendas: sales.length,
    projecao_fechamento: proj,
    valor_faltante_meta: goalSales > 0 ? Math.max(goalSales - rev, 0) : null,
    dias_uteis_restantes: bizL,
    meta_diaria_necessaria: bizL > 0 && goalSales > rev ? Math.round((goalSales - rev) / bizL) : null,
    leads_mes: (leads ?? []).length,
    conversao_leads: (leads ?? []).length > 0 ? Number(((sales.length / (leads ?? []).length) * 100).toFixed(1)) : null,
    disparos_mes: (disparos ?? []).length,
    links_gerados: (links ?? []).length,
    valor_links: valLinks,
    pipeline_pendente: Math.max(valLinks - rev, 0),
    templates: tplRank.slice(0, 5),
  }

  // Prompt limpo sem JSON template — descreve os campos em texto
  const systemMsg = 'Você é um analista comercial. Retorne APENAS um objeto JSON puro, sem markdown, sem texto adicional.'
  const userMsg = [
    'Analise os dados do consultor ' + uName + ' e retorne um JSON com os campos abaixo.',
    '',
    'DADOS: ' + JSON.stringify(ctx),
    '',
    'Campos obrigatórios do JSON:',
    'situacao (string): receita fechada, % da meta, projeção de fechamento, ritmo diário necessário',
    'pipeline (string): leads recebidos, conversão, links gerados, pipeline pendente',
    'atividade (string): disparos enviados, template com maior taxa de sucesso',
    'destaque (string): ponto positivo com número real',
    'alerta (string ou null): ponto crítico com número, ou null',
    'acoes (array de strings): 3 ações práticas baseadas nos dados',
    '',
    'Fale com ' + uName + ' em segunda pessoa. Exemplo: "' + uName + ', você fechou R$ X..."',
    'Nunca use primeira pessoa. Use os números reais. Seja detalhado.',
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
        max_tokens: 1024,
        system: systemMsg,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    const aiData = await res.json()
    let raw = aiData.content?.[0]?.text ?? ''

    // Limpar markdown e extrair JSON
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) raw = match[0]

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Formato inválido', raw: raw.slice(0, 300) }, { status: 500 })
    }

    await admin.from('commercial_insights').upsert(
      { insight_date: today, scope: user.id, content: JSON.stringify(parsed), model_used: 'claude-sonnet-4-6' },
      { onConflict: 'insight_date,scope' }
    )

    return NextResponse.json({ ok: true, content: parsed })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Erro ao gerar' }, { status: 500 })
  }
}
