// @ts-nocheck — teste com banco de mentira e dados soltos; roda com: node tests/unit/rodar.mjs
// Campanhas · critério POR HORA. Foco: FUSO (relógio de São Paulo) e as bordas (00:00, 23:59:59, virada de dia, 1ª/última rodada).
// Dica: o resultado NÃO pode depender do fuso do servidor — rode também com  TZ=UTC / TZ=Asia/Tokyo / TZ=America/Los_Angeles node tests/unit/rodar.mjs
import assert from 'node:assert/strict'
import { fakeAdmin } from './_banco_de_mentira'
import { allSlots, cleanHourly, defaultHourly, evalHourly, fmtH, slotByPos, slotLabel, slotsOfDay, spMinutes, spParts, SLOT_GRACE_MIN } from '../../lib/campaigns/hourly'
import { attributeSales, evaluate, howToWin, prizeFor, ruleSignature, validateDraft } from '../../lib/campaigns/engine'
import { draftToDb, rowToDraft, publishCampaign, runCampaignTick, cleanPrizes } from '../../lib/campaigns/server'
import { parseDraft } from '../../lib/campaigns/api'
import { emptyDraft } from '../../lib/campaigns/types'
import { hCampaignAction, hCampaignWinnersView, hGetCampaign, hPatchCampaign, hPreview } from '../../lib/campaigns/handlers'

let n = 0
const t = async (nome: string, f: () => void | Promise<void>) => { await f(); n++; console.log('ok  ' + nome) }
const sp = (day: string, hhmm: string, sec = '00', ms = '000') => `${day}T${hhmm}:${sec}.${ms}-03:00`      // um instante dado no relógio de SP → ISO (só nos testes)
const iso = (s: string) => new Date(s).toISOString()

const D1 = '2026-11-24', D2 = '2026-11-25'
const mk = (over: any = {}) => ({ ...emptyDraft(D1), name: 'Hora H', prize: 'Vale 50', criterion: 'hourly', ends_on: D2, teams: { OAO: { winners: 1, target: null }, R1: { winners: 1, target: null } }, hourly: { mode: 'full', split: 'hour', metric: 'revenue', ranges: [] }, ...over })

// ═══ 1) relógio de São Paulo ═══
await t('spParts: virada de dia em São Paulo (02:59:59Z = 23:59 de ontem; 03:00Z = 00:00 de hoje)', () => {
  assert.deepEqual(spParts('2026-11-24T02:59:59.999Z'), { day: '2026-11-23', min: 1439 })
  assert.deepEqual(spParts('2026-11-24T03:00:00.000Z'), { day: '2026-11-24', min: 0 })
  assert.deepEqual(spParts('2026-11-24T14:30:00Z'), { day: '2026-11-24', min: 690 })
  assert.equal(spParts('lixo'), null); assert.equal(spMinutes('2026-11-24T03:00:00Z'), 0)
})
await t('spParts: meia-noite é 0 (nunca 24) e funciona com o horário de verão antigo (jan/2019 era UTC-2)', () => {
  assert.equal(spParts('2026-11-24T03:00:00Z').min, 0)
  assert.deepEqual(spParts('2019-01-15T02:30:00Z'), { day: '2019-01-15', min: 30 })      // verão de 2019: UTC-2 → 00:30. A conta usa as regras reais do fuso, não "-3 fixo"
  assert.deepEqual(spParts('2019-07-15T02:30:00Z'), { day: '2019-07-14', min: 1410 })    // sem verão: UTC-3 → 23:30 do dia anterior
})

// ═══ 2) rodadas ═══
await t('dia completo = 24 rodadas de 1h; intervalos por hora e por intervalo', () => {
  const full = slotsOfDay(defaultHourly()); assert.equal(full.length, 24); assert.deepEqual([full[0].from, full[0].to, full[23].from, full[23].to], [0, 60, 1380, 1440])
  const hr = slotsOfDay({ mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 840, to: 960 }, { from: 540, to: 720 }] })        // fora de ordem de propósito
  assert.deepEqual(hr.map(s => [s.from, s.to]), [[540, 600], [600, 660], [660, 720], [840, 900], [900, 960]]); assert.deepEqual(hr.map(s => s.idx), [0, 1, 2, 3, 4])
  const whole = slotsOfDay({ mode: 'ranges', split: 'whole', metric: 'revenue', ranges: [{ from: 540, to: 720 }, { from: 840, to: 990 }] }); assert.deepEqual(whole.map(s => [s.from, s.to]), [[540, 720], [840, 990]])
})
await t('allSlots / slotByPos: nº da rodada é estável e vai de dia em dia', () => {
  const d = mk(); const a = allSlots(d); assert.equal(a.length, 48); assert.equal(a[0].pos, 1); assert.equal(a[24].pos, 25); assert.equal(a[24].day, D2); assert.equal(a[24].from, 0)
  assert.deepEqual([slotByPos(d, 14).day, slotByPos(d, 14).from], [D1, 780]); assert.equal(slotByPos(d, 49), null); assert.equal(slotByPos(d, 0), null)
  assert.equal(slotLabel(d, 25), '25/11 · 00h–01h'); assert.equal(fmtH(570), '09h30'); assert.equal(fmtH(1440), '24h')
})

