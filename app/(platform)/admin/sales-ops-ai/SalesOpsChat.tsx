'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Pin, PinOff, Pencil, Trash2, Check, X, Copy, RefreshCw, ThumbsUp, ThumbsDown, Square, ArrowUp, ArrowDown, Download,
  PanelLeft, FileWarning, AlertTriangle, MessageSquare, BookOpen, CornerDownLeft,
} from 'lucide-react'
import { SalesOpsAiIcon, useSalesOpsAiImage } from '@/components/shell/SalesOpsAiIcon'
import { groupConversations, MAX_MESSAGE_CHARS } from '@/lib/salesops/prompt'
import { api, streamChat, ApiError } from './api'
import { Markdown } from './Markdown'

export interface Conv { id: string; title: string; pinned: boolean; created_at: string; updated_at: string; snippet?: string | null }
interface Msg { id: string; role: 'user' | 'assistant'; content: string; feedback?: 1 | -1 | null; feedback_note?: string | null; is_gap?: boolean; incomplete?: boolean; streaming?: boolean; error?: string | null; created_at?: string }

const DEFAULT_STARTERS = ['Como cadastrar um novo closer?', 'Como ajustar a roleta comercial?', 'Como criar uma oferta nova?', 'Como alterar um fluxo no CRM?']
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`)
const fmtWhen = (iso: string) => { const d = new Date(iso), t = new Date(), same = d.toDateString() === t.toDateString(); return same ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
const toMarkdown = (title: string, msgs: Msg[]) => `# ${title}\n\n` + msgs.filter(m => m.content.trim()).map(m => `**${m.role === 'user' ? 'Você' : 'Sales Ops AI'}:**\n\n${m.content.trim()}`).join('\n\n---\n\n') + '\n'

const CSS = `
.soai-root{display:flex;height:100%;min-height:0;position:relative;overflow:hidden;background:var(--background)}
.soai-hist{width:304px;flex-shrink:0;display:flex;flex-direction:column;background:var(--card);border-right:1px solid var(--border);min-height:0;transition:transform .22s ease}
.soai-conv{position:relative;display:flex;align-items:center;gap:6px;padding:8px 8px 8px 10px;border-radius:11px;cursor:pointer;border:1px solid transparent;transition:background .15s ease,border-color .15s ease,transform .15s ease}
.soai-conv:hover{background:var(--secondary);transform:translateX(2px)}
.soai-conv[data-active="true"]{background:color-mix(in srgb,var(--primary) 10%,transparent);border-color:color-mix(in srgb,var(--primary) 28%,transparent)}
.soai-conv .acts{position:absolute;z-index:2;right:6px;top:50%;transform:translateY(-50%);display:flex;gap:2px;padding:3px 3px 3px 22px;border-radius:9px;opacity:0;pointer-events:none;background:linear-gradient(90deg,transparent,var(--secondary) 20px);transition:opacity .15s ease}
.soai-conv[data-active="true"] .acts{background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--primary) 14%,var(--card)) 20px)}
.soai-conv:hover .acts,.soai-conv:focus-within .acts{opacity:1;pointer-events:auto}
.soai-conv .soai-when{pointer-events:none;transition:opacity .15s ease}
.soai-conv:hover .soai-when,.soai-conv:focus-within .soai-when{opacity:0}
@media (hover:none){.soai-conv .acts{opacity:1;pointer-events:auto}.soai-conv .soai-when{opacity:0}}
.soai-ib{width:24px;height:24px;border-radius:7px;border:none;background:transparent;color:var(--muted-foreground);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .12s ease,color .12s ease,transform .12s ease}
.soai-ib:hover{background:var(--border);color:var(--foreground);transform:scale(1.08)}
.soai-ib[data-danger]:hover{background:color-mix(in srgb,var(--destructive) 16%,transparent);color:var(--destructive)}
.soai-card{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:16px;border:1px solid var(--border);background:var(--card);cursor:pointer;font-family:inherit;text-align:left;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.soai-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
.soai-act{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--muted-foreground);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .12s ease,color .12s ease,border-color .12s ease}
.soai-act:hover{background:var(--secondary);color:var(--foreground);border-color:var(--border)}
.soai-act[data-on="true"]{color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent)}
.soai-act[data-on="down"]{color:var(--destructive);background:color-mix(in srgb,var(--destructive) 12%,transparent)}
.soai-caret{display:inline-block;width:7px;height:15px;margin-left:2px;vertical-align:-2px;border-radius:2px;background:var(--primary);animation:soaiCaret 1s steps(2) infinite}
.soai-dot{width:7px;height:7px;border-radius:50%;background:var(--muted-foreground);animation:soaiDot 1.2s ease-in-out infinite}
@keyframes soaiCaret{0%{opacity:1}100%{opacity:0}}
@keyframes soaiDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.soai-scroll::-webkit-scrollbar{width:9px}.soai-scroll::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:9px;border:2px solid transparent;background-clip:padding-box}
.soai-mobile-btn{display:none}
@media (max-width:900px){
  .soai-hist{position:absolute;z-index:30;left:0;top:0;bottom:0;transform:translateX(-102%);box-shadow:var(--shadow-xl)}
  .soai-hist.open{transform:none}
  .soai-mobile-btn{display:inline-flex}
  .soai-cards{grid-template-columns:minmax(0,1fr)!important}
}
@media (prefers-reduced-motion:reduce){.soai-conv,.soai-card,.soai-hist{transition:none}.soai-conv:hover,.soai-card:hover{transform:none}.soai-caret,.soai-dot{animation:none}}
`

