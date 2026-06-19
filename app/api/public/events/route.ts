import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName, matchCloser } from '@/lib/telao/format'
import { Closer } from '@/lib/telao/types'

// ── CORS ──────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ── Schemas Zod ───────────────────────────────────────────────
const VerticalEnum = z.enum(['medreview','anestreview','oftreview','ortopreview'])

const SaleSchema = z.object({
  event_type:   z.literal('sale'),
  vertical:     VerticalEnum,
  lead_name:    z.string().min(1),
  product:      z.string().optional().default(''),
  value:        z.number().nonnegative(),
  closer_name:  z.string().nullable().optional(),
  timestamp:    z.string().optional(),
})

const AmbassadorSchema = z.object({
  event_type:      z.literal('ambassador_certified'),
  vertical:        VerticalEnum,
  ambassador_name: z.string().min(1),
  college:         z.string().optional().default(''),
  class:           z.string().optional().default(''),
  closer_name:     z.string().nullable().optional(),
  timestamp:       z.string().optional(),
})

const PayloadSchema = z.discriminatedUnion('event_type', [SaleSchema, AmbassadorSchema])

// ── Handler ───────────────────────────────────────────────────
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

    // ── Buscar closers para matching ──────────────────────────
    const { data: closers } = await admin.from('closers').select('*') as { data: Closer[] | null }
    const closerList = closers ?? []

    // Normalize closer name
    const rawCloser  = (data.closer_name ?? '').trim()
    const isSelfCO   = !rawCloser || rawCloser.toLowerCase() === 'null'
    const matched    = isSelfCO ? null : matchCloser(rawCloser, closerList)

    // Determinar timestamp
    const occurredAt = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()

    // ── Inserir evento ────────────────────────────────────────
    let insertData: Record<string, unknown> = {
      event_type:       data.event_type,
      vertical:         data.vertical,
      closer_name:      isSelfCO ? null : rawCloser,
      closer_id:        matched?.id ?? null,
      is_self_checkout: isSelfCO,
      occurred_at:      occurredAt,
    }

    if (data.event_type === 'sale') {
      insertData = {
        ...insertData,
        lead_name: data.lead_name,
        product:   data.product,
        value:     data.value,
      }
    } else {
      insertData = {
        ...insertData,
        ambassador_name: data.ambassador_name,
        college:         data.college,
        class:           data.class,
      }
    }

    const { data: inserted, error } = await admin
      .from('telao_events')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[telao/events] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
    }

    return NextResponse.json(
      { ok: true, id: inserted.id, closer_matched: matched?.name ?? null, is_self_checkout: isSelfCO },
      { status: 201, headers: CORS }
    )
  } catch (err: any) {
    console.error('[telao/events] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500, headers: CORS })
  }
}
