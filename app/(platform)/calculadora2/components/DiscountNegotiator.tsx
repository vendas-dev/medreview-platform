'use client'
import { useState, useRef } from 'react'
import { Lock, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fmt } from '../lib/pricing'

interface Props {
  pv:             number   // preço base, antes da negociação
  maxPct:         number   // limite dessa vertical (configurável)
  discountPct:    number   // 0-maxPct, posição real da barra (só muda quando dentro do limite)
  setDiscountPct: (v: number) => void
  targetValue:    string
  setTargetValue: (v: string) => void
  impliedPct:     number | null
  isOverLimit:    boolean
  effectivePV:    number   // valor final já negociado
  defaultPct:     number   // valor configurado (referência, mostrado como marcador na régua)
}

export function DiscountNegotiator({
  pv, maxPct, discountPct, setDiscountPct, targetValue, setTargetValue,
  impliedPct, isOverLimit, effectivePV, defaultPct,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const displayPct = isOverLimit ? (impliedPct as number) : discountPct
  const fillPct    = Math.min((discountPct / maxPct) * 100, 100)

  function pctFromClientX(clientX: number): number {
    if (!trackRef.current) return discountPct
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    return Math.round(ratio * maxPct * 2) / 2 // passos de 0.5%
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (isOverLimit) return
    setDragging(true)
    setTargetValue('')
    setDiscountPct(pctFromClientX(e.clientX))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || isOverLimit) return
    setDiscountPct(pctFromClientX(e.clientX))
  }
  function handlePointerUp() { setDragging(false) }

  const defaultMarkerPos = Math.min((defaultPct / maxPct) * 100, 100)

  return (
    <div style={{
      background: 'var(--card)', border: `1.5px solid ${isOverLimit ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      {/* Cabeçalho — % em destaque, gigante e vermelho quando estourar o limite */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: isOverLimit ? 'rgba(239,68,68,0.06)' : 'color-mix(in srgb,var(--secondary) 50%,var(--card))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingDown size={14} style={{ color: isOverLimit ? '#ef4444' : '#f59e0b' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Negociação
          </span>
        </div>
        <span style={{
          fontSize: isOverLimit ? 26 : 20, fontWeight: 900, lineHeight: 1,
          color: isOverLimit ? '#ef4444' : displayPct > 0 ? '#f59e0b' : 'var(--muted-foreground)',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '-0.02em',
          transition: 'color 0.15s, font-size 0.15s',
        }}>
          {displayPct.toFixed(1)}%
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Status sempre visível — dentro ou fora do limite, não só quando estoura */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, marginBottom: 12,
          background: isOverLimit ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${isOverLimit ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
        }}>
          {isOverLimit
            ? <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
            : <CheckCircle2 size={12} style={{ color: '#22c55e', flexShrink: 0 }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: isOverLimit ? '#ef4444' : '#16a34a' }}>
            {isOverLimit ? `Acima do limite de ${maxPct}% dessa vertical` : `Dentro do limite (até ${maxPct}%)`}
          </span>
        </div>

        {/* Régua custom — desabilitada visualmente quando isOverLimit */}
        <div style={{ opacity: isOverLimit ? 0.35 : 1, pointerEvents: isOverLimit ? 'none' : 'auto', transition: 'opacity 0.2s', marginBottom: 14 }}>
          <div ref={trackRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
            style={{ position: 'relative', height: 28, cursor: isOverLimit ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fillPct}%`, background: 'linear-gradient(90deg,#d97706,#f59e0b)', transition: dragging ? 'none' : 'width 0.15s' }} />
            </div>
            <div title={`Padrão configurado: ${defaultPct}%`}
              style={{ position: 'absolute', left: `${defaultMarkerPos}%`, top: -2, width: 2, height: 10, background: 'var(--muted-foreground)', opacity: 0.5, transform: 'translateX(-1px)' }} />
            <div style={{
              position: 'absolute', left: `${fillPct}%`, width: 18, height: 18, borderRadius: '50%',
              background: '#f59e0b', border: '3px solid var(--card)', boxShadow: '0 2px 8px rgba(217,119,6,0.5)',
              transform: 'translateX(-9px)', transition: dragging ? 'none' : 'left 0.15s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>0%</span>
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>{maxPct}%</span>
          </div>
        </div>

        {/* Valor negociado + campo de valor desejado lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted-foreground)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor negociado</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: isOverLimit ? '#ef4444' : '#16a34a', margin: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
              {fmt(effectivePV)}
            </p>
          </div>
          <div style={{ minWidth: 130 }}>
            <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Valor desejado
            </label>
            <input
              value={targetValue}
              onChange={e => setTargetValue(e.target.value)}
              placeholder={fmt(pv)}
              inputMode="decimal"
              style={{
                width: '100%', height: 34, padding: '0 10px', borderRadius: 8,
                border: `1.5px solid ${isOverLimit ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                background: 'var(--background)', color: 'var(--foreground)',
                fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: 'none', textAlign: 'right',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
