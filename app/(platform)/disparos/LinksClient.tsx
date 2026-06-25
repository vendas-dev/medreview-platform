'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Link2, Users, BarChart2, Package, Calendar, List, ChevronDown,
         DollarSign, RefreshCw, Clock, X, Search, TrendingUp } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────
interface GeracaoLink {
  id:string; deal_id:string|null; deal_name:string|null; deal_value:number|null
  deal_created_at:string|null; generated_at:string; owner_name:string
  vertical:string|null; product_name:string|null; generation_mode:string|null
  selected_option:string|null; payment_link:string|null; expires_at:string|null
  pipeline_name:string|null; stage_name:string|null; created_at:string
}
type TabId = 'geral'|'owners'|'produtos'|'analise'|'tabela'

const TABS = [
  { id:'geral'   as TabId, label:'Visão Geral', icon:BarChart2  },
  { id:'owners'  as TabId, label:'Por Owner',   icon:Users      },
  { id:'produtos'as TabId, label:'Por Produto', icon:Package    },
  { id:'analise' as TabId, label:'Análise',     icon:TrendingUp },
  { id:'tabela'  as TabId, label:'Tabela',      icon:List       },
]
const COLORS=['#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#818cf8','#fb923c','#e879f9','#2dd4bf','#f472b6']
const TOOLTIP_STYLE={ background:'#1a1a2e', border:'1px solid rgba(139,92,246,.3)', borderRadius:10, fontSize:12, color:'#e2e8f0' }

