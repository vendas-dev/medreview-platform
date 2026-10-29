import { comCtx, params } from '@/lib/vendas/route'
import { hTrocasAdmin } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Superadmin: todos os pedidos de troca (filtros: status, data, vertical, time, closer).
export async function GET(req: Request) { return comCtx(ctx => hTrocasAdmin(ctx, params(req))) }
