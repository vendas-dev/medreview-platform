import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { user }
}

export async function POST(req: NextRequest) {
  const check = await requireSuperadmin()
  if (check.error) return check.error
  const { user } = check as { user: any }

  const admin = createAdminClient()
  const formData = await req.formData()

  const mode      = formData.get('mode') as string
  const id        = formData.get('id') as string | null
  const nome      = formData.get('nome') as string
  const descricao = (formData.get('descricao') as string) || null
  const tipo      = formData.get('tipo') as string
  const team      = formData.get('team') as string
  let   vertical  = JSON.parse((formData.get('vertical') as string) || '[]') as string[]
  const file      = formData.get('file') as File | null

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!['pdf', 'imagem', 'video'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!['ambos', 'OAO', 'R1'].includes(team)) return NextResponse.json({ error: 'Time inválido' }, { status: 400 })

  // Garantido aqui no servidor, não só no modal — mesma lógica de
  // Templates: time R1 só vende Med-Review R1, "ambos" vale pras 4. Só
  // o time OAO escolhe manualmente (vende em 3 verticais diferentes).
  // Isso evita itens salvos sem vertical nenhuma, mesmo que o cliente
  // mande algo errado ou desatualizado.
  if (team === 'R1')    vertical = ['Med-Review R1']
  if (team === 'ambos') vertical = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
  if (team === 'OAO' && vertical.length === 0) return NextResponse.json({ error: 'Selecione ao menos uma vertical pro time OAO' }, { status: 400 })

  let file_url: string | undefined
  let video_source: string | null = null

  if (tipo === 'video') {
    // Vídeo nunca tem upload — só o link do Drive ou YouTube, direto.
    video_source = formData.get('video_source') as string
    const video_url = formData.get('video_url') as string
    if (!['drive', 'youtube'].includes(video_source ?? '')) return NextResponse.json({ error: 'Origem de vídeo inválida' }, { status: 400 })
    if (!video_url?.trim()) return NextResponse.json({ error: 'Link do vídeo é obrigatório' }, { status: 400 })
    file_url = video_url.trim()
  } else if (file && file.size > 0) {
    // PDF/imagem — upload de verdade, mesmo padrão do avatar de usuário.
    const ext = file.name.split('.').pop() ?? (tipo === 'pdf' ? 'pdf' : 'jpg')
    const path = `medmidia/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const bytes = await file.arrayBuffer()
    const { error: uploadErr } = await admin.storage.from('medmidia').upload(path, bytes, { contentType: file.type, upsert: true })
    if (uploadErr) return NextResponse.json({ error: `Erro no upload: ${uploadErr.message}` }, { status: 500 })
    const { data: urlData } = admin.storage.from('medmidia').getPublicUrl(path)
    file_url = urlData.publicUrl
  } else if (mode === 'create') {
    return NextResponse.json({ error: 'Arquivo é obrigatório pra PDF/imagem' }, { status: 400 })
  }

  if (mode === 'create') {
    const { data, error } = await admin.from('medmidia').insert({
      nome, descricao, tipo, video_source, file_url, team, vertical, created_by: user.id,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } else {
    if (!id) return NextResponse.json({ error: 'id é obrigatório pra edição' }, { status: 400 })
    const { data, error } = await admin.from('medmidia').update({
      nome, descricao, tipo, video_source, team, vertical,
      ...(file_url ? { file_url } : {}), // só atualiza o arquivo se um novo foi enviado
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  }
}

export async function DELETE(req: NextRequest) {
  const check = await requireSuperadmin()
  if (check.error) return check.error

  const admin = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const { error } = await admin.from('medmidia').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
