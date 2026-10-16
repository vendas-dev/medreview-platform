import { sendNotification } from '@/lib/notifications/server'
import {
  addDays, attributeSales, CloserRef, evaluate, Evaluation, finishMessages, launchMessage, Participant, phaseOf, prizeFor, raceHitMessages,
  SaleRow, startMessage, todaySP, validateDraft,
} from './engine'
import { CampaignDraft, CampaignRow, criterionInfo, Team, TEAMS } from './types'

// ══ Apuração, avisos e fechamento das campanhas (servidor) ═══════════════════════
// Tudo é idempotente: rodar a rotina 10 vezes seguidas dá o mesmo resultado de rodar 1.

export const rowToDraft = (r: any): CampaignDraft => ({
  name: r.name, subtitle: r.subtitle ?? '', prize: r.prize ?? '', prize_mode: r.prize_mode === 'tiered' ? 'tiered' : 'single', prizes: r.prizes && typeof r.prizes === 'object' ? r.prizes : {}, emoji: r.emoji ?? '🏁', theme: r.theme ?? 'roxo', criterion: r.criterion,
  teams: r.teams ?? {}, starts_on: String(r.starts_on).slice(0, 10), ends_on: String(r.ends_on).slice(0, 10),
  count_recurring: r.count_recurring === true, verticals: r.verticals && r.verticals.length ? r.verticals : null, notify: r.notify !== false,
})
/** Só guarda prêmio das posições que existem (se diminuiu o nº de premiados, o resto sai) e tira espaços. */
export function cleanPrizes(d: CampaignDraft): CampaignDraft['prizes'] {
  const out: CampaignDraft['prizes'] = {}
  for (const t of TEAMS) if (d.teams[t]) out[t] = Array.from({ length: Math.max(0, Math.min(50, d.teams[t]!.winners || 0)) }, (_, i) => (d.prizes?.[t]?.[i] ?? '').trim().slice(0, 120))
  return out
}
export const draftToDb = (d: CampaignDraft) => ({
  name: d.name.trim(), subtitle: d.subtitle.trim(), prize: d.prize_mode === 'tiered' ? '' : d.prize.trim(), prize_mode: d.prize_mode === 'tiered' ? 'tiered' : 'single', prizes: d.prize_mode === 'tiered' ? cleanPrizes(d) : {}, emoji: d.emoji, theme: d.theme, criterion: d.criterion, teams: d.teams,
  starts_on: d.starts_on, ends_on: d.ends_on, count_recurring: d.count_recurring, verticals: d.verticals && d.verticals.length ? d.verticals : null, notify: d.notify,
})

export async function loadParticipants(admin: any, teams: Team[]): Promise<Participant[]> {
  const { data } = await admin.from('profiles').select('*')
  return ((data ?? []) as any[])
    .filter(p => p.role !== 'superadmin' && TEAMS.includes(p.team) && teams.includes(p.team))
    .map(p => ({ userId: p.id, name: p.name ?? '?', team: p.team as Team, hubspotId: p.hubspot_id ?? null }))
}
export async function loadCloserRefs(admin: any): Promise<CloserRef[]> {
  const { data } = await admin.from('closers').select('id, hubspot_id, profile_id, normalized_name')
  return (data ?? []) as CloserRef[]
}

const SALE_COLS = 'id,event_type,vertical,value,occurred_at,closer_id,closer_hubspot_id,closer_name,co_closer_id,co_closer_hubspot_id,is_self_checkout,is_recurring,installment_number,sale_type'
/** Vendas dos dias [from, to] (horário de SP = UTC-3). Lê em páginas: funciona mesmo se o banco limitar linhas por consulta. */
export async function loadSales(admin: any, from: string, to: string): Promise<SaleRow[]> {
  if (to < from) return []
  const fromIso = `${from}T03:00:00.000Z`, toIso = `${addDays(to, 1)}T03:00:00.000Z`
  const out: SaleRow[] = []
  for (let off = 0, i = 0; i < 400; i++) {
    const { data, error } = await admin.from('telao_events').select(SALE_COLS).eq('event_type', 'sale')
      .gte('occurred_at', fromIso).lt('occurred_at', toIso).order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(off, off + 999)
    if (error) throw new Error(`telao_events: ${error.message}`)
    const got = (data ?? []) as SaleRow[]
    if (got.length === 0) break
    out.push(...got); off += got.length
  }
  return out
}

