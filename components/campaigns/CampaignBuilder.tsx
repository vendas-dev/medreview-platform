'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, Minus, Plus, Rocket, Save, X } from 'lucide-react'
import { CampaignDraft, Criterion, CRITERIA, criterionInfo, EMOJIS, Team, TEAMS, TEAM_HINT, THEMES, ThemeId } from '@/lib/campaigns/types'
import { addDays, durationDays, fmtDM, ruleSignature, validateDraft, weekdayOf } from '@/lib/campaigns/engine'
import { CampaignPreview, PreviewData } from './CampaignPreview'
import { TierEditor } from './TierEditor'
import { HourlyPrizes, HourlySchedule } from './HourlyEditor'
import { EventPicker } from './EventPicker'
import { ExcludePicker } from './ExcludePicker'
import { BuilderStyles } from './BuilderStyles'
import { defaultHourly, exactSpan, fmtH, HOURLY_MAX_DAYS, isExactHourly, slotsOfDay, validateHourly } from '@/lib/campaigns/hourly'
import { tiersValid } from '@/lib/campaigns/tiers'
import type { EventCfg, TeamRule } from '@/lib/campaigns/types'
import { Btn, CampaignStyles } from './ui'
import { MAX_OFFER_CODES, MAX_PRODUCT_IDS, offerKey, parseOfferCodes } from '@/lib/telao/offer'

// ══ Criador de campanhas — assistente em 6 passos ════════════════════════════════════════════════════════════
// Esquerda: os passos (cada um mostra o que já foi escolhido) · Centro: UM passo por vez · Direita: prévia ao vivo.
// Rodapé: o que falta neste passo + Voltar / Próximo. "Rascunho" salva incompleto; "Publicar" exige tudo e avisa a equipe.
// A cor da janela acompanha o TEMA escolhido na campanha.

const VERTICALS = [{ id: 'anestreview', label: 'Anest' }, { id: 'oftreview', label: 'Oft' }, { id: 'ortopreview', label: 'Ortop' }, { id: 'medreview', label: 'R1' }]
const STEPS = [
  { t: 'Identidade', eyebrow: 'IDENTIDADE', h: 'Como vai se chamar a campanha?', lead: 'O nome vira o título em destaque para o time. Escolha também um ícone e uma cor — a janela inteira já veste a cor que você escolher.' },
  { t: 'Regra', eyebrow: 'REGRA', h: 'Como se ganha?', lead: 'Escolha o critério que decide os ganhadores. Se precisar, filtre só algumas vendas (por oferta ou produto).' },
  { t: 'Participantes', eyebrow: 'PARTICIPANTES', h: 'Quem participa?', lead: 'Os times inteiros, ou só as pessoas que vão a um evento. Cada time é apurado separado.' },
  { t: 'Datas', eyebrow: 'DATAS', h: 'Quando acontece?', lead: 'Início e fim contam como dias inteiros, no horário de São Paulo.' },
  { t: 'Prêmio', eyebrow: 'PRÊMIO', h: 'Qual é o prêmio?', lead: 'Um prêmio para todos os ganhadores, ou um diferente para cada posição.' },
  { t: 'Revisão e avisos', eyebrow: 'REVISÃO', h: 'Tudo certo? Confira e publique.', lead: 'Veja o resumo, escolha quando a equipe deve ser avisada e publique.' },
] as const
const LAST = STEPS.length - 1
const CRIT_GROUPS: { label: string; ids: Criterion[] }[] = [
  { label: 'RANKING — ganha quem fizer mais no período', ids: ['revenue_rank', 'count_rank', 'best_day', 'best_sale'] },
  { label: 'CORRIDA — ganha quem bater a meta primeiro', ids: ['first_revenue', 'first_count'] },
  { label: 'FAIXAS E HORÁRIOS', ids: ['tier_revenue', 'hourly'] },
]

/** Rótulo + controle, com respiro fixo entre os dois. `as="label"` quando é um campo só (clicar no rótulo foca o campo). */
function Field({ label, hint, as = 'div', children }: { label: string; hint?: React.ReactNode; as?: 'div' | 'label'; children: React.ReactNode }) {
  const Tag = as as any
  return (
    <Tag className="cw-field">
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}><span className="cw-label">{label}</span>{hint && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{hint}</span>}</span>
      {children}
    </Tag>
  )
}
const Note = ({ children, tone = 'info', ...rest }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'bad' } & React.HTMLAttributes<HTMLParagraphElement>) => (
  <p {...rest} className={`cw-note${tone === 'warn' ? ' cw-note--warn' : tone === 'bad' ? ' cw-note--bad' : ''}`}>{children}</p>
)
const Card = ({ title, hint, children, ...rest }: { title?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...rest} className="cw-card">{title && <h3 className="cw-card-h">{title}</h3>}{hint && <p className="cw-card-p">{hint}</p>}{children}</div>
)

// atalhos de período (segunda a domingo, mês...) — a partir de "hoje"
export function datePresets(today: string): { id: string; label: string; start: string; end: string }[] {
  const wd = weekdayOf(today), mon = addDays(today, -((wd + 6) % 7)), nextMon = addDays(mon, 7)
  const monthEnd = (d: string) => { const [y, m] = d.split('-').map(Number); return `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}` }
  return [
    { id: 'hoje', label: 'Hoje', start: today, end: today },
    { id: 'semana', label: 'Esta semana', start: mon, end: addDays(mon, 6) },
    { id: 'proxima', label: 'Próxima semana', start: nextMon, end: addDays(nextMon, 6) },
    { id: 'resto', label: 'Até o fim do mês', start: today, end: monthEnd(today) },
    { id: 'mes', label: 'Mês inteiro', start: `${today.slice(0, 7)}-01`, end: monthEnd(today) },
  ]
}

