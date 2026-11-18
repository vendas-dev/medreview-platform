// @ts-nocheck — teste com banco de mentira e dados soltos; roda com: node tests/unit/rodar.mjs
// Campanhas: critério "CONTÉM" (valores concatenados com ;) e as duas caixinhas de aviso (criação / resultado).
import assert from 'node:assert/strict'
import { offerMatches, saleValues, saleMatchesFilter } from '../../lib/telao/offer'
import { eventGroup, mayNotify, rowToDraft, draftToDb } from '../../lib/campaigns/server'
import { parseDraft } from '../../lib/campaigns/api'
import { emptyDraft } from '../../lib/campaigns/types'
import { attributeSales, evaluate } from '../../lib/campaigns/engine'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }

t('saleValues separa por ; , | e espaço, minúsculo, sem repetir', () => {
  assert.deepEqual(saleValues('1234;5678'), ['1234', '5678']); assert.deepEqual(saleValues(' DygHjalk ; yagbthgk '), ['dyghjalk', 'yagbthgk'])
  assert.deepEqual(saleValues('a;a,A'), ['a']); assert.deepEqual(saleValues(null), []); assert.deepEqual(saleValues(''), []); assert.deepEqual(saleValues(2366290), ['2366290'])
})
t('CONTÉM: campo com 2 IDs casa com qualquer um dos dois', () => {
  assert.equal(offerMatches(['5678'], '1234;5678'), true); assert.equal(offerMatches(['1234'], '1234;5678'), true); assert.equal(offerMatches(['9999'], '1234;5678'), false)
})
t('CONTÉM: 2 códigos de oferta, maiúscula não importa', () => {
  assert.equal(offerMatches(['YAGBTHGK'], 'dyghjalk;yagbthgk'), true); assert.equal(offerMatches(['dyghjalk'], 'dyghjalk;yagbthgk'), true)
})
t('valor igual de sempre continua casando', () => { assert.equal(offerMatches(['8h0jsbyi'], '8h0jsbyi'), true); assert.equal(offerMatches(['8h0jsbyi'], ' 8H0JSBYI '), true) })
t('não casa pedaço de valor ("123" não pega "12345"), nem vazio/nulo', () => {
  assert.equal(offerMatches(['123'], '12345'), false); assert.equal(offerMatches(['123'], '12345;999'), false); assert.equal(offerMatches(['123'], null), false); assert.equal(offerMatches(['123'], ''), false)
})
t('sem filtro entra tudo', () => { assert.equal(offerMatches(null, 'x'), true); assert.equal(offerMatches([], null), true) })
t('produto E oferta / OU com campos concatenados', () => {
  const f = { product_ids: ['5678'], offer_codes: ['yagbthgk'] }
  assert.equal(saleMatchesFilter({ ...f, filter_logic: 'and' }, { product: '1234;5678', offer: 'dyghjalk;yagbthgk' }), true)
  assert.equal(saleMatchesFilter({ ...f, filter_logic: 'and' }, { product: '1234;5678', offer: 'zzz' }), false)
  assert.equal(saleMatchesFilter({ ...f, filter_logic: 'or' }, { product: '1234;5678', offer: 'zzz' }), true)
})

// campanha de verdade: venda com 2 produtos concatenados conta
const P = [{ userId: 'u1', name: 'Ana', team: 'OAO' as const, hubspotId: 'h1' }]
const sale = (id: string, extra: any) => ({ id, event_type: 'sale', vertical: 'anestreview', value: 100, occurred_at: '2026-11-18T15:00:00Z', closer_id: null, closer_hubspot_id: 'h1', closer_name: 'Ana', co_closer_id: null, co_closer_hubspot_id: null, is_self_checkout: false, is_recurring: false, installment_number: 1, sale_type: null, ...extra })
const base = { ...emptyDraft('2026-11-18'), ends_on: '2026-11-20', teams: { OAO: { winners: 1, target: null } } }
t('campanha por produto: venda "1234;5678" conta para a campanha do 5678; outra não', () => {
  const d = { ...base, product_ids: ['5678'] }
  const credits = attributeSales([sale('a', { product_id: '1234;5678' }), sale('b', { product_id: '1234' }), sale('c', { product_id: '5678' })] as any, P as any, [] as any)
  const ev = evaluate(d as any, P as any, credits, '2026-11-19')
  assert.equal(ev.teams[0].standings[0].count, 2); assert.equal(ev.teams[0].standings[0].revenue, 200)
})
t('campanha só por oferta: "dyghjalk;yagbthgk" conta para a oferta yagbthgk', () => {
  const d = { ...base, offer_codes: ['yagbthgk'] }
  const credits = attributeSales([sale('a', { offer_code: 'dyghjalk;yagbthgk' }), sale('b', { offer_code: 'outra' })] as any, P as any, [] as any)
  assert.equal(evaluate(d as any, P as any, credits, '2026-11-19').teams[0].standings[0].count, 1)
})

// caixinhas
t('eventGroup: lançamento/1º dia/cancelamento = criação; vitória, faixa e fechamento = resultado', () => {
  for (const k of ['launch', 'start', 'cancel']) assert.equal(eventGroup(k), 'creation')
  for (const k of ['win:personal:OAO:1', 'win:others:R1:2', 'tier:OAO:u1:0', 'tier:personal:x', 'finish:personal:OAO:1', 'finish:everyone', 'finish:creator']) assert.equal(eventGroup(k), 'result')
})
t('mayNotify: as 4 combinações', () => {
  const m = (notify: boolean, notify_result: boolean, k: string) => mayNotify({ notify, notify_result }, k)
  assert.deepEqual([m(true, false, 'launch'), m(true, false, 'finish:everyone'), m(true, false, 'win:personal:OAO:1')], [true, false, false])
  assert.deepEqual([m(false, true, 'launch'), m(false, true, 'start'), m(false, true, 'finish:personal:OAO:1'), m(false, true, 'tier:a')], [false, false, true, true])
  assert.deepEqual([m(true, true, 'launch'), m(true, true, 'finish:everyone')], [true, true])
  assert.deepEqual([m(false, false, 'launch'), m(false, false, 'finish:everyone')], [false, false])
})
t('rowToDraft: linha antiga (sem a coluna) segue o notify de antes', () => {
  const r: any = { name: 'x', criterion: 'revenue_rank', starts_on: '2026-11-18', ends_on: '2026-11-19', teams: {} }
  assert.equal(rowToDraft({ ...r, notify: true }).notify_result, true); assert.equal(rowToDraft({ ...r, notify: false }).notify_result, false)
  assert.equal(rowToDraft({ ...r, notify: true, notify_result: false }).notify_result, false); assert.equal(rowToDraft({ ...r, notify: false, notify_result: true }).notify_result, true)
})
t('parseDraft: notify_result padrão ligado; só desliga com false', () => {
  assert.equal(parseDraft({}).notify_result, true); assert.equal(parseDraft({ notify_result: false })!.notify_result, false); assert.equal(parseDraft({ notify: false })!.notify, false)
})
t('draftToDb: só grava notify_result quando preciso (antes do SQL, salvar "ligado" continua funcionando)', () => {
  const d = { ...base, name: 'x' } as any
  assert.equal('notify_result' in draftToDb({ ...d, notify_result: true }), false)
  assert.equal(draftToDb({ ...d, notify_result: false }).notify_result, false)
  assert.equal(draftToDb({ ...d, notify_result: true }, { notifyResult: true }).notify_result, true)
})
console.log(`\n${n} testes de campanhas passaram`)
