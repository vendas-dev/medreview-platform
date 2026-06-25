import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Verificar assinatura do HubSpot para segurança
function verifySignature(req: NextRequest, body: string): boolean {
  const secret    = process.env.HUBSPOT_CLIENT_SECRET
  const signature = req.headers.get('x-hubspot-signature-v3') ?? 
                    req.headers.get('x-hubspot-signature')
  if (!secret || !signature) return false

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  )
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Validar assinatura (descomente em produção)
  // if (!verifySignature(req, rawBody)) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  let events: any[]
  try {
    events = JSON.parse(rawBody)
    if (!Array.isArray(events)) events = [events]
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  for (const event of events) {
    const { subscriptionType, objectId, propertyName, propertyValue } = event

    // ── Deal criado ───────────────────────────────────────────
    if (subscriptionType === 'deal.creation') {
      // Buscar detalhes do deal na API do HubSpot
      try {
        const hsRes = await fetch(
          `https://api.hubapi.com/crm/v3/objects/deals/${objectId}?properties=dealname,hubspot_owner_id,dealstage,pipeline,createdate`,
          { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } }
        )
        if (!hsRes.ok) continue

        const deal = await hsRes.json()
        const p    = deal.properties

        // Só armazena se tiver proprietário preenchido
        if (!p.hubspot_owner_id) continue

        await admin.from('hubspot_leads').upsert({
          deal_id:       String(objectId),
          deal_name:     p.dealname ?? null,
          owner_id:      p.hubspot_owner_id,
          deal_stage:    p.dealstage ?? null,
          pipeline:      p.pipeline  ?? null,
          created_at_hs: p.createdate ? new Date(p.createdate).toISOString() : null,
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'deal_id' })
      } catch (e) {
        console.error('HubSpot webhook - deal.creation error:', e)
      }
    }

    // ── Propriedade alterada (owner ou stage) ─────────────────
    if (subscriptionType === 'deal.propertyChange') {
      if (propertyName === 'hubspot_owner_id') {
        // Roletamento: atualiza o proprietário
        if (propertyValue) {
          await admin.from('hubspot_leads')
            .update({ owner_id: propertyValue, updated_at: new Date().toISOString() })
            .eq('deal_id', String(objectId))
        }
      }

      if (propertyName === 'dealstage') {
        // Atualiza etapa
        await admin.from('hubspot_leads')
          .update({ deal_stage: propertyValue, updated_at: new Date().toISOString() })
          .eq('deal_id', String(objectId))
      }
    }
  }

  return NextResponse.json({ received: true })
}
