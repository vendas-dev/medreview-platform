'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BellRing, RefreshCw, ExternalLink, ChevronDown, ShieldCheck, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { buildAlerts, alertsByVertical, todaySP, VERT_STYLE, ExamAlert, AlertLevel } from '@/lib/milestones/exams/alerts'
import { PHASES, PHASE_LABEL, EXAM_VERTICALS, ExamMilestoneRow, ExamVertical } from '@/lib/milestones/exams/types'

// ── Provas de título (Anest / Oft / Ortop) ─────────────────────────────────────
// Tudo que aparece aqui vem de datas VERIFICADAS contra o documento oficial da sociedade
// (ver lib/milestones/exams/verify.ts). Sem dado verificado, a tela diz isso — nunca preenche.

interface ApiRun { ran_at: string; status: string; items_found: number; message?: string }
interface ApiSource { id: string; vertical: ExamVertical; society: string; exam_labels: string[]; name: string; url: string; last_run: ApiRun | null }
interface ApiData { today: string; items: ExamMilestoneRow[]; sources: ApiSource[]; isSuper: boolean }

const ink = (c: string) => `color-mix(in srgb, ${c} 62%, var(--foreground))`        // texto legível nos dois temas
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`

const fmtSP = (iso: string) => {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d)
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const day = `${g('day')}/${g('month')}`
  const today = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date())
  return `${day === today ? 'hoje' : day} às ${g('hour')}:${g('minute')}`
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

const RUN_CHIP: Record<string, { label: string; color: string }> = {
  ok:             { label: 'Lida ✓',               color: '#16a34a' },
  no_data:        { label: 'Sem datas publicadas', color: '#64748b' },
  blocked_robots: { label: 'Bloqueada pelo site',  color: '#d97706' },
  fetch_error:    { label: 'Falha ao abrir',       color: '#dc2626' },
  extract_error:  { label: 'IA indisponível',      color: '#dc2626' },
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', padding: '3px 8px', borderRadius: 7, background: tint(color, 18), color: ink(color), border: `1px solid ${tint(color, 40)}`, whiteSpace: 'nowrap' }}>{children}</span>
}

function CountPill({ level, color, children }: { level: AlertLevel; color: string; children: React.ReactNode }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }
  if (level === 'urgent') return <span className="exa-pulse" style={{ ...base, background: 'var(--foreground)', color: 'var(--card)' }}><BellRing size={11} />{children}</span>
  if (level === 'soon') return <span style={{ ...base, background: tint(color, 22), color: ink(color), border: `1px solid ${tint(color, 45)}` }}>{children}</span>
  if (level === 'past') return <span style={{ ...base, color: 'var(--muted-foreground)', fontWeight: 600 }}>{children}</span>
  return <span style={{ ...base, border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{children}</span>
}

const MAX_STRIPS = 6

// Uma data = uma faixa fina. A cor da vertical está na lateral, no fundo e na tag.
function Strip({ a, idx }: { a: ExamAlert; idx: number }) {
  const c = VERT_STYLE[a.vertical].color
  const hostName = host(a.source_url)
  const info = a.origin === 'manual'
    ? `Cadastro manual${a.created_by_name ? ` · ${a.created_by_name}` : ''} · fonte: ${hostName}`
    : `Verificado ${fmtSP(a.last_seen_at)} · fonte oficial: ${hostName}`
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: a.level === 'past' ? 0.6 : 1, x: 0 }} transition={{ delay: idx * 0.03, duration: 0.25 }}
      data-alert={a.id} data-vertical={a.vertical} data-level={a.level} title={info}
      style={{ display: 'flex', alignItems: 'center', gap: '4px 9px', flexWrap: 'wrap', boxSizing: 'border-box', minHeight: 32, padding: '4px 8px 4px 10px', borderRadius: 10, border: `1px solid ${tint(c, 30)}`, borderLeft: `4px solid ${c}`, background: tint(c, a.level === 'urgent' ? 17 : 8) }}>
      <Tag color={c}>{VERT_STYLE[a.vertical].short} · {a.exam_label}</Tag>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)' }}>{a.headline}</span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: ink(c), letterSpacing: '-0.01em' }}>{a.dateText}</span>
      {a.origin === 'manual' && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--muted-foreground)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 5px' }}>MANUAL</span>}
      {a.changed && (
        <span data-changed style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'color-mix(in srgb, #d97706 62%, var(--foreground))', background: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 6, padding: '1px 7px' }}>
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />alterada · antes {a.previousText}
        </span>
      )}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <CountPill level={a.level} color={c}>{a.countdown}</CountPill>
        <a href={a.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Fonte oficial: ${hostName}`} title={`Fonte oficial: ${hostName}`} style={{ color: 'var(--muted-foreground)', display: 'inline-flex' }}><ExternalLink size={13} /></a>
      </span>
    </motion.div>
  )
}

