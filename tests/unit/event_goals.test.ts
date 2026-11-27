// Testes da lógica pura de metas de evento. Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { belongsToEdition, POST_EVENT_DAYS, aggregate, buildGoals, editionStatus, eventDays, normName, parseConfig, rangesOverlap, isCountableSale, distribute, NO_PRODUCT, type SaleRow } from '../../lib/dashboard/eventGoalsCore'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const ed = { id: 'e1', name: 'Congresso', event_name: 'Congresso X 2026', start_date: '2026-11-18', end_date: '2026-11-20', notes: null }
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const roster = [
  { id: A, name: 'Ana', avatar_url: null, team: 'OAO', hubspot_id: ' 777 ' },
  { id: B, name: 'Bia', avatar_url: null, team: 'R1', hubspot_id: null },
]
const s = (o: Partial<SaleRow>): SaleRow => ({ value: 100, event_name: 'Congresso X 2026', closer_id: null, closer_hubspot_id: null, is_self_checkout: false, occurred_at: '2026-11-18T15:00:00Z', ...o })

t('normName ignora acento, caixa e espaços', () => assert.equal(normName('  CONGRESSO   Xé '), 'congresso xe'))
t('eventDays lista os dias', () => assert.deepEqual(eventDays('2026-11-18', '2026-11-20'), ['2026-11-18', '2026-11-19', '2026-11-20']))
t('eventDays inválido => vazio', () => { assert.deepEqual(eventDays('2026-11-20', '2026-11-18'), []); assert.deepEqual(eventDays('x', 'y'), []) })
t('status', () => { assert.equal(editionStatus(ed, '2026-11-17'), 'proximo'); assert.equal(editionStatus(ed, '2026-11-18'), 'andamento'); assert.equal(editionStatus(ed, '2026-11-20'), 'andamento'); assert.equal(editionStatus(ed, '2026-11-21'), 'encerrado') })
t('nome vazio não conta (mesmo com EV_)', () => { assert.equal(isCountableSale(s({ event_name: '' }), ed.event_name), false); assert.equal(isCountableSale(s({ event_name: '   ' }), ed.event_name), false); assert.equal(isCountableSale(s({ event_name: null }), ed.event_name), false) })
t('reembolsada não conta', () => assert.equal(isCountableSale(s({ is_refunded: true }), ed.event_name), false))
t('nome de outro evento não conta; acento/caixa diferente conta', () => { assert.equal(isCountableSale(s({ event_name: 'Outro' }), ed.event_name), false); assert.equal(isCountableSale(s({ event_name: 'congresso x 2026 ' }), ed.event_name), true) })

