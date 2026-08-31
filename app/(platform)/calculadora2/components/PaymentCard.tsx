'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Copy, Check, Zap, ChevronDown } from 'lucide-react'
import { SimResult, fmt, pmt, buildWhatsAppMessage } from '../lib/pricing'
import { PaymentMode } from '../lib/types'
import { DiscountNegotiator } from './DiscountNegotiator'

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch {}
  }, [])
  return { copied, copy }
}

// ── InstallmentSelect — dropdown pro modo Manual ────────────────
const INSTALLMENT_OPTS = [
  {value:1,  label:'1x',  desc:'Pagamento único'},
  {value:2,  label:'2x',  desc:'Curto prazo'},
  {value:3,  label:'3x',  desc:'Curto prazo'},
  {value:4,  label:'4x',  desc:'Curto prazo'},
  {value:5,  label:'5x',  desc:'Médio prazo'},
  {value:6,  label:'6x',  desc:'Médio prazo'},
  {value:7,  label:'7x',  desc:'Médio prazo'},
  {value:8,  label:'8x',  desc:'Médio prazo'},
  {value:9,  label:'9x',  desc:'Longo prazo'},
  {value:10, label:'10x', desc:'Longo prazo'},
  {value:11, label:'11x', desc:'Longo prazo'},
  {value:12, label:'12x', desc:'Longo prazo'},
  {value:18, label:'18x', desc:'Especial'},
  {value:24, label:'24x', desc:'Especial'},
]

