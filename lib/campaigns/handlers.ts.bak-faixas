import { sendNotification, sanitizeLink } from '@/lib/notifications/server'
import { deleteCampaignCascade, resetCampaignOutcome, syncCampaignNotifications } from './sync'
import { parseDraft, toRow } from './api'
import { addDays, cancelMessage, phaseOf, prizeFor, ruleSignature, todaySP, validateDraft } from './engine'
import { draftToDb, evaluateDraft, loadParticipants, publishCampaign, rowToDraft, runCampaignTick } from './server'
import { CampaignRow, Team, TEAMS } from './types'

// ══ Regras das rotas (sem HTTP, sem login): cada função devolve { status, json } ═════════
// As rotas só confirmam QUEM está logado e chamam estas funções — assim dá pra testar tudo.
export type R = { status: number; json: any }
const ok = (json: any = { ok: true }): R => ({ status: 200, json })
const bad = (error: string, extra: object = {}, status = 400): R => ({ status, json: { error, ...extra } })

// ── campanhas ───────────────────────────────────────────────────────────────────
export async function hListCampaigns(admin: any, now: Date = new Date()): Promise<R> {
  const today = todaySP(now)
  const [{ data: cs }, { data: ws }, parts] = await Promise.all([
    admin.from('campaigns').select('*').order('created_at', { ascending: false }),
    admin.from('campaign_winners').select('*').order('position', { ascending: true }),
    loadParticipants(admin, [...TEAMS]),
  ])
  const winners = new Map<string, any[]>()
  for (const w of (ws ?? []) as any[]) (winners.get(w.campaign_id) ?? winners.set(w.campaign_id, []).get(w.campaign_id)!).push(w)
  const eligible = { OAO: parts.filter(p => p.team === 'OAO').length, R1: parts.filter(p => p.team === 'R1').length }
  const ids = ((cs ?? []) as any[]).map(c => c.id)
  const { data: ns } = ids.length ? await admin.from('notifications').select('id, campaign_id').in('campaign_id', ids) : { data: [] as any[] }
  const nIds = ((ns ?? []) as any[]).map(n => n.id)
  const { data: rs } = nIds.length ? await admin.from('notification_recipients').select('notification_id').in('notification_id', nIds) : { data: [] as any[] }
  const perNotif = new Map<string, number>(); for (const r of (rs ?? []) as any[]) perNotif.set(r.notification_id, (perNotif.get(r.notification_id) ?? 0) + 1)
  const notified = new Map<string, { notifications: number; deliveries: number }>()
  for (const n of (ns ?? []) as any[]) { const x = notified.get(n.campaign_id) ?? { notifications: 0, deliveries: 0 }; x.notifications++; x.deliveries += perNotif.get(n.id) ?? 0; notified.set(n.campaign_id, x) }
  return ok({ campaigns: ((cs ?? []) as any[]).map(r => { const c = toRow(r); return { ...c, phase: phaseOf(c, today), winners: winners.get(c.id) ?? [], notified: notified.get(c.id) ?? { notifications: 0, deliveries: 0 } } }), eligible, today })
}

/** Cria. Rascunho aceita campo faltando; publicar exige tudo e avisa a equipe. */
export async function hCreateCampaign(admin: any, userId: string, body: any, now: Date = new Date()): Promise<R> {
  const draft = parseDraft(body?.draft)
  if (!draft) return bad('Dados inválidos.')
  const publish = body?.publish === true
  const errors = validateDraft(draft, publish)
  if (errors.length) return bad(errors[0], { errors })
  const { data, error } = await admin.from('campaigns').insert({ ...draftToDb(draft), status: 'draft', created_by: userId }).select().single()
  if (error || !data) { console.error('[campanhas] criar:', error?.message); return bad('Não consegui salvar a campanha.', {}, 500) }
  if (publish) {
    const r = await publishCampaign(admin, data.id, now)
    if (!r.ok) return bad(r.errors[0], { errors: r.errors, id: data.id })
  }
  return ok({ ok: true, id: data.id, published: publish })
}

export async function hGetCampaign(admin: any, id: string, now: Date = new Date()): Promise<R> {
  const today = todaySP(now)
  const { data: r } = await admin.from('campaigns').select('*').eq('id', id).maybeSingle()
  if (!r) return bad('Campanha não encontrada.', {}, 404)
  const c = toRow(r)
  const [{ data: ws }, { ev, participants }] = await Promise.all([admin.from('campaign_winners').select('*').eq('campaign_id', id).order('position', { ascending: true }), evaluateDraft(admin, c, today)])
  return ok({ campaign: { ...c, phase: phaseOf(c, today) }, winners: ws ?? [], evaluation: ev, participants: participants.length })
}

