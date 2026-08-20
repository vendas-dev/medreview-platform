import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName, matchCloser } from '@/lib/telao/format'
import { Closer } from '@/lib/telao/types'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

const VerticalEnum = z.enum(['medreview','anestreview','oftreview','ortopreview'])
const SellerEnum    = z.enum(['closer','ambassador','self_checkout'])

const SaleSchema = z.object({
  event_type:          z.literal('sale'),
  vertical:             VerticalEnum,
  lead_name:            z.string().min(1),
  product:              z.string().optional().default(''),
  value:                z.number().nonnegative(),
  closer_name:          z.string().nullable().optional(),
  closer_hubspot_id:    z.string().nullable().optional(),
  seller_type:          SellerEnum,
  sold_by_ambassador:   z.boolean().optional().default(false),
  timestamp:            z.string().optional(),
  // ── Recorrência ──────────────────────────────────────────
  // is_recurring=false (ou omitido) → venda avulsa, sempre 'nova'.
  // is_recurring=true + installment_number=1 → primeira parcela, conta como 'nova'.
  // is_recurring=true + installment_number>1 → conta como 'recorrente',
  //   mesmo que seja a primeira parcela que o sistema vê daquela assinatura
  //   (ex.: integração começou a rodar na parcela 6/12 — não dá pra reconstruir
  //   o histórico retroativo, mas o forecast usa installment_number/total_installments
  //   para saber quantas parcelas ainda faltam).
  is_recurring:         z.boolean().optional().default(false),
  subscription_id:      z.string().nullable().optional(),
  installment_number:   z.number().int().positive().optional(),
  total_installments:   z.number().int().positive().optional(),
  // Cupom usado na venda (opcional — só manda se teve cupom). Só conta como
  // desconto "de verdade" pra fins de dinheiro deixado na mesa quando termina
  // em _X% ou _XX.X% (ex: NT12345678901_7.5%). Cupom sem esse sufixo (ex: só
  // "NT12345678901") é tratado como cupom sem desconto atrelado.
  coupon_code:          z.string().nullable().optional(),
  // Identificador estável do HubSpot — opcional, útil se algum dia o evento
  // vier de lá. Não é confiável pra vendas que vêm direto da Hotmart.
  deal_id:              z.string().nullable().optional(),
  // Código de transação da Hotmart (ex: HP12345678) — esse é o identificador
  // que dá pra usar de verdade pra localizar a venda depois, porque existe
  // tanto na venda (nasce com ela) quanto no card do HubSpot integrado.
  transaction_id:       z.string().nullable().optional(),
})

const AmbassadorSchema = z.object({
  event_type:          z.literal('ambassador_certified'),
  vertical:            VerticalEnum,
  ambassador_name:     z.string().min(1),
  college:             z.string().optional().default(''),
  class:               z.string().optional().default(''),
  closer_name:         z.string().nullable().optional(),
  closer_hubspot_id:   z.string().nullable().optional(),
  seller_type:         SellerEnum,
  timestamp:           z.string().optional(),
})

const PayloadSchema = z.discriminatedUnion('event_type', [SaleSchema, AmbassadorSchema])

