// @ts-nocheck
// Vendas Individuais: quem foi closer e virou SUPERADMIN não pode ficar na lista com vendas zeradas. Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { hResumoAdmin } from '../../lib/vendas/handlers'

let n = 0; const t = async (nome: string, f: () => Promise<void> | void) => { await f(); n++; console.log('ok  ' + nome) }
function fake(tables: Record<string, any[]>) {
  return { from(name: string) {
    let rows = [...(tables[name] ?? [])]
    const q: any = {
      select() { return q }, eq(c: string, v: any) { rows = rows.filter(r => r[c] === v); return q }, in(c: string, vs: any[]) { rows = rows.filter(r => vs.includes(r[c])); return q },
      gte(c: string, v: string) { rows = rows.filter(r => r[c] >= v); return q }, lte(c: string, v: string) { rows = rows.filter(r => r[c] <= v); return q },
      not(c: string, _op: string, v: any) { rows = rows.filter(r => r[c] !== v); return q }, or() { return q }, order() { return q }, range(a: number, b: number) { rows = rows.slice(a, b + 1); return q }, then(res: any) { res({ data: rows, error: null }) },
    }
    return q
  } }
}
const profiles = [
  { id: 'p1', name: 'Ana Souza', team: 'OAO', hubspot_id: '111', role: 'closer', is_active: true },
  { id: 'p2', name: 'João Oliveira', team: null, hubspot_id: '222', role: 'superadmin', is_active: true },
  { id: 'p3', name: 'Matheus Borges', team: null, hubspot_id: null, role: 'superadmin', is_active: true },      // casa só pelo nome
  { id: 'p4', name: 'Carla Dias', team: 'R1', hubspot_id: '444', role: 'superadmin', is_active: true },        // superadmin que VENDEU: continua
  { id: 'p5', name: 'Bia Lima', team: 'OAO', hubspot_id: '555', role: 'closer', is_active: true },             // closer sem venda: continua (zerado é normal)
]
const closers = [
  { id: 'c1', name: 'Ana Souza', normalized_name: 'ana souza', hubspot_id: '111' }, { id: 'c2', name: 'João Oliveira', normalized_name: 'joao oliveira', hubspot_id: '222' },
  { id: 'c3', name: 'Matheus Borges', normalized_name: 'matheus borges', hubspot_id: null }, { id: 'c4', name: 'Carla Dias', normalized_name: 'carla dias', hubspot_id: '444' },
  { id: 'c5', name: 'Bia Lima', normalized_name: 'bia lima', hubspot_id: '555' },
]
const venda = (id: string, o: any) => ({ id, event_type: 'sale', vertical: 'anestreview', value: 100, occurred_at: '2026-11-10T15:00:00.000Z', closer_id: null, closer_hubspot_id: null, co_closer_id: null, co_closer_hubspot_id: null, is_refunded: false, ...o })
const eventos = [venda('e1', { closer_id: 'c1', value: 1000 }), venda('e2', { closer_id: 'c4', value: 300 })]
const ctx = (role = 'superadmin') => ({ admin: fake({ closers, profiles, telao_events: eventos, closer_goals: [] }), userId: 'u', role, name: 'X', team: null, hubspotId: null })
const sp = (extra = '') => new URLSearchParams('from=2026-11-01&to=2026-11-30' + extra)

;(async () => {
  const r = await hResumoAdmin(ctx(), sp()); assert.equal(r.status, 200, JSON.stringify(r.json))
  const nomes = r.json.closers.map((c: any) => c.name)
  await t('superadmin sem vendas (João e Matheus) NÃO aparece na lista', () => { assert.ok(!nomes.includes('João Oliveira')); assert.ok(!nomes.includes('Matheus Borges'), nomes.join()) })
  await t('o que casa só pelo nome (sem HubSpot) também some', () => assert.ok(!nomes.includes('Matheus Borges')))
  await t('closer de verdade aparece, com e sem venda', () => { assert.ok(nomes.includes('Ana Souza')); assert.ok(nomes.includes('Bia Lima')) })
  await t('superadmin que TEM venda continua aparecendo (nenhuma venda some)', () => { const c = r.json.closers.find((x: any) => x.name === 'Carla Dias'); assert.equal(c?.vendas, 1); assert.equal(c?.valor, 300) })
  await t('totais intactos', () => { assert.equal(r.json.total.vendas, 2); assert.equal(r.json.total.valor, 1300) })
  await t('pedir o closer pelo id ainda o mostra (conferência)', async () => { const x = await hResumoAdmin(ctx(), sp('&closerId=00000000-0000-4000-8000-000000000002')); assert.equal(x.status, 200) })
  await t('quem não é superadmin segue recebendo 403', async () => assert.equal((await hResumoAdmin(ctx('closer'), sp())).status, 403))
  console.log(`\n${n} testes passaram`)
})().catch(e => { console.error('FALHOU', e); process.exit(1) })
