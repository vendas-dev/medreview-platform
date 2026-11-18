import { fmtBRL, normalizeName } from '@/lib/telao/format'
import { MAX_OFFER_CODES, MAX_PRODUCT_IDS, isValidOfferCode, offerKey, offersLabel, saleMatchesFilter } from '@/lib/telao/offer'
import { finishMessagesTiers, howToWinTiers, tierStanding, tierTargetsKey, tiersText, TierStanding, validateTiers } from './tiers'
import { CampaignDraft, Criterion, CRITERIA, criterionInfo, Phase, Team, TEAMS, TeamRule } from './types'

// ══ Motor de apuração das campanhas (funções puras: sem tela, sem banco) ══════
//
//  QUEM CONTA     : pessoas do time (profiles.team) que não são superadmin.
//  QUAL VENDA     : event_type 'sale' atribuída à pessoa — MESMA regra do Telão
//                   (closer_id; venda de embaixador vai pro closer associado; o co-closer
//                   de uma venda transferida RECEBE O CRÉDITO TAMBÉM).
//  QUE NÃO CONTA  : self-checkout (ninguém atribuído) e, por padrão, parcela de recorrência.
//  DIAS           : horário de São Paulo; início e fim INCLUSIVOS.
//  DESEMPATE      : sempre pra quem chegou ao resultado primeiro (horário da venda).

