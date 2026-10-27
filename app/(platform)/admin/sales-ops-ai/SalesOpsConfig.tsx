'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, Eye, History, RotateCcw, Plus, Trash2, Copy, Search, X, Check, AlertTriangle, FileText, SlidersHorizontal, FileWarning,
  Bold, ListOrdered, Link2, Code2, Quote, Sparkles, ChevronLeft, Archive,
} from 'lucide-react'
import { promptStats, TONE_LABEL, type SalesOpsSettings, type Tone, type KnowledgeLink } from '@/lib/salesops/prompt'
import { safeHref } from '@/lib/salesops/markdown'
import { api } from './api'
import { Markdown } from './Markdown'

export interface Entry { id: string; title: string; content: string; links: KnowledgeLink[]; is_active: boolean; updated_at: string }
interface Gap { messageId: string; kind: 'gap' | 'down'; isGap: boolean; question: string; answer: string; note: string | null; askedBy: string | null; createdAt: string }
interface Revision { id: string; action: string; title: string; snapshot: any; changed_by_name: string | null; created_at: string; ref_id: string | null }
type Sub = 'prompt' | 'processos' | 'ajustes' | 'lacunas'
export interface GapDraft { question: string; messageId?: string; nonce: number }

const PROMPT_TEMPLATE = `## Contexto da operação
- Quem somos: [descreva a empresa e o time de Sales Ops em 1–2 linhas]
- Ferramentas principais: [CRM, roleta comercial, plataforma interna… e para que cada uma serve]

## Glossário
- Closer: [quem vende e como é identificado no sistema]
- Roleta comercial: [como a distribuição de leads funciona, em uma frase]

## Convenções e regras do time
- [Ex.: sempre confirmar o ambiente (produção ou teste) antes de alterar um fluxo]
- [Ex.: nunca remover um closer da roleta sem avisar o gestor]
`
const ENTRY_TEMPLATE = `## Objetivo
[Para que serve este processo e quando usar]

## Pré-requisitos
- Acesso necessário: [perfil/permissão]
- Dados em mãos: [o que você precisa ter antes de começar]

## Passo a passo
1. [Acesse … em [Nome do link](https://…)]
2. [Clique em **Botão**]
3. [Preencha **Campo** com …]

## Como validar
- [O que deve aparecer ou como conferir que deu certo]

## Erros comuns e cuidados
> **Atenção:** [o que costuma dar errado e como evitar]
`
const TONE_DESC: Record<Tone, string> = { didatico: 'Explica o porquê de cada etapa. Bom para quem está aprendendo o processo.', objetivo: 'Vai direto aos passos, sem introdução. Bom para quem já conhece a operação.', descontraido: 'Próximo e leve, sem perder a precisão técnica.', formal: 'Linguagem profissional e neutra.' }
const ACTION_LABEL: Record<string, string> = { create: 'Criado', update: 'Editado', delete: 'Excluído', restore: 'Restaurado' }
const fmtDT = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const okUrl = (u: string) => { const s = safeHref(u); return !!s && !s.startsWith('#') }
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')} mil` : String(n))

const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border-strong)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }
const CSS = `
.socf-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--border-strong);background:var(--card);color:var(--foreground);font-size:12.5px;font-weight:800;font-family:inherit;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease}
.socf-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--shadow-sm);border-color:var(--primary)}
.socf-btn:disabled{opacity:.5;cursor:not-allowed}
.socf-btn[data-v="primary"]{background:var(--grad-primary);color:#fff;border-color:transparent;box-shadow:var(--shadow-purple)}
.socf-btn[data-v="danger"]{color:var(--destructive);border-color:color-mix(in srgb,var(--destructive) 40%,transparent)}
.socf-btn[data-v="danger"]:hover:not(:disabled){background:color-mix(in srgb,var(--destructive) 10%,transparent);border-color:var(--destructive)}
.socf-tb{width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--muted-foreground);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .12s ease,color .12s ease}
.socf-tb:hover{background:var(--secondary);color:var(--foreground);border-color:var(--border)}
.socf-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid transparent;cursor:pointer;transition:background .15s ease,transform .15s ease,border-color .15s ease}
.socf-item:hover{background:var(--secondary);transform:translateX(2px)}
.socf-item[data-active="true"]{background:color-mix(in srgb,var(--primary) 10%,transparent);border-color:color-mix(in srgb,var(--primary) 30%,transparent)}
.socf-chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--muted-foreground);font-size:11.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;transition:all .12s ease}
.socf-chip:hover{border-color:var(--primary);color:var(--foreground)}
.socf-chip[data-on="true"]{background:var(--primary);border-color:var(--primary);color:#fff}
.socf-sw{position:relative;width:34px;height:20px;border-radius:99px;border:none;background:var(--border-strong);cursor:pointer;flex-shrink:0;transition:background .18s ease;padding:0}
.socf-sw[aria-checked="true"]{background:var(--success)}
.socf-sw::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
.socf-sw[aria-checked="true"]::after{transform:translateX(14px)}
.socf-tone{padding:14px 16px;border-radius:14px;border:1.5px solid var(--border);background:var(--card);cursor:pointer;text-align:left;font-family:inherit;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.socf-tone:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm)}
.socf-tone[aria-checked="true"]{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 9%,var(--card))}
.socf-split{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:16px;align-items:start}
.socf-back{display:none}
@media (max-width:900px){.socf-split{grid-template-columns:minmax(0,1fr)}.socf-split[data-sel="true"] .socf-listcol{display:none!important}.socf-split[data-sel="false"] .socf-editcol{display:none!important}.socf-back{display:inline-flex}.socf-tones{grid-template-columns:minmax(0,1fr)!important}}
@media (prefers-reduced-motion:reduce){.socf-btn,.socf-item,.socf-tone{transition:none}.socf-btn:hover,.socf-item:hover,.socf-tone:hover{transform:none}}
`

