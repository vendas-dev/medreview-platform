import { comCtx, lerJson } from '@/lib/vendas/route'
import { hEditarResposta } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// Superadmin: edita uma resposta JÁ enviada (justificativa e/ou Conceder ↔ Negar); o closer é avisado.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await lerJson(req)
  return comCtx(ctx => hEditarResposta(ctx, id, body))
}
