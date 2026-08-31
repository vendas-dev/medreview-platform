'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, User, Plus, MessageSquare, ChevronLeft, Menu, Pencil, Check, X, Sparkles, Compass, Wallet, MessagesSquare, Rocket, CornerDownLeft } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

interface Message { role: 'user' | 'assistant'; content: string }
interface Conversation { id: string; title: string; created_at: string }

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.trim() === '---') return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
    if (line.startsWith('## ')) return <p key={i} style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '14px 0 4px' }}>{parseBold(line.slice(3))}</p>
    if (line.startsWith('# '))  return <p key={i} style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', margin: '16px 0 6px' }}>{parseBold(line.slice(2))}</p>
    if (line.startsWith('- '))  return <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}><span style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>•</span><span>{parseBold(line.slice(2))}</span></div>
    if (line.trim() === '')     return <div key={i} style={{ height: 6 }} />
    return <p key={i} style={{ margin: '2px 0', lineHeight: 1.7 }}>{parseBold(line)}</p>
  })
}

function parseBold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : p
  )
}

// ── MedAIAvatar ─── com identidade visual própria: anel gradiente + brilho ──
function MedAIAvatar({ size = 30 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, padding: 2,
      background: 'linear-gradient(135deg,#818cf8,#a78bfa,#c084fc)',
      boxShadow: '0 2px 10px rgba(129,140,248,0.35)',
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#1a0a2e' }}>
        <img src="/medy-avatar.png" alt="Medy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  )
}

function UserAvatar({ name, avatarUrl, size = 30 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
  if (avatarUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', fontSize: Math.floor(size * 0.4), fontWeight: 700, color: 'var(--card)' }}>
      {initials}
    </div>
  )
}

// ── Sugestões — cards com ícone + título + descrição, não mais pills ──
const SUGGESTIONS = [
  { icon: Compass,        title: 'Processo de vendas',   desc: 'Entenda o fluxo comercial do início ao fechamento.',      question: 'Como funciona o processo de vendas?' },
  { icon: Wallet,         title: 'Produtos e ofertas',   desc: 'Conheça os produtos, ofertas e principais diferenças.',   question: 'Quais são os produtos e ofertas da MedReview?' },
  { icon: MessagesSquare, title: 'Objeções comerciais',  desc: 'Aprenda a conduzir as principais objeções.',              question: 'Como lidar com objeções comerciais?' },
  { icon: Rocket,         title: 'Primeiros passos',     desc: 'Descubra por onde começar seu onboarding.',               question: 'Quais são meus primeiros passos no onboarding?' },
]

export function CopilotChat({ userName, userAvatarUrl, welcomeMessage, conversations: initialConvs }: {
  userName: string; userAvatarUrl?: string | null; welcomeMessage: string; conversations: Conversation[]
}) {
  const [messages, setMessages]         = useState<Message[]>([{ role: 'assistant', content: welcomeMessage }])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations]   = useState<Conversation[]>(initialConvs)
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const bottomRef   = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ── Tema — paleta refinada de 3 níveis, só no modo escuro ──────────
  // (light mode continua usando as variáveis globais normalmente, sem
  // necessidade de ajuste — o pedido era especificamente sobre o dark)
  let isDark = false
  const { theme } = useTheme()
  isDark = theme === 'dark'
  const palette = isDark
    ? { bg: '#0B1220', surface: '#141E30', surfaceHover: '#19263B', border: 'rgba(255,255,255,.08)', text: '#F8FAFC', secondary: '#94A3B8' }
    : { bg: 'var(--background)', surface: 'var(--card)', surfaceHover: 'var(--secondary)', border: 'var(--border)', text: 'var(--foreground)', secondary: 'var(--muted-foreground)' }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (editingId) editInputRef.current?.focus() }, [editingId])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res  = await fetch('/api/onboarding/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
        setConversations(prev => [{ id: data.conversationId, title: msg.substring(0, 40), created_at: new Date().toISOString() }, ...prev])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar. Tente novamente.' }])
    } finally { setLoading(false) }
  }

  async function loadConversation(conv: Conversation) {
    setConversationId(conv.id); setSidebarOpen(false); setLoading(true)
    try {
      const res  = await fetch(`/api/onboarding/messages?conversationId=${conv.id}`)
      const data = await res.json()
      setMessages(data.messages?.length ? data.messages : [{ role: 'assistant', content: welcomeMessage }])
    } catch { setMessages([{ role: 'assistant', content: welcomeMessage }]) }
    setLoading(false)
  }

  function newConversation() {
    setConversationId(null)
    setMessages([{ role: 'assistant', content: welcomeMessage }])
    setSidebarOpen(false)
  }

  async function saveTitle(id: string) {
    if (!editingTitle.trim()) { setEditingId(null); return }
    await fetch('/api/onboarding/conversations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editingTitle }),
    })
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editingTitle } : c))
    setEditingId(null)
  }

  // Estado inicial (central de onboarding) vs. conversa em andamento —
  // a distinção visual que transforma o vazio numa tela de boas-vindas.
  const isEmptyState = messages.length === 1

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden', background: palette.bg }}>
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40, backdropFilter: 'blur(3px)' }} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 288, background: palette.surface, borderRight: `1px solid ${palette.border}`, display: 'flex', flexDirection: 'column', zIndex: 50, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)', boxShadow: sidebarOpen ? '8px 0 32px rgba(0,0,0,0.12)' : 'none' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MedAIAvatar size={28} />
            <span style={{ fontSize: 14, fontWeight: 800, color: palette.text }}>Histórico Medy</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.secondary }}>
            <ChevronLeft size={16} />
          </button>
        </div>
        <div style={{ padding: '10px 10px 6px' }}>
          <button onClick={newConversation}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px dashed ${palette.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: palette.secondary, fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = palette.surfaceHover; e.currentTarget.style.borderStyle = 'solid' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed' }}>
            <Plus size={14} /> Nova conversa
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {conversations.map(conv => (
            <div key={conv.id}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 10, marginBottom: 2, background: conv.id === conversationId ? palette.surfaceHover : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
              onMouseEnter={e => {
                if (conv.id !== conversationId) (e.currentTarget as HTMLElement).style.background = palette.surfaceHover
                const btn = e.currentTarget.querySelector('.edit-btn') as HTMLElement | null
                if (btn) btn.style.opacity = '1'
              }}
              onMouseLeave={e => {
                if (conv.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'transparent'
                const btn = e.currentTarget.querySelector('.edit-btn') as HTMLElement | null
                if (btn) btn.style.opacity = '0'
              }}>
              <MessageSquare size={12} style={{ color: palette.secondary, flexShrink: 0 }} />
              {editingId === conv.id ? (
                <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                  <input ref={editInputRef} value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(conv.id); if (e.key === 'Escape') setEditingId(null) }}
                    style={{ flex: 1, height: 26, padding: '0 8px', borderRadius: 6, border: `1.5px solid ${palette.text}`, background: palette.bg, color: palette.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={() => saveTitle(conv.id)} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} style={{ color: 'white' }} /></button>
                  <button onClick={() => setEditingId(null)} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: palette.border, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={11} style={{ color: palette.secondary }} /></button>
                </div>
              ) : (
                <>
                  <button onClick={() => loadConversation(conv)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: palette.text, fontFamily: 'inherit', textAlign: 'left', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title || 'Nova conversa'}
                  </button>
                  <button className="edit-btn" onClick={e => { e.stopPropagation(); setEditingId(conv.id); setEditingTitle(conv.title) }}
                    style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.secondary, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = palette.border)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <Pencil size={10} />
                  </button>
                </>
              )}
            </div>
          ))}
          {conversations.length === 0 && <p style={{ fontSize: 12, color: palette.secondary, padding: '16px', textAlign: 'center' }}>Sem histórico. Comece uma conversa!</p>}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: palette.bg }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${palette.border}`, background: palette.surface, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)}
            style={{ width: 34, height: 34, borderRadius: 14, border: `1px solid ${palette.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.secondary, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = palette.surfaceHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Menu size={15} />
          </button>
          <MedAIAvatar size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: palette.text, margin: 0, letterSpacing: '-0.01em' }}>Medy</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span style={{ fontSize: 9.5, color: palette.secondary, fontWeight: 600 }}>Online</span>
              </span>
            </div>
            <p style={{ fontSize: 11, color: palette.secondary, margin: 0 }}>Assistente de onboarding · MedReview</p>
          </div>
          <button onClick={newConversation}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 16px', borderRadius: 999, border: `1px solid ${palette.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: palette.secondary, fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = palette.surfaceHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Plus size={13} /> Nova conversa
          </button>
        </div>

        {isEmptyState ? (
          // ═══ ESTADO INICIAL — central de onboarding inteligente ═══
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
            <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#818cf8,#a78bfa,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, boxShadow: '0 8px 24px rgba(129,140,248,0.3)' }}>
                <Sparkles size={24} style={{ color: '#fff' }} />
              </div>

              <h1 style={{ fontSize: 26, fontWeight: 800, color: palette.text, margin: '0 0 10px', letterSpacing: '-0.02em' }}>Olá, eu sou a Medy.</h1>
              <p style={{ fontSize: 14.5, color: palette.secondary, margin: '0 0 32px', lineHeight: 1.65, maxWidth: 480 }}>{welcomeMessage}</p>

              {/* Input protagonista */}
              <div style={{ width: '100%', maxWidth: 740, position: 'relative', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 68, padding: '0 10px 0 20px', borderRadius: 22, border: `1.5px solid ${palette.border}`, background: palette.surface, boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.28)' : 'var(--shadow-md)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#818cf8'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 4px rgba(129,140,248,0.14)' }}
                  onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = palette.border; (e.currentTarget as HTMLElement).style.boxShadow = isDark ? '0 12px 32px rgba(0,0,0,0.28)' : 'var(--shadow-md)' }}>
                  <Sparkles size={18} style={{ color: '#a78bfa', flexShrink: 0 }} />
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="O que você gostaria de aprender hoje?"
                    disabled={loading}
                    style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: palette.text, fontSize: 15.5, fontFamily: 'inherit' }} />
                  <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                    style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: input.trim() && !loading ? 1 : 0.35, transition: 'all 0.15s', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
                    <Send size={19} />
                  </button>
                </div>
                <p style={{ fontSize: 10.5, color: palette.secondary, margin: '10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: .8 }}>
                  <CornerDownLeft size={10} /> Enter para enviar
                </p>
              </div>

              {/* Sugestões — cards, não mais pills */}
              <p style={{ fontSize: 11, fontWeight: 800, color: palette.secondary, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 14px' }}>Comece por aqui</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, width: '100%' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s.title} onClick={() => sendMessage(s.question)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px', borderRadius: 18, border: `1px solid ${palette.border}`, background: palette.surface, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.18s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = palette.surfaceHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(129,140,248,0.4)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = palette.surface; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.borderColor = palette.border }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(129,140,248,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <s.icon size={17} style={{ color: '#818cf8' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: palette.text, margin: '0 0 3px' }}>{s.title}</p>
                      <p style={{ fontSize: 12, color: palette.secondary, margin: 0, lineHeight: 1.45 }}>{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // ═══ MODO CONVERSA ═══
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 0', background: palette.bg }}>
              <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                    {m.role === 'user'
                      ? <UserAvatar name={userName} avatarUrl={userAvatarUrl} size={30} />
                      : <MedAIAvatar size={30} />
                    }
                    <div style={{
                      maxWidth: '78%', padding: '12px 16px', borderRadius: 16, fontSize: 14,
                      background: m.role === 'user' ? palette.text : palette.surface,
                      color: m.role === 'user' ? palette.bg : palette.text,
                      border: m.role === 'assistant' ? `1px solid ${palette.border}` : 'none',
                      borderTopRightRadius: m.role === 'user' ? 4 : 16,
                      borderTopLeftRadius: m.role === 'assistant' ? 4 : 16,
                      boxShadow: m.role === 'assistant' ? 'var(--shadow-sm)' : '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                      {m.role === 'assistant'
                        ? <div style={{ lineHeight: 1.7 }}>{renderMarkdown(m.content)}</div>
                        : <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <MedAIAvatar size={30} />
                    <div style={{ padding: '12px 16px', borderRadius: 16, background: palette.surface, border: `1px solid ${palette.border}`, display: 'flex', gap: 5, alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: palette.secondary, animation: `dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} style={{ height: 20 }} />
              </div>
            </div>

            {/* Input — modo conversa, ancorado embaixo */}
            <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${palette.border}`, background: palette.surface, flexShrink: 0 }}>
              <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Pergunte qualquer coisa à Medy..."
                  disabled={loading}
                  style={{ flex: 1, height: 48, padding: '0 20px', borderRadius: 20, border: `1.5px solid ${palette.border}`, background: palette.bg, color: palette.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s' }}
                  onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.14)' }}
                  onBlur={e => { e.target.style.borderColor = palette.border; e.target.style.boxShadow = 'none' }} />
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  style={{ width: 48, height: 48, borderRadius: 20, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: input.trim() && !loading ? 1 : 0.35, transition: 'all 0.15s', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}
