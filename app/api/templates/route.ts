import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Verticais por time
const VERTICALS_BY_TEAM: Record<string, string[]> = {
  R1:    ['Med-Review R1'],
  OAO:   ['Anest-Review', 'Oft-Review', 'Ortop-Review'],
  ambos: ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review'],
}

function extractVars(content: string): string[] {
  const matches = content.match(/\$\{([^}]+)\}/g) ?? []
  return [...new Set(matches.map(m => m.slice(2, -1)))]
}

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (p as any)?.role === 'superadmin' ? user : null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, team').eq('id', user.id).single()
  const isAdmin  = (profile as any)?.role === 'superadmin'
  const userTeam = (profile as any)?.team

  let query = supabase.from('templates').select('*').eq('is_active', true).order('created_at', { ascending: false })

  // Usuário comum só vê templates do seu time ou "ambos"
  if (!isAdmin && userTeam) {
    query = query.in('team', [userTeam, 'ambos'])
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ templates: data })
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()

  // Importação em lote via CSV
  if (body.batch && Array.isArray(body.templates)) {
    const rows = body.templates.map((t: any) => {
      const vertical = normalizeVertical(t.team, t.vertical)
      return {
        name:         t.name,
        hubspot_name: t.hubspot_name || null,
        content:      t.content,
        team:         t.team || 'ambos',
        vertical,
        variables:    extractVars(t.content),
        is_active:    true,
        created_by:   user.id,
      }
    })
    const { data, error } = await admin.from('templates').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ templates: data, count: data.length })
  }

  // Criação individual
  const vertical = normalizeVertical(body.team, body.vertical)
  const { data, error } = await admin.from('templates').insert({
    name:         body.name,
    hubspot_name: body.hubspot_name || null,
    content:      body.content,
    team:         body.team || 'ambos',
    vertical,
    variables:    extractVars(body.content),
    is_active:    true,
    created_by:   user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body  = await req.json()
  const admin = createAdminClient()
  const vertical = normalizeVertical(body.team, body.vertical)

  const { data, error } = await admin.from('templates').update({
    name:         body.name,
    hubspot_name: body.hubspot_name || null,
    content:      body.content,
    team:         body.team,
    vertical,
    variables:    extractVars(body.content),
    updated_at:   new Date().toISOString(),
  }).eq('id', body.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}

export async function DELETE(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const admin = createAdminClient()
  await admin.from('templates').update({ is_active: false }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// Normaliza verticais com base no time selecionado
function normalizeVertical(team: string, vertical: string | string[] | undefined): string[] {
  if (team === 'R1')    return ['Med-Review R1']
  if (team === 'ambos') return ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
  // OAO: usa as selecionadas
  if (!vertical) return []
  const arr = Array.isArray(vertical) ? vertical : [vertical]
  return arr.filter(v => VERTICALS_BY_TEAM.OAO.includes(v))
}
