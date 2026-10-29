import { comCtx, lerJson } from '@/lib/vendas/route'
import { hEditarTroca } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Edita a SOLICITAÇÃO: o closer edita a própria (só enquanto pendente); o superadmin edita qualquer uma.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await lerJson(req)
  return comCtx(ctx => hEditarTroca(ctx, id, body))
}
