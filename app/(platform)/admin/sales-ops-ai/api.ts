// Cliente do navegador: chamadas à API do Sales Ops AI e leitura do streaming do chat (uma linha JSON por evento).
const BASE = '/api/admin/sales-ops-ai'

export class ApiError extends Error {
  status: number; extra: Record<string, any>
  constructor(message: string, status: number, extra: Record<string, any> = {}) { super(message); this.status = status; this.extra = extra }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(`${BASE}${path}`, { ...rest, headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) }, body: json !== undefined ? JSON.stringify(json) : rest.body, cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.error ?? (res.status === 401 || res.status === 403 ? 'Sem permissão.' : 'Não consegui concluir agora. Tente de novo.'), res.status, data)
  return data as T
}

export type ChatEvent =
  | { t: 'start'; conversationId: string; userMessageId: string; assistantMessageId: string; title: string; isNew: boolean }
  | { t: 'delta'; text: string }
  | { t: 'done'; messageId: string; isGap: boolean; truncated: boolean }
  | { t: 'error'; message: string; messageId?: string; partial?: boolean }

/** Envia a pergunta e devolve os eventos do streaming. Se o servidor recusar antes de começar (erro HTTP), lança ApiError com os ids (a pergunta já ficou salva). */
export async function* streamChat(body: { conversationId?: string | null; message?: string; regenerate?: boolean }, signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${BASE}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, cache: 'no-store' })
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(data?.error ?? 'Não consegui obter a resposta agora. Tente de novo.', res.status, data)
  }
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
      if (line) { try { yield JSON.parse(line) as ChatEvent } catch { /* linha incompleta/ruído: ignora */ } }
    }
  }
  if (buf.trim()) { try { yield JSON.parse(buf) as ChatEvent } catch { /* ignora */ } }
}
