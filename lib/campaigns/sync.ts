import { sendNotification } from '@/lib/notifications/server'
import { cancelMessage, finishMessagesFrom, launchMessage, raceHitMessages, startMessage, TeamResult } from './engine'
import { loadParticipants, rowToDraft } from './server'
import { CampaignRow, Team, TEAMS } from './types'

// ══ Os avisos acompanham a campanha: atualizar (editar), refazer (mudou a regra) e apagar (excluir) ═══════
// O vínculo é notifications.campaign_id + notifications.event_key (o TIPO do aviso). Quem já leu continua tendo lido.

const byIds = (rows: any[], key = 'id') => rows.map(r => r[key])

/** Reescreve o texto dos avisos já enviados (e ajusta quem recebe lançamento/início). Não manda nada novo. */
export async function syncCampaignNotifications(admin: any, c: CampaignRow, now: Date = new Date()): Promise<{ updated: number; removed: number; recipients: number }> {
  const d = rowToDraft(c), out = { updated: 0, removed: 0, recipients: 0 }
  const [{ data: ns }, { data: ws }] = await Promise.all([
    admin.from('notifications').select('*').eq('campaign_id', c.id),
    admin.from('campaign_winners').select('*').eq('campaign_id', c.id),
  ])
  const notifs = ((ns ?? []) as any[]).filter(n => n.event_key)
  if (notifs.length === 0) return out
  const winners = (ws ?? []) as any[]
  const results: TeamResult[] = TEAMS.filter(t => d.teams[t]).map(team => ({ team, winners: winners.filter(w => w.team === team).sort((a, b) => a.position - b.position).map(w => ({ name: w.user_name, metric: Number(w.metric_value ?? 0), prize: w.prize ?? null })) }))
  const fin = finishMessagesFrom(d, results)
  const winnerOf = (team: string, pos: number) => winners.find(w => w.team === team && w.position === pos)
  let participantIds: string[] | null = null
  const people = async () => (participantIds ??= (await loadParticipants(admin, TEAMS.filter(t => d.teams[t]) as Team[])).map(p => p.userId))

  const setText = async (n: any, m: { title: string; body: string }) => {
    if (n.title === m.title.slice(0, 120) && (n.body ?? '') === m.body.slice(0, 1000)) return
    await admin.from('notifications').update({ title: m.title.slice(0, 120), body: m.body.slice(0, 1000) }).eq('id', n.id); out.updated++
  }
  const drop = async (n: any) => {
    await admin.from('notification_recipients').delete().eq('notification_id', n.id)
    await admin.from('notifications').delete().eq('id', n.id); out.removed++
  }
  const syncRecipients = async (n: any, want: string[]) => {
    const { data: cur } = await admin.from('notification_recipients').select('user_id').eq('notification_id', n.id)
    const have = new Set(((cur ?? []) as any[]).map(r => r.user_id)), wantSet = new Set(want)
    const add = want.filter(u => !have.has(u)), del = [...have].filter(u => !wantSet.has(u))
    if (add.length) await admin.from('notification_recipients').insert(add.map(user_id => ({ notification_id: n.id, user_id, created_at: now.toISOString() })))
    if (del.length) await admin.from('notification_recipients').delete().eq('notification_id', n.id).in('user_id', del)
    out.recipients += add.length + del.length
  }

  for (const n of notifs) {
    const key: string = n.event_key, [kind, who, team, posS] = key.split(':'), pos = Number(posS)
    if (key === 'launch') { await setText(n, launchMessage(d)); await syncRecipients(n, await people()) }
    else if (key === 'start') { await setText(n, startMessage(d)); await syncRecipients(n, await people()) }
    else if (key === 'cancel') await setText(n, cancelMessage(d))
    else if (kind === 'win' && (who === 'personal' || who === 'others')) {
      const w = winnerOf(team, pos); if (!w) { await drop(n); continue }
      const m = raceHitMessages(d, { name: w.user_name, team: team as Team, position: pos, metric: Number(w.metric_value ?? 0), prize: w.prize ?? null })
      await setText(n, who === 'personal' ? m.personal : m.others)
    }
    else if (kind === 'finish' && who === 'personal') {
      const w = winnerOf(team, pos); if (!w) { await drop(n); continue }
      await setText(n, fin.personal({ team: team as Team, metric: Number(w.metric_value ?? 0), prize: w.prize ?? null }, pos))
    }
    else if (key === 'finish:everyone') await setText(n, fin.everyone)
    else if (key === 'finish:creator') await setText(n, fin.creator)
  }
  return out
}

