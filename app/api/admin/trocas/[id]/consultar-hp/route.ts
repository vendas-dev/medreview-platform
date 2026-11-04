import { comCtx } from '@/lib/vendas/route'
import { hConsultarHP } from '@/lib/vendas/hp-handlers'
export const dynamic = 'force-dynamic'
// Superadmin: confere se o HP (transaction_id) do pedido existe no banco e mostra a linha traduzida. NÃO altera nada.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return comCtx(ctx => hConsultarHP(ctx, id))
}
