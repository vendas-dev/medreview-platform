// robots.txt — o sistema NUNCA lê uma página que o site pediu pra robôs não lerem.

export const BOT_UA = 'MedReviewExamMonitor/1.0 (consulta de editais publicos; uso interno)'
const BOT_TOKEN = 'medreviewexammonitor'

interface Rule { allow: boolean; path: string }
interface Group { agents: string[]; rules: Rule[] }
export interface RobotsRules { groups: Group[] }

export function parseRobots(txt: string): RobotsRules {
  const groups: Group[] = []
  let cur: Group | null = null
  let lastWasAgent = false
  for (const line0 of txt.split(/\r?\n/)) {
    const line = line0.replace(/#.*$/, '').trim()
    if (!line) continue
    const i = line.indexOf(':'); if (i < 0) continue
    const key = line.slice(0, i).trim().toLowerCase(), val = line.slice(i + 1).trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur) }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      lastWasAgent = false
      cur.rules.push({ allow: key === 'allow', path: val })
    } else lastWasAgent = false
  }
  return { groups }
}

function patternToRegex(p: string): RegExp {
  const anchored = p.endsWith('$')
  const body = (anchored ? p.slice(0, -1) : p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + body + (anchored ? '$' : ''))
}

export function isAllowedByRobots(rules: RobotsRules | null, pathWithQuery: string): boolean {
  if (!rules) return true
  const specific = rules.groups.filter(g => g.agents.some(a => a !== '*' && (a === BOT_TOKEN || BOT_TOKEN.startsWith(a) || a.startsWith(BOT_TOKEN))))
  const group = specific.length ? specific : rules.groups.filter(g => g.agents.includes('*'))
  if (group.length === 0) return true
  let best: { len: number; allow: boolean } | null = null
  for (const g of group) for (const r of g.rules) {
    if (r.path === '') continue                                  // "Disallow:" vazio = tudo liberado
    if (patternToRegex(r.path).test(pathWithQuery)) {
      const len = r.path.length
      if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow }
    }
  }
  return best ? best.allow : true
}

export type RobotsResult = { kind: 'rules'; rules: RobotsRules } | { kind: 'allow_all' } | { kind: 'unreachable'; detail: string }

export async function fetchRobots(origin: string, fetchImpl: typeof fetch): Promise<RobotsResult> {
  try {
    const res = await fetchImpl(`${origin}/robots.txt`, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(8000), redirect: 'follow' })
    if (res.status >= 500) return { kind: 'unreachable', detail: `robots.txt respondeu ${res.status}` }
    if (res.status >= 400) return { kind: 'allow_all' }          // sem robots.txt = sem restrição (RFC 9309)
    return { kind: 'rules', rules: parseRobots(await res.text()) }
  } catch (e: any) {
    return { kind: 'unreachable', detail: `não consegui ler o robots.txt (${e?.message ?? 'erro de rede'})` }
  }
}
