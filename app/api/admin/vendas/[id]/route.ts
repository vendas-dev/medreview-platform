import { comCtx, lerJson } from '@/lib/vendas/route'
import { hEditarVenda } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Superadmin: edita qualquer campo da venda (com registro de auditoria).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await lerJson(req)
  return comCtx(ctx => hEditarVenda(ctx, id, body))
}