// ── modal e confirmação ──────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 640 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <motion.div data-soai="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(8px,2vw,24px)' }}>
      <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 14, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{ width: `min(${width}px,100%)`, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>{title}</h3>
          <button type="button" className="socf-tb" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: 18 }}>{children}</div>
      </motion.div>
    </motion.div>, document.body)
}
function useConfirm() {
  const [st, setSt] = useState<{ title: string; body?: string; confirm: string; danger?: boolean; res: (v: boolean) => void } | null>(null)
  const ask = useCallback((o: { title: string; body?: string; confirm?: string; danger?: boolean }) => new Promise<boolean>(res => setSt({ title: o.title, body: o.body, confirm: o.confirm ?? 'Confirmar', danger: o.danger, res })), [])
  const close = (v: boolean) => { st?.res(v); setSt(null) }
  const node = st ? (
    <Modal title={st.title} onClose={() => close(false)} width={440}>
      {st.body && <p style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted-foreground)' }}>{st.body}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="socf-btn" data-soai="confirm-no" onClick={() => close(false)}>Cancelar</button>
        <button type="button" className="socf-btn" data-v={st.danger ? 'danger' : 'primary'} data-soai="confirm-yes" autoFocus onClick={() => close(true)}>{st.confirm}</button>
      </div>
    </Modal>
  ) : null
  return { ask, node }
}

