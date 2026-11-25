// @ts-nocheck — teste com banco de mentira; roda com: node tests/unit/rodar.mjs
// Campanhas · closers DE FORA: qualquer campanha de times pode deixar closers de fora (ex.: a campanha "de casa" de quem não foi ao evento).
import assert from 'node:assert/strict'
import { fakeAdmin } from './_banco_de_mentira'
import { cleanExclude, scopeOf, excludeConfigKey, EXCLUDE_MAX } from '../../lib/campaigns/event'
import { howToWin, ruleSignature, validateDraft } from '../../lib/campaigns/engine'
import { draftToDb, publishCampaign, rowToDraft, runCampaignTick, loadParticipants } from '../../lib/campaigns/server'
import { parseDraft } from '../../lib/campaigns/api'
import { emptyDraft } from '../../lib/campaigns/types'
import { hCampaignAction, hCampaignWinnersView, hGetCampaign, hPatchCampaign, hPreview } from '../../lib/campaigns/handlers'

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
const fora = [A, C]      // quem foi ao evento: fica de fora da campanha "de casa"
const mk = (over: any = {}) => ({ ...emptyDraft(DAY), name: 'Corrida do evento', prize: 'Vale 100', criterion: 'revenue_rank', teams: { OAO: { winners: 1, target: null }, R1: { winners: 1, target: null } }, event: null, exclude: fora, ...over })
const row = (over: any = {}) => ({ id: 'c1', ...draftToDb(mk()), status: 'draft', created_by: ADM, created_at: '2026-11-01T00:00:00Z', launched_at: null, finalized_at: null, ...over })
const mkDb = (over: any = {}) => fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [row(over)], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
const rec = (a: any, key: string) => { const nt = (a.db.notifications as any[]).find(x => x.event_key === key); return nt ? (a.db.notification_recipients as any[]).filter(r => r.notification_id === nt.id).map(r => r.user_id).sort() : null }
const wins = (a: any) => (a.db.campaign_winners as any[]).map(w => `${w.team}:${w.position}:${w.user_id}`).sort()

