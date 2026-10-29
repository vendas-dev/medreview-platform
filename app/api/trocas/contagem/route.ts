import { comCtx } from '@/lib/vendas/route'
import { hContagem } from '@/lib/vendas/handlers'
export const dynamic = 'force-dynamic'
// O numerozinho do menu (pedidos pendentes — só conta para superadmin).
export async function GET() { return comCtx(ctx => hContagem(ctx)) }