// ── histórico de versões ─────────────────────────────────────────────────────────────────────
function VersionsModal({ kind, refId, title, onClose, onRestored }: { kind: 'prompt' | 'knowledge'; refId?: string; title: string; onClose: () => void; onRestored: (r: any) => void }) {
  const [rows, setRows] = useState<Revision[] | null>(null), [err, setErr] = useState<string | null>(null), [open, setOpen] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null)
  const { ask, node } = useConfirm()
  useEffect(() => { api<{ revisions: Revision[] }>(`/revisions?kind=${kind}${refId ? `&ref=${refId}` : ''}`).then(r => setRows(r.revisions)).catch(e => setErr(e.message)) }, [kind, refId])
  const text = (r: Revision) => (kind === 'prompt' ? r.snapshot?.general_prompt ?? '' : r.snapshot?.content ?? '')
  async function restore(r: Revision) {
    if (!(await ask({ title: 'Restaurar esta versão?', body: kind === 'prompt' ? 'O prompt geral volta para o texto desta versão. A versão atual continua no histórico.' : 'O processo volta para o conteúdo desta versão. A versão atual continua no histórico.', confirm: 'Restaurar' }))) return
    setBusy(r.id)
    try { const res = await api(`/revisions/${r.id}`, { method: 'POST' }); onRestored(res); onClose() } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }
  return (
    <Modal title={title} onClose={onClose} width={720}>
      {node}
      {err && <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>{err}</p>}
      {!rows && !err && <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Carregando versões…</p>}
      {rows?.length === 0 && <p data-soai="no-versions" style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Ainda não há versões guardadas.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows?.map((r, i) => (
          <div key={r.id} data-soai="version" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: i === 0 ? 'color-mix(in srgb,var(--primary) 6%,transparent)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: r.action === 'delete' ? 'var(--destructive)' : 'var(--primary)' }}>{ACTION_LABEL[r.action] ?? r.action}</span>
              <span style={{ fontSize: 12.5, color: 'var(--foreground)', fontWeight: 600 }}>{fmtDT(r.created_at)}{r.changed_by_name ? ` · ${r.changed_by_name}` : ''}</span>
              {i === 0 && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>(mais recente)</span>}
              <span style={{ flex: 1 }} />
              <button type="button" className="socf-btn" style={{ height: 28, fontSize: 11.5 }} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Ocultar' : 'Ver texto'}</button>
              <button type="button" className="socf-btn" data-soai="restore" style={{ height: 28, fontSize: 11.5 }} disabled={busy === r.id || i === 0 && r.action !== 'delete'} onClick={() => restore(r)}><RotateCcw size={12} />Restaurar</button>
            </div>
            {open === r.id && <pre style={{ margin: '10px 0 0', padding: 10, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.55, background: 'var(--secondary)', borderRadius: 8, fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>{text(r) || '(vazio)'}</pre>}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function Deleted({ onClose, onRestored }: { onClose: () => void; onRestored: (e: Entry) => void }) {
  const [rows, setRows] = useState<Revision[] | null>(null), [err, setErr] = useState<string | null>(null)
  useEffect(() => { api<{ revisions: Revision[] }>('/revisions?kind=knowledge&ref=deleted').then(r => setRows(r.revisions)).catch(e => setErr(e.message)) }, [])
  async function restore(r: Revision) { try { const res = await api<{ entry: Entry }>(`/revisions/${r.id}`, { method: 'POST' }); onRestored(res.entry); setRows(p => (p ?? []).filter(x => x.id !== r.id)) } catch (e: any) { setErr(e.message) } }
  return (
    <Modal title="Processos excluídos recentemente" onClose={onClose}>
      {err && <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>{err}</p>}
      {!rows && !err && <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Carregando…</p>}
      {rows?.length === 0 && <p data-soai="no-deleted" style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Nenhum processo excluído para restaurar.</p>}
      {rows?.map(r => (
        <div key={r.id} data-soai="deleted-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{r.title}</p><p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted-foreground)' }}>Excluído em {fmtDT(r.created_at)}{r.changed_by_name ? ` por ${r.changed_by_name}` : ''}</p></div>
          <button type="button" className="socf-btn" data-soai="restore-deleted" onClick={() => restore(r)}><RotateCcw size={13} />Restaurar</button>
        </div>
      ))}
    </Modal>
  )
}

// ═══════════════════════════ PROMPT GERAL ═══════════════════════════
function PromptTab({ settings, stats, onSaved, onDirty }: { settings: SalesOpsSettings; stats: ReturnType<typeof promptStats>; onSaved: (s: SalesOpsSettings) => void; onDirty: (d: boolean) => void }) {
  const [draft, setDraft] = useState(settings.general_prompt), [saving, setSaving] = useState(false), [err, setErr] = useState<string | null>(null), [savedAt, setSavedAt] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ text: string } | null>(null), [versions, setVersions] = useState(false), [loadingPrev, setLoadingPrev] = useState(false)
  const dirty = draft !== settings.general_prompt
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  async function save() {
    if (!dirty || saving) return
    setSaving(true); setErr(null)
    try { const r = await api<{ settings: SalesOpsSettings }>('/settings', { method: 'PUT', json: { general_prompt: draft } }); onSaved(r.settings); setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }
  async function showPreview() { setLoadingPrev(true); try { const r = await api<{ text: string }>('/prompt-preview'); setPreview({ text: r.text }) } catch (e: any) { setErr(e.message) } finally { setLoadingPrev(false) } }
  return (
    <div data-soai="tab-prompt">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
          <label htmlFor="soai-prompt" style={lbl}>Prompt geral do time</label>
          <textarea id="soai-prompt" data-soai="prompt" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() } }} spellCheck rows={18}
            placeholder={'Contexto da operação, glossário, convenções e regras do time.\n\nOs processos passo a passo (ex.: "como cadastrar um closer") ficam na aba Processos.'}
            style={{ ...field, resize: 'vertical', minHeight: 300, lineHeight: 1.6, fontSize: 13.5 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button type="button" className="socf-btn" data-v="primary" data-soai="save-prompt" disabled={!dirty || saving} onClick={save}><Save size={14} />{saving ? 'Salvando…' : 'Salvar'}</button>
            {dirty ? <span data-soai="dirty" style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)' }}>● Alterações não salvas</span> : savedAt ? <span data-soai="saved" style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}><Check size={12} style={{ verticalAlign: -2 }} /> Salvo às {savedAt}</span> : null}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{draft.length.toLocaleString('pt-BR')} caracteres</span>
          </div>
          {err && <p role="alert" data-soai="err" style={{ margin: '10px 0 0', color: 'var(--destructive)', fontSize: 12.5, fontWeight: 600 }}>{err}</p>}
        </div>
        <div style={{ flex: '0 1 280px', display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button type="button" className="socf-btn" data-soai="template-prompt" onClick={() => setDraft(d => (d.trim() ? `${d.trimEnd()}\n\n${PROMPT_TEMPLATE}` : PROMPT_TEMPLATE))}><Sparkles size={14} />Inserir modelo</button>
          <button type="button" className="socf-btn" data-soai="preview" onClick={showPreview} disabled={loadingPrev}><Eye size={14} />{loadingPrev ? 'Montando…' : 'Ver prompt montado'}</button>
          <button type="button" className="socf-btn" data-soai="versions-prompt" onClick={() => setVersions(true)}><History size={14} />Versões</button>
          <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12.5, lineHeight: 1.65, color: 'var(--muted-foreground)' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 800, color: 'var(--foreground)' }}>O que colocar aqui</p>
            Contexto da operação, glossário, convenções e regras que valem para <strong>todas</strong> as respostas. Cada processo passo a passo vai na aba <strong>Processos</strong>: assim você atualiza só o que mudou.
            <p style={{ margin: '10px 0 0' }}>As regras de <em>como responder</em> (passo a passo, links exatos, não inventar) já vêm prontas.</p>
          </div>
        </div>
      </div>
      <AnimatePresence>{preview && <Modal title={`Prompt exatamente como a IA recebe · ~${fmtK(stats.tokens)} tokens`} onClose={() => setPreview(null)} width={860}><pre data-soai="preview-text" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6, fontFamily: "'JetBrains Mono',ui-monospace,monospace", color: 'var(--foreground)' }}>{preview.text}</pre></Modal>}</AnimatePresence>
      <AnimatePresence>{versions && <VersionsModal kind="prompt" title="Versões do prompt geral" onClose={() => setVersions(false)} onRestored={r => { setDraft(r.general_prompt); onSaved({ ...settings, general_prompt: r.general_prompt }) }} />}</AnimatePresence>
    </div>
  )
}

// ═══════════════════════════ PROCESSOS ═══════════════════════════
interface Draft { title: string; content: string; links: KnowledgeLink[]; is_active: boolean }
const blank = (): Draft => ({ title: '', content: '', links: [], is_active: true })
const norm = (d: Draft) => JSON.stringify({ t: d.title.trim(), b: d.content, l: d.links.map(l => [l.label.trim(), l.url.trim()]), a: d.is_active })

function ProcessosTab({ entries, setEntries, gapDraft, onGapResolved, onDirty }: { entries: Entry[]; setEntries: React.Dispatch<React.SetStateAction<Entry[]>>; gapDraft: GapDraft | null; onGapResolved: (messageId: string) => void; onDirty: (d: boolean) => void }) {
  const [sel, setSel] = useState<string | 'new' | null>(null), [draft, setDraft] = useState<Draft>(blank()), [base, setBase] = useState<string>(norm(blank()))
  const [q, setQ] = useState(''), [status, setStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [saving, setSaving] = useState(false), [err, setErr] = useState<string | null>(null), [mode, setMode] = useState<'editar' | 'previa'>('editar'), [showVersions, setShowVersions] = useState(false), [showDeleted, setShowDeleted] = useState(false)
  const [linkForm, setLinkForm] = useState<{ label: string; url: string } | null>(null), [pendingGap, setPendingGap] = useState<string | null>(null)
  const ta = useRef<HTMLTextAreaElement>(null), { ask, node } = useConfirm()
  const dirty = sel !== null && norm(draft) !== base
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])

  const shown = useMemo(() => entries.filter(e => (status === 'todos' || (status === 'ativos') === e.is_active) && (!q.trim() || `${e.title} ${e.content}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [entries, q, status])

  function open(e: Entry) { const d = { title: e.title, content: e.content, links: e.links, is_active: e.is_active }; setSel(e.id); setDraft(d); setBase(norm(d)); setErr(null); setMode('editar'); setLinkForm(null); setPendingGap(null) }
  async function select(e: Entry) { if (sel === e.id) return; if (dirty && !(await ask({ title: 'Descartar as alterações?', body: 'Há alterações não salvas neste processo.', confirm: 'Descartar', danger: true }))) return; open(e) }
  async function startNew(init?: Partial<Draft>, gapId?: string) {
    if (dirty && !(await ask({ title: 'Descartar as alterações?', body: 'Há alterações não salvas neste processo.', confirm: 'Descartar', danger: true }))) return
    const d = { ...blank(), content: ENTRY_TEMPLATE, ...init }; setSel('new'); setDraft(d); setBase(norm(blank())); setErr(null); setMode('editar'); setLinkForm(null); setPendingGap(gapId ?? null)
  }
  const lastGap = useRef(0)
  useEffect(() => { if (gapDraft && gapDraft.nonce !== lastGap.current) { lastGap.current = gapDraft.nonce; startNew({ title: gapDraft.question.replace(/\s+/g, ' ').trim().slice(0, 160) }, gapDraft.messageId) } /* eslint-disable-next-line */ }, [gapDraft])

  async function save() {
    const title = draft.title.trim()
    if (!title) { setErr('Dê um título ao processo.'); return }
    const bad = draft.links.find(l => !l.label.trim() || !okUrl(l.url.trim()))
    if (bad) { setErr(`Link inválido${bad.label ? ` (“${bad.label}”)` : ''}: informe um nome e uma URL que comece com https://, http://, mailto: ou /.`); return }
    setSaving(true); setErr(null)
    const body = { title, content: draft.content, links: draft.links.map(l => ({ label: l.label.trim(), url: l.url.trim() })), is_active: draft.is_active }
    try {
      if (sel === 'new') {
        const r = await api<{ entry: Entry }>('/knowledge', { method: 'POST', json: body }); setEntries(p => [...p, r.entry]); setSel(r.entry.id); open(r.entry)
        if (pendingGap) { api(`/gaps/${pendingGap}`, { method: 'PATCH', json: { resolved: true } }).then(() => onGapResolved(pendingGap)).catch(() => {}) ; setPendingGap(null) }
      } else if (sel) { const r = await api<{ entry: Entry }>(`/knowledge/${sel}`, { method: 'PATCH', json: body }); setEntries(p => p.map(e => (e.id === sel ? r.entry : e))); open(r.entry) }
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }
  async function remove() {
    if (!sel || sel === 'new') return
    if (!(await ask({ title: 'Excluir este processo?', body: 'Ele sai da base e a IA deixa de usá-lo. Dá pra restaurar em “Excluídos”.', confirm: 'Excluir', danger: true }))) return
    try { await api(`/knowledge/${sel}`, { method: 'DELETE' }); setEntries(p => p.filter(e => e.id !== sel)); setSel(null); setBase(norm(draft)) } catch (e: any) { setErr(e.message) }
  }
  async function toggle(e: Entry) {
    setEntries(p => p.map(x => (x.id === e.id ? { ...x, is_active: !e.is_active } : x)))
    if (sel === e.id) { setDraft(d => ({ ...d, is_active: !e.is_active })); setBase(b => { const o = JSON.parse(b); o.a = !e.is_active; return JSON.stringify(o) }) }   // o editor aberto acompanha, sem parecer "alterado"
    try { await api(`/knowledge/${e.id}`, { method: 'PATCH', json: { is_active: !e.is_active } }) } catch (er: any) { setEntries(p => p.map(x => (x.id === e.id ? { ...x, is_active: e.is_active } : x))); setErr(er.message) }
  }
  // toolbar do editor
  const edit = (fn: (v: string, s: number, e: number) => { v: string; s: number; e: number }) => { const el = ta.current; if (!el) return; const r = fn(draft.content, el.selectionStart, el.selectionEnd); setDraft(d => ({ ...d, content: r.v })); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.s, r.e) }) }
  const wrap = (a: string, b: string, ph: string) => edit((v, s, e) => { const mid = v.slice(s, e) || ph; return { v: v.slice(0, s) + a + mid + b + v.slice(e), s: s + a.length, e: s + a.length + mid.length } })
  const lines = (prefix: (i: number) => string) => edit((v, s, e) => { const st = v.lastIndexOf('\n', s - 1) + 1, en = e + (v.slice(e).indexOf('\n') < 0 ? v.length - e : v.slice(e).indexOf('\n')), block = v.slice(st, en).split('\n').map((l, i) => prefix(i) + l.replace(/^(\d+\.\s+|[-*]\s+)/, '')).join('\n'); return { v: v.slice(0, st) + block + v.slice(en), s: st, e: st + block.length } })
  const insertLink = () => { if (!linkForm) return; const { label, url } = linkForm; if (!okUrl(url.trim())) { setErr('A URL do link deve começar com https://, http://, mailto: ou /.'); return } setErr(null); edit((v, s, e) => { const t = `[${label.trim() || url.trim()}](${url.trim()})`; return { v: v.slice(0, s) + t + v.slice(e), s: s + t.length, e: s + t.length } }); setLinkForm(null) }

  const editorOpen = sel !== null
  return (
    <div data-soai="tab-processos">
      {node}
      <div className="socf-split" data-sel={editorOpen}>
        {/* lista */}
        <div className="socf-listcol" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="socf-btn" data-v="primary" data-soai="new-entry" style={{ flex: 1 }} onClick={() => startNew()}><Plus size={14} />Novo processo</button>
            <button type="button" className="socf-btn" data-soai="deleted" title="Processos excluídos" aria-label="Excluídos recentemente" onClick={() => setShowDeleted(true)} style={{ padding: '0 11px' }}><Archive size={14} /></button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--muted-foreground)' }} />
            <input data-soai="kb-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar processo…" aria-label="Buscar processo" style={{ ...field, height: 36, padding: '0 12px 0 32px' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['todos', 'ativos', 'inativos'] as const).map(s => <button key={s} type="button" className="socf-chip" data-on={status === s} onClick={() => setStatus(s)} style={{ textTransform: 'capitalize' }}>{s}</button>)}
          </div>
          <div data-soai="kb-list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.length === 0 && <div data-soai="kb-empty" style={{ padding: '26px 14px', textAlign: 'center', border: '1.5px dashed var(--border-strong)', borderRadius: 14, color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.6 }}><FileText size={22} style={{ marginBottom: 6 }} /><br />Nenhum processo ainda.<br />Cadastre o primeiro (ex.: “Como cadastrar um novo closer”) e a IA já passa a responder com ele.</div>}
            {entries.length > 0 && shown.length === 0 && <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted-foreground)', padding: 18 }}>Nenhum processo com esses filtros.</p>}
            {shown.map(e => (
              <div key={e.id} role="button" tabIndex={0} data-soai="kb-item" data-active={sel === e.id} data-on={e.is_active} className="socf-item" onClick={() => select(e)} onKeyDown={ev => { if (ev.key === 'Enter') select(e) }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: e.is_active ? 'var(--foreground)' : 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>Atualizado em {new Date(e.updated_at).toLocaleDateString('pt-BR')}{e.is_active ? '' : ' · desativado'}</p>
                </div>
                <button type="button" role="switch" aria-checked={e.is_active} aria-label={e.is_active ? 'Desativar processo' : 'Ativar processo'} data-soai="kb-toggle" className="socf-sw" onClick={ev => { ev.stopPropagation(); toggle(e) }} />
              </div>
            ))}
          </div>
        </div>

        {/* editor */}
        <div className="socf-editcol" style={{ minWidth: 0 }}>
          {!editorOpen ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', border: '1.5px dashed var(--border-strong)', borderRadius: 18, color: 'var(--muted-foreground)', fontSize: 13.5 }}>Selecione um processo na lista ou crie um novo.</div>
          ) : (
            <div data-soai="kb-editor" style={{ border: '1px solid var(--border)', borderRadius: 18, background: 'var(--card)', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="socf-btn socf-back" onClick={async () => { if (dirty && !(await ask({ title: 'Descartar as alterações?', confirm: 'Descartar', danger: true }))) return; setSel(null) }}><ChevronLeft size={14} />Lista</button>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, flex: 1 }}>{sel === 'new' ? 'Novo processo' : 'Editar processo'}</h3>
                {sel !== 'new' && <button type="button" className="socf-btn" data-soai="versions-entry" onClick={() => setShowVersions(true)}><History size={14} />Versões</button>}
                {sel !== 'new' && <button type="button" className="socf-btn" data-soai="duplicate" onClick={() => startNew({ title: `${draft.title} (cópia)`, content: draft.content, links: draft.links, is_active: draft.is_active })}><Copy size={14} />Duplicar</button>}
                {sel !== 'new' && <button type="button" className="socf-btn" data-v="danger" data-soai="delete-entry" onClick={remove}><Trash2 size={14} />Excluir</button>}
              </div>
              <div><label htmlFor="kb-title" style={lbl}>Título</label><input id="kb-title" data-soai="kb-title" value={draft.title} maxLength={160} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Ex.: Como cadastrar um novo closer" style={field} /></div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ ...lbl, margin: 0, flex: 1, minWidth: 90 }}>Passo a passo</span>
                  {mode === 'editar' && <>
                    <button type="button" className="socf-tb" title="Negrito" aria-label="Negrito" onClick={() => wrap('**', '**', 'texto')}><Bold size={15} /></button>
                    <button type="button" className="socf-tb" title="Lista numerada" aria-label="Lista numerada" onClick={() => lines(i => `${i + 1}. `)}><ListOrdered size={15} /></button>
                    <button type="button" className="socf-tb" title="Inserir link" aria-label="Inserir link" data-soai="tb-link" onClick={() => setLinkForm(f => (f ? null : { label: '', url: '' }))}><Link2 size={15} /></button>
                    <button type="button" className="socf-tb" title="Código" aria-label="Código" onClick={() => wrap('`', '`', 'valor')}><Code2 size={15} /></button>
                    <button type="button" className="socf-tb" title="Atenção" aria-label="Bloco de atenção" onClick={() => wrap('> **Atenção:** ', '', 'descreva o cuidado')}><Quote size={15} /></button>
                    <button type="button" className="socf-tb" title="Inserir modelo de processo" aria-label="Inserir modelo" data-soai="tb-template" onClick={() => setDraft(d => ({ ...d, content: d.content.trim() ? `${d.content.trimEnd()}\n\n${ENTRY_TEMPLATE}` : ENTRY_TEMPLATE }))}><Sparkles size={15} /></button>
                  </>}
                  <span style={{ display: 'inline-flex', marginLeft: 6, border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                    {(['editar', 'previa'] as const).map(m => <button key={m} type="button" data-soai={`mode-${m}`} onClick={() => setMode(m)} style={{ padding: '5px 11px', border: 'none', fontSize: 11.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: mode === m ? 'var(--primary)' : 'transparent', color: mode === m ? '#fff' : 'var(--muted-foreground)' }}>{m === 'editar' ? 'Editar' : 'Pré-visualizar'}</button>)}
                  </span>
                </div>
                {linkForm && (
                  <div data-soai="link-form" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, padding: 8, borderRadius: 10, background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <input autoFocus value={linkForm.label} onChange={e => setLinkForm({ ...linkForm, label: e.target.value })} placeholder="Texto do link" aria-label="Texto do link" style={{ ...field, flex: '1 1 140px', height: 34, padding: '0 10px' }} />
                    <input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') insertLink() }} placeholder="https://…" aria-label="URL do link" style={{ ...field, flex: '2 1 200px', height: 34, padding: '0 10px' }} />
                    <button type="button" className="socf-btn" data-soai="link-insert" style={{ height: 34 }} onClick={insertLink}>Inserir</button>
                  </div>
                )}
                {mode === 'editar'
                  ? <textarea ref={ta} data-soai="kb-content" value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() } }} rows={16} placeholder="Descreva o processo em detalhes: pré-requisitos, cada passo (onde clicar, o que preencher), como validar e erros comuns. Use o botão ✨ para inserir um modelo."
                      style={{ ...field, resize: 'vertical', minHeight: 280, lineHeight: 1.6, fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 13 }} />
                  : <div data-soai="kb-preview" style={{ minHeight: 280, padding: '12px 16px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--background)' }}>{draft.content.trim() ? <Markdown text={draft.content} /> : <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Nada para pré-visualizar ainda.</p>}</div>}
              </div>
              <div>
                <span style={lbl}>Links oficiais deste processo</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {draft.links.map((l, i) => (
                    <div key={i} data-soai="link-row" style={{ display: 'flex', gap: 6 }}>
                      <input value={l.label} onChange={e => setDraft(d => ({ ...d, links: d.links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) }))} placeholder="Nome (ex.: Painel da roleta)" aria-label={`Nome do link ${i + 1}`} style={{ ...field, flex: 1, height: 34, padding: '0 10px' }} />
                      <input value={l.url} onChange={e => setDraft(d => ({ ...d, links: d.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) }))} placeholder="https://…" aria-label={`URL do link ${i + 1}`} style={{ ...field, flex: 2, height: 34, padding: '0 10px', borderColor: l.url && !okUrl(l.url.trim()) ? 'var(--destructive)' : undefined }} />
                      <button type="button" className="socf-tb" aria-label={`Remover link ${i + 1}`} onClick={() => setDraft(d => ({ ...d, links: d.links.filter((_, k) => k !== i) }))}><X size={15} /></button>
                    </div>
                  ))}
                  {draft.links.length < 20 && <button type="button" className="socf-btn" data-soai="add-link" style={{ alignSelf: 'flex-start', height: 32 }} onClick={() => setDraft(d => ({ ...d, links: [...d.links, { label: '', url: '' }] }))}><Plus size={13} />Adicionar link</button>}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted-foreground)' }}>A IA copia estes links exatamente como estão, no passo certo. Aceita https://, http://, mailto: e caminhos internos como /admin.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}><button type="button" role="switch" aria-checked={draft.is_active} aria-label="Processo ativo" data-soai="kb-active" className="socf-sw" onClick={() => setDraft(d => ({ ...d, is_active: !d.is_active }))} />{draft.is_active ? 'Ativo: a IA usa este processo' : 'Desativado: a IA ignora este processo'}</label>
                <span style={{ flex: 1 }} />
                {dirty && <span data-soai="dirty" style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)' }}>● Alterações não salvas</span>}
                <button type="button" className="socf-btn" data-v="primary" data-soai="save-entry" disabled={saving || (!dirty && sel !== 'new')} onClick={save}><Save size={14} />{saving ? 'Salvando…' : sel === 'new' ? 'Criar processo' : 'Salvar'}</button>
              </div>
              {err && <p role="alert" data-soai="err" style={{ margin: 0, color: 'var(--destructive)', fontSize: 12.5, fontWeight: 600 }}>{err}</p>}
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>{showVersions && sel && sel !== 'new' && <VersionsModal kind="knowledge" refId={sel} title={`Versões · ${draft.title || 'processo'}`} onClose={() => setShowVersions(false)} onRestored={r => { setEntries(p => p.map(e => (e.id === r.entry.id ? r.entry : e))); open(r.entry) }} />}</AnimatePresence>
      <AnimatePresence>{showDeleted && <Deleted onClose={() => setShowDeleted(false)} onRestored={e => { setEntries(p => (p.some(x => x.id === e.id) ? p : [...p, e])); open(e) }} />}</AnimatePresence>
    </div>
  )
}

