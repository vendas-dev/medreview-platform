import assert from 'node:assert/strict'
import { resolverTemplate, botmakerDe, buscaTemplate, chave, type TplRef } from '../../lib/disparos/templateResolve'
const ok = (n: string, f: () => void) => { f(); console.log('ok  ' + n) }
const T: TplRef[] = [
  { name: 'Abordagem Lead Frio', hubspot_name: 'Abordagem LF', internal_platform_id: 'multi_sales_disp_mkt_leadfrio_abordagem' },
  { name: 'Follow 2', hubspot_name: null, internal_platform_id: 'follow_up_2' },
  { name: 'Dup A', hubspot_name: 'Dup A HS', internal_platform_id: 'repetido' },
  { name: 'Dup B', hubspot_name: 'Dup B HS', internal_platform_id: 'repetido' },
]
ok('nome do HubSpot continua igual (como veio)', () => {
  const r = resolverTemplate(T, 'abordagem lf'); assert.equal(r.via, 'hubspot'); assert.equal(r.template, 'abordagem lf'); assert.ok(r.candidatos.includes('Abordagem LF'))
})
ok('nome interno da Botmaker no campo template → grava o nome do HubSpot', () => {
  const r = resolverTemplate(T, 'multi_sales_disp_mkt_leadfrio_abordagem'); assert.equal(r.via, 'botmaker'); assert.equal(r.template, 'Abordagem LF')
})
ok('nome da Botmaker em campo próprio, sem template', () => {
  const r = resolverTemplate(T, '', 'MULTI-SALES-DISP-MKT-LEADFRIO-ABORDAGEM'); assert.equal(r.template, 'Abordagem LF'); assert.equal(r.via, 'botmaker')
})
ok('sem hubspot_name usa o nome da cópia', () => { assert.equal(resolverTemplate(T, null, 'follow_up_2').template, 'Follow 2') })
ok('HubSpot + Botmaker juntos: vale o HubSpot enviado', () => {
  const r = resolverTemplate(T, 'Abordagem LF', 'multi_sales_disp_mkt_leadfrio_abordagem'); assert.equal(r.template, 'Abordagem LF'); assert.equal(r.via, 'hubspot')
})
ok('nome da Botmaker repetido em 2 templates é ambíguo: não chuta', () => {
  const r = resolverTemplate(T, '', 'repetido'); assert.equal(r.via, 'nenhum'); assert.equal(r.template, 'repetido')
})
ok('desconhecido segue como veio; vazio vira null', () => {
  assert.equal(resolverTemplate(T, 'qualquer coisa').template, 'qualquer coisa')
  assert.equal(resolverTemplate(T, '  ', null).template, null)
})
ok('botmakerDe lê os apelidos do campo', () => {
  assert.equal(botmakerDe({ nome_interno_botmaker: ' x ' }), 'x'); assert.equal(botmakerDe({ botmaker_name: 'y' }), 'y'); assert.equal(botmakerDe({ internal_platform_id: 'z' }), 'z'); assert.equal(botmakerDe({}), null)
})
ok('chave ignora acento, caixa e separadores', () => { assert.equal(chave(' Ação-Rápida v2 '), 'acao_rapida_v2') })
ok('busca acha pelo nome interno da Botmaker (e ainda por nome, HubSpot e conteúdo)', () => {
  const t = { name: 'Abordagem Lead Frio', content: 'Olá {{nome}}', hubspot_name: 'Abordagem LF', internal_platform_id: 'multi_sales_disp_mkt_leadfrio_abordagem' }
  for (const q of ['leadfrio_abordagem', 'MULTI SALES', 'multi-sales-disp', 'abordagem lf', 'lead frio', 'olá']) assert.ok(buscaTemplate(t, q), q)
  assert.ok(!buscaTemplate(t, 'inexistente')); assert.ok(buscaTemplate(t, '')); assert.ok(buscaTemplate({ name: 'a', content: null, internal_platform_id: null }, 'a'))
})
