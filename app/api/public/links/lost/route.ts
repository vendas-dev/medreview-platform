import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseLostBody, markDealsLost } from '@/lib/links/lost'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-webhook-secret',
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }) }

// Aviso do HubSpot: "o negócio X foi pra Perdido". Mesma autenticação da rota de geração de links (x-webhook-secret).
// Corpo (um objeto ou uma lista):  { "deal_id": "123456789" }   — opcionais: lost_at, motivo/reason, etapa/stage
// Para REABRIR (voltou do Perdido):  { "deal_id": "123456789", "lost": false }  ou  "action": "reopen"  ou a URL com  ?action=reopen
// Só afeta links NÃO PAGOS do negócio. Pode chegar repetido (idempotente) e fora de ordem.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET
    if (secret && req.headers.get('x-webhook-secret') !== secret)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400, headers: CORS }) }
    const parsed = parseLostBody(body)
    // A ação padrão "Send a webhook" do HubSpot não deixa pôr um campo fixo no corpo: pra avisar que o negócio SAIU do Perdido,
    // use a mesma URL com ?action=reopen  (equivale a "lost": false).
    const forceReopen = (() => { try { return new URL(req.url).searchParams.get('action') === 'reopen' } catch { return false } })()
    const items = forceReopen ? parsed.items.map(i => ({ ...i, reopen: true })) : parsed.items
    const rejected = parsed.rejected
    if (items.length === 0) return NextResponse.json({ error: 'nenhum deal_id válido', rejected: rejected.slice(0, 5) }, { status: 400, headers: CORS })
    if (items.length > 500) return NextResponse.json({ error: 'no máximo 500 negócios por chamada' }, { status: 413, headers: CORS })

    const { results, logError } = await markDealsLost(createAdminClient(), items)
    const by: Record<string, number> = {}
    for (const r of results) by[r.status] = (by[r.status] ?? 0) + 1
    return NextResponse.json({
      ok: true, received: items.length, links_updated: results.reduce((a, r) => a + r.links, 0), by_status: by,
      rejected: rejected.length, rejected_sample: rejected.slice(0, 5), log_error: logError,
    }, { status: 200, headers: CORS })
  } catch (err: any) {
    console.error('[links/lost]', err?.message ?? err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500, headers: CORS })
  }
}