function emptyText(v: ExamVertical, sources: ApiSource[], isSuper: boolean): { text: string; sub?: string } {
  const mine = sources.filter(s => s.vertical === v)
  const runs = mine.map(s => s.last_run).filter(Boolean) as ApiRun[]
  const society = mine[0]?.society ?? ''
  if (!runs.length) return { text: 'Ainda não verificado.', sub: 'A primeira verificação roda no próximo ciclo diário.' }
  const last = runs.sort((a, b) => b.ran_at.localeCompare(a.ran_at))[0]
  const readOk = runs.some(r => r.status === 'ok' || r.status === 'no_data')
  if (readOk) return { text: `Nenhuma data de prova publicada pela ${society} no momento.`, sub: `Consultado ${fmtSP(last.ran_at)}` }
  if (!isSuper) return { text: 'Sem datas verificadas no momento.', sub: `Última tentativa ${fmtSP(last.ran_at)}` }
  const blocked = runs.some(r => r.status === 'blocked_robots')
  return blocked
    ? { text: `O site da ${society} bloqueia a leitura automática.`, sub: 'Cadastre as datas manualmente (abaixo), com o link do edital.' }
    : { text: `Não consegui ler o site da ${society}.`, sub: `Detalhes no diagnóstico abaixo · ${fmtSP(last.ran_at)}` }
}

