import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aplicarReembolsos, MAX_REEMBOLSOS_POR_CHAMADA, parseReembolsoBody } from '@/lib/reembolsos'

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret' }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }) }

// Marca vendas como REEMBOLSADAS pelo transaction_id (o "HP"). A venda sai de TODOS os valores e contagens (o gatilho do banco tira a linha de 'sale').
//   POST    { "transaction_id": "HP0052903820" }                      (opcional: "motivo": "texto")
//   POST    { "transaction_ids": ["HP...", "HP..."] }   ou   [ {"transaction_id": "HP..."}, ... ]        — até 500 por chamada
//   DELETE  { "transaction_id": "HP..." }   (ou POST com "desfazer": true)                               — DESFAZ o reembolso (a venda volta a contar)
// Autenticação: o MESMO segredo dos outros webhooks (cabeçalho x-webhook-secret = variável WEBHOOK_SECRET). Aqui o segredo é OBRIGATÓRIO (mexe em dinheiro): sem ele configurado a rota recusa tudo.
// É idempotente: mandar o mesmo HP duas vezes não faz mal (a 2ª resposta diz "ja_reembolsado").
async function tratar(req: NextRequest, desfazerPorMetodo: boolean) {
  try {
    const secret = process.env.WEBHOOK_SECRET
    if (!secret) return NextResponse.json({ error: 'WEBHOOK_SECRET não está configurado no servidor: esta rota fica fechada até configurar' }, { status: 500, headers: CORS })
    if (req.headers.get('x-webhook-secret') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400, headers: CORS }) }
    const { items, rejected, desfazer } = parseReembolsoBody(body)
    if (items.length === 0) return NextResponse.json({ error: 'nenhum transaction_id válido', rejected: rejected.slice(0, 5) }, { status: 400, headers: CORS })
    if (items.length > MAX_REEMBOLSOS_POR_CHAMADA) return NextResponse.json({ error: `no máximo ${MAX_REEMBOLSOS_POR_CHAMADA} transaction_id por chamada` }, { status: 413, headers: CORS })

    const resultados = await aplicarReembolsos(createAdminClient(), items, desfazerPorMetodo || desfazer)
    const resumo: Record<string, number> = {}
    for (const r of resultados) resumo[r.status] = (resumo[r.status] ?? 0) + 1
    const temErro = resultados.some(r => r.status === 'erro')
    return NextResponse.json({ ok: !temErro, recebidos: items.length, rejeitados: rejected.length, resumo, resultados }, { status: temErro ? 500 : 200, headers: CORS })
  } catch (e: any) {
    console.error('[reembolsos]', e?.message ?? e)
    return NextResponse.json({ error: 'Erro ao processar o reembolso' }, { status: 500, headers: CORS })
  }
}
export async function POST(req: NextRequest) { return tratar(req, false) }
export async function DELETE(req: NextRequest) { return tratar(req, true) }
