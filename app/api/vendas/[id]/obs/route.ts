import { comCtx, lerJson } from '@/lib/vendas/route'
import { hObs } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// O Obs de uma venda: o closer edita só nas próprias; o superadmin, em qualquer uma.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await lerJson(req)
  return comCtx(ctx => hObs(ctx, id, body))
}
