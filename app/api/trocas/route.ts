import { comCtx, lerJson, params } from '@/lib/vendas/route'
import { hMinhasTrocas, hCriarTroca } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// GET: o histórico de pedidos do closer logado. POST: abre um pedido de troca de venda.
export async function GET(req: Request) { return comCtx(ctx => hMinhasTrocas(ctx, params(req))) }
export async function POST(req: Request) { const body = await lerJson(req); return comCtx(ctx => hCriarTroca(ctx, body)) }
