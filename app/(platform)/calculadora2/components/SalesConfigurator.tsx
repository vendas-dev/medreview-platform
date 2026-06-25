'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import { PriceRow, PaymentMode } from '../lib/types'
import { fmt, rateForVertical } from '../lib/pricing'
import { AppSettings } from '../lib/types'
import { Plus, X } from 'lucide-react'
import { CustomSelect } from './CustomSelect'

// ── Design tokens inline ──────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
  overflow: 'hidden',
}

const sectionHeader = (emoji: string, title: string, subtitle?: string) => (
  <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 50%,var(--card))' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{subtitle}</p>}
      </div>
    </div>
  </div>
)

function unique(arr: string[]) { return [...new Set(arr.filter(Boolean))].sort() }
function toOpts(arr: string[]) { return arr.map(v => ({ value: v, label: v })) }

interface Props {
  rows:         PriceRow[]
  settings:     AppSettings
  vertical:     string; setVertical:    (v: string) => void
  produto:      string; setProduto:     (v: string) => void
  tempo:        string; setTempo:       (v: string) => void
  tipoAluno:    string; setTipoAluno:   (v: string) => void
  canal:        string; setCanal:       (v: string) => void
  upsellOn:     boolean; setUpsellOn:   (v: boolean) => void
  upsellProduto:string; setUpsellProduto:(v: string) => void
  upsellRow:    PriceRow | null
  usoInterno:   boolean; setUsoInterno:  (v: boolean) => void
  paymentMode:  PaymentMode; setPaymentMode: (v: PaymentMode) => void
  manualN:      number; setManualN:     (v: number) => void
  manualRate:   number; setManualRate:  (v: number) => void
  eventoSub:    'avista'|'parcelado'; setEventoSub: (v:'avista'|'parcelado')=>void
  selectedRow:  PriceRow | null
}