function todayIso(){ return new Date().toISOString().slice(0,10) }
function pad(n:number){ return String(n).padStart(2,'0') }
function fmtShortDate(iso:string){ const d=new Date(iso+'T12:00:00'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}` }
function fmtBRL(v:number|null){ if(!v||v===0) return '—'; return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0}) }
function formatDuration(ms:number){ if(ms<0) return '—'; const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000); if(h>=24) return `${Math.floor(h/24)}d ${h%24}h`; return `${h}h ${m}min` }

// ── Componentes de filtro ─────────────────────────────────────
function FSelect({ label, value, onChange, options, placeholder='Todos' }: { label:string;value:string;onChange:(v:string)=>void;options:string[];placeholder?:string }) {
  return (
    <div style={{ flex:1, minWidth:140 }}>
      <label style={{ fontSize:9, fontWeight:800, color:'#6366f1', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'.1em' }}>{label}</label>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={[{value:'',label:placeholder},...options.map(o=>({value:o,label:o}))]}
        placeholder={placeholder}
      />
    </div>
  )
}

function FDate({ label, value, onChange, placeholder }: { label:string;value:string;onChange:(v:string)=>void;placeholder:string }) {
  return (
    <div style={{ flex:1, minWidth:130 }}>
      <label style={{ fontSize:9, fontWeight:800, color:'rgba(99,102,241,.7)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.1em' }}>{label}</label>
      <div style={{ position:'relative' }}>
        <Calendar size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(99,102,241,.7)', pointerEvents:'none' }}/>
        <input type="date" value={value} onChange={e=>onChange(e.target.value)}
          style={{ width:'100%', height:38, padding:'0 12px 0 30px', borderRadius:9, border:'1.5px solid var(--border)', background:'rgba(99,102,241,.08)', color:value?'var(--foreground)':'var(--muted-foreground)', fontSize:13, outline:'none', fontFamily:'inherit', colorScheme:'dark' }}
          onFocus={e=>{e.target.style.borderColor='rgba(99,102,241,.6)'; e.target.style.boxShadow='0 0 0 2px rgba(99,102,241,.15)'}}
          onBlur={e=>{e.target.style.borderColor='rgba(99,102,241,.25)'; e.target.style.boxShadow='none'}}/>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color, icon:Icon }: any) {
  return (
    <div style={{ flex:1, background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', boxShadow:'0 1px 8px rgba(0,0,0,.06)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:14, right:14, width:34, height:34, borderRadius:9, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <p style={{ fontSize:9, fontWeight:800, color:'#6366f1', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'.1em' }}>{label}</p>
      <p style={{ fontSize:22, fontWeight:900, color:'var(--foreground)', margin:'0 0 3px', letterSpacing:'-.02em' }}>{value}</p>
      {sub && <p style={{ fontSize:10, color:'var(--muted-foreground)', margin:0 }}>{sub}</p>}
    </div>
  )
}

function RankingList({ data, label, onClick }: { data:{name:string;count:number}[];label:string;onClick:(n:string)=>void }) {
  const max=data[0]?.count??1; const total=data.reduce((s,d)=>s+d.count,0)
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'20px 22px', boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
      <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>{label}</h3>
      <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Por volume de geração — clique para detalhar</p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {data.map((d,i)=>(
          <div key={d.name} onClick={()=>onClick(d.name)} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'5px 8px', borderRadius:8, transition:'background .15s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.06)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
            <span style={{ fontSize:11, color:'#6366f1', width:18, textAlign:'right', opacity:.6, flexShrink:0, fontWeight:700 }}>{i+1}</span>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--foreground)', width:160, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
            <div style={{ flex:1, height:4, borderRadius:999, background:'rgba(255,255,255,.06)' }}>
              <div style={{ height:'100%', width:`${(d.count/max)*100}%`, borderRadius:999, background:COLORS[i%COLORS.length], transition:'width .6s' }}/>
            </div>
            <span style={{ fontSize:12, fontWeight:800, color:'var(--foreground)', width:45, textAlign:'right', flexShrink:0 }}>{d.count}</span>
            <span style={{ fontSize:10, color:'var(--muted-foreground)', width:30, textAlign:'right', flexShrink:0 }}>{Math.round(d.count/total*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecordModal({ title, rows, onClose }: { title:string;rows:GeracaoLink[];onClose:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', border:'1px solid rgba(99,102,241,.3)', borderRadius:20, width:'100%', maxWidth:1000, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.5)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><h3 style={{ fontSize:15, fontWeight:800, color:'var(--foreground)', margin:0 }}>{title}</h3><p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'2px 0 0' }}>{rows.length} registros</p></div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}><X size={14}/></button>
        </div>
        <div style={{ overflowY:'auto', flex:1, overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ background:'rgba(99,102,241,.08)', position:'sticky', top:0 }}>
              {['Data','Owner','Deal','Valor','Produto','Tipo','Opção','Etapa'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:700, color:'rgba(99,102,241,.7)', fontSize:9, textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'transparent':'rgba(99,102,241,.03)' }}>
                  <td style={{ padding:'7px 12px', color:'var(--muted-foreground)', whiteSpace:'nowrap' }}>{new Date(r.generated_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'7px 12px', fontWeight:600, color:'var(--foreground)', whiteSpace:'nowrap' }}>{r.owner_name}</td>
                  <td style={{ padding:'7px 12px', color:'var(--foreground)', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.deal_name??'—'}</td>
                  <td style={{ padding:'7px 12px', color:'#34d399', fontWeight:700 }}>{fmtBRL(r.deal_value)}</td>
                  <td style={{ padding:'7px 12px', color:'var(--foreground)' }}>{r.product_name??'—'}</td>
                  <td style={{ padding:'7px 12px' }}>{r.generation_mode&&<span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(99,102,241,.1)', color:'#818cf8', fontWeight:700 }}>{r.generation_mode}</span>}</td>
                  <td style={{ padding:'7px 12px', color:'var(--muted-foreground)' }}>{r.selected_option??'—'}</td>
                  <td style={{ padding:'7px 12px', color:'var(--muted-foreground)' }}>{r.stage_name??'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length===0&&<p style={{ textAlign:'center', padding:40, color:'var(--muted-foreground)' }}>Nenhum registro.</p>}
        </div>
      </div>
    </div>
  )
}

function DealModal({ dealId, dealName, rows, onClose }: { dealId:string;dealName:string;rows:GeracaoLink[];onClose:()=>void }) {
  const sorted=[...rows].sort((a,b)=>a.generated_at.localeCompare(b.generated_at))
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', border:'1px solid rgba(99,102,241,.3)', borderRadius:20, width:'100%', maxWidth:580, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.5)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <div><h3 style={{ fontSize:15, fontWeight:800, color:'var(--foreground)', margin:0 }}>🔗 {dealName||dealId}</h3><p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'2px 0 0' }}>{sorted.length} geração{sorted.length!==1?'ões':''}</p></div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}><X size={14}/></button>
        </div>
        <div style={{ overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {sorted.map((r,i)=>(
            <div key={r.id} style={{ display:'flex', gap:12 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:i===0?'#818cf8':'rgba(99,102,241,.1)', border:`2px solid ${i===0?'#818cf8':'rgba(99,102,241,.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:i===0?'#fff':'#818cf8' }}>{i+1}</div>
                {i<sorted.length-1&&<div style={{ width:2, height:22, background:'rgba(99,102,241,.2)', margin:'2px 0' }}/>}
              </div>
              <div style={{ flex:1, background:'rgba(99,102,241,.04)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(99,102,241,.1)' }}>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:4 }}>
                  {i>0&&<span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,.1)', color:'#f87171', fontWeight:800 }}>🔄 REEMISSÃO</span>}
                  {r.generation_mode&&<span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(99,102,241,.1)', color:'#818cf8', fontWeight:700 }}>{r.generation_mode}</span>}
                  {r.selected_option&&<span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(52,211,153,.1)', color:'#34d399', fontWeight:700 }}>{r.selected_option}</span>}
                </div>
                <p style={{ fontSize:12, fontWeight:700, color:'var(--foreground)', margin:'0 0 2px' }}>{new Date(r.generated_at).toLocaleString('pt-BR')}</p>
                <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{r.owner_name} · {r.product_name??'—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export function LinksClient({ isAdmin }:{ isAdmin:boolean }) {
  const supabase  = createClient()
  const [data,    setData]    = useState<GeracaoLink[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<TabId>('geral')
  const [drill,   setDrill]   = useState<{title:string;rows:GeracaoLink[]}|null>(null)
  const [dealM,   setDealM]   = useState<{id:string;name:string;rows:GeracaoLink[]}|null>(null)
  const [tblPage, setTblPage] = useState(0)
  const PAGE=50
  // Filtros cascateados
  const [fOwner,  setFOwner]  = useState('')
  const [fVert,   setFVert]   = useState('')
  const [fProd,   setFProd]   = useState('')
  const [fMode,   setFMode]   = useState('')
  const [fOpt,    setFOpt]    = useState('')
  const [fEtapa,  setFEtapa]  = useState('')
  const [fFrom,   setFFrom]   = useState(new Date(Date.now()-89*86400000).toISOString().slice(0,10))
  const [fTo,     setFTo]     = useState(todayIso())
  const [search,  setSearch]  = useState('')
  const channelRef=useRef<any>(null)

  const fetchData=useCallback(async()=>{
    setLoading(true);let all:GeracaoLink[]=[],from=0
    while(true){
      const{data:b}=await supabase.from('geracoes_links').select('*')
        .gte('generated_at',fFrom+'T00:00:00').lte('generated_at',fTo+'T23:59:59')
        .order('generated_at',{ascending:false}).range(from,from+999)
      if(!b||b.length===0)break; all=[...all,...b]; if(b.length<1000)break; from+=1000
    }
    setData(all);setLoading(false)
  },[fFrom,fTo])

  useEffect(()=>{fetchData()},[fetchData])
  useEffect(()=>{
    if(channelRef.current)supabase.removeChannel(channelRef.current)
    const ch=supabase.channel(`links-${Math.random()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'geracoes_links'},()=>fetchData()).subscribe()
    channelRef.current=ch; return()=>{supabase.removeChannel(ch)}
  },[fetchData])

  const filtered=useMemo(()=>data.filter(d=>{
    if(fOwner&&d.owner_name!==fOwner)return false
    if(fVert &&(d.vertical??'')!==fVert)return false
    if(fProd &&(d.product_name??'')!==fProd)return false
    if(fMode &&(d.generation_mode??'')!==fMode)return false
    if(fOpt  &&(d.selected_option??'')!==fOpt)return false
    if(fEtapa&&(d.stage_name??'')!==fEtapa)return false
    if(search){const s=search.toLowerCase();return d.owner_name.toLowerCase().includes(s)||(d.deal_name??'').toLowerCase().includes(s)||(d.product_name??'').toLowerCase().includes(s)}
    return true
  }),[data,fOwner,fVert,fProd,fMode,fOpt,fEtapa,search])

  // Opções cascateadas
  const opts=useMemo(()=>{
    const ex=(skip:string)=>data.filter(d=>{
      if(skip!=='owner'&&fOwner&&d.owner_name!==fOwner)return false
      if(skip!=='vert' &&fVert &&(d.vertical??'')!==fVert)return false
      if(skip!=='prod' &&fProd &&(d.product_name??'')!==fProd)return false
      if(skip!=='mode' &&fMode &&(d.generation_mode??'')!==fMode)return false
      if(skip!=='opt'  &&fOpt  &&(d.selected_option??'')!==fOpt)return false
      if(skip!=='etapa'&&fEtapa&&(d.stage_name??'')!==fEtapa)return false
      return true
    })
    return{
      owners:[...new Set(ex('owner').map(d=>d.owner_name))].sort(),
      verts: [...new Set(ex('vert').map(d=>d.vertical).filter(Boolean))].sort() as string[],
      prods: [...new Set(ex('prod').map(d=>d.product_name).filter(Boolean))].sort() as string[],
      modes: [...new Set(ex('mode').map(d=>d.generation_mode).filter(Boolean))].sort() as string[],
      opts_: [...new Set(ex('opt').map(d=>d.selected_option).filter(Boolean))].sort() as string[],
      etapas:[...new Set(ex('etapa').map(d=>d.stage_name).filter(Boolean))].sort() as string[],
    }
  },[data,fOwner,fVert,fProd,fMode,fOpt,fEtapa])

  // KPIs
  const kpis=useMemo(()=>{
    const hoje=todayIso()
    const dealMap=new Map<string,GeracaoLink[]>()
    filtered.forEach(r=>{const k=r.deal_id??r.id;if(!dealMap.has(k))dealMap.set(k,[]);dealMap.get(k)!.push(r)})
    const deals=dealMap.size,reem=[...dealMap.values()].filter(v=>v.length>1).length
    const tempos:number[]=[]
    dealMap.forEach(rows=>{
      const f=rows.sort((a,b)=>a.generated_at.localeCompare(b.generated_at))[0]
      if(f.deal_created_at&&f.generated_at){const diff=new Date(f.generated_at).getTime()-new Date(f.deal_created_at).getTime();if(diff>=0)tempos.push(diff)}
    })
    const usedDeals=new Set<string>();let totalVal=0
    filtered.forEach(r=>{if(r.deal_id&&!usedDeals.has(r.deal_id)&&r.deal_value){usedDeals.add(r.deal_id);totalVal+=r.deal_value}})
    const topO=filtered.reduce((m,d)=>{m[d.owner_name]=(m[d.owner_name]??0)+1;return m},{} as Record<string,number>)
    return{
      total:filtered.length,deals,hoje:filtered.filter(d=>d.generated_at.startsWith(hoje)).length,
      taxaRe:deals>0?Math.round(reem/deals*100):0,
      avgTempo:tempos.length>0?formatDuration(tempos.reduce((s,v)=>s+v,0)/tempos.length):'—',
      totalVal,ticketMedio:usedDeals.size>0?totalVal/usedDeals.size:0,
      topOwner:Object.entries(topO).sort((a,b)=>b[1]-a[1])[0]?.[0]??'—',
    }
  },[filtered])

  // Chart data
  const byDay    =useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const k=d.generated_at.slice(0,10);m[k]=(m[k]??0)+1});return Object.entries(m).sort().map(([date,count])=>({date:fmtShortDate(date),count,_date:date}))},[filtered])
  const byHour   =useMemo(()=>{const m:Record<number,number>={};for(let i=0;i<24;i++)m[i]=0;filtered.forEach(d=>{const h=new Date(d.generated_at).getHours();m[h]=(m[h]??0)+1});return Object.entries(m).map(([h,count])=>({hora:`${pad(+h)}h`,count}))},[filtered])
  const byOwner  =useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{m[d.owner_name]=(m[d.owner_name]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,count])=>({name,count}))},[filtered])
  const byProduct=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const p=d.product_name??'S/produto';m[p]=(m[p]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,count])=>({name:name.length>20?name.slice(0,20)+'…':name,count,_n:name}))},[filtered])
  const byVertical=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const v=d.vertical??'S/vertical';m[v]=(m[v]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}))},[filtered])
  const byMode   =useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const mo=d.generation_mode??'S/tipo';m[mo]=(m[mo]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}))},[filtered])
  const reemByOwner=useMemo(()=>{const dm=new Map<string,GeracaoLink[]>();filtered.forEach(r=>{const k=r.deal_id??r.id;if(!dm.has(k))dm.set(k,[]);dm.get(k)!.push(r)});const m:Record<string,number>={};dm.forEach(rows=>{if(rows.length>1)rows.slice(1).forEach(r=>{m[r.owner_name]=(m[r.owner_name]??0)+1})});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,count])=>({name,count}))},[filtered])

  const tableRows=useMemo(()=>filtered.slice(tblPage*PAGE,(tblPage+1)*PAGE),[filtered,tblPage])
  const totalPages=Math.ceil(filtered.length/PAGE)
  const hasFilters=fOwner||fVert||fProd||fMode||fOpt||fEtapa
  const CARD:React.CSSProperties={background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:'20px 22px',boxShadow:'0 1px 8px rgba(0,0,0,.06)'}
  const TIT:React.CSSProperties={fontSize:14,fontWeight:800,color:'var(--foreground)',margin:'0 0 4px'}
  const SUB:React.CSSProperties={fontSize:11,color:'var(--muted-foreground)',margin:'0 0 16px'}

  return(
    <div style={{padding:'clamp(16px,3vw,28px)',maxWidth:1400,margin:'0 auto'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:11,background:'rgba(99,102,241,.15)',display:'flex',alignItems:'center',justifyContent:'center'}}><Link2 size={18} style={{color:'#818cf8'}}/></div>
          <div><h1 style={{fontSize:20,fontWeight:900,color:'var(--foreground)',margin:0,letterSpacing:'-.02em'}}>Links de Pagamento</h1><p style={{fontSize:12,color:'var(--muted-foreground)',margin:0}}>Análise de geração e reemissões</p></div>
        </div>
        <a href="/disparos" style={{display:'flex',alignItems:'center',gap:6,height:36,padding:'0 16px',borderRadius:10,border:'1px solid rgba(99,102,241,.3)',background:'rgba(99,102,241,.08)',color:'#818cf8',textDecoration:'none',fontSize:12,fontWeight:700}}>
          📨 Ver Disparos →
        </a>
      </div>

      {/* Filter Bar */}
      <div style={{background:'var(--secondary)',border:'1px solid var(--border)',borderRadius:16,padding:'16px 20px',marginBottom:18}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
          <FSelect label="Proprietário" value={fOwner} onChange={v=>{setFOwner(v);setTblPage(0)}} options={opts.owners}/>
          <FSelect label="Vertical"     value={fVert}  onChange={v=>{setFVert(v);setTblPage(0)}}  options={opts.verts} placeholder="Todas"/>
          <FSelect label="Produto"      value={fProd}  onChange={v=>{setFProd(v);setTblPage(0)}}  options={opts.prods} placeholder="Todos"/>
          <FSelect label="Tipo Geração" value={fMode}  onChange={v=>{setFMode(v);setTblPage(0)}}  options={opts.modes} placeholder="Todos"/>
          <FSelect label="Opção"        value={fOpt}   onChange={v=>{setFOpt(v);setTblPage(0)}}   options={opts.opts_} placeholder="Todas"/>
          <FSelect label="Etapa"        value={fEtapa} onChange={v=>{setFEtapa(v);setTblPage(0)}} options={opts.etapas} placeholder="Todas"/>
          <FDate label="De"  value={fFrom} onChange={setFFrom} placeholder="Início"/>
          <FDate label="Até" value={fTo}   onChange={setFTo}   placeholder="Hoje"/>
          {hasFilters&&(
            <div style={{display:'flex',alignItems:'flex-end',paddingBottom:1}}>
              <button onClick={()=>{setFOwner('');setFVert('');setFProd('');setFMode('');setFOpt('');setFEtapa('')}} style={{height:38,padding:'0 12px',borderRadius:9,border:'1px solid rgba(239,68,68,.3)',background:'rgba(239,68,68,.08)',color:'#f87171',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>× Limpar</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,padding:4,background:'var(--secondary)',borderRadius:12,border:'1px solid var(--border)',width:'fit-content'}}>
        {TABS.map(t=>{const Icon=t.icon;const active=tab===t.id;return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{display:'flex',alignItems:'center',gap:6,height:34,padding:'0 16px',borderRadius:9,border:'none',background:active?'linear-gradient(135deg,rgba(99,102,241,.4),rgba(139,92,246,.3))':'transparent',color:active?'#e9d5ff':'var(--muted-foreground)',fontSize:12,fontWeight:active?800:500,cursor:'pointer',fontFamily:'inherit',transition:'all .2s',boxShadow:active?'0 2px 8px rgba(99,102,241,.25)':'none'}}>
            <Icon size={13}/>{t.label}
          </button>
        )})}
      </div>

      {/* KPIs */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <KpiCard icon={Link2}       label="Total Links"      value={kpis.total.toLocaleString('pt-BR')} color="#818cf8"/>
        <KpiCard icon={DollarSign}  label="Valor Total"      value={fmtBRL(kpis.totalVal)}              color="#34d399" sub="deals únicos"/>
        <KpiCard icon={RefreshCw}   label="Taxa Reemissão"   value={`${kpis.taxaRe}%`}                  color="#fbbf24" sub={`${kpis.deals} deals únicos`}/>
        <KpiCard icon={Clock}       label="Tempo Médio"      value={kpis.avgTempo}                      color="#a78bfa" sub="criação → 1ª geração"/>
        <KpiCard icon={Users}       label="Links Hoje"       value={kpis.hoje}                          color="#60a5fa"/>
        <KpiCard icon={TrendingUp}  label="Ticket Médio"     value={fmtBRL(kpis.ticketMedio)}           color="#fb923c"/>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:80}}>
          <div style={{width:36,height:36,border:'3px solid rgba(99,102,241,.2)',borderTopColor:'#818cf8',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
        </div>
      ):(
        <>
          {tab==='geral'&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={CARD}>
                <h3 style={TIT}>Evolução Temporal</h3><p style={SUB}>Links gerados por dia — clique para detalhar</p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={byDay} margin={{top:20,right:20,bottom:0,left:0}} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Dia ${p.activePayload[0].payload._date}`,rows:filtered.filter(d=>d.generated_at.startsWith(p.activePayload[0].payload._date))})}>
                    <defs><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="10%" stopColor="#818cf8" stopOpacity={0.4}/><stop offset="90%" stopColor="#818cf8" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:'var(--muted-foreground)'}} interval="preserveStartEnd"/>
                    <YAxis tick={{fontSize:10,fill:'var(--muted-foreground)'}}/>
                    <Tooltip contentStyle={TOOLTIP_STYLE}/>
                    <Area type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} fill="url(#lg2)" name="Links" dot={false} activeDot={{r:4}}>
                      <LabelList dataKey="count" position="top" style={{fontSize:9,fill:'rgba(99,102,241,.6)',fontWeight:700}}/>
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <RankingList data={byOwner} label="Ranking de Owners" onClick={n=>setDrill({title:`Owner: ${n}`,rows:filtered.filter(d=>d.owner_name===n)})}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div style={CARD}>
                  <h3 style={TIT}>Por Vertical</h3><p style={SUB}>Distribuição</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart onClick={(p:any)=>p?.activePayload&&setDrill({title:`Vertical: ${p.activePayload[0].name}`,rows:filtered.filter(d=>(d.vertical??'S/vertical')===p.activePayload[0].name)})}>
                      <Pie data={byVertical} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>`${(name as string).slice(0,10)} ${((percent as number)*100).toFixed(0)}%`} labelLine={false}>
                        {byVertical.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={CARD}>
                  <h3 style={TIT}>Por Tipo de Geração</h3><p style={SUB}>Volume por modalidade</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byMode} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Tipo: ${p.activePayload[0].payload.name}`,rows:filtered.filter(d=>d.generation_mode===p.activePayload[0].payload.name)})}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="name" tick={{fontSize:9,fill:'var(--muted-foreground)'}} interval={0}/>
                      <YAxis tick={{fontSize:9,fill:'var(--muted-foreground)'}}/>
                      <Tooltip contentStyle={TOOLTIP_STYLE}/>
                      <Bar dataKey="count" radius={[5,5,0,0]} name="Links">
                        {byMode.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        <LabelList dataKey="count" position="top" style={{fontSize:9,fill:'rgba(99,102,241,.6)',fontWeight:700}}/>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {tab==='owners'&&(
            <div style={CARD}>
              <h3 style={TIT}>Links por Owner</h3><p style={SUB}>Clique para detalhar</p>
              <ResponsiveContainer width="100%" height={Math.max(280,byOwner.length*32)}>
                <BarChart data={byOwner} layout="vertical" margin={{left:10,right:60}} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Owner: ${p.activePayload[0].payload.name}`,rows:filtered.filter(d=>d.owner_name===p.activePayload[0].payload.name)})}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                  <XAxis type="number" tick={{fontSize:10,fill:'var(--muted-foreground)'}}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'var(--foreground)'}} width={160}/>
                  <Tooltip contentStyle={TOOLTIP_STYLE}/>
                  <Bar dataKey="count" radius={[0,6,6,0]} name="Links">
                    {byOwner.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    <LabelList dataKey="count" position="right" style={{fontSize:11,fill:'var(--foreground)',fontWeight:700}}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab==='produtos'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={CARD}>
                <h3 style={TIT}>Links por Produto</h3><p style={SUB}>Clique para detalhar</p>
                <ResponsiveContainer width="100%" height={Math.max(280,byProduct.length*32)}>
                  <BarChart data={byProduct} layout="vertical" margin={{left:10,right:60}} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Produto: ${p.activePayload[0].payload._n}`,rows:filtered.filter(d=>d.product_name===p.activePayload[0].payload._n)})}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:10,fill:'var(--muted-foreground)'}}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'var(--foreground)'}} width={170}/>
                    <Tooltip contentStyle={TOOLTIP_STYLE}/>
                    <Bar dataKey="count" radius={[0,6,6,0]} name="Links">
                      {byProduct.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      <LabelList dataKey="count" position="right" style={{fontSize:11,fill:'var(--foreground)',fontWeight:700}}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <RankingList data={byProduct.map(p=>({name:p._n,count:p.count}))} label="Ranking de Produtos" onClick={n=>setDrill({title:`Produto: ${n}`,rows:filtered.filter(d=>d.product_name===n)})}/>
            </div>
          )}

          {tab==='analise'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div style={CARD}>
                  <h3 style={TIT}>⏰ Links por Hora</h3><p style={SUB}>Horários de pico</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byHour} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Hora ${p.activePayload[0].payload.hora}`,rows:filtered.filter(d=>new Date(d.generated_at).getHours()===+p.activePayload[0].payload.hora.replace('h',''))})}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="hora" tick={{fontSize:8,fill:'rgba(99,102,241,.5)'}}/>
                      <YAxis tick={{fontSize:9,fill:'var(--muted-foreground)'}}/>
                      <Tooltip contentStyle={TOOLTIP_STYLE}/>
                      <Bar dataKey="count" fill="#818cf8" radius={[4,4,0,0]} name="Links">
                        <LabelList dataKey="count" position="top" style={{fontSize:8,fill:'rgba(99,102,241,.6)',fontWeight:700}} formatter={(v:number)=>v>0?v:''}/>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={CARD}>
                  <h3 style={TIT}>🔄 Reemissões por Owner</h3><p style={SUB}>Links extras além do 1º por deal</p>
                  {reemByOwner.length>0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reemByOwner} layout="vertical" margin={{left:10,right:50}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                        <XAxis type="number" tick={{fontSize:9,fill:'var(--muted-foreground)'}}/>
                        <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'var(--foreground)'}} width={170}/>
                        <Tooltip contentStyle={TOOLTIP_STYLE}/>
                        <Bar dataKey="count" fill="#f87171" radius={[0,5,5,0]} name="Reemissões">
                          <LabelList dataKey="count" position="right" style={{fontSize:10,fill:'var(--foreground)',fontWeight:700}}/>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p style={{textAlign:'center',padding:40,color:'var(--muted-foreground)',fontSize:13}}>Nenhuma reemissão no período.</p>}
                </div>
              </div>
            </div>
          )}

          {tab==='tabela'&&(
            <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,.06)'}}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                <div><h3 style={{fontSize:14,fontWeight:800,color:'var(--foreground)',margin:'0 0 2px'}}>Todos os Registros</h3><p style={{fontSize:11,color:'var(--muted-foreground)',margin:0}}>{filtered.length.toLocaleString('pt-BR')} links no período — clique na linha para ver o histórico do deal</p></div>
                <div style={{marginLeft:'auto',position:'relative'}}>
                  <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(99,102,241,.5)',pointerEvents:'none'}}/>
                  <input value={search} onChange={e=>{setSearch(e.target.value);setTblPage(0)}} placeholder="Buscar..." style={{height:36,padding:'0 12px 0 30px',borderRadius:9,border:'1.5px solid var(--border)',background:'rgba(99,102,241,.08)',color:'var(--foreground)',fontSize:12,outline:'none',width:200}}/>
                </div>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead><tr style={{background:'var(--secondary)'}}>
                    {['Data','Owner','Deal','Valor','Produto','Vertical','Tipo','Opção','Etapa'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:700,color:'var(--muted-foreground)',fontSize:9,textTransform:'uppercase',letterSpacing:'.07em',borderBottom:'1px solid rgba(99,102,241,.15)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {tableRows.map((r,i)=>{
                      const dk=r.deal_id??r.id
                      return(
                        <tr key={r.id} style={{borderBottom:'1px solid rgba(99,102,241,.08)',background:i%2===0?'transparent':'rgba(99,102,241,.03)',cursor:'pointer',transition:'background .1s'}}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.06)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?'transparent':'rgba(99,102,241,.03)'}
                          onClick={()=>setDealM({id:dk,name:r.deal_name??dk,rows:filtered.filter(d=>(d.deal_id??d.id)===dk)})}>
                          <td style={{padding:'7px 12px',color:'var(--muted-foreground)',whiteSpace:'nowrap'}}>{new Date(r.generated_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                          <td style={{padding:'7px 12px',fontWeight:600,color:'var(--foreground)',whiteSpace:'nowrap'}}>{r.owner_name}</td>
                          <td style={{padding:'7px 12px',color:'var(--foreground)',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.deal_name??'—'}</td>
                          <td style={{padding:'7px 12px',color:'#34d399',fontWeight:700}}>{fmtBRL(r.deal_value)}</td>
                          <td style={{padding:'7px 12px',color:'var(--foreground)'}}>{r.product_name??'—'}</td>
                          <td style={{padding:'7px 12px',color:'var(--muted-foreground)'}}>{r.vertical??'—'}</td>
                          <td style={{padding:'7px 12px'}}>{r.generation_mode&&<span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:'rgba(99,102,241,.1)',color:'#818cf8',fontWeight:700}}>{r.generation_mode}</span>}</td>
                          <td style={{padding:'7px 12px',color:'var(--muted-foreground)'}}>{r.selected_option??'—'}</td>
                          <td style={{padding:'7px 12px',color:'var(--muted-foreground)'}}>{r.stage_name??'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {tableRows.length===0&&<p style={{textAlign:'center',padding:48,color:'var(--muted-foreground)'}}>Nenhum link no período.</p>}
              </div>
              {totalPages>1&&(
                <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,color:'var(--muted-foreground)'}}>
                  <span>{tblPage*PAGE+1}–{Math.min((tblPage+1)*PAGE,filtered.length)} de {filtered.length.toLocaleString('pt-BR')}</span>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>setTblPage(p=>Math.max(0,p-1))} disabled={tblPage===0} style={{height:30,padding:'0 12px',borderRadius:8,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',cursor:'pointer',fontFamily:'inherit',fontSize:12,opacity:tblPage===0?.4:1}}>← Anterior</button>
                    <button onClick={()=>setTblPage(p=>Math.min(totalPages-1,p+1))} disabled={tblPage===totalPages-1} style={{height:30,padding:'0 12px',borderRadius:8,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',cursor:'pointer',fontFamily:'inherit',fontSize:12,opacity:tblPage===totalPages-1?.4:1}}>Próxima →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {drill && <RecordModal title={drill.title} rows={drill.rows} onClose={()=>setDrill(null)}/>}
      {dealM && <DealModal dealId={dealM.id} dealName={dealM.name} rows={dealM.rows} onClose={()=>setDealM(null)}/>}
    </div>
  )
}
