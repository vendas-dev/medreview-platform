import { fmtBRL } from '@/lib/telao/format'
import { CampaignDraft, HourlyCfg, HourlyRange, Team, TEAMS } from './types'

// ══ Critério "POR HORA" (hourly) ═════════════════════════════════════════════════════════════════════════════
//  Em cada dia da campanha há "rodadas" (horas fechadas ou intervalos). Quem vender mais na rodada (valor ou quantidade) GANHA aquela rodada,
//  em cada time separado. Prêmio igual pra todas as rodadas, ou um prêmio diferente por horário (o mesmo em todos os dias).
//
//  FUSO — a regra de ouro: TODO horário é "relógio de São Paulo". Nunca converto horário de SP para UTC: pego o instante da venda (UTC) e descubro
//  qual era o DIA e o MINUTO no relógio de São Paulo (Intl, America/Sao_Paulo) — e comparo com o horário da rodada, também em relógio de SP.
//  Assim funciona igual em qualquer servidor (UTC, Vercel, notebook) e mesmo que o Brasil volte a ter horário de verão.
//  Minutos: 0..1440 (1440 = meia-noite do fim do dia). Rodada = [de, até): 14h–15h pega 14:00:00 até 14:59:59.999.
//  Este arquivo é puro (sem banco e sem tela) e NÃO importa o engine (o engine é que importa este).

export const DAY_MIN = 1440
export const HOURLY_MAX_DAYS = 31
export const HOURLY_MAX_RANGES = 24
/** A rodada só é "fechada" (ganhador definido) alguns minutos depois do fim: dá tempo de vendas que chegam atrasadas (webhook) entrarem na conta. */
export const SLOT_GRACE_MIN = 5

// ── relógio de São Paulo ───────────────────────────────────────────────────────
const SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
/** Dia (AAAA-MM-DD) e minuto do dia (0..1439) no relógio de São Paulo. null se a data for inválida. */
export function spParts(at: string | Date): { day: string; min: number } | null {
  const d = typeof at === 'string' ? new Date(at) : at
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const p: Record<string, string> = {}
  for (const x of SP.formatToParts(d)) p[x.type] = x.value
  let h = Number(p.hour); if (h === 24) h = 0
  return { day: `${p.year}-${p.month}-${p.day}`, min: h * 60 + Number(p.minute) }
}
export const spMinutes = (at: string | Date): number => spParts(at)?.min ?? 0

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const dayNum = (day: string): number => Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000)
const addDay = (day: string, n: number): string => new Date((dayNum(day) + n) * 86400000).toISOString().slice(0, 10)
const fmtDM = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const round2 = (n: number): number => Math.round(n * 100) / 100
const firstWord = (s: string): string => (s.trim().split(/\s+/)[0] ?? s)
const pl = (n: number, s: string, p: string): string => `${n} ${n === 1 ? s : p}`

// ── configuração ───────────────────────────────────────────────────────────────
export const defaultHourly = (): HourlyCfg => ({ mode: 'full', split: 'hour', metric: 'revenue', ranges: [] })
const toMin = (v: unknown): number => { const n = Number(v); return v === null || v === '' || v === undefined || !Number.isFinite(n) ? -1 : Math.max(-1, Math.min(DAY_MIN, Math.trunc(n))) }
/** Lê o que veio da tela/banco (nunca confia). Intervalos inválidos ficam (viram -1) para a validação avisar; passar de 24 intervalos é cortado. */
export function cleanHourly(raw: unknown): HourlyCfg | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const ranges = Array.isArray(r.ranges) ? (r.ranges as unknown[]).slice(0, HOURLY_MAX_RANGES).map(x => ({ from: toMin((x as Record<string, unknown>)?.from), to: toMin((x as Record<string, unknown>)?.to) })) : []
  return { mode: r.mode === 'ranges' ? 'ranges' : 'full', split: r.split === 'whole' ? 'whole' : 'hour', metric: r.metric === 'count' ? 'count' : 'revenue', ranges }
}
const validRange = (r: HourlyRange): boolean => Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 0 && r.to <= DAY_MIN && r.from < r.to
const FULL: HourlyRange[] = [{ from: 0, to: DAY_MIN }]
const sortedRanges = (cfg: HourlyCfg): HourlyRange[] => (cfg.mode === 'full' ? FULL : cfg.ranges.filter(validRange).slice().sort((a, b) => a.from - b.from))