/**
 * Edita QUALQUER campanha (rascunho, em andamento, encerrada, cancelada) e faz os avisos já enviados acompanharem:
 *  • texto mudou (nome, descrição, prêmio, datas…) → os avisos já enviados são REESCRITOS (mesmos avisos, quem leu continua tendo lido)
 *  • mudou quem participa (times) → quem entrou passa a ter o aviso de lançamento; quem saiu perde
 *  • mudou a REGRA depois de já haver ganhadores/resultado → ganhadores e avisos de resultado são APAGADOS e a apuração refaz do zero
 */
export async function hPatchCampaign(admin: any, id: string, body: any, now: Date = new Date()): Promise<R> {
  const { data: r } = await admin.from('campaigns').select('*').eq('id', id).maybeSingle()
  if (!r) return bad('Campanha não encontrada.', {}, 404)
  const draft = parseDraft(body?.draft)
  if (!draft) return bad('Dados inválidos.')
  const prev = rowToDraft(r), status: string = r.status, wasFinal = !!r.finalized_at          // guarda ANTES de alterar
  const errors = validateDraft(draft, status !== 'draft')
  if (errors.length) return bad(errors[0], { errors })
  const { error } = await admin.from('campaigns').update({ ...draftToDb(draft), updated_at: now.toISOString() }).eq('id', id)
  if (error) return bad('Não consegui salvar.', {}, 500)
  if (status === 'draft') return ok({ ok: true, ruleChanged: false, reset: { notifications: 0, winners: 0 }, sync: { updated: 0, removed: 0, recipients: 0 } })

  const ruleChanged = ruleSignature(prev) !== ruleSignature(draft), startChanged = prev.starts_on !== draft.starts_on
  const { data: ws0 } = await admin.from('campaign_winners').select('id').eq('campaign_id', id)
  const hasOutcome = wasFinal || (ws0 ?? []).length > 0
  const redo = status === 'published' && ruleChanged && hasOutcome
  const reset = (redo || (status === 'published' && startChanged)) ? await resetCampaignOutcome(admin, id, { outcome: redo, start: startChanged }) : { notifications: 0, winners: 0 }

  const { data: nr } = await admin.from('campaigns').select('*').eq('id', id).maybeSingle()
  const row = toRow(nr)
  // ganhador que ainda não recebeu: o prêmio gravado acompanha o texto novo (quem já recebeu não muda)
  const { data: ws } = await admin.from('campaign_winners').select('*').eq('campaign_id', id)
  for (const w of (ws ?? []) as any[]) if (!w.delivered_at) { const pz = prizeFor(row, w.team, w.position); if (pz && pz !== w.prize) await admin.from('campaign_winners').update({ prize: pz }).eq('id', w.id) }
  const sync = await syncCampaignNotifications(admin, row, now)
  if (status === 'published') await runCampaignTick(admin, { campaignId: id, now })           // reabre/fecha conforme a regra nova
  return ok({ ok: true, ruleChanged, reset, sync })
}

/** Exclui QUALQUER campanha, e leva junto os avisos que ela enviou (somem do sininho de quem recebeu), os ganhadores e o histórico. */
export async function hDeleteCampaign(admin: any, id: string): Promise<R> {
  const { data: r } = await admin.from('campaigns').select('id').eq('id', id).maybeSingle()
  if (!r) return bad('Campanha não encontrada.', {}, 404)
  const removed = await deleteCampaignCascade(admin, id)
  return ok({ ok: true, removed })
}

