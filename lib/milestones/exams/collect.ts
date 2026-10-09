import { ExamSource, VerifiedItem, RunStatus, ExamMilestoneRow } from './types'
import { htmlToText, extractLinks, PageLink } from './htmlText'
import { fetchRobots, isAllowedByRobots, BOT_UA, RobotsResult } from './robots'
import { normText, verifyBatch, REASON_LABEL, RejectReason } from './verify'
import type { ExtractInput, ExtractOutput } from './extract'
import { addDays } from './dates'

export interface CollectDeps {
  fetchImpl: typeof fetch
  extract: (i: ExtractInput) => Promise<ExtractOutput>
  pdfToText: (buf: ArrayBuffer) => Promise<string>
  today: string                                   // YYYY-MM-DD em São Paulo
}

class ReadError extends Error {
  constructor(public type: 'blocked' | 'robots_unreachable' | 'http' | 'too_large' | 'network' | 'pdf', msg: string) { super(msg) }
}

// ── links ────────────────────────────────────────────────────────────────
/** Link de visualização do Google Drive → link de download direto (CBO publica editais pelo Drive). */
export function driveDirectUrl(u: string): string | null {
  try {
    const x = new URL(u)
    if (x.hostname !== 'drive.google.com') return null
    const m = x.pathname.match(/\/file\/d\/([^/]+)/)
    const id = m?.[1] ?? x.searchParams.get('id')
    return id ? `https://drive.google.com/uc?export=download&id=${id}` : null
  } catch { return null }
}

