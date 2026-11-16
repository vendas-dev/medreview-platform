'use client'
import { useState } from 'react'
import { Copy, Check, MessageCircle } from 'lucide-react'

function renderWhatsAppText(text: string) {
  return text.split('\n').map((line, i) => (
    <p key={i} style={{ margin: 0, minHeight: line ? undefined : '0.9em', lineHeight: 1.5 }}>
      {line.split(/(\*[^*]+\*)/g).map((part, j) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2
          ? <strong key={j}>{part.slice(1, -1)}</strong>
          : <span key={j}>{part}</span>
      )}
    </p>
  ))
}

export function WhatsAppPreview({ message, isHoveringParcela }: { message: string; isHoveringParcela: boolean }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 50%,var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={14} style={{ color: '#22c55e' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Prévia WhatsApp
          </span>
        </div>
        {isHoveringParcela && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 7px', borderRadius: 4 }}>
            atualizando ao vivo
          </span>
        )}
      </div>

      {/* Fundo estilo WhatsApp */}
      <div style={{
        padding: 16, minHeight: 200,
        background: 'repeating-linear-gradient(45deg, rgba(37,211,102,0.02) 0, rgba(37,211,102,0.02) 2px, transparent 2px, transparent 12px), #0b141a',
      }}>
        <div style={{
          background: '#005c4b', borderRadius: '10px 10px 10px 2px', padding: '10px 12px 8px',
          maxWidth: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: 'background 0.15s',
        }}>
          <div style={{ fontSize: 13, color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {renderWhatsAppText(message)}
          </div>
          <p style={{ fontSize: 10, color: 'rgba(233,237,239,0.5)', textAlign: 'right', margin: '4px 0 0' }}>
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
          </p>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <button onClick={handleCopy}
          style={{ width: '100%', height: 38, borderRadius: 10, border: `1.5px solid ${copied ? '#22c55e' : 'var(--border)'}`, background: copied ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: copied ? '#16a34a' : 'var(--foreground)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s' }}>
          {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar mensagem</>}
        </button>
      </div>
    </div>
  )
}
