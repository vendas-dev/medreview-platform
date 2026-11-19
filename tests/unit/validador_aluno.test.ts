// Validador de Tipo de Aluno. Rodar: node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { lerResposta, emailValido, normalizarEmail, dataBR, diasAte, progressoMatricula, DEAL_ID_VALIDADOR } from '../../lib/aluno/tipo'

let n = 0; const t = (nome: string, f: () => void) => { f(); n++; console.log('ok  ' + nome) }

t('valor fixo do dealId é "validador"', () => assert.equal(DEAL_ID_VALIDADOR, 'validador'))
t('e-mail: normaliza (espaços/maiúsculas) e valida', () => {
  assert.equal(normalizarEmail('  Raquel_Nobre@Outlook.com '), 'raquel_nobre@outlook.com'); assert.equal(normalizarEmail(null), '')
  for (const ok of ['a@b.co', 'raquel_nobre@outlook.com', 'x.y+z@dominio.com.br']) assert.ok(emailValido(ok), ok)
  for (const ruim of ['', 'a', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@@b.com', 'a@b.c']) assert.ok(!emailValido(ruim), ruim)
})
t('Ex-aluno (array com 1 objeto): tipo e contagens, sem datas', () => {
  const r = lerResposta([{ id: 19720, nome: 'raquel_nobre', email: 'raquel_nobre@outlook.com', whatsapp: '', matriculas: [], matriculas_expiradas: 1, tipo_cliente: 'Ex-aluno', matriculas_ativas: 0, possui_matricula_ativa_valida: false, possui_matricula_expirada_valida: true }])!
  assert.deepEqual(r, { tipo: 'Ex-aluno', inicio: null, fim: null, ativas: 0, expiradas: 1 })
})
t('Novo aluno (objeto sem dados pessoais)', () => {
  const r = lerResposta([{ tipo_cliente: 'Novo aluno', matriculas_ativas: 0, matriculas_expiradas: 0, possui_matricula_ativa_valida: false, possui_matricula_expirada_valida: false }])!
  assert.deepEqual(r, { tipo: 'Novo aluno', inicio: null, fim: null, ativas: 0, expiradas: 0 })
})
t('Aluno: leva início e fim da matrícula ativa mais recente', () => {
  const r = lerResposta([{ tipo_cliente: 'Aluno', matriculas: [{}], matriculas_expiradas: 2, matriculas_ativas: 24, data_matricula_recente_ativa_inicio: '2025-11-22 11:41:57', data_matricula_recente_ativa_fim: '2026-11-22 23:59:59' }])!
  assert.deepEqual(r, { tipo: 'Aluno', inicio: '2025-11-22 11:41:57', fim: '2026-11-22 23:59:59', ativas: 24, expiradas: 2 })
})
t('aceita objeto direto (sem array) e variações de caixa/espaço', () => {
  assert.equal(lerResposta({ tipo_cliente: ' ALUNO ' })!.tipo, 'Aluno'); assert.equal(lerResposta({ tipo_cliente: 'ex aluno' })!.tipo, 'Ex-aluno'); assert.equal(lerResposta({ tipo_cliente: 'novo ALUNO' })!.tipo, 'Novo aluno')
})
t('Aluno sem datas não quebra; datas fora de Aluno são ignoradas', () => {
  assert.deepEqual([lerResposta({ tipo_cliente: 'Aluno' })!.inicio, lerResposta({ tipo_cliente: 'Aluno' })!.fim], [null, null])
  assert.equal(lerResposta({ tipo_cliente: 'Ex-aluno', data_matricula_recente_ativa_inicio: '2025-01-01 00:00:00' })!.inicio, null)
})
t('resposta desconhecida/vazia → null (a tela mostra erro, não chuta)', () => {
  for (const x of [null, undefined, '', 'texto', 42, [], {}, [{}], [{ tipo_cliente: 'Prospect' }], [{ tipo_cliente: 7 }]]) assert.equal(lerResposta(x), null, JSON.stringify(x))
})
t('contagens inválidas viram 0', () => { const r = lerResposta({ tipo_cliente: 'Aluno', matriculas_ativas: 'x', matriculas_expiradas: -3 })!; assert.equal(r.ativas, 0); assert.equal(r.expiradas, 0) })
t('dataBR e diasAte', () => {
  assert.equal(dataBR('2026-11-22 23:59:59'), '22/11/2026'); assert.equal(dataBR(null), '—'); assert.equal(dataBR('lixo'), '—')
  assert.equal(diasAte('2026-11-22 23:59:59', '2026-11-19'), 3); assert.equal(diasAte('2026-11-19 10:00:00', '2026-11-19'), 0); assert.equal(diasAte('2026-11-18 00:00:00', '2026-11-19'), -1); assert.equal(diasAte(null, '2026-11-19'), null)
})
t('progressoMatricula: 0–100, trava nas pontas, null sem data/intervalo inválido', () => {
  assert.equal(progressoMatricula('2026-01-01 00:00:00', '2026-01-11 23:59:59', '2026-01-06'), 50); assert.equal(progressoMatricula('2026-01-01 00:00:00', '2026-01-11 23:59:59', '2025-12-01'), 0)
  assert.equal(progressoMatricula('2026-01-01 00:00:00', '2026-01-11 23:59:59', '2027-01-01'), 100); assert.equal(progressoMatricula(null, '2026-01-11', '2026-01-06'), null); assert.equal(progressoMatricula('2026-02-01', '2026-01-01', '2026-01-06'), null)
})
console.log(`\n${n} testes passaram`)
