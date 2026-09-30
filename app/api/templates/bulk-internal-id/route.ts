import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Body esperado: { items: [{ name: 'Abordagem - Lead Frio', internal_id: 'multi_sales_disp_mkt_leadfrio_abordagem' }, ...] }
// Casa pelo NOME do template (igual ao que aparece na nossa plataforma),
// exatamente como o CSV de importação já faz — pra manter o mesmo padrão.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const items: { name?: string; internal_id?: string }[] = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ error: 'Nenhum item enviado' }, { status: 400 })

  const admin = createAdminClient()

  // Busca todos os templates uma vez só, casa por nome normalizado (sem
  // diferenciar maiúscula/minúscula nem espaços nas pontas) — evita falhar
  // por uma diferença boba de digitação no CSV.
  const { data: allTemplates } = await admin.from('templates').select('id, name')
  const byNormalizedName = new Map<string, string>()
  ;(allTemplates ?? []).forEach((t: any) => byNormalizedName.set(String(t.name ?? '').trim().toLowerCase(), t.id))

  let updated = 0
  const notFound: string[] = []

  for (const item of items) {
    const name = (item.name ?? '').trim()
    const internalId = (item.internal_id ?? '').trim()
    if (!name || !internalId) continue

    const templateId = byNormalizedName.get(name.toLowerCase())
    if (!templateId) { notFound.push(name); continue }

    const { error } = await admin.from('templates').update({ internal_platform_id: internalId }).eq('id', templateId)
    if (!error) updated++
    else notFound.push(name)
  }

  return NextResponse.json({ ok: true, updated, notFound })
}
