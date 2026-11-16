'use client'
import { useState, useCallback, useEffect } from 'react'
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
//
// Mouse: passar o mouse numa parcela mostra ela na prévia (como sempre).
// Toque/clique: tocar numa parcela a FIXA na prévia (no celular não existe
// "passar o mouse"); tocar de novo solta. Fixar também funciona com o mouse.
export function InstallmentsPanel({ result, cursoLabel, tempoAcesso, entregaveis, totalCheio, totalBase, onHoverParcela }: Props) {
  const { copied, copy } = useCopy()
  const [expanded, setExpanded] = useState(false)
  const [pinned,   setPinned]   = useState<number | null>(null)

  const parcelas = result?.parcelas ?? []
  // Mudou a forma de pagamento e a parcela fixada não existe mais: solta.
  useEffect(() => { if (pinned !== null && !parcelas.some(p => p.n === pinned)) setPinned(null) }, [parcelas, pinned])
  if (!result || parcelas.length === 0) return null

  const isSemJuros  = result.rate === 0
  const recomendada = parcelas[parcelas.length - 1]
  const fixa        = pinned !== null ? parcelas.find(p => p.n === pinned) ?? null : null

  function buildMessage(parcela?: { n: number; valor: number } | null) {
    return buildWhatsAppMessage({ cursoLabel, tempoAcesso, entregaveis, totalCheio, totalBase, result: result!, parcela })
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 60%,var(--card))' }}>
        <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parcelamento</p>
      </div>

      {!expanded ? (
        <button onClick={() => setExpanded(true)} aria-expanded={false} className="calc2-tap calc2-inst-collapsed"
          onMouseEnter={() => onHoverParcela(recomendada)}
          onMouseLeave={() => onHoverParcela(null)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', minHeight: 48, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fff', fontFamily: "'JetBrains Mono',monospace" }}>{recomendada.n}x</span>
          </div>
          <p style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, color: '#4f46e5', margin: 0, overflowWrap: 'anywhere' }}>
            {recomendada.n}x de <span style={{ color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(recomendada.valor)}</span>
          </p>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            Ver todas <ChevronDown size={12} />
          </span>
        </button>
      ) : (
        <div>
          <button onClick={() => { setExpanded(false); setPinned(null); onHoverParcela(null) }} aria-expanded={true} className="calc2-tap"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', minHeight: 36, background: 'var(--secondary)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)', fontFamily: 'inherit' }}>
            Recolher <ChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <p style={{ margin: 0, padding: '7px 14px', fontSize: 10.5, lineHeight: 1.4, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
            Toque (ou passe o mouse) numa parcela para ver na prévia do WhatsApp.
          </p>
          <div className="calc2-inst-list" style={{ maxHeight: 'min(320px, 55vh)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {parcelas.map(({ n, valor }, idx) => {
              const isLast     = idx === parcelas.length - 1
              const isDestaque = isLast && parcelas.length > 1
              const isCopied   = copied === `p${n}`
              const isPinned   = pinned === n
              return (
                <div key={n} className="calc2-inst-row" data-n={n} data-pinned={isPinned ? '1' : '0'} data-destaque={isDestaque ? '1' : '0'}
                  onMouseEnter={() => onHoverParcela({ n, valor })}
                  onMouseLeave={() => onHoverParcela(fixa)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: idx < parcelas.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <button type="button" aria-pressed={isPinned} className="calc2-tap calc2-inst-main"
                    onClick={() => { if (isPinned) { setPinned(null); onHoverParcela(null) } else { setPinned(n); onHoverParcela({ n, valor }) } }}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px 6px 14px', minHeight: 36, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: isDestaque ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--secondary)', border: isDestaque ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, color: isDestaque ? '#fff' : 'var(--foreground)', fontFamily: "'JetBrains Mono',monospace" }}>{n}x</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 800, color: isDestaque ? '#4f46e5' : 'var(--foreground)', overflowWrap: 'anywhere' }}>
                      {n}x de <span style={{ color: isDestaque ? '#4f46e5' : '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(valor)}</span>
                      {isSemJuros && <span style={{ fontSize: 8.5, color: '#22c55e', fontWeight: 700, marginLeft: 5 }}>s/ juros</span>}
                    </span>
                  </button>
                  <button type="button" onClick={() => copy(buildMessage({ n, valor }), `p${n}`)} aria-label={`Copiar mensagem com ${n}x`} title="Copiar mensagem" className="calc2-copybtn"
                    style={{ width: 30, height: 30, margin: '0 12px 0 0', borderRadius: 7, border: `1.5px solid ${isCopied ? '#22c55e' : 'var(--border)'}`, background: isCopied ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: isCopied ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        .calc2-inst-collapsed:hover, .calc2-inst-collapsed:focus-visible { background: var(--secondary) !important; }
        .calc2-inst-row { transition: background 0.1s; }
        .calc2-inst-row[data-destaque="1"] { background: rgba(99,102,241,0.05); }
        .calc2-inst-row:hover { background: var(--secondary); }
        .calc2-inst-row[data-destaque="1"]:hover { background: rgba(99,102,241,0.09); }
        .calc2-inst-row[data-pinned="1"] { background: rgba(99,102,241,0.14); box-shadow: inset 3px 0 0 #6366f1; }
        .calc2-inst-main:focus-visible, .calc2-copybtn:focus-visible { outline: 2px solid #6366f1; outline-offset: -2px; border-radius: 6px; }
        @media (pointer: coarse) { .calc2-inst-main { min-height: 48px !important; } .calc2-inst-row .calc2-copybtn { margin-right: 6px !important; } }
      `}</style>
    </div>
  )
}
