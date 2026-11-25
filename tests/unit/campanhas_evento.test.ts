// @ts-nocheck — teste com banco de mentira; roda com: node tests/unit/rodar.mjs
// Campanhas · EVENTO: só os closers escolhidos concorrem e só eles recebem aviso.
import assert from 'node:assert/strict'
import { fakeAdmin } from './_banco_de_mentira'
import { cleanEvent, eventText, validateEvent, EVENT_MAX_CLOSERS } from '../../lib/campaigns/event'
import { howToWin, ruleSignature, validateDraft } from '../../lib/campaigns/engine'
import { draftToDb, publishCampaign, rowToDraft, runCampaignTick, loadParticipants } from '../../lib/campaigns/server'
import { parseDraft } from '../../lib/campaigns/api'
import { emptyDraft } from '../../lib/campaigns/types'
import { hCampaignAction, hCampaignWinnersView, hPatchCampaign, hPreview } from '../../lib/campaigns/handlers'

let n = 0
const t = async (nome: string, f: () => void | Promise<void>) => { await f(); n++; console.log('ok  ' + nome) }
const U = (k: number) => `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`
const [A, B, C, D, ADM] = [U(1), U(2), U(3), U(4), U(9)]
const DAY = '2026-11-24'
const profiles = [
  { id: A, name: 'Ana Souza', role: 'consultor', team: 'OAO', hubspot_id: 'h1', is_active: true },
  { id: B, name: 'Bia Lima', role: 'consultor', team: 'OAO', hubspot_id: 'h2', is_active: true },
  { id: C, name: 'Caio Reis', role: 'consultor', team: 'R1', hubspot_id: 'h3', is_active: true },
  { id: D, name: 'Duda Melo', role: 'consultor', team: 'R1', hubspot_id: 'h4', is_active: true },
  { id: ADM, name: 'Admin', role: 'superadmin', team: null, hubspot_id: null, is_active: true },
]
const sale = (id: string, hub: string, value: number, at: string) => ({ id, event_type: 'sale', vertical: 'anestreview', value, occurred_at: new Date(at).toISOString(), closer_id: null, closer_hubspot_id: hub, closer_name: null, co_closer_id: null, co_closer_hubspot_id: null, is_self_checkout: false, is_recurring: false, installment_number: 1, sale_type: null })
// Bia (fora do evento) vende MAIS que a Ana; Duda (fora) vende mais que o Caio
const sales = [sale('s1', 'h1', 100, `${DAY}T12:00:00-03:00`), sale('s2', 'h2', 900, `${DAY}T12:10:00-03:00`), sale('s3', 'h3', 50, `${DAY}T12:20:00-03:00`), sale('s4', 'h4', 700, `${DAY}T12:30:00-03:00`)]
const ev = { name: 'Congresso X', closers: [A, C] }
const mk = (over: any = {}) => ({ ...emptyDraft(DAY), name: 'Corrida do evento', prize: 'Vale 100', criterion: 'revenue_rank', teams: { OAO: { winners: 1, target: null }, R1: { winners: 1, target: null } }, event: ev, ...over })
const row = (over: any = {}) => ({ id: 'c1', ...draftToDb(mk()), status: 'draft', created_by: ADM, created_at: '2026-11-01T00:00:00Z', launched_at: null, finalized_at: null, ...over })
const mkDb = (over: any = {}) => fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [row(over)], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
const rec = (a: any, key: string) => { const nt = (a.db.notifications as any[]).find(x => x.event_key === key); return nt ? (a.db.notification_recipients as any[]).filter(r => r.notification_id === nt.id).map(r => r.user_id).sort() : null }
const wins = (a: any) => (a.db.campaign_winners as any[]).map(w => `${w.team}:${w.position}:${w.user_id}`).sort()

