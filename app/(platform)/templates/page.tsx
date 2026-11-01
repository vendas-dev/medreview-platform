import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TemplatesView } from './TemplatesView'
import { dayBoundsSaoPaulo } from '@/lib/timezone'

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
  // Data de corte fixa — conta TODO o período a partir dela (não é um
  // filtro de "hoje" que rola todo dia). Disparos anteriores a essa data
  // são ignorados na contagem (provavelmente porque o rastreio de
  // resposta só passou a ser confiável a partir daqui).
  const { start: cutoffStart } = dayBoundsSaoPaulo('2026-09-30')
  const [{ data: templatesRaw }, { data: favRows }, { data: disparosRaw }] = await Promise.all([
    query,
    supabase.from('template_favorites').select('template_id').eq('user_id', user.id),
    fetchDisparos(disparosAdmin, cutoffStart, new Date(Date.now() + 3600000).toISOString()),
  ])

  // Copys OCULTAS pelo superadmin: só ele as recebe. Feito em JS (e não no SQL) de propósito: se a coluna is_hidden ainda não existir, tudo continua visível e a página não quebra. [visibilidade-v1]
  const templates = (templatesRaw ?? []).filter((t: any) => isAdmin || !t.is_hidden)

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
  // Todos os templates ATIVOS (inclusive de outros times) para saber quantos reivindicam cada nome.
  const { data: allActive } = await disparosAdmin.from('templates').select('id, name, hubspot_name').eq('is_active', true)
  // Não existe identificador único ligando template ↔ disparo: só o NOME. Para um template não "herdar" números que são de outro:
  //  • o hubspot_name é o nome que a integração usa: se UM único template ativo o tem, os disparos com esse nome são dele;
  //  • o name (nome interno) só vale quando NENHUM template o usa como hubspot_name e nenhum outro template ativo tem o mesmo name;
  //  • nome repetido em 2+ templates é AMBÍGUO: não é atribuído a nenhum (melhor mostrar "sem disparos" do que números de outro template).
  const hubClaims = new Map<string, number>(), nameClaims = new Map<string, number>()
  ;(allActive ?? []).forEach((t: any) => {
    const h = normalizeTemplateName(t.hubspot_name ?? ''), n = normalizeTemplateName(t.name ?? '')
    if (h) hubClaims.set(h, (hubClaims.get(h) ?? 0) + 1)
    if (n) nameClaims.set(n, (nameClaims.get(n) ?? 0) + 1)
  })
  const templateStats: Record<string, { disparos: number; respostas: number }> = {}
  ;(templates ?? []).forEach((t: any) => {
    const kHub = normalizeTemplateName(t.hubspot_name ?? ''), kName = normalizeTemplateName(t.name ?? '')
    const byHub  = kHub && hubClaims.get(kHub) === 1 ? countsByName.get(kHub) : undefined
    const byName = kName && !hubClaims.has(kName) && nameClaims.get(kName) === 1 ? countsByName.get(kName) : undefined
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

// O Supabase corta SILENCIOSAMENTE cada resposta em 1.000 linhas e ignora .limit(999999): com milhares de disparos a página recebia só 1.000 linhas
// arbitrárias e TODOS os números por template ficavam parciais. Aqui lê por JANELAS DE TEMPO e divide ao meio a janela que voltar cheia (1.000 linhas),
// até cada uma caber. Exato, não depende de coluna única nem de ordem. (Só não consegue dividir mais de 1.000 disparos no MESMO milissegundo.)
async function fetchDisparos(admin: any, startIso: string, endIso: string): Promise<{ template: string | null; respondido_at: string | null }[]> {
  const { data, error } = await admin.from('disparos').select('template, respondido_at').gte('data_disparo', startIso).lt('data_disparo', endIso).limit(1000)
  if (error) return []
  const rows = data ?? []
  if (rows.length < 1000) return rows
  const a = Date.parse(startIso), b = Date.parse(endIso)
  if (!(b - a > 1)) return rows
  const mid = new Date(a + Math.floor((b - a) / 2)).toISOString()
  const left = await fetchDisparos(admin, startIso, mid)
  const right = await fetchDisparos(admin, mid, endIso)
  return [...left, ...right]
}
