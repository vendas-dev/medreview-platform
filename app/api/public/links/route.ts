import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-webhook-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function parsePtbrDate(val: string | null | undefined): string | null {
  if (!val) return null
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const [, d, mo, y, h, min, s = '00'] = m
    return new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`).toISOString()
  }
  try { return new Date(val).toISOString() } catch { return null }
}

function normalize(raw: any): any {
  const r: any = {}
  for (const k of Object.keys(raw)) {
    r[k.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')] = raw[k]
  }
  return r
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const provided = req.headers.get('x-webhook-secret')
      if (provided !== secret)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    }

    const body  = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    const admin = createAdminClient()
    const results: any[] = []
    const errors: any[] = []

    for (const raw of items) {
      const r = normalize(raw)

      // Aliases PT-BR → campos canônicos
      const owner_name     = r.owner_name ?? r.proprietario ?? r.owner ?? ''
      const generated_at   = parsePtbrDate(r.generated_at ?? r.data_geracao ?? r.data ?? '')
      const deal_name      = r.deal_name ?? r.nome_negocio ?? r.negocio ?? null
      const deal_value     = parseFloat(r.deal_value ?? r.valor_negocio ?? r.valor ?? '0') || null
      const deal_created_at= parsePtbrDate(r.deal_created_at ?? r.data_criacao ?? null)
      const expires_at     = parsePtbrDate(r.expires_at ?? r.expira_em ?? null)

      if (!owner_name || !generated_at) {
        errors.push({ item: raw, reason: 'owner_name e generated_at são obrigatórios' })
        continue
      }

      const { data, error } = await admin.from('geracoes_links').insert({
        deal_id:         r.deal_id ?? null,
        deal_name,
        deal_value,
        deal_created_at,
        generated_at,
        owner_name,
        vertical:        r.vertical ?? null,
        product_name:    r.product_name ?? r.produto ?? null,
        generation_mode: r.generation_mode ?? r.modo_geracao ?? null,
        selected_option: r.selected_option ?? r.opcao ?? null,
        payment_link:    r.payment_link ?? r.link ?? null,
        expires_at,
        pipeline_name:   r.pipeline_name ?? r.pipeline ?? null,
        stage_name:      r.stage_name ?? r.etapa ?? null,
      }).select().single()

      if (error) errors.push({ item: raw, reason: error.message })
      else results.push(data)
    }

    return NextResponse.json(
      { ok: true, inserted: results.length, skipped: errors.length, errors: errors.slice(0, 5) },
      { status: 201, headers: CORS }
    )
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message) }, { status: 500, headers: CORS })
  }
}
