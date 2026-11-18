'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Minus, Plus, Rocket, Save, X } from 'lucide-react'
import { CampaignDraft, CRITERIA, criterionInfo, EMOJIS, Team, TEAMS, TEAM_HINT, THEMES, ThemeId } from '@/lib/campaigns/types'
import { addDays, durationDays, fmtDM, ruleSignature, validateDraft, weekdayOf } from '@/lib/campaigns/engine'
import { CampaignPreview, PreviewData } from './CampaignPreview'
import { TierEditor } from './TierEditor'
import { tiersValid } from '@/lib/campaigns/tiers'
import type { TeamRule } from '@/lib/campaigns/types'
import { Btn, CampaignStyles } from './ui'
import { MAX_OFFER_CODES, MAX_PRODUCT_IDS, offerKey, parseOfferCodes } from '@/lib/telao/offer'

// ══ Criador de campanhas ═════════════════════════════════════════════════════
// Janela com TOPO fixo (título + progresso), CORPO com duas áreas que rolam separadas (formulário e prévia)
// e RODAPÉ fixo (o que o botão vai fazer + ações). Cada escolha já aparece na prévia, na hora.
// "Rascunho" salva incompleto; "Publicar" exige tudo e avisa a equipe.

const VERTICALS = [{ id: 'anestreview', label: 'Anest' }, { id: 'oftreview', label: 'Oft' }, { id: 'ortopreview', label: 'Ortop' }, { id: 'medreview', label: 'R1' }]
const STEP_NAMES = ['Nome', 'Regra', 'Times', 'Datas', 'Prêmio']

