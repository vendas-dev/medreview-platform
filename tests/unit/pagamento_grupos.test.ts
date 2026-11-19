// Forma de pagamento em 3 categorias (Telão Completo). Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { payGroupOf, payGrouped, toSale, type RawSale } from '../../lib/telao/analytics'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }
const raw = (o: Partial<RawSale>): RawSale => ({ id: Math.random().toString(36).slice(2), event_type: 'sale', vertical: 'anestreview', value: 100, occurred_at: '2026-11-18T15:00:00Z', ...o } as RawSale)
const sale = (o: Partial<RawSale>) => toSale(raw(o))!
const g = (o: Partial<RawSale>) => payGroupOf(sale(o))

t('Pix à vista, Pix sem parcelas e cartão em 1x → pagamentos à vista', () => {
  assert.equal(g({ payment_type: 'PIX', payment_installments: 1 }), 'avista'); assert.equal(g({ payment_type: 'PIX' }), 'avista'); assert.equal(g({ payment_type: 'CREDIT_CARD', payment_installments: 1 }), 'avista')
})
t('cartão, NuPay e Apple Pay em 2x ou mais → parcelamentos de cartões', () => {
  assert.equal(g({ payment_type: 'CREDIT_CARD', payment_installments: 12 }), 'cartao-parcelado'); assert.equal(g({ payment_type: 'NUPAY', payment_installments: 3 }), 'cartao-parcelado'); assert.equal(g({ payment_type: 'APPLE_PAY', payment_installments: 2 }), 'cartao-parcelado')
})
t('NuPay e Apple Pay em 1x → à vista', () => { assert.equal(g({ payment_type: 'NUPAY', payment_installments: 1 }), 'avista'); assert.equal(g({ payment_type: 'APPLE_PAY', payment_installments: 1 }), 'avista') })
t('boleto é boleto: à vista, parcelado ou sem número de parcelas', () => {
  assert.equal(g({ payment_type: 'BILLET', payment_installments: 1 }), 'boleto'); assert.equal(g({ payment_type: 'BILLET', payment_installments: 6 }), 'boleto'); assert.equal(g({ payment_type: 'BILLET' }), 'boleto'); assert.equal(g({ payment_type: 'BOLETO' }), 'boleto')
})
t('o nº de parcelas cai para o total da recorrência quando vem vazio', () => assert.equal(g({ payment_type: 'CREDIT_CARD', total_installments: 10 }), 'cartao-parcelado'))
t('sem forma de pagamento, ou cartão sem nº de parcelas → não classifica (nada é presumido)', () => { assert.equal(g({ payment_type: null }), null); assert.equal(g({ payment_type: 'CREDIT_CARD' }), null) })
t('as 3 categorias + "sem forma" fecham a receita do período', () => {
  const v = [
    sale({ payment_type: 'PIX', value: 100 }), sale({ payment_type: 'CREDIT_CARD', payment_installments: 1, value: 50 }),
    sale({ payment_type: 'CREDIT_CARD', payment_installments: 12, value: 1000 }), sale({ payment_type: 'NUPAY', payment_installments: 4, value: 200 }),
    sale({ payment_type: 'BILLET', payment_installments: 3, value: 300 }), sale({ payment_type: null, value: 70 }),
  ]
  const p = payGrouped(v)
  assert.deepEqual(p.groups.map(x => x.id), ['avista', 'cartao-parcelado', 'boleto'])
  assert.deepEqual(p.groups.map(x => x.revenue), [150, 1200, 300]); assert.deepEqual(p.groups.map(x => x.count), [2, 2, 1])
  assert.equal(p.unknown.revenue, 70); assert.equal(p.unknown.count, 1); assert.equal(p.total, 1720)
  assert.equal(p.groups.reduce((a, x) => a + x.revenue, 0) + p.unknown.revenue, p.total)
  assert.equal(p.groups[1].avgInstallments, 8); assert.equal(p.groups[0].avgInstallments, null)
  assert.ok(Math.abs(p.coveragePct - 1650 / 1720 * 100) < 1e-9)
})
t('sem vendas: as 3 categorias aparecem zeradas', () => { const p = payGrouped([]); assert.equal(p.groups.length, 3); assert.ok(p.groups.every(x => x.revenue === 0 && x.count === 0)); assert.equal(p.coveragePct, 0) })
console.log(`\n${n} testes passaram`)