// Deriva o tipo de venda a partir dos campos de recorrência
function deriveSaleType(data: z.infer<typeof SaleSchema>): 'nova' | 'recorrente' {
  if (!data.is_recurring) return 'nova'
  const n = data.installment_number ?? 1
  return n > 1 ? 'recorrente' : 'nova'
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = PayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400, headers: CORS }
      )
    }

    const data  = parsed.data
    const admin = createAdminClient()

    const { data: closers } = await admin.from('closers').select('*') as { data: Closer[] | null }
    const closerList = closers ?? []

    let matched: Closer | null = null
    let isSelfCO = false
    let finalSellerType = data.seller_type ?? 'closer'

    const rawHubspotId = (data.closer_hubspot_id ?? '').trim()
    const rawName      = (data.closer_name ?? '').trim()

    if (rawHubspotId && rawHubspotId !== 'null') {
      matched = closerList.find(c => c.hubspot_id === rawHubspotId) ?? null
    }
    if (!matched && rawName && rawName !== 'null') {
      matched = matchCloser(rawName, closerList)
    }
    if (!matched && !rawHubspotId && !rawName) {
      isSelfCO = true
      finalSellerType = 'self_checkout'
    }
    if (data.seller_type === 'self_checkout') { isSelfCO = true; matched = null }
    if (data.seller_type === 'ambassador')     { finalSellerType = 'ambassador' }

    const occurredAt = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()

    let insertData: Record<string, unknown> = {
      event_type:          data.event_type,
      vertical:            data.vertical,
      closer_name:         isSelfCO ? null : (matched?.name ?? (rawName || null)),
      closer_hubspot_id:   rawHubspotId || matched?.hubspot_id || null,
      closer_id:           matched?.id ?? null,
      is_self_checkout:    isSelfCO,
      seller_type:         finalSellerType,
      sold_by_ambassador:  ('sold_by_ambassador' in data ? data.sold_by_ambassador : false) || finalSellerType === 'ambassador',
      occurred_at:         occurredAt,
    }

    // Link que gerou essa venda (se achar por cupom) — usado abaixo pra
    // enriquecer a venda e, depois do insert, marcar o link como convertido.
    let matchedLink: { id: string; payment_mode: string | null; installments_no_interest: number | null; deal_id: string | null } | null = null

    if (data.event_type === 'sale') {
      const saleType = deriveSaleType(data)
      insertData = {
        ...insertData,
        lead_name:           data.lead_name,
        product:             data.product,
        value:               data.value,
        is_recurring:        data.is_recurring ?? false,
        subscription_id:     data.subscription_id ?? null,
        installment_number:  data.installment_number ?? (data.is_recurring ? 1 : null),
        total_installments:  data.total_installments ?? null,
        sale_type:           saleType,
        coupon_code:         data.coupon_code || null,
        deal_id:             data.deal_id || null,
        transaction_id:      data.transaction_id || null,
      }

      // Enriquece a venda com a condição de pagamento do link que a gerou —
      // localizado pelo mesmo coupon_code. Cupom de embaixador (ou qualquer
      // cupom que nunca passou pela geração de link) simplesmente não acha
      // nada aqui, e os campos ficam null — comportamento esperado, não erro.
      // Se houver mais de um link com o mesmo cupom (reemissão), usa o mais
      // recente, que é o palpite mais provável de qual gerou essa venda.
      if (data.coupon_code) {
        const { data: linkRow } = await admin
          .from('geracoes_links')
          .select('id, payment_mode, installments_no_interest, deal_id')
          .eq('coupon_code', data.coupon_code)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (linkRow) {
          matchedLink = linkRow as any
          insertData.payment_mode = matchedLink!.payment_mode
          insertData.installments_no_interest = matchedLink!.installments_no_interest
        }
      }

      // Se essa venda pertence a uma assinatura que já tem uma transferência
      // "em pé" (aprovada anteriormente), aplica automaticamente na parcela
      // nova também — é assim que "todas as parcelas futuras" funciona: elas
      // nem existem ainda no momento da transferência, então cada parcela
      // nova precisa checar essa regra sozinha, na hora que é criada.
      if (data.subscription_id) {
        const { data: transfer } = await admin
          .from('subscription_transfers')
          .select('mode, co_closer_id, co_closer_hubspot_id')
          .eq('subscription_id', data.subscription_id)
          .maybeSingle()

        if (transfer) {
          if (transfer.mode === 'correct') {
            // Corrige a atribuição (era self-checkout, na prática é venda do closer)
            insertData.is_self_checkout  = false
            insertData.seller_type       = 'closer'
            insertData.closer_id         = transfer.co_closer_id
            insertData.closer_hubspot_id = transfer.co_closer_hubspot_id
          } else {
            // Mantém a atribuição original (embaixador/closer) e soma o co-closer
            insertData.co_closer_id         = transfer.co_closer_id
            insertData.co_closer_hubspot_id = transfer.co_closer_hubspot_id
          }
          insertData.transferred_at = new Date().toISOString()
        }
      }
    } else {
      insertData = { ...insertData, ambassador_name: data.ambassador_name, college: data.college, class: data.class }
    }

    const { data: inserted, error } = await admin.from('telao_events').insert(insertData).select().single()

    if (error) {
      console.error('[telao/events] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
    }

    // Marca o link como convertido — só depois da venda ter sido gravada com
    // sucesso, pra não marcar conversão de uma venda que na prática falhou.
    if (matchedLink) {
      const { error: linkUpdateError } = await admin.from('geracoes_links').update({
        converted_at: occurredAt,
        converted_transaction_id: (data as any).transaction_id || null,
      }).eq('id', matchedLink.id)
      if (linkUpdateError) console.error('[telao/events] Erro ao marcar link como convertido:', linkUpdateError.message)

      // Os outros links do MESMO negócio que ainda não converteram ficam
      // "superados" por esse — o negócio já foi resolvido, não faz sentido
      // continuar cobrando reemissões antigas do mesmo lead.
      if (matchedLink.deal_id) {
        const { error: supersedeError } = await admin.from('geracoes_links')
          .update({ superseded_by_link_id: matchedLink.id })
          .eq('deal_id', matchedLink.deal_id)
          .neq('id', matchedLink.id)
          .is('converted_at', null)
          .is('superseded_by_link_id', null)
        if (supersedeError) console.error('[telao/events] Erro ao marcar reemissões superadas:', supersedeError.message)
      }
    }

    return NextResponse.json({
      ok:                 true,
      id:                 inserted.id,
      closer_matched:     matched?.name ?? null,
      closer_hubspot_id:  matched?.hubspot_id ?? null,
      is_self_checkout:   isSelfCO,
      seller_type:        finalSellerType,
      sale_type:          data.event_type === 'sale' ? deriveSaleType(data) : null,
      link_matched:       matchedLink ? true : false,
    }, { status: 201, headers: CORS })

  } catch (err: any) {
    console.error('[telao/events] Error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500, headers: CORS })
  }
}
