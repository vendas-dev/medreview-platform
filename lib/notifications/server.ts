// ══ Envio de notificações (servidor) ═══════════════════════════════════════════
export type NotificationKind = 'aviso' | 'campanha' | 'vitoria'
export interface NewNotification {
  title: string; body?: string | null; kind?: NotificationKind; link?: string | null
  campaign_id?: string | null; created_by?: string | null; recipients: string[]
  event_key?: string | null        // tipo do aviso de campanha (launch, start, win:personal:OAO:1…): é como a edição acha o aviso certo
}

/** Só aceita caminho interno ("/telao") ou link https. Qualquer outra coisa (javascript:, //site) vira null. */
export function sanitizeLink(link?: string | null): string | null {
  const l = (link ?? '').trim()
  if (!l) return null
  if (l.startsWith('/') && !l.startsWith('//') && !l.includes('\\')) return l.slice(0, 300)
  try { const u = new URL(l); return u.protocol === 'https:' ? u.toString().slice(0, 300) : null } catch { return null }
}

/** Cria a notificação e uma linha por destinatário (sem repetir pessoa). Devolve null se não há ninguém pra avisar. */
export async function sendNotification(admin: any, n: NewNotification): Promise<{ id: string; recipients: number } | null> {
  const ids = [...new Set((n.recipients ?? []).filter(Boolean))]
  if (ids.length === 0) return null
  const { data, error } = await admin.from('notifications').insert({
    title: n.title.trim().slice(0, 120), body: (n.body ?? '').trim().slice(0, 1000) || null, kind: n.kind ?? 'aviso',
    link: sanitizeLink(n.link), campaign_id: n.campaign_id ?? null, created_by: n.created_by ?? null, event_key: n.event_key ?? null,
  }).select().single()
  if (error || !data) throw new Error(`notifications: ${error?.message ?? 'falha ao criar'}`)
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map(user_id => ({ notification_id: data.id, user_id }))
    const { error: e2 } = await admin.from('notification_recipients').insert(chunk)
    if (e2) throw new Error(`notification_recipients: ${e2.message}`)
  }
  return { id: data.id, recipients: ids.length }
}
