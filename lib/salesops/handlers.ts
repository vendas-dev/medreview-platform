// ── Handlers do Sales Ops AI ──────────────────────────────────────────────────────────────────
// Mesmo desenho de lib/campaigns/handlers.ts: as rotas ficam finas (só autenticam) e cada handler recebe o cliente admin e devolve { status, json }. O chat devolve um stream.
// Escopo de dados: CONVERSAS e MENSAGENS são do perfil que conversou (toda consulta filtra por user_id — um superadmin nunca lê o histórico de outro);
// AJUSTES, BASE DE PROCESSOS, VERSÕES e LACUNAS são do time de Sales Ops (compartilhados).
import { safeHref, plainText } from '@/lib/salesops/markdown'
import { parseAnthropicStream } from '@/lib/salesops/stream'
import {
  DEFAULT_MODEL, DEFAULT_SETTINGS, MAX_MESSAGE_CHARS, buildSystemBlocks, promptStats, isGapAnswer, deriveTitle, sliceHistory,
  type KnowledgeEntry, type KnowledgeLink, type SalesOpsSettings, type Tone,
} from '@/lib/salesops/prompt'

export interface HResult { status: number; json: any }
const ok = (json: any, status = 200): HResult => ({ status, json })
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): HResult => ({ status, json: { error, ...extra } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b)
const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)
export const SETTINGS_ID = '00000000-0000-0000-0000-0000000000a1'
const TONES: Tone[] = ['didatico', 'objetivo', 'descontraido', 'formal']
const MODEL_RE = /^claude-[a-z0-9][a-z0-9.\-]{2,70}$/
const dbErr = (e: any) => fail(500, `Erro no banco: ${e?.message ?? e}`)

// ════════════════════════ CONVERSAS ════════════════════════
const CONV_COLS = 'id, title, pinned, created_at, updated_at'
export async function hListConversations(admin: any, userId: string, p: { q?: string; limit?: number; offset?: number }): Promise<HResult> {
  const q = (p.q ?? '').trim().slice(0, 100), limit = clamp(Math.floor(p.limit ?? 40), 1, 100), offset = Math.max(Math.floor(p.offset ?? 0), 0)
  if (!q) {
    const { data, error } = await admin.from('sales_ops_conversations').select(CONV_COLS).eq('user_id', userId)
      .order('pinned', { ascending: false }).order('updated_at', { ascending: false }).range(offset, offset + limit)
    if (error) return dbErr(error)
    const rows = (data ?? []) as any[]
    return ok({ conversations: rows.slice(0, limit), hasMore: rows.length > limit })
  }
  const like = `%${escapeLike(q)}%`
  const [byTitle, byMsg] = await Promise.all([
    admin.from('sales_ops_conversations').select(CONV_COLS).eq('user_id', userId).ilike('title', like).limit(100),
    admin.from('sales_ops_messages').select('conversation_id, content, created_at').eq('user_id', userId).ilike('content', like).order('created_at', { ascending: false }).limit(300),
  ])
  if (byTitle.error) return dbErr(byTitle.error)
  if (byMsg.error) return dbErr(byMsg.error)
  const found = new Map<string, any>(((byTitle.data ?? []) as any[]).map(c => [c.id, { ...c }]))
  const snippets = new Map<string, string>()
  const low = q.toLowerCase()
  for (const m of (byMsg.data ?? []) as any[]) {
    if (snippets.has(m.conversation_id)) continue
    const txt = plainText(m.content), at = Math.max(txt.toLowerCase().indexOf(low), 0)
    snippets.set(m.conversation_id, `${at > 40 ? '…' : ''}${txt.slice(Math.max(at - 40, 0), at + 90)}${txt.length > at + 90 ? '…' : ''}`)
  }
  const missing = [...snippets.keys()].filter(id => !found.has(id))
  if (missing.length) {
    const { data, error } = await admin.from('sales_ops_conversations').select(CONV_COLS).eq('user_id', userId).in('id', missing)
    if (error) return dbErr(error)
    for (const c of (data ?? []) as any[]) found.set(c.id, { ...c })
  }
  const list = [...found.values()].map(c => ({ ...c, snippet: snippets.get(c.id) ?? null }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updated_at).localeCompare(String(a.updated_at)))
  return ok({ conversations: list, hasMore: false })
}