// ═══════════════════════════ AJUSTES ═══════════════════════════
function AjustesTab({ settings, onSaved, onDirty }: { settings: SalesOpsSettings; onSaved: (s: SalesOpsSettings) => void; onDirty: (d: boolean) => void }) {
  const [tone, setTone] = useState<Tone>(settings.tone), [tokens, setTokens] = useState(String(settings.max_tokens)), [model, setModel] = useState(settings.model ?? ''), [sp, setSp] = useState<string[]>(settings.suggested_prompts)
  const [saving, setSaving] = useState(false), [err, setErr] = useState<string | null>(null), [ok, setOk] = useState(false)
  const cur = JSON.stringify({ tone, t: tokens, m: model.trim(), s: sp.map(x => x.trim()).filter(Boolean) }), was = JSON.stringify({ tone: settings.tone, t: String(settings.max_tokens), m: settings.model ?? '', s: settings.suggested_prompts })
  const dirty = cur !== was
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  async function save() {
    const n = Number(tokens)
    if (!Number.isInteger(n) || n < 500 || n > 8000) { setErr('O limite de resposta deve ser um número inteiro entre 500 e 8000.'); return }
    setSaving(true); setErr(null); setOk(false)
    try { const r = await api<{ settings: SalesOpsSettings }>('/settings', { method: 'PUT', json: { tone, max_tokens: n, model: model.trim() || null, suggested_prompts: sp.map(x => x.trim()).filter(Boolean) } }); onSaved(r.settings); setOk(true); setTimeout(() => setOk(false), 2500) } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }
  return (
    <div data-soai="tab-ajustes" style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 820 }}>
      <section>
        <span style={lbl}>Tom das respostas</span>
        <div className="socf-tones" role="radiogroup" aria-label="Tom das respostas" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          {(Object.keys(TONE_LABEL) as Tone[]).map(t => (
            <button key={t} type="button" role="radio" aria-checked={tone === t} data-soai="tone" data-tone={t} className="socf-tone" onClick={() => setTone(t)}>
              <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)' }}>{TONE_LABEL[t]}</p><p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{TONE_DESC[t]}</p>
            </button>
          ))}
        </div>
      </section>
      <section>
        <label htmlFor="soai-tokens" style={lbl}>Tamanho máximo da resposta</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input id="soai-tokens" data-soai="tokens" type="number" min={500} max={8000} step={100} value={tokens} onChange={e => setTokens(e.target.value)} style={{ ...field, width: 130 }} />
          {[['Curta', 1500], ['Média', 3500], ['Longa', 6000]].map(([n, v]) => <button key={n} type="button" className="socf-chip" data-on={Number(tokens) === v} onClick={() => setTokens(String(v))}>{n} ({v})</button>)}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted-foreground)' }}>Em tokens (≈ 3 caracteres cada). Passo a passo muito detalhado pede “Média” ou “Longa”; se a resposta aparecer cortada, aumente aqui.</p>
      </section>
      <section>
        <label htmlFor="soai-model" style={lbl}>Modelo (opcional)</label>
        <input id="soai-model" data-soai="model" value={model} onChange={e => setModel(e.target.value)} placeholder="Vazio = modelo padrão do sistema (claude-sonnet-4-5)" style={{ ...field, maxWidth: 440 }} />
      </section>
      <section>
        <span style={lbl}>Perguntas sugeridas na tela inicial do chat <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>(até 8)</span></span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sp.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }} data-soai="sp-row">
              <input value={s} maxLength={200} onChange={e => setSp(p => p.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Ex.: Como cadastrar um novo closer?" aria-label={`Pergunta sugerida ${i + 1}`} style={{ ...field, height: 36 }} />
              <button type="button" className="socf-tb" aria-label={`Remover pergunta ${i + 1}`} onClick={() => setSp(p => p.filter((_, k) => k !== i))}><X size={15} /></button>
            </div>
          ))}
          {sp.length < 8 && <button type="button" className="socf-btn" data-soai="add-sp" style={{ alignSelf: 'flex-start', height: 32 }} onClick={() => setSp(p => [...p, ''])}><Plus size={13} />Adicionar pergunta</button>}
        </div>
      </section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="socf-btn" data-v="primary" data-soai="save-ajustes" disabled={!dirty || saving} onClick={save}><Save size={14} />{saving ? 'Salvando…' : 'Salvar ajustes'}</button>
        {dirty && <span data-soai="dirty" style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)' }}>● Alterações não salvas</span>}
        {ok && <span data-soai="saved" style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}><Check size={12} style={{ verticalAlign: -2 }} /> Salvo</span>}
      </div>
      {err && <p role="alert" data-soai="err" style={{ margin: 0, color: 'var(--destructive)', fontSize: 12.5, fontWeight: 600 }}>{err}</p>}
    </div>
  )
}

