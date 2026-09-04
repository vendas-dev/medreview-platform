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

// Converte uma data recebida do webhook pra ISO UTC. TODO valor sem fuso
// explícito (seja formato DD/MM/YYYY, seja ISO "YYYY-MM-DD HH:MM") é tratado
// como horário de São Paulo — é sempre isso que a fonte externa quer dizer.
//
// Bug corrigido aqui: antes, só o formato DD/MM/YYYY forçava -03:00. Se a
// fonte mandasse em outro formato sem fuso (ex: "2026-08-27 09:50:00"), caía
// no fallback `new Date(val)`, que o servidor (rodando em UTC) interpretava
// como se já fosse UTC — o vencimento gravado ficava 3h adiantado do horário
// de SP pretendido (ex: 09:50 SP virava 06:50 SP na prática).
function parsePtbrDate(val: string | null | undefined): string | null {
  if (!val) return null
  const v = String(val).trim()

  // Formato DD/MM/YYYY HH:MM[:SS] — sempre horário de SP
  const brMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (brMatch) {
    const [, d, mo, y, h, min, s = '00'] = brMatch
    return new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`).toISOString()
  }

  // Formato ISO "YYYY-MM-DD[T ]HH:MM[:SS]" SEM fuso explícito — também
  // tratado como horário de SP (mesma regra do formato acima). Só cai fora
  // daqui se a string já trouxer 'Z' ou um offset explícito no final.
  const isoNoTzMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?\s*$/)
  if (isoNoTzMatch) {
    const [, y, mo, d, h, min, s = '00'] = isoNoTzMatch
    return new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`).toISOString()
  }

  // Qualquer outro formato — presume que já vem com fuso explícito (Z,
  // +00:00 etc.) e deixa o parser nativo interpretar normalmente.
  try { return new Date(v).toISOString() } catch { return null }
}

function normalize(raw: any): any {
  const r: any = {}
  for (const k of Object.keys(raw)) {
    r[k.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')] = raw[k]
  }
  return r
}

// Modalidade de pagamento — só 3 valores aceitos, pra dar pra contar/comparar
// depois sem depender de texto solto. 'sem_juros' pode ter qualquer número de
// parcelas (installments_no_interest), não só 3 — hoje só existe 3x, mas o
// campo já aceita 4x, 2x etc. se um dia isso mudar.
const VALID_PAYMENT_MODES = ['a_vista', 'parcelado', 'sem_juros']

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
      const owner_hubspot_id = r.owner_hubspot_id ?? r.proprietario_hubspot_id ?? r.owner_id ?? r.hubspot_owner_id ?? r.hubspot_id ?? null
      const generated_at   = parsePtbrDate(r.generated_at ?? r.data_geracao ?? r.data ?? '')
      const deal_name      = r.deal_name ?? r.nome_negocio ?? r.negocio ?? null
      const deal_value     = parseFloat(r.deal_value ?? r.valor_negocio ?? r.valor ?? '0') || null
      const deal_created_at= parsePtbrDate(r.deal_created_at ?? r.data_criacao ?? null)
      const expires_at     = parsePtbrDate(r.expires_at ?? r.expira_em ?? null)

      // Desconto — aceita vir já como número (ex: 7.5) ou extraído de um
      // cupom no padrão "_X%" no final (mesmo padrão usado nas vendas).
      const coupon_code = r.coupon_code ?? r.cupom ?? null
      let discount_pct = parseFloat(r.discount_pct ?? r.desconto ?? r.porcentagem_desconto ?? '') || null
      if (discount_pct === null) {
        const couponSrc = coupon_code ?? r.payment_link ?? r.link ?? ''
        const m = String(couponSrc).match(/_(\d+(?:\.\d+)?)%/)
        if (m) discount_pct = parseFloat(m[1])
      }

      // Modalidade de pagamento — novo campo, separado do discount_pct.
      // generation_mode/selected_option continuam sendo gravados como já
      // eram (não removidos ainda), payment_mode é adicional.
      let payment_mode: string | null = r.payment_mode ?? r.modalidade ?? null
      if (payment_mode && !VALID_PAYMENT_MODES.includes(payment_mode)) payment_mode = null
      const installments_no_interest = payment_mode === 'sem_juros'
        ? (parseInt(r.installments_no_interest ?? r.parcelas_sem_juros ?? '', 10) || 3)
        : null

      // Nome/categoria do evento — só relevante pra links de cupom de
      // evento (EV_), mas aceito sempre (sem exigir nada) pra não travar
      // links comuns. Usado depois como fallback na venda, quando o cupom
      // for pré-pronto e a venda chegar sem esses dados. IMPORTANTE: chama-se
      // "event_category" (não "event_type") porque a tabela telao_events já
      // tem uma coluna "event_type" com outro significado — pra manter os
      // nomes iguais nas duas pontas (link e venda), usamos event_category
      // aqui também, mesmo geracoes_links não tendo esse conflito.
      const event_name     = r.event_name ?? r.nome_evento ?? null
      const event_category = r.event_category ?? r.tipo_evento ?? r.categoria_evento ?? null

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
        owner_hubspot_id,
        vertical:        r.vertical ?? null,
        product_name:    r.product_name ?? r.produto ?? null,
        generation_mode: r.generation_mode ?? r.modo_geracao ?? null,
        selected_option: r.selected_option ?? r.opcao ?? null,
        payment_link:    r.payment_link ?? r.link ?? null,
        expires_at,
        pipeline_name:   r.pipeline_name ?? r.pipeline ?? null,
        stage_name:      r.stage_name ?? r.etapa ?? null,
        discount_pct,
        coupon_code,
        payment_mode,
        installments_no_interest,
        event_name,
        event_category,
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