async function ownConversation(admin: any, userId: string, id: string) {
  if (!UUID.test(String(id ?? ''))) return null
  const { data } = await admin.from('sales_ops_conversations').select(CONV_COLS).eq('id', id).eq('user_id', userId).maybeSingle()
  return data ?? null
}

const MSG_COLS = 'id, role, content, feedback, feedback_note, is_gap, incomplete, created_at'
export async function hGetConversation(admin: any, userId: string, id: string): Promise<HResult> {
  const conv = await ownConversation(admin, userId, id)
  if (!conv) return fail(404, 'Conversa não encontrada.')
  const { data, error } = await admin.from('sales_ops_messages').select(MSG_COLS).eq('conversation_id', id).order('created_at', { ascending: true }).limit(1000)
  if (error) return dbErr(error)
  const messages = ((data ?? []) as any[]).filter(m => !(m.role === 'assistant' && m.incomplete && !String(m.content ?? '').trim()))   // some o "esboço" vazio de uma resposta que nem começou
  return ok({ conversation: conv, messages })
}

export async function hPatchConversation(admin: any, userId: string, id: string, body: any): Promise<HResult> {
  if (!(await ownConversation(admin, userId, id))) return fail(404, 'Conversa não encontrada.')
  const patch: Record<string, unknown> = {}
  if (body && 'title' in body) {
    const title = String(body.title ?? '').replace(/\s+/g, ' ').trim()
    if (!title) return fail(400, 'O nome da conversa não pode ficar vazio.')
    if (title.length > 120) return fail(400, 'O nome da conversa pode ter no máximo 120 caracteres.')
    patch.title = title
  }
  if (body && 'pinned' in body) { if (typeof body.pinned !== 'boolean') return fail(400, 'pinned deve ser verdadeiro ou falso.'); patch.pinned = body.pinned }
  if (Object.keys(patch).length === 0) return fail(400, 'Nada para alterar.')
  const { data, error } = await admin.from('sales_ops_conversations').update(patch).eq('id', id).eq('user_id', userId).select(CONV_COLS).single()   // renomear/fixar NÃO muda updated_at (não faz a conversa "pular")
  if (error) return dbErr(error)
  return ok({ conversation: data })
}

export async function hDeleteConversation(admin: any, userId: string, id: string): Promise<HResult> {
  if (!(await ownConversation(admin, userId, id))) return fail(404, 'Conversa não encontrada.')
  const { error } = await admin.from('sales_ops_conversations').delete().eq('id', id).eq('user_id', userId)      // as mensagens saem junto (on delete cascade)
  if (error) return dbErr(error)
  return ok({ ok: true })
}

/** 👍 / 👎 numa resposta (só nas respostas das PRÓPRIAS conversas). */
export async function hFeedback(admin: any, userId: string, messageId: string, body: any): Promise<HResult> {
  if (!UUID.test(String(messageId ?? ''))) return fail(404, 'Mensagem não encontrada.')
  const { data: m } = await admin.from('sales_ops_messages').select('id, role').eq('id', messageId).eq('user_id', userId).maybeSingle()
  if (!m || m.role !== 'assistant') return fail(404, 'Mensagem não encontrada.')
  const fb = body?.feedback
  if (fb !== 1 && fb !== -1 && fb !== null) return fail(400, 'feedback deve ser 1, -1 ou null.')
  const note = fb === -1 && typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null
  const { error } = await admin.from('sales_ops_messages').update({ feedback: fb, feedback_note: note, gap_resolved: false }).eq('id', messageId).eq('user_id', userId)
  if (error) return dbErr(error)
  return ok({ ok: true, feedback: fb, note })
}

