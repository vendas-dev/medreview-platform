import { comCtx, params } from '@/lib/vendas/route'
import { hVendasGerais } from '@/lib/vendas/gerais-handlers'
export const dynamic = 'force-dynamic'
// Superadmin: UMA página da tabela de Vendas Gerais (aba geral ou uma vertical), com filtros, busca, ordem e paginação.
export async function GET(req: Request) { return comCtx(ctx => hVendasGerais(ctx, params(req))) }
