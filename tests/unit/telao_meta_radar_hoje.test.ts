import assert from 'node:assert/strict'
import { aplicarMetaRadarHoje, usaMetaRadarHoje, META_DIA_RADAR_DATAS } from '@/lib/telao/metaRadarHoje'
import type { Goal } from '@/lib/telao/types'
let n = 0
const t = (nome: string, f: () => void) => { f(); n++; console.log('ok ', nome) }
const g = (period: 'day' | 'month', vertical: string | null, v: number) => ({ id: `${vertical}-${period}`, period, period_key: 'x', vertical, target_value: v }) as unknown as Goal
const base = [g('month', null, 10_000_000), g('day', null, 500_000), g('day', 'anestreview', 90_000), g('month', 'anestreview', 2_000_000)]
const HOJE = META_DIA_RADAR_DATAS[0]
t('só 27/11/2026 está na lista', () => { assert.deepEqual(META_DIA_RADAR_DATAS, ['2026-11-27']); assert.equal(usaMetaRadarHoje('2026-11-28'), false) })
t('hoje: a meta do dia GERAL vira a do Radar; o resto fica igual', () => {
  const r = aplicarMetaRadarHoje(base, HOJE, 614_930)
  assert.equal(r[1].target_value, 614_930); assert.equal(r[0].target_value, 10_000_000); assert.equal(r[2].target_value, 90_000); assert.equal(r[3].target_value, 2_000_000)
  assert.equal(base[1].target_value, 500_000)          // não altera o original
})
t('outro dia: nada muda (volta ao cálculo de sempre)', () => assert.equal(aplicarMetaRadarHoje(base, '2026-11-28', 614_930), base))
t('radar sem valor (null/0/NaN): mantém o cálculo de sempre', () => { for (const v of [null, undefined, 0, -5, NaN]) assert.equal(aplicarMetaRadarHoje(base, HOJE, v as any), base) })
console.log(`${n} testes de meta do telão (Radar) passaram`)
