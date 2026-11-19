// @ts-nocheck
// Vendas Gerais → KPI, ponta a ponta com um banco falso em memória. Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { hVendasGeraisKpi } from '../../lib/vendas/kpi-handlers'

const kpi = (c: any, sp: URLSearchParams, deps: any = {}) => hVendasGeraisKpi(c, sp, { hoje: '2026-11-18', projecaoForecast: async () => null, ...deps })
let n = 0; const t = async (nome: string, f: () => Promise<void> | void) => { await f(); n++; console.log('ok  ' + nome) }
function fake(tables: Record<string, any[]>) {
  return { from(name: string) {
    let rows = [...(tables[name] ?? [])]
    const q: any = {
      select() { return q }, eq(c: string, v: any) { rows = rows.filter(r => r[c] === v); return q }, in(c: string, vs: any[]) { rows = rows.filter(r => vs.includes(r[c])); return q },
      gte(c: string, v: string) { rows = rows.filter(r => r[c] >= v); return q }, lte(c: string, v: string) { rows = rows.filter(r => r[c] <= v); return q },
      order() { return q }, range(a: number, b: number) { rows = rows.slice(a, b + 1); return q }, then(res: any) { res({ data: rows, error: null }) },
    }
    return q
  } }
}
const U1 = 'u1', U2 = 'u2', U3 = 'u3', U4 = 'u4'
const profiles = [
  { id: U1, name: 'Ana Souza', team: 'OAO', hubspot_id: '111', avatar_url: 'a.png' }, { id: U2, name: 'Bia Lima', team: 'OAO', hubspot_id: '222', avatar_url: null },
  { id: U3, name: 'Caio Reis', team: 'R1', hubspot_id: '333', avatar_url: null }, { id: U4, name: 'Duda Paz', team: 'R1', hubspot_id: '444', avatar_url: null },
]
const closers = [{ id: 'c2', name: 'Bia Lima', hubspot_id: '222' }, { id: 'c9', name: 'Ex Closer', hubspot_id: '999' }]
const at = '2026-11-10T15:00:00.000Z'
const venda = (o: any) => ({ event_type: 'sale', vertical: 'anestreview', value: 100, occurred_at: at, closer_id: null, closer_hubspot_id: null, closer_name: null, is_self_checkout: false, seller_type: null, sold_by_ambassador: false, ...o })
const vendas = [
  venda({ value: 1000, closer_hubspot_id: '111' }),                                     // Ana, pelo hubspot
  venda({ value: 500, vertical: 'oftreview', closer_id: 'c2', closer_hubspot_id: null }),   // Bia, pelo cadastro de closers (id → hubspot → perfil)
  venda({ value: 300, vertical: 'medreview', closer_hubspot_id: '333' }),               // Caio (R1)
  venda({ value: 80, is_self_checkout: true }),                                          // self-checkout
  venda({ value: 60, sold_by_ambassador: true, seller_type: 'ambassador' }),             // embaixador
  venda({ value: 40, closer_hubspot_id: '999', closer_id: 'c9' }),                       // closer sem perfil de time
  venda({ value: 7777, vertical: 'vascreview', closer_hubspot_id: '111' }),              // vertical inativa: fora
  venda({ value: 7777, event_type: 'refund', closer_hubspot_id: '111' }),                // não é venda ativa: fora
  venda({ value: 7777, occurred_at: '2026-10-31T10:00:00.000Z', closer_hubspot_id: '111' }),   // fora do período
]
const metas = { company_goals: [{ month: '2026-11', scope: 'geral', goal_value: 10000 }, { month: '2026-11', scope: 'Anest-Review', goal_value: 4000 }, { month: '2026-10', scope: 'geral', goal_value: 1 }],
  closer_goals: [{ month: '2026-11', user_id: U1, goal_sales: 728000 }, { month: '2026-11', user_id: U4, goal_sales: 77100 }] }
const ctx = (extra: any = {}) => ({ admin: fake({ telao_events: vendas, closers, profiles, ...metas, ...extra }), userId: 'x', role: 'superadmin', name: null, team: null, hubspotId: null })
const mes = new URLSearchParams({ from: '2026-11-01T03:00:00.000Z', to: '2026-12-01T02:59:59.999Z' })