function Section({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done: boolean; children: React.ReactNode }) {
  return (
    <section data-step={n} data-done={done ? '1' : '0'} className="cb-sec">
      <header className="cb-sec-head">
        <span className="cb-badge">{done ? <Check size={15} strokeWidth={3} /> : n}</span>
        <div><h3>{title}</h3>{hint && <p>{hint}</p>}</div>
      </header>
      <div className="cb-sec-body">{children}</div>
    </section>
  )
}
/** Rótulo + controle, com respiro fixo entre os dois. `as="label"` quando é um campo só (clicar no rótulo foca o campo). */
function Field({ label, hint, as = 'div', children }: { label: string; hint?: React.ReactNode; as?: 'div' | 'label'; children: React.ReactNode }) {
  const Tag = as as any
  return (
    <Tag className="cb-field">
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}><span className="cb-label">{label}</span>{hint && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{hint}</span>}</span>
      {children}
    </Tag>
  )
}
const Note = ({ children, tone = 'info', ...rest }: { children: React.ReactNode; tone?: 'info' | 'warn' } & React.HTMLAttributes<HTMLParagraphElement>) => (
  <p {...rest} style={{ margin: 0, padding: '12px 14px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, background: tone === 'warn' ? 'rgba(245,158,11,.1)' : 'var(--secondary)', border: `1px solid ${tone === 'warn' ? 'rgba(245,158,11,.38)' : 'var(--border)'}`, color: tone === 'warn' ? '#b45309' : 'var(--muted-foreground)', fontWeight: tone === 'warn' ? 700 : 500 }}>{children}</p>
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
  const sig = JSON.stringify([d.criterion, d.teams, d.starts_on, d.ends_on, d.count_recurring, d.verticals, d.offer_codes, d.product_ids, d.filter_logic])
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
    const keep = (t: Team) => d.teams[t] ?? { winners: t === 'R1' ? 4 : 3, target: null, ...(info.tiers ? { tiers: [{ target: null, prize: '' }] } : {}) }
    patch({ teams: mode === 'BOTH' ? { OAO: keep('OAO'), R1: keep('R1') } : { [mode]: keep(mode) } })
  }
  const mode: 'OAO' | 'R1' | 'BOTH' | null = d.teams.OAO && d.teams.R1 ? 'BOTH' : d.teams.OAO ? 'OAO' : d.teams.R1 ? 'R1' : null
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
      onSaved(publish ? (d.notify ? 'Campanha publicada e equipe avisada! 🚀' : 'Campanha publicada! 🚀') : editingId ? `Campanha atualizada ✅${extra ? ` · ${extra}` : ''}` : 'Rascunho salvo.')
    } catch { setServerErr('Sem conexão. Tente de novo.') } finally { setSaving(null) }
  }

  const presets = datePresets(today), past = d.starts_on && d.starts_on < today && durationDays(d) > 0
  const mainRef = useRef<HTMLElement>(null)
  const tf = TEAMS.filter(t => d.teams[t])
  // cada passo "fica verde" quando está completo
  const done = [
    d.name.trim().length > 0 && d.name.trim().length <= 60,
    true,
    info.tiers ? (tf.length > 0 && tf.every(t => tiersValid(d.teams[t]!.tiers))) : tf.length > 0 && tf.every(t => { const r = d.teams[t]!; return Number.isInteger(r.winners) && r.winners >= 1 && r.winners <= 50 && (!info.needsTarget || (r.target ?? 0) > 0) }),
    durationDays(d) > 0 && durationDays(d) <= 92,
    d.prize_mode === 'tiered'
      ? tf.length > 0 && tf.every(t => { const n = d.teams[t]!.winners || 0; return n >= 1 && Array.from({ length: Math.min(n, 50) }, (_, i) => (d.prizes[t]?.[i] ?? '').trim()).every(Boolean) })
      : d.prize.trim().length > 0,
  ]
  if (info.tiers) done[4] = done[2]
  const go = (n: number) => mainRef.current?.querySelector(`[data-step="${n}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev } }, [])   // o fundo não rola atrás da janela
  // Editar vale pra QUALQUER campanha. O que a edição faz com os avisos já enviados é mostrado antes de salvar:
  const editingLive = !!editingId && status === 'published'
  const ruleChanged = editingLive && ruleSignature(initial) !== ruleSignature(d)

  const footMsg = serverErr ? `⛔ ${serverErr}` : null
  return (
    <div data-builder className="cb-overlay" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar campanha' : 'Nova campanha'}>
      <CampaignStyles />
      <motion.div className="cb-modal" initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22 }}>

        {/* ── TOPO fixo: título + progresso ── */}
        <header className="cb-head">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.02em' }}>{editingId ? 'Editar campanha' : 'Nova campanha'}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--muted-foreground)' }}>Cada escolha já aparece na prévia.</p>
          </div>
          <nav className="cb-steps" aria-label="Progresso do cadastro">
            {STEP_NAMES.map((name, i) => (
              <button key={name} type="button" className="cb-step" data-step-nav={i + 1} data-done={done[i] ? '1' : '0'} onClick={() => go(i + 1)} title={`Ir para: ${name}`}>
                <i>{done[i] ? <Check size={12} strokeWidth={3.5} /> : i + 1}</i><span>{name}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="cp-ib" onClick={onClose} aria-label="Fechar"><X size={17} /></button>
        </header>

        {/* ── CORPO: formulário (rola) | prévia (rola separada) ── */}
        <div className="cb-body">
          <main className="cb-main" ref={mainRef}>

            <Section n={1} title="Nome e visual" hint="O nome vira o título da campanha, em destaque." done={done[0]}>
              <Field label="Nome da campanha" hint={`${d.name.length}/60`} as="label">
                <input className="cp-field" data-f="name" value={d.name} onChange={e => patch({ name: e.target.value })} maxLength={60} placeholder="Ex.: Corridinha" />
              </Field>
              <Field label="Descrição curta (opcional)" as="label">
                <input className="cp-field" data-f="subtitle" value={d.subtitle} onChange={e => patch({ subtitle: e.target.value })} maxLength={140} placeholder="Ex.: Quem vender mais leva o prêmio da semana" />
              </Field>
              <div className="cb-divider" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 28 }}>
                <Field label="Ícone">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,44px)', gap: 8 }}>
                    {EMOJIS.map(e => <button key={e} type="button" className="cp-opt" aria-pressed={d.emoji === e} data-emoji={e} onClick={() => patch({ emoji: e })} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 21, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{e}</button>)}
                  </div>
                </Field>
                <Field label="Cor">
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {(Object.keys(THEMES) as ThemeId[]).map(k => (
                      <button key={k} type="button" data-theme={k} aria-label={THEMES[k].label} aria-pressed={d.theme === k} title={THEMES[k].label} onClick={() => patch({ theme: k })}
                        style={{ width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${THEMES[k].from},${THEMES[k].to})`, boxShadow: d.theme === k ? '0 0 0 3px var(--card), 0 0 0 5px var(--foreground)' : '0 1px 3px rgba(0,0,0,.2)', transition: 'box-shadow .15s' }} />
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            <Section n={2} title="Como se ganha?" hint="O critério que decide os ganhadores." done={done[1]}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
                {CRITERIA.map(c => (
                  <button key={c.id} type="button" className="cp-opt" aria-pressed={d.criterion === c.id} data-criterion={c.id} onClick={() => patch(c.id === 'tier_revenue' ? { criterion: c.id, teams: Object.fromEntries(TEAMS.filter(t => d.teams[t]).map(t => [t, { ...d.teams[t]!, tiers: d.teams[t]!.tiers?.length ? d.teams[t]!.tiers : [{ target: null, prize: '' }] }])) as CampaignDraft['teams'] } : { criterion: c.id })} style={{ padding: 16, minHeight: 100 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9, paddingRight: 22, fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}><span style={{ fontSize: 19 }}>{c.icon}</span>{c.label}</span>
                    <span style={{ display: 'block', marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>{c.desc}</span>
                    {d.criterion === c.id && <span style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} strokeWidth={3.5} /></span>}
                  </button>
                ))}
              </div>
              <div data-offer-block style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="cb-check">
                  <input data-f="offer-on" type="checkbox" checked={offersOn} onChange={e => { setOfferText(''); setOfferMsg(null); patch({ offer_codes: e.target.checked ? [] : null }) }} />
                  <span><strong>🏷️ Só vendas de ofertas específicas</strong><span>Cada produto da Hotmart tem várias ofertas, e cada oferta tem um código. Ligando isto, só entram na conta as vendas das ofertas que você informar — vale para o critério escolhido acima (receita, quantidade, primeiro a bater…).</span></span>
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
              <div data-product-block style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="cb-check">
                  <input data-f="product-on" type="checkbox" checked={productsOn} onChange={e => { setProductText(''); setProductMsg(null); patch({ product_ids: e.target.checked ? [] : null }) }} />
                  <span><strong>🧩 Só vendas de produtos específicos (ID do produto)</strong><span>Cada produto da Hotmart tem um ID numérico (ex.: 2366290). Ligando isto, só entram na conta as vendas dos produtos que você informar. Se ligar também as ofertas, você escolhe se vale produto E oferta ou produto OU oferta.</span></span>
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
                <div data-logic-block role="group" aria-label="Condição entre produto e oferta" style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            </Section>

            <Section n={3} title="Quem participa e quantos ganham?" hint="Cada time é apurado separado — o ticket maior do OAO não passa na frente do R1." done={done[2]}>
              <Field label="Quais times participam?">
                <div className="cp-seg" role="group">
                  {([['OAO', `Time OAO · ${eligible.OAO} pessoas`], ['R1', `Time R1 · ${eligible.R1} pessoas`], ['BOTH', 'Os dois times']] as const).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={mode === id} data-teams={id} onClick={() => setTeams(id)}>{label}</button>
                  ))}
                </div>
              </Field>
              {mode && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
                  {TEAMS.filter(t => d.teams[t]).map(t => {
                    const r = d.teams[t]!
                    return (
                      <div key={t} data-rule={t} className="cb-card-in">
                        <div>
                          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: 'var(--foreground)' }}>Time {t}</p>
                          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{TEAM_HINT[t]}</p>
                        </div>
                        {info.tiers && <TierEditor team={t} tiers={r.tiers ?? [{ target: null, prize: '' }]} copyFrom={TEAMS.filter(x => x !== t && d.teams[x] && d.teams[x]!.tiers?.length).map(x => ({ team: x, tiers: d.teams[x]!.tiers! }))[0] ?? null} onChange={tiers => setRule(t, { tiers, winners: Math.max(1, tiers.length) })} />}
                        <div style={info.tiers ? { display: 'none' } : undefined}><Field label="Quantos serão premiados?">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="cp-ib" aria-label="menos" disabled={r.winners <= 1} onClick={() => setRule(t, { winners: Math.max(1, r.winners - 1) })} style={{ width: 44, height: 44 }}><Minus size={15} /></button>
                            <input className="cp-field" data-winners={t} type="number" min={1} max={50} value={r.winners || ''} onChange={e => setRule(t, { winners: Math.trunc(Number(e.target.value)) })} style={{ width: 84, textAlign: 'center', fontWeight: 800, fontSize: 16 }} />
                            <button type="button" className="cp-ib" aria-label="mais" disabled={r.winners >= 50} onClick={() => setRule(t, { winners: Math.min(50, (r.winners || 0) + 1) })} style={{ width: 44, height: 44 }}><Plus size={15} /></button>
                            <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginLeft: 4 }}>{r.winners === 1 ? 'só o 1º lugar' : `do 1º ao ${r.winners || '—'}º`}</span>
                          </div>
                        </Field></div>
                        {info.needsTarget && (
                          <Field label={info.unit === 'money' ? 'Valor a bater (R$)' : 'Vendas a bater'} as="label">
                            <input className="cp-field" data-target={t} type="number" min={1} value={r.target ?? ''} onChange={e => setRule(t, { target: e.target.value === '' ? null : Number(e.target.value) })} placeholder={info.unit === 'money' ? 'Ex.: 50000' : 'Ex.: 10'} />
                          </Field>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

            <Section n={4} title="Quando?" hint="Início e fim contam como dias inteiros (horário de São Paulo)." done={done[3]}>
              <Field label="Atalhos">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {presets.map(p => <button key={p.id} type="button" className="cp-opt" aria-pressed={d.starts_on === p.start && d.ends_on === p.end} data-preset={p.id} onClick={() => patch({ starts_on: p.start, ends_on: p.end })} style={{ height: 38, padding: '0 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700 }}>{p.label}</button>)}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
                <Field label="Início" as="label"><input className="cp-field" data-f="starts_on" type="date" value={d.starts_on} onChange={e => { const v = e.target.value; patch({ starts_on: v, ends_on: d.ends_on < v ? v : d.ends_on }) }} /></Field>
                <Field label="Fim" as="label"><input className="cp-field" data-f="ends_on" type="date" value={d.ends_on} min={d.starts_on} onChange={e => patch({ ends_on: e.target.value })} /></Field>
              </div>
              <Note data-duration>{durationDays(d) > 0 ? <>Duração: <strong style={{ color: 'var(--foreground)' }}>{durationDays(d)} {durationDays(d) === 1 ? 'dia' : 'dias'}</strong> ({fmtDM(d.starts_on)}{d.starts_on !== d.ends_on ? ` a ${fmtDM(d.ends_on)}` : ''}). Para as outras semanas, crie (ou duplique) uma campanha para cada.</> : 'Informe as datas.'}</Note>
              {past && <Note tone="warn" data-past>⚠ O início é no passado: a campanha será apurada com as vendas que já aconteceram.</Note>}
            </Section>

            {info.tiers ? <Section n={5} title="Qual é o prêmio?" hint="Cada faixa já tem o seu prêmio." done={done[4]}><Note>Os prêmios foram definidos junto de cada faixa, no passo 3: quem atinge uma faixa ganha o prêmio dela (a mais alta que alcançar).</Note></Section> : <Section n={5} title="Qual é o prêmio?" hint="Um prêmio só pra todos os ganhadores, ou um diferente para cada posição." done={done[4]}>
              <div>
                <div className="cp-seg" role="group">
                  {([['single', '🎁 Premiação única'], ['tiered', '🏅 Premiação diferenciada']] as const).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={d.prize_mode === id} data-prize-mode={id} onClick={() => patch({ prize_mode: id })}>{label}</button>
                  ))}
                </div>
              </div>
              {d.prize_mode !== 'tiered' ? (
                <Field label="Prêmio" as="label"><input className="cp-field" data-f="prize" value={d.prize} onChange={e => patch({ prize: e.target.value })} maxLength={120} placeholder="Ex.: Caixa de som JBL" /></Field>
              ) : TEAMS.every(t => !d.teams[t]) ? (
                <Note>Escolha os times no passo 3 para definir o prêmio de cada posição.</Note>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16 }}>
                  {TEAMS.filter(t => d.teams[t]).map(t => {
                    const n = Math.max(0, Math.min(50, d.teams[t]!.winners || 0)), other: Team | null = TEAMS.find(x => x !== t && d.teams[x]) ?? null
                    return (
                      <div key={t} data-prize-team={t} className="cb-card-in">
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
            </Section>}

            <section className="cb-sec" style={{ padding: 0 }}>
              <button type="button" onClick={() => setAdv(a => !a)} data-adv-toggle aria-expanded={adv} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '20px 26px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--foreground)', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 17 }}>⚙️</span><span style={{ flex: 1 }}>Opções avançadas <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--muted-foreground)' }}>· recorrência, verticais e avisos</span></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' }}>{adv ? 'ocultar' : 'mostrar'}<ChevronDown size={16} style={{ transform: adv ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /></span>
              </button>
              {adv && (
                <div style={{ padding: '4px 26px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <label className="cb-check">
                    <input data-f="recurring" type="checkbox" checked={d.count_recurring} onChange={e => patch({ count_recurring: e.target.checked })} />
                    <span><strong>Contar parcelas de recorrência</strong><span>Desligado (padrão): só venda nova conta. Ligado: a mensalidade de assinatura também soma.</span></span>
                  </label>
                  <Field label="Só vendas dessas verticais (vazio = todas)">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {VERTICALS.map(v => <button key={v.id} type="button" className="cp-opt" aria-pressed={!!d.verticals?.includes(v.id)} data-vert={v.id} onClick={() => toggleVert(v.id)} style={{ height: 38, padding: '0 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700 }}>{v.label}</button>)}
                    </div>
                  </Field>
                  <label className="cb-check">
                    <input data-f="notify" type="checkbox" checked={d.notify} onChange={e => patch({ notify: e.target.checked })} />
                    <span><strong>Avisar os participantes</strong><span>Notificação no lançamento, no 1º dia, quando alguém bate a meta e no resultado.</span></span>
                  </label>
                </div>
              )}
            </section>

            {editingLive && (notified.notifications > 0 || ruleChanged) && (
              <div data-edit-effects style={{ padding: '18px 20px', borderRadius: 18, background: ruleChanged && hasOutcome ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.1)', border: `1px solid ${ruleChanged && hasOutcome ? 'rgba(239,68,68,.35)' : 'rgba(245,158,11,.4)'}`, fontSize: 13, lineHeight: 1.6, color: 'var(--foreground)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>O que acontece ao salvar</p>
                {notified.notifications > 0 && <p data-effect="avisos" style={{ margin: 0 }}>🔔 {notified.notifications === 1 ? <>O <strong>aviso</strong> que esta campanha já enviou</> : <>Os <strong>{notified.notifications} avisos</strong> que esta campanha já enviou</>} ({notified.deliveries} entrega{notified.deliveries > 1 ? 's' : ''}) {notified.notifications === 1 ? 'será' : 'serão'} <strong>{notified.notifications === 1 ? 'atualizado' : 'atualizados'}</strong> com o texto novo. Quem já leu continua tendo lido.</p>}
                {ruleChanged && hasOutcome && <p data-effect="regra" style={{ margin: 0, color: '#dc2626', fontWeight: 700 }}>⚠ Você mudou a REGRA: os ganhadores e os avisos de resultado já enviados serão <strong>apagados e refeitos</strong> com a regra nova.</p>}
                {ruleChanged && !hasOutcome && <p data-effect="regra" style={{ margin: 0 }}>↻ Você mudou a regra: o ranking será recalculado.</p>}
              </div>
            )}
          </main>

          <aside className="cb-aside" aria-label="Prévia">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="cb-sub">PRÉVIA</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>atualiza ao vivo</span>
            </div>
            <CampaignPreview d={d} today={today} eligible={eligible} live={live} liveLoading={liveLoading} />
          </aside>
        </div>

        {/* ── RODAPÉ fixo: o que o botão vai fazer + ações ── */}
        <footer className="cb-foot">
          <div data-errors style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: serverErr ? '#ef4444' : '#d97706' }}>
            {footMsg ?? (editingLive ? (
              // editando uma campanha que já foi publicada: a barra fixa diz o que o botão vai fazer (sempre visível)
              errors.length > 0 ? <>Para salvar falta: {errors.slice(0, 2).join(' ')}{errors.length > 2 ? ` (+${errors.length - 2})` : ''}</>
              : ruleChanged && hasOutcome ? <span data-footer-effect="refaz" style={{ color: '#dc2626', fontWeight: 800 }}>⚠ Salvar vai APAGAR e REFAZER os ganhadores e os avisos de resultado já enviados.</span>
              : notified.notifications > 0 ? <span data-footer-effect="avisos" style={{ fontWeight: 700 }}>🔔 Salvar vai atualizar {notified.notifications === 1 ? 'o aviso já enviado' : `os ${notified.notifications} avisos já enviados`}.</span>
              : <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Tudo certo para salvar.</span>
            ) : errors.length > 0 ? <>Para publicar falta: {errors.slice(0, 2).join(' ')}{errors.length > 2 ? ` (+${errors.length - 2})` : ''}</> : <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Tudo pronto para publicar.</span>)}
          </div>
          <div className="cb-foot-actions">
            <Btn variant="ghost" className="cb-cancel" onClick={onClose}>Cancelar</Btn>
            <Btn data-save-draft onClick={() => submit(false)} disabled={saving !== null || saveErrors.length > 0}><Save size={15} />{saving === 'draft' ? <span>Salvando…</span> : editingId ? (editingLive && notified.notifications > 0 ? <span>Salvar<span className="cb-long"> e atualizar avisos</span></span> : <span>Salvar alterações</span>) : <span>Salvar rascunho</span>}</Btn>
            {status === 'draft' && <Btn variant="primary" data-publish onClick={() => submit(true)} disabled={saving !== null || errors.length > 0}><Rocket size={15} /><span>{saving === 'publish' ? 'Publicando…' : <>Publicar<span className="cb-long"> e avisar a equipe</span></>}</span></Btn>}
          </div>
        </footer>
      </motion.div>
    </div>
  )
}
