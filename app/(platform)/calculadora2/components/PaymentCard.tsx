'use client'
import { useState, useCallback } from 'react'
import { Copy, Check, CopyCheck, ClipboardList, Sparkles } from 'lucide-react'
import { SimResult, fmt, buildCopyText, buildFullNegotiationText } from '../lib/pricing'

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch {}
  }, [])
  return { copied, copy }
}

interface Props {
  result:        SimResult | null
  produtoLabel:  string
  precoCheio:    number
  precoBase:     number
  upsellLabel?:  string
  upsellPrice?:  number
  vertical:      string
  eventDiscount?: number
  cashDiscountPct: number
}

export function PaymentCard({
  result, produtoLabel, precoCheio, precoBase,
  upsellLabel, upsellPrice = 0, vertical, eventDiscount, cashDiscountPct,
}: Props) {
  const { copied, copy } = useCopy()

  if (!result) return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '60px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🧮</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>Simulação aparecerá aqui</p>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Configure vertical, produto e forma<br />de pagamento ao lado</p>
    </div>
  )

  const totalCheio  = precoCheio + upsellPrice
  const totalBase   = precoBase  + upsellPrice
  const economia    = totalCheio - totalBase
  const pctOff      = Math.round((1 - totalBase / totalCheio) * 100)
  const isSemJuros  = result.rate === 0

  const allText     = buildCopyText(result, produtoLabel)
  const fullText    = buildFullNegotiationText({ produtoLabel, precoCheio, precoBase, result, upsellLabel, upsellPrice })

  const modeLabel =
    result.mode === 'avista'    ? '💵 Pagamento à Vista' :
    result.mode === 'parcelado' ? (isSemJuros ? '📅 Parcelamento Sem Juros' : '📅 Parcelamento') :
    result.mode === '3x'        ? '3️⃣ 3x Sem Juros' :
    result.mode === 'manual'    ? '⚙️ Parcelamento Manual' :
    `🎯 Evento${eventDiscount ? ` — ${eventDiscount}% off` : ''}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Valor percebido ─────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#1a0533,#2e1065,#3730a3)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 8px 32px rgba(79,70,229,0.25)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: '40%', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>💎 Valor percebido</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px' }}>De</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#f87171', margin: 0, textDecoration: 'line-through', letterSpacing: '-0.02em' }}>{fmt(totalCheio)}</p>
            </div>
            <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>→</div>
            <div>
              <p style={{ fontSize: 11, color: '#4ade80', margin: '0 0 2px', fontWeight: 700 }}>Por apenas</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#4ade80', margin: 0, letterSpacing: '-0.03em' }}>{fmt(totalBase)}</p>
            </div>
          </div>
          {upsellLabel && upsellPrice > 0 && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '8px 0 0' }}>
              Inclui: <strong style={{ color: '#a78bfa' }}>{upsellLabel}</strong>
            </p>
          )}
          {economia > 0 && (
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                ✅ Economia de {fmt(economia)} ({pctOff}% off)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Simulação de pagamento ─────────────────────── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 60%,var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>{modeLabel}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
              {/* Não mostrar juros para à vista */}
              {result.mode !== 'avista' && !isSemJuros && `${result.rate}% a.m. — `}
              {isSemJuros && result.mode !== 'avista' && 'Sem juros — '}
              {produtoLabel}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => copy(allText, 'all')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${copied === 'all' ? '#22c55e' : 'rgba(99,102,241,0.3)'}`, background: copied === 'all' ? 'rgba(34,197,94,0.08)' : 'rgba(99,102,241,0.06)', color: copied === 'all' ? '#16a34a' : '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0 }}>
              {copied === 'all' ? <><Check size={13} /> Copiado!</> : <><CopyCheck size={13} /> Copiar</>}
            </button>
            {/* Ícone para copiar negociação completa apelativa */}
            <button onClick={() => copy(fullText, 'full')} title="📋 Copiar negociação completa para o lead"
              style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${copied === 'full' ? '#22c55e' : 'rgba(99,102,241,0.3)'}`, background: copied === 'full' ? 'rgba(34,197,94,0.08)' : 'rgba(99,102,241,0.06)', color: copied === 'full' ? '#16a34a' : '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = copied==='full' ? 'rgba(34,197,94,0.08)' : 'rgba(99,102,241,0.06)' }}>
              {copied === 'full' ? <Check size={15} /> : <ClipboardList size={15} />}
            </button>
          </div>
        </div>

        {/* À Vista — layout atraente */}
        {result.aVista !== undefined && (
          <div style={{ padding: '20px 22px' }}>
            {/* Destaque do desconto */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.1))', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 14 }}>
              <Sparkles size={13} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#16a34a' }}>{cashDiscountPct}% de desconto à vista</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Valor à vista</p>
                <p style={{ fontSize: 38, fontWeight: 900, color: '#22c55e', margin: '0 0 8px', letterSpacing: '-0.04em', lineHeight: 1 }}>{fmt(result.aVista)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', display: 'inline-flex' as any }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                    💚 Economize mais {fmt(totalBase - result.aVista)} pagando hoje!
                  </span>
                </div>
              </div>
              <button onClick={() => copy(`${produtoLabel}\n\n💵 À vista (${cashDiscountPct}% off): ${fmt(result.aVista!)}\n💚 Economize ${fmt(totalBase - result.aVista!)} pagando hoje!`, 'av')}
                style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${copied === 'av' ? '#22c55e' : 'var(--border)'}`, background: copied === 'av' ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: copied === 'av' ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                {copied === 'av' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Parcelas */}
        {result.parcelas && result.parcelas.length > 0 && (
          <div>
            {result.parcelas.map(({ n, valor }, idx) => {
              const isLast     = idx === result.parcelas!.length - 1
              const isDestaque = isLast && result.parcelas!.length > 1
              const isCopied   = copied === `p${n}`

              return (
                <div key={n}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderBottom: idx < result.parcelas!.length - 1 ? '1px solid var(--border)' : 'none', background: isDestaque ? 'color-mix(in srgb,rgba(99,102,241,0.05) 100%,transparent)' : 'transparent', transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isDestaque) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb,var(--secondary) 30%,transparent)' }}
                  onMouseLeave={e => { if (!isDestaque) (e.currentTarget as HTMLElement).style.background = isDestaque ? 'color-mix(in srgb,rgba(99,102,241,0.05) 100%,transparent)' : 'transparent' }}>

                  {/* Badge Nx */}
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: isDestaque ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--secondary)', border: isDestaque ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: isDestaque ? '0 4px 14px rgba(79,70,229,0.35)' : 'none' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: isDestaque ? '#fff' : 'var(--foreground)', letterSpacing: '-0.02em' }}>{n}x</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: isDestaque ? 19 : 16, fontWeight: 800, color: isDestaque ? '#4f46e5' : 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
                      {n}x de <span style={{ color: isDestaque ? '#4f46e5' : '#22c55e' }}>{fmt(valor)}</span>
                    </p>
                    {isDestaque && result.parcelas!.length > 3 && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'inline-block', marginTop: 3 }}>
                        ⭐ Maior parcelamento
                      </span>
                    )}
                    {isSemJuros && (
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, display: 'block', marginTop: 2 }}>sem juros</span>
                    )}
                  </div>

                  <button onClick={() => copy(`${n}x de ${fmt(valor)}`, `p${n}`)}
                    style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${isCopied ? '#22c55e' : 'var(--border)'}`, background: isCopied ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: isCopied ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { if (!isCopied) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1' } }}
                    onMouseLeave={e => { if (!isCopied) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)' } }}>
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>



      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', margin: 0 }}>
        Simulação para uso interno · Valores sujeitos a confirmação
      </p>
    </div>
  )
}
