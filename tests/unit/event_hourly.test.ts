import assert from 'node:assert/strict'
import { compara, cumAt, curvaDia, diaAnterior, estadoDia, horaTxt, janelaHoras, nowX, tomDe, type HourlyInput } from '../../lib/dashboard/eventHourly'
import { aggregate } from '../../lib/dashboard/eventGoalsCore'
let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const z = () => new Array(24).fill(0)
const d1 = z(), d2 = z(); d1[10] = 1000; d1[11] = 2000; d1[15] = 500; d2[10] = 400; d2[11] = 600
const base: HourlyInput = { days: ['2026-11-26', '2026-11-27'], today: '2026-11-27', status: 'andamento', serverTime: '2026-11-27T14:30:00Z', hourly: { '2026-11-26': d1, '2026-11-27': d2 }, totals: { '2026-11-27': 1000 } }   // 14:30Z = 11h30 em Brasília

t('nowX: 14:30 UTC = 11h30 de Brasília', () => assert.equal(nowX('2026-11-27T14:30:00Z'), 11.5))
t('cumAt interpola dentro da hora', () => { assert.equal(cumAt(d1, 10), 0); assert.equal(cumAt(d1, 11), 1000); assert.equal(cumAt(d1, 11.5), 2000); assert.equal(cumAt(d1, 12), 3000); assert.equal(cumAt(d1, 24), 3500); assert.equal(cumAt(undefined, 5), 0) })
t('estado e dia anterior', () => { assert.equal(estadoDia(base, '2026-11-26'), 'fechado'); assert.equal(estadoDia(base, '2026-11-27'), 'ao-vivo'); assert.equal(estadoDia({ ...base, status: 'encerrado' }, '2026-11-27'), 'fechado'); assert.equal(diaAnterior(base.days, '2026-11-27'), '2026-11-26'); assert.equal(diaAnterior(base.days, '2026-11-26'), null) })
t('curva do dia ao vivo termina em "agora" com o total exato', () => {
  const c = curvaDia(base, '2026-11-27'); assert.equal(c.estado, 'ao-vivo'); const u = c.pontos[c.pontos.length - 1]; assert.equal(u.x, 11.5); assert.equal(u.v, 1000)
  assert.ok(c.pontos.every((p, i, a) => i === 0 || p.v >= a[i - 1].v))
  assert.equal(curvaDia(base, '2026-11-26').pontos.at(-1)!.x, 24)
  const j = curvaDia(base, '2026-11-26', 8, 19); assert.equal(j.pontos.at(-1)!.x, 19); assert.equal(j.pontos.at(-1)!.v, 3500); assert.ok(j.pontos.every(p => p.x <= 19))      // dia fechado nunca passa da janela e termina no total do dia
  assert.equal(curvaDia({ ...base, today: '2026-11-26' }, '2026-11-27').pontos.length, 0)
})
t('"quanto já tínhamos vendido ontem nesse mesmo horário": hoje 11h30 × ontem 11h30', () => {
  const c = compara(base, '2026-11-27', 11.5); assert.equal(c.cur, 1000); assert.equal(c.prev, 2000); assert.equal(c.delta, -1000); assert.equal(c.pct, -50); assert.equal(c.tom, 'abaixo'); assert.equal(c.prevDay, '2026-11-26')
  assert.equal(compara(base, '2026-11-27', 13).cur, null)           // hoje ainda não chegou em 13h
  assert.equal(compara(base, '2026-11-26', 13).prev, null)          // sem dia anterior
})
t('tom: acima / perto (até 10% abaixo) / abaixo / igual', () => { assert.equal(tomDe(110, 100), 'acima'); assert.equal(tomDe(95, 100), 'perto'); assert.equal(tomDe(50, 100), 'abaixo'); assert.equal(tomDe(100, 100), 'igual'); assert.equal(tomDe(5, 0), 'acima') })
t('janela de horas e rótulo', () => { const [a, b] = janelaHoras(base); assert.ok(a <= 9 && b >= 16 && b - a >= 6); assert.equal(horaTxt(11.5), '11h30'); assert.equal(horaTxt(9), '9h'); assert.deepEqual(janelaHoras({ ...base, hourly: {} }), [8, 20]) })
t('aggregate traz receita e vendas por hora de Brasília, só dos dias do evento', () => {
  const ed: any = { id: 'e', name: 'E', event_name: 'Evento X', start_date: '2026-11-18', end_date: '2026-11-18', vertical: null, notes: null }
  const row = (iso: string, v: number): any => ({ id: iso, value: v, occurred_at: iso, event_name: 'Evento X', closer_id: null, closer_hubspot_id: null, is_self_checkout: true, product: 'P' })
  const a = aggregate([row('2026-11-18T13:10:00Z', 100), row('2026-11-18T13:50:00Z', 50), row('2026-11-18T23:30:00Z', 10), row('2026-11-19T02:30:00Z', 7)], ed, [])
  assert.equal(a.hourly['2026-11-18'][10], 150); assert.equal(a.hourlyN['2026-11-18'][10], 2); assert.equal(a.hourly['2026-11-18'][20], 10); assert.equal(a.hourly['2026-11-18'][23], 7)
})
console.log(`\n${n} testes passaram`)