export interface Slot { idx: number; from: number; to: number }
/** As rodadas de UM dia (iguais em todos os dias da campanha). */
export function slotsOfDay(cfg: HourlyCfg | null | undefined): Slot[] {
  if (!cfg) return []
  const split = cfg.mode === 'full' || cfg.split === 'hour', out: { from: number; to: number }[] = []
  for (const r of sortedRanges(cfg)) {
    if (split) { for (let t = r.from; t + 60 <= r.to; t += 60) out.push({ from: t, to: t + 60 }) }
    else out.push({ from: r.from, to: r.to })
  }
  return out.map((s, i) => ({ idx: i, ...s }))
}
export interface DaySlot extends Slot { pos: number; day: string }
const spanDays = (d: Pick<CampaignDraft, 'starts_on' | 'ends_on'>): number => DAY_RE.test(d.starts_on) && DAY_RE.test(d.ends_on) && d.ends_on >= d.starts_on ? Math.min(dayNum(d.ends_on) - dayNum(d.starts_on) + 1, 92) : 0
/** TODAS as rodadas da campanha em ordem de horário. `pos` (1, 2, 3…) é o número da rodada — é ele que vai em campaign_winners.position. */
export function allSlots(d: Pick<CampaignDraft, 'starts_on' | 'ends_on' | 'hourly'>): DaySlot[] {
  const per = slotsOfDay(d.hourly), days = spanDays(d), out: DaySlot[] = []
  for (let di = 0; di < days; di++) for (const s of per) out.push({ ...s, pos: di * per.length + s.idx + 1, day: addDay(d.starts_on, di) })
  return out
}
export function slotByPos(d: Pick<CampaignDraft, 'starts_on' | 'ends_on' | 'hourly'>, pos: number): DaySlot | null {
  const per = slotsOfDay(d.hourly); if (!per.length || !Number.isInteger(pos) || pos < 1) return null
  const di = Math.floor((pos - 1) / per.length)
  if (di >= spanDays(d)) return null
  return { ...per[(pos - 1) % per.length], pos, day: addDay(d.starts_on, di) }
}

// ── formatação ─────────────────────────────────────────────────────────────────
/** 540 → "09h" · 570 → "09h30" · 1440 → "24h" */
export const fmtH = (m: number): string => { const h = Math.floor(m / 60), mm = m % 60; return mm ? `${String(h).padStart(2, '0')}h${String(mm).padStart(2, '0')}` : `${String(h).padStart(2, '0')}h` }
export const slotRange = (s: { from: number; to: number }): string => `${fmtH(s.from)}–${fmtH(s.to)}`
export const slotAs = (s: { from: number; to: number }): string => `das ${fmtH(s.from)} às ${fmtH(s.to)}`
export const slotLabel = (d: Pick<CampaignDraft, 'starts_on' | 'ends_on' | 'hourly'>, pos: number): string => { const s = slotByPos(d, pos); return s ? `${fmtDM(s.day)} · ${slotRange(s)}` : `Rodada ${pos}` }
export const hourlyMetricText = (cfg: HourlyCfg | null | undefined, v: number): string => (cfg?.metric === 'count' ? `${v} ${v === 1 ? 'venda' : 'vendas'}` : fmtBRL(v))

