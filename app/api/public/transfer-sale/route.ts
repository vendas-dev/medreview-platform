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

// Busca o closer pelo hubspot_id NAS DUAS TABELAS — porque telao_events tem
// duas constraints de chave estrangeira diferentes:
//   - closer_id      → exige um ID que exista em "closers"
//   - co_closer_id    → exige um ID que exista em "profiles"
// Mesma pessoa, mesmo hubspot_id, mas UUID interno DIFERENTE em cada tabela.
// Por isso guardamos os dois IDs separados, e cada campo usa o seu.
//
// Comparação com trim() dos dois lados — sem isso, espaço em branco ou
// diferença de tipo no hubspot_id salvo faz a busca falhar silenciosamente.
async function findCloserIdentities(admin: any, identifier: string) {
  const target = String(identifier).trim()

  const [{ data: profileCandidates }, { data: closerCandidates }] = await Promise.all([
    admin.from('profiles').select('id, name, hubspot_id').not('hubspot_id', 'is', null),
    admin.from('closers').select('id, name, hubspot_id').not('hubspot_id', 'is', null),
  ])

  const profile   = (profileCandidates ?? []).find((c: any) => String(c.hubspot_id).trim() === target) ?? null
  const closerRow = (closerCandidates ?? []).find((c: any) => String(c.hubspot_id).trim() === target) ?? null

  if (!profile && !closerRow) return null

  return {
    name:       profile?.name ?? closerRow?.name ?? null,
    hubspotId:  target,
    profileId:  profile?.id ?? null,   // usar em co_closer_id (FK → profiles)
    closerId:   closerRow?.id ?? null, // usar em closer_id (FK → closers)
  }
}

// Transfere/co-atribui uma venda pra outro closer, a partir do transaction_id
// (código de transação da Hotmart, ex: HP12345678) — ou, se algum dia vier
// de um evento com origem no HubSpot, também aceita deal_id.
//
// SEM autenticação, de propósito — mesmo padrão do /api/public/events, pra
// automações externas (n8n) chamarem direto.
//
// co_closer_id (no corpo da requisição): SEMPRE o hubspot_id do proprietário
// — não o UUID interno de nenhuma tabela. A tradução pro UUID certo (de
// "closers" ou "profiles", dependendo do caso) é feita aqui dentro.
//
// Regra de decisão:
//  - Se a venda original era self-checkout (sem closer de verdade por trás)
//    → CORRIGE: vira venda do closer indicado, grava em closer_id (exige
//    existir em "closers"). Não é duplicata, é o mesmo negócio, só com a
//    atribuição certa agora.
//  - Se a venda já tinha um "dono" (embaixador ou outro closer) → SOMA:
//    grava co_closer_id (exige existir em "profiles"), mantendo a
//    atribuição original intacta. Uma linha só no banco — o total da
//    empresa nunca dobra, mas cada estatística "por closer" passa a contar
//    pra os dois.
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

  const closer = await findCloserIdentities(admin, coCloserId)
  if (!closer) {
    return NextResponse.json({ error: `Closer não encontrado com o hubspot_id "${coCloserId}" (nem em profiles, nem em closers).` }, { status: 404, headers: CORS })
  }

  const isCorrection = (sale as any).is_self_checkout === true
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = { transferred_at: now, transfer_reason: reason }
  if (isCorrection) {
    if (!closer.closerId) {
      return NextResponse.json({ error: `Closer com hubspot_id "${coCloserId}" não está cadastrado na tabela "closers" — necessário pra corrigir uma venda self-checkout (closer_id exige existir ali).` }, { status: 404, headers: CORS })
    }
    updates.is_self_checkout  = false
    updates.seller_type       = 'closer'
    updates.closer_id         = closer.closerId
    updates.closer_hubspot_id = closer.hubspotId
  } else {
    if (!closer.profileId) {
      return NextResponse.json({ error: `Closer com hubspot_id "${coCloserId}" não está cadastrado na tabela "profiles" — necessário pra co-atribuir a venda (co_closer_id exige existir ali).` }, { status: 404, headers: CORS })
    }
    updates.co_closer_id         = closer.profileId
    updates.co_closer_hubspot_id = closer.hubspotId
  }

  const { error: updateError } = await admin.from('telao_events').update(updates).eq('id', (sale as any).id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500, headers: CORS })

  // Se for recorrência, deixa a regra "em pé" pras parcelas futuras (que
  // ainda não existem) já nascerem com essa atribuição, sem precisar
  // transferir manualmente parcela por parcela todo mês.
  // subscription_transfers.co_closer_id também exige "profiles" (mesma FK
  // de telao_events.co_closer_id) — só cria a regra se esse ID existir.
  let subscriptionRuleCreated = false
  if ((sale as any).subscription_id && closer.profileId) {
    const { error: subError } = await admin.from('subscription_transfers').upsert({
      subscription_id:      (sale as any).subscription_id,
      mode:                 isCorrection ? 'correct' : 'co_closer',
      co_closer_id:         closer.profileId,
      co_closer_hubspot_id: closer.hubspotId,
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
