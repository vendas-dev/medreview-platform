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

    const body = await req.json()
    const items: any[] = Array.isArray(body) ? body : [body]
    const admin = createAdminClient()
    const results: any[] = []
    const errors: any[] = []

    for (const raw of items) {
      const r = normalize(raw)
      const id_negocio = r.id_negocio ?? r.deal_id ?? null
      // ID interno da plataforma de conversação (ex:
      // 'multi_sales_disp_mkt_leadfrio_abordagem') — bem diferente do nome
      // "bonito" que fica salvo em disparos.template. Resolvemos pra esse
      // nome bonito aqui, consultando o de-para em templates.
      const internal_platform_id = r.internal_platform_id ?? r.id_interno ?? r.template_internal_id ?? null
      const templateDireto = r.template ?? r.template_name ?? null // ainda aceito, se algum dia vier o nome bonito direto
      const data_resposta = parsePtbrDate(r.data_resposta ?? r.data ?? r.date ?? '') ?? new Date().toISOString()

      if (!id_negocio) {
        errors.push({ item: raw, reason: 'id_negocio (ou deal_id) é obrigatório' })
        continue
      }

      // Resolve o ID interno pro nome bonito do template, se enviado
      let template: string | null = templateDireto
      if (!template && internal_platform_id) {
        const { data: tpl } = await admin.from('templates').select('name')
          .eq('internal_platform_id', internal_platform_id).maybeSingle()
        if (tpl) template = tpl.name
        // Se não achar o de-para, segue sem template (cai no fallback "mais
        // recente do negócio, sem filtrar") — não bloqueia a resposta só
        // porque o de-para ainda não foi cadastrado pra esse template.
      }

      // Pega a linha de disparo MAIS RECENTE desse negócio — se o mesmo
      // negócio recebeu 3 disparos e só o último foi respondido, marcar
      // todas as 3 linhas contaria errado na taxa de resposta.
      // Quando o template foi resolvido (direto ou via ID interno),
      // restringe a busca a ele também — evita atribuir a resposta ao
      // template errado quando dois templates diferentes foram disparados
      // pro mesmo negócio em sequência rápida, antes da resposta chegar.
      let findQuery = admin
        .from('disparos')
        .select('id, respondido_at')
        .eq('id_negocio', id_negocio)
      if (template) findQuery = findQuery.eq('template', template)
      const { data: latest, error: findError } = await findQuery
        .order('data_disparo', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findError) { errors.push({ item: raw, reason: findError.message }); continue }
      if (!latest) {
        errors.push({ item: raw, reason: template
          ? `Nenhum disparo encontrado pro id_negocio "${id_negocio}" com o template "${template}"`
          : `Nenhum disparo encontrado pro id_negocio "${id_negocio}"` })
        continue
      }

      // Já estava marcado (resposta duplicada/reenviada) — não é erro, só
      // não faz nada de novo.
      if (latest.respondido_at) { results.push({ id: latest.id, already: true }); continue }

      const { data: updated, error: updateError } = await admin
        .from('disparos')
        .update({ respondido_at: data_resposta })
        .eq('id', latest.id)
        .select()
        .single()

      if (updateError) errors.push({ item: raw, reason: updateError.message })
      else results.push(updated)
    }

    return NextResponse.json(
      { ok: true, updated: results.length, skipped: errors.length, errors: errors.slice(0, 5) },
      { status: 200, headers: CORS }
    )
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message) }, { status: 500, headers: CORS })
  }
}

