'use client'
import { useState, useCallback } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { SimResult, fmt, buildWhatsAppMessage } from '../lib/pricing'

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch {}
  }, [])
  return { copied, copy }
}

interface Props {
  result:       SimResult | null
  cursoLabel:   string
  tempoAcesso?: string
  entregaveis?: string
  totalCheio:   number
  totalBase:    number
  onHoverParcela: (p: { n: number; valor: number } | null) => void
}

// Versão compacta — menor que a original, pra caber embaixo da prévia do
// WhatsApp na coluna da direita, sem dominar o layout.
export function InstallmentsPanel({ result, cursoLabel, tempoAcesso, entregaveis, totalCheio, totalBase, onHoverParcela }: Props) {
  const { copied, copy } = useCopy()
  const [expanded, setExpanded] = useState(false)

  const parcelas = result?.parcelas ?? []
  if (!result || parcelas.length === 0) return null

  const isSemJuros  = result.rate === 0
  const recomendada = parcelas[parcelas.length - 1]

  function buildMessage(parcela?: { n: number; valor: number } | null) {
    return buildWhatsAppMessage({ cursoLabel, tempoAcesso, entregaveis, totalCheio, totalBase, result: result!, parcela })
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 60%,var(--card))' }}>
        <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parcelamento</p>
      </div>

      {!expanded ? (
        <button onClick={() => setExpanded(true)}
          onMouseEnter={() => onHoverParcela(recomendada)}
          onMouseLeave={() => onHoverParcela(null)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}
          onFocus={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fff', fontFamily: "'JetBrains Mono',monospace" }}>{recomendada.n}x</span>
          </div>
          <p style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#4f46e5', margin: 0 }}>
            {recomendada.n}x de <span style={{ color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(recomendada.valor)}</span>
          </p>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            Ver todas <ChevronDown size={12} />
          </span>
        </button>
      ) : (
        <div>
          <button onClick={() => { setExpanded(false); onHoverParcela(null) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', background: 'var(--secondary)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)', fontFamily: 'inherit' }}>
            Recolher <ChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {parcelas.map(({ n, valor }, idx) => {
              const isLast     = idx === parcelas.length - 1
              const isDestaque = isLast && parcelas.length > 1
              const isCopied   = copied === `p${n}`
              return (
                <div key={n}
                  onMouseEnter={() => onHoverParcela({ n, valor })}
                  onMouseLeave={() => onHoverParcela(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: idx < parcelas.length - 1 ? '1px solid var(--border)' : 'none', background: isDestaque ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = isDestaque ? 'rgba(99,102,241,0.09)' : 'var(--secondary)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = isDestaque ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: isDestaque ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--secondary)', border: isDestaque ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: isDestaque ? '#fff' : 'var(--foreground)', fontFamily: "'JetBrains Mono',monospace" }}>{n}x</span>
                  </div>
                  <p style={{ flex: 1, fontSize: 11.5, fontWeight: 800, color: isDestaque ? '#4f46e5' : 'var(--foreground)', margin: 0 }}>
                    {n}x de <span style={{ color: isDestaque ? '#4f46e5' : '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(valor)}</span>
                    {isSemJuros && <span style={{ fontSize: 8.5, color: '#22c55e', fontWeight: 700, marginLeft: 5 }}>s/ juros</span>}
                  </p>
                  <button onClick={() => copy(buildMessage({ n, valor }), `p${n}`)}
                    style={{ width: 22, height: 22, borderRadius: 5, border: `1.5px solid ${isCopied ? '#22c55e' : 'var(--border)'}`, background: isCopied ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: isCopied ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isCopied ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