// Vertical sem nenhuma data: uma linha só, pontilhada, dizendo o motivo real (nunca preenche com nada).
function EmptyStrip({ v, sources, isSuper }: { v: ExamVertical; sources: ApiSource[]; isSuper: boolean }) {
  const c = VERT_STYLE[v].color
  const labels = [...new Set(sources.filter(x => x.vertical === v).flatMap(x => x.exam_labels))].join('/')
  const e = emptyText(v, sources, isSuper)
  return (
    <div data-empty={v} style={{ display: 'flex', alignItems: 'center', gap: '4px 9px', flexWrap: 'wrap', boxSizing: 'border-box', minHeight: 28, padding: '3px 10px', borderRadius: 10, border: `1px dashed ${tint(c, 45)}`, borderLeft: `4px solid ${tint(c, 75)}`, background: tint(c, 4) }}>
      <Tag color={c}>{VERT_STYLE[v].short}{labels ? ` · ${labels}` : ''}</Tag>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{e.text}{e.sub ? ` ${e.sub}` : ''}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12.5, boxSizing: 'border-box' }

function AdminPanel({ data, onChanged, onCheck, checking }: { data: ApiData; onChanged: () => void; onCheck: (id?: string) => void; checking: string | null }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ vertical: 'ortop' as ExamVertical, exam_label: 'TEOT', phase: 'prova_teorica', starts_on: '', ends_on: '', source_url: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const manual = data.items.filter(i => i.origin === 'manual')

  const onVertical = (v: ExamVertical) => {
    const lab = data.sources.find(s => s.vertical === v)?.exam_labels[0] ?? ''
    setForm(f => ({ ...f, vertical: v, exam_label: lab }))
  }
  async function save() {
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/milestones/exams/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ends_on: form.ends_on || null }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j?.error ?? 'Não consegui salvar'); return }
      setForm(f => ({ ...f, starts_on: '', ends_on: '', note: '' })); onChanged()
    } finally { setSaving(false) }
  }
  async function del(id: string) {
    if (!confirm('Apagar este cadastro manual?')) return
    await fetch(`/api/milestones/exams/manual?id=${id}`, { method: 'DELETE' }); onChanged()
  }
  const lab: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} data-admin-toggle style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--foreground)' }}>
        <ShieldCheck size={15} style={{ color: 'var(--muted-foreground)' }} />
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>Diagnóstico das fontes e cadastro manual</span>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>só superadmin</span>
        <ChevronDown size={14} style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div data-sources style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.sources.map(s => {
                  const chip = s.last_run ? RUN_CHIP[s.last_run.status] ?? { label: s.last_run.status, color: '#64748b' } : { label: 'Nunca verificada', color: '#64748b' }
                  const c = VERT_STYLE[s.vertical].color
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'start', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border)', borderLeft: `3px solid ${c}` }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)' }}>{s.name} <span style={{ fontSize: 10.5, fontWeight: 700, color: chip.color, background: `${chip.color}1f`, borderRadius: 6, padding: '2px 7px', marginLeft: 4 }}>{chip.label}</span></p>
                        <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--muted-foreground)', wordBreak: 'break-all' }}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{s.url}</a></p>
                        {s.last_run && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>{fmtSP(s.last_run.ran_at)} · {s.last_run.items_found} data(s) confirmada(s){s.last_run.message ? ` — ${s.last_run.message}` : ''}</p>}
                      </div>
                      <button onClick={() => onCheck(s.id)} disabled={checking !== null} aria-label={`Verificar ${s.name}`} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 11, fontWeight: 700, cursor: checking ? 'wait' : 'pointer' }}>
                        {checking === s.id ? '…' : 'Verificar'}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div data-manual-form>
                <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)' }}>Cadastro manual <span style={{ fontWeight: 500, color: 'var(--muted-foreground)' }}>— use quando o site da sociedade bloqueia a leitura automática. Exige o link do edital oficial e fica marcado como "manual".</span></p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                  <div><label style={lab}>Vertical</label><select value={form.vertical} onChange={e => onVertical(e.target.value as ExamVertical)} style={inputStyle}>{EXAM_VERTICALS.map(v => <option key={v} value={v}>{VERT_STYLE[v].label}</option>)}</select></div>
                  <div><label style={lab}>Prova</label><input value={form.exam_label} onChange={e => setForm({ ...form, exam_label: e.target.value })} style={inputStyle} placeholder="TEOT" /></div>
                  <div><label style={lab}>Etapa</label><select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} style={inputStyle}>{PHASES.map(p => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}</select></div>
                  <div><label style={lab}>Data (início)</label><input type="date" value={form.starts_on} onChange={e => setForm({ ...form, starts_on: e.target.value })} style={inputStyle} /></div>
                  <div><label style={lab}>Data final (opcional)</label><input type="date" value={form.ends_on} onChange={e => setForm({ ...form, ends_on: e.target.value })} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Link do edital oficial (https)</label><input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} style={inputStyle} placeholder="https://…" /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Trecho do edital (opcional)</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle} placeholder="Copie a linha do edital que traz a data" /></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <button onClick={save} disabled={saving} style={{ height: 34, padding: '0 14px', borderRadius: 9, border: 'none', background: 'var(--foreground)', color: 'var(--card)', fontSize: 12.5, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={13} />Cadastrar data</button>
                  {err && <span role="alert" style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{err}</span>}
                </div>
                {manual.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {manual.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--foreground)' }}>
                        <Tag color={VERT_STYLE[m.vertical].color}>{m.exam_label}</Tag>
                        <span style={{ flex: 1 }}>{PHASE_LABEL[m.phase]} · {m.starts_on.split('-').reverse().join('/')}{m.ends_on ? ` a ${m.ends_on.split('-').reverse().join('/')}` : ''}</span>
                        <button onClick={() => del(m.id)} aria-label="Apagar cadastro manual" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)' }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface ExamHook {
  data: ApiData | null; error: boolean; checking: string | null; toast: string | null
  reload: () => Promise<void>; check: (sourceId?: string) => Promise<void>
}

/** Busca as datas verificadas (uma vez, atualiza a cada 5 min). `enabled=false` não faz nenhuma requisição. */
export function useExamData(enabled = true): ExamHook {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      const r = await fetch('/api/milestones/exams', { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      setData(await r.json()); setError(false)
    } catch { setError(true) }
  }, [enabled])
  useEffect(() => { if (!enabled) return; reload(); const id = setInterval(reload, 5 * 60_000); return () => clearInterval(id) }, [enabled, reload])

  const check = useCallback(async (sourceId?: string) => {
    setChecking(sourceId ?? 'all'); setToast(null)
    try {
      const r = await fetch('/api/milestones/exams/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }) })
      const j = await r.json().catch(() => ({}))
      setToast(r.ok ? `Verificação concluída · ${j.sources?.length ?? 0} fonte(s) · ${j.inserted ?? 0} nova(s) data(s), ${j.updated ?? 0} já conhecida(s)` : (j?.error ?? 'Não consegui verificar'))
      await reload()
    } catch { setToast('Não consegui verificar agora') } finally { setChecking(null) }
  }, [reload])

  return { data, error, checking, toast, reload, check }
}

/** Passe `exam` (do useExamData) pra compartilhar os dados com o calendário; sem ele, busca por conta própria. */
export function ExamAlerts({ exam }: { exam?: ExamHook }) {
  const own = useExamData(!exam)
  const { data, error, checking, toast, reload: load, check } = exam ?? own

  const alerts = useMemo(() => (data ? buildAlerts(data.items, todaySP()) : []), [data])
  const byV = useMemo(() => alertsByVertical(alerts), [alerts])
  const lastRun = useMemo(() => {
    const runs = (data?.sources ?? []).map(s => s.last_run?.ran_at).filter(Boolean) as string[]
    return runs.sort().pop() ?? null
  }, [data])
  const [open, setOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const live = alerts.filter(a => a.level !== 'past'), past = alerts.filter(a => a.level === 'past')
  const list = showAll ? alerts : [...live.slice(0, MAX_STRIPS), ...(live.length < MAX_STRIPS ? past.slice(0, 2) : [])]
  const hidden = alerts.length - list.length
  const emptyVerts = EXAM_VERTICALS.filter(v => byV[v].length === 0)

  return (
    <section aria-label="Provas de título" data-exam-alerts style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      <style>{`@keyframes exaPulse{0%,100%{box-shadow:0 0 0 0 rgba(120,120,120,.45)}50%{box-shadow:0 0 0 5px rgba(120,120,120,0)}}.exa-pulse{animation:exaPulse 2.2s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.exa-pulse{animation:none}}`}</style>

      {/* cabeçalho em UMA linha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(o => !o)} data-exam-toggle aria-expanded={open} aria-label={open ? 'Recolher provas de título' : 'Expandir provas de título'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--foreground)' }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#4f7be8,#dba21a 55%,#e67a38)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><BellRing size={14} /></span>
          <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em' }}>Provas de título</span>
          <ChevronDown size={14} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', color: 'var(--muted-foreground)' }} />
        </button>
        {data && <Tag color="#6366f1">{live.length} {live.length === 1 ? 'data' : 'datas'}</Tag>}
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>lidas dos sites oficiais · só dados verificados</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {lastRun && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Última verificação: {fmtSP(lastRun)}</span>}
          {data?.isSuper && (
            <button onClick={() => check()} disabled={checking !== null} data-check-all style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 11.5, fontWeight: 700, cursor: checking ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={12} style={checking === 'all' ? { animation: 'spin 1s linear infinite' } : undefined} />{checking === 'all' ? 'Verificando…' : 'Verificar agora'}
            </button>
          )}
        </span>
      </div>

      {toast && <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--foreground)', background: 'var(--secondary)', borderRadius: 9, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} />{toast}</p>}

      {open && (
        <>
          {!data && !error && <div style={{ height: 40, borderRadius: 10, background: 'var(--secondary)', opacity: 0.6 }} />}
          {error && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted-foreground)' }}>Não consegui carregar as provas de título agora. Tentando de novo em instantes.</p>}
          {data && (
            <div data-strips style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {list.map((a, i) => <Strip key={a.id} a={a} idx={i} />)}
              {emptyVerts.map(v => <EmptyStrip key={v} v={v} sources={data.sources} isSuper={data.isSuper} />)}
              {alerts.length > MAX_STRIPS && (
                <button onClick={() => setShowAll(x => !x)} data-show-all style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--muted-foreground)', padding: '2px 0' }}>
                  {showAll ? 'Mostrar menos' : `Ver todas (${alerts.length})${hidden > 0 ? '' : ''}`}
                </button>
              )}
            </div>
          )}
          {data?.isSuper && <AdminPanel data={data} onChanged={load} onCheck={check} checking={checking} />}
        </>
      )}
    </section>
  )
}

export default ExamAlerts
