// @ts-nocheck — Campanhas · critério POR HORA com DATAS EXATAS (ex.: 27/11 16h → 28/11 01h). Roda com: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { fakeAdmin } from './_banco_de_mentira'
import { allSlots, cleanHourly, evalHourly, exactSpan, fmtH, hourlyConfigKey, hourlyScopeText, isExactHourly, shiftHourly, slotByPos, slotLabel, slotPrizeForPos, slotsOfDay, validateHourly } from '../../lib/campaigns/hourly'
import { attributeSales, evaluate, ruleSignature, validateDraft } from '../../lib/campaigns/engine'
import { draftToDb, publishCampaign, rowToDraft, runCampaignTick } from '../../lib/campaigns/server'
import { parseDraft } from '../../lib/campaigns/api'
import { emptyDraft } from '../../lib/campaigns/types'
import { hCampaignAction, hGetCampaign, hPreview } from '../../lib/campaigns/handlers'

let n = 0
const t = async (nome: string, f: () => void | Promise<void>) => { await f(); n++; console.log('ok  ' + nome) }
const sp = (day: string, hhmm: string, sec = '00', ms = '000') => `${day}T${hhmm}:${sec}.${ms}-03:00`
const iso = (s: string) => new Date(s).toISOString()

const A = '2026-11-27', B = '2026-11-28'
const exact = (ranges: any[], over: any = {}) => ({ mode: 'ranges', split: 'hour', metric: 'revenue', exact: true, ranges, ...over })
const noite = exact([{ day: A, from: 960, to: 60, endDay: B }])                                    // 27/11 16h → 28/11 01h
const mk = (over: any = {}) => ({ ...emptyDraft(A), name: 'Virada', prize: 'Vale 50', criterion: 'hourly', starts_on: A, ends_on: B, teams: { OAO: { winners: 1, target: null }, R1: { winners: 1, target: null } }, hourly: noite, ...over })
const P = [{ userId: 'u1', name: 'Ana', team: 'OAO', hubspotId: 'h1' }, { userId: 'u2', name: 'Bia', team: 'OAO', hubspotId: 'h2' }, { userId: 'u3', name: 'Caio', team: 'R1', hubspotId: 'h3' }]
const people = [{ userId: 'u1', name: 'Ana' }, { userId: 'u2', name: 'Bia' }]
const cr = (u: string, v: number, at: string) => ({ userId: u, value: v, at: iso(at) })

