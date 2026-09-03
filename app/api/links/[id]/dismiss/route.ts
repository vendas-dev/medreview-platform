import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 'await params' funciona tanto no Next.js 15+ (onde params é uma Promise)
// quanto em versões anteriores (onde awaitar um valor comum não quebra
// nada — só resolve o próprio valor). Evita depender de qual versão
// exata do Next.js o projeto está usando.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> } | { params: { id: string } }) {
  const { id } = await context.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, name, hubspot_id').eq('id', user.id).single()
  const isAdmin = (profile as any)?.role === 'superadmin'

  const admin = createAdminClient()
  const { data: link } = await admin.from('geracoes_links')
    .select('id, owner_hubspot_id, owner_name, dismissed_at')
    .eq('id', id).maybeSingle()

  if (!link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
  if (link.dismissed_at) return NextResponse.json({ ok: true, already: true })

  // Usuário comum só pode excluir os próprios links — mesmo critério de
  // matching (hubspot_id primeiro, nome como fallback) usado em todo o
  // resto do sistema pra separar "meus links" dos de outros closers.
  if (!isAdmin) {
    const nameNorm = ((profile as any)?.name ?? '').trim().toLowerCase()
    const ownHubspotId = (profile as any)?.hubspot_id
    const matches = (ownHubspotId && link.owner_hubspot_id && link.owner_hubspot_id === ownHubspotId) ||
      (!link.owner_hubspot_id && nameNorm && (link.owner_name ?? '').trim().toLowerCase() === nameNorm)
    if (!matches) return NextResponse.json({ error: 'Você só pode excluir os próprios links' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  // Soft-delete: marca como descartado, nunca apaga a linha — o link some
  // de todas as telas, mas o histórico continua no banco pra auditoria.
  const { error } = await admin.from('geracoes_links').update({
    dismissed_at:     new Date().toISOString(),
    dismissed_by:     user.id,
    dismissed_reason: body.reason || null,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
