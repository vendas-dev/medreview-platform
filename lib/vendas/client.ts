// ══ Vendas — chamadas à API pelas telas (um lugar só para rede, erro e "falta migração") ═══════
export interface ApiResp<T> { ok: boolean; status: number; data: T | null; error?: string; errors?: Record<string, string>; migracao?: boolean }

export async function api<T = any>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResp<T>> {
  try {
    const r = await fetch(url, { method: init?.method ?? 'GET', headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined, cache: 'no-store' })
    let j: any = null; try { j = await r.json() } catch { /* corpo vazio */ }
    if (r.ok) return { ok: true, status: r.status, data: j as T }
    return { ok: false, status: r.status, data: null, error: j?.error || (r.status === 401 ? 'Sessão expirada. Entre novamente.' : 'Não foi possível concluir. Tente de novo.'), errors: j?.errors, migracao: !!j?.migracao }
  } catch {
    return { ok: false, status: 0, data: null, error: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' }
  }
}
export function qs(o: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v))
  const s = p.toString(); return s ? `?${s}` : ''
}
