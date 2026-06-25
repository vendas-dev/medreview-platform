import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Proteção por token opcional
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

  const { deal_id, deal_name, owner_id, deal_stage, pipeline, created_at_hs, vertical } = body

  if (!deal_id) {
    return NextResponse.json({ error: 'deal_id obrigatório' }, { status: 400 })
  }

  // Ignorar deals sem proprietário (selfcheckout, etc)
  if (!owner_id) {
    return NextResponse.json({ skipped: true, reason: 'sem proprietário' })
  }

  const admin = createAdminClient()

  // Verificar se o deal já existe
  const { data: existing } = await admin
    .from('hubspot_leads')
    .select('deal_id')
    .eq('deal_id', String(deal_id))
    .single()

  if (existing) {
    // Atualizar apenas os campos presentes no body
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (owner_id   !== undefined) updates.owner_id   = String(owner_id)
    if (deal_stage !== undefined) updates.deal_stage = deal_stage
    if (deal_name  !== undefined) updates.deal_name  = deal_name
    if (pipeline   !== undefined) updates.pipeline   = pipeline
    if (vertical   !== undefined) updates.vertical   = vertical

    const { error } = await admin
      .from('hubspot_leads')
      .update(updates)
      .eq('deal_id', String(deal_id))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: true, deal_id: String(deal_id) })
  }

  // Novo deal — insert
  const { error } = await admin
    .from('hubspot_leads')
    .insert({
      deal_id:       String(deal_id),
      deal_name:     deal_name     ?? null,
      owner_id:      String(owner_id),
      deal_stage:    deal_stage    ?? null,
      pipeline:      pipeline      ?? null,
      vertical:      vertical      ?? null,
      created_at_hs: created_at_hs ?? new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: true, deal_id: String(deal_id) })
}
