'use client'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Copy, Check } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  templateIds?: string[]
}

// Avatar da Medy — mesmo anel gradiente usado no Copilot, pra manter a
// identidade visual consistente em toda a plataforma.
function MedyAvatar({ size = 32 }: { size?: number }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, padding: 2,
      background: 'linear-gradient(135deg,#818cf8,#a78bfa,#c084fc)',
      boxShadow: '0 2px 10px rgba(129,140,248,0.35)',
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#1a0a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imgError ? (
          <Sparkles size={Math.round(size * 0.5)} style={{ color: '#c4b5fd' }} />
        ) : (
          <img src="/medy-avatar.png" alt="Medy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)} />
        )}
      </div>
    </div>
  )
}

// Mini card de template recomendado — dentro do chat, autocontido (não
// depende dos componentes visuais da tela principal de Templates).
function RecommendedCard({ t }: { t: any }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(t.content)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        {(t.vertical ?? []).slice(0, 2).map((v: string) => (
          <span key={v} style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}>{v}</span>
        ))}
        {t.validade && <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'rgba(63,145,120,0.09)', color: '#3f9178' }}>{t.validade}</span>}
      </div>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>{t.name}</p>
      <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '0 0 8px', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: expanded ? 'none' : 48, overflow: 'hidden' }}>{t.content}</p>
      {t.content.length > 130 && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ fontSize: 10.5, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0 9px', fontFamily: 'inherit' }}>
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
      <button onClick={handleCopy}
        style={{ width: '100%', height: 30, borderRadius: 8, border: `1.5px solid ${copied ? '#22c55e' : 'var(--border)'}`, background: copied ? 'rgba(34,197,94,0.08)' : 'transparent', color: copied ? '#16a34a' : 'var(--foreground)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}>
        {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
      </button>
    </div>
  )
}

const SUGGESTIONS = [
  'Lead disse que achou caro, mas já é ex-aluno',
  'Cliente sumiu depois de receber a proposta',
  'Preciso reengajar um lead frio da Black Friday',
]

export function MedyTemplateCoach({ templates }: { templates: any[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Ao abrir o painel, pula direto pro final da conversa — sem isso, o
  // conteúdo remonta do zero e começa mostrando a primeira mensagem, mesmo
  // que já exista uma conversa longa.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [open])

  // Enquanto o painel já está aberto, mensagem nova rola suavemente.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const compactTemplates = templates.map(t => ({
        id: t.id, name: t.name, categoria: t.categoria, vertical: t.vertical,
        team: t.team, validade: t.validade, utilidade: t.utilidade,
      }))
      const res = await fetch('/api/templates/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
          templates: compactTemplates,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, templateIds: data.templateIds ?? [] }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar. Tenta de novo?' }])
    } finally { setLoading(false) }
  }

  return (
    <>
      {/* Painel do chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 24, width: 384, maxWidth: 'calc(100vw - 32px)', height: 560, maxHeight: 'calc(100vh - 140px)',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', zIndex: 998, overflow: 'hidden',
          animation: 'medyPopIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <MedyAvatar size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Medy</p>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              </div>
              <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>Assistente Virtual de Templates</p>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <X size={15} />
            </button>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 8px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#818cf8,#a78bfa,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 6px 18px rgba(129,140,248,0.3)' }}>
                  <Sparkles size={19} style={{ color: '#fff' }} />
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 5px' }}>Descreva a situação</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 18px', lineHeight: 1.5 }}>
                  Me conta o contexto do lead ou cliente que eu recomendo a copy certa pra enviar.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(129,140,248,0.4)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                    {m.role === 'assistant' && <MedyAvatar size={26} />}
                    <div style={{
                      maxWidth: '84%', padding: '10px 13px', borderRadius: 14, fontSize: 12.5, lineHeight: 1.55,
                      background: m.role === 'user' ? 'var(--foreground)' : 'var(--secondary)',
                      color: m.role === 'user' ? 'var(--card)' : 'var(--foreground)',
                      borderTopRightRadius: m.role === 'user' ? 4 : 14,
                      borderTopLeftRadius: m.role === 'assistant' ? 4 : 14,
                    }}>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                      {m.templateIds && m.templateIds.length > 0 && (
                        <div>
                          {m.templateIds.map(id => {
                            const t = templates.find(x => x.id === id)
                            return t ? <RecommendedCard key={id} t={t} /> : null
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <MedyAvatar size={26} />
                    <div style={{ padding: '10px 14px', borderRadius: 14, background: 'var(--secondary)', display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted-foreground)', animation: `medyDot 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Descreva a situação..."
                disabled={loading}
                style={{ flex: 1, height: 40, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s' }}
                onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.12)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }} />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: input.trim() && !loading ? 1 : 0.35, transition: 'all 0.15s', boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 58, height: 58, borderRadius: '50%',
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
          boxShadow: open ? '0 8px 24px rgba(79,70,229,0.35)' : '0 8px 24px rgba(79,70,229,0.4), 0 0 0 0 rgba(129,140,248,0.5)',
          animation: open ? 'none' : 'medyPulse 2.6s ease-in-out infinite',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        title="Perguntar à Medy qual template usar">
        {open ? <X size={22} style={{ color: '#fff' }} /> : <MedyAvatar size={40} />}
      </button>

      <style>{`
        @keyframes medyPopIn { from { opacity:0; transform:translateY(12px) scale(.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes medyDot { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes medyPulse {
          0%, 100% { box-shadow: 0 8px 24px rgba(79,70,229,0.4), 0 0 0 0 rgba(129,140,248,0.45); }
          50%      { box-shadow: 0 8px 24px rgba(79,70,229,0.4), 0 0 0 10px rgba(129,140,248,0); }
        }
      `}</style>
    </>
  )
}