// ── validação (a tela e a API usam a MESMA) ──────────────────────────────────────
export function validateHourly(d: Pick<CampaignDraft, 'starts_on' | 'ends_on' | 'hourly' | 'prize' | 'prize_mode' | 'prizes' | 'teams'>, strict: boolean): string[] {
  const e: string[] = [], cfg = d.hourly
  if (!cfg) { if (strict) e.push('Configure o horário da campanha por hora (dia completo ou intervalos).'); return e }
  if (spanDays(d) > HOURLY_MAX_DAYS) e.push(`Campanha por hora pode durar no máximo ${HOURLY_MAX_DAYS} dias.`)
  if (cfg.mode === 'ranges') {
    if (cfg.ranges.length === 0) { if (strict) e.push('Adicione pelo menos um intervalo de horário.') }
    if (cfg.ranges.length > HOURLY_MAX_RANGES) e.push(`Use no máximo ${HOURLY_MAX_RANGES} intervalos.`)
    cfg.ranges.forEach((r, i) => {
      const n = i + 1
      if (!validRange(r)) { e.push(`Intervalo ${n}: o fim precisa ser depois do início.`); return }
      if (cfg.split === 'hour' && (r.to - r.from) % 60 !== 0) e.push(`Intervalo ${n} (${slotRange(r)}): para premiar por hora use horas fechadas (ex.: ${fmtH(r.from)}–${fmtH(r.from + Math.max(60, Math.round((r.to - r.from) / 60) * 60))}) ou escolha "um prêmio por intervalo".`)
    })
    const ok = cfg.ranges.filter(validRange).slice().sort((a, b) => a.from - b.from)
    for (let i = 1; i < ok.length; i++) if (ok[i].from < ok[i - 1].to) { e.push(`Os intervalos ${slotRange(ok[i - 1])} e ${slotRange(ok[i])} se sobrepõem.`); break }
  }
  if (d.prize_mode === 'tiered') {                                                   // um prêmio diferente por horário
    const per = slotsOfDay(cfg), teams = TEAMS.filter(t => d.teams[t])
    for (const t of teams) {
      const list = d.prizes?.[t] ?? [], missing: string[] = []
      per.forEach((s, i) => { const v = (list[i] ?? '').trim(); if (!v) missing.push(slotRange(s)); else if (v.length > 120) e.push(`O prêmio de ${slotRange(s)} pode ter até 120 caracteres.`) })
      if (strict && missing.length && per.length) { e.push(`Informe o prêmio de cada horário${missing.length === per.length ? '' : ` (faltam: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''})`}.`); break }
    }
  }
  return e
}

// ── prêmios ─────────────────────────────────────────────────────────────────────
/** Prêmio de uma rodada do dia (idx 0…). Com prêmio único é o mesmo sempre; senão vem da lista do time (ou da do outro time, se for a mesma). */
export function slotPrize(d: Pick<CampaignDraft, 'prize' | 'prize_mode' | 'prizes'>, team: Team, idx: number): string {
  if (d.prize_mode !== 'tiered') return d.prize.trim()
  const own = d.prizes?.[team] ?? TEAMS.map(t => d.prizes?.[t]).find(Boolean) ?? []
  return (own[idx] ?? '').trim()
}
/** Prêmio da rodada de número `pos` (o mesmo número gravado em campaign_winners.position). */
export function slotPrizeForPos(d: Pick<CampaignDraft, 'prize' | 'prize_mode' | 'prizes' | 'hourly'>, team: Team, pos: number): string {
  const n = slotsOfDay(d.hourly).length
  return n && Number.isInteger(pos) && pos >= 1 ? slotPrize(d, team, (pos - 1) % n) : ''
}
export function hourlyPrizeLine(d: Pick<CampaignDraft, 'prize' | 'prize_mode' | 'prizes' | 'hourly' | 'teams'>): string {
  if (d.prize_mode !== 'tiered') return `Prêmio: ${d.prize.trim()} (por rodada).`
  const team = TEAMS.find(t => d.teams[t]) ?? 'OAO', per = slotsOfDay(d.hourly)
  const items = per.map(s => `${slotRange(s)} ${slotPrize(d, team, s.idx)}`)
  return `Prêmios por horário: ${items.length > 6 ? `${items.slice(0, 4).join(', ')}… (${pl(items.length, 'horário', 'horários')})` : items.join(', ')}.`
}

// ── apuração ───────────────────────────────────────────────────────────────────
export interface HCredit { userId: string; at: string; value: number }
export interface HPerson { userId: string; name: string }
export interface SlotWinner { userId: string; name: string; metric: number; revenue: number; count: number; at: string }
export interface SlotResult extends DaySlot { closed: boolean; current: boolean; winner: SlotWinner | null }
export interface HourlyEval { slots: SlotResult[]; perUser: Map<string, { won: number; revenue: number; count: number }>; allClosed: boolean }

/**
 * Apura as rodadas de UM time. `credits` já vem filtrado (dias da campanha, recorrência, vertical, oferta/produto) e só com gente do time.
 * `today`/`nowMin` = agora no relógio de São Paulo (dia e minuto do dia). Uma rodada só fecha `SLOT_GRACE_MIN` minutos depois do fim.
 * Desempate: mais do outro número (receita ↔ vendas) → quem chegou ao resultado primeiro (última venda mais cedo) → id (estável).
 */
