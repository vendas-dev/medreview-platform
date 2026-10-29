// ══ Vendas — cola das rotas: sessão → handler → resposta (um lugar só para 401 e erro interno) ═══
import { NextResponse } from 'next/server'
import { getVendasCtx } from './auth'
import type { Ctx, R } from './handlers'

export async function comCtx(fn: (ctx: Ctx) => Promise<R>): Promise<Response> {
  const ctx = await getVendasCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await fn(ctx)
    return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[vendas]', e?.message ?? e)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
export async function lerJson(req: Request): Promise<any> { try { return await req.json() } catch { return null } }
export const params = (req: Request) => new URL(req.url).searchParams