await t('cleanExclude: só ids válidos, sem repetir, em minúsculas; lixo vira lista vazia; limita', () => {
  assert.deepEqual(cleanExclude(null), []); assert.deepEqual(cleanExclude('x'), []); assert.deepEqual(cleanExclude({}), [])
  assert.deepEqual(cleanExclude([A, A.toUpperCase(), 'lixo', 5, C]), [A, C])
  assert.equal(cleanExclude(Array.from({ length: 500 }, (_, i) => U(i + 1))).length, EXCLUDE_MAX)
})
await t('scopeOf / assinatura: evento usa só; normal usa skip; lista vazia não muda a assinatura antiga; trocar quem fica de fora muda', () => {
  assert.deepEqual(scopeOf({ event: { name: '', closers: [A] } }), { only: [A] }); assert.deepEqual(scopeOf({ exclude: [B] }), { skip: [B] }); assert.deepEqual(scopeOf({}), { skip: [] })
  const s = (e: any) => ruleSignature(mk({ exclude: e }))
  assert.equal(s([]), ruleSignature({ ...mk({}), exclude: undefined })); assert.ok(!s([]).includes('fora'))
  assert.notEqual(s([A, C]), s([A])); assert.equal(s([A, C]), s([C, A])); assert.equal(excludeConfigKey({ event: { name: '', closers: [A] }, exclude: [B] }), null)
})
await t('parseDraft / draftToDb / rowToDraft: vai e volta; sem ninguém de fora NÃO grava a coluna (funciona antes do SQL); limpar grava null; evento zera', () => {
  const d = parseDraft({ ...mk(), exclude: [A, 'lixo', C] }); assert.deepEqual(d.exclude, [A, C])
  assert.deepEqual(draftToDb(d).exclude, [A, C]); assert.equal('exclude' in draftToDb({ ...emptyDraft(DAY) }), false)
  assert.equal(draftToDb({ ...emptyDraft(DAY), exclude: [] }, { exclude: true }).exclude, null)
  assert.deepEqual(rowToDraft({ ...draftToDb(d), id: 'x' }).exclude, [A, C]); assert.deepEqual(rowToDraft({ ...draftToDb(emptyDraft(DAY)) }).exclude, [])
  assert.deepEqual(parseDraft({ ...mk(), event: { name: 'X', closers: [A] }, exclude: [B] }).exclude, [])
})
await t('loadParticipants: skip tira quem está na lista; array continua sendo "só estes"', async () => {
  const a = mkDb()
  assert.deepEqual((await loadParticipants(a as any, ['OAO', 'R1'], { skip: [A, C.toUpperCase()] })).map(p => p.userId).sort(), [B, D])
  assert.equal((await loadParticipants(a as any, ['OAO', 'R1'], { skip: [] })).length, 4); assert.equal((await loadParticipants(a as any, ['OAO', 'R1'])).length, 4)
  assert.deepEqual((await loadParticipants(a as any, ['OAO', 'R1'], [A, C])).map(p => p.userId).sort(), [A, C])
})
await t('SERVIDOR: quem foi ao evento (Ana/Caio) fica de fora — ganham Bia (OAO) e Duda (R1), que vendem mais', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  assert.deepEqual(wins(a), [`OAO:1:${B}`, `R1:1:${D}`])
})
await t('AVISOS: só para quem NÃO está na lista de fora (Ana e Caio não recebem nada)', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  assert.deepEqual(rec(a, 'launch'), [B, D].sort()); assert.deepEqual(rec(a, 'finish:everyone'), [B, D].sort())
  const all = new Set((a.db.notification_recipients as any[]).map(r => r.user_id)); assert.ok(!all.has(A) && !all.has(C))
})
await t('POPUP dos ganhadores: quem ficou de fora recebe 403; quem participa e o superadmin veem', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`))
  assert.equal((await hCampaignWinnersView(a as any, A, 'c1')).status, 403); assert.equal((await hCampaignWinnersView(a as any, C, 'c1')).status, 403)
  assert.equal((await hCampaignWinnersView(a as any, B, 'c1')).status, 200); assert.equal((await hCampaignWinnersView(a as any, ADM, 'c1')).status, 200)
})
await t('PRÉVIA: conta só quem participa', async () => {
  const a = mkDb(); const r = await hPreview(a as any, { draft: mk() }, new Date(`${DAY}T15:00:00Z`)); assert.deepEqual(r.json.participants, { OAO: 1, R1: 1 })
  const todos = await hPreview(a as any, { draft: mk({ exclude: [] }) }, new Date(`${DAY}T15:00:00Z`)); assert.deepEqual(todos.json.participants, { OAO: 2, R1: 2 })
})
await t('EDITAR: mudar quem fica de fora refaz ganhadores; limpar a lista zera a coluna e todos voltam', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
  const r1 = await hPatchCampaign(a as any, 'c1', { draft: mk({ exclude: [A] }) }, new Date('2026-11-25T13:00:00Z')); assert.equal(r1.json.ruleChanged, true)
  assert.deepEqual((a.db.campaigns as any[])[0].exclude, [A])
  await hPatchCampaign(a as any, 'c1', { draft: mk({ exclude: [] }) }, new Date('2026-11-25T13:10:00Z'))
  assert.equal((a.db.campaigns as any[])[0].exclude, null); assert.deepEqual(wins(a), [`OAO:1:${B}`, `R1:1:${D}`])
})
await t('DUPLICAR leva a lista de fora junto; campanha ANTIGA (sem a coluna) segue com todos', async () => {
  const a = mkDb(); const r = await hCampaignAction(a as any, 'c1', ADM, { action: 'duplicate' })
  assert.deepEqual((a.db.campaigns as any[]).find(c => c.id === r.json.id).exclude, fora)
  const old = row({ exclude: undefined }); delete old.exclude
  const b = fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [old], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
  await publishCampaign(b as any, 'c1', new Date(`${DAY}T10:00:00Z`)); assert.deepEqual(rec(b, 'launch'), [A, B, C, D].sort())
})
await t('FOTOS nos resultados: popup dos ganhadores, detalhe do admin e prévia levam a foto (sem foto = null, e a tela mostra as iniciais)', async () => {
  const ph = profiles.find((p: any) => p.id === B) as any, ph2 = profiles.find((p: any) => p.id === D) as any; ph.avatar_url = 'https://x.test/bia.png'; ph2.avatar_url = null
  try {
    const a = mkDb(); await publishCampaign(a as any, 'c1', new Date(`${DAY}T10:00:00Z`)); await runCampaignTick(a as any, { now: new Date('2026-11-25T12:00:00Z') })
    const v = await hCampaignWinnersView(a as any, ADM, 'c1'); const pos = (v.json.teams as any[]).flatMap(t => t.positions)
    assert.equal(pos.find((p: any) => p.winner?.name === 'Bia Lima')?.winner.avatar_url, 'https://x.test/bia.png'); assert.equal(pos.find((p: any) => p.winner && p.winner.name !== 'Bia Lima').winner.avatar_url, null)
    const g = await hGetCampaign(a as any, 'c1', new Date('2026-11-25T12:00:00Z')); assert.equal((g.json.winners as any[]).find(w => w.user_id === B).avatar_url, 'https://x.test/bia.png')
    assert.equal((g.json.evaluation as any).teams[0].standings.find((s: any) => s.userId === B).avatar_url, 'https://x.test/bia.png')
    const pv = await hPreview(a as any, { draft: mk() }, new Date(`${DAY}T15:00:00Z`)); assert.ok((pv.json.teams as any[]).some(t => t.top.some((r: any) => r.avatar_url === 'https://x.test/bia.png')))
  } finally { delete ph.avatar_url; delete ph2.avatar_url }
})
console.log(`\n${n} testes de participantes passaram`)