const uploadStamp = (href: string): number => { const m = href.match(/\/uploads\/(\d{4})\/(\d{2})\//); return m ? +m[1] * 100 + +m[2] : 0 }

/** Quais links da página também devem ser lidos (editais, erratas…): filtra por regex e prioriza os mais recentes. */
export function pickLinks(links: PageLink[], s: Pick<ExamSource, 'follow_pattern' | 'exclude_pattern' | 'follow_max' | 'url'>): PageLink[] {
  if (!s.follow_pattern || s.follow_max <= 0) return []
  let re: RegExp, ex: RegExp | null = null
  try { re = new RegExp(s.follow_pattern, 'i'); if (s.exclude_pattern) ex = new RegExp(s.exclude_pattern, 'i') } catch { return [] }
  const seen = new Set<string>()
  const cands = links.map((l, idx) => ({ l, idx })).filter(({ l }) => {
    if (l.href === s.url) return false
    const hay = `${l.text} ${decodeURIComponent(l.href).replace(/[_-]+/g, ' ')}`
    if (!re.test(hay) || (ex && ex.test(hay))) return false
    const k = driveDirectUrl(l.href) ?? l.href
    if (seen.has(k)) return false
    seen.add(k); return true
  })
  cands.sort((a, b) => (uploadStamp(b.l.href) - uploadStamp(a.l.href)) || (a.idx - b.idx))
  return cands.slice(0, s.follow_max).map(c => c.l)
}

// ── leitura de um documento (HTML ou PDF), respeitando o robots.txt ─────────
interface Doc { url: string; text: string; links: PageLink[]; pdf: boolean }

async function readDoc(url: string, deps: CollectDeps, robots: Map<string, Promise<RobotsResult>>): Promise<Doc> {
  const target = driveDirectUrl(url) ?? url
  const u = new URL(target)
  let rp = robots.get(u.origin)
  if (!rp) { rp = fetchRobots(u.origin, deps.fetchImpl); robots.set(u.origin, rp) }
  const r = await rp
  if (r.kind === 'unreachable') throw new ReadError('robots_unreachable', `${u.host}: ${r.detail}`)
  if (r.kind === 'rules' && !isAllowedByRobots(r.rules, u.pathname + u.search)) throw new ReadError('blocked', `${u.host} bloqueia leitura automática (robots.txt)`)

  let res: Response
  try {
    res = await deps.fetchImpl(target, { headers: { 'User-Agent': BOT_UA, Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5', 'Accept-Language': 'pt-BR,pt;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
  } catch (e: any) { throw new ReadError('network', `${u.host}: ${e?.message ?? 'falha de rede'}`) }
  if (!res.ok) throw new ReadError('http', `${u.host} respondeu ${res.status}`)

  const buf = await res.arrayBuffer()
  if (buf.byteLength > 15 * 1024 * 1024) throw new ReadError('too_large', `${u.host}: arquivo grande demais (${Math.round(buf.byteLength / 1048576)} MB)`)
  const ct = (res.headers.get('content-type') ?? '').toLowerCase()
  const isPdf = ct.includes('pdf') || new TextDecoder('latin1').decode(buf.slice(0, 5)).startsWith('%PDF')

  if (isPdf) {
    try { return { url, text: await deps.pdfToText(buf), links: [], pdf: true } }
    catch (e: any) { throw new ReadError('pdf', `${u.host}: ${e?.message ?? 'não consegui ler o PDF'}`) }
  }
  if (u.hostname === 'drive.google.com') throw new ReadError('pdf', 'o Google Drive não entregou o arquivo (link privado ou pede confirmação)')
  const charset = ct.match(/charset=([\w-]+)/)?.[1] ?? 'utf-8'
  let html: string
  try { html = new TextDecoder(charset).decode(buf) } catch { html = new TextDecoder('utf-8').decode(buf) }
  return { url, text: htmlToText(html), links: extractLinks(html, res.url || target), pdf: false }
}

const fmtBR = (iso: string) => iso.split('-').reverse().join('/')
const fmtR = (a: string, b: string | null) => (b && b !== a ? `${fmtBR(a)} a ${fmtBR(b)}` : fmtBR(a))
const shortDoc = (u: string) => { try { const x = new URL(u); return x.hostname === 'drive.google.com' ? `Drive ${new URL(u).searchParams.get('id')?.slice(0, 6) ?? ''}` : decodeURIComponent(x.pathname.split('/').pop() || x.hostname) } catch { return u.slice(0, 40) } }

// ── uma fonte ────────────────────────────────────────────────────────────
export interface SourceResult {
  source: ExamSource; status: RunStatus; items: VerifiedItem[]; message: string; durationMs: number
  docs: { url: string; chars: number; extracted: number; verified: number }[]
  rejected: Partial<Record<RejectReason, number>>
}

export async function runSource(source: ExamSource, deps: CollectDeps, robots: Map<string, Promise<RobotsResult>> = new Map()): Promise<SourceResult> {
  const t0 = Date.now()
  const docsInfo: SourceResult['docs'] = []
  const rejected: SourceResult['rejected'] = {}
  const fin = (status: RunStatus, message: string, items: VerifiedItem[] = []): SourceResult =>
    ({ source, status, items, message, durationMs: Date.now() - t0, docs: docsInfo, rejected })

  let page: Doc
  try { page = await readDoc(source.url, deps, robots) }
  catch (e: any) { return fin(e instanceof ReadError && e.type === 'blocked' ? 'blocked_robots' : 'fetch_error', e?.message ?? 'falha ao abrir a página') }

  const toRead: { url: string; text: string }[] = [{ url: source.url, text: page.text }]
  const notes: string[] = []
  for (const l of pickLinks(page.links, source)) {
    try {
      const d = await readDoc(l.href, deps, robots)
      // página de "documento" que só aponta pro PDF: segue mais um passo
      if (!d.pdf && d.text.length < 1500) {
        const pdfLink = d.links.find(x => /\.pdf(\?|$)/i.test(x.href))
        if (pdfLink) { try { const p = await readDoc(pdfLink.href, deps, robots); toRead.push({ url: p.url, text: p.text }); continue } catch (e: any) { notes.push(`${l.text || l.href}: ${e.message}`); continue } }
      }
      toRead.push({ url: l.href, text: d.text })
    } catch (e: any) { notes.push(`${l.text || l.href}: ${e?.message ?? 'erro'}`) }
  }

  const byKey = new Map<string, VerifiedItem>()
  const conflicts: string[] = []
  let tried = 0, aiErrors = 0
  const aiMsgs: string[] = []
  for (const doc of toRead) {
    if (doc.text.trim().length < 80) { docsInfo.push({ url: doc.url, chars: doc.text.length, extracted: 0, verified: 0 }); continue }
    tried++
    let out: ExtractOutput
    try { out = await deps.extract({ society: source.society, labels: source.exam_labels, docUrl: doc.url, docText: doc.text, today: deps.today }) }
    catch (e: any) { aiErrors++; aiMsgs.push(e?.message ?? 'erro'); docsInfo.push({ url: doc.url, chars: doc.text.length, extracted: 0, verified: 0 }); continue }
    const b = verifyBatch(out.items, { docNorm: normText(doc.text), source, sourceUrl: doc.url, today: deps.today })
    for (const r of b.rejected) rejected[r.reason] = (rejected[r.reason] ?? 0) + 1
    // documentos já vêm do mais novo pro mais antigo: o primeiro que traz a data é o que vale (errata vence edital).
    // Se um documento mais antigo discorda, NÃO escolhe em silêncio: registra a divergência no diagnóstico.
    for (const v of b.verified) {
      const prev = byKey.get(v.dedupe_key)
      if (!prev) { byKey.set(v.dedupe_key, v); continue }
      if (prev.starts_on !== v.starts_on || (prev.ends_on ?? null) !== (v.ends_on ?? null))
        conflicts.push(`${v.exam_label}/${v.phase}: vale ${fmtR(prev.starts_on, prev.ends_on)} (${shortDoc(prev.source_url)}) — outro documento diz ${fmtR(v.starts_on, v.ends_on)} (${shortDoc(v.source_url)})`)
    }
    docsInfo.push({ url: doc.url, chars: doc.text.length, extracted: out.items.length, verified: b.verified.length })
  }

  const items = [...byKey.values()]
  const nDocs = toRead.length
  const rej = Object.entries(rejected).map(([k, n]) => `${n}× ${REASON_LABEL[k as RejectReason]}`)
  const tail = [rej.length ? `Descartadas pela verificação: ${rej.join(', ')}.` : '', conflicts.length ? `⚠ Divergência entre documentos: ${conflicts.slice(0, 2).join(' | ')}.` : '', notes.length ? `Não consegui abrir: ${notes.slice(0, 3).join(' · ')}.` : ''].filter(Boolean).join(' ')

  if (tried > 0 && aiErrors === tried) return fin('extract_error', `A IA não respondeu (${aiMsgs[0]}). ${tail}`.trim())
  if (items.length > 0) return fin('ok', `${items.length} data(s) confirmada(s) em ${nDocs} documento(s). ${tail}`.trim(), items)
  return fin('no_data', `Leu ${nDocs} documento(s): nenhuma data futura de prova publicada. ${tail}`.trim())
}

// ── gravação: o que inserir / atualizar / aposentar ───────────────────────────
export interface UpsertPlan {
  inserts: Record<string, unknown>[]
  updates: { id: string; patch: Record<string, unknown> }[]
  staleIds: string[]
}

export function planUpserts(existing: ExamMilestoneRow[], verified: VerifiedItem[], nowIso: string, okSourceIds: Set<string>): UpsertPlan {
  const autos = new Map(existing.filter(e => e.origin === 'auto').map(e => [e.dedupe_key, e]))
  const plan: UpsertPlan = { inserts: [], updates: [], staleIds: [] }
  const seen = new Set<string>()
  for (const v of verified) {
    seen.add(v.dedupe_key)
    const ex = autos.get(v.dedupe_key)
    const base = { vertical: v.vertical, society: v.society, exam_label: v.exam_label, phase: v.phase, kind: v.kind, title: v.title, source_id: v.source_id, source_url: v.source_url, evidence: v.evidence }
    if (!ex) { plan.inserts.push({ ...base, dedupe_key: v.dedupe_key, starts_on: v.starts_on, ends_on: v.ends_on, origin: 'auto', status: 'active', first_seen_at: nowIso, last_seen_at: nowIso }); continue }
    const patch: Record<string, unknown> = { ...base, last_seen_at: nowIso, status: 'active' }
    if (ex.starts_on !== v.starts_on || (ex.ends_on ?? null) !== (v.ends_on ?? null)) {
      patch.previous_starts_on = ex.starts_on; patch.previous_ends_on = ex.ends_on; patch.changed_at = nowIso   // a data MUDOU (errata/retificação)
      patch.starts_on = v.starts_on; patch.ends_on = v.ends_on
    }
    plan.updates.push({ id: ex.id, patch })
  }
  // some da tela só quando a fonte foi lida com sucesso e a data deixou de aparecer há mais de 7 dias
  const cutoff = addDays(nowIso.slice(0, 10), -7)
  for (const ex of autos.values()) {
    if (seen.has(ex.dedupe_key) || ex.status !== 'active' || !ex.source_id || !okSourceIds.has(ex.source_id)) continue
    if (ex.last_seen_at.slice(0, 10) < cutoff) plan.staleIds.push(ex.id)
  }
  return plan
}

// ── orquestração: todas as fontes → fiscal → banco ──────────────────────────
export interface CheckSummary { results: SourceResult[]; inserted: number; updated: number; staled: number }

export async function runExamCheck(admin: any, deps: CollectDeps, opts: { sourceId?: string; now?: Date } = {}): Promise<CheckSummary> {
  const now = opts.now ?? new Date()
  let q = admin.from('exam_sources').select('*').eq('active', true).order('priority', { ascending: true })
  if (opts.sourceId) q = q.eq('id', opts.sourceId)
  const { data: sources, error } = await q
  if (error) throw new Error(`exam_sources: ${error.message}`)

  const robots = new Map<string, Promise<RobotsResult>>()
  const results = await Promise.all(((sources ?? []) as ExamSource[]).map(s => runSource(s, deps, robots)))

  for (const r of results) {
    await admin.from('exam_check_runs').insert({ source_id: r.source.id, status: r.status, items_found: r.items.length, message: r.message.slice(0, 900), duration_ms: r.durationMs })
  }

  // juntas, na ordem de prioridade das fontes; se duas trazem a mesma data, vale a da fonte mais prioritária
  const merged = new Map<string, VerifiedItem>()
  for (const r of [...results].sort((a, b) => a.source.priority - b.source.priority)) for (const v of r.items) if (!merged.has(v.dedupe_key)) merged.set(v.dedupe_key, v)

  const okIds = new Set(results.filter(r => r.status === 'ok' || r.status === 'no_data').map(r => r.source.id))
  const { data: existing } = await admin.from('exam_milestones').select('*').eq('origin', 'auto')
  const plan = planUpserts((existing ?? []) as ExamMilestoneRow[], [...merged.values()], now.toISOString(), okIds)

  if (plan.inserts.length) await admin.from('exam_milestones').insert(plan.inserts)
  for (const u of plan.updates) await admin.from('exam_milestones').update(u.patch).eq('id', u.id)
  if (plan.staleIds.length) await admin.from('exam_milestones').update({ status: 'stale' }).in('id', plan.staleIds)

  return { results, inserted: plan.inserts.length, updated: plan.updates.length, staled: plan.staleIds.length }
}