export async function hCampaignAction(admin: any, id: string, userId: string, body: any, now: Date = new Date()): Promise<R> {
  const { data: r } = await admin.from('campaigns').select('*').eq('id', id).maybeSingle()
  if (!r) return bad('Campanha não encontrada.', {}, 404)
  switch (body?.action) {
    case 'publish': { const res = await publishCampaign(admin, id, now); return res.ok ? ok() : bad(res.errors[0], { errors: res.errors }) }
    case 'refresh': {
      if (r.status !== 'published') return bad('Só campanhas publicadas são apuradas.')
      return ok({ ok: true, summary: await runCampaignTick(admin, { campaignId: id, now }) })
    }
    case 'cancel': {
      if (r.status === 'cancelled' || r.finalized_at) return bad('Esta campanha já está encerrada.')
      const wasPublished = r.status === 'published' && r.notify !== false          // guarda ANTES de alterar (não depende da leitura ser uma cópia)
      await admin.from('campaigns').update({ status: 'cancelled', updated_at: now.toISOString() }).eq('id', id)
      if (wasPublished) {          // quem foi avisado do lançamento merece saber que acabou
        const d = rowToDraft(r), ps = await loadParticipants(admin, Object.keys(d.teams) as Team[])
        const m = cancelMessage(d)
        await sendNotification(admin, { title: m.title, body: m.body, kind: 'campanha', link: null, campaign_id: id, created_by: userId, recipients: ps.map(p => p.userId), event_key: 'cancel' })
      }
      return ok()
    }
    case 'duplicate': {
      const shift = Number.isInteger(body?.shiftDays) ? Math.max(-365, Math.min(365, body.shiftDays)) : 7
      const d = rowToDraft(r)
      const { data, error } = await admin.from('campaigns').insert({
        name: `${d.name} (cópia)`.slice(0, 60), subtitle: d.subtitle, prize: d.prize_mode === 'tiered' ? '' : d.prize, prize_mode: d.prize_mode, prizes: d.prize_mode === 'tiered' ? d.prizes : {}, emoji: d.emoji, theme: d.theme, criterion: d.criterion, teams: d.teams,
        starts_on: addDays(d.starts_on, shift), ends_on: addDays(d.ends_on, shift), count_recurring: d.count_recurring, verticals: d.verticals, notify: d.notify, status: 'draft', created_by: userId,
      }).select().single()
      return error || !data ? bad('Não consegui duplicar.', {}, 500) : ok({ ok: true, id: data.id })
    }
    case 'delivered': {
      if (typeof body?.winnerId !== 'string') return bad('Informe o ganhador.')
      const on = body?.delivered !== false
      const { error } = await admin.from('campaign_winners').update({ delivered_at: on ? now.toISOString() : null, delivered_by: on ? userId : null }).eq('id', body.winnerId).eq('campaign_id', id)
      return error ? bad('Não consegui atualizar.', {}, 500) : ok()
    }
    default: return bad('Ação inválida.')
  }
}

/** Prévia do criador: quantas pessoas concorrem e quem lideraria HOJE. */
export async function hPreview(admin: any, body: any, now: Date = new Date()): Promise<R> {
  const draft = parseDraft(body?.draft)
  if (!draft) return bad('Dados inválidos.')
  const errors = validateDraft(draft, true)
  const safe = { ...draft, teams: Object.fromEntries(Object.entries(draft.teams).map(([t, r]) => [t, { winners: Math.max(1, Math.min(50, (r as any).winners || 1)), target: (r as any).target }])) as typeof draft.teams }
  const { ev, participants } = await evaluateDraft(admin, safe, todaySP(now))
  return ok({
    errors, phase: ev.phase, participants: { OAO: participants.filter(p => p.team === 'OAO').length, R1: participants.filter(p => p.team === 'R1').length },
    teams: ev.teams.map(t => ({ team: t.team, winners: t.rule.winners, top: t.standings.slice(0, 5).map(s => ({ name: s.name, rank: s.rank, metric: s.metric, count: s.count, revenue: s.revenue, progress: s.progress, qualified: s.qualified })) })),
  })
}

// ── notificações ───────────────────────────────────────────────────────────────
/** O sininho: as últimas 30 da PESSOA + quantas não lidas. */
export async function hListNotifications(admin: any, userId: string): Promise<R> {
  const [{ data: recs }, { count }] = await Promise.all([
    admin.from('notification_recipients').select('notification_id, read_at, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    admin.from('notification_recipients').select('notification_id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
  ])
  const ids = ((recs ?? []) as any[]).map(r => r.notification_id)
  const { data: ns } = ids.length ? await admin.from('notifications').select('id, title, body, kind, link, created_at, campaign_id').in('id', ids) : { data: [] as any[] }
  const byId = new Map(((ns ?? []) as any[]).map(n => [n.id, n]))
  const items = ((recs ?? []) as any[]).map(r => (byId.get(r.notification_id) ? { ...byId.get(r.notification_id), read_at: r.read_at } : null)).filter(Boolean)
  return ok({ unread: count ?? 0, items })
}

/** Marca como lida SÓ as da pessoa logada. Body: { ids } ou { all: true }. */
export async function hMarkRead(admin: any, userId: string, body: any, now: Date = new Date()): Promise<R> {
  let q = admin.from('notification_recipients').update({ read_at: now.toISOString() }).eq('user_id', userId).is('read_at', null)
  if (body?.all !== true) {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 100) : []
    if (ids.length === 0) return bad('Informe ids ou all')
    q = q.in('notification_id', ids)
  }
  const { error } = await q
  return error ? bad('Não consegui marcar como lida', {}, 500) : ok()
}