export function evalHourly(d: Pick<CampaignDraft, 'starts_on' | 'ends_on' | 'hourly'>, people: HPerson[], credits: HCredit[], today: string, nowMin: number): HourlyEval {
  const cfg = d.hourly, per = slotsOfDay(cfg), all = allSlots(d), base = DAY_RE.test(d.starts_on) ? dayNum(d.starts_on) : 0
  const byName = new Map(people.map(p => [p.userId, p.name]))
  const buckets = new Map<number, Map<string, { revenue: number; count: number; last: string }>>()
  const perUser = new Map<string, { won: number; revenue: number; count: number }>(people.map(p => [p.userId, { won: 0, revenue: 0, count: 0 }]))
  if (per.length) for (const c of credits) {
    if (!byName.has(c.userId)) continue
    const sp = spParts(c.at); if (!sp) continue
    const idx = per.findIndex(s => sp.min >= s.from && sp.min < s.to); if (idx < 0) continue
    const di = dayNum(sp.day) - base; if (di < 0 || di >= spanDays(d)) continue
    const pos = di * per.length + idx + 1
    const b = buckets.get(pos) ?? buckets.set(pos, new Map()).get(pos)!
    const x = b.get(c.userId) ?? { revenue: 0, count: 0, last: '' }
    x.revenue += c.value; x.count += 1; if (c.at > x.last) x.last = c.at; b.set(c.userId, x)
    const u = perUser.get(c.userId)!; u.revenue += c.value; u.count += 1
  }
  const absNow = (dayNum(today) - base) * DAY_MIN + nowMin
  const byCount = cfg?.metric === 'count'
  const slots: SlotResult[] = all.map(s => {
    const endAbs = (dayNum(s.day) - base) * DAY_MIN + s.to
    const closed = absNow >= endAbs + SLOT_GRACE_MIN
    const current = s.day === today && nowMin >= s.from && nowMin < s.to
    let best: SlotWinner | null = null
    for (const [uid, x] of buckets.get(s.pos) ?? []) {
      const cand: SlotWinner = { userId: uid, name: byName.get(uid) ?? '?', metric: byCount ? x.count : round2(x.revenue), revenue: round2(x.revenue), count: x.count, at: x.last }
      if (cand.metric <= 0) continue
      if (!best) { best = cand; continue }
      const sec = (z: SlotWinner) => (byCount ? z.revenue : z.count)
      const better = cand.metric !== best.metric ? cand.metric > best.metric : sec(cand) !== sec(best) ? sec(cand) > sec(best) : cand.at !== best.at ? cand.at < best.at : cand.userId < best.userId
      if (better) best = cand
    }
    return { ...s, closed, current, winner: best }
  })
  for (const s of slots) if (s.closed && s.winner) perUser.get(s.winner.userId)!.won++
  return { slots, perUser, allClosed: slots.length > 0 && slots.every(s => s.closed) }
}

