import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/dashboard/requireSuperadmin'
import { editorOptions } from '@/lib/dashboard/eventGoals'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSuperadmin(); if ('error' in auth) return auth.error
  try { return NextResponse.json(await editorOptions(auth.admin)) }
  catch (e: any) { return NextResponse.json({ error: e.message ?? 'Erro' }, { status: 500 }) }
}
