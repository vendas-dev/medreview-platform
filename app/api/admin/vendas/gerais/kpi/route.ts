import { comCtx, params } from '@/lib/vendas/route'
import { hVendasGeraisKpi } from '@/lib/vendas/kpi-handlers'
export const dynamic = 'force-dynamic'
// Superadmin: realizado, meta e vendas do total, das verticais e dos closers (visão KPI de Vendas Gerais).
export async function GET(req: Request) { return comCtx(ctx => hVendasGeraisKpi(ctx, params(req))) }
