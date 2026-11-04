import { comCtx, lerJson } from '@/lib/vendas/route'
import { hTransferirVenda } from '@/lib/vendas/hp-handlers'
export const dynamic = 'force-dynamic'
// Superadmin: transfere a venda do HP do pedido para o closer que pediu (corrige self-checkout, divide como co-closer ou transfere totalmente) e confirma lendo o banco.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await lerJson(req)
  return comCtx(ctx => hTransferirVenda(ctx, id, body))
}