// ── datas (São Paulo) ─────────────────────────────────────────────────────────
const SP_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export const spDay = (iso: string): string => SP_FMT.format(new Date(iso))
export const todaySP = (d: Date = new Date()): string => spDay(d.toISOString())
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
export const addDays = (day: string, n: number): string => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const diffDays = (a: string, b: string): number => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
export const fmtDM = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`
export const fmtDMY = (day: string): string => `${fmtDM(day)}/${day.slice(0, 4)}`
export const weekdayOf = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay()

export const durationDays = (d: Pick<CampaignDraft, 'starts_on' | 'ends_on'>): number =>
  DAY_RE.test(d.starts_on) && DAY_RE.test(d.ends_on) && d.ends_on >= d.starts_on ? diffDays(d.starts_on, d.ends_on) + 1 : 0
export function phaseOf(d: Pick<CampaignDraft, 'starts_on' | 'ends_on'>, today: string): Phase {
  return today < d.starts_on ? 'scheduled' : today > d.ends_on ? 'ended' : 'active'
}

/**
 * "A regra" da campanha: o que, se mudar, muda QUEM ganha. Nome, descrição, prêmio, ícone e cor ficam de fora
 * (mexer neles só reescreve os textos dos avisos). Usado pra decidir se uma edição refaz os ganhadores.
 */
export function ruleSignature(d: Pick<CampaignDraft, 'criterion' | 'teams' | 'starts_on' | 'ends_on' | 'count_recurring' | 'verticals' | 'offer_codes' | 'product_ids' | 'filter_logic'>): string {
  const teams = TEAMS.filter(t => d.teams[t]).map(t => [t, d.teams[t]!.winners, d.teams[t]!.target ?? null, ...(d.criterion === 'tier_revenue' ? [tierTargetsKey(d.teams[t]!.tiers)] : [])])
  const pc = d.product_ids && d.product_ids.length ? [...new Set(d.product_ids.map(offerKey))].sort() : null
  const oc = d.offer_codes && d.offer_codes.length ? [...new Set(d.offer_codes.map(offerKey))].sort() : null      // só entra na assinatura quando há filtro: campanha antiga mantém a assinatura de antes
  return JSON.stringify([d.criterion, teams, d.starts_on, d.ends_on, d.count_recurring === true, d.verticals && d.verticals.length ? [...d.verticals].sort() : null, ...(oc ? [oc] : []), ...(pc ? [['produtos', pc]] : []), ...(oc && pc ? [['condicao', d.filter_logic === 'or' ? 'or' : 'and']] : [])])
}

// ── validação (a tela e a API usam a MESMA) ────────────────────────────────────
/** strict=false (rascunho): só exige nome e datas válidas — prêmio, times e alvos podem ficar pra depois. */
export function validateDraft(d: CampaignDraft, strict = true): string[] {
  const e: string[] = []
  if (!d.name.trim()) e.push('Dê um nome para a campanha.')
  else if (d.name.trim().length > 60) e.push('O nome pode ter até 60 caracteres.')
  if (d.subtitle.length > 140) e.push('A descrição curta pode ter até 140 caracteres.')
  const tiered = d.prize_mode === 'tiered'
  const tierCrit = d.criterion === 'tier_revenue'
  if (!tiered && !tierCrit) {
    if (strict && !d.prize.trim()) e.push('Informe o prêmio.')
    else if (d.prize.trim().length > 120) e.push('O prêmio pode ter até 120 caracteres.')
  }
  if (!CRITERIA.some(c => c.id === d.criterion)) e.push('Escolha o critério da campanha.')
  const oc = d.offer_codes
  if (Array.isArray(oc)) {                                                           // filtro por oferta LIGADO
    if (oc.length === 0) { if (strict) e.push('Informe pelo menos um código de oferta (ou desligue o filtro por oferta).') }
    else {
      const bad = oc.filter(c => !isValidOfferCode(c))
      if (bad.length) e.push(`Código de oferta inválido: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}. Use só letras, números, ponto, hífen e sublinhado.`)
      if (new Set(oc.map(offerKey)).size > MAX_OFFER_CODES) e.push(`Informe no máximo ${MAX_OFFER_CODES} códigos de oferta.`)
    }
  }
  const pi = d.product_ids
  if (Array.isArray(pi)) {                                                           // filtro por produto LIGADO
    if (pi.length === 0) { if (strict) e.push('Informe pelo menos um ID de produto (ou desligue o filtro por produto).') }
    else {
      const bad = pi.filter(c => !isValidOfferCode(c))
      if (bad.length) e.push(`ID de produto inválido: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}. Use só letras, números, ponto, hífen e sublinhado.`)
      if (new Set(pi.map(offerKey)).size > MAX_PRODUCT_IDS) e.push(`Informe no máximo ${MAX_PRODUCT_IDS} IDs de produto.`)
    }
  }
  if (strict && Array.isArray(oc) && oc.length > 0 && Array.isArray(pi) && pi.length > 0 && d.filter_logic !== 'and' && d.filter_logic !== 'or') e.push('Escolha a condição entre produto e oferta: E (precisa ser dos dois) ou OU (basta um).')
  const teams = (Object.keys(d.teams) as Team[]).filter(t => TEAMS.includes(t))
  if (strict && teams.length === 0) e.push('Escolha pelo menos um time (OAO, R1 ou ambos).')
  const info = CRITERIA.find(c => c.id === d.criterion)
  for (const t of teams) {
    const r = d.teams[t]!
    if (strict && !tierCrit && !(Number.isInteger(r.winners) && r.winners >= 1 && r.winners <= 50)) e.push(`Time ${t}: informe quantos serão premiados (1 a 50).`)
    if (strict && info?.needsTarget && !(typeof r.target === 'number' && r.target > 0)) e.push(`Time ${t}: informe ${info.unit === 'money' ? 'o valor (R$)' : 'o número de vendas'} a bater.`)
  }
  if (tiered && !tierCrit) for (const t of teams) {                                 // premiação diferenciada: cada posição precisa do seu prêmio
    const n = Number.isInteger(d.teams[t]!.winners) ? d.teams[t]!.winners : 0, list = d.prizes?.[t] ?? [], missing: number[] = []
    for (let i = 0; i < Math.min(n, 50); i++) { const v = (list[i] ?? '').trim(); if (!v) missing.push(i + 1); else if (v.length > 120) e.push(`Time ${t}: o prêmio do ${i + 1}º lugar pode ter até 120 caracteres.`) }
    if (strict && missing.length) e.push(`Time ${t}: ${missingText(missing, n)}.`)
  }
  if (tierCrit) e.push(...validateTiers(d, teams, strict))
  if (!DAY_RE.test(d.starts_on) || !DAY_RE.test(d.ends_on)) e.push('Informe a data de início e a de fim.')
  else if (d.ends_on < d.starts_on) e.push('A data final não pode ser antes da inicial.')
  else if (durationDays(d) > 92) e.push('A campanha pode durar no máximo 92 dias.')
  return e
}

// ── prêmios ─────────────────────────────────────────────────────────────────
const ords = (ns: number[]): string => { const o = ns.map(n => `${n}º`); return o.length <= 1 ? (o[0] ?? '') : `${o.slice(0, -1).join(', ')} e ${o[o.length - 1]}` }
function missingText(missing: number[], total: number): string {
  if (total > 1 && missing.length === total) return `informe os prêmios de cada posição (1º ao ${total}º lugar)`
  return missing.length === 1 ? `informe o prêmio do ${missing[0]}º lugar` : `informe os prêmios do ${ords(missing)} lugar`
}
/** O prêmio de UMA posição de UM time ('' se não há). Na premiação única é o mesmo pra todos. */
export const prizeFor = (d: Pick<CampaignDraft, 'prize' | 'prize_mode' | 'prizes'>, team: Team, position: number): string =>
  d.prize_mode === 'tiered' ? (d.prizes?.[team]?.[position - 1] ?? '').trim() : d.prize.trim()
/** Uma linha só com os prêmios: "1º iPhone, 2º Fone, 3º Vale" (se os dois times têm os mesmos, não repete por time). */
export function prizesText(d: CampaignDraft): string {
  const teams = nTeams(d), lists = teams.map(t => Array.from({ length: Math.max(d.teams[t]!.winners, 0) }, (_, i) => `${i + 1}º ${prizeFor(d, t, i + 1)}`).join(', '))
  return lists.length > 1 && lists.every(l => l === lists[0]) ? lists[0] : teams.map((t, i) => (teams.length > 1 ? `${t}: ${lists[i]}` : lists[i])).join(' · ')
}
/** O que aparece no card/lista: o prêmio (único) ou "Premiação por posição". */
export const prizeHeadline = (d: Pick<CampaignDraft, 'prize' | 'prize_mode' | 'prizes' | 'teams' | 'criterion'>): string => d.criterion === 'tier_revenue' ? 'Premiação por faixa de valor' : d.prize_mode === 'tiered' ? 'Premiação por posição' : d.prize.trim()
const prizeLine = (d: CampaignDraft): string => (d.criterion === 'tier_revenue' ? `Prêmios por faixa: ${tiersText(d)}.` : d.prize_mode === 'tiered' ? `Prêmios: ${prizesText(d)}.` : `Prêmio: ${d.prize.trim()}.`)

// ── textos ──────────────────────────────────────────────────────────────────
const nTeams = (d: CampaignDraft): Team[] => TEAMS.filter(t => d.teams[t])
const unitText = (c: Criterion, v: number) => (criterionInfo(c).unit === 'money' ? fmtBRL(v) : `${v} ${v === 1 ? 'venda' : 'vendas'}`)

/** "Top 3 do time OAO e Top 4 do time R1" */
export function winnersText(d: CampaignDraft): string {
  if (d.criterion === 'tier_revenue') return `Todos que atingirem uma faixa (${nTeams(d).length > 1 ? 'times' : 'time'} ${nTeams(d).join(' e ')})`
  const parts = nTeams(d).map(t => `${d.teams[t]!.winners === 1 ? '1º lugar' : `Top ${d.teams[t]!.winners}`} do time ${t}`)
  return parts.length <= 1 ? (parts[0] ?? '') : parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1]
}
export const periodText = (d: Pick<CampaignDraft, 'starts_on' | 'ends_on'>): string =>
  d.starts_on === d.ends_on ? `no dia ${fmtDM(d.starts_on)}` : `de ${fmtDM(d.starts_on)} a ${fmtDM(d.ends_on)}`

/** A regra em uma frase, pronta pra prévia e pra notificação. */
/** " Só contam vendas das ofertas: a, b." (vazio quando a campanha não filtra por oferta) */
export const offersText = (d: Pick<CampaignDraft, 'offer_codes' | 'product_ids' | 'filter_logic'>): string => {
  const o = d.offer_codes && d.offer_codes.length ? d.offer_codes : null, p = d.product_ids && d.product_ids.length ? d.product_ids : null
  if (!o && !p) return ''
  const po = o ? `${o.length === 1 ? 'da oferta' : 'das ofertas'}: ${offersLabel(o)}` : '', pp = p ? `${p.length === 1 ? 'do produto ID' : 'dos produtos ID'}: ${offersLabel(p)}` : ''
  return ` Só contam vendas ${o && p ? `${pp} ${d.filter_logic === 'or' ? 'ou' : 'e'} ${po}` : (pp || po)}.`
}
export function howToWin(d: CampaignDraft): string { return howToWinBase(d) + offersText(d) }
function howToWinBase(d: CampaignDraft): string {
  if (d.criterion === 'tier_revenue') return howToWinTiers(d, periodText(d))
  const who = winnersText(d), when = periodText(d), end = d.prize_mode === 'tiered' ? 'ganham prêmios' : 'ganham o prêmio'
  const targets = (): string => {
    const ts = nTeams(d).map(t => d.teams[t]!.target ?? 0)
    const same = ts.every(x => x === ts[0])
    return same ? unitText(d.criterion, ts[0]) : nTeams(d).map(t => `${unitText(d.criterion, d.teams[t]!.target ?? 0)} (${t})`).join(' / ')
  }
  switch (d.criterion) {
    case 'revenue_rank':  return `${who} com a maior receita em vendas ${when} ${end}.`
    case 'count_rank':    return `${who} com mais vendas fechadas ${when} ${end}.`
    case 'first_revenue': return `${who} a bater ${targets()} em vendas ${when} ${end}.`
    case 'first_count':   return `${who} a bater ${targets()} ${when} ${end}.`
    case 'best_day':      return `${who} com o maior pico de vendas em um único dia ${when} ${end}.`
    case 'best_sale':     return `${who} com a venda de maior valor ${when} ${end}.`
  }
}
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? s)
export const metricText = (c: Criterion, v: number): string => {
  const info = criterionInfo(c)
  return info.unit === 'money' ? fmtBRL(v) : `${v} ${v === 1 ? 'venda' : 'vendas'}`
}

// ── atribuição de vendas a pessoas ──────────────────────────────────────────────
export interface Participant { userId: string; name: string; team: Team; hubspotId: string | null }
export interface CloserRef { id: string; hubspot_id: string | null; profile_id: string | null; normalized_name: string }
export interface SaleRow {
  id: string; occurred_at: string; value: number | null; vertical: string; event_type?: string | null
  closer_id?: string | null; closer_hubspot_id?: string | null; closer_name?: string | null
  co_closer_id?: string | null; co_closer_hubspot_id?: string | null
  is_self_checkout?: boolean | null; is_recurring?: boolean | null; installment_number?: number | null; sale_type?: string | null
  offer_code?: string | null
  product_id?: string | null
}
export interface Credit { saleId: string; userId: string; at: string; value: number; vertical: string; recurring: boolean; offer?: string | null; product?: string | null }

export function attributeSales(rows: SaleRow[], participants: Participant[], closers: CloserRef[]): Credit[] {
  const byUser = new Map(participants.map(p => [p.userId, p]))
  const byHub = new Map<string, string>(), byName = new Map<string, string>(), byCloser = new Map<string, string>()
  for (const p of participants) { if (p.hubspotId) byHub.set(String(p.hubspotId).trim(), p.userId); byName.set(normalizeName(p.name), p.userId) }
  for (const c of closers) {
    const uid = c.profile_id && byUser.has(c.profile_id) ? c.profile_id : (c.hubspot_id && byHub.get(String(c.hubspot_id).trim())) || null
    if (!uid) continue
    byCloser.set(c.id, uid)
    if (c.hubspot_id) byHub.set(String(c.hubspot_id).trim(), uid)
    if (c.normalized_name) byName.set(c.normalized_name, uid)
  }
  const resolve = (closerId?: string | null, hub?: string | null, name?: string | null): string | null =>
    (closerId && (byCloser.get(closerId) ?? (byUser.has(closerId) ? closerId : null))) || (hub && byHub.get(String(hub).trim())) || (name && byName.get(normalizeName(name))) || null

  const out: Credit[] = []
  for (const r of rows) {
    if (r.event_type && r.event_type !== 'sale') continue
    if (r.value === null || r.value === undefined || !Number.isFinite(Number(r.value))) continue
    const recurring = r.is_recurring === true && (r.installment_number ?? 1) > 1 || r.sale_type === 'recorrente'
    const base = { saleId: r.id, at: r.occurred_at, value: Number(r.value), vertical: r.vertical, recurring, offer: r.offer_code ?? null, product: r.product_id ?? null }
    const main = r.is_self_checkout ? null : resolve(r.closer_id, r.closer_hubspot_id, r.closer_name)
    if (main) out.push({ ...base, userId: main })
    const co = resolve(r.co_closer_id, r.co_closer_hubspot_id, null)        // transferência: quem recebeu o crédito soma também
    if (co && co !== main) out.push({ ...base, userId: co })
  }
  return out
}

// ── apuração ──────────────────────────────────────────────────────────────────
export interface Standing {
  userId: string; name: string; team: Team; rank: number
  metric: number                      // o número do critério (R$, vendas, melhor dia, maior venda…)
  revenue: number; count: number; bestDay: number; bestSale: number
  reachedAt: string | null            // corrida: quando bateu o alvo · ranking: quando fez a última venda contada
  progress: number                    // corrida: 0..1 do caminho até o alvo
  qualified: boolean                  // corrida: já bateu o alvo
  tier?: number | null; tierTarget?: number | null; tierPrize?: string | null; nextTarget?: number | null; nextPrize?: string | null; tierHits?: (string | null)[]   // faixas de valor
}
export interface TeamEval { team: Team; rule: TeamRule; standings: Standing[]; winners: Standing[]; slotsLeft: number }
export interface Evaluation { phase: Phase; teams: TeamEval[]; raceComplete: boolean; final: boolean }

export function evaluate(d: CampaignDraft, participants: Participant[], credits: Credit[], today: string): Evaluation {
  const info = criterionInfo(d.criterion)
  const phase = phaseOf(d, today)
  const offerKeys = d.offer_codes && d.offer_codes.length ? new Set(d.offer_codes.map(offerKey)) : null
  const hasProductFilter = !!(d.product_ids && d.product_ids.length)
  const inScope = credits.filter(c => {
    const day = spDay(c.at)
    if (day < d.starts_on || day > d.ends_on) return false
    if (c.recurring && !d.count_recurring) return false
    if (d.verticals && d.verticals.length && !d.verticals.includes(c.vertical)) return false
    if (!hasProductFilter && offerKeys && !(c.offer && offerKeys.has(offerKey(c.offer)))) return false      // só ofertas: venda sem código ou de outra oferta não conta
    if (hasProductFilter && !saleMatchesFilter(d, { offer: c.offer, product: c.product })) return false      // com produto: só produto, ou produto + oferta pela condição E/OU
    return true
  })
  const byUser = new Map<string, Credit[]>()
  for (const c of inScope) (byUser.get(c.userId) ?? byUser.set(c.userId, []).get(c.userId)!).push(c)

  const teams: TeamEval[] = nTeams(d).map(team => {
    const rule = d.teams[team]!
    const rows: Standing[] = participants.filter(p => p.team === team).map(p => {
      const cs = (byUser.get(p.userId) ?? []).slice().sort((a, b) => a.at.localeCompare(b.at) || a.saleId.localeCompare(b.saleId))
      const revenue = cs.reduce((a, c) => a + c.value, 0), count = cs.length
      const perDay = new Map<string, number>(); for (const c of cs) perDay.set(spDay(c.at), (perDay.get(spDay(c.at)) ?? 0) + c.value)
      const bestDay = Math.max(0, ...perDay.values()), bestSale = Math.max(0, ...cs.map(c => c.value))
      let reachedAt: string | null = cs.length ? cs[cs.length - 1].at : null, qualified = false, progress = 0
      let metric = 0
      let tierX: TierStanding | null = null
      switch (d.criterion) {
        case 'revenue_rank': metric = revenue; break
        case 'count_rank':   metric = count; break
        case 'best_day':     metric = bestDay; break
        case 'best_sale':    metric = bestSale; break
        case 'tier_revenue': { const ti = tierStanding(rule.tiers, cs); tierX = ti; metric = revenue; qualified = ti.tier !== null; reachedAt = ti.tierHits[0] ?? (cs.length ? cs[cs.length - 1].at : null); progress = ti.progress; break }
        case 'first_revenue':
        case 'first_count': {
          const target = rule.target ?? 0
          let acc = 0, hit: string | null = null
          for (const c of cs) { acc += d.criterion === 'first_revenue' ? c.value : 1; if (hit === null && target > 0 && acc >= target) hit = c.at }
          metric = d.criterion === 'first_revenue' ? revenue : count
          qualified = hit !== null; reachedAt = hit; progress = target > 0 ? Math.min(metric / target, 1) : 0
        }
      }
      return { userId: p.userId, name: p.name, team, rank: 0, metric, revenue, count, bestDay, bestSale, reachedAt, progress, qualified, ...(tierX ? { tier: tierX.tier, tierTarget: tierX.tierTarget, tierPrize: tierX.tierPrize, nextTarget: tierX.nextTarget, nextPrize: tierX.nextPrize, tierHits: tierX.tierHits } : {}) }
    })
    const early = (a: Standing, b: Standing) => (a.reachedAt ?? '9999').localeCompare(b.reachedAt ?? '9999') || a.userId.localeCompare(b.userId)
    rows.sort((a, b) => {
      if (info.tiers) return (b.tier ?? -1) - (a.tier ?? -1) || b.metric - a.metric || early(a, b)
      if (info.race) {                                    // corrida: quem bateu o alvo vem primeiro, pela ORDEM em que bateu
        if (a.qualified !== b.qualified) return a.qualified ? -1 : 1
        if (a.qualified) return early(a, b)
        return b.metric - a.metric || early(a, b)         // quem ainda não bateu: o mais perto na frente
      }
      const second = (x: Standing) => (d.criterion === 'count_rank' ? x.revenue : x.count)
      return b.metric - a.metric || second(b) - second(a) || early(a, b)
    })
    rows.forEach((r, i) => { r.rank = i + 1 })
    const winners = info.tiers ? rows.filter(r => r.qualified) : info.race ? rows.filter(r => r.qualified).slice(0, rule.winners) : rows.filter(r => r.metric > 0).slice(0, rule.winners)
    return { team, rule, standings: rows, winners, slotsLeft: info.tiers ? 0 : Math.max(rule.winners - winners.length, 0) }
  })
  const raceComplete = info.race && teams.length > 0 && teams.every(t => t.slotsLeft === 0)
  return { phase, teams, raceComplete, final: phase === 'ended' || raceComplete }
}

// ── mensagens das notificações ───────────────────────────────────────────────────
export interface Msg { title: string; body: string }
export const launchMessage = (d: CampaignDraft): Msg => ({
  title: `${d.emoji} Nova campanha: ${d.name.trim()}`,
  body: `${howToWin(d)} ${prizeLine(d)}${d.subtitle.trim() ? ` ${d.subtitle.trim()}` : ''}`,
})
export const startMessage = (d: CampaignDraft): Msg => ({
  title: `${d.emoji} Começou: ${d.name.trim()}`,
  body: `Hoje é o primeiro dia! ${howToWin(d)} ${prizeLine(d)}`,
})
/** Corrida: quem bateu o alvo recebe o aviso com O PRÊMIO DA POSIÇÃO dele; os outros só ficam sabendo quem bateu. */
export const raceHitMessages = (d: CampaignDraft, w: { name: string; team: Team; position: number; metric: number; prize?: string | null }): { personal: Msg; others: Msg } => ({
  personal: { title: `🏁 Você bateu a meta e ganhou: ${w.prize || prizeFor(d, w.team, w.position)}!`, body: `Campanha ${d.name.trim()}: você foi o ${w.position}º do time ${w.team} a atingir ${metricText(d.criterion, w.metric)}. Parabéns!` },
  others:   { title: `🏁 ${firstWord(w.name)} bateu a meta: ${d.name.trim()}`, body: `${w.name} foi o ${w.position}º do time ${w.team} a atingir o alvo. Ainda dá tempo de garantir sua vaga!` },
})
export const cancelMessage = (d: CampaignDraft): Msg => ({ title: `🚫 Campanha cancelada: ${d.name.trim()}`, body: 'Esta campanha foi cancelada pela gestão. Fique de olho nas próximas!' })
export interface TeamResult { team: Team; winners: { name: string; metric: number; prize?: string | null }[] }   // prize = o gravado pro ganhador (se não vier, vale o da campanha)
/** Mesmas mensagens do resultado, a partir da LISTA de ganhadores (serve tanto na apuração quanto pra reescrever avisos já enviados). */
export function finishMessages(d: CampaignDraft, ev: Evaluation) { return finishMessagesFrom(d, ev.teams.map(t => ({ team: t.team, winners: t.winners.map(w => ({ name: w.name, metric: w.metric, prize: w.tierPrize ?? null })) }))) }
export function finishMessagesFrom(d: CampaignDraft, results: TeamResult[]): { personal: (w: { team: Team; metric: number; prize?: string | null }, position: number) => Msg; everyone: Msg; creator: Msg } {
  if (d.criterion === 'tier_revenue') return finishMessagesTiers(d, results)
  const tiered = d.prize_mode === 'tiered'
  const lines = results.map(t => `${t.team}: ${t.winners.length ? t.winners.map((w, i) => `${i + 1}º ${firstWord(w.name)}${tiered ? ` (${w.prize || prizeFor(d, t.team, i + 1)})` : ''}`).join(', ') : 'sem ganhadores'}`).join(' · ')
  return {
    personal: (w, position) => ({ title: `🏆 Você ganhou: ${w.prize || prizeFor(d, w.team, position)}!`, body: `Campanha ${d.name.trim()}: você ficou em ${position}º lugar no time ${w.team} (${metricText(d.criterion, w.metric)}). Parabéns!` }),
    everyone: { title: `🏁 Resultado: ${d.name.trim()}`, body: tiered ? `${lines}.` : `${lines}. Prêmio: ${d.prize.trim()}.` },
    creator:  { title: `✅ Campanha encerrada: ${d.name.trim()}`, body: `${lines}. Marque a entrega do prêmio em Administração → Campanhas.` },
  }
}