// ═══ 3) apuração: bordas de horário ═══
const people = [{ userId: 'u1', name: 'Ana' }, { userId: 'u2', name: 'Bia' }]
const cr = (u: string, v: number, at: string) => ({ userId: u, value: v, at: iso(at) })
await t('BORDAS: 13:59:59.999 é da rodada 13–14; 14:00:00.000 é da 14–15; 23:59:59 é da 23–24; 00:00 do dia seguinte é da 00–01 do DIA SEGUINTE', () => {
  const d = mk(), credits = [
    cr('u1', 100, sp(D1, '13:59', '59', '999')), cr('u2', 50, sp(D1, '14:00')), cr('u1', 7, sp(D1, '23:59', '59')), cr('u2', 9, sp(D2, '00:00')),
    cr('u1', 999, sp('2026-11-23', '23:59', '59')), cr('u1', 999, sp('2026-11-26', '00:00')),                       // 1 segundo ANTES do início e logo DEPOIS do fim: não contam
  ]
  const r = evalHourly(d, people, credits, '2026-11-27', 600), by = (pos: number) => r.slots[pos - 1].winner
  assert.equal(by(14).userId, 'u1'); assert.equal(by(14).revenue, 100)
  assert.equal(by(15).userId, 'u2'); assert.equal(by(15).revenue, 50)
  assert.equal(by(24).userId, 'u1'); assert.equal(by(24).revenue, 7)
  assert.equal(by(25).userId, 'u2'); assert.equal(by(25).revenue, 9)
  assert.equal(r.slots.filter(s => s.winner).length, 4); assert.ok(r.allClosed)
})
await t('as mesmas vendas em UTC puro caem na MESMA rodada (UTC 17:00Z = 14:00 SP)', () => {
  const d = mk(), r = evalHourly(d, people, [{ userId: 'u1', value: 10, at: '2026-11-24T17:00:00.000Z' }, { userId: 'u2', value: 20, at: '2026-11-24T16:59:59.999Z' }], D1, 0)
  assert.equal(r.slots[13].winner.userId, 'u2'); assert.equal(r.slots[14].winner.userId, 'u1')
})
await t('FECHAMENTO: rodada só fecha 5 min DEPOIS do fim (vendas atrasadas entram); rodada atual marcada', () => {
  const d = mk(), c = [cr('u1', 10, sp(D1, '13:30'))]
  const at = (m: number) => evalHourly(d, people, c, D1, m).slots
  assert.equal(at(14 * 60 + 4)[13].closed, false); assert.equal(at(14 * 60 + 4)[14].current, true)
  assert.equal(at(14 * 60 + 5)[13].closed, true); assert.equal(at(14 * 60 + 5)[13].winner.userId, 'u1')
  assert.equal(SLOT_GRACE_MIN, 5)
})
await t('VIRADA DE DIA: a rodada 23h–24h só fecha às 00:05 do dia seguinte (não às 00:00 nem esquecida)', () => {
  const d = mk()
  assert.equal(evalHourly(d, people, [], D2, 4).slots[23].closed, false)
  assert.equal(evalHourly(d, people, [], D2, 5).slots[23].closed, true)
  assert.equal(evalHourly(d, people, [], D2, 5).slots[24].closed, false)                 // a 00h–01h do dia 25 ainda está aberta
  assert.equal(evalHourly(d, people, [], '2026-11-26', 4).allClosed, false); assert.equal(evalHourly(d, people, [], '2026-11-26', 5).allClosed, true)
})
await t('desempate: mesma receita → mais vendas → quem chegou primeiro; métrica "mais vendas"', () => {
  const d = mk(), A = sp(D1, '10:10'), B = sp(D1, '10:20'), C = sp(D1, '10:30')
  let r = evalHourly(d, people, [cr('u1', 50, A), cr('u1', 50, B), cr('u2', 100, C)], D1, 1200); assert.equal(r.slots[10].winner.userId, 'u1')     // empate em R$ 100: u1 tem 2 vendas
  r = evalHourly(d, people, [cr('u1', 100, B), cr('u2', 100, A)], D1, 1200); assert.equal(r.slots[10].winner.userId, 'u2')                          // tudo igual: u2 chegou primeiro
  r = evalHourly(d, people, [cr('u1', 100, A), cr('u2', 100, A)], D1, 1200); assert.equal(r.slots[10].winner.userId, 'u1')                          // empate total: id (estável)
  const dc = mk({ hourly: { mode: 'full', split: 'hour', metric: 'count', ranges: [] } })
  r = evalHourly(dc, people, [cr('u1', 10, A), cr('u1', 10, B), cr('u1', 10, C), cr('u2', 500, A)], D1, 1200); assert.equal(r.slots[10].winner.userId, 'u1'); assert.equal(r.slots[10].winner.metric, 3)
  assert.equal(evalHourly(d, people, [cr('u1', 10, A), cr('u1', 10, B), cr('u1', 10, C), cr('u2', 500, A)], D1, 1200).slots[10].winner.userId, 'u2')   // por valor: Bia
})
await t('sem venda na rodada = sem ganhador; venda de quem não é do time é ignorada; valor 0 não ganha', () => {
  const d = mk(), r = evalHourly(d, people, [cr('zz', 999, sp(D1, '09:10')), cr('u1', 0, sp(D1, '11:10'))], D1, 1200)
  assert.equal(r.slots[9].winner, null); assert.equal(r.slots[11].winner, null)
})
await t('INTERVALOS: venda fora do intervalo não conta; dentro conta (por hora e por intervalo)', () => {
  const hr = mk({ hourly: { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 540, to: 720 }, { from: 840, to: 960 }] } })       // 9–12 e 14–16
  const c = [cr('u1', 10, sp(D1, '08:59', '59')), cr('u1', 20, sp(D1, '11:59', '59')), cr('u2', 30, sp(D1, '12:00')), cr('u2', 40, sp(D1, '13:30')), cr('u2', 50, sp(D1, '15:00'))]
  let r = evalHourly(hr, people, c, '2026-11-27', 0)
  assert.equal(r.slots.length, 10); assert.deepEqual(r.slots.filter(s => s.winner).map(s => [s.day, slotLabel(hr, s.pos), s.winner.userId]), [[D1, '24/11 · 11h–12h', 'u1'], [D1, '24/11 · 15h–16h', 'u2']])
  const wh = mk({ hourly: { mode: 'ranges', split: 'whole', metric: 'revenue', ranges: [{ from: 540, to: 720 }, { from: 840, to: 960 }] } })
  r = evalHourly(wh, people, [cr('u1', 10, sp(D1, '09:00')), cr('u2', 25, sp(D1, '11:59')), cr('u1', 5, sp(D1, '14:00'))], '2026-11-27', 0)
  assert.equal(r.slots.length, 4); assert.equal(r.slots[0].winner.userId, 'u2'); assert.equal(r.slots[0].winner.revenue, 25); assert.equal(r.slots[1].winner.userId, 'u1')
})
await t('rodada por intervalo que não é 1h (ex.: 09:30–11:15) funciona; meia-noite 24h é aceita como fim', () => {
  const d = mk({ hourly: { mode: 'ranges', split: 'whole', metric: 'revenue', ranges: [{ from: 570, to: 675 }, { from: 1380, to: 1440 }] } })
  const r = evalHourly(d, people, [cr('u1', 10, sp(D1, '09:29', '59')), cr('u2', 11, sp(D1, '09:30')), cr('u1', 12, sp(D1, '11:14', '59')), cr('u1', 13, sp(D1, '11:15')), cr('u2', 14, sp(D1, '23:59', '59'))], D2, 1200)
  assert.equal(r.slots[0].winner.userId, 'u1'); assert.equal(r.slots[0].winner.revenue, 12 + 0); assert.equal(r.slots[1].winner.userId, 'u2')
  assert.equal(r.slots[0].winner.name, 'Ana'); assert.equal(r.slots[0].winner.count, 1)
})

