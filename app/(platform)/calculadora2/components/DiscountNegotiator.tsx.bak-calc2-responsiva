'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { fmt } from '../lib/pricing'

interface Props {
  pv:             number
  maxPct:         number
  discountPct:    number
  setDiscountPct: (v: number) => void
  targetValue:    string
  setTargetValue: (v: string) => void
  impliedPct:     number | null
  isOverLimit:    boolean
  effectivePV:    number
  defaultPct:     number
}

export function DiscountNegotiator({
  pv, maxPct, discountPct, setDiscountPct,
  targetValue, setTargetValue,
  impliedPct, isOverLimit, effectivePV, defaultPct,
}: Props) {
  const [showManual, setShowManual] = useState(false)

  const activePct = impliedPct !== null ? (isOverLimit ? discountPct : impliedPct) : discountPct
  const thumbPct  = Math.min(Math.max(activePct / maxPct, 0), 1) * 100
  const mid       = Math.round(maxPct / 2)
  const accent    = isOverLimit ? '#ef4444' : activePct > maxPct * 0.75 ? '#f59e0b' : '#6366f1'

  // Alinha o balão: à esquerda nos 10% iniciais, à direita nos 10% finais, centrado no meio
  const labelAlign = thumbPct < 10 ? 'left' : thumbPct > 90 ? 'right' : 'center'
  const labelTranslate = thumbPct < 10 ? '0%' : thumbPct > 90 ? '-100%' : '-50%'

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${isOverLimit ? 'rgba(239,68,68,.35)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: '14px 16px 16px',
      transition: 'border-color .2s',
    }}>
      <style>{`
        .disc-slider {
          -webkit-appearance: none; appearance: none;
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          opacity: 0; cursor: pointer; margin: 0; padding: 0;
        }
      `}</style>

      {/* Título */}
      <p style={{
        fontSize: 9, fontWeight: 800, color: 'var(--muted-foreground)',
        textTransform: 'uppercase', letterSpacing: '.12em', margin: '0 0 14px',
      }}>
        Desconto da negociação
      </p>

      {/* ── Container de altura fixa ──────────────────────────────────
          Toda a UI do slider (ticks + track + balão) vive aqui dentro,
          posicionada em absoluto, sem vazar para fora da caixa.        */}
      <div style={{ position: 'relative', height: 80 }}>

        {/* Ticks — linha do topo */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between',
        }}>
          {[0, mid, maxPct].map(t => (
            <span key={t} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', userSelect: 'none' }}>
              {t}%
            </span>
          ))}
        </div>

        {/* Track — 26px abaixo dos ticks */}
        <div style={{
          position: 'absolute', top: 26, left: 0, right: 0,
          height: 6, borderRadius: 999, background: 'var(--secondary)',
        }}>
          {/* Fill */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${thumbPct}%`,
            borderRadius: 999,
            background: isOverLimit ? '#ef4444' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
            transition: 'width .06s, background .2s',
            pointerEvents: 'none',
          }}/>

          {/* Thumb visual */}
          <div style={{
            position: 'absolute', top: '50%',
            left: `${thumbPct}%`,
            transform: 'translate(-50%, -50%)',
            width: 18, height: 18, borderRadius: '50%',
            background: accent,
            border: '3px solid var(--card)',
            boxShadow: `0 2px 8px ${accent}55`,
            transition: 'left .06s, background .2s',
            pointerEvents: 'none',
            zIndex: 1,
          }}/>

          {/* Range input invisível — cobre todo o track para interação nativa */}
          <input
            className="disc-slider"
            type="range" min={0} max={maxPct} step={0.5}
            value={activePct}
            onChange={e => {
              setTargetValue('')
              setDiscountPct(parseFloat(e.target.value))
            }}
          />
        </div>

        {/* Balão de valor — 42px abaixo do topo (16px abaixo do track) */}
        <div style={{
          position: 'absolute', top: 46,
          left: `${thumbPct}%`,
          transform: `translateX(${labelTranslate})`,
          textAlign: labelAlign,
          minWidth: 72,
          pointerEvents: 'none',
          transition: 'left .06s',
        }}>
          <span style={{
            display: 'block',
            fontSize: 16, fontWeight: 900,
            color: accent,
            letterSpacing: '-0.02em', lineHeight: 1.1,
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'color .2s',
          }}>
            {activePct.toFixed(1)}%
          </span>
          <span style={{
            display: 'block',
            fontSize: 11, fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>
            {fmt(effectivePV)}
          </span>
        </div>
      </div>
      {/* ── fim do container de altura fixa ─────────────────────── */}

      {/* Aviso fora do limite — fluxo normal, abaixo do container */}
      {isOverLimit && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 7, marginBottom: 10,
          background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.25)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
            ⚠ {(impliedPct ?? 0).toFixed(1)}% — acima do limite de {maxPct}%
          </span>
        </div>
      )}

      {/* Toggle "Definir valor manualmente" — sempre no fluxo, sem sobreposição */}
      <button
        type="button"
        onClick={() => setShowManual(s => !s)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          marginTop: 18, padding: 0, background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
        <ChevronDown
          size={12}
          style={{
            color: 'var(--muted-foreground)',
            transition: 'transform .15s',
            transform: showManual ? 'rotate(180deg)' : 'none',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>
          Definir valor manualmente
        </span>
      </button>

      {showManual && (
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
            placeholder={`Ex: ${fmt(pv * 0.9).replace('R$\u00a0', '')}`}
            style={{
              width: '100%', height: 40, padding: '0 12px',
              borderRadius: 8,
              border: `1.5px solid ${isOverLimit ? 'rgba(239,68,68,.5)' : 'var(--border)'}`,
              background: 'var(--background)', color: 'var(--foreground)',
              fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color .15s',
            }}
          />
          {impliedPct !== null && (
            <p style={{ fontSize: 11, margin: '4px 0 0', color: isOverLimit ? '#ef4444' : 'var(--muted-foreground)' }}>
              {isOverLimit
                ? `Isso representa ${impliedPct.toFixed(1)}% de desconto — acima do limite.`
                : `Desconto de ${impliedPct.toFixed(1)}% sobre o preço base.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
