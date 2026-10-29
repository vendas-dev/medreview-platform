import { comCtx, lerJson } from '@/lib/vendas/route'
import { hResolverTroca } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Superadmin: dá o check no pedido com uma resposta (o closer é avisado).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await lerJson(req)
  return comCtx(ctx => hResolverTroca(ctx, id, body))
}