// ═══ 4) integração com o motor (filtros, atribuição, ganhadores) ═══
const P = [{ userId: 'u1', name: 'Ana', team: 'OAO', hubspotId: 'h1' }, { userId: 'u2', name: 'Bia', team: 'OAO', hubspotId: 'h2' }, { userId: 'u3', name: 'Caio', team: 'R1', hubspotId: 'h3' }]
const sale = (id: string, hub: string, value: number, at: string, extra: any = {}) => ({ id, event_type: 'sale', vertical: 'anestreview', value, occurred_at: iso(at), closer_id: null, closer_hubspot_id: hub, closer_name: null, co_closer_id: null, co_closer_hubspot_id: null, is_self_checkout: false, is_recurring: false, installment_number: 1, sale_type: null, ...extra })
await t('evaluate: ganha a rodada por time; recorrência/vertical respeitadas; só rodadas FECHADAS viram ganhador', () => {
  const rows = [sale('a', 'h1', 100, sp(D1, '13:10')), sale('b', 'h2', 300, sp(D1, '13:20')), sale('c', 'h3', 40, sp(D1, '13:30')), sale('d', 'h1', 999, sp(D1, '13:40'), { is_recurring: true, installment_number: 3 }), sale('e', 'h2', 777, sp(D1, '13:50'), { vertical: 'oftreview' })]
  const cs = attributeSales(rows, P, [])
  let ev = evaluate(mk(), P, cs, D1, 14 * 60 + 2)                                       // 14:02 — a 13–14 ainda está na tolerância
  assert.deepEqual(ev.teams.map(x => x.winners.length), [0, 0]); assert.equal(ev.final, false)
  ev = evaluate(mk(), P, cs, D1, 14 * 60 + 5)
  const oao = ev.teams.find(x => x.team === 'OAO'), r1 = ev.teams.find(x => x.team === 'R1')
  assert.equal(oao.winners.length, 1); assert.equal(oao.winners[0].name, 'Bia'); assert.equal(oao.winners[0].slot, 14); assert.equal(oao.winners[0].metric, 300 + 777)   // a de oftreview conta (sem filtro de vertical) → R$ 1.077
  assert.equal(r1.winners[0].name, 'Caio'); assert.equal(oao.standings[0].metric, 1)                    // ranking = horas ganhas
  ev = evaluate(mk({ verticals: ['anestreview'] }), P, cs, D1, 14 * 60 + 5); assert.equal(ev.teams.find(x => x.team === 'OAO').winners[0].metric, 300)
  ev = evaluate(mk({ count_recurring: true }), P, cs, D1, 14 * 60 + 5); assert.equal(ev.teams.find(x => x.team === 'OAO').winners[0].name, 'Ana')   // R$ 100 + 999 recorrente
})