function InstallmentSelect({ value, onChange }: { value:number; onChange:(v:number)=>void }) {
  const [open, setOpen] = useState(false)
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos,  setPos]  = useState<React.CSSProperties>({})
  const sel = INSTALLMENT_OPTS.find(o=>o.value===value)

  useEffect(()=>{
    if(!open) return
    const h=(e:MouseEvent)=>{ if(!ref.current?.contains(e.target as Node)&&!btnRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[open])

  function handleOpen(){
    if(!btnRef.current) return
    const r=btnRef.current.getBoundingClientRect()
    const opts=INSTALLMENT_OPTS.length
    const dropH=Math.min(opts*48+8,320)
    const below=window.innerHeight-r.bottom-8
    setPos({
      position:'fixed',left:r.left,width:r.width,zIndex:9999,
      ...(below<dropH&&r.top>dropH?{bottom:window.innerHeight-r.top+4}:{top:r.bottom+4}),
    })
    setOpen(o=>!o)
  }

  const isSpecial = value===18||value===24
  return (
    <div style={{position:'relative'}}>
      <button ref={btnRef} type="button" onClick={handleOpen}
        style={{
          width:'100%',height:44,borderRadius:8,cursor:'pointer',
          border:`1.5px solid ${open?'#6366f1':'var(--border)'}`,
          background:open?'color-mix(in srgb,rgba(99,102,241,.06),var(--background))':'var(--background)',
          boxShadow:open?'0 0 0 3px rgba(99,102,241,.1)':'none',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,
          padding:'0 14px',fontFamily:'inherit',transition:'all .15s',
        }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18,fontWeight:900,color:isSpecial?'#f59e0b':'#6366f1',minWidth:36,textAlign:'left',letterSpacing:'-0.02em',fontFamily:"'JetBrains Mono',monospace"}}>{sel?.label}</span>
          <span style={{fontSize:12,color:'var(--muted-foreground)',fontWeight:400}}>{isSpecial?'⭐ '+sel?.desc:sel?.desc}</span>
        </div>
        <ChevronDown size={13} style={{ color: open?'#6366f1':'var(--muted-foreground)', transition:'transform .2s', transform: open?'rotate(180deg)':'none' }} />
      </button>

      {open&&(
        <div ref={ref} style={{...pos,background:'var(--card)',border:'1.5px solid rgba(99,102,241,.2)',borderRadius:10,
          boxShadow:'0 20px 60px rgba(0,0,0,.15),0 4px 12px rgba(99,102,241,.1)',overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
          <style>{`@keyframes instDrop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div style={{animation:'instDrop .14s ease',padding:'4px 0'}}>
            <div style={{padding:'6px 14px 4px',fontSize:9,fontWeight:800,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'.1em'}}>Parcelamento padrão</div>
            {INSTALLMENT_OPTS.filter(o=>o.value<=12).map(opt=>{
              const isSel=opt.value===value
              return (
                <button key={opt.value} type="button" onClick={()=>{onChange(opt.value);setOpen(false)}}
                  style={{
                    width:'100%',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,
                    background:isSel?'linear-gradient(135deg,rgba(99,102,241,.12),rgba(124,58,237,.07))':'transparent',
                    border:'none',cursor:'pointer',fontFamily:'inherit',transition:'background .1s',
                  }}
                  onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.06)'}}
                  onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:15,fontWeight:900,color:isSel?'#6366f1':'var(--foreground)',minWidth:32,letterSpacing:'-0.02em',fontFamily:"'JetBrains Mono',monospace"}}>{opt.label}</span>
                    <span style={{fontSize:11,color:'var(--muted-foreground)'}}>{opt.desc}</span>
                  </div>
                  {isSel&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              )
            })}
            <div style={{margin:'4px 14px',borderTop:'1px solid var(--border)'}}/>
            <div style={{padding:'6px 14px 4px',fontSize:9,fontWeight:800,color:'#f59e0b',textTransform:'uppercase',letterSpacing:'.1em'}}>⭐ Parcelamento especial</div>
            {INSTALLMENT_OPTS.filter(o=>o.value>12).map(opt=>{
              const isSel=opt.value===value
              return (
                <button key={opt.value} type="button" onClick={()=>{onChange(opt.value);setOpen(false)}}
                  style={{
                    width:'100%',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,
                    background:isSel?'linear-gradient(135deg,rgba(245,158,11,.1),rgba(234,179,8,.06))':'transparent',
                    border:'none',cursor:'pointer',fontFamily:'inherit',transition:'background .1s',
                  }}
                  onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background='rgba(245,158,11,.06)'}}
                  onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:15,fontWeight:900,color:isSel?'#f59e0b':'var(--foreground)',minWidth:32,letterSpacing:'-0.02em',fontFamily:"'JetBrains Mono',monospace"}}>{opt.label}</span>
                    <span style={{fontSize:11,color:'var(--muted-foreground)'}}>⭐ {opt.desc}</span>
                  </div>
                  {isSel&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  result:        SimResult | null
  cursoLabel?:   string
  tempoAcesso?:  string
  entregaveis?:  string
  produtoLabel:  string
  precoCheio:    number
  precoBase:     number      // já é o valor NEGOCIADO (effectivePV), vindo de CalculadoraView
  upsellLabel?:  string
  upsellPrice?:  number
  vertical:      string
  eventDiscount?: number
  // Forma de pagamento
  paymentMode:    PaymentMode; setPaymentMode: (v: PaymentMode) => void
  usoInterno:     boolean
  manualN:        number; setManualN:    (v: number) => void
  manualRate:     number; setManualRate: (v: number) => void
  eventoSub:      'avista'|'parcelado'; setEventoSub: (v:'avista'|'parcelado')=>void
  currentRate:    number
  isSemJurosMode: boolean
  // Negociação (barra 0-20%)
  pvOriginal:      number
  effectivePV:     number
  discountPct:     number; setDiscountPct: (v: number) => void
  targetValue:     string; setTargetValue: (v: string) => void
  impliedPct:      number | null
  isOverLimit:     boolean
  defaultCashPct:  number
  maxDiscountPct:  number
  // Prévia ao vivo — reporta qual parcela está sob o mouse
  onHoverParcela: (p: { n: number; valor: number } | null) => void
}

export function PaymentCard({
  result, cursoLabel, tempoAcesso, entregaveis, produtoLabel, precoCheio, precoBase,
  upsellLabel, upsellPrice = 0, vertical, eventDiscount,
  paymentMode, setPaymentMode, usoInterno, manualN, setManualN,
  manualRate, setManualRate, eventoSub, setEventoSub, currentRate, isSemJurosMode,
  pvOriginal, effectivePV, discountPct, setDiscountPct, targetValue, setTargetValue, impliedPct, isOverLimit, defaultCashPct, maxDiscountPct,
  onHoverParcela,
}: Props) {
  const { copied, copy } = useCopy()

  const MODES: { mode: PaymentMode; label: string; icon: string; desc: string; internal?: boolean }[] = [
    { mode: 'parcelado', label: 'Parcelado',      icon: '📅', desc: 'até 12x c/ juros' },
    { mode: 'avista',    label: 'À Vista',         icon: '💵', desc: 'negociável' },
    { mode: 'evento',    label: 'Evento',          icon: '🎯', desc: 'desconto especial' },
    { mode: '3x',        label: '3x Sem Juros',    icon: '3️⃣', desc: 'divisão simples', internal: true },
    { mode: 'manual',    label: 'Manual',          icon: '⚙️', desc: 'parcelas manuais', internal: true },
  ]
  const visibleModes = MODES.filter(m => !m.internal || usoInterno)

  const paymentModeSection = (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 50%,var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Forma de pagamento</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '3px 9px', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace" }}>
          {isSemJurosMode ? `${vertical || '—'} · 12x s/ juros` : `${vertical || '—'} · ${currentRate}% a.m.`}
        </span>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {visibleModes.map(m => {
          const active = paymentMode === m.mode
          return (
            <button key={m.mode} type="button" onClick={() => setPaymentMode(m.mode)}
              style={{
                flex: '1 1 auto', minWidth: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${active ? '#4f46e5' : 'var(--border)'}`,
                background: active ? '#4f46e5' : 'var(--background)',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: active ? '#fff' : 'var(--foreground)', whiteSpace: 'nowrap' }}>{m.label}</span>
            </button>
          )
        })}
      </div>

      {paymentMode === 'evento' && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          {(['parcelado', 'avista'] as const).map(sub => (
            <button key={sub} onClick={() => setEventoSub(sub)}
              style={{ flex: 1, height: 36, borderRadius: 8, border: `1.5px solid ${eventoSub === sub ? '#4f46e5' : 'var(--border)'}`, background: eventoSub === sub ? 'rgba(99,102,241,0.08)' : 'transparent', color: eventoSub === sub ? '#4f46e5' : 'var(--muted-foreground)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {sub === 'parcelado' ? '📅 Parcelado' : '💵 À Vista'}
            </button>
          ))}
        </div>
      )}

      {paymentMode === 'manual' && (
        <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nº de parcelas</label>
            <InstallmentSelect value={manualN} onChange={setManualN}/>
          </div>
          <div>
            <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Taxa mensal (%)</label>
            <input type="number" min={0} step={0.01} value={manualRate} onChange={e => setManualRate(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: 'none' }} />
          </div>
        </div>
      )}
    </div>
  )

  const negotiatorSection = pvOriginal > 0 && (
    <DiscountNegotiator
      pv={pvOriginal} maxPct={maxDiscountPct} discountPct={discountPct} setDiscountPct={setDiscountPct}
      targetValue={targetValue} setTargetValue={setTargetValue}
      impliedPct={impliedPct} isOverLimit={isOverLimit}
      effectivePV={effectivePV}
      defaultPct={defaultCashPct}
    />
  )

  if (!result) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {paymentModeSection}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Simulação aparecerá aqui</p>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Configure vertical e produto ao lado<br />pra ver a oferta completa</p>
      </div>
    </div>
  )

  const totalCheio  = precoCheio   // já vem combinado (produto + upsell) do CalculadoraView
  const totalBase   = precoBase    // idem — já é o valor negociado final, combinado
  const economia    = totalCheio - totalBase
  const pctOff      = totalCheio > 0 ? Math.round((1 - totalBase / totalCheio) * 100) : 0
  const isSemJuros  = result.rate === 0

  const modeLabel =
    result.mode === 'avista'    ? '💵 Pagamento à Vista' :
    result.mode === 'parcelado' ? (isSemJuros ? '📅 Parcelamento Sem Juros' : '📅 Parcelamento') :
    result.mode === '3x'        ? '3️⃣ 3x Sem Juros' :
    result.mode === 'manual'    ? '⚙️ Parcelamento Manual' :
    `🎯 Evento${eventDiscount ? ` — ${eventDiscount}% off` : ''}`

  function buildMessage(parcela?: { n: number; valor: number } | null) {
    return buildWhatsAppMessage({
      cursoLabel: cursoLabel || produtoLabel, tempoAcesso, entregaveis,
      totalCheio, totalBase, result: result!, parcela,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {paymentModeSection}
      {negotiatorSection}

      {/* ── Oferta especial ─────────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg,#0f0524,#1e0b45,#2e1065)', borderRadius: 10, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={11} style={{ fill: '#fbbf24' }} /> Oferta Especial
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px' }}>De</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#f87171', margin: 0, textDecoration: 'line-through', letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(totalCheio)}</p>
            </div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>→</div>
            <div>
              <p style={{ fontSize: 10, color: '#4ade80', margin: '0 0 2px', fontWeight: 700 }}>Por apenas</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: '#4ade80', margin: 0, letterSpacing: '-0.03em', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(totalBase)}</p>
            </div>
          </div>
          {upsellLabel && upsellPrice > 0 && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '8px 0 0' }}>
              Bônus incluso: <strong style={{ color: '#a78bfa' }}>{upsellLabel}</strong>
            </p>
          )}
          {economia > 0 && (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 7, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4ade80' }}>
                🔥 Economia de {fmt(economia)} ({pctOff}% OFF)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Simulação de pagamento ─────────────────────── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 60%,var(--card))' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px' }}>{modeLabel}</p>
          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0 }}>
            {result.mode !== 'avista' && !isSemJuros && `${result.rate}% a.m. — `}
            {isSemJuros && result.mode !== 'avista' && 'Sem juros — '}
            {produtoLabel}
          </p>
        </div>

        {/* À Vista */}
        {result.aVista !== undefined && (
          <div onMouseEnter={() => onHoverParcela(null)}
            style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 5px' }}>Valor à vista</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: '#22c55e', margin: 0, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(result.aVista)}</p>
              </div>
              <button onClick={() => copy(buildMessage(null), 'av')}
                style={{ width: 40, height: 40, borderRadius: 8, border: `1.5px solid ${copied === 'av' ? '#22c55e' : 'var(--border)'}`, background: copied === 'av' ? 'rgba(34,197,94,0.08)' : 'var(--secondary)', color: copied === 'av' ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                {copied === 'av' ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', textAlign: 'center', margin: 0 }}>
        Simulação para uso interno · Valores sujeitos a confirmação
      </p>
    </div>
  )
}
