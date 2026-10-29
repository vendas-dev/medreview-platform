import { comCtx, params } from '@/lib/vendas/route'
import { hVendasDoCloser } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Superadmin: a tabela de vendas de um closer (ou "sem-closer").
export async function GET(req: Request, { params: p }: { params: Promise<{ closerId: string }> }) {
  const { closerId } = await p
  return comCtx(ctx => hVendasDoCloser(ctx, closerId, params(req)))
}