await t('rodadas: 27/11 16h → 28/11 01h = 9 rodadas de 1h, em ordem, virando a meia-noite (16–17 … 23–24 do dia 27 e 00–01 do dia 28)', () => {
  const s = slotsOfDay(noite); assert.equal(s.length, 9)
  assert.deepEqual(s.map(x => [x.day, x.from, x.to]), [[A, 960, 1020], [A, 1020, 1080], [A, 1080, 1140], [A, 1140, 1200], [A, 1200, 1260], [A, 1260, 1320], [A, 1320, 1380], [A, 1380, 1440], [B, 0, 60]])
  const d = mk(); const all = allSlots(d); assert.deepEqual(all.map(x => x.pos), [1, 2, 3, 4, 5, 6, 7, 8, 9]); assert.equal(slotByPos(d, 9).day, B); assert.equal(slotByPos(d, 10), null); assert.equal(slotByPos(d, 0), null)
  assert.equal(slotLabel(d, 1), '27/11 · 16h–17h'); assert.equal(slotLabel(d, 9), '28/11 · 00h–01h'); assert.equal(isExactHourly(noite), true)
})
await t('datas da campanha saem dos intervalos (exactSpan) e o texto de "como ganhar" mostra as duas datas', () => {
  assert.deepEqual(exactSpan(noite), { starts_on: A, ends_on: B })
  assert.deepEqual(exactSpan(exact([{ day: '2026-11-30', from: 540, to: 720, endDay: '2026-11-30' }, { day: A, from: 960, to: 60, endDay: B }])), { starts_on: A, ends_on: '2026-11-30' })
  assert.equal(exactSpan(exact([])), null); assert.equal(exactSpan({ mode: 'full', split: 'hour', metric: 'revenue', ranges: [] }), null)
  assert.match(hourlyScopeText(noite), /em cada hora de 27\/11 16h até 28\/11 01h/)
})
await t('fim às 00h do dia seguinte = meia-noite: a campanha termina no dia anterior (27/11 16h → 28/11 00h = 8 rodadas, ends_on 27/11)', () => {
  const h = exact([{ day: A, from: 960, to: 0, endDay: B }]); assert.equal(slotsOfDay(h).length, 8); assert.deepEqual(exactSpan(h), { starts_on: A, ends_on: A })
  assert.deepEqual(validateHourly(mk({ hourly: h, ends_on: A }), true), []); assert.equal(slotsOfDay(h)[7].to, 1440)
})
await t('por intervalo inteiro: uma rodada só, de 27/11 16h a 28/11 01h; rótulo com as duas datas', () => {
  const w = exact([{ day: A, from: 960, to: 60, endDay: B }], { split: 'whole' }); const s = slotsOfDay(w); assert.equal(s.length, 1); assert.deepEqual([s[0].day, s[0].from, s[0].to], [A, 960, 1500])
  const d = mk({ hourly: w }); assert.equal(slotLabel(d, 1), '27/11 16h → 28/11 01h'); assert.equal(fmtH(1500), '01h')
})
await t('apuração: venda às 23:59:59 do dia 27 é da rodada 23–24; 00:00 do dia 28 é da 00–01; 15:59 e 01:00 ficam de fora', () => {
  const d = mk(), credits = [cr('u1', 100, sp(A, '16:00')), cr('u2', 50, sp(A, '23:59', '59')), cr('u1', 7, sp(B, '00:00')), cr('u2', 900, sp(A, '15:59', '59')), cr('u1', 900, sp(B, '01:00')), cr('u1', 5, sp(B, '00:59', '59'))]
  const r = evalHourly(d, people, credits, B, 600), by = (p: number) => r.slots[p - 1].winner
  assert.equal(by(1).userId, 'u1'); assert.equal(by(8).userId, 'u2'); assert.equal(by(9).userId, 'u1'); assert.equal(by(9).revenue, 12)
  assert.equal(r.slots.filter(s => s.winner).length, 3); assert.ok(r.allClosed)
  assert.equal(r.perUser.get('u1').revenue, 112); assert.equal(r.perUser.get('u2').revenue, 50)      // as fora do intervalo NÃO entram nem nos totais
})
await t('rodada atual e fechamento (com tolerância) cruzando a meia-noite', () => {
  const d = mk(), at = (day: string, hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return [day, h * 60 + m] as const }
  let r = evalHourly(d, people, [], ...at(A, '23:30')); assert.equal(r.slots.find(s => s.current).pos, 8); assert.equal(r.slots[6].closed, true); assert.equal(r.slots[7].closed, false)
  r = evalHourly(d, people, [], ...at(B, '00:30')); assert.equal(r.slots.find(s => s.current).pos, 9); assert.equal(r.slots[7].closed, true)
  r = evalHourly(d, people, [], ...at(B, '01:04')); assert.equal(r.allClosed, false); r = evalHourly(d, people, [], ...at(B, '01:05')); assert.equal(r.allClosed, true)
  r = evalHourly(d, people, [], ...at(A, '15:00')); assert.equal(r.slots.some(s => s.current), false)
})
await t('vários intervalos: 27/11 16h → 28/11 01h e 29/11 10h → 12h; numeração contínua e sem repetir em outros dias', () => {
  const h = exact([{ day: '2026-11-29', from: 600, to: 720, endDay: '2026-11-29' }, { day: A, from: 960, to: 60, endDay: B }])      // fora de ordem de propósito
  const d = mk({ hourly: h, ends_on: '2026-11-29' }); const all = allSlots(d); assert.equal(all.length, 11)
  assert.deepEqual([all[8].day, all[9].day, all[9].from, all[10].to], [B, '2026-11-29', 600, 720]); assert.equal(slotByPos(d, 10).pos, 10)
  const r = evalHourly(d, people, [cr('u1', 10, sp('2026-11-29', '10:30')), cr('u2', 10, sp(B, '12:00'))], '2026-11-30', 100); assert.equal(r.slots[9].winner.userId, 'u1'); assert.equal(r.slots.filter(s => s.winner).length, 1)
})
await t('validação: sem datas, fim antes do início, sobreposição, horas não fechadas e mais de 31 dias', () => {
  const v = (h: any, over: any = {}) => validateHourly(mk({ hourly: h, ...over }), true)
  assert.deepEqual(v(noite), [])
  assert.match(v(exact([{ from: 960, to: 60 }]))[0], /informe a data de início e a de fim/)
  assert.match(v(exact([{ day: A, from: 960, to: 900, endDay: A }]))[0], /o fim precisa ser depois do início/)
  assert.match(v(exact([{ day: A, from: 960, to: 960, endDay: B }, { day: A, from: 1020, to: 1080, endDay: A }]))[0], /se sobrepõem/)
  assert.match(v(exact([{ day: A, from: 960, to: 90, endDay: B }]))[0], /horas fechadas/); assert.deepEqual(v(exact([{ day: A, from: 960, to: 90, endDay: B }], { split: 'whole' })), [])
  assert.match(v(exact([{ day: A, from: 0, to: 60, endDay: '2027-01-05' }]))[0], /no máximo 31 dias/)
  assert.match(v(exact([]))[0], /pelo menos um intervalo/); assert.deepEqual(validateHourly(mk({ hourly: exact([]) }), false), [])
})
await t('validateDraft: as datas da campanha precisam ser as dos intervalos; parseDraft as corrige sozinho (não confia na tela)', () => {
  assert.deepEqual(validateDraft(mk(), true), []); assert.ok(validateDraft(mk({ ends_on: '2026-11-29' }), true).some(e => /datas da campanha precisam ser as dos intervalos/.test(e)))
  const p = parseDraft({ ...mk(), starts_on: '2020-01-01', ends_on: '2020-01-02' }); assert.equal(p.starts_on, A); assert.equal(p.ends_on, B)
  const c = parseDraft(mk({ hourly: { ...noite, junk: 1 } })); assert.equal(c.hourly.exact, true); assert.deepEqual(c.hourly.ranges[0], { from: 960, to: 60, day: A, endDay: B })
})
await t('cleanHourly: lixo nas datas some; o modo antigo (repete todo dia) continua idêntico e sem campos novos', () => {
  const c = cleanHourly({ mode: 'ranges', exact: true, ranges: [{ from: 1, to: 2, day: '2026-02-31', endDay: 'x' }] }); assert.equal(c.exact, true); assert.deepEqual(c.ranges[0], { from: 1, to: 2 })
  const old = cleanHourly({ mode: 'ranges', split: 'hour', metric: 'revenue', exact: false, ranges: [{ from: 540, to: 720, day: A }] }); assert.deepEqual(old, { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 540, to: 720 }] }); assert.equal('exact' in old, false)
  assert.equal(cleanHourly({ mode: 'full', exact: true, ranges: [] }).exact, undefined)
})
await t('assinatura da regra muda com as datas dos intervalos; a do modo antigo não muda', () => {
  const a = ruleSignature(mk()), b = ruleSignature(mk({ hourly: exact([{ day: A, from: 960, to: 120, endDay: B }]) })); assert.notEqual(a, b)
  const old = { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 540, to: 720 }] }; assert.equal(hourlyConfigKey(old), JSON.stringify(['ranges', 'hour', 'revenue', [[540, 600], [600, 660], [660, 720]]]))
})
await t('prêmios por horário: o índice é o da rodada na campanha inteira (9 prêmios), e nada fora disso', () => {
  const d = mk({ prize_mode: 'tiered', prizes: { OAO: Array.from({ length: 9 }, (_, i) => `P${i + 1}`), R1: [] } })
  assert.equal(slotPrizeForPos(d, 'OAO', 1), 'P1'); assert.equal(slotPrizeForPos(d, 'OAO', 9), 'P9'); assert.equal(slotPrizeForPos(d, 'OAO', 10), ''); assert.equal(slotPrizeForPos(d, 'OAO', 0), '')
})
await t('duplicar: as datas dos intervalos andam junto com as da campanha (7 dias)', () => {
  const s = shiftHourly(noite, 7); assert.deepEqual(s.ranges[0], { from: 960, to: 60, day: '2026-12-04', endDay: '2026-12-05' }); assert.deepEqual(exactSpan(s), { starts_on: '2026-12-04', ends_on: '2026-12-05' })
  const old = { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 540, to: 720 }] }; assert.equal(shiftHourly(old, 7), old); assert.equal(shiftHourly(null, 7), null)
})