// ── InstallmentSelect — dropdown customizado com opções estilizadas ──
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
          width:'100%',height:44,borderRadius:12,cursor:'pointer',
          border:`1.5px solid ${open?'#6366f1':'var(--border)'}`,
          background:open?'color-mix(in srgb,rgba(99,102,241,.06),var(--background))':'var(--background)',
          boxShadow:open?'0 0 0 3px rgba(99,102,241,.1)':'none',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,
          padding:'0 14px',fontFamily:'inherit',transition:'all .15s',
        }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18,fontWeight:900,color:isSpecial?'#f59e0b':'#6366f1',minWidth:36,textAlign:'left',letterSpacing:'-0.02em'}}>{sel?.label}</span>
          <span style={{fontSize:12,color:'var(--muted-foreground)',fontWeight:400}}>{isSpecial?'⭐ '+sel?.desc:sel?.desc}</span>
        </div>
        <svg style={{flexShrink:0,color:open?'#6366f1':'var(--muted-foreground)',transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open&&(
        <div ref={ref} style={{...pos,background:'var(--card)',border:'1.5px solid rgba(99,102,241,.2)',borderRadius:14,
          boxShadow:'0 20px 60px rgba(0,0,0,.15),0 4px 12px rgba(99,102,241,.1)',overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
          <style>{`@keyframes instDrop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div style={{animation:'instDrop .14s ease',padding:'4px 0'}}>
            {/* Separador especial */}
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
                    <span style={{fontSize:15,fontWeight:900,color:isSel?'#6366f1':'var(--foreground)',minWidth:32,letterSpacing:'-0.02em'}}>{opt.label}</span>
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
                    <span style={{fontSize:15,fontWeight:900,color:isSel?'#f59e0b':'var(--foreground)',minWidth:32,letterSpacing:'-0.02em'}}>{opt.label}</span>
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


export function SalesConfigurator(props: Props) {
  const {
    rows, settings, vertical, setVertical, produto, setProduto,
    tempo, setTempo, tipoAluno, setTipoAluno, canal, setCanal,
    upsellOn, setUpsellOn, upsellProduto, setUpsellProduto, upsellRow,
    usoInterno, setUsoInterno, paymentMode, setPaymentMode,
    manualN, setManualN, manualRate, setManualRate, eventoSub, setEventoSub,
    selectedRow,
  } = props

  // Cascata
  const verticals  = useMemo(() => toOpts(unique(rows.map(r => r.vertical))), [rows])
  const produtos   = useMemo(() => toOpts(unique(rows.filter(r => !vertical  || r.vertical  === vertical).map(r => r.produto))), [rows, vertical])
  const tempos     = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)).map(r => r.tempoAcesso))), [rows, vertical, produto])
  const tipos      = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)&&(!tempo||r.tempoAcesso===tempo)).map(r => r.tipoAluno))), [rows, vertical, produto, tempo])
  const canais     = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)&&(!tempo||r.tempoAcesso===tempo)&&(!tipoAluno||r.tipoAluno===tipoAluno)).map(r => r.canalVenda))), [rows, vertical, produto, tempo, tipoAluno])

  // Upsell: todos os produtos (da vertical do time) exceto o selecionado.
  // Mostra a vertical na label quando for diferente do produto atual.
  // Não filtra por tempo/tipoAluno/canal — upsell é para mostrar complementos.
  const upsellOptions = useMemo(() => {
    const seen = new Set<string>()
    return rows
      .filter(r => r.produto !== produto)
      .reduce<{value:string;label:string}[]>((acc, r) => {
        if (!seen.has(r.produto)) {
          seen.add(r.produto)
          const lbl = r.vertical && r.vertical !== vertical
            ? `${r.produto} — ${r.vertical}`
            : r.produto
          acc.push({ value: r.produto, label: lbl })
        }
        return acc
      }, [])
      .sort((a,b) => a.label.localeCompare(b.label))
  }, [rows, produto, vertical])

  const MODES: { mode: PaymentMode; label: string; desc: string; internal?: boolean }[] = [
    { mode: 'parcelado', label: 'Parcelado', desc: `até 12x c/ juros` },
    { mode: 'avista',    label: 'À Vista',   desc: `${settings.cashDiscountPercent}% de desconto` },
    { mode: 'evento',    label: 'Evento',    desc: 'desconto especial' },
    { mode: '3x',        label: '3x Sem Juros', desc: 'divisão simples', internal: true },
    { mode: 'manual',    label: 'Manual',    desc: 'configurar parcelas', internal: true },
  ]
  const visibleModes = MODES.filter(m => !m.internal || usoInterno)
  const currentRate  = rateForVertical(vertical || '', settings)
  const isSemJuros   = currentRate === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Produto ──────────────────────────────────────── */}
      <div style={card}>
        {sectionHeader('🔍', 'Configurar venda', 'Selecione o produto e condições')}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CustomSelect label="Vertical" value={vertical}
            onChange={v => { setVertical(v); setProduto(''); setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto('') }}
            options={verticals} placeholder="Selecionar vertical..." />
          <CustomSelect label="Produto" value={produto}
            onChange={v => { setProduto(v); setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto('') }}
            options={produtos} disabled={!vertical} placeholder="Selecionar produto..." />
          <CustomSelect label="Tempo de acesso" value={tempo}
            onChange={v => { setTempo(v); setTipoAluno(''); setCanal('') }}
            options={tempos} disabled={!produto} placeholder="Selecionar período..." />
          <CustomSelect label="Tipo de aluno" value={tipoAluno}
            onChange={v => { setTipoAluno(v); setCanal('') }}
            options={tipos} disabled={!tempo} placeholder="Selecionar tipo..." />
          <CustomSelect label="Canal de venda" value={canal}
            onChange={setCanal} options={canais} disabled={!tipoAluno} placeholder="Selecionar canal..." />
        </div>

        {/* Resumo do produto */}
        {selectedRow && (
          <div style={{ margin: '0 20px 16px', padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(124,58,237,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✅ Selecionado</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{selectedRow.produto}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{selectedRow.tempoAcesso} · {selectedRow.tipoAluno}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 2px', textDecoration: 'line-through' }}>{fmt(selectedRow.precoCheio)}</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#22c55e', margin: 0, letterSpacing: '-0.02em' }}>{fmt(selectedRow.precoEspecial)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Upsell ───────────────────────────────────────── */}
      {selectedRow && upsellOptions.length > 0 && (
        <div style={{ ...card, border: upsellOn ? '1.5px solid rgba(34,197,94,0.35)' : '1px solid var(--border)' }}>
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: upsellOn ? 'rgba(34,197,94,0.05)' : 'transparent' }}
            onClick={() => { setUpsellOn(!upsellOn); if (upsellOn) setUpsellProduto('') }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: upsellOn ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {upsellOn ? <X size={15} style={{ color: '#fff' }} /> : <Plus size={15} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Adicionar produto ao investimento</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Upsell da mesma vertical</p>
              </div>
            </div>
            {upsellRow && (
              <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>+{fmt(upsellRow.precoEspecial)}</span>
            )}
          </div>

          {upsellOn && (
            <div style={{ padding: '0 20px 16px' }}>
              <CustomSelect label="Produto adicional" value={upsellProduto}
                onChange={setUpsellProduto} options={upsellOptions} placeholder="Selecionar produto adicional..." />
              {upsellRow && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 11, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', margin: 0 }}>{upsellRow.produto}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{upsellRow.tempoAcesso}</p>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', margin: 0 }}>{fmt(upsellRow.precoEspecial)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Forma de pagamento ────────────────────────────── */}
      <div style={card}>
        {sectionHeader('💳', 'Forma de pagamento', isSemJuros ? `${vertical} — 12x sem juros` : `${vertical} — ${currentRate}% a.m.`)}
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleModes.map(m => {
            const active = paymentMode === m.mode
            return (
              <label key={m.mode} onClick={() => setPaymentMode(m.mode)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 13, border: `1.5px solid ${active ? '#4f46e5' : 'var(--border)'}`, background: active ? 'rgba(99,102,241,0.06)' : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.25)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? '#4f46e5' : 'var(--border)'}`, background: active ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#4f46e5' : 'var(--foreground)', margin: 0 }}>{m.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{m.desc}</p>
                </div>
              </label>
            )
          })}
        </div>

        {/* Sub-opção Evento */}
        {paymentMode === 'evento' && (
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
            {(['parcelado', 'avista'] as const).map(sub => (
              <button key={sub} onClick={() => setEventoSub(sub)}
                style={{ flex: 1, height: 38, borderRadius: 10, border: `1.5px solid ${eventoSub === sub ? '#4f46e5' : 'var(--border)'}`, background: eventoSub === sub ? 'rgba(99,102,241,0.08)' : 'transparent', color: eventoSub === sub ? '#4f46e5' : 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {sub === 'parcelado' ? '📅 Parcelado' : '💵 À Vista'}
              </button>
            ))}
          </div>
        )}

        {/* Campos Manual */}
        {paymentMode === 'manual' && (
          <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nº de parcelas</label>
              <InstallmentSelect value={manualN} onChange={setManualN}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Taxa mensal (%)</label>
              <input type="number" min={0} step={0.01} value={manualRate} onChange={e => setManualRate(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', height: 48, padding: '0 16px', borderRadius: 13, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Uso Interno ──────────────────────────────────── */}
      <div style={{ ...card, padding: '14px 20px' }}>
        <label onClick={() => setUsoInterno(!usoInterno)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ width: 42, height: 24, borderRadius: 999, background: usoInterno ? '#4f46e5' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: usoInterno ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>🔒 Uso Interno</p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Libera condições especiais</p>
          </div>
        </label>
      </div>
    </div>
  )
}
