import assert from 'node:assert/strict'
import { maskMoneyPasted, maskMoneyTyped, moneyFieldText } from '../../lib/dashboard/moneyMask'
let n = 0
const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }

t('digitando: milhar com ponto, vírgula começa os centavos, máx. 2 casas', () => {
  assert.deepEqual(maskMoneyTyped('5'), { text: '5', value: 5 })
  assert.deepEqual(maskMoneyTyped('1234'), { text: '1.234', value: 1234 })
  assert.deepEqual(maskMoneyTyped('1.2345'), { text: '12.345', value: 12345 })          // digitou mais um dígito no meio da máscara
  assert.deepEqual(maskMoneyTyped('12.345,'), { text: '12.345,', value: 12345 })        // vírgula sozinha fica no campo
  assert.deepEqual(maskMoneyTyped('12.345,6'), { text: '12.345,6', value: 12345.6 })
  assert.deepEqual(maskMoneyTyped('12.345,678'), { text: '12.345,67', value: 12345.67 })
  assert.deepEqual(maskMoneyTyped(','), { text: '0,', value: 0 })
  assert.deepEqual(maskMoneyTyped(',5'), { text: '0,5', value: 0.5 })
  assert.deepEqual(maskMoneyTyped('0007'), { text: '7', value: 7 })
  assert.deepEqual(maskMoneyTyped('1,2,3'), { text: '1,23', value: 1.23 })
  assert.deepEqual(maskMoneyTyped(''), { text: '', value: undefined }); assert.deepEqual(maskMoneyTyped('abc'), { text: '', value: undefined })
  assert.equal(maskMoneyTyped('1234567890123').value, 123456789)                        // limita o tamanho
})
t('colando: formatos brasileiros e americanos', () => {
  const v = (s: string) => maskMoneyPasted(s).value
  assert.equal(v('R$ 1.234,56'), 1234.56); assert.equal(v('1234,56'), 1234.56); assert.equal(v('1234.56'), 1234.56)
  assert.equal(v('1,234.56'), 1234.56); assert.equal(v('50.000'), 50000); assert.equal(v('1.234.567'), 1234567)
  assert.equal(v('1.5'), 1.5); assert.equal(v('2,5'), 2.5); assert.equal(v('  R$  10.000,00 '), 10000); assert.equal(v('1.234,5'), 1234.5)
  assert.equal(v('abc'), undefined); assert.equal(v('1.234,567'), 1234.56)               // 3ª casa é cortada
  assert.equal(maskMoneyPasted('R$ 1234567,5').text, '1.234.567,5')
})
t('texto do campo parado: sem ",00" nos inteiros; 2 casas nos quebrados; sem erro de ponto flutuante', () => {
  assert.equal(moneyFieldText(50000), '50.000'); assert.equal(moneyFieldText(1234.5), '1.234,50'); assert.equal(moneyFieldText(0.07), '0,07')
  assert.equal(moneyFieldText(0.1 + 0.2), '0,30'); assert.equal(moneyFieldText(undefined), ''); assert.equal(moneyFieldText(0), '0')
  assert.equal(maskMoneyTyped(moneyFieldText(98765.43)).value, 98765.43)                 // ida e volta
})
console.log(`\n${n} testes da máscara passaram`)
