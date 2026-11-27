// Forecast padronizado no Radar: "Meta do Radar" editável, rota que segue o plano do Radar e hora a hora com "já fizemos" ao lado da meta.
import assert from 'node:assert/strict'
import { buildPlanoDia, buildSeries, metaOf, metaRadarOf, radarOf, serieDe, VKEYS, type YoYData, type VKey } from '../../lib/dashboard/yoy'
import { buildRota } from '../../lib/dashboard/projecao'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const zeros = (N = 30) => Object.fromEntries(VKEYS.map(k => [k, new Array(N).fill(0)])) as Record<VKey, number[]>
const horas = (N = 30) => Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: N }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>
function dados(over: Partial<YoYData> = {}): YoYData {
  const prev = zeros(), cur = zeros(), prevH = horas(), prevHN = horas(), curH = horas(), curHN = horas()
  for (let d = 1; d <= 30; d++) { prev.anest[d - 1] = 10000; prev.oft[d - 1] = 5000; prevH.anest[d - 1][10] = 5000; prevH.anest[d - 1][20] = 5000 }
  for (let d = 1; d <= 26; d++) cur.anest[d - 1] = 15000                         // 15.000 por dia até 26/11
  cur.anest[26] = 6000; curH.anest[26][9] = 1000; curH.anest[26][10] = 3000; curH.anest[26][11] = 2000; curHN.anest[26][10] = 2     // 27/11 (hoje), 11h
  return { metas: { anest: 600000, oft: 300000, ortop: 0, r1: 100000, geral: 1_000_000 }, today: '2026-11-27', month: '2026-11', dayOfMonth: 27, yearCur: 2026, yearPrev: 2025, daysInMonth: { cur: 30, prev: 30 }, cur, prev, prevH, prevHN, curH, curHN, horaAgora: 11, ...over }
}

t('sem Meta do Radar, tudo usa a meta cadastrada', () => { const d = dados(); assert.equal(metaRadarOf(d, 'total'), 1_000_000); assert.equal(metaRadarOf(d, 'anest'), 600000) })
t('com Meta do Radar: o total é ela, as verticais dividem na proporção das cadastradas e a soma fecha; a cadastrada segue nos outros painéis', () => {
  const d = dados({ metaRadar: 1_360_000 })
  assert.equal(metaRadarOf(d, 'total'), 1_360_000); assert.equal(metaOf(d, 'total'), 1_000_000)
  const soma = VKEYS.reduce((a, k) => a + metaRadarOf(d, k), 0); assert.ok(Math.abs(soma - 1_360_000) < 0.05)
  assert.equal(radarOf(d, 'total').meta, 1_360_000)
})
t('a rota SEGUE o Radar: a partir da segunda do plano acumula a meta planejada e fecha na Meta do Radar', () => {
  const d = dados({ metaRadar: 1_360_000 }), rd = radarOf(d, 'total'), r = buildRota(serieDe(d, 'total'), 1_360_000, rd)
  assert.equal(rd.inicio, 23)
  for (const l of rd.linhas) assert.equal(r.pontos[l.day - 1].rota, l.metaAcum)
  assert.ok(Math.abs((r.pontos[29].rota as number) - 1_360_000) < 0.01)
  assert.ok(Math.abs((r.pontos[21].rota as number) - rd.realAntes) < 0.01)      // antes do plano a curva chega no que já tinha sido vendido
  assert.ok((r.pontos[10].rota as number) < (r.pontos[20].rota as number))
})
t('sem o radar, a rota é a de antes (curva de 2025 escalada para a meta)', () => {
  const d = dados(), r = buildRota(serieDe(d, 'total'), 1_000_000)
  assert.ok(Math.abs((r.pontos[29].rota as number) - 1_000_000) < 0.01)
})
t('hora a hora: o "já fizemos" por hora entra ao lado da meta, só até a hora de agora, e a soma bate com o dia', () => {
  const d = dados({ metaRadar: 1_360_000 }), p = buildPlanoDia(d, 'total', 27)!
  assert.equal(p.temReal, true); assert.equal(p.realDia, 6000); assert.equal(p.vendasDia, 2); assert.equal(p.horaAgora, 11)
  assert.equal(p.horas[10].real, 3000); assert.equal(p.horas[11].real, 2000); assert.equal(p.horas[12].real, null); assert.equal(p.horas[12].realAcum, null)
  assert.equal(p.horas[11].realAcum, 6000)
  const linha = radarOf(d, 'total').linhas.find(l => l.day === 27)!; assert.equal(p.alvoDia, linha.ajustada)
  assert.ok(Math.abs(p.horas[23].alvoAcum - p.alvoDia) < 0.01)
  assert.ok(p.projDia !== null && p.projDia >= 6000)
})
t('dia que ainda não chegou: sem realizado; dia que passou: o dia inteiro', () => {
  const d = dados({ metaRadar: 1_360_000 }), f = buildPlanoDia(d, 'total', 29)!, ps = buildPlanoDia(d, 'total', 26)!
  assert.equal(f.temReal, false); assert.equal(f.realDia, null); assert.ok(f.horas.every(h => h.real === null))
  assert.equal(ps.realDia, 15000); assert.equal(ps.horaAgora, null)
})
t('barras por dia trazem a meta do Radar: ajustada de hoje em diante, planejada antes; antes do plano, nada', () => {
  const d = dados({ metaRadar: 1_360_000 }), s = buildSeries(d, 'total'), rd = radarOf(d, 'total')
  assert.equal(s.days[0].metaDia, null)
  for (const l of rd.linhas) assert.equal(s.days[l.day - 1].metaDia, l.day >= 27 ? l.ajustada : l.planejada)
})

console.log(`\n${n} testes passaram`)