// ═══ 5) validação, assinatura, prêmios, textos ═══
await t('validação: dia completo ok; intervalos inválidos/sobrepostos/sem hora fechada; limite de 31 dias; prêmio por horário', () => {
  assert.deepEqual(validateDraft(mk(), true), [])
  assert.ok(validateDraft(mk({ hourly: null }), true).some(e => /horário da campanha/.test(e)))
  const r = (ranges: any, split = 'hour') => validateDraft(mk({ hourly: { mode: 'ranges', split, metric: 'revenue', ranges } }), true)
  assert.ok(r([]).some(e => /pelo menos um intervalo/.test(e)))
  assert.ok(r([{ from: 600, to: 600 }]).some(e => /fim precisa ser depois/.test(e))); assert.ok(r([{ from: 700, to: 600 }]).some(e => /fim precisa ser depois/.test(e)))
  assert.ok(r([{ from: 540, to: 1500 }]).some(e => /fim precisa/.test(e))); assert.ok(r([{ from: -1, to: 60 }]).some(e => /fim precisa/.test(e)))
  assert.ok(r([{ from: 540, to: 630 }]).some(e => /horas fechadas/.test(e))); assert.deepEqual(r([{ from: 540, to: 630 }], 'whole'), [])
  assert.ok(r([{ from: 540, to: 660 }, { from: 600, to: 720 }]).some(e => /sobrepõem/.test(e))); assert.deepEqual(r([{ from: 540, to: 600 }, { from: 600, to: 660 }]), [])      // encostar não é sobrepor
  assert.ok(validateDraft(mk({ ends_on: '2026-12-25' }), true).some(e => /no máximo 31 dias/.test(e))); assert.deepEqual(validateDraft(mk({ ends_on: '2026-12-24' }), true), [])   // 31 dias ok
  const tp = (prizes: any) => validateDraft(mk({ prize_mode: 'tiered', prize: '', prizes }), true)
  assert.ok(tp({}).some(e => /prêmio de cada horário/.test(e))); assert.ok(tp({ OAO: Array(24).fill('x'), R1: Array(24).fill('x') }).length === 0)
  assert.ok(tp({ OAO: Array(23).fill('x'), R1: Array(24).fill('x') }).some(e => /faltam: 23h–24h/.test(e)))
  assert.ok(validateDraft(mk({ prize: '' }), true).some(e => /prêmio/i.test(e)))
  assert.deepEqual(validateDraft(mk({ hourly: null, prize: '', name: 'x' }), false), [])             // rascunho aceita incompleto
})
await t('prêmios: único = mesmo sempre; por horário = o do horário, em TODOS os dias (nº da rodada → horário)', () => {
  const d = mk({ prize_mode: 'tiered', prize: '', prizes: { OAO: Array.from({ length: 24 }, (_, i) => `P${i}`), R1: Array.from({ length: 24 }, (_, i) => `R${i}`) } })
  assert.equal(prizeFor(d, 'OAO', 1), 'P0'); assert.equal(prizeFor(d, 'OAO', 24), 'P23'); assert.equal(prizeFor(d, 'OAO', 25), 'P0'); assert.equal(prizeFor(d, 'R1', 38), 'R13')
  assert.equal(prizeFor(mk(), 'R1', 30), 'Vale 50')
  const so = mk({ prize_mode: 'tiered', prize: '', prizes: { OAO: ['a', 'b'] }, hourly: { mode: 'ranges', split: 'whole', metric: 'revenue', ranges: [{ from: 540, to: 600 }, { from: 700, to: 800 }] } })
  assert.equal(prizeFor(so, 'R1', 2), 'b')      // time sem lista própria usa a do outro (a tela grava a mesma nos dois)
  assert.equal(cleanPrizes(mk({ prize_mode: 'tiered', prizes: { OAO: Array(30).fill(' z ') } })).OAO.length, 24)
})
await t('assinatura da regra: muda ao mexer no horário/métrica; as outras campanhas mantêm a assinatura de antes', () => {
  const a = ruleSignature(mk()), b = ruleSignature(mk({ hourly: { mode: 'full', split: 'hour', metric: 'count', ranges: [] } }))
  assert.notEqual(a, b)
  assert.notEqual(a, ruleSignature(mk({ hourly: { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 0, to: 60 }] } })))
  assert.equal(a, ruleSignature(mk({ prize: 'outro prêmio', name: 'outro nome' })))                  // texto/prêmio não refaz ganhadores
  assert.equal(a, ruleSignature(mk({ hourly: { mode: 'full', split: 'whole', metric: 'revenue', ranges: [{ from: 5, to: 9 }] } })))       // "full" ignora lixo de intervalos
  const old = emptyDraft(D1); assert.ok(!ruleSignature(old).includes('por-hora'))
})
await t('textos: como ganhar (dia completo / intervalos / por intervalo)', () => {
  console.log('      ·', howToWin(mk()))
  assert.match(howToWin(mk()), /^De 24\/11 a 25\/11, em cada hora do dia \(24h\), quem vender mais \(maior receita\) em cada time ganha o prêmio\.$/)
  const h = howToWin(mk({ ends_on: D1, hourly: { mode: 'ranges', split: 'hour', metric: 'count', ranges: [{ from: 540, to: 720 }, { from: 840, to: 1080 }] } }))
  console.log('      ·', h); assert.match(h, /^No dia 24\/11, em cada hora das 09h às 12h e das 14h às 18h, quem fechar mais vendas em cada time ganha o prêmio\.$/)
  const w = howToWin(mk({ ends_on: D1, hourly: { mode: 'ranges', split: 'whole', metric: 'revenue', ranges: [{ from: 540, to: 720 }] } }))
  console.log('      ·', w); assert.match(w, /em cada intervalo \(09h–12h\)/)
})
await t('cleanHourly: nunca confia no que chega (lixo vira valor seguro; passa de 24 intervalos é cortado)', () => {
  assert.equal(cleanHourly(null), null); assert.equal(cleanHourly('x'), null)
  const c = cleanHourly({ mode: 'xx', split: 'yy', metric: 'zz', ranges: [{ from: '540', to: 'abc' }, null, { from: 99999, to: -5 }, ...Array(40).fill({ from: 0, to: 60 })] })
  assert.deepEqual([c.mode, c.split, c.metric], ['full', 'hour', 'revenue']); assert.equal(c.ranges.length, 24); assert.deepEqual(c.ranges[0], { from: 540, to: -1 }); assert.deepEqual(c.ranges[2], { from: 1440, to: -1 })
})
await t('parseDraft / draftToDb / rowToDraft: o horário vai e volta; campanha comum NÃO grava a coluna nova (funciona antes do SQL)', () => {
  const d = parseDraft({ ...mk(), hourly: { mode: 'ranges', split: 'whole', metric: 'count', ranges: [{ from: 540, to: 720 }] } })
  assert.deepEqual(d.hourly, { mode: 'ranges', split: 'whole', metric: 'count', ranges: [{ from: 540, to: 720 }] })
  assert.equal(parseDraft({ ...mk(), criterion: 'revenue_rank' }).hourly, null)
  assert.deepEqual(draftToDb(d).hourly, d.hourly); assert.equal(draftToDb(d).criterion, 'hourly')
  assert.equal('hourly' in draftToDb(emptyDraft(D1)), false); assert.equal(draftToDb(emptyDraft(D1), { hourly: true }).hourly, null)      // mudou de por-hora p/ outro: limpa
  assert.deepEqual(rowToDraft({ ...draftToDb(d), id: 'x' }).hourly, d.hourly); assert.equal(rowToDraft({ ...draftToDb(emptyDraft(D1)) }).hourly, null)
})

