// Meta do ano (60 mi essencial → 72 mi desafio). Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { buildMetaAno, diasRestantesAno, realizadoDoAno } from '../../lib/dashboard/metaAno'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const perto = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`)

t('dias restantes: 18/11/2026 → 43 (até 31/12); 31/12 → 0; ano bissexto', () => { assert.equal(diasRestantesAno('2026-11-18'), 43); assert.equal(diasRestantesAno('2026-12-31'), 0); assert.equal(diasRestantesAno('2026-01-01'), 364); assert.equal(diasRestantesAno('2028-01-01'), 365) })
t('abaixo da essencial: fase caminho, % sobre cada meta e o que falta', () => {
  const m = buildMetaAno(30_000_000, '2026-11-18')
  assert.equal(m.fase, 'caminho'); perto(m.pctEssencial, 50); perto(m.pctDesafio, 100 / 3 * 1.25); assert.equal(m.faltaEssencial, 30_000_000); assert.equal(m.faltaDesafio, 42_000_000)
  perto(m.porDiaEssencial!, 30_000_000 / 43); perto(m.porDiaDesafio!, 42_000_000 / 43)
})
t('régua: a essencial fica em 83,33% e o preenchimento é realizado ÷ desafio', () => { const m = buildMetaAno(36_000_000, '2026-11-18'); perto(m.markPct, 60 / 72 * 100); perto(m.fillPct, 50) })
t('bateu a essencial: fase essencial, falta 0, sem "por dia" da essencial, mas o desafio segue', () => {
  const m = buildMetaAno(65_000_000, '2026-11-18'); assert.equal(m.fase, 'essencial'); assert.equal(m.faltaEssencial, 0); assert.equal(m.porDiaEssencial, null); assert.equal(m.faltaDesafio, 7_000_000); assert.ok(m.pctEssencial > 100 && m.pctDesafio < 100)
})
t('bateu o desafio: preenchimento trava em 100%, % passa de 100', () => { const m = buildMetaAno(80_000_000, '2026-12-01'); assert.equal(m.fase, 'desafio'); assert.equal(m.fillPct, 100); assert.ok(m.pctDesafio > 100); assert.equal(m.faltaDesafio, 0) })
t('exatamente 60 mi já é a essencial batida', () => assert.equal(buildMetaAno(60_000_000, '2026-06-01').fase, 'essencial'))
t('valor inválido/negativo vira 0', () => { assert.equal(buildMetaAno(NaN, '2026-11-18').realizado, 0); assert.equal(buildMetaAno(-5, '2026-11-18').realizado, 0) })
t('último dia do ano: sem "por dia"', () => assert.equal(buildMetaAno(1, '2026-12-31').porDiaEssencial, null))
t('realizadoDoAno soma só o ano e só as verticais pedidas', () => {
  const v = [{ day: '2026-01-02', value: 100.1, vertical: 'anestreview' }, { day: '2026-11-18', value: 50.2, vertical: 'medreview' }, { day: '2025-12-31', value: 999, vertical: 'anestreview' }, { day: '2026-05-05', value: 7, vertical: 'psiqclara' }]
  assert.equal(realizadoDoAno(v, 2026, ['anestreview', 'oftreview', 'ortopreview', 'medreview']), 150.3)
})
console.log(`\n${n} testes passaram`)
