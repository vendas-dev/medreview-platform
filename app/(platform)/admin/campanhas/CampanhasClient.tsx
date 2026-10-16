'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Eye, Pencil, Plus, RefreshCw, Rocket, Trash2, Trophy, X, Ban } from 'lucide-react'
import { CampaignDraft, CampaignRow, criterionInfo, emptyDraft, Phase, Team, TEAMS } from '@/lib/campaigns/types'
import { fmtDM, metricText, prizeFor, prizeHeadline, spDay, todaySP, winnersText, Evaluation } from '@/lib/campaigns/engine'
import { CampaignBanner } from '@/components/campaigns/CampaignPreview'
import { CampaignBuilder } from '@/components/campaigns/CampaignBuilder'
import { Btn, CampaignStyles, IconBtn } from '@/components/campaigns/ui'

type Winner = { id: string; team: Team; position: number; user_name: string; metric_value: number | null; reached_at: string | null; delivered_at: string | null; prize: string | null }
type Notified = { notifications: number; deliveries: number }
type ListItem = CampaignRow & { phase: Phase; winners: Winner[]; notified: Notified }
type BuilderState = { draft: CampaignDraft; id: string | null; status: 'draft' | 'published' | 'cancelled'; hasOutcome: boolean; notified: Notified }

const FILTERS = [['all', 'Todas'], ['active', 'Em andamento'], ['scheduled', 'Programadas'], ['ended', 'Encerradas'], ['draft', 'Rascunhos']] as const
const MEDALS = ['🥇', '🥈', '🥉']

function status(c: ListItem): { label: string; color: string } {
  if (c.status === 'draft') return { label: 'Rascunho', color: '#94a3b8' }
  if (c.status === 'cancelled') return { label: 'Cancelada', color: '#ef4444' }
  if (c.phase === 'scheduled') return { label: 'Programada', color: '#f59e0b' }
  if (c.phase === 'active') return c.finalized_at ? { label: 'Corrida encerrada', color: '#94a3b8' } : { label: 'Em andamento', color: '#22c55e' }
  return c.finalized_at ? { label: 'Encerrada', color: '#94a3b8' } : { label: 'Apurando…', color: '#6366f1' }
}