// ── textos ──────────────────────────────────────────────────────────────────────
/** "em cada hora do dia (24h)" · "em cada hora entre 09h e 12h e entre 14h e 18h" · "em cada intervalo (09h–12h e 14h–18h)" */
export function hourlyScopeText(cfg: HourlyCfg): string {
  if (cfg.mode === 'full') return 'em cada hora do dia (24h)'
  const rs = sortedRanges(cfg), join = (l: string[]) => (l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`)
  if (cfg.split === 'hour') return `em cada hora ${join(rs.map(slotAs))}`
  return `em cada intervalo (${join(rs.map(slotRange))})`
}
export function howToWinHourly(d: Pick<CampaignDraft, 'hourly' | 'prize_mode'>, period: string): string {
  const cfg = d.hourly; if (!cfg) return 'Quem vender mais em cada horário ganha o prêmio.'
  const when = period.charAt(0).toUpperCase() + period.slice(1)
  const who = cfg.metric === 'count' ? 'quem fechar mais vendas' : 'quem vender mais (maior receita)'
  return `${when}, ${hourlyScopeText(cfg)}, ${who} em cada time ganha o prêmio${d.prize_mode === 'tiered' ? ' daquele horário' : ''}.`
}
export interface HMsg { title: string; body: string }
export function slotWinMessage(d: CampaignDraft, w: { team: Team; pos: number; name: string; metric: number; prize?: string | null }): HMsg {
  const s = slotByPos(d, w.pos), prize = (w.prize || slotPrizeForPos(d, w.team, w.pos) || 'o prêmio').trim()
  const quando = s ? `${fmtDM(s.day)}, ${slotAs(s)}` : `na rodada ${w.pos}`
  return {
    title: `⏰ Você ganhou o prêmio ${s ? slotAs(s) : `da rodada ${w.pos}`}: ${prize}!`,
    body: `Campanha ${d.name.trim()}: você ${d.hourly?.metric === 'count' ? 'fechou mais vendas' : 'vendeu mais'} que o time ${w.team} em ${quando} (${hourlyMetricText(d.hourly, w.metric)}). Parabéns!`,
  }
}
export function finishMessagesHourly(d: CampaignDraft, results: { team: Team; winners: { name: string; metric: number; prize?: string | null }[] }[]) {
  const name = d.name.trim()
  const line = (t: { team: Team; winners: { name: string }[] }) => {
    if (t.winners.length === 0) return `${t.team}: sem ganhadores`
    const by = new Map<string, number>(); for (const w of t.winners) by.set(firstWord(w.name), (by.get(firstWord(w.name)) ?? 0) + 1)
    return `${t.team}: ${[...by].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${pl(c, 'prêmio', 'prêmios')})`).join(', ')}`
  }
  const lines = results.map(line).join(' · ')
  return {
    personal: (w: { team: Team; metric: number; prize?: string | null }, _position: number) => ({ title: `🏆 Você ganhou: ${w.prize || ''}!`, body: `Campanha ${name}: parabéns!` }),
    everyone: { title: `🏁 Resultado: ${name}`, body: `${lines}.` },
    creator: { title: `✅ Campanha encerrada: ${name}`, body: `${lines}. Marque a entrega dos prêmios em Administração → Campanhas.` },
  }
}

/** Popup dos vencedores (SÓ nome e prêmio): rodadas de hoje (todas) + as anteriores que tiveram ganhador, da mais antiga para a mais nova (as últimas 60). */
export function hourlyTeamsView(d: Pick<CampaignDraft, 'starts_on' | 'ends_on' | 'hourly' | 'prize' | 'prize_mode' | 'prizes'>, allowed: Team[], winners: { team: string; position: number; user_id: string | null; user_name: string; prize?: string | null }[], userId: string, closed: boolean, today: string, nowMin: number) {
  const all = allSlots(d), base = DAY_RE.test(d.starts_on) ? dayNum(d.starts_on) : 0, absNow = (dayNum(today) - base) * DAY_MIN + nowMin
  return allowed.map(team => {
    const win = new Map(winners.filter(w => w.team === team).map(w => [Number(w.position), w]))
    const keep = all.filter(s => s.day === today || win.has(s.pos))
    const rows = (keep.length ? keep : all.filter(s => s.day === d.starts_on)).slice(-60)
    return {
      team,
      positions: rows.map(s => {
        const w = win.get(s.pos), isClosed = closed || absNow >= (dayNum(s.day) - base) * DAY_MIN + s.to + SLOT_GRACE_MIN
        return { position: s.pos, label: `${fmtDM(s.day)} · ${slotRange(s)}`, prize: (w?.prize || slotPrize(d, team, s.idx)) || null, winner: w ? { name: w.user_name, me: w.user_id === userId } : null, state: w ? 'winner' : isClosed ? 'empty' : 'pending' }
      }),
    }
  })
}

/** Para a prévia: a rodada de agora (e quem lidera nela) — ou a próxima. */
export function hourlyLiveInfo(slots: SlotResult[]): { current: { label: string; leader: string | null } | null; next: string | null; total: number; closed: number } {
  const cur = slots.find(s => s.current) ?? null, nxt = slots.find(s => !s.closed && !s.current && (!cur || s.pos > cur.pos)) ?? null
  return { current: cur ? { label: `${fmtDM(cur.day)} · ${slotRange(cur)}`, leader: cur.winner ? cur.winner.name : null } : null, next: nxt ? `${fmtDM(nxt.day)} · ${slotRange(nxt)}` : null, total: slots.length, closed: slots.filter(s => s.closed).length }
}
export const hourlyConfigKey = (cfg: HourlyCfg | null | undefined): string => (cfg ? JSON.stringify([cfg.mode, cfg.mode === 'full' ? 'hour' : cfg.split, cfg.metric, slotsOfDay(cfg).map(s => [s.from, s.to])]) : 'null')