export async function evaluateDraft(admin: any, d: CampaignDraft, today: string): Promise<{ ev: Evaluation; participants: Participant[] }> {
  const teams = (Object.keys(d.teams) as Team[]).filter(t => TEAMS.includes(t))
  const participants = await loadParticipants(admin, teams)
  const upto = d.ends_on < today ? d.ends_on : today
  const [sales, closers] = upto >= d.starts_on ? await Promise.all([loadSales(admin, d.starts_on, upto), loadCloserRefs(admin)]) : [[], [] as CloserRef[]]
  return { ev: evaluate(d, participants, attributeSales(sales, participants, closers), today), participants }
}

/** Marca o aviso como enviado. Devolve false se JÁ tinha sido enviado (a chave é única). */
async function claimEvent(admin: any, campaignId: string, key: string): Promise<boolean> {
  const { error } = await admin.from('campaign_event_log').insert({ campaign_id: campaignId, event_key: key })
  if (!error) return true
  if (error.code === '23505' || /duplicate key/i.test(error.message ?? '')) return false
  throw new Error(`campaign_event_log: ${error.message}`)
}

export interface TickSummary { checked: number; notifications: number; finalized: number; winners: number }

export async function tickCampaign(admin: any, c: CampaignRow, now: Date, sum: TickSummary): Promise<void> {
  const d = rowToDraft(c), today = todaySP(now), phase = phaseOf(d, today)
  if (c.status !== 'published' || c.finalized_at || phase === 'scheduled') return
  sum.checked++
  const { ev, participants } = await evaluateDraft(admin, d, today)
  const everyone = participants.map(p => p.userId)
  // link null de propósito: clicar no aviso de campanha abre o popup dos vencedores (não leva pra outra página)
  const send = async (title: string, body: string, kind: 'campanha' | 'vitoria', to: string[], event_key: string) => {
    if (!d.notify || to.length === 0) return
    const r = await sendNotification(admin, { title, body, kind, link: null, campaign_id: c.id, created_by: c.created_by, recipients: to, event_key })
    if (r) sum.notifications++
  }
  const info = criterionInfo(d.criterion)

  // 1) "Começou hoje" — só se a campanha foi publicada ANTES do 1º dia (senão o aviso de lançamento já bastou)
  //    e ainda está em andamento (se a 1ª apuração só rodou depois do fim, anunciar o começo seria absurdo).
  const launchedDay = c.launched_at ? todaySP(new Date(c.launched_at)) : d.starts_on
  if (phase === 'active' && launchedDay < d.starts_on && (await claimEvent(admin, c.id, 'start'))) {
    const m = startMessage(d); await send(m.title, m.body, 'campanha', everyone, 'start')
    await admin.from('campaigns').update({ start_notified_at: now.toISOString() }).eq('id', c.id)
  }

  // 2) Corrida: cada vaga preenchida vira ganhador na hora (e avisa)
  if (info.race) {
    for (const t of ev.teams) for (let i = 0; i < t.winners.length; i++) {
      const w = t.winners[i], pos = i + 1
      if (!(await claimEvent(admin, c.id, `win:${t.team}:${pos}`))) continue
      await admin.from('campaign_winners').upsert({ campaign_id: c.id, team: t.team, position: pos, user_id: w.userId, user_name: w.name, metric_value: w.metric, reached_at: w.reachedAt, prize: prizeFor(d, t.team, pos) }, { onConflict: 'campaign_id,team,position', ignoreDuplicates: true })
      sum.winners++
      const m = raceHitMessages(d, { name: w.name, team: t.team, position: pos, metric: w.metric })
      await send(m.personal.title, m.personal.body, 'vitoria', [w.userId], `win:personal:${t.team}:${pos}`)
      await send(m.others.title, m.others.body, 'campanha', participants.filter(p => p.team === t.team && p.userId !== w.userId).map(p => p.userId), `win:others:${t.team}:${pos}`)
    }
  }

  // 3) Fechamento: acabou o prazo (ou a corrida encheu todas as vagas)
  if (!ev.final) return
  if (!(await claimEvent(admin, c.id, 'finish'))) return
  const msgs = finishMessages(d, ev)
  for (const t of ev.teams) for (let i = 0; i < t.winners.length; i++) {
    const w = t.winners[i], pos = i + 1
    if (!info.race) {
      await admin.from('campaign_winners').upsert({ campaign_id: c.id, team: t.team, position: pos, user_id: w.userId, user_name: w.name, metric_value: w.metric, reached_at: w.reachedAt, prize: prizeFor(d, t.team, pos) }, { onConflict: 'campaign_id,team,position', ignoreDuplicates: true })
      sum.winners++
      const m = msgs.personal(w, pos); await send(m.title, m.body, 'vitoria', [w.userId], `finish:personal:${t.team}:${pos}`)
    }
  }
  await send(msgs.everyone.title, msgs.everyone.body, 'campanha', everyone, 'finish:everyone')
  if (c.created_by) await send(msgs.creator.title, msgs.creator.body, 'campanha', [c.created_by], 'finish:creator')
  await admin.from('campaigns').update({ finalized_at: now.toISOString() }).eq('id', c.id)
  sum.finalized++
}