export function CampanhasClient() {
  const [list, setList] = useState<ListItem[]>([])
  const [eligible, setEligible] = useState({ OAO: 0, R1: 0 })
  const [today, setToday] = useState(todaySP())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all')
  const [builder, setBuilder] = useState<BuilderState | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const del = list.find(c => c.id === delId) ?? null
  const [detail, setDetail] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/campaigns', { cache: 'no-store' }); if (!r.ok) return
      const j = await r.json(); setList(j.campaigns ?? []); setEligible(j.eligible ?? { OAO: 0, R1: 0 }); if (j.today) setToday(j.today)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 4000); return () => clearTimeout(id) }, [toast])

  const shown = useMemo(() => list.filter(c => filter === 'all' ? true : filter === 'draft' ? c.status === 'draft' : filter === 'ended' ? (c.status === 'published' && c.phase === 'ended') || c.status === 'cancelled' : c.status === 'published' && c.phase === filter), [list, filter])
  const count = (f: string) => list.filter(c => f === 'all' ? true : f === 'draft' ? c.status === 'draft' : f === 'ended' ? (c.status === 'published' && c.phase === 'ended') || c.status === 'cancelled' : c.status === 'published' && c.phase === f).length

  const post = async (id: string, body: object, ok: string) => {
    const r = await fetch(`/api/admin/campaigns/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setToast(r.ok ? ok : `⛔ ${j?.error ?? 'Não consegui.'}`); await load(); return r.ok ? j : null
  }
  const openNew = () => setBuilder({ draft: emptyDraft(today), id: null, status: 'draft', hasOutcome: false, notified: { notifications: 0, deliveries: 0 } })
  const edit = (c: ListItem) => setBuilder({ draft: c, id: c.id, status: c.status, hasOutcome: !!c.finalized_at || c.winners.length > 0, notified: c.notified })
  const remove = async (c: ListItem) => {
    const r = await fetch(`/api/admin/campaigns/${c.id}`, { method: 'DELETE' }); const j = await r.json().catch(() => ({}))
    setDelId(null)
    setToast(r.ok ? `Campanha excluída${j?.removed?.notifications ? ` · ${j.removed.notifications} aviso${j.removed.notifications > 1 ? 's' : ''} apagado${j.removed.notifications > 1 ? 's' : ''}` : ''}.` : `⛔ ${j?.error ?? 'Não consegui excluir.'}`)
    load()
  }
  const duplicate = async (c: ListItem) => {
    const j = await post(c.id, { action: 'duplicate', shiftDays: 7 }, 'Cópia criada (+7 dias). Ajuste e publique. ✨')
    if (j?.id) { const r = await fetch('/api/admin/campaigns', { cache: 'no-store' }); const jj = await r.json(); const n = (jj.campaigns as ListItem[]).find(x => x.id === j.id); if (n) setBuilder({ draft: n, id: n.id, status: 'draft', hasOutcome: false, notified: n.notified }) }
  }

  return (
    <div style={{ padding: 'clamp(20px,3.2vw,40px)', maxWidth: 1320, margin: '0 auto' }}>
      <CampaignStyles />
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-.02em', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 12 }}><Trophy size={24} style={{ color: '#f59e0b' }} />Campanhas</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Crie premiações para os times. Cada campanha tem as próprias datas — para as outras semanas, duplique.</p>
        </div>
        <Btn variant="primary" size="lg" data-new onClick={openNew}><Plus size={16} />Nova campanha</Btn>
      </header>

      <div className="cp-tabs" role="group" aria-label="Filtrar campanhas" style={{ marginBottom: 24 }}>
        {FILTERS.map(([id, label]) => <button key={id} type="button" className="cp-tab" aria-pressed={filter === id} data-filter={id} onClick={() => setFilter(id)}>{label}{' '}<b>{count(id)}</b></button>)}
      </div>

      {loading ? <div style={{ height: 220, borderRadius: 20, background: 'var(--secondary)', opacity: 0.6 }} />
        : shown.length === 0 ? (
          <div data-empty style={{ padding: '64px 24px', textAlign: 'center', borderRadius: 20, border: '1.5px dashed var(--border)', background: 'var(--card)' }}>
            <p style={{ margin: 0, fontSize: 44 }}>🏁</p>
            <p style={{ margin: '14px 0 0', fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{list.length === 0 ? 'Nenhuma campanha ainda' : 'Nada neste filtro'}</p>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted-foreground)' }}>{list.length === 0 ? 'Crie a primeira premiação para os times.' : 'Troque o filtro acima.'}</p>
            {list.length === 0 && <div style={{ marginTop: 22 }}><Btn variant="primary" onClick={openNew}><Plus size={15} />Criar a primeira campanha</Btn></div>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(350px,1fr))', gap: 24 }}>
            {shown.map((c, i) => (
              <CampaignCard key={c.id} c={c} today={today} i={i}
                onView={() => setDetail(c.id)} onPublish={() => post(c.id, { action: 'publish' }, 'Campanha publicada e equipe avisada! 🚀')} onEdit={() => edit(c)}
                onDuplicate={() => duplicate(c)} onDelete={() => { setDelId(c.id); load() }}
                onCancel={() => confirm(`Cancelar "${c.name}"? Os participantes serão avisados.`) && post(c.id, { action: 'cancel' }, 'Campanha cancelada.')} />
            ))}
          </div>
        )}

      <AnimatePresence>{toast && <motion.div role="status" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 400, padding: '11px 18px', borderRadius: 12, background: 'var(--foreground)', color: 'var(--background)', fontSize: 13, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,.3)' }}>{toast}</motion.div>}</AnimatePresence>
      {builder && <CampaignBuilder key={builder.id ?? 'new'} initial={builder.draft} editingId={builder.id} status={builder.status} hasOutcome={builder.hasOutcome} notified={builder.notified} today={today} eligible={eligible} onClose={() => setBuilder(null)} onSaved={m => { setBuilder(null); setToast(m); load() }} />}
      {del && <ConfirmDelete c={del} onCancel={() => setDelId(null)} onConfirm={() => remove(del)} />}
      {detail && <Detail id={detail} today={today} onClose={() => setDetail(null)} onChanged={load} onDuplicate={async c => { setDetail(null); const it = list.find(x => x.id === c); if (it) await duplicate(it) }} />}
    </div>
  )
}

/** Uma linha "RÓTULO  valor" do card (organiza as informações em fileiras alinhadas). */
function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)', alignItems: 'start' }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: 'var(--muted-foreground)', paddingTop: 2 }}>{k}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>{children}</div>
    </div>
  )
}

/** O card de uma campanha: faixa colorida, situação, regra/prêmio em fileiras, ganhadores e UMA linha de ações. */
function CampaignCard({ c, today, i, onView, onPublish, onEdit, onDuplicate, onDelete, onCancel }: {
  c: ListItem; today: string; i: number; onView: () => void; onPublish: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onCancel: () => void
}) {
  const st = status(c), info = criterionInfo(c.criterion)
  const running = c.status === 'published' && !c.finalized_at
  const delivered = c.winners.filter(w => w.delivered_at).length
  return (
    <motion.article className="cp-card" data-campaign={c.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <CampaignBanner d={c} today={today} compact />
      <div style={{ padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28, marginBottom: 12 }}>
          <span data-status style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, background: `${st.color}1f`, color: st.color, fontSize: 12, fontWeight: 800 }}>
            <i style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />{st.label}
          </span>
          {running && <button type="button" className="cp-link" data-act="cancelar" onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ban size={13} />Cancelar campanha</button>}
        </div>

        <div>
          <Fact k="REGRA">
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.4 }}>{winnersText(c)}</span>
            <span data-chip="criterio" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{info.icon} {info.label}</span>
          </Fact>
          <Fact k="PRÊMIO">
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)' }}>🎁 {prizeHeadline(c) || <span style={{ opacity: 0.5, fontWeight: 500 }}>sem prêmio definido</span>}</span>
          </Fact>
          <Fact k="AVISOS">
            <span data-notified style={{ fontSize: 13, color: c.notified.notifications > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {c.notified.notifications > 0 ? <>🔔 {c.notified.notifications} aviso{c.notified.notifications > 1 ? 's' : ''} enviado{c.notified.notifications > 1 ? 's' : ''} <span style={{ color: 'var(--muted-foreground)' }}>({c.notified.deliveries} entrega{c.notified.deliveries > 1 ? 's' : ''})</span></> : c.status === 'draft' ? 'Ainda não publicada' : 'Nenhum aviso enviado'}
            </span>
          </Fact>
        </div>

        {c.winners.length > 0 && (
          <div style={{ marginTop: 6, padding: '14px 16px', borderRadius: 14, background: 'var(--secondary)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div data-winners-line style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TEAMS.filter(t => c.teams[t]).map(t => (
                <p key={t} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--foreground)' }}><strong>{t}:</strong>{' '}{c.winners.filter(w => w.team === t).map(w => `${MEDALS[w.position - 1] ?? `${w.position}º`} ${w.user_name.split(' ')[0]}`).join(' ') || '—'}</p>
              ))}
            </div>
            {c.finalized_at && (
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--muted-foreground)', fontWeight: 600 }}>Prêmio entregue: {delivered}/{c.winners.length}</p>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(delivered / c.winners.length) * 100}%`, background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 999 }} /></div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 20 }}>
          {c.status === 'published' ? <Btn variant="primary" data-act="ver" onClick={onView} style={{ flex: 1 }}><Eye size={16} />{c.phase === 'ended' ? 'Ganhadores' : 'Ranking'}</Btn>
            : c.status === 'draft' ? <Btn variant="primary" data-act="publicar" onClick={onPublish} style={{ flex: 1 }}><Rocket size={16} />Publicar</Btn>
            : <span style={{ flex: 1 }} />}
          <IconBtn tip="Editar" data-act="editar" onClick={onEdit}><Pencil size={16} /></IconBtn>
          <IconBtn tip="Duplicar (+7 dias)" data-act="duplicar" onClick={onDuplicate}><Copy size={16} /></IconBtn>
          <IconBtn tip="Excluir" danger end data-act="excluir" onClick={onDelete}><Trash2 size={16} /></IconBtn>
        </div>
      </div>
    </motion.article>
  )
}