export function CampaignBuilder({ initial, editingId, status = 'draft', hasOutcome = false, notified = { notifications: 0, deliveries: 0 }, today, eligible, onClose, onSaved }: {
  initial: CampaignDraft; editingId?: string | null; status?: 'draft' | 'published' | 'cancelled'; hasOutcome?: boolean; notified?: { notifications: number; deliveries: number }; today: string; eligible: { OAO: number; R1: number }
  onClose: () => void; onSaved: (msg: string) => void
}) {
  const [d, setD] = useState<CampaignDraft>(initial)
  const [adv, setAdv] = useState(initial.verticals !== null || initial.count_recurring)
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState<number[]>(editingId ? [0, 1, 2, 3, 4, 5] : [])        // passos que a pessoa já passou: só esses ganham o ✓ (nada vem verde de largada)
  const [evCounts, setEvCounts] = useState<Record<Team, number> | null>(null)           // quantos closers do evento há em cada time
  const [prevOpen, setPrevOpen] = useState(false)
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null)
  const [serverErr, setServerErr] = useState<string | null>(null)
  const [live, setLive] = useState<PreviewData | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [offerText, setOfferText] = useState('')                       // o que está digitado e ainda não virou "chip"
  const [offerMsg, setOfferMsg] = useState<string | null>(null)
  const [productText, setProductText] = useState('')                   // o que está digitado no campo de produtos e ainda não virou chip
  const [productMsg, setProductMsg] = useState<string | null>(null)
  const patch = (p: Partial<CampaignDraft>) => setD(x => ({ ...x, ...p }))
  const info = criterionInfo(d.criterion)
  // o que o usuário digitou no campo de ofertas e ainda não apertou Enter JÁ CONTA (validação e envio): nada se perde por falta de um Enter
  const dv = useMemo<CampaignDraft>(() => {
    const ot = offerText.trim(), pt = productText.trim()
    let r = d
    if (ot && Array.isArray(d.offer_codes)) { const have = new Set(d.offer_codes.map(offerKey)); r = { ...r, offer_codes: [...d.offer_codes, ...parseOfferCodes(ot).codes.filter(c => !have.has(offerKey(c)))].slice(0, MAX_OFFER_CODES) } }
    if (pt && Array.isArray(d.product_ids)) { const have = new Set(d.product_ids.map(offerKey)); r = { ...r, product_ids: [...d.product_ids, ...parseOfferCodes(pt).codes.filter(c => !have.has(offerKey(c)))].slice(0, MAX_PRODUCT_IDS) } }
    if (r.filter_logic && !(Array.isArray(r.offer_codes) && Array.isArray(r.product_ids))) r = { ...r, filter_logic: null }      // a condição E/OU só existe com produto E oferta ligados
    return r
  }, [d, offerText, productText])
  const errors = useMemo(() => validateDraft(dv, true), [dv])
  const draftErrors = useMemo(() => validateDraft(dv, false), [dv])
  const saveErrors = status === 'published' ? errors : draftErrors      // campanha já publicada: o servidor exige tudo, a tela também
  const teamKey = TEAMS.filter(t => d.teams[t]).join('+')

  // prévia do ranking: só refaz quando muda algo que altera o RESULTADO (não o visual); espera 600 ms de calma
  const sig = JSON.stringify([d.criterion, d.teams, d.starts_on, d.ends_on, d.count_recurring, d.verticals, d.offer_codes, d.product_ids, d.filter_logic, d.hourly, d.event, d.exclude])
  const seq = useRef(0)
  useEffect(() => {
    if (durationDays(d) === 0 || TEAMS.every(t => !d.teams[t])) { setLive(null); return }
    const my = ++seq.current; setLiveLoading(true)
    const id = setTimeout(async () => {
      try {
        const r = await fetch('/api/admin/campaigns/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: d }) })
        if (r.ok && my === seq.current) setLive(await r.json())
      } catch { /* a prévia do ranking é um bônus: o resto continua funcionando */ } finally { if (my === seq.current) setLiveLoading(false) }
    }, 600)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const setTeams = (mode: 'OAO' | 'R1' | 'BOTH') => {
    const keep = (t: Team) => d.teams[t] ?? { winners: info.hourly ? 1 : t === 'R1' ? 4 : 3, target: null, ...(info.tiers ? { tiers: [{ target: null, prize: '' }] } : {}) }
    const teams = (mode === 'BOTH' ? { OAO: keep('OAO'), R1: keep('R1') } : { [mode]: keep(mode) }) as CampaignDraft['teams']
    // por hora: a lista de prêmios por horário é a MESMA para todos os times — quem entra agora já nasce com ela
    const base = info.hourly ? TEAMS.map(t => d.prizes[t]).find(Boolean) : null
    patch(base ? { teams, prizes: Object.fromEntries(TEAMS.filter(t => teams[t]).map(t => [t, d.prizes[t] ?? base])) as CampaignDraft['prizes'] } : { teams })
  }
  const mode: 'OAO' | 'R1' | 'BOTH' | null = d.teams.OAO && d.teams.R1 ? 'BOTH' : d.teams.OAO ? 'OAO' : d.teams.R1 ? 'R1' : null
  const pickCriterion = (id: Criterion) => {
    if (id === 'tier_revenue') patch({ criterion: id, teams: Object.fromEntries(TEAMS.filter(t => d.teams[t]).map(t => [t, { ...d.teams[t]!, tiers: d.teams[t]!.tiers?.length ? d.teams[t]!.tiers : [{ target: null, prize: '' }] }])) as CampaignDraft['teams'] })
    else if (id === 'hourly') patch({ criterion: id, hourly: d.hourly ?? defaultHourly(), teams: Object.fromEntries(TEAMS.filter(t => d.teams[t]).map(t => [t, { ...d.teams[t]!, winners: 1, target: null }])) as CampaignDraft['teams'] })      // por hora: 1 ganhador por rodada, em cada time
    else patch({ criterion: id })
  }
  const setRule = (t: Team, p: Partial<TeamRule>) => patch({ teams: { ...d.teams, [t]: { ...d.teams[t]!, ...p } } })
  const MED = ['🥇', '🥈', '🥉']
  const setPrize = (t: Team, i: number, v: string) => { const list = [...(d.prizes[t] ?? [])]; while (list.length <= i) list.push(''); list[i] = v; patch({ prizes: { ...d.prizes, [t]: list } }) }
  const copyPrizes = (from: Team, to: Team) => { const src = d.prizes[from] ?? [], n = d.teams[to]?.winners ?? 0; patch({ prizes: { ...d.prizes, [to]: Array.from({ length: n }, (_, i) => src[i] ?? '') } }) }
  const offersOn = Array.isArray(d.offer_codes)
  const addOffers = (raw: string): boolean => {              // true = tudo foi entendido (o campo pode ser limpo)
    const p = parseOfferCodes(raw), cur = d.offer_codes ?? [], have = new Set(cur.map(offerKey))
    const add = p.codes.filter(c => !have.has(offerKey(c))), room = Math.max(0, MAX_OFFER_CODES - cur.length), take = add.slice(0, room)
    setOfferMsg(p.rejected.length ? `Não entendi: ${p.rejected.slice(0, 3).join(', ')}${p.rejected.length > 3 ? '…' : ''}. Código de oferta tem só letras, números, ponto, hífen e sublinhado.` : add.length > room ? `Máximo de ${MAX_OFFER_CODES} códigos por campanha.` : p.codes.length && !add.length ? 'Esse código já estava na lista.' : null)
    if (take.length) patch({ offer_codes: [...cur, ...take] })
    return p.rejected.length === 0 && add.length <= room
  }
  const removeOffer = (c: string) => { setOfferMsg(null); patch({ offer_codes: (d.offer_codes ?? []).filter(x => offerKey(x) !== offerKey(c)) }) }      // lista vazia continua LIGADA: quem decide desligar é o usuário
  const productsOn = Array.isArray(d.product_ids)
  const addProducts = (raw: string): boolean => {            // true = tudo foi entendido (o campo pode ser limpo)
    const p = parseOfferCodes(raw), cur = d.product_ids ?? [], have = new Set(cur.map(offerKey))
    const add = p.codes.filter(c => !have.has(offerKey(c))), room = Math.max(0, MAX_PRODUCT_IDS - cur.length), take = add.slice(0, room)
    setProductMsg(p.rejected.length ? `Não entendi: ${p.rejected.slice(0, 3).join(', ')}${p.rejected.length > 3 ? '…' : ''}. ID de produto tem só letras, números, ponto, hífen e sublinhado.` : add.length > room ? `Máximo de ${MAX_PRODUCT_IDS} IDs por campanha.` : p.codes.length && !add.length ? 'Esse ID já estava na lista.' : null)
    if (take.length) patch({ product_ids: [...cur, ...take] })
    return p.rejected.length === 0 && add.length <= room
  }
  const removeProduct = (c: string) => { setProductMsg(null); patch({ product_ids: (d.product_ids ?? []).filter(x => offerKey(x) !== offerKey(c)) }) }      // lista vazia continua LIGADA: quem decide desligar é o usuário
  const toggleVert = (v: string) => { const cur = d.verticals ?? []; const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; patch({ verticals: next.length ? next : null }) }

  async function submit(publish: boolean) {
    const pendente = offerText.trim()
    if (pendente && parseOfferCodes(pendente).rejected.length) { setServerErr(`Código de oferta inválido: ${parseOfferCodes(pendente).rejected.slice(0, 3).join(', ')}. Corrija ou apague antes de salvar.`); return }
    const pendenteP = productText.trim()
    if (pendenteP && parseOfferCodes(pendenteP).rejected.length) { setServerErr(`ID de produto inválido: ${parseOfferCodes(pendenteP).rejected.slice(0, 3).join(', ')}. Corrija ou apague antes de salvar.`); return }
    setSaving(publish ? 'publish' : 'draft'); setServerErr(null)
    try {
      const url = editingId ? `/api/admin/campaigns/${editingId}` : '/api/admin/campaigns'
      const r = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: dv, publish }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setServerErr(j?.error ?? 'Não consegui salvar.'); return }
      if (editingId && publish) {                                   // editou e quer publicar: a edição já foi salva, agora publica
        const p = await fetch(`/api/admin/campaigns/${editingId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }) })
        const pj = await p.json().catch(() => ({})); if (!p.ok) { setServerErr(pj?.error ?? 'Não consegui publicar.'); return }
      }
      const sy = j?.sync, rs = j?.reset
      const extra = [sy?.updated ? `${sy.updated} aviso${sy.updated > 1 ? 's' : ''} atualizado${sy.updated > 1 ? 's' : ''}` : '', rs?.winners || rs?.notifications ? 'resultado refeito' : ''].filter(Boolean).join(' · ')
      onSaved(publish ? (d.notify ? 'Campanha publicada e equipe avisada! 🚀' : d.notify_result ? 'Campanha publicada! O resultado será avisado ao final. 🚀' : 'Campanha publicada! 🚀') : editingId ? `Campanha atualizada ✅${extra ? ` · ${extra}` : ''}` : 'Rascunho salvo.')
    } catch { setServerErr('Sem conexão. Tente de novo.') } finally { setSaving(null) }
  }

  // ── campanha de EVENTO: quem participa passa a ser "as pessoas que vão ao evento" ──
  const eventOn = !!d.event
  const defRule = (t: Team, n = 99): TeamRule => ({ winners: info.hourly ? 1 : Math.max(1, Math.min(t === 'R1' ? 4 : 3, n)), target: null, ...(info.tiers ? { tiers: [{ target: null, prize: '' }] } : {}) })
  const setAudience = (k: 'teams' | 'event') => {
    if (k === 'event') { if (!d.event) patch({ event: { name: '', closers: [] }, exclude: [] }); return }
    if (!d.event) return
    patch({ event: null, ...(TEAMS.some(t => d.teams[t]) ? {} : { teams: { OAO: defRule('OAO'), R1: defRule('R1') } }) })
  }
  const onEventChange = (ev: EventCfg, counts: Record<Team, number>) => {
    const want = TEAMS.filter(t => counts[t] > 0)
    setEvCounts(counts)
    const grow = (t: Team): TeamRule => {                  // time que já existia: acompanha a contagem (sobe se estava no máximo, desce se passou)
      const r = d.teams[t]; if (!r) return defRule(t, counts[t])
      if (info.hourly || info.tiers) return r
      const w = r.winners > counts[t] ? counts[t] : (evCounts && r.winners === evCounts[t] && counts[t] > r.winners ? defRule(t, counts[t]).winners : r.winners)
      return w === r.winners ? r : { ...r, winners: w }
    }
    const teams = Object.fromEntries(want.map(t => [t, grow(t)])) as CampaignDraft['teams']
    const base = info.hourly ? TEAMS.map(t => d.prizes[t]).find(Boolean) : null           // por hora: a lista de prêmios por horário é a mesma para todos os times
    patch({ event: ev, teams, ...(base ? { prizes: Object.fromEntries(want.map(t => [t, d.prizes[t] ?? base])) as CampaignDraft['prizes'] } : {}) })
  }
  // quem vai ao evento limita quantos podem ser premiados: 3 do OAO no evento = no máximo 3 premiados no OAO
  const outN = d.exclude?.length ?? 0, partOn = eventOn || outN > 0      // evento OU closers de fora: o nº de premiados é limitado a quem participa
  const maxW = (t: Team) => (partOn && evCounts && evCounts[t] > 0 ? Math.min(50, evCounts[t]) : 50)
  useEffect(() => {
    if (!partOn || !evCounts || info.hourly || info.tiers) return
    setD(x => {
      let ch = false; const teams = { ...x.teams }
      for (const t of TEAMS) { const r = teams[t]; if (r && evCounts[t] > 0 && r.winners > evCounts[t]) { teams[t] = { ...r, winners: evCounts[t] }; ch = true } }
      return ch ? { ...x, teams } : x
    })
  }, [evCounts, partOn, d.criterion, d.teams.OAO?.winners, d.teams.R1?.winners]) // eslint-disable-line react-hooks/exhaustive-deps
  // "Quem irá participar?": quem ficou de fora tira vaga dos premiados do time (mesma regra do evento)
  const onExcludeChange = (next: string[], counts: Record<Team, number>) => {
    setEvCounts(counts)
    const teams = { ...d.teams }
    if (!info.hourly && !info.tiers) for (const t of TEAMS) {
      const r = teams[t]; if (!r || counts[t] <= 0) continue
      const w = r.winners > counts[t] ? counts[t] : (evCounts && r.winners === evCounts[t] && counts[t] > r.winners ? defRule(t, counts[t]).winners : r.winners)
      if (w !== r.winners) teams[t] = { ...r, winners: w }
    }
    patch({ exclude: next, teams })
  }
  const [filtersOpen, setFiltersOpen] = useState(Array.isArray(initial.offer_codes) || Array.isArray(initial.product_ids))

  const presets = datePresets(today), past = d.starts_on && d.starts_on < today && durationDays(d) > 0
  const mainRef = useRef<HTMLElement>(null)
  const tf = TEAMS.filter(t => d.teams[t])
  // cada passo "fica verde" quando está completo
  const done: boolean[] = [
    d.name.trim().length > 0 && d.name.trim().length <= 60,
    true,
    (!d.event || d.event.closers.length > 0) && (!outN || tf.every(t => !evCounts || evCounts[t] > 0)) && (info.tiers ? (tf.length > 0 && tf.every(t => tiersValid(d.teams[t]!.tiers))) : tf.length > 0 && tf.every(t => { const r = d.teams[t]!; return Number.isInteger(r.winners) && r.winners >= 1 && r.winners <= maxW(t) && (!info.needsTarget || (r.target ?? 0) > 0) })),
    durationDays(d) > 0 && durationDays(d) <= (info.hourly ? HOURLY_MAX_DAYS : 92),
    d.prize_mode === 'tiered'
      ? tf.length > 0 && tf.every(t => { const n = d.teams[t]!.winners || 0; return n >= 1 && Array.from({ length: Math.min(n, 50) }, (_, i) => (d.prizes[t]?.[i] ?? '').trim()).every(Boolean) })
      : d.prize.trim().length > 0,
    false,
  ]
  if (info.tiers) done[4] = done[2]
  if (info.hourly) {
    done[1] = !!d.hourly && slotsOfDay(d.hourly).length > 0 && validateHourly({ ...d, starts_on: '2026-01-01', ends_on: '2026-01-01', prize_mode: 'single', prize: 'x' }, true).length === 0
    done[4] = d.prize_mode === 'tiered' ? tf.length > 0 && !!d.hourly && slotsOfDay(d.hourly).length > 0 && tf.every(t => slotsOfDay(d.hourly).every((_, i) => (d.prizes[t]?.[i] ?? '').trim().length > 0)) : d.prize.trim().length > 0
  }
  if (Array.isArray(d.offer_codes) && d.offer_codes.length === 0 && !offerText.trim()) done[1] = false
  if (Array.isArray(d.product_ids) && d.product_ids.length === 0 && !productText.trim()) done[1] = false
  if (Array.isArray(d.offer_codes) && Array.isArray(d.product_ids) && d.offer_codes.length > 0 && d.product_ids.length > 0 && d.filter_logic !== 'and' && d.filter_logic !== 'or') done[1] = false
  done[LAST] = errors.length === 0
  const setHourlyPrizes = (list: string[]) => patch({ prizes: Object.fromEntries(tf.map(t => [t, list])) as CampaignDraft['prizes'] })
  const goStep = (n: number) => { setSeen(s => s.includes(step) ? s : [...s, step]); setStep(Math.max(0, Math.min(LAST, n))); setPrevOpen(false) }
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [step])
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev } }, [])   // o fundo não rola atrás da janela
  // Editar vale pra QUALQUER campanha. O que a edição faz com os avisos já enviados é mostrado antes de salvar:
  const editingLive = !!editingId && status === 'published'
  const ruleChanged = editingLive && ruleSignature(initial) !== ruleSignature(d)

  // o que cada passo mostra no trilho da esquerda
  const nTeamsTxt = mode === 'BOTH' ? 'OAO + R1' : mode ?? '—'
  const prizeTxt = info.tiers ? 'Por faixa de valor' : d.prize_mode === 'tiered' ? (info.hourly ? 'Por horário' : 'Por posição') : d.prize.trim() || '—'
  const summaries = [
    d.name.trim() || 'Sem nome ainda',
    `${info.icon} ${info.label}${Array.isArray(d.offer_codes) || Array.isArray(d.product_ids) ? ' · com filtro' : ''}`,
    eventOn ? `🎪 ${d.event!.name || 'Evento'} · ${d.event!.closers.length} ${d.event!.closers.length === 1 ? 'closer' : 'closers'}` : tf.length ? `Times ${nTeamsTxt}${outN ? ` · ${outN} de fora` : ''}` : 'Escolha os times',
    durationDays(d) > 0 ? `${fmtDM(d.starts_on)}${d.starts_on !== d.ends_on ? ` → ${fmtDM(d.ends_on)}` : ''} · ${durationDays(d)} ${durationDays(d) === 1 ? 'dia' : 'dias'}` : 'Informe as datas',
    prizeTxt,
    `Criação ${d.notify ? 'ligada' : 'desligada'} · Resultado ${d.notify_result ? 'ligado' : 'desligado'}`,
  ]
  // "o que falta neste passo" — só os erros que dizem respeito ao passo (a validação completa é a mesma de sempre)
  const stepRe = [/nome|descrição curta/i, /oferta|produto|condição|horário|Intervalo|intervalos|rodada|critério|hora/i, /time|closer|premiados|valor|vendas a bater|faixa|evento/i, /data|dias/i, /prêmio/i, /./]
  const stepErrors = errors.filter(e => stepRe[step].test(e))
  const hint = serverErr ? { tone: 'bad', text: `⛔ ${serverErr}` }
    : step === LAST ? (editingLive ? (errors.length > 0 ? { tone: 'warn', text: `Para salvar falta: ${errors.slice(0, 2).join(' ')}${errors.length > 2 ? ` (+${errors.length - 2})` : ''}` }
        : ruleChanged && hasOutcome ? { tone: 'bad', text: '⚠ Salvar vai APAGAR e REFAZER os ganhadores e os avisos de resultado já enviados.' }
        : notified.notifications > 0 ? { tone: 'info', text: `🔔 Salvar vai atualizar ${notified.notifications === 1 ? 'o aviso já enviado' : `os ${notified.notifications} avisos já enviados`}.` }
        : { tone: 'ok', text: '✓ Tudo certo para salvar.' })
      : errors.length > 0 ? { tone: 'warn', text: `Para publicar falta: ${errors.slice(0, 2).join(' ')}${errors.length > 2 ? ` (+${errors.length - 2})` : ''}` } : { tone: 'ok', text: '✓ Tudo pronto para publicar.' })
    : stepErrors.length > 0 && !done[step] ? { tone: 'warn', text: stepErrors[0] + (stepErrors.length > 1 ? ` (+${stepErrors.length - 1})` : '') }
    : done[step] ? { tone: 'ok', text: '✓ Passo completo.' } : { tone: 'info', text: ' ' }
  const hintColor = hint.tone === 'bad' ? '#ef4444' : hint.tone === 'warn' ? '#d97706' : hint.tone === 'ok' ? '#16a34a' : 'var(--muted-foreground)'
  const shownDone = done.map((v, i) => v && seen.includes(i))
  const doneCount = shownDone.slice(0, LAST).filter(Boolean).length
  const theme = THEMES[d.theme] ?? THEMES.roxo
  const savePrimary = step === LAST && status !== 'draft'

  // ───────────────────────── os passos ─────────────────────────
  const TeamRuleCard = ({ t }: { t: Team }) => {
    const r = d.teams[t]!
    return (
      <div key={t} data-rule={t} className="cw-card" style={{ gap: 16, padding: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--foreground)' }}>Time {t}{eventOn && <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted-foreground)' }}> · {evCounts && evCounts[t] > 0 ? `${evCounts[t]} ${evCounts[t] === 1 ? 'closer' : 'closers'} no evento` : 'só os closers do evento'}</span>}</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{TEAM_HINT[t]}</p>
        </div>
        {info.tiers && <TierEditor team={t} tiers={r.tiers ?? [{ target: null, prize: '' }]} copyFrom={TEAMS.filter(x => x !== t && d.teams[x] && d.teams[x]!.tiers?.length).map(x => ({ team: x, tiers: d.teams[x]!.tiers! }))[0] ?? null} onChange={tiers => setRule(t, { tiers, winners: Math.max(1, tiers.length) })} />}
        {info.hourly && <p data-hourly-winners style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>⏰ <strong style={{ color: 'var(--foreground)' }}>1 ganhador por rodada</strong> neste time — quem mais se destacar em cada horário.</p>}
        <div style={info.tiers || info.hourly ? { display: 'none' } : undefined}><Field label="Quantos serão premiados?">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="cp-ib" aria-label="menos" disabled={r.winners <= 1} onClick={() => setRule(t, { winners: Math.max(1, r.winners - 1) })} style={{ width: 44, height: 44 }}><Minus size={15} /></button>
            <input className="cp-field" data-winners={t} type="number" min={1} max={maxW(t)} value={r.winners || ''} onChange={e => setRule(t, { winners: Math.min(maxW(t), Math.trunc(Number(e.target.value))) })} style={{ width: 84, textAlign: 'center', fontWeight: 800, fontSize: 16 }} />
            <button type="button" className="cp-ib" aria-label="mais" disabled={r.winners >= maxW(t)} onClick={() => setRule(t, { winners: Math.min(maxW(t), (r.winners || 0) + 1) })} style={{ width: 44, height: 44 }}><Plus size={15} /></button>
            <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginLeft: 4 }}>{r.winners === 1 ? 'só o 1º lugar' : `do 1º ao ${r.winners || '—'}º`}{partOn && evCounts && evCounts[t] > 0 ? ` · máx. ${evCounts[t]} (${eventOn ? 'quem vai ao evento neste time' : 'quem participa neste time'})` : ''}</span>
          </div>
        </Field></div>
        {info.needsTarget && (
          <Field label={info.unit === 'money' ? 'Valor a bater (R$)' : 'Vendas a bater'} as="label">
            <input className="cp-field" data-target={t} type="number" min={1} value={r.target ?? ''} onChange={e => setRule(t, { target: e.target.value === '' ? null : Number(e.target.value) })} placeholder={info.unit === 'money' ? 'Ex.: 50000' : 'Ex.: 10'} />
          </Field>
        )}
      </div>
    )
  }

  const stepIdentity = (
    <>
      <Card>
        <Field label="Nome da campanha" hint={`${d.name.length}/60`} as="label">
          <input className="cp-field cw-input-xl" data-f="name" value={d.name} onChange={e => patch({ name: e.target.value })} maxLength={60} placeholder="Ex.: Corridinha" autoFocus />
        </Field>
        <Field label="Descrição curta (opcional)" as="label">
          <input className="cp-field" data-f="subtitle" value={d.subtitle} onChange={e => patch({ subtitle: e.target.value })} maxLength={140} placeholder="Ex.: Quem vender mais leva o prêmio da semana" />
        </Field>
      </Card>
      <Card>
        <div className="cw-row" style={{ gap: 28 }}>
          <Field label="Ícone">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,46px))', gap: 8 }}>
              {EMOJIS.map(e => <button key={e} type="button" className="cp-opt" aria-pressed={d.emoji === e} data-emoji={e} onClick={() => patch({ emoji: e })} style={{ aspectRatio: '1', borderRadius: 13, fontSize: 21, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{e}</button>)}
            </div>
          </Field>
          <Field label="Cor">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(Object.keys(THEMES) as ThemeId[]).map(k => (
                <button key={k} type="button" data-theme={k} aria-label={THEMES[k].label} aria-pressed={d.theme === k} title={THEMES[k].label} onClick={() => patch({ theme: k })}
                  style={{ width: 44, height: 44, borderRadius: 14, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${THEMES[k].from},${THEMES[k].to})`, boxShadow: d.theme === k ? '0 0 0 3px var(--card), 0 0 0 5px var(--foreground)' : '0 1px 3px rgba(0,0,0,.2)', transition: 'box-shadow .15s, transform .15s', transform: d.theme === k ? 'scale(1.06)' : 'none' }} />
              ))}
            </div>
          </Field>
        </div>
      </Card>
    </>
  )

  const stepRule = (
    <>
      {CRIT_GROUPS.map(g => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="cw-group">{g.label}</p>
          <div className="cw-choices">
            {g.ids.map(id => CRITERIA.find(c => c.id === id)!).filter(Boolean).map(c => (
              <button key={c.id} type="button" className="cp-opt cw-choice" aria-pressed={d.criterion === c.id} data-criterion={c.id} onClick={() => pickCriterion(c.id)}>
                <span className="cw-choice-i"><span>{c.icon}</span>{c.label}</span>
                <span className="cw-choice-d">{c.desc}</span>
                {d.criterion === c.id && <span className="cw-tick"><Check size={12} strokeWidth={3.5} /></span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {info.hourly && d.hourly && <HourlySchedule cfg={d.hourly} days={durationDays(d)} baseDay={d.starts_on} onChange={h => patch({ hourly: h, ...(exactSpan(h) ?? {}) })} />}
      <div className="cw-adv" data-filters>
        <button type="button" data-filters-toggle aria-expanded={filtersOpen} onClick={() => setFiltersOpen(o => !o)}>
          <span style={{ fontSize: 17 }}>🏷️</span>
          <span style={{ flex: 1 }}>Filtrar só algumas vendas <small>· por oferta ou produto (opcional){offersOn || productsOn ? ' — ligado' : ''}</small></span>
          <ChevronDown size={16} style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--muted-foreground)' }} />
        </button>
        {filtersOpen && <div className="cw-adv-b">
<div data-offer-block style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="cw-toggle">
                  <input data-f="offer-on" type="checkbox" checked={offersOn} onChange={e => { setOfferText(''); setOfferMsg(null); patch({ offer_codes: e.target.checked ? [] : null }) }} />
                  <span><strong>🏷️ Só vendas de ofertas específicas</strong><span>Cada produto da Hotmart tem várias ofertas, e cada oferta tem um código. Ligando isto, só entram na conta as vendas das ofertas que você informar — vale para o critério escolhido acima (receita, quantidade, primeiro a bater…). A venda entra se o campo <em>contiver</em> um dos códigos — também quando vier mais de um código no mesmo campo, separados por ponto e vírgula (ex.: dyghjalk;yagbthgk).</span></span>
                </label>
                {offersOn && (
                  <Field label="Códigos das ofertas" hint={`${(d.offer_codes ?? []).length}/${MAX_OFFER_CODES}`}>
                    <div data-offer-chips style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(d.offer_codes ?? []).map(c => (
                        <span key={c} data-offer-chip={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 6px 0 12px', borderRadius: 999, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.35)', fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                          <code style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>{c}</code>
                          <button type="button" data-offer-remove={c} aria-label={`Remover a oferta ${c}`} onClick={() => removeOffer(c)} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(99,102,241,.18)', color: 'var(--foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                    <input className="cp-field" data-f="offer-input" value={offerText} autoComplete="off" spellCheck={false} placeholder="Cole ou digite e aperte Enter"
                      onChange={e => { setOfferText(e.target.value); if (offerMsg) setOfferMsg(null) }}
                      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') && offerText.trim()) { e.preventDefault(); if (addOffers(offerText)) setOfferText('') } else if (e.key === 'Enter') e.preventDefault() }}
                      onPaste={e => { const t = e.clipboardData.getData('text'); if (t.trim()) { e.preventDefault(); if (addOffers(`${offerText} ${t}`)) setOfferText('') } }}
                      onBlur={() => { if (offerText.trim() && addOffers(offerText)) setOfferText('') }} />
                    {offerMsg && <Note tone="warn" data-offer-msg>{offerMsg}</Note>}
                    {(d.offer_codes ?? []).length === 0 && !offerText.trim() && <Note data-offer-empty>Informe pelo menos um código de oferta — sem isso a campanha não pode ser publicada.</Note>}
                  </Field>
                )}
              </div>
<div data-product-block style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="cw-toggle">
                  <input data-f="product-on" type="checkbox" checked={productsOn} onChange={e => { setProductText(''); setProductMsg(null); patch({ product_ids: e.target.checked ? [] : null }) }} />
                  <span><strong>🧩 Só vendas de produtos específicos (ID do produto)</strong><span>Cada produto da Hotmart tem um ID numérico (ex.: 2366290). Ligando isto, só entram na conta as vendas dos produtos que você informar. A venda entra se o campo <em>contiver</em> um dos IDs — também quando vier mais de um ID no mesmo campo, separados por ponto e vírgula (ex.: 1234;5678). Se ligar também as ofertas, você escolhe se vale produto E oferta ou produto OU oferta.</span></span>
                </label>
                {productsOn && (
                  <Field label="IDs dos produtos" hint={`${(d.product_ids ?? []).length}/${MAX_PRODUCT_IDS}`}>
                    <div data-product-chips style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(d.product_ids ?? []).map(c => (
                        <span key={c} data-product-chip={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 6px 0 12px', borderRadius: 999, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.38)', fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>
                          <code style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>{c}</code>
                          <button type="button" data-product-remove={c} aria-label={`Remover o produto ${c}`} onClick={() => removeProduct(c)} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(16,185,129,.2)', color: 'var(--foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                    <input className="cp-field" data-f="product-input" value={productText} autoComplete="off" spellCheck={false} inputMode="numeric" placeholder="Cole ou digite o ID e aperte Enter"
                      onChange={e => { setProductText(e.target.value); if (productMsg) setProductMsg(null) }}
                      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') && productText.trim()) { e.preventDefault(); if (addProducts(productText)) setProductText('') } else if (e.key === 'Enter') e.preventDefault() }}
                      onPaste={e => { const t = e.clipboardData.getData('text'); if (t.trim()) { e.preventDefault(); if (addProducts(`${productText} ${t}`)) setProductText('') } }}
                      onBlur={() => { if (productText.trim() && addProducts(productText)) setProductText('') }} />
                    {productMsg && <Note tone="warn" data-product-msg>{productMsg}</Note>}
                    {(d.product_ids ?? []).length === 0 && !productText.trim() && <Note data-product-empty>Informe pelo menos um ID de produto — sem isso a campanha não pode ser publicada.</Note>}
                  </Field>
                )}
              </div>
{offersOn && productsOn && (
                <div data-logic-block role="group" aria-label="Condição entre produto e oferta" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="cb-label">Como combinar produto e oferta?</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                    {([['and', 'E', 'A venda precisa ser do produto E da oferta (as duas coisas ao mesmo tempo).'], ['or', 'OU', 'Vale se for do produto OU da oferta (basta uma das duas).']] as const).map(([id, label, desc]) => (
                      <button key={id} type="button" className="cp-opt" aria-pressed={d.filter_logic === id} data-logic={id} onClick={() => patch({ filter_logic: id })} style={{ padding: 16, minHeight: 88 }}>
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 900, color: 'var(--foreground)' }}>{label}</span>
                        <span style={{ display: 'block', marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>{desc}</span>
                      </button>
                    ))}
                  </div>
                  {d.filter_logic !== 'and' && d.filter_logic !== 'or' && <Note tone="warn" data-logic-empty>Escolha E ou OU para poder publicar.</Note>}
                </div>
              )}
        </div>}
      </div>
    </>
  )

  const stepWho = (
    <>
      <div className="cw-choices cw-choices--2" role="group" aria-label="Quem participa">
        <button type="button" className="cp-opt cw-choice" aria-pressed={!eventOn} data-audience="teams" onClick={() => setAudience('teams')}>
          <span className="cw-choice-i"><span>👥</span>Times inteiros</span><span className="cw-choice-d">Todo mundo do time OAO e/ou R1 concorre e recebe os avisos.</span>
          {!eventOn && <span className="cw-tick"><Check size={12} strokeWidth={3.5} /></span>}
        </button>
        <button type="button" className="cp-opt cw-choice" aria-pressed={eventOn} data-audience="event" onClick={() => setAudience('event')}>
          <span className="cw-choice-i"><span>🎪</span>Pessoas de um evento</span><span className="cw-choice-d">Só os closers que vão ao evento concorrem — e só eles são avisados.</span>
          {eventOn && <span className="cw-tick"><Check size={12} strokeWidth={3.5} /></span>}
        </button>
      </div>
      {eventOn ? (
        <Card title="🎪 Quem vai ao evento?" hint="A mesma escolha do cadastro de eventos: clique na foto de cada closer.">
          <EventPicker value={d.event!} onChange={onEventChange} onCounts={setEvCounts} onDates={(a, b) => patch({ starts_on: a, ends_on: b })} />
        </Card>
      ) : (
        <Card title="Quais times participam?">
          <div className="cp-seg" role="group">
            {([['OAO', `Time OAO · ${eligible.OAO} pessoas`], ['R1', `Time R1 · ${eligible.R1} pessoas`], ['BOTH', 'Os dois times']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} data-teams={id} onClick={() => setTeams(id)}>{label}</button>
            ))}
          </div>
        </Card>
      )}
      {!eventOn && tf.length > 0 && <ExcludePicker value={d.exclude ?? []} teams={tf} onChange={onExcludeChange} onCounts={setEvCounts} />}
      {tf.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="cw-group">REGRA DE CADA TIME</p>
          <div className="cw-row">{tf.map(t => TeamRuleCard({ t }))}</div>
        </div>
      )}
    </>
  )

  const exactDates = !!info.hourly && isExactHourly(d.hourly), exactRanges = exactDates ? d.hourly!.ranges.filter(r => r.day && r.endDay) : []
  const stepDates = exactDates ? (
    <Card>
      <div data-dates-auto style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>As datas desta campanha são <strong style={{ color: 'var(--foreground)' }}>definidas automaticamente pelos intervalos de horário</strong> (início do primeiro e fim do último), no horário de São Paulo.</p>
        {exactRanges.length === 0 ? <Note tone="warn">Defina os intervalos (com data e hora) no passo &ldquo;Regra&rdquo; para a campanha ganhar as datas.</Note> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exactRanges.map((r, i) => <div key={i} data-dates-range={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--secondary)', fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(99,102,241,.14)', color: '#6366f1', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span>{fmtDM(r.day!)} às {fmtH(r.from)}</span><span style={{ color: 'var(--muted-foreground)' }}>→</span><span>{fmtDM(r.endDay!)} às {fmtH(r.to)}</span>
            </div>)}
          </div>)}
        <div><Btn size="sm" data-dates-edit onClick={() => goStep(1)}>Editar intervalos</Btn></div>
      </div>
      <Note data-duration>{durationDays(d) > 0 ? <>Duração: <strong style={{ color: 'var(--foreground)' }}>{durationDays(d)} {durationDays(d) === 1 ? 'dia' : 'dias'}</strong> ({fmtDM(d.starts_on)}{d.starts_on !== d.ends_on ? ` a ${fmtDM(d.ends_on)}` : ''}).</> : 'Informe as datas.'}</Note>
      {info.hourly && d.hourly && <Note tone={durationDays(d) > HOURLY_MAX_DAYS ? 'warn' : 'info'} data-hourly-days>{durationDays(d) > HOURLY_MAX_DAYS ? `⚠ Campanha por hora pode durar no máximo ${HOURLY_MAX_DAYS} dias.` : `⏰ ${slotsOfDay(d.hourly).length} ${slotsOfDay(d.hourly).length === 1 ? 'rodada' : 'rodadas'} no total, no horário de São Paulo.`}</Note>}
      {past && <Note tone="warn" data-past>⚠ O início é no passado: a campanha será apurada com as vendas que já aconteceram.</Note>}
    </Card>
  ) : (
    <Card>
      <Field label="Atalhos">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presets.map(p => <button key={p.id} type="button" className="cp-opt" aria-pressed={d.starts_on === p.start && d.ends_on === p.end} data-preset={p.id} onClick={() => patch({ starts_on: p.start, ends_on: p.end })} style={{ height: 40, padding: '0 18px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>{p.label}</button>)}
        </div>
      </Field>
      <div className="cw-row">
        <Field label="Início" as="label"><input className="cp-field" data-f="starts_on" type="date" value={d.starts_on} onChange={e => { const v = e.target.value; patch({ starts_on: v, ends_on: d.ends_on < v ? v : d.ends_on }) }} /></Field>
        <Field label="Fim" as="label"><input className="cp-field" data-f="ends_on" type="date" value={d.ends_on} min={d.starts_on} onChange={e => patch({ ends_on: e.target.value })} /></Field>
      </div>
      <Note data-duration>{durationDays(d) > 0 ? <>Duração: <strong style={{ color: 'var(--foreground)' }}>{durationDays(d)} {durationDays(d) === 1 ? 'dia' : 'dias'}</strong> ({fmtDM(d.starts_on)}{d.starts_on !== d.ends_on ? ` a ${fmtDM(d.ends_on)}` : ''}). Para as outras semanas, crie (ou duplique) uma campanha para cada.</> : 'Informe as datas.'}</Note>
      {info.hourly && d.hourly && <Note tone={durationDays(d) > HOURLY_MAX_DAYS ? 'warn' : 'info'} data-hourly-days>{durationDays(d) > HOURLY_MAX_DAYS ? `⚠ Campanha por hora pode durar no máximo ${HOURLY_MAX_DAYS} dias.` : `⏰ Todos os dias terão as mesmas rodadas (${slotsOfDay(d.hourly).length} por dia), no horário de São Paulo. O dia começa às 00h e termina às 24h.`}</Note>}
      {past && <Note tone="warn" data-past>⚠ O início é no passado: a campanha será apurada com as vendas que já aconteceram.</Note>}
    </Card>
  )

  const prizeModeSeg = (opts: readonly (readonly [string, string])[]) => (
    <div className="cp-seg" role="group">
      {opts.map(([id, label]) => <button key={id} type="button" aria-pressed={d.prize_mode === id} data-prize-mode={id} onClick={() => patch({ prize_mode: id as 'single' | 'tiered' })}>{label}</button>)}
    </div>
  )
  const stepPrize = info.hourly && d.hourly ? (
    <Card hint="Cada rodada tem um ganhador por time: o mesmo prêmio em todas, ou um prêmio diferente por horário.">
      {prizeModeSeg([['single', '🎁 Mesmo prêmio em todas as rodadas'], ['tiered', '🕐 Prêmio diferente por horário']])}
      {d.prize_mode !== 'tiered' ? (
        <Field label="Prêmio de cada rodada" as="label"><input className="cp-field" data-f="prize" value={d.prize} onChange={e => patch({ prize: e.target.value })} maxLength={120} placeholder="Ex.: Vale-presente de R$ 50" /></Field>
      ) : tf.length === 0 ? <Note>Escolha os participantes no passo 3 para definir o prêmio de cada horário.</Note>
        : <HourlyPrizes cfg={d.hourly} list={d.prizes[tf[0]] ?? []} onChange={setHourlyPrizes} />}
    </Card>
  ) : info.tiers ? (
    <Card><Note>Os prêmios foram definidos junto de cada faixa, no passo 3: quem atinge uma faixa ganha o prêmio dela (a mais alta que alcançar).</Note></Card>
  ) : (
    <Card>
      {prizeModeSeg([['single', '🎁 Premiação única'], ['tiered', '🏅 Premiação diferenciada']])}
      {d.prize_mode !== 'tiered' ? (
        <Field label="Prêmio" as="label"><input className="cp-field cw-input-xl" data-f="prize" value={d.prize} onChange={e => patch({ prize: e.target.value })} maxLength={120} placeholder="Ex.: Caixa de som JBL" /></Field>
      ) : tf.length === 0 ? (
        <Note>Escolha os participantes no passo 3 para definir o prêmio de cada posição.</Note>
      ) : (
        <div className="cw-row">
          {tf.map(t => {
            const n = Math.max(0, Math.min(50, d.teams[t]!.winners || 0)), other: Team | null = TEAMS.find(x => x !== t && d.teams[x]) ?? null
            return (
              <div key={t} data-prize-team={t} className="cw-card" style={{ background: 'var(--secondary)', padding: 18, gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p style={{ margin: 0, flex: 1, fontSize: 14.5, fontWeight: 900, color: 'var(--foreground)' }}>Time {t} <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted-foreground)' }}>· {n} {n === 1 ? 'prêmio' : 'prêmios'}</span></p>
                  {other && <Btn size="sm" data-copy-prizes={`${other}-${t}`} onClick={() => copyPrizes(other, t)}>Copiar do {other}</Btn>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 32, textAlign: 'center', fontSize: i < 3 ? 21 : 13, fontWeight: 800, color: 'var(--muted-foreground)', flex: 'none' }}>{i < 3 ? MED[i] : `${i + 1}º`}</span>
                      <input className="cp-field" data-prize-pos={`${t}-${i + 1}`} value={d.prizes[t]?.[i] ?? ''} onChange={e => setPrize(t, i, e.target.value)} maxLength={120} placeholder={`Prêmio do ${i + 1}º lugar`} />
                    </div>
                  ))}
                  {n === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>Defina quantos serão premiados no passo 3.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )

  const sumRows: [string, React.ReactNode, number][] = [
    ['NOME', <>{d.emoji} {d.name.trim() || <em style={{ opacity: .6 }}>sem nome</em>}{d.subtitle.trim() ? <span style={{ display: 'block', fontWeight: 500, fontSize: 12, color: 'var(--muted-foreground)' }}>{d.subtitle.trim()}</span> : null}</>, 0],
    ['REGRA', <>{info.icon} {info.label}{Array.isArray(d.offer_codes) || Array.isArray(d.product_ids) ? ' · só vendas filtradas' : ''}</>, 1],
    ['PARTICIPANTES', eventOn ? <>🎪 {d.event!.name || 'Evento'} — {d.event!.closers.length} {d.event!.closers.length === 1 ? 'closer' : 'closers'} ({tf.join(' + ') || 'nenhum time'})</> : <>{tf.length ? `Time ${tf.join(' + ')}` : <em style={{ opacity: .6 }}>sem times</em>}{outN ? ` · ${outN} ${outN === 1 ? 'closer fica' : 'closers ficam'} de fora` : ''}</>, 2],
    ['PERÍODO', durationDays(d) > 0 ? <>{fmtDM(d.starts_on)}{d.starts_on !== d.ends_on ? ` a ${fmtDM(d.ends_on)}` : ''} · {durationDays(d)} {durationDays(d) === 1 ? 'dia' : 'dias'}</> : <em style={{ opacity: .6 }}>sem datas</em>, 3],
    ['PRÊMIO', <>🎁 {prizeTxt}</>, 4],
  ]
  const stepReview = (
    <>
      <div className="cw-sum" data-summary>
        {sumRows.map(([k, v, to]) => (
          <div key={k} className="cw-sum-r"><span className="cw-sum-k">{k}</span><span className="cw-sum-v">{v}</span><button type="button" className="cw-sum-e" onClick={() => goStep(to)}>Editar</button></div>
        ))}
      </div>
      <Card title="🔔 Avisos" hint={eventOn ? `Só os ${d.event!.closers.length} ${d.event!.closers.length === 1 ? 'closer do evento recebe' : 'closers do evento recebem'} os avisos desta campanha — ninguém mais.` : outN ? `Só quem participa recebe os avisos desta campanha — os ${outN} ${outN === 1 ? 'closer' : 'closers'} que ficaram de fora não são avisados. Pode marcar as duas caixinhas — ou só uma.` : 'Escolha quando o time deve ser avisado. Pode marcar as duas caixinhas — ou só uma.'}>
        <label className="cw-toggle">
          <input data-f="notify" type="checkbox" checked={d.notify} onChange={e => patch({ notify: e.target.checked })} />
          <span><strong>🔔 Notificar criação</strong><span>Quando a campanha é publicada, {eventOn ? 'os closers do evento já recebem' : outN ? 'quem participa já recebe' : 'todo o time já recebe'} o aviso de que tem campanha rolando, com a premiação e as regras (e de novo no 1º dia, se ela começar depois).</span></span>
        </label>
        <label className="cw-toggle">
          <input data-f="notify_result" type="checkbox" checked={d.notify_result} onChange={e => patch({ notify_result: e.target.checked })} />
          <span><strong>🏆 Notificar resultado</strong><span>Cada closer é avisado do resultado: nas corridas e faixas, na hora em que alguém bate a meta; nas demais, quando a campanha finaliza.</span></span>
        </label>
      </Card>
      <div className="cw-adv">
        <button type="button" onClick={() => setAdv(a => !a)} data-adv-toggle aria-expanded={adv}>
          <span style={{ fontSize: 17 }}>⚙️</span><span style={{ flex: 1 }}>Opções avançadas <small>· recorrência e verticais</small></span>
          <ChevronDown size={16} style={{ transform: adv ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--muted-foreground)' }} />
        </button>
        {adv && (
          <div className="cw-adv-b">
            <label className="cw-toggle">
              <input data-f="recurring" type="checkbox" checked={d.count_recurring} onChange={e => patch({ count_recurring: e.target.checked })} />
              <span><strong>Contar parcelas de recorrência</strong><span>Desligado (padrão): só venda nova conta. Ligado: a mensalidade de assinatura também soma.</span></span>
            </label>
            <Field label="Só vendas dessas verticais (vazio = todas)">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {VERTICALS.map(v => <button key={v.id} type="button" className="cp-opt" aria-pressed={!!d.verticals?.includes(v.id)} data-vert={v.id} onClick={() => toggleVert(v.id)} style={{ height: 40, padding: '0 18px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>{v.label}</button>)}
              </div>
            </Field>
          </div>
        )}
      </div>
      {editingLive && (notified.notifications > 0 || ruleChanged) && (
        <div data-edit-effects style={{ padding: '18px 20px', borderRadius: 18, background: ruleChanged && hasOutcome ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.1)', border: `1px solid ${ruleChanged && hasOutcome ? 'rgba(239,68,68,.35)' : 'rgba(245,158,11,.4)'}`, fontSize: 13, lineHeight: 1.6, color: 'var(--foreground)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>O que acontece ao salvar</p>
          {notified.notifications > 0 && <p data-effect="avisos" style={{ margin: 0 }}>🔔 {notified.notifications === 1 ? <>O <strong>aviso</strong> que esta campanha já enviou</> : <>Os <strong>{notified.notifications} avisos</strong> que esta campanha já enviou</>} ({notified.deliveries} entrega{notified.deliveries > 1 ? 's' : ''}) {notified.notifications === 1 ? 'será' : 'serão'} <strong>{notified.notifications === 1 ? 'atualizado' : 'atualizados'}</strong> com o texto novo. Quem já leu continua tendo lido.</p>}
          {ruleChanged && hasOutcome && <p data-effect="regra" style={{ margin: 0, color: '#dc2626', fontWeight: 700 }}>⚠ Você mudou a REGRA: os ganhadores e os avisos de resultado já enviados serão <strong>apagados e refeitos</strong> com a regra nova.</p>}
          {ruleChanged && !hasOutcome && <p data-effect="regra" style={{ margin: 0 }}>↻ Você mudou a regra: o ranking será recalculado.</p>}
        </div>
      )}
    </>
  )
  const stepBodies = [stepIdentity, stepRule, stepWho, stepDates, stepPrize, stepReview]

  return (
    <div data-builder className="cw-overlay" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar campanha' : 'Nova campanha'}>
      <CampaignStyles /><BuilderStyles />
      <motion.div className="cw-modal" style={{ '--cw-a': theme.from, '--cw-b': theme.to } as React.CSSProperties} initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22 }}>

        {/* ── TOPO: o que está sendo criado + progresso ── */}
        <header className="cw-head">
          <span className="cw-logo" aria-hidden>{d.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <h2 className="cw-title">{d.name.trim() || (editingId ? 'Editar campanha' : 'Nova campanha')}</h2>
            <p className="cw-sub">{editingId ? 'Editando campanha' : 'Nova campanha'}{eventOn ? ' · 🎪 evento' : ''} · cada escolha já aparece na prévia</p>
          </div>
          <div className="cw-prog" aria-label="Progresso">
            <div className="cw-prog-bar"><i style={{ width: `${(doneCount / LAST) * 100}%` }} /></div>
            <b>{doneCount} de {LAST} prontos</b>
          </div>
          <button type="button" className="cp-ib" onClick={onClose} aria-label="Fechar"><X size={17} /></button>
        </header>

        {/* ── CORPO: passos | passo atual | prévia ── */}
        <div className="cw-body">
          <nav className="cw-rail" aria-label="Passos da campanha">
            {STEPS.map((s, i) => (
              <button key={s.t} type="button" className="cw-rs" data-step-nav={i + 1} data-done={shownDone[i] ? '1' : '0'} aria-current={step === i ? 'step' : undefined} onClick={() => goStep(i)}>
                <span className="cw-rs-n">{shownDone[i] && step !== i ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
                <span style={{ minWidth: 0 }}><span className="cw-rs-t">{s.t}</span><span className="cw-rs-v">{summaries[i]}</span></span>
              </button>
            ))}
            <p className="cw-rail-foot">Pode pular entre os passos quando quiser — nada se perde. “Rascunho” salva mesmo incompleto.</p>
          </nav>

          <main className="cw-main" ref={mainRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} className="cw-step" data-step={step + 1} data-done={done[step] ? '1' : '0'} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                <header>
                  <p className="cw-eyebrow">PASSO {step + 1} DE {STEPS.length} · {STEPS[step].eyebrow}</p>
                  <h2 className="cw-h">{STEPS[step].h}</h2>
                  <p className="cw-lead">{STEPS[step].lead}</p>
                </header>
                {stepBodies[step]}
              </motion.div>
            </AnimatePresence>
          </main>

          <aside className="cw-aside" aria-label="Prévia" data-open={prevOpen ? '1' : '0'}>
            <div className="cw-aside-h"><b>PRÉVIA</b><span><i />atualiza ao vivo</span></div>
            <CampaignPreview d={d} today={today} eligible={eligible} live={live} liveLoading={liveLoading} />
          </aside>
        </div>

        {/* ── RODAPÉ: o que falta + navegação ── */}
        <footer className="cw-foot">
          <div data-errors className="cw-hint" style={{ color: hintColor, fontWeight: hint.tone === 'ok' || hint.tone === 'bad' ? 700 : 600 }}>{hint.text}</div>
          <div className="cw-foot-a">
            <Btn variant="ghost" className="cb-cancel cw-long" onClick={onClose}>Cancelar</Btn>
            <Btn className="cw-prev-fab" aria-label="Ver prévia" onClick={() => setPrevOpen(o => !o)}><Eye size={15} />Prévia</Btn>
            <Btn data-save-draft variant={savePrimary ? 'primary' : 'secondary'} className={savePrimary ? 'cw-go' : ''} onClick={() => submit(false)} disabled={saving !== null || saveErrors.length > 0}><Save size={15} />{saving === 'draft' ? <span>Salvando…</span> : editingId ? (editingLive && notified.notifications > 0 ? <span>Salvar<span className="cw-long"> e atualizar avisos</span></span> : <span>Salvar<span className="cw-long"> alterações</span></span>) : <span>Salvar<span className="cw-long"> rascunho</span></span>}</Btn>
            {step > 0 && <Btn data-step-back onClick={() => goStep(step - 1)}><ArrowLeft size={15} />Voltar</Btn>}
            {step < LAST
              ? <Btn variant="primary" className="cw-go" data-step-next onClick={() => goStep(step + 1)}>Próximo<ArrowRight size={15} /></Btn>
              : status === 'draft' && <Btn variant="primary" className="cw-go" data-publish onClick={() => submit(true)} disabled={saving !== null || errors.length > 0}><Rocket size={15} /><span>{saving === 'publish' ? 'Publicando…' : <>Publicar{d.notify && <span className="cw-long"> e avisar a equipe</span>}</>}</span></Btn>}
          </div>
        </footer>
      </motion.div>
    </div>
  )
}
