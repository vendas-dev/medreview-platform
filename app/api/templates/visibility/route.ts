import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/templates/visibility   { ids: string[], hidden: boolean }
// Só superadmin. Oculta (hidden: true) ou mostra de novo (hidden: false) uma ou várias copys pro time. Só mexe em templates ATIVOS (não excluídos).
// Idempotente: ocultar o que já está oculto não faz nada e não muda a data de quando foi ocultado.
export async function PATCH(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  let body: any; try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const ids: unknown = body?.ids, hidden: unknown = body?.hidden
  if (typeof hidden !== 'boolean') return NextResponse.json({ error: 'hidden deve ser verdadeiro ou falso' }, { status: 400 })
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some(i => typeof i !== 'string' || !UUID.test(i)))
    return NextResponse.json({ error: 'ids deve ser uma lista de 1 a 200 ids de template' }, { status: 400 })
  const unique = [...new Set(ids as string[])]

  const admin = createAdminClient()
  const patch = hidden ? { is_hidden: true, hidden_at: new Date().toISOString(), hidden_by: a.userId } : { is_hidden: false, hidden_at: null, hidden_by: null }
  // só altera quem realmente muda de estado (assim a data de "ocultado em" não é reescrita por um clique repetido)
  const { data, error } = await admin.from('templates').update(patch).in('id', unique).eq('is_active', true).eq('is_hidden', !hidden).select('id')
  if (error) {
    const faltaColuna = /is_hidden|hidden_at|hidden_by|42703/.test(`${error.code ?? ''} ${error.message ?? ''}`)
    console.error('[templates/visibility]', error.message)
    return NextResponse.json({ error: faltaColuna ? 'Falta rodar a migração migration-template-visibility.sql no Supabase.' : 'Não consegui alterar a visibilidade agora.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, hidden, requested: unique.length, updated: (data ?? []).length })
}