function Detail({ id, today, onClose, onChanged, onDuplicate }: { id: string; today: string; onClose: () => void; onChanged: () => void; onDuplicate: (id: string) => void }) {
  const [data, setData] = useState<{ campaign: CampaignRow & { phase: Phase }; winners: Winner[]; evaluation: Evaluation; participants: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await fetch(`/api/admin/campaigns/${id}`, { cache: 'no-store' }); if (r.ok) setData(await r.json()) }, [id])
  useEffect(() => { load() }, [load])
  const act = async (body: object) => { setBusy(true); await fetch(`/api/admin/campaigns/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await load(); onChanged(); setBusy(false) }
  // marca/desmarca "entregue" NA HORA (otimista) e desfaz se o servidor recusar
  const toggleDelivered = async (w: Winner, on: boolean) => {
    const set = (v: string | null) => setData(d => d && ({ ...d, winners: d.winners.map(x => (x.id === w.id ? { ...x, delivered_at: v } : x)) }))
    set(on ? new Date().toISOString() : null)
    try {
      const r = await fetch(`/api/admin/campaigns/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delivered', winnerId: w.id, delivered: on }) })
      if (!r.ok) set(w.delivered_at)
    } catch { set(w.delivered_at) }
    onChanged()
  }
  const c = data?.campaign, info = c ? criterionInfo(c.criterion) : null
  return (
    <div data-detail style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(8,6,20,.62)', backdropFilter: 'blur(5px)', overflowY: 'auto', padding: 'clamp(10px,2vw,28px)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 860, margin: '0 auto', borderRadius: 22, overflow: 'hidden', background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,.4)' }}>
        {!data || !c || !info ? <div style={{ height: 200 }} /> : (<>
          <div style={{ position: 'relative' }}>
            <CampaignBanner d={c} today={today} />
            <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,.35)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
          </div>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground)' }}>🎁 <strong>{prizeHeadline(c)}</strong> · {winnersText(c)} · {data.participants} {data.participants === 1 ? 'pessoa concorre' : 'pessoas concorrem'}</p>

            {data.winners.length > 0 && (
              <div data-winners>
                <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>🏆 GANHADORES</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {TEAMS.filter(t => c.teams[t]).map(t => (
                    <div key={t} style={{ flex: 1, minWidth: 250, padding: 12, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 900, color: 'var(--foreground)' }}>Time {t}</p>
                      {data.winners.filter(w => w.team === t).map(w => (
                        <label key={w.id} data-winner={w.user_name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12.5, color: 'var(--foreground)', cursor: 'pointer' }}>
                          <span style={{ width: 22 }}>{MEDALS[w.position - 1] ?? `${w.position}º`}</span>
                          <span style={{ flex: 1, fontWeight: 700 }}>{w.user_name}{w.metric_value != null && <span style={{ fontWeight: 500, color: 'var(--muted-foreground)' }}> · {metricText(c.criterion, w.metric_value)}</span>}{(w.prize || c.prize_mode === 'tiered') && <span data-winner-prize style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#d97706' }}>🎁 {w.prize || prizeFor(c, w.team, w.position) || '—'}</span>}</span>
                          <input type="checkbox" data-delivered={w.user_name} checked={!!w.delivered_at} onChange={e => toggleDelivered(w, e.target.checked)} />
                          <span style={{ fontSize: 10.5, color: w.delivered_at ? '#16a34a' : 'var(--muted-foreground)', fontWeight: 700 }}>{w.delivered_at ? 'entregue' : 'a entregar'}</span>
                        </label>
                      ))}
                      {data.winners.filter(w => w.team === t).length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>Sem ganhadores ainda.</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div data-standings>
              <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', color: 'var(--muted-foreground)' }}>📊 {data.evaluation.final ? 'CLASSIFICAÇÃO FINAL' : 'CLASSIFICAÇÃO AGORA (provisória)'}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {data.evaluation.teams.map(t => (
                  <div key={t.team} style={{ flex: 1, minWidth: 280, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
                    <p style={{ margin: 0, padding: '9px 12px', fontSize: 11.5, fontWeight: 900, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>Time {t.team} · premia até o {t.rule.winners}º</p>
                    {t.standings.map(s => (
                      <div key={s.userId} data-row={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, borderBottom: '1px solid var(--border)', background: s.rank <= t.rule.winners && (info.race ? s.qualified : s.metric > 0) ? 'rgba(34,197,94,.09)' : 'transparent', color: 'var(--foreground)' }}>
                        <span style={{ width: 24, textAlign: 'center', fontWeight: 800 }}>{s.rank <= 3 ? MEDALS[s.rank - 1] : `${s.rank}º`}</span>
                        <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}{c.prize_mode === 'tiered' && s.rank <= t.rule.winners && (info.race ? s.qualified : s.metric > 0) && <span data-row-prize style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: '#d97706' }}>🎁 {prizeFor(c, t.team, s.rank) || '—'}</span>}</span>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{s.count} {s.count === 1 ? 'venda' : 'vendas'}</span>
                        <strong style={{ minWidth: 92, textAlign: 'right' }}>{info.race ? (s.qualified ? `✅ ${fmtDM(spDay(s.reachedAt!))}` : `${Math.round(s.progress * 100)}%`) : metricText(c.criterion, s.metric)}</strong>
                      </div>
                    ))}
                    {t.standings.length === 0 && <p style={{ margin: 0, padding: 14, fontSize: 12, color: 'var(--muted-foreground)' }}>Nenhum participante neste time.</p>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.status === 'published' && !c.finalized_at && <Btn data-act="refresh" disabled={busy} onClick={() => act({ action: 'refresh' })}><RefreshCw size={15} />Atualizar apuração agora</Btn>}
              <Btn data-act="dup-next" onClick={() => onDuplicate(c.id)}><Copy size={15} />Duplicar para a próxima semana</Btn>
            </div>
          </div>
        </>)}
      </motion.div>
    </div>
  )
}

function ConfirmDelete({ c, onCancel, onConfirm }: { c: ListItem; onCancel: () => void; onConfirm: () => void }) {
  const [busy, setBusy] = useState(false)
  const n = c.notified, running = c.status === 'published' && !c.finalized_at
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onCancel])
  return (
    <div data-confirm-delete role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,6,20,.62)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ width: 'min(440px,100%)', borderRadius: 20, background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,.45)', padding: 22 }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--foreground)' }}>Excluir “{c.name}”?</p>
        <p style={{ margin: '6px 0 12px', fontSize: 12.5, color: 'var(--muted-foreground)' }}>Isso não dá pra desfazer. Vai ser apagado:</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--foreground)' }}>
          <li data-del="campanha">a campanha{running ? ' (que ainda está rodando — ela será encerrada)' : ''}</li>
          <li data-del="avisos">{n.notifications > 0 ? <><strong>{n.notifications} aviso{n.notifications > 1 ? 's' : ''}</strong> que ela já enviou ({n.deliveries} entrega{n.deliveries > 1 ? 's' : ''}) — somem do sininho de quem recebeu</> : 'nenhum aviso foi enviado, então não há avisos a apagar'}</li>
          <li data-del="ganhadores">{c.winners.length > 0 ? <>os <strong>{c.winners.length} ganhador{c.winners.length > 1 ? 'es' : ''}</strong> registrados e o controle de entrega dos prêmios</> : 'nenhum ganhador registrado'}</li>
        </ul>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <Btn data-del-cancel onClick={onCancel}>Cancelar</Btn>
          <Btn variant="dangersolid" data-del-confirm disabled={busy} onClick={() => { setBusy(true); onConfirm() }}><Trash2 size={15} />{busy ? 'Excluindo…' : 'Excluir definitivamente'}</Btn>
        </div>
      </motion.div>
    </div>
  )
}
