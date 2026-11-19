// Dias fortes do Forecast: 27, 28 e 29 de 2026 comparados com os dias equivalentes (mesmo dia da semana) de 2025. Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { buildPlanoDia, buildRoute, diaPar, VKEYS, type YoYData, type VKey } from '../../lib/dashboard/yoy'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const zeros = () => Object.fromEntries(VKEYS.map(k => [k, new Array(30).fill(0)])) as Record<VKey, number[]>
const horas = () => Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: 30 }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>
const FECH = 26 * 1000 + 1500 + 20000 + 8000 + 5000      // receita de novembro de 2025 no teste: dias 1 a 26 = R$ 1.000 + os quatro dias fortes
function dados(over: Partial<YoYData> = {}): YoYData {
  const prev = zeros(), prevH = horas(), prevHN = horas()
  for (let d = 1; d <= 30; d++) prev.anest[d - 1] = 1000                      // dia comum: R$ 1.000
  const forte = { 27: 1500, 28: 20000, 29: 8000, 30: 5000 } as Record<number, number>      // 2025: 28 (sex), 29 (sáb) e 30 (dom) foram o fim de semana da Black Friday
  for (const [dia, v] of Object.entries(forte)) { prev.anest[+dia - 1] = v; prevH.anest[+dia - 1][10] = v / 2; prevH.anest[+dia - 1][20] = v / 2; prevHN.anest[+dia - 1][10] = 2; prevHN.anest[+dia - 1][20] = 3 }
  return { metas: { anest: 0, oft: 0, ortop: 0, r1: 0, geral: 1_000_000 }, today: '2026-11-18', month: '2026-11', dayOfMonth: 18, yearCur: 2026, yearPrev: 2025, daysInMonth: { cur: 30, prev: 30 }, cur: zeros(), prev, prevH, prevHN, ...over }
}

t('27/11/2026 (sexta) casa com 28/11/2025 (sexta); 28 com 29; 29 com 30', () => {
  const d = dados(); assert.equal(diaPar(d, 27), 28); assert.equal(diaPar(d, 28), 29); assert.equal(diaPar(d, 29), 30)
})
t('dia que não é forte fica na mesma data', () => assert.equal(diaPar(dados(), 10), 10))
t('mês sem configuração: a mesma data', () => assert.equal(diaPar(dados({ month: '2026-10' }), 27), 27))
t('os dias fortes do mês são 27, 28 e 29, em ordem, com o valor do dia equivalente de 2025', () => {
  const r = buildRoute(dados(), 'total')
  assert.deepEqual(r.picosMes.map(p => p.day), [27, 28, 29]); assert.deepEqual(r.picosMes.map(p => p.dayPrev), [28, 29, 30])
  assert.deepEqual(r.picosMes.map(p => p.valor), [20000, 8000, 5000]); assert.deepEqual(r.picosMes.map(p => p.wd), ['sex', 'sáb', 'dom']); assert.deepEqual(r.picosMes.map(p => p.wdPrev), ['sex', 'sáb', 'dom'])
  assert.ok(Math.abs(r.picosMesShare - 33000 / FECH * 100) < 1e-9)      // 20.000 + 8.000 + 5.000 sobre o mês inteiro de 2025
})
t('as estrelas do gráfico (picos) marcam só os dias fortes que ainda vêm: 27, 28, 29 de 2026', () => {
  assert.deepEqual(buildRoute(dados(), 'total').picos.map(p => p.day).sort(), [27, 28, 29])
  assert.deepEqual(buildRoute(dados({ today: '2026-11-28', dayOfMonth: 28 }), 'total').picos.map(p => p.day), [29])        // 27 e 28 já passaram/são hoje
})
t('mês sem configuração: continua sendo os 3 maiores dias do ano passado', () => {
  const r = buildRoute(dados({ month: '2026-10', today: '2026-10-05', dayOfMonth: 5 }), 'total')
  assert.deepEqual(r.picosMes.map(p => p.day), [28, 29, 30])
})
t('plano hora a hora de 27/11 usa o peso e as horas de 28/11/2025 e fecha na meta do dia', () => {
  const p = buildPlanoDia(dados(), 'total', 27)!
  assert.equal(p.day, 27); assert.equal(p.dayPrev, 28); assert.equal(p.valorPrev, 20000)
  assert.ok(Math.abs(p.share - 20000 / FECH * 100) < 1e-9); assert.equal(p.alvoDia, Math.round(1_000_000 * 20000 / FECH * 100) / 100)
  assert.equal(p.horas.length, 24); assert.equal(p.horas[10].prev, 10000); assert.equal(p.horas[20].prev, 10000)
  const soma = Math.round(p.horas.reduce((s, h) => s + h.alvo, 0) * 100) / 100; assert.equal(soma, p.alvoDia)
})
t('dia não forte (ex.: 10/11) segue igual: dayPrev = day', () => { const p = buildPlanoDia(dados(), 'total', 10)!; assert.equal(p.dayPrev, 10) })
console.log(`\n${n} testes passaram`)
