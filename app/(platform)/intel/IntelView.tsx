'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Brain, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Users, BarChart2, Lightbulb,
  AlertCircle, Star, Activity, ChevronLeft, ChevronRight, ChevronDown, Check, X,
} from 'lucide-react'
import { computeForecast, RecurringSale } from '@/lib/telao/forecast'
import { weekdayInSaoPaulo, hourInSaoPaulo } from '@/lib/timezone'

// Mesma tradução de vertical usada no servidor (page.tsx) — precisa existir
// aqui também porque os dados brutos (rawSales/rawLeads) chegam com a chave
// crua do banco, não com o rótulo já traduzido.
const VERT_LABEL: Record<string, string> = {
  medreview:   'Med-Review R1',
  anestreview: 'Anest-Review',
  oftreview:   'Oft-Review',
  ortoprev:    'Ortop-Review',
  ortopreview: 'Ortop-Review',
}
const VERT_CANON: Record<string, string> = {}
Object.values(VERT_LABEL).forEach(label => { VERT_CANON[label.toLowerCase().replace(/[\s-]/g, '')] = label })
const vLabelClient = (k: string) => {
  if (!k) return 'outros'
  const key = String(k).trim()
  if (VERT_LABEL[key]) return VERT_LABEL[key]
  const norm = key.toLowerCase().replace(/[\s-]/g, '')
  return VERT_CANON[norm] ?? key
}

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
  // Fonte do número central escala com o tamanho do anel, sempre com espaço
  // confortável dentro do círculo interno (nunca encosta no anel colorido).
  const numFontSize = Math.max(15, Math.min(30, size * 0.115))
  const lblFontSize = Math.max(9, Math.min(12, size * 0.05))
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
        <text x={cx} y={cy-numFontSize*0.32} textAnchor="middle" style={{ fontSize:numFontSize, fontWeight:900, fill:'var(--foreground)' }}>{fmtBRL(total).replace('R$','').trim()}</text>
        <text x={cx} y={cy+lblFontSize+8} textAnchor="middle" style={{ fontSize:lblFontSize, fill:'var(--muted-foreground)' }}>total</text>
      </svg>
      {/* Legendas embaixo — uma por linha, sem quebra de texto dentro da mesma linha */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth: Math.max(size, 280) }}>
        {filtered.map((d, i) => {
          const pct = total>0 ? (d.value/total)*100 : 0
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:9, height:9, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
              <span style={{ fontSize:12.5, color:'var(--muted-foreground)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.label}</span>
              <span style={{ flex:1, borderBottom:'1px dashed var(--border)', margin:'0 2px', minWidth:8 }}/>
              <span style={{ fontSize:12.5, fontWeight:700, color:'var(--foreground)', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', flexShrink:0 }}>
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
// Ranking dos produtos mais vendidos, em formato de pódium — 1º/2º/3º lugar
// como blocos elevados (altura proporcional à posição), 4º e 5º numa lista
// simples embaixo. Agrupado por produto+vertical (produtos repetem nome
// entre verticais diferentes, por isso a vertical aparece pequena embaixo).
function ProductRankingCard({ data, title }: { data: {product:string;vertical:string;count:number;rev:number}[]; title?: string }) {
  if (!data || data.length === 0) return null
  const top3 = data.slice(0, 3)
  const rest = data.slice(3, 5)
  // Ordem visual clássica de pódium: 2º à esquerda, 1º no meio (mais alto), 3º à direita.
  const visualOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as typeof top3
  const rankOf = (p: typeof top3[0]) => top3.indexOf(p) // posição real (0,1,2) de quem está naquele slot visual
  const PODIUM_HEIGHT = [130, 96, 74] // altura do bloco por posição real (1º,2º,3º) — 1º sempre o mais alto
  const MEDAL  = ['🥇','🥈','🥉']
  const GRAD   = ['linear-gradient(180deg,#fbbf24,#d97706)','linear-gradient(180deg,#cbd5e1,#94a3b8)','linear-gradient(180deg,#fb923c,#c2410c)']
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
      <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)' }}>{title ?? 'Ranking de produtos mais vendidos'}</p>
      <p style={{ margin:'2px 0 6px', fontSize:11, color:'var(--muted-foreground)' }}>Top 5 por receita no mês</p>

      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:14, marginTop:24, padding:'0 8px' }}>
        {visualOrder.map((p) => {
          const rank = rankOf(p)
          return (
            <div key={`${p.product}-${p.vertical}`} style={{ display:'flex', flexDirection:'column', alignItems:'center', width:130 }}>
              <span style={{ fontSize:26 }}>{MEDAL[rank]}</span>
              <span style={{ fontSize:12.5, fontWeight:800, color:'var(--foreground)', textAlign:'center', marginTop:6, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{p.product}</span>
              <span style={{ fontSize:10.5, color:'var(--muted-foreground)', marginTop:2 }}>{p.vertical}</span>
              <span style={{ fontSize:15, fontWeight:900, color:'var(--foreground)', marginTop:6, fontVariantNumeric:'tabular-nums' }}>{fmtBRL(p.rev)}</span>
              <div style={{ width:'100%', height:PODIUM_HEIGHT[rank], background:GRAD[rank], borderRadius:'10px 10px 0 0', marginTop:12, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:10, boxShadow:'0 4px 16px rgba(0,0,0,.12)' }}>
                <span style={{ fontSize:20, fontWeight:900, color:'rgba(255,255,255,.85)' }}>{rank+1}º</span>
              </div>
            </div>
          )
        })}
      </div>

      {rest.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:22 }}>
          {rest.map((p, i) => (
            <div key={`${p.product}-${p.vertical}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:11, background:'var(--secondary)' }}>
              <span style={{ width:20, textAlign:'center', fontSize:12, fontWeight:800, color:'var(--muted-foreground)', flexShrink:0 }}>{i+4}º</span>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:12.5, fontWeight:700, color:'var(--foreground)' }}>{p.product}</span>
                <span style={{ fontSize:10.5, color:'var(--muted-foreground)', marginLeft:7 }}>{p.vertical}</span>
              </div>
              <span style={{ fontSize:13, fontWeight:800, color:'var(--foreground)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{fmtBRL(p.rev)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Ticket médio por vertical — um quadrante (card) por vertical, lado a lado.
function AvgTicketCard({ data }: { data: {label:string;avgTicket:number;count:number}[] }) {
  const filtered = (data ?? []).filter(d => d.count > 0)
  if (filtered.length === 0) return null
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
      <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Ticket médio por vertical</p>
      <p style={{ margin:'2px 0 20px', fontSize:11, color:'var(--muted-foreground)' }}>Valor médio por venda em cada vertical, somando o mês inteiro</p>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(filtered.length,4)}, 1fr)`, gap:14 }}>
        {filtered.map(d => {
          const isR1 = d.label.includes('R1')
          const accent = isR1 ? '#7c3aed' : '#2563eb'
          return (
            <div key={d.label} style={{ padding:'18px 16px', borderRadius:14, background:'var(--secondary)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:accent, flexShrink:0 }}/>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--muted-foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
              </div>
              <span style={{ fontSize:21, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(d.avgTicket)}</span>
              <span style={{ fontSize:10.5, color:'var(--muted-foreground)' }}>{d.count} {d.count===1?'venda':'vendas'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Distribuição de vendas por dia da semana (em cima) e por horário (embaixo) —
// soma TODAS as vendas do mês corrente, agrupadas pelo dia/hora em que cada
// uma aconteceu (sempre em horário de SP). Não é "só hoje" nem média.
function WeekdayHourCard({ weekday, hour }: { weekday:{label:string;count:number;rev:number}[]; hour:{hour:number;count:number}[] }) {
  const hasData = (weekday ?? []).some(d => d.count > 0) || (hour ?? []).some(h => h.count > 0)
  if (!hasData) return null
  const maxWd = Math.max(...weekday.map(d => d.count), 1)
  const businessHours = hour.filter(h => h.hour >= 6 && h.hour <= 23)
  const maxHr = Math.max(...businessHours.map(h => h.count), 1)
  const WD_BAR_MAX = 60   // altura máxima da barra (px) — dia da semana
  const HR_BAR_MAX = 56   // altura máxima da barra (px) — horário
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
      <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Distribuição de vendas por dia e horário</p>
      <p style={{ margin:'2px 0 24px', fontSize:11, color:'var(--muted-foreground)', lineHeight:1.5 }}>
        Soma de todas as vendas do mês, agrupadas pelo dia da semana e pela hora em que cada uma aconteceu
      </p>

      <p style={{ margin:'0 0 16px', fontSize:10.5, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.06em' }}>Por dia da semana</p>
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:36 }}>
        {weekday.map(d => {
          const barH = d.count > 0 ? Math.max((d.count/maxWd)*WD_BAR_MAX, 8) : 2
          return (
            <div key={d.label} title={`${d.label}: ${d.count} venda${d.count!==1?'s':''}`} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
              {/* Rótulo + barra num único bloco "colado embaixo" — o valor sempre
                  fica rente à barra, seja ela alta ou baixa (sem vão no meio). */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:WD_BAR_MAX+20, width:'100%' }}>
                {d.count>0 && <span style={{ fontSize:11, fontWeight:800, color:'var(--foreground)', marginBottom:5 }}>{d.count}</span>}
                <div style={{ width:'100%', maxWidth:44, height:barH, borderRadius:'6px 6px 0 0', background:'linear-gradient(180deg,#818cf8,#6366f1)' }}/>
              </div>
              <span style={{ fontSize:10.5, marginTop:8, color:'var(--muted-foreground)', fontWeight:600 }}>{d.label}</span>
            </div>
          )
        })}
      </div>

      <p style={{ margin:'0 0 16px', fontSize:10.5, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.06em' }}>Por horário</p>
      <div style={{ display:'flex', gap:5, alignItems:'flex-end' }}>
        {businessHours.map(h => {
          const isPeak = h.count === maxHr && h.count > 0
          const barH = h.count > 0 ? Math.max((h.count/maxHr)*HR_BAR_MAX, 6) : 2
          return (
            <div key={h.hour} title={`${h.hour}h: ${h.count} venda${h.count!==1?'s':''}`} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', cursor:'default' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:HR_BAR_MAX+16, width:'100%' }}>
                {h.count>0 && <span style={{ fontSize:9, fontWeight:700, color: isPeak?'var(--foreground)':'var(--muted-foreground)', marginBottom:4 }}>{h.count}</span>}
                <div style={{ width:'100%', maxWidth:20, height:barH, borderRadius:'3px 3px 0 0', background: isPeak?'#7c3aed':'rgba(124,58,237,.32)' }}/>
              </div>
              <span style={{ fontSize:9, marginTop:6, color:'var(--muted-foreground)' }}>{h.hour}h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  // Mescla entradas de byVertical que caem no mesmo rótulo — pode acontecer de
  // duas chaves brutas diferentes (ex: variação de grafia salva no banco em
  // épocas diferentes) traduzirem pro mesmo nome de vertical. Sem isso, o
  // dropdown de filtro recebia duas opções idênticas (key duplicada no React)
  // e os totais dessa vertical ficavam divididos entre as duas entradas.
  const vertMerged: Record<string, any> = {}
  Object.values(byVertical).forEach((v: any) => {
    if (!vertMerged[v.label]) { vertMerged[v.label] = { ...v }; return }
    const m = vertMerged[v.label]
    ;['rev','count','leads','closer','ambassador','selfcheckout','closerRev','ambassadorRev','selfcheckoutRev'].forEach(k => {
      m[k] = (m[k] ?? 0) + (v[k] ?? 0)
    })
  })
  const verticals   = Object.entries(vertMerged).sort(([,a]:any,[,b]:any) => b.rev - a.rev) as any[]
  const vertLabels  = verticals.map(([,v]:any) => v.label)

  // Opções de dropdown — "outros" (sem vertical identificada) não entra como opção
  const teamOpts   = [{value:'todos',label:'Todos os times'},{value:'R1',label:'Time R1',dot:'#7c3aed'},{value:'OAO',label:'Time OAO',dot:'#2563eb'}]
  const vertOpts   = verticals.filter(([,v]:any) => v.label !== 'outros').map(([,v]:any) => ({ value:v.label, label:v.label, dot: v.label.includes('R1')?'#7c3aed':'#2563eb' }))
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

  // ── Motor de filtragem sobre os dados BRUTOS (não só o que foi somado por closer) ──
  // Isso é o que garante que filtrar só por vertical traga TUDO daquela vertical
  // (inclusive vendas que não bateram com nenhum closer cadastrado), não só a
  // fatia que por acaso também tinha um closer identificado.
  const closerLookup = useMemo(() => {
    const byId: Record<string, any> = {}, byHub: Record<string, any> = {}
    allClosers.forEach((c: any) => { byId[c.id] = c; if (c.hubspot_id) byHub[c.hubspot_id] = c })
    return { byId, byHub }
  }, [allClosers])

  function matchesTeamCloser(e: any, ownerKeyField: 'closer'|'lead' = 'closer') {
    if (filterTeam === 'todos' && filterCloser === 'todos') return true
    const owner = ownerKeyField === 'closer'
      ? ((e.closer_id && closerLookup.byId[e.closer_id]) || (e.closer_hubspot_id && closerLookup.byHub[e.closer_hubspot_id]))
      : (e.owner_id && closerLookup.byHub[e.owner_id])
    if (!owner) return false
    if (filterTeam !== 'todos' && owner.team !== filterTeam) return false
    if (filterCloser !== 'todos' && owner.id !== filterCloser) return false
    return true
  }

  const scopedSales = useMemo(() => {
    return (adminExtra?.rawSales ?? []).filter((e: any) => {
      if (filterVert.length > 0 && !filterVert.includes(vLabelClient(e.vertical ?? 'outros'))) return false
      return matchesTeamCloser(e, 'closer')
    })
  }, [adminExtra?.rawSales, filterVert, filterTeam, filterCloser, closerLookup])

  const scopedLeads = useMemo(() => {
    return (adminExtra?.rawLeads ?? []).filter((l: any) => {
      if (filterVert.length > 0 && !filterVert.includes(vLabelClient(l.vertical ?? 'outros'))) return false
      return matchesTeamCloser(l, 'lead')
    })
  }, [adminExtra?.rawLeads, filterVert, filterTeam, filterCloser, closerLookup])

  const scopedTotalRev   = scopedSales.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  const scopedTotalSales = scopedSales.length
  const scopedTotalLeads = scopedLeads.length

  const displayTotalRev    = hasFilters ? scopedTotalRev   : totalRev
  const displayTotalSales  = hasFilters ? scopedTotalSales : totalSales
  const displayTotalLeads  = hasFilters ? scopedTotalLeads : totalLeadsHS
  const proj = bizPassed > 0 ? (displayTotalRev / bizPassed) * bizTotal : 0
  const maxRev = Math.max(...filtered.map((c:any) => closerRev(c)), 1)

  // byType filtrado — agora a partir das vendas brutas de verdade (antes, com
  // filtro de vertical ativo, tudo virava "closer" por aproximação; agora conta
  // embaixador/self-checkout corretamente também).
  const displayByType = useMemo(() => {
    if (!hasFilters) return byType
    const agg = { closer:{rev:0,count:0}, ambassador:{rev:0,count:0}, selfcheckout:{rev:0,count:0} }
    scopedSales.forEach((e: any) => {
      const v = Number(e.value) || 0
      if (e.is_self_checkout || e.seller_type === 'self_checkout') { agg.selfcheckout.rev += v; agg.selfcheckout.count++ }
      else if (e.sold_by_ambassador || e.seller_type === 'ambassador') { agg.ambassador.rev += v; agg.ambassador.count++ }
      else { agg.closer.rev += v; agg.closer.count++ }
    })
    return agg
  }, [hasFilters, scopedSales, byType])

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
    scopedLeads.forEach((l: any) => {
      const label = vLabelClient(l.vertical ?? 'outros')
      if (!cv[label]) cv[label] = { label, sales:0, leads:0 }
      cv[label].leads++
    })
    scopedSales.forEach((e: any) => {
      const label = vLabelClient(e.vertical ?? 'outros')
      if (!cv[label]) cv[label] = { label, sales:0, leads:0 }
      cv[label].sales++
    })
    return Object.values(cv).filter(v => v.leads > 0 && v.label !== 'outros')
      .sort((a, b) => (b.leads > 0 ? b.sales/b.leads : 0) - (a.leads > 0 ? a.sales/a.leads : 0))
  }, [scopedLeads, scopedSales])

  // Verticals para exibição
  const displayVerts = useMemo(() => {
    const source = Object.entries(displayByVertical)
    return filterVert.length > 0
      ? source.filter(([, v]: any) => filterVert.includes(v.label))
      : source.sort(([,a]:any,[,b]:any) => b.rev - a.rev)
  }, [displayByVertical, filterVert])

  // Ranking de produtos filtrado
  const scopedProductRanking = useMemo(() => {
    if (!hasFilters) return adminExtra?.productRanking ?? []
    const map: Record<string, {product:string;vertical:string;count:number;rev:number}> = {}
    scopedSales.forEach((e: any) => {
      if (!e.product) return
      const vlabel = vLabelClient(e.vertical ?? 'outros')
      if (vlabel === 'outros') return
      const key = `${e.product}|||${vlabel}`
      if (!map[key]) map[key] = { product:e.product, vertical:vlabel, count:0, rev:0 }
      map[key].count++; map[key].rev += Number(e.value) || 0
    })
    return Object.values(map).sort((a,b) => b.rev - a.rev).slice(0, 5)
  }, [hasFilters, scopedSales, adminExtra?.productRanking])

  // Ticket médio por vertical filtrado — só vendas 'nova' (parcela recorrente não conta)
  const scopedAvgTicketByVertical = useMemo(() => {
    if (!hasFilters) return adminExtra?.avgTicketByVertical ?? []
    const map: Record<string, {rev:number;count:number}> = {}
    scopedSales.filter((e: any) => (e.sale_type ?? 'nova') === 'nova').forEach((e: any) => {
      const label = vLabelClient(e.vertical ?? 'outros')
      if (label === 'outros') return
      if (!map[label]) map[label] = { rev:0, count:0 }
      map[label].rev += Number(e.value) || 0; map[label].count++
    })
    return Object.entries(map).map(([label, v]) => ({
      label, avgTicket: v.count > 0 ? v.rev / v.count : 0, count: v.count,
    })).sort((a,b) => b.avgTicket - a.avgTicket)
  }, [hasFilters, scopedSales, adminExtra?.avgTicketByVertical])

  // Distribuição por dia/hora filtrada (sempre em horário de SP)
  const WEEKDAY_LABELS_C = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const scopedWeekdayHour = useMemo(() => {
    if (!hasFilters) return { weekday: adminExtra?.salesByWeekday ?? [], hour: adminExtra?.salesByHour ?? [] }
    const weekday = WEEKDAY_LABELS_C.map(label => ({ label, count:0, rev:0 }))
    const hour = Array.from({ length:24 }, (_, h) => ({ hour:h, count:0 }))
    scopedSales.forEach((e: any) => {
      if (!e.occurred_at) return
      const wd = weekdayInSaoPaulo(e.occurred_at)
      weekday[wd].count++; weekday[wd].rev += Number(e.value) || 0
      hour[hourInSaoPaulo(e.occurred_at)].count++
    })
    return { weekday, hour }
  }, [hasFilters, scopedSales, adminExtra?.salesByWeekday, adminExtra?.salesByHour])

  // Nova vs recorrente filtrado
  const scopedNewVsRecurring = useMemo(() => {
    if (!hasFilters) return { newRev: totalNewRev, recRev: totalRecurringRev }
    let newRev = 0, recRev = 0
    scopedSales.forEach((e: any) => {
      const v = Number(e.value) || 0
      if ((e.sale_type ?? 'nova') === 'nova') newRev += v; else recRev += v
    })
    return { newRev, recRev }
  }, [hasFilters, scopedSales, totalNewRev, totalRecurringRev])

  // Forecast filtrado — recalcula com o histórico completo de recorrência,
  // já filtrado pelos mesmos critérios (vertical/time/closer).
  const scopedForecast = useMemo(() => {
    if (!hasFilters) return forecast
    const filteredRecurring = (adminExtra?.rawRecurring ?? []).filter((e: any) => {
      if (filterVert.length > 0 && !filterVert.includes(vLabelClient(e.vertical ?? 'outros'))) return false
      return matchesTeamCloser(e, 'closer')
    })
    const recurringForForecast = filteredRecurring
      .filter((e: any) => e.subscription_id && e.installment_number && e.total_installments)
      .map((e: any) => ({
        subscription_id: e.subscription_id, installment_number: e.installment_number,
        total_installments: e.total_installments, value: Number(e.value) || 0, occurred_at: e.occurred_at,
      }))
    return computeForecast(recurringForForecast, scopedNewVsRecurring.recRev)
  }, [hasFilters, adminExtra?.rawRecurring, filterVert, filterTeam, filterCloser, closerLookup, scopedNewVsRecurring.recRev])

  const hasTipoData  = (displayByType?.closer?.rev??0)+(displayByType?.ambassador?.rev??0)+(displayByType?.selfcheckout?.rev??0) > 0
  const hasLeadsData = filtered.filter((c:any)=>closerLeads(c)>0).length > 0
  const tipoConvCols  = (hasTipoData && hasLeadsData) ? '1fr 1fr' : '1fr'

  // Embaixadores certificados — só Time R1, só quem tem meta ou já certificou algo no mês.
  // Importante: parte de `allClosers` (não de `filtered`), porque `filtered` some com quem
  // tem receita zero na vertical selecionada — e certificação não é métrica de receita,
  // então um filtro de vertical não pode esconder um closer que certificou embaixador.
  const ambassadorGoalRows = (filterVert.length > 0 && !filterVert.includes('Med-Review R1'))
    ? []
    : allClosers
        .filter((c:any) => c.team === 'R1')
        .filter((c:any) => filterTeam === 'todos' || filterTeam === 'R1')
        .filter((c:any) => filterCloser === 'todos' || c.id === filterCloser)
        .filter((c:any) => (c.goal_ambassador??0) > 0 || (c.ambassadors_certified??0) > 0)
        .sort((a:any,b:any) => (b.ambassadors_certified??0) - (a.ambassadors_certified??0))
  const hasAmbassadorGoalData  = ambassadorGoalRows.length > 0
  const totalCertsR1           = ambassadorGoalRows.reduce((s:number,c:any) => s + (c.ambassadors_certified??0), 0)
  const totalGoalAmbassadorR1  = ambassadorGoalRows.reduce((s:number,c:any) => s + (c.goal_ambassador??0), 0)

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

      {/* Receita nova vs recorrente — dois quadrantes com o valor total de cada */}
      {(scopedNewVsRecurring.newRev > 0 || scopedNewVsRecurring.recRev > 0) && (
        <FadeIn delay={240}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
            <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Receita nova vs recorrente</p>
            <p style={{ margin:'0 0 20px', fontSize:11, color:'var(--muted-foreground)' }}>Split do mês corrente{hasFilters?' · filtrado':''}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:14 }}>
              {[
                { label:'Vendas novas',       value:scopedNewVsRecurring.newRev, color:'#6366f1' },
                { label:'Receita recorrente', value:scopedNewVsRecurring.recRev, color:'#0d9488' },
              ].map(x => {
                const total = scopedNewVsRecurring.newRev + scopedNewVsRecurring.recRev
                const pct = total > 0 ? (x.value/total)*100 : 0
                return (
                  <div key={x.label} style={{ padding:'18px 16px', borderRadius:14, background:'var(--secondary)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:x.color, flexShrink:0 }}/>
                      <span style={{ fontSize:11, fontWeight:700, color:'var(--muted-foreground)' }}>{x.label}</span>
                    </div>
                    <span style={{ fontSize:22, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(x.value)}</span>
                    <span style={{ fontSize:10.5, color:'var(--muted-foreground)' }}>{fmtPct(pct)} do total</span>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Forecast de recorrência — próximos meses (até dezembro) */}
      {scopedForecast && scopedForecast.monthlyForecast?.length > 0 && (
        <FadeIn delay={270}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
            <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:800, color:'var(--foreground)' }}>Forecast de recorrência — próximos meses</p>
            <p style={{ margin:'0 0 18px', fontSize:11, color:'var(--muted-foreground)' }}>
              Receita recorrente esperada por mês, já descontado o histórico de cancelamento/atraso.{hasFilters?' Filtrado.':''}
            </p>
            <BarChart
              data={scopedForecast.monthlyForecast.map((m: any) => ({
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
                <p style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--foreground)', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(scopedForecast.mrrAtual)}</p>
              </div>
              <div style={{ padding:'12px 14px', borderRadius:12, background:'rgba(99,102,241,.05)', border:'1px solid rgba(99,102,241,.18)' }}>
                <p style={{ margin:'0 0 3px', fontSize:9, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.08em' }}>Esperado até dezembro</p>
                <p style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--foreground)', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(scopedForecast.parcelasRestantesAjustado)}</p>
                <p style={{ margin:'2px 0 0', fontSize:9, color:'var(--muted-foreground)' }}>{fmtPct(scopedForecast.persistenceRate*100)} de aderência histórica aplicada</p>
              </div>
            </div>

            <div style={{ display:'flex', gap:16, marginTop:14, flexWrap:'wrap' }}>
              {[
                { label:'Ativas',    count:scopedForecast.ativas,    color:'#16a34a' },
                { label:'Atrasadas', count:scopedForecast.atrasadas, color:'#b45309' },
                { label:'Em risco',  count:scopedForecast.emRisco,   color:'#dc2626' },
                { label:'Completas', count:scopedForecast.completas, color:'#94a3b8' },
              ].filter(x => x.count > 0).map(({ label, count, color }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:color }}/>
                  <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{count} assinatura{count!==1?'s':''} <span style={{ color, fontWeight:700 }}>{label.toLowerCase()}</span></span>
                </div>
              ))}
              {scopedForecast.sampleSize < 5 && (
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
                  size={228}
                  thickness={38}
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

      {/* Embaixadores certificados por closer — meta x realizado (Time R1) */}
      {hasAmbassadorGoalData && (
        <FadeIn delay={330}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'22px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:8 }}>
              <div>
                <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--foreground)', display:'flex', alignItems:'center', gap:7 }}>
                  <Star size={14} style={{ color:'#a855f7' }}/> Embaixadores certificados por closer
                  <span style={{ fontSize:11, color:'var(--muted-foreground)', fontWeight:400 }}>· Time R1</span>
                </p>
                <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--muted-foreground)' }}>Meta de certificações do mês vs. realizado</p>
              </div>
              <span style={{ fontSize:13, fontWeight:800, color:'var(--foreground)', fontVariantNumeric:'tabular-nums' }}>
                {totalCertsR1} <span style={{ fontWeight:400, color:'var(--muted-foreground)', fontSize:11 }}>/ {totalGoalAmbassadorR1} no mês</span>
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {ambassadorGoalRows.map((c:any) => {
                const goal = c.goal_ambassador ?? 0
                const done = c.ambassadors_certified ?? 0
                const pct  = goal > 0 ? (done/goal)*100 : (done>0 ? 100 : 0)
                const risk = riskInfo(pct, 0, 0)
                return (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <CloserAv name={c.name} avatarUrl={c.avatar_url} size={24}/>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--foreground)' }}>{c.name.split(' ')[0]}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#a855f7' }}>
                          {done}{goal>0 ? `/${goal}` : ''} <span style={{ fontWeight:400, color:'var(--muted-foreground)' }}>{goal>0?`· ${fmtPct(pct)}`:''}</span>
                        </span>
                      </div>
                      <div style={{ height:6, background:'var(--secondary)', borderRadius:999, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:'linear-gradient(90deg,#a855f7,#6366f1)', borderRadius:999 }}/>
                      </div>
                    </div>
                    {goal>0 && (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, background:risk.bg, border:`1px solid ${risk.border}`, flexShrink:0 }}>
                        <risk.Icon size={10} style={{ color:risk.text }}/>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
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
                // Vendas > leads é fisicamente impossível (não existe venda sem
                // lead antes) — sinal de que o lead não tem a vertical gravada
                // no HubSpot pra essa venda, não de que a conversão é real.
                const dadoInsuficiente = v.sales > v.leads
                const conv = v.leads > 0 ? (v.sales / v.leads) * 100 : 0
                const maxConv = Math.max(...convByVertical.filter((x:any)=>x.sales<=x.leads).map((x: any) => x.leads > 0 ? (x.sales/x.leads)*100 : 0), 1)
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
                      {dadoInsuficiente ? (
                        <span title="Vendas maior que leads não é possível — sinal de que os leads dessa vertical não têm o campo vertical preenchido no HubSpot" style={{ fontSize:11, fontWeight:700, color:'#b45309' }}>⚠ dado insuficiente</span>
                      ) : (
                        <span style={{ fontSize:14, fontWeight:900, color:conv >= 30 ? '#16a34a' : conv >= 15 ? '#b45309' : '#dc2626', fontVariantNumeric:'tabular-nums' }}>{conv.toFixed(1)}%</span>
                      )}
                    </div>
                    <div style={{ height:10, background:'var(--secondary)', borderRadius:999, overflow:'hidden' }}>
                      <div style={{ height:'100%', width: dadoInsuficiente ? '100%' : `${(conv/maxConv)*100}%`, background: dadoInsuficiente ? 'repeating-linear-gradient(45deg,#fde68a,#fde68a 6px,#fbbf24 6px,#fbbf24 12px)' : (isR1?'linear-gradient(90deg,#7c3aed,#a855f7)':'linear-gradient(90deg,#2563eb,#6366f1)'), borderRadius:999, transition:'width .6s ease' }}/>
                    </div>
                  </div>
                )
              })}
            </div>
            {convByVertical.some((v:any) => v.sales > v.leads) && (
              <p style={{ margin:'16px 0 0', fontSize:10.5, color:'var(--muted-foreground)', lineHeight:1.5, paddingTop:14, borderTop:'1px solid var(--border)' }}>
                ⚠ Verticais marcadas como "dado insuficiente" têm mais vendas do que leads registrados — isso indica que a maioria dos leads dessa vertical não tem o campo de vertical preenchido no HubSpot (não é um erro de cálculo, é falta de dado na origem).
              </p>
            )}
          </div>
        </FadeIn>
      )}

      {/* Ranking de produtos mais vendidos (top 5, todos os closers) */}
      {scopedProductRanking?.length > 0 && (
        <FadeIn delay={370}>
          <ProductRankingCard data={scopedProductRanking} title="Ranking de produtos mais vendidos"/>
        </FadeIn>
      )}

      {/* Ticket médio por vertical */}
      {scopedAvgTicketByVertical?.length > 0 && (
        <FadeIn delay={380}>
          <AvgTicketCard data={scopedAvgTicketByVertical}/>
        </FadeIn>
      )}

      {/* Distribuição de vendas por dia da semana / horário */}
      {(scopedWeekdayHour.weekday?.length > 0 || scopedWeekdayHour.hour?.length > 0) && (
        <FadeIn delay={390}>
          <WeekdayHourCard weekday={scopedWeekdayHour.weekday ?? []} hour={scopedWeekdayHour.hour ?? []}/>
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
      {(s.productRanking?.length ?? 0) > 0 && (
        <FadeIn delay={340}>
          <ProductRankingCard data={s.productRanking} title="Meus produtos mais vendidos"/>
        </FadeIn>
      )}

      {(s.avgTicketByVertical?.length ?? 0) > 0 && (
        <FadeIn delay={350}>
          <AvgTicketCard data={s.avgTicketByVertical}/>
        </FadeIn>
      )}

      {(s.salesByWeekday || s.salesByHour) && (
        <FadeIn delay={360}>
          <WeekdayHourCard weekday={s.salesByWeekday ?? []} hour={s.salesByHour ?? []}/>
        </FadeIn>
      )}
    </div>
  )
}

export function IntelView({ isAdmin, profile, closerStats, insightData, insightDate, snapshot, adminExtra, currentMonth }: any) {
  if (isAdmin) return <AdminView closerStats={closerStats} insightData={insightData} insightDate={insightDate} adminExtra={adminExtra} currentMonth={currentMonth}/>
  return <CloserView profile={profile} snapshot={snapshot} insightData={insightData} insightDate={insightDate}/>
}
