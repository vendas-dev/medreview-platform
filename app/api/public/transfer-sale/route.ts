import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Acha o closer pelo identificador enviado — que hoje é sempre o
// hubspot_id (ID do proprietário no HubSpot). Se por algum motivo vier um
// UUID interno da plataforma, também funciona (checa qual formato bate
// primeiro), mas o caso normal de uso é sempre hubspot_id.
//
// A comparação usa trim() nos dois lados (igual ao resto do sistema faz em
// matchesCloser) — sem isso, um espaço em branco escondido ou o hubspot_id
// salvo como tipo numérico faz a busca direta (.eq) falhar silenciosamente,
// mesmo com o closer cadastrado certinho.
async function findCloser(admin: any, identifier: string) {
  if (UUID_RE.test(identifier)) {
    const { data } = await admin.from('profiles').select('id, name, hubspot_id').eq('id', identifier).maybeSingle()
    if (data) return data
  }
  const target = String(identifier).trim()
  const { data: candidates } = await admin.from('profiles').select('id, name, hubspot_id').not('hubspot_id', 'is', null)
  return (candidates ?? []).find((c: any) => String(c.hubspot_id).trim() === target) ?? null
}

// Transfere/co-atribui uma venda pra outro closer, a partir do transaction_id
// (código de transação da Hotmart, ex: HP12345678) — ou, se algum dia vier
// de um evento com origem no HubSpot, também aceita deal_id.
//
// SEM autenticação, de propósito — mesmo padrão do /api/public/events, pra
// automações externas (n8n) chamarem direto.
//
// co_closer_id: SEMPRE o ID do proprietário no HubSpot (não o UUID interno
// da plataforma) — é assim que o n8n identifica o closer em todos os casos.
//
// Regra de decisão:
//  - Se a venda original era self-checkout (sem closer de verdade por trás)
//    → CORRIGE: vira venda do closer indicado. Não é duplicata, é o mesmo
//    negócio, só com a atribuição certa agora.
//  - Se a venda já tinha um "dono" (embaixador ou outro closer) → SOMA:
//    grava co_closer_id, mantendo a atribuição original intacta. Uma linha
//    só no banco — o total da empresa nunca dobra, mas cada estatística
//    "por closer" passa a contar pra os dois.
//
// Se a venda for recorrente (subscription_id preenchido), a decisão fica
// "em pé" numa tabela separada (subscription_transfers) — assim, quando
// as parcelas futuras dessa assinatura chegarem (ainda não existem no
// momento da transferência), elas já nascem com a atribuição correta.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const transactionId = body?.transaction_id as string | undefined
  const dealId         = body?.deal_id as string | undefined
  const coCloserId     = body?.co_closer_id as string | undefined
  const reason         = (body?.reason as string | undefined) ?? null

  if ((!transactionId && !dealId) || !coCloserId) {
    return NextResponse.json({ error: 'Informe transaction_id (ou deal_id) e co_closer_id' }, { status: 400, headers: CORS })
  }

  const admin = createAdminClient()

  let saleQuery = admin.from('telao_events').select('*').eq('event_type', 'sale')
  saleQuery = transactionId ? saleQuery.eq('transaction_id', transactionId) : saleQuery.eq('deal_id', dealId!)
  const { data: sale, error: findError } = await saleQuery.maybeSingle()

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500, headers: CORS })
  if (!sale) {
    const idLabel = transactionId ? `transaction_id "${transactionId}"` : `deal_id "${dealId}"`
    return NextResponse.json({ error: `Nenhuma venda encontrada com ${idLabel}. Confirme se esse evento já chegou na plataforma com esse identificador preenchido.` }, { status: 404, headers: CORS })
  }

  const closer = await findCloser(admin, coCloserId)
  if (!closer) {
    return NextResponse.json({ error: `Closer não encontrado com o hubspot_id "${coCloserId}". Confirme se esse proprietário está cadastrado na plataforma com esse hubspot_id.` }, { status: 404, headers: CORS })
  }

  const isCorrection = (sale as any).is_self_checkout === true
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = { transferred_at: now, transfer_reason: reason }
  if (isCorrection) {
    updates.is_self_checkout  = false
    updates.seller_type       = 'closer'
    updates.closer_id         = closer.id
    updates.closer_hubspot_id = closer.hubspot_id
  } else {
    updates.co_closer_id         = closer.id
    updates.co_closer_hubspot_id = closer.hubspot_id
  }

  const { error: updateError } = await admin.from('telao_events').update(updates).eq('id', (sale as any).id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500, headers: CORS })

  // Se for recorrência, deixa a regra "em pé" pras parcelas futuras (que
  // ainda não existem) já nascerem com essa atribuição, sem precisar
  // transferir manualmente parcela por parcela todo mês.
  let subscriptionRuleCreated = false
  if ((sale as any).subscription_id) {
    const { error: subError } = await admin.from('subscription_transfers').upsert({
      subscription_id:      (sale as any).subscription_id,
      mode:                 isCorrection ? 'correct' : 'co_closer',
      co_closer_id:         closer.id,
      co_closer_hubspot_id: closer.hubspot_id,
      reason,
      created_by:           null,
    }, { onConflict: 'subscription_id' })
    if (!subError) subscriptionRuleCreated = true
  }

  return NextResponse.json({
    success: true,
    mode: isCorrection ? 'correct' : 'co_closer',
    sale_id: (sale as any).id,
    co_closer: closer.name,
    subscription_rule_created: subscriptionRuleCreated,
  }, { headers: CORS })
}
