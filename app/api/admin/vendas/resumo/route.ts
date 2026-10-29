import { comCtx, params } from '@/lib/vendas/route'
import { hResumoAdmin } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Superadmin: um bloco por closer (vendas e valor no período/filtros).
export async function GET(req: Request) { return comCtx(ctx => hResumoAdmin(ctx, params(req))) }
