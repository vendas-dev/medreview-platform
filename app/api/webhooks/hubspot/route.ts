import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Proteção por token
  const token = req.headers.get('x-webhook-token')
  if (process.env.WEBHOOK_SECRET && token !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event_type, deal_id, deal_name, owner_id, deal_stage, pipeline, created_at_hs, vertical } = body

  // ── Validações básicas ─────────────────────────────────────
  if (!event_type) {
    return NextResponse.json(
      { error: 'Campo "event_type" obrigatório. Use "deal_created" ou "owner_updated".' },
      { status: 400 }
    )
  }

  if (!['deal_created', 'owner_updated'].includes(event_type)) {
    return NextResponse.json(
      { error: `event_type inválido: "${event_type}". Use "deal_created" ou "owner_updated".` },
      { status: 400 }
    )
  }

  if (!deal_id) {
    return NextResponse.json({ error: 'Campo "deal_id" obrigatório.' }, { status: 400 })
  }

  if (!owner_id) {
    return NextResponse.json(
      { skipped: true, reason: 'sem owner_id — deal ignorado' },
      { status: 200 }
    )
  }

  const admin = createAdminClient()

  // ── Verificar se o deal já existe ─────────────────────────
  const { data: existing } = await admin
    .from('hubspot_leads')
    .select('deal_id')
    .eq('deal_id', String(deal_id))
    .maybeSingle()

  // ── owner_updated: só atualiza — NUNCA cria ────────────────
  if (event_type === 'owner_updated') {
    if (!existing) {
      return NextResponse.json(
        { error: `Deal ${deal_id} não encontrado. "owner_updated" não cria registros novos.` },
        { status: 404 }
      )
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
      owner_id:   String(owner_id),
    }
    if (deal_stage) updates.deal_stage = deal_stage
    if (deal_name)  updates.deal_name  = deal_name
    if (pipeline)   updates.pipeline   = pipeline
    if (vertical && String(vertical).trim()) updates.vertical = String(vertical).trim()

    const { error } = await admin
      .from('hubspot_leads')
      .update(updates)
      .eq('deal_id', String(deal_id))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: true, deal_id })
  }

  // ── deal_created: cria ou atualiza se já existir ───────────
  if (event_type === 'deal_created') {
    if (!deal_name || !created_at_hs) {
      return NextResponse.json(
        { error: '"deal_name" e "created_at_hs" são obrigatórios para "deal_created".' },
        { status: 400 }
      )
    }

    if (existing) {
      // Deal duplicado — atualiza em vez de criar
      const { error } = await admin
        .from('hubspot_leads')
        .update({
          deal_name:  deal_name,
          owner_id:   String(owner_id),
          deal_stage: deal_stage ?? null,
          pipeline:   pipeline   ?? null,
          vertical:   (vertical && String(vertical).trim()) ? String(vertical).trim() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('deal_id', String(deal_id))

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ updated: true, deal_id, note: 'deal já existia, dados atualizados' })
    }

    const { error } = await admin
      .from('hubspot_leads')
      .insert({
        deal_id:       String(deal_id),
        deal_name:     deal_name,
        owner_id:      String(owner_id),
        deal_stage:    deal_stage    ?? null,
        pipeline:      pipeline      ?? null,
        vertical:      (vertical && String(vertical).trim()) ? String(vertical).trim() : null,
        created_at_hs: created_at_hs,
        updated_at:    new Date().toISOString(),
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ created: true, deal_id })
  }
}
