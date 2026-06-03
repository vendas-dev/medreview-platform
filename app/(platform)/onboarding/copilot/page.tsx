'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [welcomed, setWelcomed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Busca mensagem de boas-vindas
    if (!welcomed) {
      fetch('/api/onboarding/welcome')
        .then(r => r.json())
        .then(d => {
          if (d.message) {
            setMessages([{ role: 'assistant', content: d.message }])
          }
          setWelcomed(true)
        }).catch(() => setWelcomed(true))
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      if (data.conversationId) setConversationId(data.conversationId)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar sua mensagem. Tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    'O que é a MedReview?',
    'Como funciona o processo de vendas?',
    'Quais são os principais produtos?',
    'Como lidar com objeções?',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--foreground) 8%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={18} style={{ color: 'var(--foreground)' }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>MedReview Copilot</p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Assistente de onboarding com IA</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'color-mix(in srgb, var(--foreground) 8%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Bot size={28} style={{ color: 'var(--foreground)' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Copilot de Onboarding</h2>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>Pergunte qualquer coisa sobre o onboarding da MedReview.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.role === 'user' ? 'var(--foreground)' : 'color-mix(in srgb, var(--foreground) 10%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {m.role === 'user'
                  ? <User size={15} style={{ color: 'var(--card)' }} />
                  : <Bot size={15} style={{ color: 'var(--foreground)' }} />
                }
              </div>
              <div style={{
                maxWidth: '75%', padding: '12px 16px', borderRadius: 14, fontSize: 14, lineHeight: 1.6,
                background: m.role === 'user' ? 'var(--foreground)' : 'var(--card)',
                color: m.role === 'user' ? 'var(--card)' : 'var(--foreground)',
                border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                borderTopRightRadius: m.role === 'user' ? 4 : 14,
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 14,
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'color-mix(in srgb, var(--foreground) 10%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={15} style={{ color: 'var(--foreground)' }} />
              </div>
              <div style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--muted-foreground)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Pergunte qualquer coisa sobre o onboarding..."
            disabled={loading}
            style={{ flex: 1, height: 48, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => (e.target.style.borderColor = 'var(--foreground)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--foreground)', color: 'var(--card)', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s', opacity: input.trim() && !loading ? 1 : 0.4 }}>
            <Send size={18} />
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}
