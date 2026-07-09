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

function parsePtbrDate(val: string): string | null {
  if (!val) return null
  // DD/MM/YYYY HH:mm:ss  ou  DD/MM/YYYY HH:mm
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const [, d, mo, y, h, min, s = '00'] = m
    return new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`).toISOString()
  }
  // tenta ISO direto
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

    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    const admin = createAdminClient()
    const results: any[] = []
    const errors: any[] = []

    for (const raw of items) {
      const r = normalize(raw)
      const data_disparo = parsePtbrDate(r.data_disparo ?? r.data ?? r.date ?? '')
      const proprietario  = r.proprietario ?? r.owner ?? r.owner_name ?? ''
      const proprietario_hubspot_id = r.proprietario_hubspot_id ?? r.owner_hubspot_id ?? r.owner_id ?? r.hubspot_owner_id ?? r.hubspot_id ?? null
      const nome_lead     = r.nome_lead ?? r.lead ?? r.contact ?? r.nome ?? ''
      const template      = r.template ?? r.template_name ?? ''

      if (!proprietario || !nome_lead || !template || !data_disparo) {
        errors.push({ item: raw, reason: 'proprietario, nome_lead, template e data_disparo são obrigatórios' })
        continue
      }

      const { data, error } = await admin.from('disparos').insert({
        id_negocio:   r.id_negocio ?? r.deal_id ?? null,
        proprietario,
        proprietario_hubspot_id,
        nome_lead,
        etapa:        r.etapa ?? r.stage ?? null,
        vertical:     r.vertical ?? null,
        template,
        data_disparo,
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