t('fuso: 23h30 de SP do dia 18 (02:30Z do 19) cai no dia 18; 00:30 SP do dia 19 cai no 19', () => {
  const a = aggregate([s({ occurred_at: '2026-11-19T02:30:00Z' }), s({ occurred_at: '2026-11-19T03:30:00Z' })], ed, roster)
  assert.equal(a.byDay['2026-11-18'].count, 1); assert.equal(a.byDay['2026-11-19'].count, 1)
})
t('closer por hubspot_id (com espaços) e por closer_id; self e desconhecido vão pra "others"', () => {
  const a = aggregate([
    s({ closer_hubspot_id: '777', value: 300 }), s({ closer_id: B, value: 50 }),
    s({ is_self_checkout: true, closer_hubspot_id: '777', value: 10 }), s({ closer_id: 'zzz', value: 5 }),
  ], ed, roster)
  assert.equal(a.byCloser[A].value, 300); assert.equal(a.byCloser[B].value, 50)
  assert.equal(a.others.value, 15); assert.equal(a.total.value, 365); assert.equal(a.total.count, 4)
})
t('venda fora dos dias entra no total e em "outside", não nos dias', () => {
  const a = aggregate([s({ occurred_at: '2026-11-22T15:00:00Z', value: 70 })], ed, roster)
  assert.equal(a.total.value, 70); assert.equal(a.outside.value, 70)
  assert.equal(Object.values(a.byDay).reduce((x, b) => x + b.value, 0), 0)
})
t('valor string/nulo', () => { const a = aggregate([s({ value: '12.5' }), s({ value: null })], ed, roster); assert.equal(a.total.value, 12.5); assert.equal(a.total.count, 2) })
t('recent vem do mais novo pro mais velho, máx 60', () => {
  const rows = Array.from({ length: 70 }, (_, i) => s({ occurred_at: `2026-11-18T${String(10 + (i % 10)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`, value: i }))
  const a = aggregate(rows, ed, roster); assert.equal(a.recent.length, 60)
  for (let i = 1; i < a.recent.length; i++) assert.ok(a.recent[i - 1].occurred_at >= a.recent[i].occurred_at)
})
t('buildGoals', () => {
  const g = buildGoals([{ scope: 'total', day: null, profile_id: null, amount: 1000 }, { scope: 'day', day: '2026-11-18', profile_id: null, amount: 400 },
    { scope: 'closer', day: null, profile_id: A, amount: 500 }, { scope: 'closer_day', day: '2026-11-18', profile_id: A, amount: 200 }])
  assert.equal(g.total, 1000); assert.equal(g.days['2026-11-18'], 400); assert.equal(g.closers[A], 500); assert.equal(g.cells[A]['2026-11-18'], 200)
  assert.equal(buildGoals([]).total, null)
})
const base = { name: 'Cong', event_name: 'Congresso X 2026', start_date: '2026-11-18', end_date: '2026-11-20', closers: [A, B], goals: [] as any[] }
t('parseConfig ok + limpa metas inválidas', () => {
  const r = parseConfig({ ...base, goals: [
    { scope: 'total', amount: 1000 }, { scope: 'total', amount: 2000 },                      // duplicada: fica a 1ª
    { scope: 'day', day: '2026-11-18', amount: 10.456 }, { scope: 'day', day: '2026-12-01', amount: 5 },  // dia fora: some
    { scope: 'closer', profile_id: A, amount: 7 }, { scope: 'closer', profile_id: '33333333-3333-4333-8333-333333333333', amount: 7 }, // closer fora: some
    { scope: 'closer_day', day: '2026-11-19', profile_id: B, amount: 0 },
  ] })
  assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.value.goals.length, 4); assert.equal(r.value.goals[0].amount, 1000); assert.equal(r.value.goals[1].amount, 10.46)
})
t('parseConfig recusa', () => {
  for (const bad of [{ ...base, name: ' ' }, { ...base, event_name: '' }, { ...base, start_date: '2026-13-01' }, { ...base, end_date: '2026-11-17' },
    { ...base, end_date: '2027-01-30' }, { ...base, closers: ['x'] }, { ...base, goals: [{ scope: 'total', amount: -1 }] },
    { ...base, goals: [{ scope: 'total', amount: NaN }] }, null])
    assert.equal(parseConfig(bad as any).ok, false)
})
t('parseConfig closers repetidos viram um', () => { const r = parseConfig({ ...base, closers: [A, A, B] }); assert.ok(r.ok && r.value.closers.length === 2) })
t('rangesOverlap', () => {
  assert.ok(rangesOverlap(ed, { start_date: '2026-11-20', end_date: '2026-11-22' })); assert.ok(!rangesOverlap(ed, { start_date: '2026-11-21', end_date: '2026-11-22' }))
})
t('distribute: soma exata, proporcional, múltiplos de 100', () => {
  const d = distribute(100000, [1, 2, 1]); assert.deepEqual(d, [25000, 50000, 25000])
  const e = distribute(100000, [1, 1, 1]); assert.equal(e.reduce((a, b) => a + b, 0), 100000); assert.ok(e.every(x => x % 100 === 0))
  const f = distribute(12345.67, [3, 1, 1]); assert.equal(Math.round(f.reduce((a, b) => a + b, 0) * 100) / 100, 12345.67)
})
t('distribute: peso zero recebe zero; sem peso/total => zeros; total pequeno usa unidade 1', () => {
  assert.deepEqual(distribute(1000, [1, 0, 1]), [500, 0, 500]); assert.deepEqual(distribute(0, [1, 1]), [0, 0]); assert.deepEqual(distribute(500, [0, 0]), [0, 0])
  assert.equal(distribute(50, [1, 1, 1]).reduce((a, b) => a + b, 0), 50)
})
t('ranking de produtos: soma, agrupa sem acento/caixa, ordena, por dia, sem produto', () => {
  const a = aggregate([
    s({ product: 'Extensivo', value: 100 }), s({ product: ' extensivo ', value: 50, occurred_at: '2026-11-19T15:00:00Z' }),
    s({ product: 'Curso', value: 500 }), s({ product: null, value: 10 }), s({ product: '', value: 5 }),
    s({ product: 'Curso', value: 7, is_refunded: true }), s({ product: 'Curso', value: 9, event_name: 'Outro' }),
  ], ed, roster)
  assert.deepEqual(a.products.map(p => [p.product, p.value, p.count]), [['Curso', 500, 1], ['Extensivo', 150, 2], [NO_PRODUCT, 15, 2]])
  assert.equal(a.products[1].byDay['2026-11-18'].value, 100); assert.equal(a.products[1].byDay['2026-11-19'].value, 50)
})
t('vertical: aceita as 4, vazio vira null, inválida recusa', () => {
  for (const v of ['anestreview', 'oftreview', 'ortopreview', 'medreview']) { const r = parseConfig({ ...base, vertical: v }); assert.ok(r.ok && r.value.vertical === v) }
  const n = parseConfig({ ...base }); assert.ok(n.ok && n.value.vertical === null)
  assert.equal(parseConfig({ ...base, vertical: 'x' }).ok, false)
})
// ── janela pós-evento (só o gráfico) e atribuição por data entre edições do mesmo evento ──
const nov = { id: 'nov', name: 'SBOT nov', event_name: 'SBOT', start_date: '2026-11-18', end_date: '2026-11-20', notes: null }
const dez = { id: 'dez', name: 'SBOT dez', event_name: 'sbot', start_date: '2026-12-21', end_date: '2026-12-24', notes: null }
const sb = (iso: string, v = 100) => s({ event_name: 'SBOT', occurred_at: iso, value: v })
t('janela: 10 dias depois do fim contam; 11 não; 1 dia antes conta; 2 antes não', () => {
  assert.equal(POST_EVENT_DAYS, 10)
  const a = aggregate([sb('2026-11-30T15:00:00Z'), sb('2026-12-01T15:00:00Z'), sb('2026-11-17T15:00:00Z'), sb('2026-11-16T15:00:00Z')], nov, roster, [nov, dez])
  assert.equal(a.total.count, 2); assert.equal(a.outside.count, 2); assert.equal(a.byDay['2026-11-18'].count, 0)
})
t('2 edições do SBOT: venda de 21–24/12 soma só na de dezembro', () => {
  const rows = [sb('2026-12-22T15:00:00Z', 500), sb('2026-11-19T15:00:00Z', 70)]
  const n1 = aggregate(rows, nov, roster, [nov, dez]), d1 = aggregate(rows, dez, roster, [nov, dez])
  assert.equal(n1.total.value, 70); assert.equal(d1.total.value, 500); assert.equal(d1.byDay['2026-12-22'].value, 500)
})
t('venda no meio (dias 25/11 a 20/12): conta na de novembro até o dia 30/11; depois só na de dezembro se alcançar', () => {
  assert.equal(belongsToEdition('2026-11-25', nov, [nov, dez]), true); assert.equal(belongsToEdition('2026-11-25', dez, [nov, dez]), false)
  assert.equal(belongsToEdition('2026-12-05', nov, [nov, dez]), false); assert.equal(belongsToEdition('2026-12-05', dez, [nov, dez]), false)
  assert.equal(belongsToEdition('2026-12-20', dez, [nov, dez]), true)
})
t('janelas que se encostam: vale a edição mais próxima do dia (empate → a mais nova)', () => {
  const a = { ...nov, id: 'a', start_date: '2026-12-01', end_date: '2026-12-03' }, b = { ...nov, id: 'b', start_date: '2026-12-10', end_date: '2026-12-12' }
  assert.equal(belongsToEdition('2026-12-09', a, [a, b]), false); assert.equal(belongsToEdition('2026-12-09', b, [a, b]), true)   // 1 dia antes de b vs 6 depois de a
  assert.equal(belongsToEdition('2026-12-06', a, [a, b]), true); assert.equal(belongsToEdition('2026-12-06', b, [a, b]), false)   // 3 depois de a vs 4 antes de b
  assert.equal(belongsToEdition('2026-12-02', a, [a, b]), true)                                                                   // dentro das datas
})
t('evento de nome diferente não disputa a venda', () => {
  const outro = { ...dez, id: 'o', event_name: 'Outro' }
  assert.equal(belongsToEdition('2026-11-19', nov, [nov, outro]), true)
})
console.log(`\n${n} testes passaram`)
