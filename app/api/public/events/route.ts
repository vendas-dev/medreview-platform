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
      }
    } else {
      insertData = { ...insertData, ambassador_name: data.ambassador_name, college: data.college, class: data.class }
    }

    const { data: inserted, error } = await admin.from('telao_events').insert(insertData).select().single()

    if (error) {
      console.error('[telao/events] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
    }

    return NextResponse.json({
      ok:                 true,
      id:                 inserted.id,
      closer_matched:     matched?.name ?? null,
      closer_hubspot_id:  matched?.hubspot_id ?? null,
      is_self_checkout:   isSelfCO,
      seller_type:        finalSellerType,
      sale_type:          data.event_type === 'sale' ? deriveSaleType(data) : null,
    }, { status: 201, headers: CORS })

  } catch (err: any) {
    console.error('[telao/events] Error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500, headers: CORS })
  }
}
