'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Brain, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Users, BarChart2, Lightbulb,
  AlertCircle, Star, Activity, ChevronLeft, ChevronRight, ChevronDown, Check, X,
} from 'lucide-react'

const fmtBRL = (v: number) => (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})
const fmtPct = (v: number) => `${(v||0).toFixed(1)}%`

// ── Avatar de closer (foto ou iniciais) ───────────────────
function CloserAv({ name, avatarUrl, size=26, color='linear-gradient(135deg,#4f46e5,#7c3aed)' }: {
  name: string; avatarUrl?: string|null; size?: number; color?: string
}) {
  const initials = name.split(' ').slice(0,2).map((n:string)=>n[0]).join('')
  if (avatarUrl) return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:'1.5px solid rgba(99,102,241,.25)' }}>
      <img src={avatarUrl} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }}
        onError={(e:any)=>{ e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerHTML=`<div style="width:${size}px;height:${size}px;borderRadius:50%;background:${color};display:flex;alignItems:center;justifyContent:center;fontSize:${Math.round(size*0.36)}px;fontWeight:900;color:#fff">${initials}</div>` }}/>
    </div>
  )
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.36), fontWeight:900, color:'#fff', flexShrink:0 }}>
      {initials}
    </div>
  )
}

// ── Gráfico de barras verticais (colunas) ──────────────────
// Alturas calculadas em PX (não %) — porcentagem dentro de flexbox
// aninhado não resolve de forma confiável entre navegadores, o que
// fazia barras de valores diferentes aparentarem o mesmo tamanho.
function BarChart({ data, height=160, accent='#6366f1', valueFmt=fmtBRL }: {
  data: { label:string; value:number; color?:string; tooltipSub?:string }[]
  height?: number
  accent?: string
  valueFmt?: (v:number) => string
}) {
  const [hovered, setHovered] = useState<number|null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])

  const max       = Math.max(...data.map(d => d.value), 1)
  const reserved  = 48 // espaço fixo para o rótulo de valor (topo) + nome da barra (base)
  const barMaxPx  = Math.max(height - reserved, 20)
  const TOOLTIP_RESERVE = 56 // espaço extra no topo do container para o balão não ser cortado

  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-end', height:height+TOOLTIP_RESERVE, overflowX:'auto', overflowY:'hidden', paddingBottom:4 }}>
      {data.map((d, i) => {
        const isHover = hovered === i
        const barPx   = mounted ? Math.max((d.value / max) * barMaxPx, d.value > 0 ? 4 : 0) : 0
        const color   = d.color ?? accent
        return (
          <div key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ flex:'1 0 auto', minWidth:48, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', cursor:'default', position:'relative' }}>

            {isHover && (
              <div style={{ position:'absolute', bottom:`calc(${reserved-12}px + ${barPx}px)`, left:'50%', transform:'translateX(-50%)', background:'var(--foreground)', color:'var(--card)', padding:'7px 11px', borderRadius:9, fontSize:11, fontWeight:700, whiteSpace:'nowrap', zIndex:20, boxShadow:'0 6px 18px rgba(0,0,0,.25)', pointerEvents:'none' }}>
                <div>{d.label}</div>
                <div style={{ fontSize:13, fontWeight:900, marginTop:1 }}>{valueFmt(d.value)}</div>
                {d.tooltipSub && <div style={{ fontSize:9, opacity:.75, marginTop:2, fontWeight:500 }}>{d.tooltipSub}</div>}
                <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'5px solid var(--foreground)' }}/>
              </div>
            )}

            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center', width:'100%' }}>
              <span style={{ fontSize:11, fontWeight:800, color:isHover?color:'var(--foreground)', fontVariantNumeric:'tabular-nums', marginBottom:6, whiteSpace:'nowrap', opacity:d.value>0?1:0, transition:'color .15s' }}>
                {valueFmt(d.value)}
              </span>
              <div style={{
                width:'100%', maxWidth:46,
                height:`${barPx}px`,
                background: isHover ? color : `linear-gradient(180deg,${color},${color}99)`,
                borderRadius:'8px 8px 3px 3px',
                transition:'height .7s cubic-bezier(.22,1.4,.36,1), background .15s, transform .15s',
                boxShadow: isHover ? `0 4px 18px ${color}66` : `0 2px 10px ${color}33`,
                transform: isHover ? 'scaleX(1.1)' : 'scaleX(1)',
                cursor:'pointer',
              }}/>
            </div>
            <span style={{ fontSize:10, fontWeight:isHover?800:600, color:isHover?color:'var(--muted-foreground)', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%', transition:'color .15s' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart (composição de partes de um todo) ───────────
function DonutChart({ data, size=240, thickness=32 }: {
  data: { label:string; value:number; color:string }[]
  size?: number
  thickness?: number
}) {
  const total = data.reduce((s,d)=>s+d.value,0)
  const r  = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let offsetAcc = 0
  const filtered = data.filter(d => d.value > 0)
  if (total <= 0) return null
  return (
    // Ocupa todo o espaço do container, centraliza vertical e horizontalmente
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:20, padding:'8px 0' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--secondary)" strokeWidth={thickness}/>
        {filtered.map((d, i) => {
          const frac = d.value / total
          const len  = frac * circumference
          const dasharray = `${len} ${circumference - len}`
          const dashoffset = circumference * 0.25 - offsetAcc
          offsetAcc += len
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={dasharray} strokeDashoffset={dashoffset}
              strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition:'stroke-dasharray .6s ease' }}/>
          )
        })}
        <text x={cx} y={cy-10} textAnchor="middle" style={{ fontSize:20, fontWeight:900, fill:'var(--foreground)' }}>{fmtBRL(total).replace('R$','').trim()}</text>
        <text x={cx} y={cy+14} textAnchor="middle" style={{ fontSize:11, fill:'var(--muted-foreground)' }}>total</text>
      </svg>
      {/* Legendas embaixo — uma por linha */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:size }}>
        {filtered.map((d, i) => {
          const pct = total>0 ? (d.value/total)*100 : 0
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                <span style={{ fontSize:12, color:'var(--muted-foreground)' }}>{d.label}</span>
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--foreground)', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                {fmtBRL(d.value)} <span style={{ fontWeight:400, color:'var(--muted-foreground)' }}>{fmtPct(pct)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const insightText: React.CSSProperties = { fontFamily:'inherit', fontSize:13, lineHeight:1.75, color:'var(--foreground)', fontWeight:400 }
const tagStyle = (color: string, bg: string): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', height:20, padding:'0 8px',
  borderRadius:5, fontSize:11, fontWeight:700, color, background:bg, whiteSpace:'nowrap', flexShrink:0, lineHeight:1,
})

function riskInfo(p: number, bP: number, bT: number) {
  const e = bT > 0 ? (bP/bT)*100 : 50
  if (p >= e+10) return { bg:'rgba(34,197,94,.07)',  border:'rgba(34,197,94,.2)',  text:'#16a34a', label:'No caminho', Icon:CheckCircle2 }
  if (p >= e-15) return { bg:'rgba(234,179,8,.07)',  border:'rgba(234,179,8,.2)',  text:'#b45309', label:'Atenção',    Icon:AlertTriangle }
  return               { bg:'rgba(239,68,68,.07)',  border:'rgba(239,68,68,.2)',  text:'#dc2626', label:'Em risco',   Icon:AlertTriangle }
}

// ── Animação de entrada ────────────────────────────────────
function FadeIn({ children, delay=0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div style={{ animation:`fadeSlideIn 0.35s ease both`, animationDelay:`${delay}ms` }}>
      {children}
    </div>
  )
}

// ── RichText: parse **bold** e bullets ─────────────────────
function RichText({ text, style }: { text: string; style?: React.CSSProperties }) {
  if (!text) return null
  const lines = text.split(/\n/)
  return (
    <div style={style}>
      {lines.map((line, li) => {
        const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ')
        const content  = isBullet ? line.replace(/^\s*[-•]\s*/, '') : line
        const parts    = content.split(/\*\*(.+?)\*\*/g)
        const rendered = parts.map((p, i) =>
          i % 2 === 1 ? <strong key={i} style={{ fontWeight:700, color:'var(--foreground)' }}>{p}</strong> : p
        )
        if (!content.trim()) return <div key={li} style={{ height:5 }}/>
        if (isBullet) return (
          <div key={li} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'flex-start' }}>
            <span style={{ color:'#6366f1', fontWeight:900, fontSize:15, flexShrink:0, marginTop:0, lineHeight:1.5 }}>·</span>
            <span style={{ lineHeight:1.7 }}>{rendered}</span>
          </div>
        )
        return <p key={li} style={{ margin:'0 0 6px', lineHeight:1.7 }}>{rendered}</p>
      })}
    </div>
  )
}

