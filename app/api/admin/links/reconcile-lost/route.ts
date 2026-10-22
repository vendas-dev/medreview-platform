import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'
import { reconcileLost } from '@/lib/links/lost'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Confere no HubSpot, pelo deal_id, quais negócios com link não pago já estão em "Perdido" e marca os links.
//  • POST (superadmin, logado) → o RETROATIVO. Corpo opcional: { days?: 90, recheckHours?: 6, dryRun?: false }
//    Anda por uma fila e cabe no limite de tempo: repita a chamada até vir  "done": true.
//  • GET  (cron, Authorization: Bearer CRON_SECRET) → rede de segurança diária (avisos que não chegaram).
// Precisa de HUBSPOT_ACCESS_TOKEN (app privado, escopo crm.objects.deals.read).
async function run(opts: { days?: number; recheckHours?: number; dryRun?: boolean }) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'HUBSPOT_ACCESS_TOKEN não configurado' }, { status: 500 })
  const r = await reconcileLost(createAdminClient(), { fetch: fetch as any, token, ...opts, maxMs: 48000 })
  return NextResponse.json({ ok: r.errors.length === 0, ...r }, { status: r.errors.length ? 502 : 200 })
}
const num = (v: any, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : undefined }

export async function POST(req: NextRequest) {
  const auth = await requireSuper(); if (!auth.ok) return auth.res
  let b: any = {}; try { b = await req.json() } catch {}
  try { return await run({ days: num(b?.days, 1, 365), recheckHours: num(b?.recheckHours, 0, 168), dryRun: b?.dryRun === true }) }
  catch (e: any) { console.error('[reconcile-lost]', e?.message ?? e); return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 }) }
}
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return await run({}) }
  catch (e: any) { console.error('[reconcile-lost cron]', e?.message ?? e); return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 }) }
}