export function SalesOpsChat({ initialConversations, suggested, onDocument }: { initialConversations: Conv[]; suggested: string[]; onDocument: (question: string, messageId?: string) => void }) {
  const [convs, setConvs] = useState<Conv[]>(initialConversations)
  const [hasMore, setHasMore] = useState(initialConversations.length >= 40)
  const [q, setQ] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const img = useSalesOpsAiImage()
  const abortRef = useRef<AbortController | null>(null), stoppedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLTextAreaElement>(null), searchRef = useRef<HTMLInputElement>(null)
  const stickRef = useRef(true), skipBlur = useRef(false), reqSeq = useRef(0)

  const active = convs.find(c => c.id === activeId) ?? null
  const starters = suggested.length ? suggested : DEFAULT_STARTERS

  // ── lista de conversas (e busca com atraso de 300 ms)
  const loadList = useCallback(async (opts: { q?: string; offset?: number; append?: boolean } = {}) => {
    const seq = ++reqSeq.current
    try {
      const r = await api<{ conversations: Conv[]; hasMore: boolean }>(`/conversations?limit=40&offset=${opts.offset ?? 0}${opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''}`)
      if (seq !== reqSeq.current) return
      setConvs(prev => (opts.append ? [...prev, ...r.conversations] : r.conversations)); setHasMore(r.hasMore)
    } catch (e: any) { if (seq === reqSeq.current) setBanner(e.message) }
  }, [])
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const id = setTimeout(() => { loadList({ q: q.trim() }) }, 300)
    return () => clearTimeout(id)
  }, [q, loadList])

  // Ctrl/⌘+K foca a busca
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setDrawer(true); searchRef.current?.focus() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  // ── rolagem: acompanha a resposta chegando, mas não puxa de volta quem subiu pra reler
  const onScroll = () => { const el = scrollRef.current; if (!el) return; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120; stickRef.current = near; setAtBottom(near) }
  useLayoutEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight }, [messages])
  const toBottom = () => { const el = scrollRef.current; if (el) { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); stickRef.current = true; setAtBottom(true) } }
  useEffect(() => { const el = inputRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 190)}px` } }, [input])

  // ── abrir / nova conversa
  async function openConversation(id: string) {
    if (sending) return
    setDrawer(false); setBanner(null); setConfirmDel(null); setNoteFor(null)
    setActiveId(id); setLoadingConv(true); setMessages([])
    try {
      const r = await api<{ messages: Msg[] }>(`/conversations/${id}`)
      setMessages(r.messages); stickRef.current = true
    } catch (e: any) { setBanner(e.message); setActiveId(null) }
    finally { setLoadingConv(false) }
  }
  function newConversation() {
    if (sending) return
    setActiveId(null); setMessages([]); setInput(''); setBanner(null); setDrawer(false); setConfirmDel(null); setNoteFor(null)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  // ── enviar / regenerar (mesmo caminho: lê o streaming e vai montando a resposta)
  async function run(body: { conversationId?: string | null; message?: string; regenerate?: boolean }, userText?: string) {
    const ac = new AbortController(); abortRef.current = ac; stoppedRef.current = false
    setSending(true); setBanner(null)
    let userId = uid(), asstId = uid(), acc = '', raf = 0
    const flush = () => { raf = 0; const v = acc; setMessages(prev => prev.map(m => (m.id === asstId ? { ...m, content: v } : m))) }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(flush) }
    setMessages(prev => [...prev, ...(userText !== undefined ? [{ id: userId, role: 'user' as const, content: userText }] : []), { id: asstId, role: 'assistant' as const, content: '', streaming: true }])
    stickRef.current = true
    const finishAsErrorOnUser = (e: ApiError) => {
      setMessages(prev => { const rest = prev.filter(m => m.id !== asstId); const ix = rest.map(m => m.role).lastIndexOf('user'); return rest.map((m, i) => (i === ix ? { ...m, error: e.message } : m)) })
      if (e.extra?.conversationId) { setActiveId(e.extra.conversationId); setConvs(prev => (prev.some(c => c.id === e.extra.conversationId) ? prev : [{ id: e.extra.conversationId, title: (userText ?? 'Nova conversa').slice(0, 60), pinned: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev])) }
      else if (userText !== undefined) { setMessages(prev => prev.filter(m => m.id !== userId)); setInput(userText); setBanner(e.message) }      // recusada antes de criar a conversa: o texto volta pro campo E o motivo aparece (nunca falha em silêncio)
    }
    try {
      let finished = false
      for await (const ev of streamChat(body, ac.signal)) {
        if (ev.t === 'start') {
          const oldU = userId, oldA = asstId; userId = ev.userMessageId; asstId = ev.assistantMessageId
          setMessages(prev => prev.map(m => (m.id === oldU ? { ...m, id: userId } : m.id === oldA ? { ...m, id: asstId } : m)))
          setActiveId(ev.conversationId)
          setConvs(prev => { const now = new Date().toISOString(); const ex = prev.find(c => c.id === ev.conversationId); const upd: Conv = ex ? { ...ex, updated_at: now } : { id: ev.conversationId, title: ev.title, pinned: false, created_at: now, updated_at: now }; return [upd, ...prev.filter(c => c.id !== ev.conversationId)].sort((a, b) => Number(b.pinned) - Number(a.pinned)) })
        } else if (ev.t === 'delta') { acc += ev.text; schedule() }
        else if (ev.t === 'done') { finished = true; if (raf) cancelAnimationFrame(raf); setMessages(prev => prev.map(m => (m.id === asstId ? { ...m, id: ev.messageId, content: acc, streaming: false, is_gap: ev.isGap, incomplete: ev.truncated } : m))) }
        else if (ev.t === 'error') {
          finished = true; if (raf) cancelAnimationFrame(raf)
          if (!acc.trim()) finishAsErrorOnUser(new ApiError(ev.message, 502, {}))
          else setMessages(prev => prev.map(m => (m.id === asstId ? { ...m, content: acc, streaming: false, incomplete: true, error: ev.message } : m)))
        }
      }
      if (!finished) { if (raf) cancelAnimationFrame(raf); setMessages(prev => prev.map(m => (m.id === asstId ? { ...m, content: acc, streaming: false, incomplete: true, error: acc.trim() ? 'A conexão foi interrompida antes do fim da resposta.' : null } : m)).filter(m => m.role !== 'assistant' || m.content.trim() || m.streaming)) }
    } catch (e: any) {
      if (raf) cancelAnimationFrame(raf)
      if (stoppedRef.current || e?.name === 'AbortError') setMessages(prev => (acc.trim() ? prev.map(m => (m.id === asstId ? { ...m, content: acc, streaming: false, incomplete: true } : m)) : prev.filter(m => m.id !== asstId)))
      else finishAsErrorOnUser(e instanceof ApiError ? e : new ApiError('Falha de conexão. Verifique a internet e tente de novo.', 0, {}))
    } finally { setSending(false); abortRef.current = null }
  }
  function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    if (msg.length > MAX_MESSAGE_CHARS) { setBanner(`A mensagem passou de ${MAX_MESSAGE_CHARS} caracteres. Divida em partes.`); return }
    setInput(''); run({ conversationId: activeId, message: msg }, msg)
  }
  function stop() { stoppedRef.current = true; abortRef.current?.abort() }
  function regenerate() {
    if (sending || !activeId) return
    setMessages(prev => (prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev.map((m, i) => (i === prev.length - 1 ? { ...m, error: null } : m))))
    run({ conversationId: activeId, regenerate: true })
  }
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }

  // ── renomear / fixar / excluir
  async function saveRename() {
    if (!renaming) return
    const { id, value } = renaming, title = value.replace(/\s+/g, ' ').trim(), cur = convs.find(c => c.id === id)
    setRenaming(null)
    if (!cur || !title || title === cur.title) return
    setConvs(prev => prev.map(c => (c.id === id ? { ...c, title } : c)))
    try { await api(`/conversations/${id}`, { method: 'PATCH', json: { title } }) } catch (e: any) { setConvs(prev => prev.map(c => (c.id === id ? { ...c, title: cur.title } : c))); setBanner(e.message) }
  }
  async function togglePin(c: Conv) {
    setConvs(prev => prev.map(x => (x.id === c.id ? { ...x, pinned: !c.pinned } : x)).sort((a, b) => Number(b.pinned) - Number(a.pinned)))
    try { await api(`/conversations/${c.id}`, { method: 'PATCH', json: { pinned: !c.pinned } }) } catch (e: any) { setConvs(prev => prev.map(x => (x.id === c.id ? { ...x, pinned: c.pinned } : x))); setBanner(e.message) }
  }
  async function removeConv(id: string) {
    setConfirmDel(null)
    try { await api(`/conversations/${id}`, { method: 'DELETE' }); setConvs(prev => prev.filter(c => c.id !== id)); if (id === activeId) { setActiveId(null); setMessages([]) } } catch (e: any) { setBanner(e.message) }
  }

  // ── feedback, copiar, exportar
  async function sendFeedback(m: Msg, value: 1 | -1 | null, note?: string) {
    const prev = { feedback: m.feedback ?? null, note: m.feedback_note ?? null }
    setMessages(p => p.map(x => (x.id === m.id ? { ...x, feedback: value, feedback_note: value === -1 ? note ?? null : null } : x)))
    try { await api(`/messages/${m.id}`, { method: 'PATCH', json: { feedback: value, note } }) } catch (e: any) { setMessages(p => p.map(x => (x.id === m.id ? { ...x, feedback: prev.feedback, feedback_note: prev.note } : x))); setBanner(e.message) }
  }
  const onThumb = (m: Msg, v: 1 | -1) => { if ((m.feedback ?? null) === v) { sendFeedback(m, null); return } if (v === 1) { setNoteFor(null); sendFeedback(m, 1) } else { setNoteFor(m.id); setNoteText(''); sendFeedback(m, -1) } }
  const copy = (id: string, text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(c => (c === id ? null : c)), 1400) }).catch(() => {}) }
  const exportMd = () => {
    if (!active) return
    const blob = new Blob([toMarkdown(active.title, messages)], { type: 'text/markdown;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `${active.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 50) || 'conversa'}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const questionFor = (i: number) => { for (let k = i - 1; k >= 0; k--) if (messages[k].role === 'user') return messages[k].content; return '' }

  const groups = useMemo(() => (q.trim() ? [{ label: `${convs.length} ${convs.length === 1 ? 'resultado' : 'resultados'}`, items: convs }] : groupConversations(convs)), [convs, q])

  // ── peças visuais
  // IMPORTANTE: é uma FUNÇÃO que devolve JSX (não um componente). Definido como componente aqui dentro, o React o recriaria a cada tecla ao renomear e o campo perderia o foco.
  const renderRow = (c: Conv) => {
    // a conversa ABERTA é renomeada no cabeçalho (um campo só): dois campos com foco automático brigavam e o da lista salvava/cancelava ao perder o foco
    const isRen = renaming?.id === c.id && c.id !== activeId, isDel = confirmDel === c.id
    return (
      <div key={c.id} role="button" tabIndex={0} data-soai="conv" data-id={c.id} data-active={c.id === activeId} data-pinned={c.pinned} className="soai-conv"
        onClick={() => { if (!isRen && !isDel) openConversation(c.id) }} onKeyDown={e => { if (e.key === 'Enter' && !isRen && !isDel) openConversation(c.id) }}>
        {c.pinned ? <Pin size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} /> : <MessageSquare size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRen ? (
            <input autoFocus aria-label="Novo nome da conversa" value={renaming!.value} maxLength={120} onClick={e => e.stopPropagation()}
              onChange={e => setRenaming({ id: c.id, value: e.target.value })}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { skipBlur.current = true; saveRename() } else if (e.key === 'Escape') { skipBlur.current = true; setRenaming(null) } }}
              onBlur={() => { if (skipBlur.current) { skipBlur.current = false; return } saveRename() }}
              style={{ width: '100%', boxSizing: 'border-box', height: 26, padding: '0 8px', borderRadius: 7, border: '1.5px solid var(--primary)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: c.id === activeId ? 800 : 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.title}>{c.title}</p>
              {c.snippet && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.snippet}</p>}
            </>
          )}
        </div>
        {isDel ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--destructive)' }} onClick={e => e.stopPropagation()}>
            Excluir?
            <button type="button" className="soai-ib" data-danger aria-label="Confirmar exclusão" data-soai="confirm-del" onClick={() => removeConv(c.id)}><Check size={13} /></button>
            <button type="button" className="soai-ib" aria-label="Cancelar exclusão" onClick={() => setConfirmDel(null)}><X size={13} /></button>
          </span>
        ) : !isRen && (
          <span className="acts" onClick={e => e.stopPropagation()}>
            <button type="button" className="soai-ib" aria-label={c.pinned ? 'Desafixar' : 'Fixar'} title={c.pinned ? 'Desafixar' : 'Fixar no topo'} data-soai="pin" onClick={() => togglePin(c)}>{c.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
            <button type="button" className="soai-ib" aria-label="Renomear" title="Renomear" data-soai="rename" onClick={() => setRenaming({ id: c.id, value: c.title })}><Pencil size={13} /></button>
            <button type="button" className="soai-ib" data-danger aria-label="Excluir" title="Excluir" data-soai="del" onClick={() => setConfirmDel(c.id)}><Trash2 size={13} /></button>
          </span>
        )}
        {!isRen && !isDel && <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }} className="soai-when">{fmtWhen(c.updated_at)}</span>}
      </div>
    )
  }

  return (
    <div className="soai-root" data-soai="chat">
      <style>{CSS}</style>
      {drawer && <div onClick={() => setDrawer(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 25, backdropFilter: 'blur(2px)' }} />}

      {/* ═══ HISTÓRICO ═══ */}
      <aside className={`soai-hist${drawer ? ' open' : ''}`} aria-label="Histórico de conversas">
        <div style={{ padding: '14px 12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" data-soai="new" onClick={newConversation} disabled={sending}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 12, border: 'none', background: 'var(--grad-primary)', color: '#fff', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? .6 : 1, boxShadow: 'var(--shadow-purple)' }}>
            <Plus size={16} /> Nova conversa
          </button>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--muted-foreground)' }} />
            <input ref={searchRef} data-soai="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nas conversas…  Ctrl K" aria-label="Buscar nas conversas"
              style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 30px 0 32px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
            {q && <button type="button" className="soai-ib" aria-label="Limpar busca" onClick={() => setQ('')} style={{ position: 'absolute', right: 5, top: 6 }}><X size={13} /></button>}
          </div>
        </div>
        <div className="soai-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }} data-soai="list">
          {convs.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)', padding: '28px 12px', lineHeight: 1.6 }}>
              {q ? 'Nenhuma conversa encontrada para essa busca.' : 'Suas conversas vão aparecer aqui. Comece uma nova!'}
            </p>
          )}
          {groups.map(g => (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <p style={{ margin: '10px 8px 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{g.label}</p>
              {g.items.map(renderRow)}
            </div>
          ))}
          {hasMore && !q && <button type="button" data-soai="more" onClick={() => loadList({ offset: convs.length, append: true })} style={{ width: '100%', height: 32, margin: '4px 0', border: '1px dashed var(--border-strong)', borderRadius: 10, background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Carregar mais</button>}
        </div>
      </aside>

      {/* ═══ CONVERSA ═══ */}
      <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--card)', minHeight: 52 }}>
          <button type="button" className="soai-ib soai-mobile-btn" aria-label="Abrir histórico" onClick={() => setDrawer(true)} style={{ width: 32, height: 32 }}><PanelLeft size={17} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {active && renaming?.id === active.id ? null : (
              <button type="button" data-soai="title" disabled={!active} onClick={() => active && setRenaming({ id: active.id, value: active.title })} title={active ? 'Clique para renomear' : undefined}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', border: 'none', background: 'transparent', padding: 0, cursor: active ? 'text' : 'default', fontFamily: 'inherit', color: 'var(--foreground)' }}>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active ? active.title : 'Nova conversa'}</span>
                {active && <Pencil size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />}
              </button>
            )}
            {active && renaming?.id === active.id && (
              <input autoFocus aria-label="Novo nome da conversa" data-soai="title-input" value={renaming.value} maxLength={120} onChange={e => setRenaming({ id: active.id, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { skipBlur.current = true; saveRename() } else if (e.key === 'Escape') { skipBlur.current = true; setRenaming(null) } }}
                onBlur={() => { if (skipBlur.current) { skipBlur.current = false; return } saveRename() }}
                style={{ width: 'min(420px,100%)', boxSizing: 'border-box', height: 30, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--primary)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
            )}
          </div>
          {active && messages.length > 0 && (
            <span style={{ display: 'inline-flex', gap: 2 }}>
              <button type="button" className="soai-act" data-soai="copy-conv" onClick={() => copy('conv', toMarkdown(active.title, messages))}>{copied === 'conv' ? <Check size={13} /> : <Copy size={13} />}{copied === 'conv' ? 'Copiado' : 'Copiar conversa'}</button>
              <button type="button" className="soai-act" data-soai="export" onClick={exportMd}><Download size={13} />Exportar .md</button>
            </span>
          )}
        </div>

        {banner && (
          <div role="alert" data-soai="banner" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 18px 0', padding: '9px 12px', borderRadius: 10, background: 'color-mix(in srgb,var(--destructive) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--destructive) 30%,transparent)', color: 'var(--destructive)', fontSize: 12.5, fontWeight: 600 }}>
            <AlertTriangle size={15} /><span style={{ flex: 1 }}>{banner}</span><button type="button" className="soai-ib" aria-label="Fechar aviso" onClick={() => setBanner(null)}><X size={13} /></button>
          </div>
        )}

        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} onScroll={onScroll} className="soai-scroll" role="log" aria-busy={sending} data-soai="messages" style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 8px' }}>
            {loadingConv && <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted-foreground)', padding: 30 }} data-soai="loading">Abrindo conversa…</p>}

            {!loadingConv && messages.length === 0 && (
              <div data-soai="empty" style={{ maxWidth: 760, margin: '0 auto', paddingTop: 'clamp(12px,5vh,56px)', textAlign: 'center' }}>
                <motion.div initial={{ scale: .85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  style={{ width: 88, height: 88, borderRadius: 22, margin: '0 auto 16px', background: img ? 'transparent' : 'var(--grad-hot)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: img ? 'none' : 'var(--shadow-purple)' }}>
                  <SalesOpsAiIcon size={img ? 84 : 36} />
                </motion.div>
                <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(19px,2.4vw,24px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--foreground)' }}>Como posso ajudar na operação de Sales Ops?</h2>
                <p style={{ margin: '0 auto 24px', maxWidth: 520, fontSize: 13.5, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>Pergunte sobre roleta comercial, fluxos e automações do CRM, ofertas, cadastro de closers… Eu respondo com passo a passo e os links do processo.</p>
                <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Comece por aqui</p>
                <div className="soai-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, textAlign: 'left' }}>
                  {starters.slice(0, 6).map((s, i) => (
                    <motion.button key={s} type="button" data-soai="starter" className="soai-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 * i }} onClick={() => send(s)}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb,var(--primary) 12%,transparent)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BookOpen size={16} /></span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.45, alignSelf: 'center' }}>{s}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <AnimatePresence initial={false}>
                {messages.map((m, i) => {
                  const mine = m.role === 'user', isLast = i === messages.length - 1
                  return (
                    <motion.div key={m.id} data-soai="msg" data-role={m.role} data-streaming={!!m.streaming} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: mine ? 'row-reverse' : 'row' }}>
                      {!mine && <span style={{ width: 34, height: 34, borderRadius: 11, background: img ? 'transparent' : 'var(--grad-hot)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: img ? 'none' : 'var(--shadow-sm)' }}><SalesOpsAiIcon size={img ? 34 : 17} /></span>}
                      <div style={{ maxWidth: mine ? '78%' : 'calc(100% - 44px)', minWidth: 0 }}>
                        <div style={mine
                          ? { padding: '10px 15px', borderRadius: '16px 4px 16px 16px', background: 'var(--grad-primary)', color: '#fff', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: 'var(--shadow-sm)' }
                          : { padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                          {mine ? m.content : (
                            <>
                              {m.streaming && !m.content && <span style={{ display: 'inline-flex', gap: 5, padding: '4px 0' }} data-soai="thinking">{[0, 1, 2].map(k => <span key={k} className="soai-dot" style={{ animationDelay: `${k * .18}s` }} />)}</span>}
                              {m.content && <Markdown text={m.content} />}
                              {m.streaming && m.content && <span className="soai-caret" aria-hidden />}
                            </>
                          )}
                        </div>
                        {m.error && mine && (
                          <div data-soai="msg-error" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--destructive)', fontWeight: 600 }}>
                            <AlertTriangle size={13} />{m.error}
                            <button type="button" className="soai-act" data-soai="retry" onClick={regenerate} style={{ color: 'var(--destructive)' }}><RefreshCw size={12} />Tentar de novo</button>
                          </div>
                        )}
                        {!mine && !m.streaming && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, marginTop: 4 }}>
                            {m.is_gap && <button type="button" data-soai="gap-doc" onClick={() => onDocument(questionFor(i), m.id)} className="soai-act" style={{ color: '#b45309', background: 'color-mix(in srgb,var(--warning) 14%,transparent)', borderColor: 'color-mix(in srgb,var(--warning) 35%,transparent)' }}><FileWarning size={13} />Sem processo documentado · Documentar</button>}
                            {m.incomplete && <span data-soai="incomplete" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--warning)', padding: '0 6px' }}><AlertTriangle size={12} />{m.error ?? 'Resposta interrompida ou cortada pelo limite'}</span>}
                            <button type="button" className="soai-act" data-soai="copy" onClick={() => copy(m.id, m.content)}>{copied === m.id ? <Check size={13} /> : <Copy size={13} />}{copied === m.id ? 'Copiado' : 'Copiar'}</button>
                            {isLast && !sending && <button type="button" className="soai-act" data-soai="regen" onClick={regenerate}><RefreshCw size={13} />Regenerar</button>}
                            <button type="button" className="soai-act" data-soai="up" data-on={m.feedback === 1} aria-label="Resposta boa" aria-pressed={m.feedback === 1} onClick={() => onThumb(m, 1)}><ThumbsUp size={13} /></button>
                            <button type="button" className="soai-act" data-soai="down" data-on={m.feedback === -1 ? 'down' : false} aria-label="Resposta ruim" aria-pressed={m.feedback === -1} onClick={() => onThumb(m, -1)}><ThumbsDown size={13} /></button>
                          </div>
                        )}
                        {!mine && noteFor === m.id && m.feedback === -1 && (
                          <div data-soai="note" style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} maxLength={500} placeholder="O que estava errado ou faltando? (opcional)" aria-label="O que estava errado"
                              onKeyDown={e => { if (e.key === 'Enter') { sendFeedback(m, -1, noteText); setNoteFor(null) } else if (e.key === 'Escape') setNoteFor(null) }}
                              style={{ flex: 1, height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
                            <button type="button" className="soai-act" data-soai="note-save" onClick={() => { sendFeedback(m, -1, noteText); setNoteFor(null) }} style={{ background: 'var(--secondary)', borderColor: 'var(--border)' }}>Enviar</button>
                          </div>
                        )}
                        {!mine && m.feedback === -1 && m.feedback_note && noteFor !== m.id && <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--muted-foreground)' }}>Sua observação: {m.feedback_note}</p>}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
            <div style={{ height: 14 }} />
          </div>
          <AnimatePresence>
            {!atBottom && messages.length > 0 && (
              <motion.button type="button" data-soai="to-bottom" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={toBottom} aria-label="Ir para o fim da conversa"
                style={{ position: 'absolute', right: 24, bottom: 10, width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowDown size={16} /></motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ ESCREVER ═══ */}
        <div style={{ padding: '8px 18px 14px', background: 'var(--background)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 8px 8px 14px', borderRadius: 18, border: '1.5px solid var(--border-strong)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
              <textarea ref={inputRef} data-soai="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1} disabled={loadingConv} aria-label="Pergunta para o Sales Ops AI"
                placeholder="Pergunte sobre um processo… ex.: como cadastrar um novo closer?"
                style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 14, lineHeight: 1.55, fontFamily: 'inherit', padding: '7px 0', maxHeight: 190 }} />
              {sending ? (
                <button type="button" data-soai="stop" onClick={stop} aria-label="Parar a resposta" title="Parar"
                  style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'var(--foreground)', color: 'var(--background)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Square size={14} fill="currentColor" /></button>
              ) : (
                <button type="button" data-soai="send" onClick={() => send()} disabled={!input.trim()} aria-label="Enviar" title="Enviar (Enter)"
                  style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: input.trim() ? 'var(--grad-primary)' : 'var(--secondary)', color: input.trim() ? '#fff' : 'var(--muted-foreground)', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s ease, transform .15s ease' }}><ArrowUp size={18} /></button>
              )}
            </div>
            <p style={{ margin: '7px 4px 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted-foreground)' }}>
              <CornerDownLeft size={11} /> Enter envia · Shift+Enter quebra a linha
              {input.length > 6500 && <span style={{ color: input.length > MAX_MESSAGE_CHARS ? 'var(--destructive)' : 'var(--warning)', fontWeight: 700 }}>· {input.length}/{MAX_MESSAGE_CHARS}</span>}
              <span style={{ marginLeft: 'auto', opacity: .85 }}>A IA responde com base nos processos cadastrados em Configuração. Confira antes de mexer em produção.</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