// ── servidor: publica, apura e fecha uma campanha que vira a meia-noite ──
const profiles = [
  { id: 'u1', name: 'Ana Souza', role: 'consultor', team: 'OAO', hubspot_id: 'h1', is_active: true },
  { id: 'u2', name: 'Bia Lima', role: 'consultor', team: 'OAO', hubspot_id: 'h2', is_active: true },
  { id: 'u3', name: 'Caio Reis', role: 'consultor', team: 'R1', hubspot_id: 'h3', is_active: true },
  { id: 'adm', name: 'Admin', role: 'superadmin', team: null, hubspot_id: null, is_active: true },
]
const sale = (id: string, hub: string, value: number, at: string, extra: any = {}) => ({ id, event_type: 'sale', vertical: 'anestreview', value, occurred_at: iso(at), closer_id: null, closer_hubspot_id: hub, closer_name: null, co_closer_id: null, co_closer_hubspot_id: null, is_self_checkout: false, is_recurring: false, installment_number: 1, sale_type: null, ...extra })
const sales = [sale('s1', 'h1', 100, sp(A, '16:10')), sale('s2', 'h2', 200, sp(A, '16:40')), sale('s3', 'h3', 50, sp(A, '23:50')), sale('s4', 'h1', 80, sp(B, '00:20')), sale('s5', 'h1', 999, sp(B, '01:30')), sale('s6', 'h2', 999, sp(A, '15:30'))]
const row = (over: any = {}) => ({ id: 'c1', ...draftToDb(mk()), status: 'draft', created_by: 'adm', created_at: '2026-11-01T00:00:00Z', launched_at: null, finalized_at: null, notify: true, notify_result: true, ...over })
const mkDb = (over: any = {}) => fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [row(over)], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
const wins = (a: any) => (a.db.campaign_winners as any[]).map(w => `${w.team}:${w.position}:${w.user_id}`).sort()
await t('SERVIDOR: grava as datas e o intervalo; vira a meia-noite; vendas fora (15h30 e 01h30) não valem; fecha só às 01:05 do dia 28', async () => {
  const row0 = row(); assert.equal(row0.starts_on, A); assert.equal(row0.ends_on, B); assert.equal(row0.hourly.exact, true)
  const a = mkDb(); assert.equal((await publishCampaign(a as any, 'c1', new Date(iso(sp(A, '12:00'))))).ok, true)
  await runCampaignTick(a as any, { now: new Date(iso(sp(A, '17:10'))) }); assert.deepEqual(wins(a), ['OAO:1:u2'])           // 16–17: Bia (200) ganha o OAO
  await runCampaignTick(a as any, { now: new Date(iso(sp(B, '00:30'))) }); assert.deepEqual(wins(a), ['OAO:1:u2', 'R1:8:u3'])  // 23–24: Caio (R1); a 00–01 ainda está aberta
  assert.ok(!(a.db.campaigns as any[])[0].finalized_at)
  await runCampaignTick(a as any, { now: new Date(iso(sp(B, '01:04'))) }); assert.ok(!(a.db.campaigns as any[])[0].finalized_at)
  await runCampaignTick(a as any, { now: new Date(iso(sp(B, '01:05'))) }); assert.deepEqual(wins(a), ['OAO:1:u2', 'OAO:9:u1', 'R1:8:u3'])
  assert.ok((a.db.campaigns as any[])[0].finalized_at)
  const w9 = (a.db.campaign_winners as any[]).find(w => w.position === 9); assert.equal(w9.prize, 'Vale 50')
  const nt = (a.db.notifications as any[]).find(x => x.event_key === 'slot:personal:OAO:9'); console.log('      ·', nt.title, '|', nt.body); assert.match(nt.title, /das 00h às 01h/); assert.match(nt.body, /28\/11, das 00h às 01h/)
})
await t('API: detalhe traz as 9 rodadas; prévia mostra a rodada de agora com data; duplicar leva as datas dos intervalos junto', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(iso(sp(A, '12:00'))))
  const now = new Date(iso(sp(A, '16:30')))
  const g = await hGetCampaign(a as any, 'c1', now); assert.equal(g.json.evaluation.teams[0].slots.length, 9)
  const p = await hPreview(a as any, { draft: { ...rowToDraft((a.db.campaigns as any[])[0]) } }, now)
  const oao = p.json.teams.find((x: any) => x.team === 'OAO'); assert.equal(oao.hourly.current.label, '27/11 · 16h–17h'); assert.equal(oao.hourly.current.leader, 'Bia Lima'); assert.equal(oao.hourly.total, 9)
  const dup = await hCampaignAction(a as any, 'c1', 'adm', { action: 'duplicate', shiftDays: 7 }, now); assert.equal(dup.status, 200)
  const copy = (a.db.campaigns as any[]).find(c => c.id === dup.json.id); assert.equal(copy.starts_on, '2026-12-04'); assert.equal(copy.ends_on, '2026-12-05')
  assert.deepEqual(copy.hourly.ranges[0], { from: 960, to: 60, day: '2026-12-04', endDay: '2026-12-05' }); assert.equal(copy.hourly.exact, true)
})
console.log(`\n${n} testes por hora (datas exatas) passaram`)