// ═══ 6) servidor ponta a ponta (banco de mentira) ═══
const profiles = [
  { id: 'u1', name: 'Ana Souza', role: 'consultor', team: 'OAO', hubspot_id: 'h1', is_active: true },
  { id: 'u2', name: 'Bia Lima', role: 'consultor', team: 'OAO', hubspot_id: 'h2', is_active: true },
  { id: 'u3', name: 'Caio Reis', role: 'consultor', team: 'R1', hubspot_id: 'h3', is_active: true },
  { id: 'adm', name: 'Admin', role: 'superadmin', team: null, hubspot_id: null, is_active: true },
]
const salesDb = [
  sale('s1', 'h1', 100, sp(D1, '13:30')), sale('s2', 'h2', 200, sp(D1, '13:45')), sale('s3', 'h3', 50, sp(D1, '14:10')), sale('s4', 'h1', 80, sp(D1, '14:20')), sale('s5', 'h1', 10, sp(D1, '23:59', '59')),
]
const row = (over: any = {}) => ({ id: 'c1', ...draftToDb(mk()), status: 'draft', created_by: 'adm', created_at: '2026-11-01T00:00:00Z', launched_at: null, finalized_at: null, notify: true, notify_result: true, ...over })
const mkDb = (campOver: any = {}, sales: any[] = salesDb) => fakeAdmin({ profiles, closers: [], telao_events: sales, campaigns: [row(campOver)], notifications: [], notification_recipients: [], campaign_event_log: [], campaign_winners: [] })
const keys = (a: any) => (a.db.notifications as any[]).map(x => x.event_key).sort()
const wins = (a: any) => (a.db.campaign_winners as any[]).map(w => `${w.team}:${w.position}:${w.user_id}`).sort()