/** Apura todas as campanhas publicadas e ainda abertas (ou só uma). */
export async function runCampaignTick(admin: any, opts: { now?: Date; campaignId?: string } = {}): Promise<TickSummary> {
  const now = opts.now ?? new Date()
  const sum: TickSummary = { checked: 0, notifications: 0, finalized: 0, winners: 0 }
  let q = admin.from('campaigns').select('*').eq('status', 'published')
  if (opts.campaignId) q = q.eq('id', opts.campaignId)
  const { data, error } = await q
  if (error) throw new Error(`campaigns: ${error.message}`)
  for (const c of ((data ?? []) as CampaignRow[]).filter(x => !x.finalized_at)) {
    try { await tickCampaign(admin, c, now, sum) } catch (e: any) { console.error('[campanhas] erro na campanha', c.id, e?.message ?? e) }
  }
  return sum
}

/** Roda a apuração no máximo 1× a cada N minutos, não importa quantas pessoas estejam com a plataforma aberta. */
export async function maybeTick(admin: any, minMs = 5 * 60_000, now: Date = new Date()): Promise<TickSummary | null> {
  const { data: rt } = await admin.from('campaign_runtime').select('last_tick_at').eq('id', 1).maybeSingle()
  const last = rt?.last_tick_at as string | null | undefined
  if (last && now.getTime() - Date.parse(last) < minMs) return null
  let q = admin.from('campaign_runtime').update({ last_tick_at: now.toISOString() }).eq('id', 1)
  q = last ? q.eq('last_tick_at', last) : q.is('last_tick_at', null)
  const { data: won } = await q.select()
  if (!won || won.length === 0) return null            // outra execução pegou a vez
  return runCampaignTick(admin, { now })
}

/** Publica: valida, marca como publicada e avisa os participantes (uma única vez). */
export async function publishCampaign(admin: any, id: string, now: Date = new Date()): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const { data: c } = await admin.from('campaigns').select('*').eq('id', id).maybeSingle()
  if (!c) return { ok: false, errors: ['Campanha não encontrada.'] }
  if (c.status === 'cancelled') return { ok: false, errors: ['Campanha cancelada não pode ser publicada.'] }
  const d = rowToDraft(c), errors = validateDraft(d)
  if (errors.length) return { ok: false, errors }
  if (c.status !== 'published') await admin.from('campaigns').update({ status: 'published', launched_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', id)
  if (d.notify && (await claimEvent(admin, id, 'launch'))) {
    const participants = await loadParticipants(admin, (Object.keys(d.teams) as Team[]))
    const m = launchMessage(d)
    await sendNotification(admin, { title: m.title, body: m.body, kind: 'campanha', link: null, campaign_id: id, created_by: c.created_by, recipients: participants.map(p => p.userId), event_key: 'launch' })
  }
  await runCampaignTick(admin, { now, campaignId: id })        // se já está no prazo (ou já passou), apura na hora
  return { ok: true }
}
