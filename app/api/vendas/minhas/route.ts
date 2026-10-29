import { comCtx, params } from '@/lib/vendas/route'
import { hMinhasVendas } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// As vendas do closer logado (só as dele).
export async function GET(req: Request) { return comCtx(ctx => hMinhasVendas(ctx, params(req))) }