// ═══════════════════════════ LACUNAS ═══════════════════════════
function LacunasTab({ gaps, setGaps, onDocument }: { gaps: Gap[]; setGaps: React.Dispatch<React.SetStateAction<Gap[]>>; onDocument: (q: string, id: string) => void }) {
  async function dismiss(g: Gap) { setGaps(p => p.filter(x => x.messageId !== g.messageId)); try { await api(`/gaps/${g.messageId}`, { method: 'PATCH', json: { resolved: true } }) } catch { setGaps(p => [g, ...p]) } }
  return (
    <div data-soai="tab-lacunas" style={{ maxWidth: 860 }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>Perguntas em que a IA disse não ter o processo documentado, ou que receberam 👎. Cada uma é um processo que falta (ou está desatualizado) na base. Mostra só a pergunta, não a conversa.</p>
      {gaps.length === 0 && <div data-soai="no-gaps" style={{ padding: '40px 20px', textAlign: 'center', border: '1.5px dashed var(--border-strong)', borderRadius: 16, color: 'var(--muted-foreground)', fontSize: 13.5 }}>Nenhuma lacuna por enquanto 🎉<br />Quando a IA não souber responder algo, aparece aqui.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gaps.map(g => (
          <motion.div key={g.messageId} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-soai="gap" data-kind={g.kind} style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: g.kind === 'down' ? 'color-mix(in srgb,var(--destructive) 13%,transparent)' : 'color-mix(in srgb,var(--warning) 16%,transparent)', color: g.kind === 'down' ? 'var(--destructive)' : '#b45309' }}>{g.kind === 'down' ? '👎 Resposta ruim' : 'Sem processo documentado'}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{fmtDT(g.createdAt)}{g.askedBy ? ` · ${g.askedBy}` : ''}</span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{g.question}</p>
            {g.note && <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--destructive)' }}>Observação: {g.note}</p>}
            {g.answer && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Resposta da IA: {g.answer}{g.answer.length >= 220 ? '…' : ''}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="socf-btn" data-v="primary" data-soai="gap-document" onClick={() => onDocument(g.question, g.messageId)}><FileText size={14} />Documentar</button>
              <button type="button" className="socf-btn" data-soai="gap-dismiss" onClick={() => dismiss(g)}>Dispensar</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════ CONFIGURAÇÃO ═══════════════════════════
export function SalesOpsConfig({ gapDraft, onGapCount, onSettings }: { gapDraft: GapDraft | null; onGapCount: (n: number) => void; onSettings: (s: SalesOpsSettings) => void }) {
  const [sub, setSub] = useState<Sub>('prompt')
  const [settings, setSettings] = useState<SalesOpsSettings | null>(null), [entries, setEntries] = useState<Entry[]>([]), [gaps, setGaps] = useState<Gap[]>([])
  const [err, setErr] = useState<string | null>(null), [loading, setLoading] = useState(true)
  const dirtyRef = useRef<Record<string, boolean>>({})
  const setDirty = useCallback((k: string) => (d: boolean) => { dirtyRef.current[k] = d }, [])
  const dp = useMemo(() => setDirty('prompt'), [setDirty]), de = useMemo(() => setDirty('entry'), [setDirty]), da = useMemo(() => setDirty('ajustes'), [setDirty])

  useEffect(() => {
    Promise.all([api<{ settings: SalesOpsSettings }>('/settings'), api<{ entries: Entry[] }>('/knowledge'), api<{ gaps: Gap[] }>('/gaps')])
      .then(([s, k, g]) => { setSettings(s.settings); setEntries(k.entries); setGaps(g.gaps) }).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { onGapCount(gaps.length) }, [gaps.length, onGapCount])
  useEffect(() => { if (settings) onSettings(settings) }, [settings, onSettings])
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (Object.values(dirtyRef.current).some(Boolean)) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h) }, [])
  useEffect(() => { if (gapDraft) setSub('processos') }, [gapDraft])

  const stats = useMemo(() => (settings ? promptStats(settings, entries.map(e => ({ ...e, updated_at: e.updated_at }))) : null), [settings, entries])
  const goDocument = (question: string, messageId: string) => { setSub('processos'); setPendingDoc({ question, messageId, nonce: Date.now() }) }
  const [pendingDoc, setPendingDoc] = useState<GapDraft | null>(null)
  const effectiveDraft = pendingDoc && (!gapDraft || pendingDoc.nonce > gapDraft.nonce) ? pendingDoc : gapDraft

  if (loading) return <p data-soai="config-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>Carregando configuração…</p>
  if (err || !settings || !stats) return <div role="alert" data-soai="config-error" style={{ margin: 24, padding: 16, borderRadius: 12, border: '1px solid color-mix(in srgb,var(--destructive) 35%,transparent)', color: 'var(--destructive)', fontSize: 13.5 }}>{err ?? 'Não consegui carregar a configuração.'} Se for a primeira vez, confirme que a migração <code>migration-sales-ops-ai.sql</code> foi executada no Supabase.</div>

  const tabs: { id: Sub; label: string; icon: any; badge?: number }[] = [{ id: 'prompt', label: 'Prompt geral', icon: FileText }, { id: 'processos', label: 'Processos', icon: FileText, badge: entries.length }, { id: 'ajustes', label: 'Ajustes', icon: SlidersHorizontal }, { id: 'lacunas', label: 'Lacunas', icon: FileWarning, badge: gaps.length }]
  const lvl = { ok: 'var(--success)', alto: 'var(--warning)', critico: 'var(--destructive)' }[stats.level]
  return (
    <div style={{ padding: 'clamp(14px,2.2vw,26px)', maxWidth: 1240, margin: '0 auto' }} data-soai="config">
      <style>{CSS}</style>
      <div data-soai="stats" data-level={stats.level} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, borderRadius: 14, border: `1px solid color-mix(in srgb,${lvl} 35%,var(--border))`, background: `color-mix(in srgb,${lvl} 7%,var(--card))` }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: lvl }} />
        <span style={{ fontSize: 13, fontWeight: 800 }}>{stats.activeEntries} {stats.activeEntries === 1 ? 'processo ativo' : 'processos ativos'}</span>
        <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>de {stats.totalEntries} · a IA lê ~{fmtK(stats.tokens)} tokens a cada pergunta</span>
        {stats.level !== 'ok' && <span data-soai="stats-warn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: lvl }}><AlertTriangle size={13} />{stats.level === 'critico' ? 'Perto do limite da IA: desative processos antigos.' : 'Base grande: respostas mais lentas e caras. Desative o que não usa mais.'}</span>}
      </div>
      <div role="tablist" aria-label="Configuração" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={sub === t.id} data-soai="subtab" data-sub={t.id} onClick={() => setSub(t.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', border: 'none', borderBottom: `2.5px solid ${sub === t.id ? 'var(--primary)' : 'transparent'}`, background: 'transparent', color: sub === t.id ? 'var(--foreground)' : 'var(--muted-foreground)', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1 }}>
            <t.icon size={14} />{t.label}
            {t.badge !== undefined && t.badge > 0 && <span style={{ minWidth: 20, height: 18, padding: '0 6px', borderRadius: 99, background: t.id === 'lacunas' ? 'var(--warning)' : 'var(--secondary)', color: t.id === 'lacunas' ? '#fff' : 'var(--muted-foreground)', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>}
          </button>
        ))}
      </div>
      {/* as 4 abas ficam montadas (só escondidas): o que você digitou e ainda não salvou não se perde ao trocar de aba */}
      <div hidden={sub !== 'prompt'}><PromptTab settings={settings} stats={stats} onSaved={setSettings} onDirty={dp} /></div>
      <div hidden={sub !== 'processos'}><ProcessosTab entries={entries} setEntries={setEntries} gapDraft={effectiveDraft} onGapResolved={id => setGaps(p => p.filter(g => g.messageId !== id))} onDirty={de} /></div>
      <div hidden={sub !== 'ajustes'}><AjustesTab settings={settings} onSaved={setSettings} onDirty={da} /></div>
      <div hidden={sub !== 'lacunas'}><LacunasTab gaps={gaps} setGaps={setGaps} onDocument={goDocument} /></div>
    </div>
  )
}