// ════════════════════════ AJUSTES (prompt geral, tom, sugestões) ════════════════════════
async function loadSettings(admin: any): Promise<SalesOpsSettings> {
  const { data, error } = await admin.from('sales_ops_ai_settings').select('general_prompt, tone, model, max_tokens, suggested_prompts').eq('id', SETTINGS_ID).maybeSingle()
  if (error) throw new Error(error.message)                         // falha de leitura NÃO vira "valores padrão": salvar em cima disso apagaria o prompt do time
  const d = data ?? {}
  return {
    general_prompt: typeof d.general_prompt === 'string' ? d.general_prompt : DEFAULT_SETTINGS.general_prompt,
    tone: TONES.includes(d.tone) ? d.tone : DEFAULT_SETTINGS.tone,
    model: typeof d.model === 'string' && d.model ? d.model : null,
    max_tokens: Number.isInteger(d.max_tokens) ? d.max_tokens : DEFAULT_SETTINGS.max_tokens,
    suggested_prompts: Array.isArray(d.suggested_prompts) ? d.suggested_prompts.filter((x: any) => typeof x === 'string') : [],
  }
}
async function loadKnowledge(admin: any, onlyActive = false): Promise<KnowledgeEntry[]> {
  let q = admin.from('sales_ops_knowledge').select('id, title, category, content, links, is_active, updated_at')
  if (onlyActive) q = q.eq('is_active', true)
  const { data, error } = await q.order('title', { ascending: true }).limit(1000)
  if (error) throw new Error(error.message)                         // idem: falha de leitura não pode virar "base vazia"
  return ((data ?? []) as any[]).map(e => ({ ...e, links: Array.isArray(e.links) ? e.links : [] }))
}

export async function hGetSettings(admin: any): Promise<HResult> {
  try { const [settings, knowledge] = await Promise.all([loadSettings(admin), loadKnowledge(admin)]); return ok({ settings, stats: promptStats(settings, knowledge) }) } catch (e) { return dbErr(e) }
}