await t('cleanEvent: só ids válidos, sem repetir, limita; nome aparado; qualquer outra coisa = null (campanha normal)', () => {
  assert.equal(cleanEvent(null), null); assert.equal(cleanEvent('x'), null); assert.equal(cleanEvent(undefined), null)
  assert.deepEqual(cleanEvent({ name: '  Evento  ', closers: [A, A.toUpperCase(), 'lixo', 5, C] }), { name: 'Evento', closers: [A, C] })
  assert.equal(cleanEvent({ closers: Array.from({ length: 200 }, (_, i) => U(i + 1)) }).closers.length, EVENT_MAX_CLOSERS)
  assert.deepEqual(cleanEvent({ closers: 'x' }), { name: '', closers: [] })
})
await t('validação: evento sem closer só passa como rascunho; campanha normal não é afetada', () => {
  assert.deepEqual(validateEvent({ event: null }, true), []); assert.deepEqual(validateEvent({}, true), [])
  assert.equal(validateEvent({ event: { name: '', closers: [] } }, true).length, 1); assert.deepEqual(validateEvent({ event: { name: '', closers: [] } }, false), [])
  assert.deepEqual(validateDraft(mk(), true), []); assert.ok(validateDraft(mk({ event: { name: 'X', closers: [] } }), true).some(e => /closer que vai ao evento/.test(e)))
  assert.deepEqual(validateDraft(mk({ event: { name: 'X', closers: [] } }), false), [])
  assert.ok(validateDraft(mk({ event: { name: 'x'.repeat(61), closers: [A] } }), true).some(e => /nome do evento/.test(e)))
})
await t('texto da regra: avisa que é exclusiva; campanha normal fica igual a antes', () => {
  assert.match(howToWin(mk()), /🎪 Campanha exclusiva dos 2 closers que vão ao evento Congresso X\./)
  assert.match(eventText({ event: { name: '', closers: [A] } }), /do closer que vai ao evento\./)
  assert.equal(eventText({}), ''); assert.equal(howToWin(mk({ event: null })).includes('🎪'), false)
})
await t('assinatura da regra: trocar quem vai ao evento muda; ordem e nome do evento não; campanha normal mantém a assinatura antiga', () => {
  const s = (e: any) => ruleSignature(mk({ event: e }))
  assert.notEqual(s({ name: 'X', closers: [A, C] }), s({ name: 'X', closers: [A, C, D] }))
  assert.equal(s({ name: 'X', closers: [A, C] }), s({ name: 'Outro nome', closers: [C, A] }))
  assert.equal(ruleSignature(mk({ event: null })), ruleSignature({ ...mk({ event: null }), event: undefined })); assert.ok(!ruleSignature(mk({ event: null })).includes('evento'))
})
await t('parseDraft / draftToDb / rowToDraft: vai e volta; campanha normal NÃO grava a coluna (funciona antes do SQL); voltar a normal limpa', () => {
  const d = parseDraft({ ...mk(), event: { name: 'Congresso X', closers: [A, 'lixo', C] } }); assert.deepEqual(d.event, ev)
  assert.equal(parseDraft({ ...mk(), event: undefined }).event, null)
  assert.deepEqual(draftToDb(d).event, ev); assert.equal('event' in draftToDb(emptyDraft(DAY)), false)
  assert.equal(draftToDb(emptyDraft(DAY), { event: true }).event, null)
  assert.deepEqual(rowToDraft({ ...draftToDb(d), id: 'x' }).event, ev); assert.equal(rowToDraft({ ...draftToDb(emptyDraft(DAY)) }).event, null)
})
await t('loadParticipants: com lista, só quem está nela (e do time pedido); sem lista, o time todo', async () => {
  const a = mkDb()
  assert.deepEqual((await loadParticipants(a as any, ['OAO', 'R1'], [A, C])).map(p => p.userId).sort(), [A, C])
  assert.deepEqual((await loadParticipants(a as any, ['OAO'], [A, C])).map(p => p.userId), [A])
  assert.equal((await loadParticipants(a as any, ['OAO', 'R1'])).length, 4); assert.equal((await loadParticipants(a as any, ['OAO', 'R1'], [])).length, 0)
  assert.deepEqual((await loadParticipants(a as any, ['OAO', 'R1'], [A.toLowerCase(), ADM])).map(p => p.userId), [A])      // superadmin nunca concorre
})
await t('SERVIDOR: Bia e Duda vendem mais, mas NÃO concorrem — ganham Ana (OAO) e Caio (R1)', async () => {
  const a = mkDb(); assert.equal((await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`))).ok, true)
  await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  assert.deepEqual(wins(a), [`OAO:1:${A}`, `R1:1:${C}`]); assert.ok((a.db.campaigns as any[])[0].finalized_at)
})
await t('AVISOS: lançamento, "só ganhou", resultado e criador — só para quem vai ao evento (nenhum aviso para Bia/Duda)', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  assert.deepEqual(rec(a, 'launch'), [A, C].sort()); assert.deepEqual(rec(a, 'finish:everyone'), [A, C].sort())
  assert.deepEqual(rec(a, `finish:personal:OAO:1`), [A]); assert.deepEqual(rec(a, `finish:personal:R1:1`), [C]); assert.deepEqual(rec(a, 'finish:creator'), [ADM])
  const all = new Set((a.db.notification_recipients as any[]).map(r => r.user_id)); assert.ok(!all.has(B) && !all.has(D))
  const lm = (a.db.notifications as any[]).find(x => x.event_key === 'launch'); console.log('      ·', lm.title, '|', lm.body.slice(0, 200)); assert.match(lm.body, /exclusiva/)
})
await t('AVISOS: corrida do evento — o aviso "fulano bateu" só vai para os outros closers do evento', async () => {
  const a = mkDb({ criterion: 'first_revenue', teams: { OAO: { winners: 1, target: 50 }, R1: { winners: 1, target: 40 } }, ...draftToDb(mk({ criterion: 'first_revenue', teams: { OAO: { winners: 1, target: 50 }, R1: { winners: 1, target: 40 } }, event: { name: 'X', closers: [A, B, C] } })) })
  await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date(`${DAY}T20:00:00-03:00`) })
  assert.deepEqual(rec(a, 'win:others:OAO:1'), [B])      // Bia bateu 900 antes? não: Ana (12:00) foi a 1ª a bater R$50 → os outros do time DENTRO do evento = Bia
  assert.equal(rec(a, 'win:others:R1:1'), null)          // no R1 só o Caio está no evento: não há "outros" para avisar
  const all = new Set((a.db.notification_recipients as any[]).map(r => r.user_id)); assert.ok(!all.has(D))
})
await t('POPUP dos ganhadores: quem não vai ao evento recebe 403; quem vai e o superadmin veem', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`))
  assert.equal((await hCampaignWinnersView(a as any, B, 'c1')).status, 403); assert.equal((await hCampaignWinnersView(a as any, D, 'c1')).status, 403)
  assert.equal((await hCampaignWinnersView(a as any, A, 'c1')).status, 200); assert.equal((await hCampaignWinnersView(a as any, ADM, 'c1')).status, 200)
  const normal = mkDb({ event: null }); await publishCampaign(normal as any, 'c1', new Date(`${DAY}T10:00:00Z`)); assert.equal((await hCampaignWinnersView(normal as any, B, 'c1')).status, 200)
})
await t('PRÉVIA: conta só quem vai ao evento', async () => {
  const a = mkDb(); const r = await hPreview(a as any, { draft: mk() }, new Date(`${DAY}T15:00:00Z`))
  assert.deepEqual(r.json.participants, { OAO: 1, R1: 1 })
  const normal = await hPreview(a as any, { draft: mk({ event: null }) }, new Date(`${DAY}T15:00:00Z`)); assert.deepEqual(normal.json.participants, { OAO: 2, R1: 2 })
})
await t('EDITAR: tirar/colocar closer muda a regra → refaz ganhadores e avisos de resultado; só trocar o nome do evento não', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  const w0 = wins(a).join(); const r1 = await hPatchCampaign(a as any, 'c1', { draft: mk({ event: { name: 'Nome novo', closers: [A, C] } }) }, new Date('2026-11-25T13:00:00Z')); assert.equal(r1.json.ruleChanged, false); assert.equal(wins(a).join(), w0)
  const r2 = await hPatchCampaign(a as any, 'c1', { draft: mk({ event: { name: 'X', closers: [A, B, C] } }) }, new Date('2026-11-25T13:10:00Z')); assert.equal(r2.json.ruleChanged, true)
  assert.deepEqual(wins(a), [`OAO:1:${B}`, `R1:1:${C}`])      // agora a Bia (900) entra e leva o OAO
  assert.deepEqual((a.db.campaigns as any[])[0].event, { name: 'X', closers: [A, B, C] })
})
await t('EDITAR: voltar para "Times" (event = null) limpa a coluna e o time todo volta a concorrer', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  await hPatchCampaign(a as any, 'c1', { draft: mk({ event: null }) }, new Date('2026-11-25T13:00:00Z'))
  assert.equal((a.db.campaigns as any[])[0].event, null); assert.deepEqual(wins(a), [`OAO:1:${B}`, `R1:1:${D}`])
})
await t('DUPLICAR: leva o evento junto', async () => {
  const a = mkDb(); const r = await hCampaignAction(a as any, 'c1', ADM, { action: 'duplicate' })
  const copy = (a.db.campaigns as any[]).find(c => c.id === r.json.id); assert.deepEqual(copy.event, ev)
})
await t('CAMPANHA ANTIGA (sem coluna event) continua igual: todo o time concorre e é avisado', async () => {
  const old = row({ event: undefined }); delete old.event
  const a = fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [old], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
  await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); assert.deepEqual(rec(a, 'launch'), [A, B, C, D].sort())
})
console.log(`\n${n} testes de evento passaram`)
