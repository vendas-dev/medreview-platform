import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Transfere/co-atribui uma venda pra outro closer, a partir do transaction_id
// (código de transação da Hotmart, ex: HP12345678) — ou, se algum dia vier
// de um evento com origem no HubSpot, também aceita deal_id.
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const transactionId = body?.transaction_id as string | undefined
  const dealId         = body?.deal_id as string | undefined
  const coCloserId     = body?.co_closer_id as string | undefined
  const reason         = (body?.reason as string | undefined) ?? null

  if ((!transactionId && !dealId) || !coCloserId) {
    return NextResponse.json({ error: 'Informe transaction_id (ou deal_id) e co_closer_id' }, { status: 400 })
  }

  const admin = createAdminClient()

  let saleQuery = admin.from('telao_events').select('*').eq('event_type', 'sale')
  saleQuery = transactionId ? saleQuery.eq('transaction_id', transactionId) : saleQuery.eq('deal_id', dealId!)
  const { data: sale, error: findError } = await saleQuery.maybeSingle()

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!sale) {
    const idLabel = transactionId ? `transaction_id "${transactionId}"` : `deal_id "${dealId}"`
    return NextResponse.json({ error: `Nenhuma venda encontrada com ${idLabel}. Confirme se esse evento já chegou na plataforma com esse identificador preenchido.` }, { status: 404 })
  }

  const { data: closer, error: closerError } = await admin
    .from('profiles').select('id, name, hubspot_id').eq('id', coCloserId).single()

  if (closerError || !closer) return NextResponse.json({ error: 'Closer não encontrado' }, { status: 404 })

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
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

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
      created_by:           user.id,
    }, { onConflict: 'subscription_id' })
    if (!subError) subscriptionRuleCreated = true
  }

  return NextResponse.json({
    success: true,
    mode: isCorrection ? 'correct' : 'co_closer',
    sale_id: (sale as any).id,
    co_closer: closer.name,
    subscription_rule_created: subscriptionRuleCreated,
  })
}