await t('SERVIDOR: publica antes; durante o dia só as rodadas fechadas viram ganhador (com prêmio) e avisam o ganhador', async () => {
  const a = mkDb(), at = new Date(iso(sp(D1, '15:10')))
  assert.equal((await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))).ok, true)
  await runCampaignTick(a as any, { now: at })
  assert.deepEqual(wins(a), ['OAO:14:u2', 'OAO:15:u1', 'R1:15:u3'])
  assert.ok((a.db.campaign_winners as any[]).every(w => w.prize === 'Vale 50'))
  assert.deepEqual(keys(a).filter(k => k.startsWith('slot:')), ['slot:personal:OAO:14', 'slot:personal:OAO:15', 'slot:personal:R1:15'])
  const nt = (a.db.notifications as any[]).find(x => x.event_key === 'slot:personal:OAO:14'); console.log('      ·', nt.title, '|', nt.body)
  assert.match(nt.title, /das 13h às 14h: Vale 50/); assert.match(nt.body, /24\/11, das 13h às 14h \(R\$/)
  assert.ok(!(a.db.campaigns as any[])[0].finalized_at)
  const before = JSON.stringify([a.db.campaign_winners, a.db.notifications, a.db.campaign_event_log])
  await runCampaignTick(a as any, { now: at }); await runCampaignTick(a as any, { now: at })      // idempotente
  assert.equal(JSON.stringify([a.db.campaign_winners, a.db.notifications, a.db.campaign_event_log]), before)
})
await t('SERVIDOR: antes do fim da tolerância não registra; fecha a campanha só quando a ÚLTIMA rodada fecha (00:05 do dia seguinte ao fim)', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))
  await runCampaignTick(a as any, { now: new Date(iso(sp(D1, '14:03'))) }); assert.equal(wins(a).length, 0)                  // 13–14 ainda na tolerância
  await runCampaignTick(a as any, { now: new Date(iso(sp(D1, '14:05'))) }); assert.deepEqual(wins(a), ['OAO:14:u2'])
  await runCampaignTick(a as any, { now: new Date(iso(sp(D2, '23:30'))) }); assert.ok(!(a.db.campaigns as any[])[0].finalized_at)
  await runCampaignTick(a as any, { now: new Date(iso(sp('2026-11-26', '00:04'))) }); assert.ok(!(a.db.campaigns as any[])[0].finalized_at)       // 23h–24h do dia 25 ainda na tolerância
  await runCampaignTick(a as any, { now: new Date(iso(sp('2026-11-26', '00:05'))) })
  assert.ok((a.db.campaigns as any[])[0].finalized_at); assert.deepEqual(wins(a), ['OAO:14:u2', 'OAO:15:u1', 'OAO:24:u1', 'R1:15:u3'])        // s5 (23:59:59 do dia 24) = rodada 24
  const k = keys(a); assert.ok(k.includes('finish:everyone') && k.includes('finish:creator')); assert.ok(!k.some(x => x.startsWith('finish:personal')))
  const fe = (a.db.notifications as any[]).find(x => x.event_key === 'finish:everyone'); console.log('      ·', fe.title, '|', fe.body)
  assert.match(fe.body, /OAO: Bia \(1 prêmio\), Ana \(2 prêmios\)|OAO: Ana \(2 prêmios\), Bia \(1 prêmio\)/); assert.match(fe.body, /R1: Caio \(1 prêmio\)/)
})
await t('SERVIDOR: caixinhas — "notificar resultado" desligado: ganhadores gravados, zero aviso de rodada', async () => {
  const a = mkDb({ notify_result: false }); await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))
  await runCampaignTick(a as any, { now: new Date(iso(sp(D1, '15:10'))) })
  assert.equal(wins(a).length, 3); assert.deepEqual(keys(a).filter(k => k.startsWith('slot:')), [])
})
await t('SERVIDOR: campanha antiga publicada de uma vez — registra TODAS as rodadas (limite por apuração), sem encher o sininho de avisos antigos, e só fecha no fim', async () => {
  const many: any[] = []                                                                                    // Ana vende em TODAS as horas dos 10 primeiros dias de uma campanha de 31 dias
  for (let day = 0; day < 10; day++) for (let h = 0; h < 24; h++) many.push(sale(`m${day}-${h}`, 'h1', 10 + h, sp(`2026-10-${String(1 + day).padStart(2, '0')}`, `${String(h).padStart(2, '0')}:30`)))
  const a = mkDb({ starts_on: '2026-10-01', ends_on: '2026-10-31' }, many)
  await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))                                    // tudo no passado (publicar já apura 1 vez)
  const w1 = wins(a).length; assert.equal(w1, 200); assert.ok(!(a.db.campaigns as any[])[0].finalized_at)       // 1ª apuração: 200 (o limite); NÃO fecha com rodada pendente
  await runCampaignTick(a as any, { now: new Date('2026-11-23T12:05:00Z') })
  assert.equal(wins(a).length, 240); assert.ok((a.db.campaigns as any[])[0].finalized_at)
  assert.deepEqual(keys(a).filter(k => k.startsWith('slot:')), [])                                          // todas antigas: sem aviso pessoal de rodada
  assert.ok(keys(a).includes('finish:everyone'))
})
await t('SERVIDOR: editar a REGRA (horário) refaz tudo do zero com a numeração nova; editar só o prêmio mantém ganhadores e atualiza o texto', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))
  const now = new Date(iso(sp(D1, '15:10'))); await runCampaignTick(a as any, { now })
  assert.deepEqual(wins(a), ['OAO:14:u2', 'OAO:15:u1', 'R1:15:u3'])
  const draft = (over: any) => ({ ...rowToDraft((a.db.campaigns as any[])[0]), ...over })
  let r = await hPatchCampaign(a as any, 'c1', { draft: draft({ prize: 'Vale 100' }) }, now); assert.equal(r.status, 200); assert.equal(r.json.ruleChanged, false)
  assert.deepEqual(wins(a), ['OAO:14:u2', 'OAO:15:u1', 'R1:15:u3']); assert.ok((a.db.campaign_winners as any[]).every(w => w.prize === 'Vale 100'))
  assert.match((a.db.notifications as any[]).find(x => x.event_key === 'slot:personal:OAO:14').title, /Vale 100/)               // o aviso já enviado acompanha
  r = await hPatchCampaign(a as any, 'c1', { draft: draft({ hourly: { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 840, to: 900 }] } }) }, now)     // só 14h–15h
  assert.equal(r.status, 200); assert.equal(r.json.ruleChanged, true)
  assert.deepEqual(wins(a), ['OAO:1:u1', 'R1:1:u3']); assert.deepEqual(keys(a).filter(k => k.startsWith('slot:')), ['slot:personal:OAO:1', 'slot:personal:R1:1'])      // rodada 1 = 14h–15h do dia 24
})
await t('SERVIDOR: editar com horário inválido é barrado; antes do SQL (coluna/trava ausente) a mensagem manda rodar a migração', async () => {
  const a = mkDb(); const r = await hPatchCampaign(a as any, 'c1', { draft: { ...rowToDraft((a.db.campaigns as any[])[0]), hourly: { mode: 'ranges', split: 'hour', metric: 'revenue', ranges: [{ from: 600, to: 540 }] } } }, new Date())
  assert.equal(r.status, 400); assert.match(r.json.error, /fim precisa ser depois/)
  const broken = { ...a, from: (nm: string) => { const q = a.from(nm); if (nm !== 'campaigns') return q; q.insert = () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'new row for relation "campaigns" violates check constraint "campaigns_criterion_check"' } }) }) }); return q } }
  const { hCreateCampaign } = await import('../../lib/campaigns/handlers')
  const c = await hCreateCampaign(broken as any, 'adm', { draft: mk() }, new Date()); assert.equal(c.status, 500); assert.match(c.json.error, /migration-campanha-por-hora\.sql/)
})
await t('POPUP dos vencedores: rodadas de hoje + as já ganhas; só nome e prêmio; cada um vê só o seu time', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))
  const now = new Date(iso(sp(D1, '15:10'))); await runCampaignTick(a as any, { now })
  const v = await hCampaignWinnersView(a as any, 'u1', 'c1', now); assert.equal(v.status, 200)
  assert.deepEqual(v.json.teams.map((x: any) => x.team), ['OAO']); const pos = v.json.teams[0].positions
  assert.equal(pos.length, 24); assert.equal(pos[0].label, '24/11 · 00h–01h'); assert.equal(pos[0].state, 'empty')
  const p14 = pos.find((p: any) => p.position === 14), p15 = pos.find((p: any) => p.position === 15), p20 = pos.find((p: any) => p.position === 20)
  assert.deepEqual([p14.winner.name, p14.winner.me, p14.state, p14.prize], ['Bia Lima', false, 'winner', 'Vale 50']); assert.equal(p15.winner.me, true); assert.equal(p20.state, 'pending')
  assert.ok(!JSON.stringify(v.json).includes('metric')); assert.ok(!/\b200\b|\b300\b/.test(JSON.stringify(v.json)))                         // nunca mostra valores de venda
  const adm = await hCampaignWinnersView(a as any, 'adm', 'c1', now); assert.deepEqual(adm.json.teams.map((x: any) => x.team), ['OAO', 'R1'])
  assert.equal(v.json.campaign.prize_mode, 'single')
})
await t('API: detalhe traz as rodadas; prévia traz a rodada de AGORA e quem lidera; duplicar mantém o horário', async () => {
  const a = mkDb(); await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z'))
  const now = new Date(iso(sp(D1, '14:30')))
  const g = await hGetCampaign(a as any, 'c1', now); assert.equal(g.json.evaluation.teams[0].slots.length, 48)
  const p = await hPreview(a as any, { draft: { ...rowToDraft((a.db.campaigns as any[])[0]) } }, now)
  const oao = p.json.teams.find((x: any) => x.team === 'OAO'); assert.equal(oao.hourly.current.label, '24/11 · 14h–15h'); assert.equal(oao.hourly.current.leader, 'Ana Souza'); assert.equal(oao.hourly.total, 48)
  const dup = await hCampaignAction(a as any, 'c1', 'adm', { action: 'duplicate', shiftDays: 7 }, now); assert.equal(dup.status, 200)
  const copy = (a.db.campaigns as any[]).find(c => c.id === dup.json.id); assert.deepEqual(copy.hourly, mk().hourly); assert.equal(copy.criterion, 'hourly'); assert.equal(copy.starts_on, '2026-12-01')
})
await t('FUSO: venda às 23:59 de SP (02:59Z do dia seguinte em UTC) conta no dia/rodada de SP — e a de 00:00 SP no dia seguinte', async () => {
  const a = mkDb({ starts_on: D1, ends_on: D1 }, [sale('x1', 'h1', 5, '2026-11-25T02:59:59.000Z'), sale('x2', 'h2', 6, '2026-11-25T03:00:00.000Z')])
  await publishCampaign(a as any, 'c1', new Date('2026-11-23T12:00:00Z')); await runCampaignTick(a as any, { now: new Date('2026-11-25T03:10:00Z') })
  assert.deepEqual(wins(a), ['OAO:24:u1']); assert.ok((a.db.campaigns as any[])[0].finalized_at)           // x2 é do dia 25 (fora da campanha de 1 dia)
})
console.log(`\n${n} testes por hora passaram`)
