// A conta única do Forecast: projeção, rota e Radar Diário (lib/dashboard/projecao.ts). Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { buildRadar, buildRota, projetar, refDateOf, refDates, reparte, type SerieDia } from '../../lib/dashboard/projecao'
import { buildTable, buildRoute, projecaoOf, serieDe, VKEYS, type YoYData, type VKey } from '../../lib/dashboard/yoy'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const perto = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`)
const quase = (a: number[], b: number[]) => { assert.equal(a.length, b.length); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= 1, `[${i}] ${v} ≠ ${b[i]}`)) }      // o exemplo do pedido está arredondado em reais: tolera R$ 1

t('alinhamento por dia da semana: 364 dias antes', () => {
  assert.equal(refDateOf('2026-11-27'), '2025-11-28'); assert.equal(refDateOf('2026-11-30'), '2025-12-01'); assert.equal(refDateOf('2026-03-02'), '2025-03-03')
  assert.equal(refDates('2026-02').length, 28); assert.equal(refDates('2026-02')[0], '2025-02-02')
})
t('reparte não perde nem cria centavo', () => { const r = reparte(100000, [1, 1, 1]); assert.equal(r.reduce((a, b) => a + b, 0), 100000) })

// ── projeção ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ref10 = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
t('mesmo ritmo do ano passado → fecha igual ao ano passado', () => {
  const p = projetar({ cur: [100, 100, 100, 40, 0, 0, 0, 0, 0, 0], ref: ref10, D: 4, N: 10 })
  assert.equal(p.fonte, 'dias'); perto(p.ritmo, 1); perto(p.projecao, 1000)       // hoje (dia 4) entra pelo maior entre o vendido (40) e o esperado (100)
})
t('ritmo 20% acima → o resto do mês também sobe 20%', () => {
  const p = projetar({ cur: [120, 120, 120, 50, 0, 0, 0, 0, 0, 0], ref: ref10, D: 4, N: 10 })
  perto(p.ritmo, 1.2); perto(p.projecao, 360 + 120 + 6 * 120)
})
t('hoje que já passou do esperado vale o vendido', () => {
  const p = projetar({ cur: [100, 100, 100, 300, 0, 0, 0, 0, 0, 0], ref: ref10, D: 4, N: 10 }); perto(p.projecao, 300 + 300 + 600)
})
t('dia 1: sem dias fechados, o ritmo vem da meta; sem meta, é igual ao ano passado', () => {
  const s: SerieDia = { cur: [30, 0, 0, 0, 0, 0, 0, 0, 0, 0], ref: ref10, D: 1, N: 10 }
  const a = projetar(s, 2000); assert.equal(a.fonte, 'meta'); perto(a.ritmo, 2); perto(a.projecao, 2000)
  const b = projetar(s, 0); assert.equal(b.fonte, 'igual'); perto(b.ritmo, 1); perto(b.projecao, 1000)
})
t('sem ano passado para comparar: ritmo linear (cai para o que existia antes)', () => {
  const p = projetar({ cur: [100, 100, 50, 0, 0, 0, 0, 0, 0, 0], ref: new Array(10).fill(0), D: 3, N: 10 }); assert.equal(p.fonte, 'linear'); perto(p.projecao, 250 / 3 * 10)
})
t('falta pra meta, dias restantes e quanto vender por dia', () => {
  const p = projetar({ cur: [100, 100, 100, 100, 0, 0, 0, 0, 0, 0], ref: ref10, D: 4, N: 10 }, 1000); assert.equal(p.faltaPraMeta, 600); assert.equal(p.diasRestantes, 6); perto(p.precisaDia as number, 100)
})

// ── rota (o gráfico "Receita acumulada") ──────────────────────────────────────────────────────────────────────────────────
t('rota: fecha exatamente na meta, 2025 no total do período e a projeção no fim', () => {
  const s: SerieDia = { cur: [120, 120, 120, 50, 0, 0, 0, 0, 0, 0], ref: ref10, D: 4, N: 10 }, r = buildRota(s, 2000)
  perto(r.pontos[9].rota as number, 2000); perto(r.pontos[9].ref, 1000); assert.equal(r.pontos[3].cur, 410); assert.equal(r.pontos[4].cur, null)
  perto(r.pontos[9].proj as number, r.projecao); assert.equal(r.pontos[2].proj, null); assert.equal(r.ultimoFechado, 3); assert.equal(r.curFechado, 360)
  assert.equal(buildRota(s, 0).pontos[9].rota, null)
})

// ── radar: o exemplo do pedido, número por número ─────────────────────────────────────────────────────────────────────────
// Hoje é quarta 25/11/2026; o plano da semana começa na segunda 23/11. Metas planejadas (23 a 30/11) = as do exemplo; o realizado até 22/11 fecha a meta de R$ 13,6 mi.
const PLAN = [159217, 412756, 518329, 522919, 2427576, 861738, 1082684, 861692]
const ANTES = 13_600_000 - PLAN.reduce((a, b) => a + b, 0)
function exemplo(cur: Record<number, number>, D: number) {
  const N = 30, c = new Array(N).fill(0), r = new Array(N).fill(1); c[0] = ANTES; for (const [d, v] of Object.entries(cur)) c[+d - 1] = v
  PLAN.forEach((v, i) => { r[22 + i] = v })
  return buildRadar({ cur: c, ref: r, D, N }, 13_600_000, { month: '2026-11', today: `2026-11-${D}`, refDates: refDates('2026-11') })
}
t('radar: a semana começa na segunda (23/11) e o plano fecha exatamente a meta', () => {
  const r = exemplo({ 23: 317803, 24: 350261, 25: 84174 }, 25)
  assert.equal(r.ok, true); assert.equal(r.inicio, 23); assert.equal(r.linhas.length, 8); perto(r.fator, 1, 1e-9)
  perto(r.linhas[r.linhas.length - 1].metaAcum, 13_600_000, 0.001)
  assert.deepEqual(r.linhas.map(l => l.day), [23, 24, 25, 26, 27, 28, 29, 30]); assert.deepEqual(r.linhas.map(l => l.quando), ['passou', 'passou', 'hoje', 'amanha', 'vem', 'vem', 'vem', 'vem'])
})
t('radar: meta ajustada = planejada − diferença acumulada do dia anterior (superávit abate, déficit soma)', () => {
  const L = exemplo({ 23: 317803, 24: 350261, 25: 84174 }, 25).linhas
  quase(L.map(l => l.planejada), PLAN)
  quase(L.map(l => l.ajustada), [159217, 254170, 422238, 860984, 2427576, 861738, 1082684, 861692])      // 24/11: −158.586 · 25/11: −96.091 · 26/11: +338.065
  assert.deepEqual(L.slice(0, 3).map(l => Math.round(l.pct as number)), [200, 138, 20])
  quase(L.slice(0, 3).map(l => l.metaAcum), [6912306, 7325062, 7843391]); quase(L.slice(0, 3).map(l => l.realAcum as number), [7070892, 7421153, 7505326])
  quase(L.slice(0, 3).map(l => l.difAcum as number), [158586, 96091, -338065]); assert.equal(L[3].realizado, null); assert.equal(L[3].difAcum, null)
})
t('radar: superávit maior que a meta de amanhã zera amanhã e o que sobrou abate os dias seguintes', () => {
  const L = exemplo({ 23: 2_000_000, 24: 0, 25: 0 }, 23).linhas      // hoje é segunda 23/11 e já vendeu R$ 2 mi: +R$ 1,84 mi acima da meta do dia
  perto(L[0].difAcum as number, 2_000_000 - PLAN[0], 0.001); assert.equal(L[1].ajustada, 0)       // amanhã (24/11, meta 412.756) zera
  const sobra = 2_000_000 - PLAN[0] - PLAN[1]; assert.equal(L[2].ajustada, 0); assert.ok(sobra > PLAN[2] && sobra < PLAN[2] + PLAN[3] + 1e9)        // 25/11 também zera
  const total = L.slice(1).reduce((s, l) => s + l.ajustada, 0); perto(total, PLAN.slice(1).reduce((a, b) => a + b, 0) - (2_000_000 - PLAN[0]), 0.01)       // o que falta no mês = metas − o superávit
})
t('radar: meta já batida ou sem meta não quebra', () => {
  assert.equal(buildRadar({ cur: [1, 1], ref: [1, 1], D: 1, N: 2 }, 0, { month: '2026-11', today: '2026-11-01', refDates: ['a', 'b'] }).ok, false)
  const r = exemplo({ 23: 1, 24: 1, 25: 1 }, 25); assert.equal(r.ok, true)
})

// ── tudo sai da mesma conta ───────────────────────────────────────────────────────────────────────────────────────────────
t('tabela, rota e projeção do total dão o MESMO número (e o total é a soma das mesmas séries)', () => {
  const N = 30, z = () => Object.fromEntries(VKEYS.map(k => [k, new Array(N).fill(0)])) as Record<VKey, number[]>, cur = z(), prev = z()
  for (let i = 0; i < N; i++) { prev.anest[i] = 1000 + i * 10; prev.oft[i] = 400; prev.r1[i] = 200; if (i < 17) { cur.anest[i] = 1300; cur.oft[i] = 380; cur.r1[i] = 260 } }
  const d: YoYData = { metas: { anest: 50000, oft: 15000, ortop: 0, r1: 9000, geral: 80000 }, today: '2026-11-18', month: '2026-11', dayOfMonth: 18, yearCur: 2026, yearPrev: 2025, daysInMonth: { cur: N, prev: N }, cur, prev }
  const p = projecaoOf(d, 'total'), linha = buildTable(d).find(r => r.key === 'total')!, rota = buildRoute(d, 'total')
  assert.equal(linha.projecao, p.projecao); assert.equal(rota.projecao, p.projecao); assert.equal(serieDe(d, 'total').cur[0], 1940)
  assert.ok(p.projecao > p.realizado); assert.equal(linha.fechPrev, p.refTotal); assert.equal(linha.pctMeta, p.pctVsMeta)
})
console.log(`\n${n} testes passaram`)