export async function hRecipients(admin: any): Promise<R> {
  const { data, error } = await admin.from('profiles').select('*')
  if (error) return bad('Não consegui carregar os usuários', {}, 500)
  return ok({ users: ((data ?? []) as any[]).filter(p => p.is_active !== false).map(p => ({ id: p.id, name: p.name ?? '(sem nome)', role: p.role ?? null, team: p.team ?? null, avatar_url: p.avatar_url ?? null })).sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')) })
}

export async function hAdminNotifications(admin: any): Promise<R> {
  const { data: ns } = await admin.from('notifications').select('id, title, body, kind, link, created_at, campaign_id').order('created_at', { ascending: false }).limit(50)
  const ids = ((ns ?? []) as any[]).map(n => n.id)
  const { data: recs } = ids.length ? await admin.from('notification_recipients').select('notification_id, read_at').in('notification_id', ids) : { data: [] as any[] }
  const stat = new Map<string, { total: number; read: number }>()
  for (const r of (recs ?? []) as any[]) { const x = stat.get(r.notification_id) ?? { total: 0, read: 0 }; x.total++; if (r.read_at) x.read++; stat.set(r.notification_id, x) }
  return ok({ items: ((ns ?? []) as any[]).map(n => ({ ...n, total: stat.get(n.id)?.total ?? 0, read: stat.get(n.id)?.read ?? 0 })) })
}

export async function hSendNotification(admin: any, userId: string, b: any): Promise<R> {
  const title = String(b?.title ?? '').trim(), body = String(b?.body ?? '').trim()
  const userIds: string[] = Array.isArray(b?.userIds) ? [...new Set<string>(b.userIds.filter((x: unknown) => typeof x === 'string'))] : []
  if (!title) return bad('Informe o título.')
  if (title.length > 120) return bad('O título pode ter até 120 caracteres.')
  if (body.length > 1000) return bad('A descrição pode ter até 1.000 caracteres.')
  if (userIds.length === 0) return bad('Escolha pelo menos uma pessoa.')
  if (userIds.length > 2000) return bad('Máximo de 2.000 destinatários por aviso.')
  if (b?.link && !sanitizeLink(b.link)) return bad('O link precisa ser um caminho da plataforma (ex.: /telao) ou começar com https://.')
  const { data: valid } = await admin.from('profiles').select('id').in('id', userIds).or('is_active.is.null,is_active.eq.true')           // só quem existe de verdade
  const r = await sendNotification(admin, { title, body, kind: 'aviso', link: b?.link, created_by: userId, recipients: ((valid ?? []) as any[]).map(p => p.id) })
  return r ? ok({ ok: true, id: r.id, recipients: r.recipients }) : bad('Nenhum destinatário válido.')
}

// ── popup dos vencedores (o que acontece ao clicar num aviso de campanha) ───────────────────
/**
 * SÓ nome do vencedor e prêmio — nunca quanto vendeu. Cada pessoa vê SÓ o time dela (OAO vê OAO, R1 vê R1);
 * superadmin vê os times da campanha. Quem não participa não vê nada (403).
 */
export async function hCampaignWinnersView(admin: any, userId: string, campaignId: string, now: Date = new Date()): Promise<R> {
  const { data: me } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (!me) return bad('Não autorizado.', {}, 401)
  const { data: r } = await admin.from('campaigns').select('*').eq('id', campaignId).maybeSingle()
  if (!r || r.status === 'draft') return bad('Esta campanha não está mais disponível.', {}, 404)
  const d = rowToDraft(r), inCampaign = TEAMS.filter(t => d.teams[t]), isAdmin = me.role === 'superadmin'
  const allowed = isAdmin ? inCampaign : inCampaign.filter(t => t === me.team)
  if (allowed.length === 0) return bad('Você não participa desta campanha.', {}, 403)
  const { data: ws } = await admin.from('campaign_winners').select('*').eq('campaign_id', campaignId).order('position', { ascending: true })
  const winners = (ws ?? []) as any[], phase = phaseOf(d, todaySP(now))
  const cancelled = r.status === 'cancelled', finished = !!r.finalized_at
  const state = cancelled ? 'cancelled' : finished ? 'finished' : phase === 'scheduled' ? 'scheduled' : phase === 'ended' ? 'counting' : 'active'
  const teams = allowed.map(team => ({
    team,
    positions: Array.from({ length: Math.max(0, Math.min(50, d.teams[team]!.winners)) }, (_, i) => {
      const w = winners.find(x => x.team === team && x.position === i + 1)
      return { position: i + 1, prize: (w?.prize || prizeFor(d, team, i + 1)) || null, winner: w ? { name: w.user_name as string, me: w.user_id === userId } : null, state: w ? 'winner' : (finished || cancelled) ? 'empty' : 'pending' }
    }),
  }))
  return ok({
    campaign: { id: r.id, name: d.name, subtitle: d.subtitle, emoji: d.emoji, theme: d.theme, state, prize_mode: d.prize_mode, prize_single: d.prize_mode === 'tiered' ? null : (d.prize.trim() || null) },
    viewer: { team: me.team ?? null, admin: isAdmin }, teams,
  })
}
