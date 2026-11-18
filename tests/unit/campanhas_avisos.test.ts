// @ts-nocheck — teste com banco de mentira e dados soltos; roda com: node tests/unit/rodar.mjs
// Ponta a ponta (banco de mentira em memória): publicar + apurar + fechar com as 4 combinações das caixinhas.
import assert from 'node:assert/strict'
import { publishCampaign, runCampaignTick } from '../../lib/campaigns/server'

function fakeAdmin(seed: Record<string, any[]>) {
  const db: Record<string, any[]> = JSON.parse(JSON.stringify(seed)); let seq = 1
  const from = (name: string) => {
    const rows = (db[name] ??= [])
    const st: any = { f: [] as ((r: any) => boolean)[], op: 'select', payload: null as any, single: false, maybe: false, lim: null as null | [number, number] }
    const q: any = {
      select: () => q, order: () => q, limit: () => q,
      range: (a: number, b: number) => { st.lim = [a, b]; return q },
      eq: (k: string, v: any) => (st.f.push(r => r[k] === v), q), neq: (k: string, v: any) => (st.f.push(r => r[k] !== v), q),
      in: (k: string, v: any[]) => (st.f.push(r => v.includes(r[k])), q), is: (k: string, v: any) => (st.f.push(r => (r[k] ?? null) === v), q),
      gte: (k: string, v: any) => (st.f.push(r => r[k] >= v), q), lt: (k: string, v: any) => (st.f.push(r => r[k] < v), q), lte: (k: string, v: any) => (st.f.push(r => r[k] <= v), q),
      insert: (p: any) => (st.op = 'insert', st.payload = p, q), update: (p: any) => (st.op = 'update', st.payload = p, q), upsert: (p: any) => (st.op = 'upsert', st.payload = p, q), delete: () => (st.op = 'delete', q),
      single: () => (st.single = true, q), maybeSingle: () => (st.maybe = true, q),
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    }
    const run = () => {
      const match = () => rows.filter(r => st.f.every((f: any) => f(r)))
      if (st.op === 'insert' || st.op === 'upsert') {
        const list = Array.isArray(st.payload) ? st.payload : [st.payload]
        if (name === 'campaign_event_log' && list.some((x: any) => rows.some(r => r.campaign_id === x.campaign_id && r.event_key === x.event_key))) return { data: null, error: { code: '23505', message: 'duplicate key' } }
        const made = list.map((x: any) => ({ id: x.id ?? `id${seq++}`, ...x })); rows.push(...made)
        return { data: st.single ? made[0] : made, error: null }
      }
      if (st.op === 'update') { const m = match(); m.forEach(r => Object.assign(r, st.payload)); return { data: m, error: null } }
      if (st.op === 'delete') { const m = match(); m.forEach(r => rows.splice(rows.indexOf(r), 1)); return { data: m, error: null } }
      let m = match(); if (st.lim) m = m.slice(st.lim[0], st.lim[1] + 1)
      return { data: st.single || st.maybe ? m[0] ?? null : m, error: null }
    }
    return q
  }
  return { from, db }
}

const profiles = [
  { id: 'u1', name: 'Ana', role: 'consultor', team: 'OAO', hubspot_id: 'h1', is_active: true },
  { id: 'u2', name: 'Bia', role: 'consultor', team: 'OAO', hubspot_id: 'h2', is_active: true },
]
const sales = [
  { id: 's1', event_type: 'sale', vertical: 'anestreview', value: 500, occurred_at: '2026-11-10T15:00:00Z', closer_hubspot_id: 'h1', is_self_checkout: false, is_recurring: false, product_id: '1234;5678' },
  { id: 's2', event_type: 'sale', vertical: 'anestreview', value: 300, occurred_at: '2026-11-11T15:00:00Z', closer_hubspot_id: 'h2', is_self_checkout: false, is_recurring: false, product_id: '9999' },
]
const camp = (notify: boolean, notify_result: boolean) => ({
  id: 'c1', name: 'Camp', subtitle: '', prize: 'Vale', prize_mode: 'single', prizes: {}, emoji: '🏁', theme: 'roxo', criterion: 'revenue_rank',
  teams: { OAO: { winners: 1, target: null } }, starts_on: '2026-11-09', ends_on: '2026-11-12', count_recurring: false, verticals: null, product_ids: ['5678'],
  notify, notify_result, status: 'draft', created_by: 'adm', created_at: '2026-11-01T00:00:00Z', launched_at: null, finalized_at: null,
})

let n = 0
async function cenario(notify: boolean, notify_result: boolean) {
  const a = fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [camp(notify, notify_result)], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
  const pub = await publishCampaign(a as any, 'c1', new Date('2026-11-08T12:00:00Z'))        // publica ANTES de começar → aviso de criação
  assert.equal(pub.ok, true)
  await runCampaignTick(a as any, { now: new Date('2026-11-13T12:00:00Z') })                  // depois do fim → fecha e avisa resultado
  const keys = (a.db.notifications as any[]).map(x => x.event_key).sort()
  const winners = a.db.campaign_winners as any[]
  return { keys, winners, camp: (a.db.campaigns as any[])[0] }
}
const t = async (nome: string, f: () => Promise<void>) => { await f(); n++; console.log('ok  ' + nome) }

await t('só CRIAÇÃO: avisa o lançamento, NÃO avisa resultado — e a apuração/ganhador continuam', async () => {
  const r = await cenario(true, false)
  assert.deepEqual(r.keys, ['launch']); assert.equal(r.winners.length, 1); assert.equal(r.winners[0].user_id, 'u1'); assert.ok(r.camp.finalized_at)
})
await t('só RESULTADO: NÃO avisa lançamento; avisa o ganhador e o resumo ao fim', async () => {
  const r = await cenario(false, true)
  assert.ok(!r.keys.includes('launch')); assert.ok(r.keys.includes('finish:everyone')); assert.ok(r.keys.some(k => k.startsWith('finish:personal:OAO:1')))
})
await t('AS DUAS: lançamento + resultado', async () => {
  const r = await cenario(true, true)
  assert.ok(r.keys.includes('launch') && r.keys.includes('finish:everyone') && r.keys.some(k => k.startsWith('finish:personal')))
})
await t('NENHUMA: zero avisos, mas a campanha apura e fecha do mesmo jeito', async () => {
  const r = await cenario(false, false)
  assert.deepEqual(r.keys, []); assert.equal(r.winners.length, 1); assert.ok(r.camp.finalized_at)
})
await t('produto "1234;5678" contou para a campanha do 5678 (Ana ganhou com R$ 500; Bia, do produto 9999, não pontuou)', async () => {
  const r = await cenario(false, false); assert.equal(Number(r.winners[0].metric_value), 500)
})
console.log(`\n${n} testes de avisos passaram`)
