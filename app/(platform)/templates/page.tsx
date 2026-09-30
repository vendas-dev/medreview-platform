import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TemplatesView } from './TemplatesView'

function normalizeTemplateName(s: string): string {
  return (s ?? '').trim().toLowerCase()
}

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  const client = isAdmin ? createAdminClient() : supabase

  let query = client.from('templates').select('*').eq('is_active', true).order('created_at', { ascending: false })

  // Usuário comum: filtra pelo time
  if (!isAdmin && userTeam) {
    query = query.in('team', [userTeam, 'ambos'])
  }

  // Disparos e respostas — direto da tabela 'disparos' que já existe (a
  // integração externa já envia o nome do template em cada disparo). Nunca
  // criamos nada novo em 'templates' pra isso; só agregamos aqui. Usa
  // admin client à parte (independente do isAdmin de cima), porque essa
  // consulta é só leitura agregada e não deve depender de RLS liberar
  // 'disparos' pro usuário comum também ver a própria taxa de resposta.
  const disparosAdmin = createAdminClient()
  const [{ data: templates }, { data: favRows }, { data: disparosRaw }] = await Promise.all([
    query,
    supabase.from('template_favorites').select('template_id').eq('user_id', user.id),
    disparosAdmin.from('disparos').select('template, respondido_at').limit(999999),
  ])

  const favoriteIds = (favRows ?? []).map((r: any) => r.template_id)

  // Agrega por nome de template normalizado (minúsculo, sem espaço nas
  // pontas) — a integração pode variar maiúscula/minúscula, mas o nome
  // continua sendo o mesmo template.
  const countsByName = new Map<string, { disparos: number; respostas: number }>()
  ;(disparosRaw ?? []).forEach((d: any) => {
    const key = normalizeTemplateName(d.template)
    if (!key) return
    if (!countsByName.has(key)) countsByName.set(key, { disparos: 0, respostas: 0 })
    const entry = countsByName.get(key)!
    entry.disparos++
    if (d.respondido_at) entry.respostas++
  })

  // Casa cada template com o nome de disparo — tenta o nome no HubSpot
  // primeiro (é o que a integração normalmente usa), cai pro nome interno
  // se não achar.
  const templateStats: Record<string, { disparos: number; respostas: number }> = {}
  ;(templates ?? []).forEach((t: any) => {
    const byHub  = countsByName.get(normalizeTemplateName(t.hubspot_name ?? ''))
    const byName = countsByName.get(normalizeTemplateName(t.name ?? ''))
    const found = byHub ?? byName
    if (found) templateStats[t.id] = found
  })

  return (
    <TemplatesView
      templates={templates ?? []}
      isAdmin={isAdmin}
      userTeam={userTeam}
      favoriteIds={favoriteIds}
      templateStats={templateStats}
    />
  )
}
