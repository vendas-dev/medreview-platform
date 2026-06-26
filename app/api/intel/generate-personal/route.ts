import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const VERT_LABEL: Record<string, string> = {
  medreview:'Med-Review R1', anestreview:'Anest-Review',
  oftreview:'Oft-Review',    ortoprev:'Ortop-Review',
}
const vLabel = (k: string) => VERT_LABEL[k] ?? k

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('name, team, hubspot_id').eq('id', user.id).single()

  const today    = new Date().toISOString().slice(0, 10)
  const monthKey = today.slice(0, 7)
  const [y, m]   = monthKey.split('-').map(Number)
  const mStart   = new Date(y, m - 1, 1).toISOString()
  const mEnd     = new Date(y, m, 0, 23, 59, 59).toISOString()
  const hubId    = (profile as any)?.hubspot_id ?? null
  const admin    = createAdminClient()

  // Buscar dados do próprio closer
  const [
    { data: salesById },
    { data: salesByHub },
    { data: leads },
    { data: goal },
  ] = await Promise.all([
    admin.from('telao_events').select('id, value, vertical').eq('event_type','sale').eq('closer_id', user.id).gte('occurred_at', mStart).lte('occurred_at', mEnd),
    hubId ? admin.from('telao_events').select('id, value, vertical').eq('event_type','sale').eq('closer_hubspot_id', hubId).gte('occurred_at', mStart).lte('occurred_at', mEnd) : Promise.resolve({ data: [] }),
    hubId ? admin.from('hubspot_leads').select('deal_stage').eq('owner_id', hubId).gte('created_at_hs', mStart).lte('created_at_hs', mEnd) : Promise.resolve({ data: [] }),
    admin.from('closer_goals').select('goal_sales, goal_ambassador, goals_by_vertical').eq('user_id', user.id).eq('month', monthKey).maybeSingle(),
  ])

  // Deduplicar
  const salesMap = new Map()
  ;[...(salesById ?? []), ...(salesByHub ?? [])].forEach((e: any) => salesMap.set(e.id, e))
  const sales = Array.from(salesMap.values())

  const revMonth   = sales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const goalSales  = Number((goal as any)?.goal_sales ?? 0)
  const pctMeta    = goalSales > 0 ? ((revMonth / goalSales) * 100).toFixed(1) : null
  const leadsTotal = (leads ?? []).length
  const convRate   = leadsTotal > 0 ? ((sales.length / leadsTotal) * 100).toFixed(1) : null

  const byVert: Record<string, number> = {}
  sales.forEach((e: any) => { if (e.vertical) { const k = vLabel(e.vertical); byVert[k] = (byVert[k] ?? 0) + (Number(e.value) || 0) } })

  const now       = new Date()
  const bizTotal  = (() => { let c=0; const d=new Date(y,m-1,1); const e=new Date(y,m,0); while(d<=e){if(d.getDay()!==0&&d.getDay()!==6)c++;d.setDate(d.getDate()+1)} return c })()
  const bizPassed = (() => { let c=0; const d=new Date(y,m-1,1); while(d<=now&&d.getMonth()===m-1){if(d.getDay()!==0&&d.getDay()!==6)c++;d.setDate(d.getDate()+1)} return c })()
  const projected = bizPassed > 0 ? ((revMonth / bizPassed) * bizTotal).toFixed(0) : '0'

  const prompt = `Você é um coach comercial. Analise os dados abaixo de ${(profile as any)?.name} e retorne SOMENTE JSON válido, sem markdown.

Data: ${today}
DADOS: ${JSON.stringify({
  nome: (profile as any)?.name,
  time: (profile as any)?.team,
  receita_mes: revMonth,
  meta_mes: goalSales,
  pct_meta: pctMeta,
  vendas: sales.length,
  leads_mes: leadsTotal,
  conversao_pct: convRate,
  projecao_fechamento: Number(projected),
  por_vertical: byVert,
  dias_uteis_passados: bizPassed,
  dias_uteis_total: bizTotal,
})}

Retorne EXATAMENTE neste formato JSON (sem \`\`\`, sem markdown):
{"situacao":"1-2 frases diretas sobre o momento atual com os números reais","destaque":"o principal ponto positivo ou oportunidade real dos dados","alerta":"ponto de atenção concreto, ou null se estiver no caminho certo","acao":"uma ação específica e prática para os próximos dias, baseada nos dados"}

Sem elogios genéricos. Fale em primeira pessoa com o consultor. Use os números reais.`

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:512, messages:[{ role:'user', content:prompt }] }),
    })
    const data = await res.json()
    let text   = (data.content?.[0]?.text ?? '').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()

    let parsed: any
    try { parsed = JSON.parse(text) }
    catch { return NextResponse.json({ error:'Formato inválido da IA' }, { status:500 }) }

    await admin.from('commercial_insights').upsert(
      { insight_date:today, scope:user.id, content:JSON.stringify(parsed), model_used:'claude-sonnet-4-6' },
      { onConflict:'insight_date,scope' }
    )

    return NextResponse.json({ ok:true, content:parsed })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Erro ao gerar' }, { status:500 })
  }
}