/**
 * Desfaz o que a campanha PRODUZIU, pra apuração refazer do zero com a regra nova:
 *   outcome → ganhadores + avisos de "bateu a meta"/resultado, e a campanha volta a ficar aberta (finalized_at = null)
 *   start   → o aviso "Começou" (o dia de início mudou; ele sai de novo no dia certo)
 */
export async function resetCampaignOutcome(admin: any, campaignId: string, opts: { outcome?: boolean; start?: boolean }): Promise<{ notifications: number; winners: number }> {
  // as chaves do AVISO (win:personal:OAO:1, finish:everyone…) e as do HISTÓRICO de apuração (win:OAO:1, finish) têm nomes diferentes
  const hitNotice = (k: string | null | undefined) => !!k && ((opts.outcome === true && (k.startsWith('win:') || k.startsWith('finish:'))) || (opts.start === true && k === 'start'))
  const hitLog = (k: string | null | undefined) => !!k && ((opts.outcome === true && (k.startsWith('win:') || k === 'finish')) || (opts.start === true && k === 'start'))
  const { data: ns } = await admin.from('notifications').select('id, event_key').eq('campaign_id', campaignId)
  const ids = byIds(((ns ?? []) as any[]).filter(n => hitNotice(n.event_key)))
  if (ids.length) { await admin.from('notification_recipients').delete().in('notification_id', ids); await admin.from('notifications').delete().in('id', ids) }
  let winners = 0
  if (opts.outcome) {
    const { data: ws } = await admin.from('campaign_winners').select('id').eq('campaign_id', campaignId); winners = (ws ?? []).length
    if (winners) await admin.from('campaign_winners').delete().eq('campaign_id', campaignId)
  }
  const { data: lg } = await admin.from('campaign_event_log').select('event_key').eq('campaign_id', campaignId)
  const keys = byIds(((lg ?? []) as any[]).filter(r => hitLog(r.event_key)), 'event_key')
  if (keys.length) await admin.from('campaign_event_log').delete().eq('campaign_id', campaignId).in('event_key', keys)
  const patch: Record<string, null> = {}
  if (opts.outcome) patch.finalized_at = null
  if (opts.start) patch.start_notified_at = null
  if (Object.keys(patch).length) await admin.from('campaigns').update(patch).eq('id', campaignId)
  return { notifications: ids.length, winners }
}

/** Excluir de verdade: a campanha, os ganhadores, o histórico E TODOS os avisos que ela enviou (somem do sininho de quem recebeu). */
export async function deleteCampaignCascade(admin: any, campaignId: string): Promise<{ notifications: number; deliveries: number }> {
  const { data: ns } = await admin.from('notifications').select('id').eq('campaign_id', campaignId)
  const ids = byIds((ns ?? []) as any[])
  let deliveries = 0
  if (ids.length) {
    const { data: rs } = await admin.from('notification_recipients').select('user_id').in('notification_id', ids)
    deliveries = (rs ?? []).length
    await admin.from('notification_recipients').delete().in('notification_id', ids)
    await admin.from('notifications').delete().in('id', ids)
  }
  await admin.from('campaign_winners').delete().eq('campaign_id', campaignId)
  await admin.from('campaign_event_log').delete().eq('campaign_id', campaignId)
  await admin.from('campaigns').delete().eq('id', campaignId)
  return { notifications: ids.length, deliveries }
}