export async function hPutSettings(admin: any, userId: string, body: any): Promise<HResult> {
  if (!body || typeof body !== 'object') return fail(400, 'Corpo inválido.')
  let cur: SalesOpsSettings
  try { cur = await loadSettings(admin) } catch (e) { return dbErr(e) }
  const next: SalesOpsSettings = { ...cur }
  if ('general_prompt' in body) {
    if (typeof body.general_prompt !== 'string') return fail(400, 'O prompt geral deve ser texto.')
    if (body.general_prompt.length > 60_000) return fail(400, 'O prompt geral passou de 60.000 caracteres. Mova os processos para a aba "Processos".')
    next.general_prompt = body.general_prompt
  }
  if ('tone' in body) { if (!TONES.includes(body.tone)) return fail(400, 'Tom inválido.'); next.tone = body.tone }
  if ('max_tokens' in body) { if (!Number.isInteger(body.max_tokens) || body.max_tokens < 500 || body.max_tokens > 8000) return fail(400, 'O limite de resposta deve ser um número inteiro entre 500 e 8000.'); next.max_tokens = body.max_tokens }
  if ('model' in body) { const m = body.model === null || body.model === '' ? null : body.model; if (m !== null && (typeof m !== 'string' || !MODEL_RE.test(m))) return fail(400, 'Nome de modelo inválido (ex.: claude-sonnet-4-5).'); next.model = m }
  if ('suggested_prompts' in body) {
    const sp = body.suggested_prompts
    if (!Array.isArray(sp) || sp.length > 8 || sp.some((x: any) => typeof x !== 'string' || !x.trim() || x.trim().length > 200)) return fail(400, 'Perguntas sugeridas: até 8, cada uma com até 200 caracteres.')
    next.suggested_prompts = sp.map((x: string) => x.trim())
  }
  const { error } = await admin.from('sales_ops_ai_settings').upsert({ id: SETTINGS_ID, ...next, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return dbErr(error)
  if (next.general_prompt !== cur.general_prompt) {
    if (cur.general_prompt.trim()) {                                                       // 1ª edição de um prompt que já tinha texto: guarda o texto de antes como linha de base (senão não dá pra voltar a ele)
      const { data: any1 } = await admin.from('sales_ops_revisions').select('id').eq('kind', 'prompt').is('ref_id', null).limit(1)
      if (!((any1 ?? []) as any[]).length) await addRevision(admin, { kind: 'prompt', ref_id: null, action: 'create', title: 'Prompt geral (antes da 1ª edição)', snapshot: { general_prompt: cur.general_prompt }, changed_by: null })
    }
    await addRevision(admin, { kind: 'prompt', ref_id: null, action: 'update', title: 'Prompt geral', snapshot: { general_prompt: next.general_prompt }, changed_by: userId })
  }
  try { return ok({ settings: next, stats: promptStats(next, await loadKnowledge(admin)) }) } catch (e) { return dbErr(e) }
}

// ════════════════════════ BASE DE PROCESSOS ════════════════════════
function validateLinks(raw: any): { ok: true; value: KnowledgeLink[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: [] }
  if (!Array.isArray(raw) || raw.length > 20) return { ok: false, error: 'Links: até 20 por processo.' }
  const out: KnowledgeLink[] = []
  for (const l of raw) {
    const label = String(l?.label ?? '').trim(), url = String(l?.url ?? '').trim()
    if (!label || label.length > 120) return { ok: false, error: 'Cada link precisa de um nome (até 120 caracteres).' }
    const safe = safeHref(url)
    if (!safe || safe.startsWith('#')) return { ok: false, error: `Link inválido: "${url.slice(0, 60)}". Use http(s)://, mailto: ou um caminho interno começando com /.` }
    out.push({ label, url: safe })
  }
  return { ok: true, value: out }
}
function validateKnowledge(body: any, partial: boolean): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Corpo inválido.' }
  const v: Record<string, unknown> = {}
  if (!partial || 'title' in body) { const t = String(body.title ?? '').replace(/\s+/g, ' ').trim(); if (!t) return { ok: false, error: 'Dê um título ao processo.' }; if (t.length > 160) return { ok: false, error: 'O título pode ter no máximo 160 caracteres.' }; v.title = t }
  if (!partial || 'category' in body) { const c = String(body.category ?? '').replace(/\s+/g, ' ').trim() || 'Geral'; if (c.length > 60) return { ok: false, error: 'A categoria pode ter no máximo 60 caracteres.' }; v.category = c }
  if (!partial || 'content' in body) { const c = body.content === undefined ? '' : body.content; if (typeof c !== 'string') return { ok: false, error: 'O conteúdo deve ser texto.' }; if (c.length > 40_000) return { ok: false, error: 'O conteúdo passou de 40.000 caracteres: divida em dois processos.' }; v.content = c }
  if (!partial || 'links' in body) { const l = validateLinks(body.links); if (!l.ok) return l; v.links = l.value }
  if ('is_active' in body) { if (typeof body.is_active !== 'boolean') return { ok: false, error: 'is_active deve ser verdadeiro ou falso.' }; v.is_active = body.is_active }
  return { ok: true, value: v }
}
const KB_COLS = 'id, title, category, content, links, is_active, created_at, updated_at, updated_by'
const snap = (e: any) => ({ title: e.title, category: e.category, content: e.content, links: e.links ?? [], is_active: e.is_active })

export async function hListKnowledge(admin: any): Promise<HResult> {
  const { data, error } = await admin.from('sales_ops_knowledge').select(KB_COLS).order('title', { ascending: true }).limit(1000)
  if (error) return dbErr(error)
  const entries = ((data ?? []) as any[]).map(e => ({ ...e, links: Array.isArray(e.links) ? e.links : [] }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'pt-BR'))      // ordem A→Z igual em qualquer banco (a collation do SQL varia). A "categoria" saiu da tela: a coluna segue no banco só por compatibilidade
  return ok({ entries })
}
export async function hCreateKnowledge(admin: any, userId: string, body: any): Promise<HResult> {
  const v = validateKnowledge(body, false); if (!v.ok) return fail(400, v.error)
  const { data, error } = await admin.from('sales_ops_knowledge').insert({ is_active: true, ...v.value, created_by: userId, updated_by: userId }).select(KB_COLS).single()
  if (error) return dbErr(error)
  await addRevision(admin, { kind: 'knowledge', ref_id: data.id, action: 'create', title: data.title, snapshot: snap(data), changed_by: userId })
  return ok({ entry: data }, 201)
}
export async function hUpdateKnowledge(admin: any, userId: string, id: string, body: any): Promise<HResult> {
  if (!UUID.test(String(id ?? ''))) return fail(404, 'Processo não encontrado.')
  const v = validateKnowledge(body, true); if (!v.ok) return fail(400, v.error)
  if (Object.keys(v.value).length === 0) return fail(400, 'Nada para alterar.')
  const { data: cur } = await admin.from('sales_ops_knowledge').select(KB_COLS).eq('id', id).maybeSingle()
  if (!cur) return fail(404, 'Processo não encontrado.')
  const { data, error } = await admin.from('sales_ops_knowledge').update({ ...v.value, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id).select(KB_COLS).single()
  if (error) return dbErr(error)
  const changed = JSON.stringify(snap(cur)) !== JSON.stringify(snap(data))
  if (changed) await addRevision(admin, { kind: 'knowledge', ref_id: id, action: 'update', title: data.title, snapshot: snap(data), changed_by: userId })
  return ok({ entry: data })
}
export async function hDeleteKnowledge(admin: any, userId: string, id: string): Promise<HResult> {
  if (!UUID.test(String(id ?? ''))) return fail(404, 'Processo não encontrado.')
  const { data: cur } = await admin.from('sales_ops_knowledge').select(KB_COLS).eq('id', id).maybeSingle()
  if (!cur) return fail(404, 'Processo não encontrado.')
  await addRevision(admin, { kind: 'knowledge', ref_id: id, action: 'delete', title: cur.title, snapshot: snap(cur), changed_by: userId })      // a versão fica guardada: dá pra restaurar
  const { error } = await admin.from('sales_ops_knowledge').delete().eq('id', id)
  if (error) return dbErr(error)
  return ok({ ok: true })
}

// ════════════════════════ VERSÕES ════════════════════════
async function addRevision(admin: any, r: { kind: 'prompt' | 'knowledge'; ref_id: string | null; action: string; title: string; snapshot: any; changed_by: string | null }) {
  const { error } = await admin.from('sales_ops_revisions').insert(r)
  if (error) console.error('[salesops] erro ao guardar versão:', error.message)
}
export async function hListRevisions(admin: any, p: { kind?: string; refId?: string | null }): Promise<HResult> {
  if (p.kind !== 'prompt' && p.kind !== 'knowledge') return fail(400, 'kind deve ser prompt ou knowledge.')
  if (p.kind === 'knowledge' && p.refId === 'deleted') {                                   // "excluídos recentemente": a última exclusão de cada processo que não existe mais
    const { data, error } = await admin.from('sales_ops_revisions').select('id, kind, ref_id, action, title, snapshot, changed_by, created_at').eq('kind', 'knowledge').eq('action', 'delete').order('created_at', { ascending: false }).limit(50)
    if (error) return dbErr(error)
    const rows = (data ?? []) as any[], refs = [...new Set(rows.map(r => r.ref_id))]
    const { data: alive } = refs.length ? await admin.from('sales_ops_knowledge').select('id').in('id', refs) : { data: [] }
    const exist = new Set(((alive ?? []) as any[]).map(a => a.id)), seen = new Set<string>()
    const gone = rows.filter(r => { if (exist.has(r.ref_id) || seen.has(r.ref_id)) return false; seen.add(r.ref_id); return true })
    return ok({ revisions: gone })
  }
  if (p.kind === 'knowledge' && !UUID.test(String(p.refId ?? ''))) return fail(400, 'Informe o processo (ref).')
  let q = admin.from('sales_ops_revisions').select('id, kind, ref_id, action, title, snapshot, changed_by, created_at').eq('kind', p.kind)
  q = p.kind === 'prompt' ? q.is('ref_id', null) : q.eq('ref_id', p.refId)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(30)
  if (error) return dbErr(error)
  const rows = (data ?? []) as any[], ids = [...new Set(rows.map(r => r.changed_by).filter(Boolean))]
  const names = new Map<string, string>()
  if (ids.length) { const { data: pr } = await admin.from('profiles').select('id, name').in('id', ids); for (const x of (pr ?? []) as any[]) names.set(x.id, x.name) }
  return ok({ revisions: rows.map(r => ({ ...r, changed_by_name: names.get(r.changed_by) ?? null })) })
}
export async function hRestoreRevision(admin: any, userId: string, id: string): Promise<HResult> {
  if (!UUID.test(String(id ?? ''))) return fail(404, 'Versão não encontrada.')
  const { data: rev } = await admin.from('sales_ops_revisions').select('id, kind, ref_id, snapshot, title').eq('id', id).maybeSingle()
  if (!rev) return fail(404, 'Versão não encontrada.')
  if (rev.kind === 'prompt') {
    const text = String(rev.snapshot?.general_prompt ?? '')
    const { error } = await admin.from('sales_ops_ai_settings').upsert({ id: SETTINGS_ID, general_prompt: text, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) return dbErr(error)
    await addRevision(admin, { kind: 'prompt', ref_id: null, action: 'restore', title: 'Prompt geral', snapshot: { general_prompt: text }, changed_by: userId })
    return ok({ ok: true, kind: 'prompt', general_prompt: text })
  }
  const s = rev.snapshot ?? {}, row = { title: s.title, category: s.category, content: s.content, links: Array.isArray(s.links) ? s.links : [], is_active: s.is_active !== false, updated_by: userId, updated_at: new Date().toISOString() }
  const { data: exists } = await admin.from('sales_ops_knowledge').select('id').eq('id', rev.ref_id).maybeSingle()
  const q = exists ? admin.from('sales_ops_knowledge').update(row).eq('id', rev.ref_id) : admin.from('sales_ops_knowledge').insert({ id: rev.ref_id, ...row, created_by: userId })
  const { data, error } = await q.select(KB_COLS).single()
  if (error) return dbErr(error)
  await addRevision(admin, { kind: 'knowledge', ref_id: rev.ref_id, action: 'restore', title: data.title, snapshot: snap(data), changed_by: userId })
  return ok({ ok: true, kind: 'knowledge', entry: data })
}

// ════════════════════════ LACUNAS (o que a IA não soube responder) ════════════════════════
export async function hGaps(admin: any): Promise<HResult> {
  const { data, error } = await admin.from('sales_ops_messages').select('id, conversation_id, user_id, content, feedback, feedback_note, is_gap, created_at')
    .eq('role', 'assistant').eq('gap_resolved', false).or('is_gap.eq.true,feedback.eq.-1').order('created_at', { ascending: false }).limit(30)
  if (error) return dbErr(error)
  const msgs = (data ?? []) as any[]
  if (msgs.length === 0) return ok({ gaps: [] })
  const convIds = [...new Set(msgs.map(m => m.conversation_id))], userIds = [...new Set(msgs.map(m => m.user_id))]
  const [qs, pr] = await Promise.all([
    admin.from('sales_ops_messages').select('conversation_id, content, created_at').eq('role', 'user').in('conversation_id', convIds).order('created_at', { ascending: true }).limit(2000),
    admin.from('profiles').select('id, name').in('id', userIds),
  ])
  const users = new Map<string, string>(((pr.data ?? []) as any[]).map(p => [p.id, String(p.name ?? '').split(' ')[0]]))
  const gaps = msgs.map(m => {
    const prev = ((qs.data ?? []) as any[]).filter(q => q.conversation_id === m.conversation_id && String(q.created_at) <= String(m.created_at)).pop()
    return { messageId: m.id, kind: m.feedback === -1 ? 'down' : 'gap', isGap: !!m.is_gap, question: prev?.content ?? '(pergunta não encontrada)', answer: plainText(m.content).slice(0, 220), note: m.feedback_note ?? null, askedBy: users.get(m.user_id) ?? null, createdAt: m.created_at }
  })
  return ok({ gaps })
}
/** O time já cuidou dessa lacuna (documentou ou descartou): sai da lista. */
export async function hResolveGap(admin: any, messageId: string, resolved: boolean): Promise<HResult> {
  if (!UUID.test(String(messageId ?? ''))) return fail(404, 'Mensagem não encontrada.')
  const { data: m } = await admin.from('sales_ops_messages').select('id, role').eq('id', messageId).maybeSingle()
  if (!m || m.role !== 'assistant') return fail(404, 'Mensagem não encontrada.')
  const { error } = await admin.from('sales_ops_messages').update({ gap_resolved: resolved !== false }).eq('id', messageId)
  if (error) return dbErr(error)
  return ok({ ok: true })
}

// ════════════════════════ PRÉVIA DO PROMPT ════════════════════════
export async function hPromptPreview(admin: any, userId: string): Promise<HResult> {
  try {
    const [settings, knowledge, prof] = await Promise.all([loadSettings(admin), loadKnowledge(admin), admin.from('profiles').select('name').eq('id', userId).maybeSingle()])
    const blocks = buildSystemBlocks({ userName: prof.data?.name ?? 'Superadmin', settings, knowledge, now: new Date() })
    return ok({ text: blocks.map(b => b.text).join('\n\n— — —\n\n'), stats: promptStats(settings, knowledge) })
  } catch (e) { return dbErr(e) }
}

// ════════════════════════ CHAT (streaming) ════════════════════════
export interface ChatDeps { fetch?: typeof fetch; apiKey?: string | undefined; now?: () => Date; flushMs?: number }
export type ChatResult = HResult | { status: 200; stream: ReadableStream<Uint8Array> }

function apiErrorMessage(status: number, text: string): { status: number; message: string } {
  if (status === 401 || status === 403) return { status: 502, message: 'A chave da IA foi recusada pela Anthropic. Confira a ANTHROPIC_API_KEY.' }
  if (status === 429) return { status: 429, message: 'Limite de uso da IA atingido. Tente de novo em instantes.' }
  if (status === 400 && /too long|context|maximum/i.test(text)) return { status: 413, message: 'A base de conhecimento ficou grande demais para uma conversa. Desative processos antigos ou enxugue o prompt geral em Configuração.' }
  if (status === 529 || status >= 500) return { status: 503, message: 'A IA está sobrecarregada no momento. Tente de novo em instantes.' }
  return { status: 502, message: 'Não consegui obter a resposta da IA agora.' }
}

export async function hChat(admin: any, userId: string, body: any, deps: ChatDeps = {}): Promise<ChatResult> {
  const apiKey = 'apiKey' in deps ? deps.apiKey : process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fail(503, 'A chave da IA (ANTHROPIC_API_KEY) não está configurada no servidor.')
  const regenerate = body?.regenerate === true
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!regenerate && !message) return fail(400, 'Escreva uma mensagem.')
  if (message.length > MAX_MESSAGE_CHARS) return fail(400, `A mensagem passou de ${MAX_MESSAGE_CHARS} caracteres.`)
  const now = deps.now ?? (() => new Date())

  // 1) a conversa (do próprio usuário) — ou uma nova
  let conv: any = null, isNew = false
  if (body?.conversationId) {
    conv = await ownConversation(admin, userId, body.conversationId)
    if (!conv) return fail(404, 'Conversa não encontrada.')
  } else {
    if (regenerate) return fail(400, 'Não há o que regenerar.')
    const { data, error } = await admin.from('sales_ops_conversations').insert({ user_id: userId, title: deriveTitle(message) }).select(CONV_COLS).single()
    if (error) return dbErr(error)
    conv = data; isNew = true
  }

  // 2) a pergunta: nova mensagem — ou, em "regenerar", descarta a última resposta e refaz a última pergunta
  let userMessageId: string | null = null
  if (regenerate) {
    const { data: last } = await admin.from('sales_ops_messages').select('id, role').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1)
    const l = (last ?? [])[0]
    if (l?.role === 'assistant') await admin.from('sales_ops_messages').delete().eq('id', l.id).eq('user_id', userId)
    const { data: lastUser } = await admin.from('sales_ops_messages').select('id').eq('conversation_id', conv.id).eq('role', 'user').order('created_at', { ascending: false }).limit(1)
    if (!(lastUser ?? [])[0]) return fail(400, 'Não há o que regenerar.')
    userMessageId = lastUser[0].id
  } else {
    const { data, error } = await admin.from('sales_ops_messages').insert({ conversation_id: conv.id, user_id: userId, role: 'user', content: message }).select('id').single()
    if (error) return dbErr(error)
    userMessageId = data.id
  }
  await admin.from('sales_ops_conversations').update({ updated_at: now().toISOString() }).eq('id', conv.id).eq('user_id', userId)
  const ids = { conversationId: conv.id, userMessageId }

  // 3) o contexto
  let settings: SalesOpsSettings, knowledge: KnowledgeEntry[], prof: any, hist: any
  try {
    ;[settings, knowledge, prof, hist] = await Promise.all([
      loadSettings(admin), loadKnowledge(admin, true), admin.from('profiles').select('name').eq('id', userId).maybeSingle(),
      admin.from('sales_ops_messages').select('role, content, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(40),
    ])
  } catch (e: any) { return fail(500, `Não consegui carregar a configuração da IA agora (${e?.message ?? e}). Tente de novo.`, ids) }       // sem o prompt e a base do time a IA responderia errado: melhor falhar
  const history = sliceHistory(((hist.data ?? []) as any[]).slice().reverse())
  if (history.length === 0 || history[history.length - 1].role !== 'user') return fail(500, 'Não consegui montar o histórico da conversa.', ids)
  const model = settings.model || process.env.SALES_OPS_AI_MODEL || DEFAULT_MODEL
  const system = buildSystemBlocks({ userName: prof.data?.name ?? '', settings, knowledge, now: now() })

  // 4) chama a IA (antes de abrir o stream, pra devolver erro de verdade se ela recusar)
  const ac = new AbortController()
  let res: Response
  try {
    res = await (deps.fetch ?? fetch)('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: settings.max_tokens, system, messages: history, stream: true }),
    })
  } catch (e: any) { return fail(502, 'Não consegui falar com a IA agora. Tente de novo.', ids) }
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    const m = apiErrorMessage(res.status, txt)
    console.error('[salesops] Anthropic', res.status, txt.slice(0, 300))
    return fail(m.status, m.message, ids)
  }

  // 5) o "esboço" da resposta fica salvo desde o começo e é atualizado enquanto chega: se o usuário parar ou a conexão cair, o que já veio não se perde
  const { data: draft, error: dErr } = await admin.from('sales_ops_messages').insert({ conversation_id: conv.id, user_id: userId, role: 'assistant', content: '', incomplete: true, model }).select('id').single()
  if (dErr) { ac.abort(); return dbErr(dErr) }
  const enc = new TextEncoder(), flushMs = deps.flushMs ?? 1500
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')) } catch { /* o cliente já saiu */ } }
      send({ t: 'start', ...ids, assistantMessageId: draft.id, title: conv.title, isNew })
      let acc = '', lastFlush = Date.now(), tokensIn = 0, tokensOut = 0, stop: string | null = null, failed: string | null = null
      try {
        for await (const ev of parseAnthropicStream(res.body!)) {
          if (ev.type === 'text') {
            acc += ev.text; send({ t: 'delta', text: ev.text })
            if (Date.now() - lastFlush >= flushMs) { lastFlush = Date.now(); await admin.from('sales_ops_messages').update({ content: acc }).eq('id', draft.id) }
          } else if (ev.type === 'done') { stop = ev.stopReason; tokensIn = ev.tokensIn; tokensOut = ev.tokensOut }
          else failed = ev.message
        }
      } catch (e: any) { failed = e?.name === 'AbortError' ? 'Resposta interrompida.' : (e?.message ?? 'Erro ao ler a resposta da IA.') }
      try {
        if (!acc.trim()) {                                                         // nada chegou: tira o esboço vazio
          await admin.from('sales_ops_messages').delete().eq('id', draft.id)
          send({ t: 'error', message: failed ?? 'A IA não devolveu resposta.' })
        } else {
          const cut = !!failed || stop === 'max_tokens'
          await admin.from('sales_ops_messages').update({ content: acc, incomplete: cut, is_gap: !cut && isGapAnswer(acc), tokens_in: tokensIn || null, tokens_out: tokensOut || null }).eq('id', draft.id)
          await admin.from('sales_ops_conversations').update({ updated_at: now().toISOString() }).eq('id', conv.id).eq('user_id', userId)
          if (failed) send({ t: 'error', message: failed, messageId: draft.id, partial: true })
          else send({ t: 'done', messageId: draft.id, isGap: isGapAnswer(acc), truncated: stop === 'max_tokens' })
        }
      } finally { try { controller.close() } catch { /* já fechado */ } }
    },
    cancel() { ac.abort() },                                                       // o usuário clicou em "Parar": cancela a IA (o que já veio fica salvo, marcado como interrompido)
  })
  return { status: 200, stream }
}
