import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PHASES, PHASE_KIND, PHASE_LABEL, EXAM_VERTICALS, ExamPhase, ExamVertical } from '@/lib/milestones/exams/types'
import { isoDate } from '@/lib/milestones/exams/dates'

export const dynamic = 'force-dynamic'

async function requireSuper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((me as any)?.role !== 'superadmin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

const parseIso = (s: unknown): string | null => {
  if (typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? isoDate(+m[1], +m[2], +m[3]) : null
}

// Cadastro MANUAL: pra quando o site da sociedade bloqueia leitura automática (ex.: SBOT).
// Exige o link do edital oficial e fica sempre marcado como "cadastro manual" com o nome de quem cadastrou.
export async function POST(req: NextRequest) {
  const auth = await requireSuper(); if ('error' in auth) return auth.error
  const b = await req.json().catch(() => null)
  const vertical = b?.vertical as ExamVertical
  const phase = b?.phase as ExamPhase
  const starts = parseIso(b?.starts_on)
  const ends = b?.ends_on ? parseIso(b.ends_on) : null
  const label = typeof b?.exam_label === 'string' ? b.exam_label.trim().toUpperCase().slice(0, 12) : ''
  let url: URL | null = null
  try { url = new URL(String(b?.source_url ?? '')) } catch { /* inválida */ }

  if (!EXAM_VERTICALS.includes(vertical)) return NextResponse.json({ error: 'Vertical inválida' }, { status: 400 })
  if (!(PHASES as readonly string[]).includes(phase)) return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
  if (!label) return NextResponse.json({ error: 'Informe a prova (ex.: TEOT)' }, { status: 400 })
  if (!starts) return NextResponse.json({ error: 'Data inicial inválida' }, { status: 400 })
  if (b?.ends_on && (!ends || ends < starts)) return NextResponse.json({ error: 'Data final inválida' }, { status: 400 })
  if (!url || url.protocol !== 'https:') return NextResponse.json({ error: 'Informe o link (https) do edital oficial' }, { status: 400 })

  const admin = createAdminClient()
  const { data: src } = await admin.from('exam_sources').select('society').eq('vertical', vertical).limit(1).maybeSingle()
  const { data, error } = await admin.from('exam_milestones').insert({
    dedupe_key: `manual|${crypto.randomUUID()}`, vertical, society: (src as any)?.society ?? '—', exam_label: label, phase,
    kind: PHASE_KIND[phase], title: String(b?.title ?? '').trim().slice(0, 120) || PHASE_LABEL[phase],
    starts_on: starts, ends_on: ends && ends !== starts ? ends : null, source_url: url.toString(),
    evidence: typeof b?.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 300) : null,
    origin: 'manual', status: 'active', created_by: auth.user!.id,
  }).select().single()
  if (error) { console.error('[exams manual]', error.message); return NextResponse.json({ error: 'Não consegui salvar' }, { status: 500 }) }
  return NextResponse.json({ ok: true, item: data })
}

// Só apaga cadastros MANUAIS (as datas lidas dos sites não se apagam à mão: se saírem do site, saem sozinhas).
export async function DELETE(req: NextRequest) {
  const auth = await requireSuper(); if ('error' in auth) return auth.error
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const { error } = await createAdminClient().from('exam_milestones').delete().eq('id', id).eq('origin', 'manual')
  if (error) return NextResponse.json({ error: 'Não consegui apagar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
