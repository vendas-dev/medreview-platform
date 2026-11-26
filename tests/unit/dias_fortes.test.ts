// Dias fortes do Forecast: 27, 28 e 29 de 2026 comparados com os dias equivalentes (mesmo dia da semana) de 2025. O ano passado já entra ALINHADO
// por dia da semana (364 dias antes), então não há exceção no cálculo: o dia i+1 deste ano sempre casa com o dia prev[i]. Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { buildPlanoDia, buildRoute, diaPar, radarOf, VKEYS, type YoYData, type VKey } from '../../lib/dashboard/yoy'
import { refDates } from '../../lib/dashboard/projecao'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const zeros = (N = 30) => Object.fromEntries(VKEYS.map(k => [k, new Array(N).fill(0)])) as Record<VKey, number[]>
const horas = (N = 30) => Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: N }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>
// prev[i] = o dia de 2025 que casa com o dia i+1 de 2026 (mesmo dia da semana): 27/11 ↔ 28/11/2025 (sex), 28 ↔ 29 (sáb), 29 ↔ 30 (dom)
const FECH = 26 * 1000 + 20000 + 8000 + 5000 + 1000      // período equivalente de 2025 no teste: R$ 1.000 por dia, menos os três dias fortes e o 30/11 (= Cyber Monday de 01/12/2025: R$ 1.000)
function dados(over: Partial<YoYData> = {}): YoYData {
  const prev = zeros(), prevH = horas(), prevHN = horas()
  for (let d = 1; d <= 30; d++) prev.anest[d - 1] = 1000                      // dia comum: R$ 1.000
  const forte = { 27: 20000, 28: 8000, 29: 5000 } as Record<number, number>
  for (const [dia, v] of Object.entries(forte)) { prev.anest[+dia - 1] = v; prevH.anest[+dia - 1][10] = v / 2; prevH.anest[+dia - 1][20] = v / 2; prevHN.anest[+dia - 1][10] = 2; prevHN.anest[+dia - 1][20] = 3 }
  return { metas: { anest: 0, oft: 0, ortop: 0, r1: 0, geral: 1_000_000 }, today: '2026-11-18', month: '2026-11', dayOfMonth: 18, yearCur: 2026, yearPrev: 2025, daysInMonth: { cur: 30, prev: 30 }, cur: zeros(), prev, prevH, prevHN, ...over }
}

t('a régua de 2025: 27/11/2026 (sexta) ↔ 28/11/2025 (sexta); 23/11 ↔ 24/11; 30/11 ↔ 01/12/2025 (Cyber Monday); 01/11 ↔ 02/11', () => {
  const r = refDates('2026-11'); assert.equal(r.length, 30)
  assert.equal(r[26], '2025-11-28'); assert.equal(r[27], '2025-11-29'); assert.equal(r[28], '2025-11-30'); assert.equal(r[22], '2025-11-24'); assert.equal(r[29], '2025-12-01'); assert.equal(r[0], '2025-11-02')
})
t('diaPar é a identidade: o ano passado já vem alinhado', () => { assert.equal(diaPar(dados(), 27), 27); assert.equal(diaPar(dados({ month: '2026-10' }), 10), 10) })
t('os dias fortes do mês são 27, 28 e 29, em ordem, com o valor do dia equivalente de 2025 e a data real dele', () => {
  const r = buildRoute(dados(), 'total')
  assert.deepEqual(r.picosMes.map(p => p.day), [27, 28, 29]); assert.deepEqual(r.picosMes.map(p => p.dayPrev), [28, 29, 30]); assert.deepEqual(r.picosMes.map(p => p.refDate), ['2025-11-28', '2025-11-29', '2025-11-30'])
  assert.deepEqual(r.picosMes.map(p => p.valor), [20000, 8000, 5000]); assert.deepEqual(r.picosMes.map(p => p.wd), ['sex', 'sáb', 'dom']); assert.deepEqual(r.picosMes.map(p => p.wdPrev), ['sex', 'sáb', 'dom'])
  assert.ok(Math.abs(r.picosMesShare - 33000 / FECH * 100) < 1e-9)      // 20.000 + 8.000 + 5.000 sobre o período inteiro de 2025
})
t('as estrelas do gráfico (picos) marcam só os dias fortes que ainda vêm: 27, 28, 29 de 2026', () => {
  assert.deepEqual(buildRoute(dados(), 'total').picos.map(p => p.day).sort(), [27, 28, 29])
  assert.deepEqual(buildRoute(dados({ today: '2026-11-28', dayOfMonth: 28 }), 'total').picos.map(p => p.day), [29])        // 27 e 28 já passaram/são hoje
})
t('mês sem configuração: continua sendo os 3 maiores dias do ano passado', () => {
  const d = dados({ month: '2026-10', today: '2026-10-05', dayOfMonth: 5, daysInMonth: { cur: 31, prev: 31 }, prev: Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: 31 }, (_, i) => (k === 'anest' ? (i >= 27 && i <= 29 ? 5000 + i : 1000) : 0))])) as Record<VKey, number[]>, cur: zeros(31), prevH: undefined, prevHN: undefined })
  assert.deepEqual(buildRoute(d, 'total').picosMes.map(p => p.day), [30, 29, 28])
})
t('plano hora a hora de 27/11 usa o peso e as horas de 28/11/2025 e fecha na meta do dia do RADAR', () => {
  const d = dados(), p = buildPlanoDia(d, 'total', 27)!, linha = radarOf(d, 'total').linhas.find(l => l.day === 27)!
  assert.equal(p.day, 27); assert.equal(p.dayPrev, 28); assert.equal(p.refDate, '2025-11-28'); assert.equal(p.valorPrev, 20000)
  assert.ok(Math.abs(p.share - 20000 / FECH * 100) < 1e-9); assert.equal(p.alvoDia, linha.ajustada)
  assert.ok(Math.abs(p.alvoDia - 1_000_000 * 20000 / 45000) < 0.02)      // radar de 16 a 30/11: a meta inteira repartida pelos dias na forma de 2025
  assert.equal(p.horas.length, 24); assert.equal(p.horas[10].prev, 10000); assert.equal(p.horas[20].prev, 10000)
  const soma = Math.round(p.horas.reduce((s, h) => s + h.alvo, 0) * 100) / 100; assert.equal(soma, p.alvoDia)
})
t('o dia comum também tem dia de régua: 10/11 ↔ 11/11/2025 (dayPrev = 11)', () => { const p = buildPlanoDia(dados(), 'total', 10)!; assert.equal(p.dayPrev, 11); assert.equal(p.refDate, '2025-11-11') })
console.log(`\n${n} testes passaram`)