await t('só superadmin; período inválido recusa', async () => {
  assert.equal((await kpi({ ...ctx(), role: 'consultor' }, mes)).status, 403)
  assert.equal((await kpi(ctx(), new URLSearchParams({ from: 'x', to: 'y' }))).status, 400)
  assert.equal((await kpi(ctx(), new URLSearchParams({ from: '2026-11-02T00:00:00Z', to: '2026-11-01T00:00:00Z' }))).status, 400)
})
await t('mês: total, verticais e metas; vertical inativa, estorno e fora do período não entram', async () => {
  const r = await kpi(ctx(), mes); assert.equal(r.status, 200); const j = r.json
  assert.equal(j.periodo.comMeta, true); assert.equal(j.periodo.mes, '2026-11')
  assert.deepEqual(j.total, { realizado: 1980, vendas: 6, meta: 10000 })
  const v = Object.fromEntries(j.verticais.map((x: any) => [x.id, x])); assert.equal(v.anestreview.realizado, 1180); assert.equal(v.anestreview.meta, 4000); assert.equal(v.oftreview.realizado, 500); assert.equal(v.oftreview.meta, null); assert.equal(v.medreview.realizado, 300); assert.equal(v.ortopreview.realizado, 0)
  assert.equal(j.verticais.reduce((s: number, x: any) => s + x.realizado, 0), j.total.realizado)
})
await t('closers por time: hubspot_id, cadastro de closers e meta; closer só com meta aparece zerado', async () => {
  const j = (await kpi(ctx(), mes)).json, oao = j.times.find((x: any) => x.team === 'OAO'), r1 = j.times.find((x: any) => x.team === 'R1')
  assert.deepEqual(oao.closers.map((c: any) => [c.nome, c.realizado, c.vendas, c.meta]), [['Ana Souza', 1000, 1, 728000], ['Bia Lima', 500, 1, null]])
  assert.equal(oao.closers[0].avatar_url, 'a.png'); assert.deepEqual(oao.total, { realizado: 1500, vendas: 2, meta: 728000 })
  assert.deepEqual(r1.closers.map((c: any) => [c.nome, c.realizado, c.vendas, c.meta]), [['Caio Reis', 300, 1, null], ['Duda Paz', 0, 0, 77100]])
  assert.deepEqual(r1.total, { realizado: 300, vendas: 1, meta: 77100 })
})
await t('outros canais: self-checkout, embaixador e closer sem time; times + outros = total', async () => {
  const j = (await kpi(ctx(), mes)).json
  assert.deepEqual(j.outros.map((o: any) => [o.id, o.realizado, o.vendas]), [['self', 80, 1], ['embaixador', 60, 1], ['semTime', 40, 1]])
  const soma = j.times.reduce((s: number, x: any) => s + x.total.realizado, 0) + j.outros.reduce((s: number, o: any) => s + o.realizado, 0); assert.equal(soma, j.total.realizado)
})
await t('sem meta geral cadastrada: vale a soma das metas dos closers (regra do Forecast)', async () => {
  const j = (await kpi(ctx({ company_goals: [] }), mes)).json; assert.equal(j.total.meta, 728000 + 77100); assert.equal(j.verticais.find((x: any) => x.id === 'anestreview').meta, null)
})
await t('período que não é um mês: sem metas em lugar nenhum (as vendas continuam)', async () => {
  const j = (await kpi(ctx(), new URLSearchParams({ from: '2026-11-05T03:00:00.000Z', to: '2026-11-30T02:59:59.999Z' }))).json
  assert.equal(j.periodo.comMeta, false); assert.equal(j.total.meta, null); assert.equal(j.total.realizado, 1980); assert.ok(j.times.every((x: any) => x.closers.every((c: any) => c.meta === null)))
})
await t('mês corrente: devolve a projeção do Forecast (a mesma conta, injetada); mês fechado e período futuro/passado parcial não chamam o Forecast', async () => {
  let chamadas = 0; const fc = async () => { chamadas++; return { projecao: 12345, realizado: 2000 } }
  assert.deepEqual((await kpi(ctx(), mes, { projecaoForecast: fc })).json.forecast, { projecao: 12345, realizado: 2000 }); assert.equal(chamadas, 1)
  const out = await kpi(ctx(), new URLSearchParams({ from: '2026-10-01T03:00:00.000Z', to: '2026-11-01T02:59:59.999Z' }), { projecaoForecast: fc }); assert.equal(out.json.forecast, null)
  const parcial = await kpi(ctx(), new URLSearchParams({ from: '2026-11-01T03:00:00.000Z', to: '2026-11-10T02:59:59.999Z' }), { projecaoForecast: fc }); assert.equal(parcial.json.forecast, null); assert.equal(chamadas, 1)
})
await t('o Forecast falhou: a tela não quebra (forecast null, o resto vem igual)', async () => {
  const errOrig = console.error; console.error = () => {}
  try { const r = await kpi(ctx(), mes, { projecaoForecast: async () => { throw new Error('x') } }); assert.equal(r.status, 200); assert.equal(r.json.forecast, null); assert.equal(r.json.total.realizado, 1980) } finally { console.error = errOrig }
})
console.log(`\n${n} testes passaram`)