// ── Dropdown com portal (evita z-index stacking context) ───
function Dropdown({ label, value, options, onChange, multi=false }: any) {
  const [open,    setOpen]    = useState(false)
  const [menuPos, setMenuPos] = useState({ top:0, left:0, width:0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const target     = e.target as Node
      const insideBtn  = btnRef.current?.contains(target)
      const insideMenu = menuRef.current?.contains(target)
      if (!insideBtn && !insideMenu) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: Math.max(r.width, 210) })
    }
    setOpen(o => !o)
  }

  const isActive = multi ? value?.length > 0 : (value !== 'todos' && value !== '')

  const menu = open ? (
    <div ref={menuRef} style={{ position:'absolute', top:menuPos.top, left:menuPos.left, minWidth:menuPos.width, background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.18)', zIndex:9999, overflow:'hidden' }}>
      {options.map((opt: any) => {
        const sel = multi ? (value??[]).includes(opt.value) : value===opt.value
        return (
          <button key={opt.value} onClick={() => { onChange(opt.value); if (!multi) setOpen(false) }}
            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:sel?'rgba(99,102,241,.06)':'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${sel?'#6366f1':'var(--border)'}`, background:sel?'#6366f1':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {sel && <Check size={11} color="#fff"/>}
            </div>
            {opt.dot && <div style={{ width:8, height:8, borderRadius:'50%', background:opt.dot, flexShrink:0 }}/>}
            <span style={{ fontSize:13, color:'var(--foreground)', fontWeight:sel?600:400 }}>{opt.label}</span>
          </button>
        )
      })}
      {multi && value?.length > 0 && (
        <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)' }}>
          <button onClick={() => { onChange('__clear__') }} style={{ fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Limpar filtros</button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <button ref={btnRef} onClick={handleToggle}
        style={{ display:'inline-flex', alignItems:'center', gap:6, height:36, padding:'0 14px', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:isActive?700:500, border:`1.5px solid ${isActive?'#6366f1':'var(--border)'}`, background:isActive?'rgba(99,102,241,.08)':'var(--card)', color:isActive?'#6366f1':'var(--muted-foreground)', transition:'all .15s' }}>
        <span>{label}{isActive&&multi?` (${value.length})`:''}</span>
        <ChevronDown size={12} style={{ transform:open?'rotate(180deg)':'none', transition:'transform .15s' }}/>
      </button>
      {typeof window !== 'undefined' && menu && createPortal(menu, document.body)}
    </div>
  )
}

// ── InsightPanel ───────────────────────────────────────────
function InsightPanel({ data: iD, date, isAdmin, isCloserType }: any) {
  const [data, setData]     = useState<any>(iD)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function generate() {
    setLoading(true); setError('')
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), isAdmin?90000:45000)
    try {
      const url  = isAdmin ? '/api/intel/generate' : '/api/intel/generate-personal'
      const res  = await fetch(url, { method:'POST', signal:ctrl.signal })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error??'Erro ao gerar'); return }
      const novo = isAdmin ? (json.global??json.content) : json.content
      if (novo && typeof novo === 'object') { setData(novo); setError('') }
      else setError('Sem conteúdo. Tente novamente.')
    } catch (e: any) {
      if (e.name === 'AbortError') setError('Tempo excedido — tente novamente.')
      else setError('Erro de conexão.')
    } finally { clearTimeout(t); setLoading(false) }
  }

  const S = ({ icon:I, color, bg, title, items, renderItem }: any) => items?.length > 0 && (
    <div style={{ padding:'14px 16px', borderRadius:12, background:bg, border:`1px solid ${color}22` }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
        <div style={{ width:22, height:22, borderRadius:6, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}><I size={12} style={{ color }}/></div>
        <span style={{ fontSize:10, fontWeight:800, color, textTransform:'uppercase', letterSpacing:'.1em' }}>{title}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{items.map(renderItem)}</div>
    </div>
  )

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
      <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Brain size={16} color="#fff"/>
          </div>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)' }}>{isCloserType?'Sua análise':'Análise de inteligência'}</p>
            <p style={{ margin:0, fontSize:11, color:'var(--muted-foreground)' }}>{new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          style={{ display:'inline-flex', alignItems:'center', gap:7, height:34, padding:'0 16px', borderRadius:9, border:'none', background:loading?'var(--secondary)':'linear-gradient(135deg,#6366f1,#7c3aed)', color:loading?'var(--muted-foreground)':'#fff', fontSize:12, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:loading?'none':'0 2px 12px rgba(99,102,241,.3)' }}>
          {loading?<Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/>:<Sparkles size={12}/>}
          {loading?(isAdmin?'Analisando...':'Gerando...'):data?'Atualizar':isCloserType?'Gerar minha análise':'Gerar análise'}
        </button>
      </div>
      <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:10 }}>
        {error && <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', fontSize:12, color:'#dc2626', display:'flex', alignItems:'center', gap:8 }}><AlertCircle size={13}/>{error}</div>}
        {!data && !loading && <div style={{ padding:'28px', textAlign:'center', color:'var(--muted-foreground)' }}><Brain size={32} style={{ margin:'0 auto 10px', opacity:.2 }}/><p style={{ margin:0, fontSize:13 }}>{isCloserType?'Clique em "Gerar minha análise" para seu insight personalizado.':'Clique em "Gerar análise" para criar o insight do time com IA.'}</p></div>}
        {data && !isCloserType && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <S icon={AlertCircle} color="#dc2626" bg="rgba(239,68,68,.04)" title="Alertas críticos" items={data.alertas_criticos}
              renderItem={(a:any,i:number)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}><span style={tagStyle('#dc2626','rgba(239,68,68,.12)')}>{a.closer}</span><RichText text={a.texto} style={insightText}/></div>}/>
            <S icon={AlertTriangle} color="#b45309" bg="rgba(234,179,8,.04)" title="Atenção" items={data.atencao}
              renderItem={(a:any,i:number)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}><span style={tagStyle('#b45309','rgba(234,179,8,.12)')}>{a.closer}</span><RichText text={a.texto} style={insightText}/></div>}/>
            <S icon={Star} color="#16a34a" bg="rgba(34,197,94,.04)" title="Destaques" items={data.destaques}
              renderItem={(a:any,i:number)=><div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}><span style={tagStyle('#16a34a','rgba(34,197,94,.12)')}>{a.closer}</span><RichText text={a.texto} style={insightText}/></div>}/>
            {data.resumo_time && <div style={{ padding:'14px 16px', borderRadius:12, background:'rgba(99,102,241,.04)', border:'1px solid rgba(99,102,241,.15)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}><Activity size={13} style={{ color:'#6366f1' }}/><span style={{ fontSize:10, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.1em' }}>Visão geral</span></div>
              <RichText text={data.resumo_time} style={insightText}/>
            </div>}
            {data.analise_templates && <div style={{ padding:'14px 16px', borderRadius:12, background:'rgba(168,85,247,.04)', border:'1px solid rgba(168,85,247,.15)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}><BarChart2 size={13} style={{ color:'#a855f7' }}/><span style={{ fontSize:10, fontWeight:800, color:'#a855f7', textTransform:'uppercase', letterSpacing:'.1em' }}>Templates</span></div>
              <RichText text={data.analise_templates} style={insightText}/>
            </div>}
            {data.recomendacoes?.length > 0 && <div style={{ padding:'14px 16px', borderRadius:12, background:'rgba(20,184,166,.04)', border:'1px solid rgba(20,184,166,.18)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}><Lightbulb size={13} style={{ color:'#0d9488' }}/><span style={{ fontSize:10, fontWeight:800, color:'#0d9488', textTransform:'uppercase', letterSpacing:'.1em' }}>Recomendações</span></div>
              {data.recomendacoes.map((r:string,i:number) => (
                <div key={i} style={{ display:'flex', gap:12, marginBottom:i < data.recomendacoes.length-1 ? 14 : 0, paddingBottom:i < data.recomendacoes.length-1 ? 14 : 0, borderBottom:i < data.recomendacoes.length-1 ? '1px solid rgba(20,184,166,.15)' : 'none' }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:'rgba(20,184,166,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                    <span style={{ fontSize:11, fontWeight:900, color:'#0d9488' }}>{i+1}</span>
                  </div>
                  <RichText text={r} style={{ ...insightText, flex:1 }}/>
                </div>
              ))}
            </div>}
          </div>
        )}
        {data && isCloserType && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {data.situacao && <div style={{ gridColumn:'1/-1', padding:'14px 16px', borderRadius:12, background:'rgba(99,102,241,.04)', border:'1px solid rgba(99,102,241,.15)' }}><span style={{ fontSize:10, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.1em', display:'block', marginBottom:8 }}>Situação atual</span><RichText text={data.situacao} style={insightText}/></div>}
            {data.destaque && <div style={{ padding:'12px 14px', borderRadius:12, background:'rgba(34,197,94,.04)', border:'1px solid rgba(34,197,94,.2)' }}><span style={{ fontSize:10, fontWeight:800, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.1em', display:'block', marginBottom:6 }}>Destaque</span><RichText text={data.destaque} style={{ ...insightText, fontSize:13 }}/></div>}
            {data.alerta && <div style={{ padding:'12px 14px', borderRadius:12, background:'rgba(234,179,8,.04)', border:'1px solid rgba(234,179,8,.2)' }}><span style={{ fontSize:10, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.1em', display:'block', marginBottom:6 }}>Atenção</span><RichText text={data.alerta} style={{ ...insightText, fontSize:13 }}/></div>}
            {data.pipeline && <div style={{ gridColumn:'1/-1', padding:'12px 14px', borderRadius:12, background:'rgba(99,102,241,.04)', border:'1px solid rgba(99,102,241,.15)' }}><span style={{ fontSize:10, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.1em', display:'block', marginBottom:6 }}>Pipeline & Leads</span><RichText text={data.pipeline} style={{ ...insightText, fontSize:13 }}/></div>}
            {data.atividade && <div style={{ gridColumn:'1/-1', padding:'12px 14px', borderRadius:12, background:'rgba(168,85,247,.04)', border:'1px solid rgba(168,85,247,.15)' }}><span style={{ fontSize:10, fontWeight:800, color:'#a855f7', textTransform:'uppercase', letterSpacing:'.1em', display:'block', marginBottom:6 }}>Disparos & Templates</span><RichText text={data.atividade} style={{ ...insightText, fontSize:13 }}/></div>}
            {(data.acoes?.length > 0 || data.acao) && <div style={{ gridColumn:'1/-1', padding:'14px 16px', borderRadius:12, background:'rgba(20,184,166,.04)', border:'1px solid rgba(20,184,166,.18)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}><Lightbulb size={13} style={{ color:'#0d9488' }}/><span style={{ fontSize:10, fontWeight:800, color:'#0d9488', textTransform:'uppercase', letterSpacing:'.1em' }}>Próximos passos</span></div>
              {Array.isArray(data.acoes) ? data.acoes.map((a:string,i:number) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:i<data.acoes.length-1?10:0 }}>
                  <span style={{ fontSize:11, fontWeight:900, color:'#0d9488', width:18, flexShrink:0, textAlign:'center', marginTop:3 }}>{i+1}.</span>
                  <RichText text={a} style={{ ...insightText, fontSize:13 }}/>
                </div>
              )) : <RichText text={data.acao} style={{ ...insightText, fontSize:13 }}/>}
            </div>}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

// ── ADMIN ──────────────────────────────────────────────────
function AdminView({ closerStats, insightData, insightDate, adminExtra, currentMonth }: any) {
  const [filterTeam,   setFilterTeam]   = useState<string>('todos')
  const [filterVert,   setFilterVert]   = useState<string[]>([])  // labels: ["Anest-Review", ...]
  const [filterCloser, setFilterCloser] = useState<string>('todos')

  const {
    totalRev=0, totalSales=0, totalLeadsHS=0,
    byType={} as any, byVertical={} as any,
    bizTotal=0, bizPassed=0, bizLeft=0,
    totalNewRev=0, totalRecurringRev=0, forecast=null as any,
  } = adminExtra ?? {}

  // Navegar mês
  const [y, m] = (currentMonth ?? new Date().toISOString().slice(0,7)).split('-').map(Number)
  const monthLabel = new Date(y, m-1, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' })
  function navMonth(delta: number) {
    const d  = new Date(y, m-1+delta, 1)
    const mk = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
    window.location.href = '?month=' + mk
  }

  const allClosers  = (closerStats ?? []) as any[]
  const verticals   = Object.entries(byVertical).sort(([,a]:any,[,b]:any) => b.rev - a.rev) as any[]
  const vertLabels  = verticals.map(([,v]:any) => v.label)

  // Opções de dropdown
  const teamOpts   = [{value:'todos',label:'Todos os times'},{value:'R1',label:'Time R1',dot:'#7c3aed'},{value:'OAO',label:'Time OAO',dot:'#2563eb'}]
  const vertOpts   = verticals.map(([,v]:any) => ({ value:v.label, label:v.label, dot: v.label.includes('R1')?'#7c3aed':'#2563eb' }))
  const closerOpts = [{value:'todos',label:'Todos os closers'},...allClosers.map((c:any)=>({value:c.id,label:c.name}))]

  const handleVert = (val: string) => {
    if (val === '__clear__') { setFilterVert([]); return }
    setFilterVert(prev => prev.includes(val) ? prev.filter(v=>v!==val) : [...prev, val])
  }

  // Função: receita de um closer filtrada pelas verticais selecionadas
  const closerRev = (c: any) =>
    filterVert.length === 0
      ? c.revenue_month
      : filterVert.reduce((s: number, label: string) => s + (c.revenue_by_vertical?.[label] ?? 0), 0)

  const closerSales = (c: any) =>
    filterVert.length === 0
      ? c.sales_month
      : filterVert.reduce((s: number, label: string) => s + (c.sales_by_vertical?.[label] ?? 0), 0)

  const closerLeads = (c: any) =>
    filterVert.length === 0
      ? c.leads_month
      : filterVert.reduce((s: number, label: string) => s + (c.leads_by_vertical?.[label] ?? 0), 0)

  // Filtrar closers
  const filtered = useMemo(() => {
    let list = allClosers
    if (filterTeam   !== 'todos') list = list.filter((c:any) => (c.team??'') === filterTeam)
    if (filterCloser !== 'todos') list = list.filter((c:any) => c.id === filterCloser)
    if (filterVert.length > 0)    list = list.filter((c:any) => closerRev(c) > 0)
    return [...list].sort((a:any, b:any) => closerRev(b) - closerRev(a))
  }, [allClosers, filterTeam, filterCloser, filterVert])

  const hasFilters = filterTeam!=='todos' || filterVert.length>0 || filterCloser!=='todos'

  // Totais filtrados
  const filteredTotalRev   = filtered.reduce((s:number,c:any) => s + closerRev(c), 0)
  const filteredTotalSales = filtered.reduce((s:number,c:any) => s + closerSales(c), 0)
  const filteredTotalLeads = filtered.reduce((s:number,c:any) => s + closerLeads(c), 0)
  const displayTotalRev    = hasFilters ? filteredTotalRev   : totalRev
  const displayTotalSales  = hasFilters ? filteredTotalSales : totalSales
  const displayTotalLeads  = hasFilters ? filteredTotalLeads : totalLeadsHS
  const proj = bizPassed > 0 ? (displayTotalRev / bizPassed) * bizTotal : 0
  const maxRev = Math.max(...filtered.map((c:any) => closerRev(c)), 1)

  // byType filtrado por closer/team/vertical
  const displayByType = useMemo(() => {
    if (!hasFilters) return byType
    const agg = { closer:{rev:0,count:0}, ambassador:{rev:0,count:0}, selfcheckout:{rev:0,count:0} }
    filtered.forEach((c: any) => {
      if (filterVert.length === 0) {
        agg.closer.count      += c.closer_count      ?? 0
        agg.closer.rev        += c.closer_rev        ?? 0
        agg.ambassador.count  += c.ambassador_count  ?? 0
        agg.ambassador.rev    += c.ambassador_rev    ?? 0
        agg.selfcheckout.count+= c.selfco_count      ?? 0
        agg.selfcheckout.rev  += c.selfco_rev        ?? 0
      } else {
        // Com filtro de vertical: usar revenue_by_vertical como proxy (só rev disponível)
        const rev = closerRev(c)
        agg.closer.rev   += rev
        agg.closer.count += closerSales(c)
      }
    })
    return agg
  }, [filtered, filterVert, hasFilters, byType])

  // byVertical filtrado — recompõe dos closerStats
  const displayByVertical = useMemo(() => {
    if (!hasFilters) return byVertical  // sem filtro: usar dado global pré-computado
    const result: Record<string, any> = {}
    filtered.forEach((c: any) => {
      Object.entries(c.revenue_by_vertical ?? {}).forEach(([label, rev]: any) => {
        if (filterVert.length > 0 && !filterVert.includes(label)) return
        if (!result[label]) {
          // Tentar pegar label de byVertical global para reter breakdown de tipo
          const globalKey  = Object.keys(byVertical).find((k: string) => (byVertical as any)[k].label === label)
          const globalVert = globalKey ? (byVertical as any)[globalKey] : null
          result[label] = {
            label, rev:0, count:0, leads:0,
            closer:0, ambassador:0, selfcheckout:0,
            closerRev:0, ambassadorRev:0, selfcheckoutRev:0,
            _key: globalKey ?? label,
          }
        }
        result[label].rev   += Number(rev) || 0
        result[label].count += (c.sales_by_vertical?.[label] ?? 0)
        result[label].leads += (c.leads_by_vertical?.[label] ?? 0)
      })
    })
    return result
  }, [filtered, byVertical, filterVert, hasFilters])

  // Conversão por vertical: agrupa sales + leads por vertical dos closers filtrados
  const convByVertical = useMemo(() => {
    const cv: Record<string, { label: string; sales: number; leads: number }> = {}
    filtered.forEach((c: any) => {
      const salesV = c.sales_by_vertical ?? {}
      const leadsV = c.leads_by_vertical ?? {}
      const allLabels = new Set([...Object.keys(salesV), ...Object.keys(leadsV)])
      allLabels.forEach((label: string) => {
        if (filterVert.length > 0 && !filterVert.includes(label)) return
        if (!cv[label]) cv[label] = { label, sales:0, leads:0 }
        cv[label].sales += salesV[label] ?? 0
        cv[label].leads += leadsV[label] ?? 0
      })
    })
    return Object.values(cv).filter(v => v.leads > 0)
      .sort((a, b) => (b.leads > 0 ? b.sales/b.leads : 0) - (a.leads > 0 ? a.sales/a.leads : 0))
  }, [filtered, filterVert])

  // Verticals para exibição
  const displayVerts = useMemo(() => {
    const source = Object.entries(displayByVertical)
    return filterVert.length > 0
      ? source.filter(([, v]: any) => filterVert.includes(v.label))
      : source.sort(([,a]:any,[,b]:any) => b.rev - a.rev)
  }, [displayByVertical, filterVert])

  const hasTipoData  = (displayByType?.closer?.rev??0)+(displayByType?.ambassador?.rev??0)+(displayByType?.selfcheckout?.rev??0) > 0
  const hasLeadsData = filtered.filter((c:any)=>closerLeads(c)>0).length > 0
  const tipoConvCols  = (hasTipoData && hasLeadsData) ? '1fr 1fr' : '1fr'

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* Header */}
      <FadeIn>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(79,70,229,.3)' }}>
              <Brain size={18} color="#fff"/>
            </div>
            <div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em' }}>Inteligência Comercial</h1>
              <p style={{ margin:0, fontSize:12, color:'var(--muted-foreground)' }}>{bizLeft > 0 ? `${bizLeft} dias restantes` : 'mês encerrado'}</p>
            </div>
          </div>
          {/* Navegação de mês */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'4px 6px' }}>
            <button onClick={()=>navMonth(-1)} style={{ width:30, height:30, borderRadius:7, border:'none', background:'var(--secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--foreground)' }}>
              <ChevronLeft size={15}/>
            </button>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', minWidth:170, textAlign:'center', textTransform:'capitalize' }}>{monthLabel}</span>
            <button onClick={()=>navMonth(1)} style={{ width:30, height:30, borderRadius:7, border:'none', background:'var(--secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--foreground)' }}>
              <ChevronRight size={15}/>
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Filtros */}
      <FadeIn delay={50}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <Dropdown label="Time" value={filterTeam} options={teamOpts} onChange={setFilterTeam}/>
          <Dropdown label="Vertical" value={filterVert} options={vertOpts} onChange={handleVert} multi={true}/>
          <Dropdown label="Closer" value={filterCloser} options={closerOpts} onChange={setFilterCloser}/>
          {hasFilters && (
            <button onClick={()=>{setFilterTeam('todos');setFilterVert([]);setFilterCloser('todos')}}
              style={{ display:'inline-flex', alignItems:'center', gap:5, height:36, padding:'0 12px', borderRadius:10, border:'1.5px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.06)', color:'#dc2626', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <X size={12}/>Limpar
            </button>
          )}
          {hasFilters && (
            <span style={{ fontSize:11, color:'#6366f1', fontWeight:600, padding:'4px 10px', borderRadius:7, background:'rgba(99,102,241,.08)' }}>
              {filterVert.length > 0 ? filterVert.join(' + ') : ''}{filterTeam!=='todos'?` · Time ${filterTeam}`:''}
            </span>
          )}
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted-foreground)' }}>{filtered.length} closer{filtered.length!==1?'s':''}</span>
        </div>
      </FadeIn>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Receita do período', value:fmtBRL(displayTotalRev), sub:`${displayTotalSales} vendas`, Icon:TrendingUp, accent:'#6366f1', glow:true, delay:80 },
          { label:'Projeção de fechamento', value:fmtBRL(proj), sub:`Ritmo: ${bizPassed}/${bizTotal} dias`, Icon:BarChart2, accent:'#8b5cf6', glow:false, delay:120 },
          { label:'Leads HubSpot', value:String(displayTotalLeads), sub:'no período filtrado', Icon:Users, accent:'#06b6d4', glow:false, delay:160 },
          { label:'Dias restantes', value:String(bizLeft), sub:`de ${bizTotal} no mês`, Icon:CheckCircle2, accent:bizLeft<5?'#dc2626':'#22c55e', glow:false, delay:200 },
        ].map(({ label, value, sub, Icon, accent, glow, delay }) => (
          <FadeIn key={label} delay={delay}>
            <div style={{ background:glow?`linear-gradient(135deg,${accent}12,${accent}05)`:'var(--card)', border:`1px solid ${glow?`${accent}25`:'var(--border)'}`, borderRadius:18, padding:'20px 22px', position:'relative', overflow:'hidden' }}>
              {glow && <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`${accent}12`, filter:'blur(20px)', pointerEvents:'none' }}/>}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</span>
                <div style={{ width:32, height:32, borderRadius:10, background:`${accent}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={15} style={{ color:accent }}/>
                </div>
              </div>
              <p style={{ margin:0, fontSize:23, fontWeight:900, color:glow?accent:'var(--foreground)', letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>{value}</p>
              <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--muted-foreground)' }}>{sub}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Receita nova vs recorrente — gráfico de barras */}
      {(totalNewRev > 0 || totalRecurringRev > 0) && (
        <FadeIn delay={240}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
            <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Receita nova vs recorrente</p>
            <p style={{ margin:'0 0 18px', fontSize:11, color:'var(--muted-foreground)' }}>Split do mês corrente</p>
            <BarChart
              data={[
                { label:'Vendas novas',       value:totalNewRev,       color:'#6366f1', tooltipSub: `${fmtPct(totalNewRev+totalRecurringRev>0?(totalNewRev/(totalNewRev+totalRecurringRev))*100:0)} do total` },
                { label:'Receita recorrente', value:totalRecurringRev, color:'#0d9488', tooltipSub: `${fmtPct(totalNewRev+totalRecurringRev>0?(totalRecurringRev/(totalNewRev+totalRecurringRev))*100:0)} do total` },
              ]}
              height={140}
            />
          </div>
        </FadeIn>
      )}

      {/* Forecast de recorrência — próximos meses (até dezembro) */}
      {forecast && forecast.monthlyForecast?.length > 0 && (
        <FadeIn delay={270}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
            <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Forecast de recorrência — próximos meses</p>
            <p style={{ margin:'0 0 18px', fontSize:11, color:'var(--muted-foreground)' }}>
              Receita recorrente esperada por mês, já descontado o histórico de cancelamento/atraso.
            </p>
            <BarChart
              data={forecast.monthlyForecast.map((m: any) => ({
                label: m.label,
                value: m.ajustado,
                color: '#6366f1',
                tooltipSub: `Sem desconto: ${fmtBRL(m.bruto)}`,
              }))}
              height={170}
            />

            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginTop:18, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <div style={{ padding:'12px 14px', borderRadius:12, background:'rgba(13,148,136,.05)', border:'1px solid rgba(13,148,136,.18)' }}>
                <p style={{ margin:'0 0 3px', fontSize:9, fontWeight:800, color:'#0d9488', textTransform:'uppercase', letterSpacing:'.08em' }}>Recebido este mês (recorrência)</p>
                <p style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--foreground)', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(forecast.mrrAtual)}</p>
              </div>
              <div style={{ padding:'12px 14px', borderRadius:12, background:'rgba(99,102,241,.05)', border:'1px solid rgba(99,102,241,.18)' }}>
                <p style={{ margin:'0 0 3px', fontSize:9, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.08em' }}>Esperado até dezembro</p>
                <p style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--foreground)', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(forecast.parcelasRestantesAjustado)}</p>
                <p style={{ margin:'2px 0 0', fontSize:9, color:'var(--muted-foreground)' }}>{fmtPct(forecast.persistenceRate*100)} de aderência histórica aplicada</p>
              </div>
            </div>

            <div style={{ display:'flex', gap:16, marginTop:14, flexWrap:'wrap' }}>
              {[
                { label:'Ativas',    count:forecast.ativas,    color:'#16a34a' },
                { label:'Atrasadas', count:forecast.atrasadas, color:'#b45309' },
                { label:'Em risco',  count:forecast.emRisco,   color:'#dc2626' },
                { label:'Completas', count:forecast.completas, color:'#94a3b8' },
              ].filter(x => x.count > 0).map(({ label, count, color }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:color }}/>
                  <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{count} assinatura{count!==1?'s':''} <span style={{ color, fontWeight:700 }}>{label.toLowerCase()}</span></span>
                </div>
              ))}
              {forecast.sampleSize < 5 && (
                <span style={{ fontSize:10, color:'var(--muted-foreground)', fontStyle:'italic' }}>· amostra histórica pequena, aderência é uma estimativa conservadora</span>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Receita por closer — gráfico de barras + detalhe */}
      <FadeIn delay={220}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:8 }}>
            <div>
              <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)' }}>
                Receita por closer {filterVert.length > 0 ? `— ${filterVert.join(', ')}` : ''}
              </p>
              <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--muted-foreground)' }}>
                {filterVert.length > 0 ? 'Receita filtrada pelas verticais selecionadas' : 'Receita total do mês · ordenado por valor'}
              </p>
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:'#6366f1', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(displayTotalRev)}</span>
          </div>

          {filtered.length === 0
            ? <p style={{ margin:0, color:'var(--muted-foreground)', fontSize:13, textAlign:'center', padding:'20px 0' }}>Nenhum closer com este filtro.</p>
            : <>
              <div style={{ marginBottom:22 }}>
                <BarChart
                  data={filtered.map((c:any) => ({
                    label: c.name.split(' ')[0],
                    value: closerRev(c),
                    color: c.team==='R1' ? '#7c3aed' : '#2563eb',
                    tooltipSub: `${c.team??'—'} · ${closerSales(c)} venda${closerSales(c)!==1?'s':''}`,
                  }))}
                  height={150}
                />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filtered.map((c: any, idx: number) => {
                  const rev     = closerRev(c)
                  const sales   = closerSales(c)
                  const leads   = closerLeads(c)
                  const risk    = riskInfo(c.pct_goal, c.biz_passed, c.biz_total)
                  const tc      = c.team==='R1' ? { color:'#7c3aed', bg:'rgba(124,58,237,.1)' } : { color:'#2563eb', bg:'rgba(37,99,235,.1)' }
                  const convRate = leads > 0 ? (sales / leads) * 100 : 0
                  return (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: idx>0 ? '1px solid var(--border)' : 'none', animation:`fadeSlideIn 0.3s ease both`, animationDelay:`${idx * 40}ms` }}>
                      <CloserAv name={c.name} avatarUrl={c.avatar_url} size={26}/>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:tc.bg, color:tc.color, fontWeight:700, flexShrink:0 }}>{c.team??'—'}</span>
                      {c.goal_sales > 0 && (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, background:risk.bg, border:`1px solid ${risk.border}`, flexShrink:0 }}>
                          <risk.Icon size={10} style={{ color:risk.text }}/>
                          <span style={{ fontSize:10, fontWeight:700, color:risk.text }}>{c.pct_goal.toFixed(0)}%</span>
                        </div>
                      )}
                      {leads > 0 && <span style={{ fontSize:11, color:'var(--muted-foreground)', flexShrink:0, whiteSpace:'nowrap' }}>{leads} leads · {fmtPct(convRate)}</span>}
                      <span style={{ fontSize:14, fontWeight:900, color:'var(--foreground)', fontVariantNumeric:'tabular-nums', width:100, textAlign:'right', flexShrink:0 }}>{fmtBRL(rev)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          }
        </div>
      </FadeIn>

      {/* Tipo de venda + conversão — só renderiza se tem dado */}
      {/* Tipo de venda + conversão — só renderiza se tem dado */}
      {(hasTipoData || hasLeadsData) && (
        <div style={{ display:'grid', gridTemplateColumns:tipoConvCols, gap:14 }}>
          {hasTipoData && (
            <FadeIn delay={260}>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px', height:'100%' }}>
                <p style={{ margin:'0 0 18px', fontSize:14, fontWeight:800, color:'var(--foreground)' }}>
                  Vendas por tipo {filterVert.length > 0 ? <span style={{ fontSize:11, color:'var(--muted-foreground)', fontWeight:400 }}>· filtrado</span> : ''}
                </p>
                <DonutChart
                  data={[
                    { label:'Closer',        value:displayByType?.closer?.rev??0,       color:'#6366f1' },
                    { label:'Embaixador',     value:displayByType?.ambassador?.rev??0,   color:'#a855f7' },
                    { label:'Self-checkout',  value:displayByType?.selfcheckout?.rev??0, color:'#94a3b8' },
                  ]}
                  size={140}
                />
              </div>
            </FadeIn>
          )}
          {hasLeadsData && (
            <FadeIn delay={300}>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px', height:'100%' }}>
                <p style={{ margin:'0 0 18px', fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Taxa de conversão por closer</p>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {filtered.filter((c:any)=>closerLeads(c)>0).map((c:any)=>{
                    const leads=closerLeads(c), sales=closerSales(c)
                    const conv=leads>0?(sales/leads)*100:0
                    return (
                      <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <CloserAv name={c.name} avatarUrl={c.avatar_url} size={24}/>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:'var(--foreground)' }}>{c.name.split(' ')[0]}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:'#6366f1' }}>{fmtPct(conv)}</span>
                          </div>
                          <div style={{ height:6, background:'var(--secondary)', borderRadius:999, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${Math.min(conv,100)}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:999 }}/>
                          </div>
                          <span style={{ fontSize:10, color:'var(--muted-foreground)' }}>{sales}/{leads} convertidos</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      )}
      {/* Conversão por vertical */}
      {convByVertical.length > 0 && (
        <FadeIn delay={360}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Conversão por vertical</p>
                <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--muted-foreground)' }}>Taxa de conversão leads → vendas por vertical</p>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {convByVertical.map((v: any) => {
                const conv = v.leads > 0 ? (v.sales / v.leads) * 100 : 0
                const maxConv = Math.max(...convByVertical.map((x: any) => x.leads > 0 ? (x.sales/x.leads)*100 : 0), 1)
                const isR1 = v.label.includes('R1')
                const accent = isR1 ? '#7c3aed' : '#2563eb'
                return (
                  <div key={v.label}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:accent }}/>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--foreground)' }}>{v.label}</span>
                        <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{v.sales}/{v.leads} leads</span>
                      </div>
                      <span style={{ fontSize:14, fontWeight:900, color:conv >= 30 ? '#16a34a' : conv >= 15 ? '#b45309' : '#dc2626', fontVariantNumeric:'tabular-nums' }}>{conv.toFixed(1)}%</span>
                    </div>
                    <div style={{ height:10, background:'var(--secondary)', borderRadius:999, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(conv/maxConv)*100}%`, background:isR1?'linear-gradient(90deg,#7c3aed,#a855f7)':'linear-gradient(90deg,#2563eb,#6366f1)', borderRadius:999, transition:'width .6s ease' }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Insight */}
      <FadeIn delay={380}>
        <InsightPanel data={insightData} date={insightDate} isAdmin={true} isCloserType={false}/>
      </FadeIn>

      {/* Tabela */}
      <FadeIn delay={420}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
          <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Detalhe por closer</span>
            <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted-foreground)' }}>{filtered.length} closer{filtered.length!==1?'s':''}</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--secondary)' }}>
                  {['Closer','Time','Receita','% Meta','Projeção','Leads','Conv.','Último fec.','Status'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0&&<tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'var(--muted-foreground)', fontSize:13 }}>Nenhum dado.</td></tr>}
                {filtered.map((s:any,i:number)=>{
                  const rev   = closerRev(s), sales  = closerSales(s), leads = closerLeads(s)
                  const conv  = leads > 0 ? (sales/leads)*100 : 0
                  const risk  = riskInfo(s.pct_goal, s.biz_passed, s.biz_total)
                  const {Icon:RI}=risk
                  const tc    = s.team==='R1'?{bg:'rgba(124,58,237,.08)',color:'#7c3aed'}:{bg:'rgba(37,99,235,.08)',color:'#2563eb'}
                  return (
                    <tr key={s.id} style={{ borderTop:'1px solid var(--border)', transition:'background .1s' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='var(--secondary)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <CloserAv name={s.name} avatarUrl={s.avatar_url} size={26}/>
                          <span style={{ fontWeight:700, color:'var(--foreground)' }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px' }}><span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:tc.bg, color:tc.color, fontWeight:700 }}>{s.team??'—'}</span></td>
                      <td style={{ padding:'12px 16px', fontVariantNumeric:'tabular-nums', fontWeight:800, color:'var(--foreground)' }}>{fmtBRL(rev)}</td>
                      <td style={{ padding:'12px 16px' }}>
                        {s.goal_sales>0?(
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:56, height:4, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${Math.min(s.pct_goal,100)}%`, background:risk.text==='#16a34a'?'#22c55e':risk.text==='#b45309'?'#f59e0b':'#ef4444', borderRadius:999 }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:risk.text }}>{s.pct_goal.toFixed(0)}%</span>
                          </div>
                        ):<span style={{ fontSize:11, color:'var(--muted-foreground)' }}>sem meta</span>}
                      </td>
                      <td style={{ padding:'12px 16px', fontVariantNumeric:'tabular-nums', color:'var(--muted-foreground)' }}>
                        {filterVert.length > 0 ? '—' : fmtBRL(s.revenue_projected)}
                      </td>
                      <td style={{ padding:'12px 16px', color:'var(--muted-foreground)' }}>{leads > 0 ? leads : '—'}</td>
                      <td style={{ padding:'12px 16px', color:'var(--muted-foreground)' }}>{leads > 0 ? fmtPct(conv) : '—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontSize:12, fontWeight:s.days_since_last_sale>3?700:400, color:s.days_since_last_sale>3?'#ef4444':'var(--muted-foreground)' }}>
                          {s.days_since_last_sale===999?'sem vendas':s.days_since_last_sale===0?'hoje':`${s.days_since_last_sale}d atrás`}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        {s.goal_sales>0?(
                          <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:7, background:risk.bg, border:`1px solid ${risk.border}` }}>
                            <RI size={10} style={{ color:risk.text }}/><span style={{ fontSize:10, fontWeight:700, color:risk.text }}>{risk.label}</span>
                          </div>
                        ):<span style={{ fontSize:11, color:'var(--muted-foreground)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

// ── CLOSER VIEW ────────────────────────────────────────────
function CloserView({ profile, snapshot, insightData, insightDate }: any) {
  const s   = {...snapshot}
  const gS  = Number(s.goal_sales??0)
  const pct = gS > 0 ? Math.min((s.revenue_month/gS)*100,100) : 0
  const risk = riskInfo(pct, s.business_days_passed??0, s.business_days_total??22)
  const {Icon:RI} = risk
  const last7: any[] = s.last7 ?? []
  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <FadeIn>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(79,70,229,.3)' }}><Brain size={18} color="#fff"/></div>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.02em' }}>Olá, {profile?.name?.split(' ')[0]} 👋</h1>
            <p style={{ margin:0, fontSize:12, color:'var(--muted-foreground)' }}>{new Date(insightDate+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={60}><InsightPanel data={insightData} date={insightDate} isAdmin={false} isCloserType={true}/></FadeIn>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
        <FadeIn delay={100}>
          <div style={{ background:'var(--card)', border:`1.5px solid ${gS>0?risk.border:'var(--border)'}`, borderRadius:18, padding:'20px 22px', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.08em' }}>Meta mensal</span>
              {gS>0&&<div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:7, background:risk.bg, border:`1px solid ${risk.border}` }}><RI size={10} style={{ color:risk.text }}/><span style={{ fontSize:10, fontWeight:700, color:risk.text }}>{risk.label}</span></div>}
            </div>
            <div>
              <p style={{ margin:0, fontSize:28, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(s.revenue_month??0)}</p>
              <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--muted-foreground)' }}>de {gS>0?fmtBRL(gS):'meta não definida'}</p>
            </div>
            {gS>0&&<>
              <div style={{ height:6, borderRadius:999, background:'var(--secondary)', overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:risk.text==='#16a34a'?'#22c55e':risk.text==='#b45309'?'#f59e0b':'#ef4444', borderRadius:999, transition:'width .8s' }}/></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted-foreground)' }}><span>{pct.toFixed(0)}% concluído</span><span>{s.business_days_remaining??'?'} dias restantes</span></div>
            </>}
          </div>
        </FadeIn>
        <FadeIn delay={140}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 22px', display:'flex', flexDirection:'column', gap:12 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.08em' }}>Projeção de fechamento</span>
            <p style={{ margin:0, fontSize:28, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(s.revenue_projected??0)}</p>
            <div style={{ display:'flex', gap:20, paddingTop:6, borderTop:'1px solid var(--border)' }}>
              {[{l:'Vs semana ant.',v:s.delta_week_pct??0},{l:'Vs mês ant.',v:s.delta_month_pct??0}].map(({l,v})=>(
                <div key={l}><p style={{ margin:'0 0 3px', fontSize:10, color:'var(--muted-foreground)' }}>{l}</p><div style={{ display:'flex', alignItems:'center', gap:4 }}>{v>=0?<TrendingUp size={11} style={{ color:'#16a34a' }}/>:<TrendingDown size={11} style={{ color:'#dc2626' }}/>}<span style={{ fontSize:13, fontWeight:700, color:v>=0?'#16a34a':'#dc2626' }}>{v>=0?'+':''}{v.toFixed(1)}%</span></div></div>
              ))}
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={180}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 22px' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.08em' }}>Vendas este mês</span>
            <p style={{ margin:'10px 0 4px', fontSize:28, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em' }}>{s.sales_month??0}</p>
            <p style={{ margin:0, fontSize:12, color:(s.days_since_last_sale??999)>3?'#ef4444':'var(--muted-foreground)' }}>
              {(s.days_since_last_sale??999)===999?'Nenhuma venda registrada':(s.days_since_last_sale??999)===0?'Última venda hoje':`Última venda há ${s.days_since_last_sale} dias`}
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={220}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 22px' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.08em' }}>Leads este mês</span>
            <p style={{ margin:'10px 0 4px', fontSize:28, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em' }}>{(s.leads_month??0)>0?s.leads_month:'—'}</p>
            <p style={{ margin:0, fontSize:12, color:'var(--muted-foreground)' }}>{(s.leads_month??0)>0?`${s.leads_open} em aberto · ${fmtPct(s.conversion_rate??0)} conversão`:'Sem leads HubSpot registrados'}</p>
          </div>
        </FadeIn>
      </div>

      {last7.some((d:any)=>d.rev>0)&&(
        <FadeIn delay={260}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 22px' }}>
            <p style={{ margin:'0 0 16px', fontSize:13, fontWeight:800, color:'var(--foreground)' }}>Receita — últimos 7 dias</p>
            <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:100 }}>
              {last7.map((d:any,i:number)=>{
                const maxR=Math.max(...last7.map((x:any)=>x.rev),1), p=(d.rev/maxR)*100, isT=i===6
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ height:20, display:'flex', alignItems:'flex-end', justifyContent:'center', marginBottom:4 }}>
                      {d.rev>0&&<span style={{ fontSize:9, fontWeight:isT?800:500, color:isT?'#6366f1':'var(--muted-foreground)', whiteSpace:'nowrap' }}>{d.rev>=1000?`R$${(d.rev/1000).toFixed(0)}k`:fmtBRL(d.rev)}</span>}
                    </div>
                    <div style={{ width:'100%', height:64, display:'flex', alignItems:'flex-end' }}>
                      <div style={{ width:'100%', height:`${Math.max(p,d.rev>0?8:2)}%`, borderRadius:'6px 6px 0 0', background:isT?'linear-gradient(180deg,#818cf8,#6366f1)':'rgba(99,102,241,.2)', minHeight:d.rev>0?6:1, boxShadow:isT?'0 -2px 10px rgba(99,102,241,.3)':'none' }}/>
                    </div>
                    <span style={{ fontSize:9, marginTop:5, color:isT?'#6366f1':'var(--muted-foreground)', fontWeight:isT?700:400 }}>{d.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {Object.keys(s.revenue_by_vertical??{}).length>0&&(
        <FadeIn delay={300}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 22px' }}>
            <p style={{ margin:'0 0 16px', fontSize:13, fontWeight:800, color:'var(--foreground)' }}>Receita por vertical</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {Object.entries(s.revenue_by_vertical as Record<string,number>).sort(([,a],[,b])=>b-a).map(([vert,rev])=>{
                const maxR=Math.max(...Object.values(s.revenue_by_vertical as Record<string,number>)), p=maxR>0?((rev as number)/maxR)*100:0
                return (
                  <div key={vert}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:13, color:'var(--foreground)', fontWeight:600 }}>{vert}</span>
                      <span style={{ fontSize:13, fontVariantNumeric:'tabular-nums', color:'var(--foreground)', fontWeight:700 }}>{fmtBRL(rev as number)}</span>
                    </div>
                    <div style={{ height:6, borderRadius:999, background:'var(--secondary)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${p}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:999 }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}

export function IntelView({ isAdmin, profile, closerStats, insightData, insightDate, snapshot, adminExtra, currentMonth }: any) {
  if (isAdmin) return <AdminView closerStats={closerStats} insightData={insightData} insightDate={insightDate} adminExtra={adminExtra} currentMonth={currentMonth}/>
  return <CloserView profile={profile} snapshot={snapshot} insightData={insightData} insightDate={insightDate}/>
}
