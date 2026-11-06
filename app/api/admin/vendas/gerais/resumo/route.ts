import { comCtx, params } from '@/lib/vendas/route'
import { hVendasGeraisResumo } from '@/lib/vendas/gerais-handlers'
export const dynamic = 'force-dynamic'
// Superadmin: vendas e valor de cada aba (geral + 4 verticais) com os mesmos filtros.
export async function GET(req: Request) { return comCtx(ctx => hVendasGeraisResumo(ctx, params(req))) }
