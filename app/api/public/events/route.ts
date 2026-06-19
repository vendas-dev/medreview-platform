import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName, matchCloser } from '@/lib/telao/format'
import { Closer } from '@/lib/telao/types'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

const VerticalEnum  = z.enum(['medreview','anestreview','oftreview','ortopreview'])
const SellerEnum    = z.enum(['closer','ambassador','self_checkout']).optional()

const SaleSchema = z.object({
  event_type:          z.literal('sale'),
  vertical:            VerticalEnum,
  lead_name:           z.string().min(1),
  product:             z.string().optional().default(''),
  value:               z.number().nonnegative(),
  // Identificação do closer (qualquer um dos campos abaixo)
  closer_name:         z.string().nullable().optional(),
  closer_hubspot_id:   z.string().nullable().optional(),  // ← ID HubSpot (prioridade máxima)
  // Tipo de vendedor
  seller_type:         SellerEnum,
  sold_by_ambassador:  z.boolean().optional().default(false),
  timestamp:           z.string().optional(),
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

    // Buscar closers para matching
    const { data: closers } = await admin.from('closers').select('*') as { data: Closer[] | null }
    const closerList = closers ?? []

    // ── Matching de closer ─────────────────────────────────
    // 1. Por hubspot_id (prioridade máxima — match exato)
    // 2. Por closer_name (exato → alias → primeiro nome)
    // 3. Vazio/null → Self Checkout

    let matched: Closer | null = null
    let isSelfCO = false
    let finalSellerType = data.seller_type ?? 'closer'

    const rawHubspotId = (data.closer_hubspot_id ?? '').trim()
    const rawName      = (data.closer_name ?? '').trim()

    if (rawHubspotId && rawHubspotId !== 'null') {
      // Match por HubSpot ID
      matched = closerList.find(c => c.hubspot_id === rawHubspotId) ?? null
    }

    if (!matched && rawName && rawName !== 'null') {
      // Match por nome
      matched = matchCloser(rawName, closerList)
    }

    if (!matched && !rawHubspotId && !rawName) {
      isSelfCO = true
      finalSellerType = 'self_checkout'
    }

    // Se seller_type foi explicitamente enviado, respeitar
    if (data.seller_type === 'self_checkout') { isSelfCO = true; matched = null }
    if (data.seller_type === 'ambassador')     { finalSellerType = 'ambassador' }

    const occurredAt = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()

    let insertData: Record<string, unknown> = {
      event_type:          data.event_type,
      vertical:            data.vertical,
      closer_name:         isSelfCO ? null : (matched?.name ?? rawName || null),
      closer_id:           matched?.id ?? null,
      is_self_checkout:    isSelfCO,
      seller_type:         finalSellerType,
      sold_by_ambassador:  ('sold_by_ambassador' in data ? data.sold_by_ambassador : false) || finalSellerType === 'ambassador',
      occurred_at:         occurredAt,
    }

    if (data.event_type === 'sale') {
      insertData = { ...insertData, lead_name: data.lead_name, product: data.product, value: data.value }
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
    }, { status: 201, headers: CORS })

  } catch (err: any) {
    console.error('[telao/events] Error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500, headers: CORS })
  }
}
