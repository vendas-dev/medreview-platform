// ── Links de negócios PERDIDOS ─────────────────────────────────────────────────────────────
// O HubSpot avisa (webhook) quando um negócio vai pra etapa "Perdido". Aqui:
//  • marcamos os links NÃO PAGOS daquele deal_id com deal_lost_at → o forecast deixa de contá-los;
//  • guardamos cada aviso em deal_lost_events (auditoria);
//  • reconcileLost() faz o mesmo olhando direto no HubSpot — serve pro RETROATIVO e como rede de segurança
//    (webhook que não chegou).
// Link só VENCIDO (cupom expirado) NÃO é perdido: continua contando até chegar o aviso de Perdido.

// ── entrada do webhook ────────────────────────────────────────────────────────────────────
// Mesma regra de data da rota de links: sem fuso explícito = horário de São Paulo.
export function parsePtbrDate(val: string | null | undefined): string | null {
  if (!val) return null
  const v = String(val).trim()
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (br) { const [, d, mo, y, h, min, s = '00'] = br; const t = new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`); return isNaN(+t) ? null : t.toISOString() }
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?\s*$/)
  if (iso) { const [, y, mo, d, h, min, s = '00'] = iso; const t = new Date(`${y}-${mo}-${d}T${h}:${min}:${s}-03:00`); return isNaN(+t) ? null : t.toISOString() }
  if (/^\d{13}$/.test(v)) { const t = new Date(Number(v)); return isNaN(+t) ? null : t.toISOString() }          // HubSpot manda datas em epoch ms
  const t = new Date(v); return isNaN(+t) ? null : t.toISOString()
}

function normalizeKeys(raw: any): any {
  const r: any = {}
  if (!raw || typeof raw !== 'object') return r
  for (const k of Object.keys(raw)) r[k.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')] = raw[k]
  return r
}

export interface LostItem { dealId: string; lostAt: string; reason: string | null; stage: string | null; reopen: boolean }
const ID_RE = /^[A-Za-z0-9_-]{3,64}$/
const truthy = (v: any) => v === true || /^(true|1|sim|yes)$/i.test(String(v ?? '').trim())
const falsy  = (v: any) => v === false || /^(false|0|nao|não|no)$/i.test(String(v ?? '').trim())

/** Aceita um objeto ou uma lista. Aliases em PT-BR como na rota de links. Devolve os itens válidos e os rejeitados (com o motivo). */
export function parseLostBody(body: any, nowIso = new Date().toISOString()): { items: LostItem[]; rejected: { item: any; reason: string }[] } {
  const list: any[] = Array.isArray(body) ? body : [body]
  const items: LostItem[] = [], rejected: { item: any; reason: string }[] = []
  for (const raw of list) {
    const r = normalizeKeys(raw)
    const idRaw = r.deal_id ?? r.dealid ?? r.id_negocio ?? r.negocio_id ?? r.hs_object_id ?? r.objectid ?? r.id
    const dealId = idRaw == null ? '' : String(idRaw).trim()
    if (!ID_RE.test(dealId) || /^(null|undefined|nan)$/i.test(dealId)) { rejected.push({ item: raw, reason: 'deal_id ausente ou inválido' }); continue }
    let lostAt = parsePtbrDate(r.lost_at ?? r.perdido_em ?? r.data_perdido ?? r.closedate ?? r.data ?? null) ?? nowIso
    if (Date.parse(lostAt) > Date.parse(nowIso)) lostAt = nowIso                      // data no futuro não faz sentido
    const reopen = falsy(r.lost) || truthy(r.reopen) || /^(reopen|reabrir)$/i.test(String(r.action ?? r.acao ?? '').trim())
    items.push({ dealId, lostAt, reason: (r.reason ?? r.motivo ?? r.closed_lost_reason ?? null) ? String(r.reason ?? r.motivo ?? r.closed_lost_reason).slice(0, 300) : null, stage: (r.stage ?? r.etapa ?? r.stage_name ?? r.dealstage ?? null) ? String(r.stage ?? r.etapa ?? r.stage_name ?? r.dealstage).slice(0, 120) : null, reopen })
  }
  return { items, rejected }
}

// ── gravação ──────────────────────────────────────────────────────────────────────────────
export type LostStatus = 'marcado' | 'ja_perdido' | 'ja_pago' | 'sem_link' | 'reaberto' | 'nada_a_reabrir'
export interface LostResult { dealId: string; status: LostStatus; links: number }
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n))

/**
 * Marca como PERDIDOS os links ainda não pagos dos negócios. Só mexe em link que:
 *   não foi pago (converted_at nulo) · não foi substituído por um que pagou (superseded_by_link_id nulo) · ainda não está marcado.
 * Link gerado DEPOIS (negócio reaberto e novo link) nasce sem a marca e volta a contar.
 * Idempotente: o mesmo aviso de novo não muda nada. Cada aviso vai pro log (deal_lost_events).
 */
export async function markDealsLost(admin: any, items: LostItem[], source = 'webhook'): Promise<{ results: LostResult[]; logError: string | null }> {
  const byDeal = new Map<string, LostItem>()
  for (const it of items) { const cur = byDeal.get(it.dealId); if (!cur || (!it.reopen && cur.reopen) || (it.reopen === cur.reopen && it.lostAt > cur.lostAt)) byDeal.set(it.dealId, it) }
  const results: LostResult[] = [], logs: any[] = []
  for (const part of chunk([...byDeal.values()], 150)) {
    const toLose = part.filter(i => !i.reopen), toReopen = part.filter(i => i.reopen)
    if (toLose.length) {
      const ids = toLose.map(i => i.dealId)
      const { data: open, error } = await admin.from('geracoes_links').select('id, deal_id').in('deal_id', ids).is('converted_at', null).is('superseded_by_link_id', null).is('deal_lost_at', null)
      if (error) throw new Error(`links abertos: ${error.message}`)
      const rowsOf = new Map<string, string[]>()
      for (const r of (open ?? []) as any[]) { const k = String(r.deal_id); (rowsOf.get(k) ?? rowsOf.set(k, []).get(k)!).push(r.id) }
      const withRows = toLose.filter(i => rowsOf.has(i.dealId))
      for (const grp of chunk(withRows, 10)) await Promise.all(grp.map(async it => {
        const { data: upd, error: e2 } = await admin.from('geracoes_links').update({ deal_lost_at: it.lostAt, deal_lost_reason: it.reason ?? it.stage ?? null }).in('id', rowsOf.get(it.dealId)!).select('id')
        if (e2) throw new Error(`marcar perdido: ${e2.message}`)
        const n = (upd ?? []).length
        results.push({ dealId: it.dealId, status: 'marcado', links: n })
        logs.push({ deal_id: it.dealId, lost_at: it.lostAt, stage_name: it.stage, reason: it.reason, source, action: 'lost', links_updated: n })
      }))
      // os que não tinham link aberto: por quê? (sem link / já pago / já perdido)
      const rest = toLose.filter(i => !rowsOf.has(i.dealId))
      if (rest.length) {
        const { data: any_, error: e3 } = await admin.from('geracoes_links').select('id, deal_id, converted_at, superseded_by_link_id, deal_lost_at').in('deal_id', rest.map(i => i.dealId))
        if (e3) throw new Error(`classificar: ${e3.message}`)
        const rows = (any_ ?? []) as any[]
        for (const it of rest) {
          const mine = rows.filter(r => String(r.deal_id) === it.dealId)
          const status: LostStatus = mine.length === 0 ? 'sem_link' : mine.some(r => r.converted_at || r.superseded_by_link_id) ? 'ja_pago' : 'ja_perdido'
          results.push({ dealId: it.dealId, status, links: 0 })
          logs.push({ deal_id: it.dealId, lost_at: it.lostAt, stage_name: it.stage, reason: it.reason, source, action: 'lost', links_updated: 0, note: status })
        }
      }
    }
    for (const it of toReopen) {
      const { data: upd, error } = await admin.from('geracoes_links').update({ deal_lost_at: null, deal_lost_reason: null }).eq('deal_id', it.dealId).not('deal_lost_at', 'is', null).select('id')
      if (error) throw new Error(`reabrir: ${error.message}`)
      const n = (upd ?? []).length
      results.push({ dealId: it.dealId, status: n ? 'reaberto' : 'nada_a_reabrir', links: n })
      logs.push({ deal_id: it.dealId, lost_at: it.lostAt, stage_name: it.stage, reason: it.reason, source, action: 'reopen', links_updated: n })
    }
  }
  // o log é auditoria: se falhar, NÃO derruba a marcação (já feita) — só avisa
  let logError: string | null = null
  if (logs.length) { const { error } = await admin.from('deal_lost_events').insert(logs); if (error) logError = error.message }
  return { results, logError }
}

// ── retroativo / rede de segurança: pergunta pro HubSpot ─────────────────────────────────
const HS = 'https://api.hubapi.com'
type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; headers: { get(k: string): string | null }; json(): Promise<any>; text(): Promise<string> }>
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function hsCall(f: FetchLike, token: string, path: string, init: any = {}, sleeper = sleep): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await f(`${HS}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
    if (res.status === 429 || res.status >= 500) { await sleeper(Math.min(Number(res.headers.get('retry-after')) * 1000 || 800 * 2 ** attempt, 8000)); continue }
    if (res.status === 207) return res.json()                                             // batch parcial (alguns ids não existem)
    if (!res.ok) throw new Error(`HubSpot ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return res.json()
  }
  throw new Error('HubSpot: muitas tentativas (429/5xx)')
}

/** Ids das etapas "Perdido": as que se chamam perdido/lost, ou fechadas com probabilidade 0. HUBSPOT_LOST_STAGE_IDS (separado por vírgula) manda nelas. */
export async function hubspotLostStageIds(f: FetchLike, token: string, override: string | undefined = process.env.HUBSPOT_LOST_STAGE_IDS, sleeper = sleep): Promise<Set<string>> {
  if (override && override.trim()) return new Set(override.split(',').map(s => s.trim()).filter(Boolean))
  const data = await hsCall(f, token, '/crm/v3/pipelines/deals', {}, sleeper)
  const ids = new Set<string>()
  for (const p of (data?.results ?? [])) for (const s of (p.stages ?? [])) {
    const closed = String(s?.metadata?.isClosed) === 'true', prob = Number(s?.metadata?.probability)
    if (/perdid|lost/i.test(String(s.label ?? '')) || (closed && prob === 0)) ids.add(String(s.id))
  }
  return ids
}

export interface ReconcileOpts { fetch: FetchLike; token: string; days?: number; recheckHours?: number; maxMs?: number; dryRun?: boolean; now?: () => number; sleeper?: (ms: number) => Promise<void>; lostStageIds?: Set<string> }
export interface ReconcileResult { candidates: number; checked: number; lost: number; notFound: number; remaining: number; done: boolean; dryRun: boolean; lostDeals: string[]; errors: string[] }

/**
 * Confere no HubSpot (pelo deal_id) os negócios que ainda têm link não pago e marca os que estão em "Perdido".
 * 100 negócios por chamada. Anda por uma FILA: quem acabou de ser conferido (deal_lost_checked_at) só volta depois de `recheckHours`,
 * então cada execução continua de onde a anterior parou — rode de novo até `done: true`. Cabe no limite de tempo (maxMs).
 */
export async function reconcileLost(admin: any, o: ReconcileOpts): Promise<ReconcileResult> {
  const now = o.now ?? Date.now, t0 = now(), days = o.days ?? 90, recheckMs = (o.recheckHours ?? 6) * 3600e3, maxMs = o.maxMs ?? 45000
  const out: ReconcileResult = { candidates: 0, checked: 0, lost: 0, notFound: 0, remaining: 0, done: false, dryRun: !!o.dryRun, lostDeals: [], errors: [] }
  const sinceIso = new Date(now() - days * 86400e3).toISOString()
  // fila: negócios com link aberto (não pago, não substituído, não perdido), gerado na janela, ainda não conferidos há pouco
  const seen = new Map<string, number>()                                                   // deal_id → último check (ms; 0 = nunca)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('geracoes_links').select('deal_id, deal_lost_checked_at').not('deal_id', 'is', null).is('converted_at', null).is('superseded_by_link_id', null).is('deal_lost_at', null).gte('generated_at', sinceIso).order('id', { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`fila: ${error.message}`)
    for (const r of (data ?? []) as any[]) { const k = String(r.deal_id), c = r.deal_lost_checked_at ? Date.parse(r.deal_lost_checked_at) : 0; seen.set(k, Math.max(seen.get(k) ?? 0, c)) }
    if (!data || data.length < 1000) break
  }
  const queue = [...seen.entries()].filter(([, c]) => now() - c >= recheckMs).sort((a, b) => a[1] - b[1]).map(([k]) => k)
  out.candidates = queue.length
  const lostIds = o.lostStageIds ?? await hubspotLostStageIds(o.fetch, o.token, undefined, o.sleeper)
  if (lostIds.size === 0) { out.errors.push('nenhuma etapa "Perdido" encontrada no HubSpot (defina HUBSPOT_LOST_STAGE_IDS)'); out.remaining = queue.length; return out }
  let i = 0
  for (; i < queue.length; i += 100) {
    if (now() - t0 > maxMs) break
    const ids = queue.slice(i, i + 100)
    let data: any
    try { data = await hsCall(o.fetch, o.token, '/crm/v3/objects/deals/batch/read', { method: 'POST', body: JSON.stringify({ properties: ['dealstage', 'pipeline', 'closedate'], inputs: ids.map(id => ({ id })) }) }, o.sleeper) }
    catch (e: any) { out.errors.push(e.message); break }
    const found = new Map<string, any>((data?.results ?? []).map((d: any) => [String(d.id), d.properties ?? {}]))
    const lostNow: LostItem[] = []
    for (const id of ids) {
      const p = found.get(id)
      if (!p) { out.notFound++; continue }                                                // apagado/mesclado no HubSpot: só marca como conferido
      if (lostIds.has(String(p.dealstage))) {
        const cd = p.closedate ? parsePtbrDate(String(p.closedate)) : null, at = cd && Date.parse(cd) <= now() ? cd : new Date(now()).toISOString()
        lostNow.push({ dealId: id, lostAt: at, reason: 'retroativo (HubSpot)', stage: String(p.dealstage), reopen: false })
      }
    }
    out.checked += ids.length
    if (!o.dryRun) {
      if (lostNow.length) { const r = await markDealsLost(admin, lostNow, 'reconcile'); out.lost += r.results.filter(x => x.status === 'marcado').length; if (r.logError) out.errors.push(`log: ${r.logError}`) }
      const lostSet = new Set(lostNow.map(l => l.dealId)), stamp = new Date(now()).toISOString()
      const okIds = ids.filter(id => !lostSet.has(id))
      if (okIds.length) { const { error } = await admin.from('geracoes_links').update({ deal_lost_checked_at: stamp }).in('deal_id', okIds).is('deal_lost_at', null); if (error) out.errors.push(`checked_at: ${error.message}`) }
    } else { out.lost += lostNow.length }
    out.lostDeals.push(...lostNow.map(l => l.dealId))
  }
  out.remaining = Math.max(queue.length - i, 0)                                           // o que ficou pra próxima execução (tempo esgotado ou erro)
  out.done = out.remaining === 0 && out.errors.length === 0
  return out
}
