'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Plus, MessageSquare, ChevronLeft, Menu, Pencil, Check, X } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }
interface Conversation { id: string; title: string; created_at: string }

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Linha separadora
    if (line.trim() === '---') {
      return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
    }
    // Cabeçalho ##
    if (line.startsWith('## ')) {
      const content = line.slice(3)
      const parts = parseBold(content)
      return <p key={i} style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '14px 0 4px' }}>{parts}</p>
    }
    // Cabeçalho #
    if (line.startsWith('# ')) {
      const content = line.slice(2)
      return <p key={i} style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', margin: '16px 0 6px' }}>{parseBold(content)}</p>
    }
    // Item de lista
    if (line.startsWith('- ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
          <span style={{ color: 'var(--muted-foreground)', flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{parseBold(line.slice(2))}</span>
        </div>
      )
    }
    // Linha vazia
    if (line.trim() === '') {
      return <div key={i} style={{ height: 6 }} />
    }
    // Parágrafo normal
    return <p key={i} style={{ margin: '2px 0', lineHeight: 1.7 }}>{parseBold(line)}</p>
  })
}

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'inherit' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function CopilotChat({ userName, welcomeMessage, conversations: initialConvs }: {
  userName: string; welcomeMessage: string; conversations: Conversation[]
}) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: welcomeMessage }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>(initialConvs)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (editingId) editInputRef.current?.focus() }, [editingId])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/chat', {
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro. Tente novamente.' }])
    } finally { setLoading(false) }
  }

  async function loadConversation(conv: Conversation) {
    setConversationId(conv.id); setSidebarOpen(false); setLoading(true)
    try {
      const res = await fetch(`/api/onboarding/messages?conversationId=${conv.id}`)
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

  const suggestions = ['O que é a MedReview?', 'Como funciona o processo de vendas?', 'Quais são os produtos?', 'Como lidar com objeções?']

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40, backdropFilter: 'blur(2px)' }} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar histórico */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 288, background: 'var(--card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 50, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)', boxShadow: sidebarOpen ? '8px 0 32px rgba(0,0,0,0.12)' : 'none' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>Histórico</span>
          <button onClick={() => setSidebarOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
            <ChevronLeft size={16} />
          </button>
        </div>
        <div style={{ padding: '10px 10px 6px' }}>
          <button onClick={newConversation}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.borderStyle = 'solid' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed' }}>
            <Plus size={14} /> Nova conversa
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {conversations.map(conv => (
            <div key={conv.id}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 10, marginBottom: 2, background: conv.id === conversationId ? 'var(--secondary)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
              onMouseEnter={e => { if (conv.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; (e.currentTarget.querySelector('.edit-btn') as HTMLElement | null)?.style.setProperty('opacity', '1') }}
              onMouseLeave={e => { if (conv.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget.querySelector('.edit-btn') as HTMLElement | null)?.style.setProperty('opacity', '0') }}>
              <MessageSquare size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              {editingId === conv.id ? (
                <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                  <input ref={editInputRef} value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(conv.id); if (e.key === 'Escape') setEditingId(null) }}
                    style={{ flex: 1, height: 26, padding: '0 8px', borderRadius: 6, border: '1.5px solid var(--foreground)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={() => saveTitle(conv.id)} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={11} style={{ color: 'white' }} />
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={11} style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => loadConversation(conv)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--foreground)', fontFamily: 'inherit', textAlign: 'left', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title || 'Conversa'}
                  </button>
                  <button className="edit-btn" onClick={e => { e.stopPropagation(); setEditingId(conv.id); setEditingTitle(conv.title) }}
                    style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <Pencil size={10} />
                  </button>
                </>
              )}
            </div>
          ))}
          {conversations.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '16px', textAlign: 'center' }}>Nenhuma conversa ainda</p>}
        </div>
      </div>

      {/* Chat principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Menu size={15} />
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--foreground) 8%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={17} style={{ color: 'var(--foreground)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>MedReview Copilot</p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Assistente de onboarding com IA</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Online</span>
          </div>
          <button onClick={newConversation} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Plus size={13} /> Nova
          </button>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 0' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--card)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.role === 'user' ? 'var(--foreground)' : 'color-mix(in srgb, var(--foreground) 10%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                  {m.role === 'user' ? <User size={14} style={{ color: 'var(--card)' }} /> : <Bot size={14} style={{ color: 'var(--foreground)' }} />}
                </div>
                <div style={{
                  maxWidth: '78%', padding: '12px 16px', borderRadius: 16, fontSize: 14,
                  background: m.role === 'user' ? 'var(--foreground)' : 'var(--card)',
                  color: m.role === 'user' ? 'var(--card)' : 'var(--foreground)',
                  border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderTopRightRadius: m.role === 'user' ? 4 : 16,
                  borderTopLeftRadius: m.role === 'assistant' ? 4 : 16,
                  boxShadow: m.role === 'assistant' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.15)',
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
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'color-mix(in srgb, var(--foreground) 10%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={14} style={{ color: 'var(--foreground)' }} />
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', gap: 5, alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--muted-foreground)', animation: `dot 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} style={{ height: 20 }} />
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0 }}>
          <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', gap: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Pergunte qualquer coisa sobre o onboarding..."
              disabled={loading}
              style={{ flex: 1, height: 48, padding: '0 18px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--foreground)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--foreground) 8%, transparent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--foreground)', color: 'var(--card)', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: input.trim() && !loading ? 1 : 0.35, transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}
