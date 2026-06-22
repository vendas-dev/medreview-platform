'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { Send, Users, BarChart2, FileText, Calendar, List, X, Search } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────
interface Disparo {
  id:string; id_negocio:string|null; proprietario:string
  nome_lead:string; etapa:string|null; vertical:string|null
  template:string; data_disparo:string; created_at:string
}
type TabId = 'geral'|'closers'|'templates'|'temporal'|'tabela'

const TABS = [
  { id:'geral'     as TabId, label:'Visão Geral',  icon:BarChart2 },
  { id:'closers'   as TabId, label:'Por Closer',   icon:Users     },
  { id:'templates' as TabId, label:'Por Template', icon:FileText  },
  { id:'temporal'  as TabId, label:'Temporal',     icon:Calendar  },
  { id:'tabela'    as TabId, label:'Tabela',       icon:List      },
]
// Paleta indigo unificada (igual ao LinksClient)
const COLORS = ['#818cf8','#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c','#e879f9','#2dd4bf','#f472b6']
const ACCENT = '#6366f1'

// ── Estilos adaptativos (claro/escuro via CSS vars) ───────────
const CARD:React.CSSProperties = {
  background:'var(--card)', border:'1px solid var(--border)',
  borderRadius:16, padding:'20px 22px', boxShadow:'0 1px 8px rgba(0,0,0,.06)',
}
const FILTER_BAR:React.CSSProperties = {
  background:'var(--secondary)', border:'1px solid var(--border)',
  borderRadius:16, padding:'16px 20px', marginBottom:18,
}
// Tooltip usa CSS vars — funciona em ambos os temas
const TIP = { contentStyle:{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, fontSize:12, color:'var(--foreground)' } }

function todayIso(){ return new Date().toISOString().slice(0,10) }
function pad(n:number){ return String(n).padStart(2,'0') }
function fmtShortDate(iso:string){ const d=new Date(iso+'T12:00:00'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}` }

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon:Icon }: any) {
  return (
    <div style={{ flex:1, background:'var(--card)', border:'1px solid var(--border)', borderRadius:14,
      padding:'18px 20px', position:'relative', overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
      <div style={{ position:'absolute', top:16, right:16, width:36, height:36, borderRadius:10,
        background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <p style={{ fontSize:9, fontWeight:800, color:ACCENT, margin:'0 0 7px', textTransform:'uppercase', letterSpacing:'.1em' }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:900, color:'var(--foreground)', margin:'0 0 3px', letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{sub}</p>}
    </div>
  )
}

// ── Ranking List ──────────────────────────────────────────────
function RankingList({ data, label, onClick }: { data:{name:string;count:number}[];label:string;onClick:(n:string)=>void }) {
  const max=data[0]?.count??1, total=data.reduce((s,d)=>s+d.count,0)
  return (
    <div style={CARD}>
      <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>{label}</h3>
      <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Por volume — clique para detalhar</p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {data.map((d,i)=>(
          <div key={d.name} onClick={()=>onClick(d.name)}
            style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'5px 8px', borderRadius:8, transition:'background .15s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`rgba(99,102,241,.06)`}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
            <span style={{ fontSize:11, color:ACCENT, width:20, textAlign:'right', flexShrink:0, fontWeight:700, opacity:.6 }}>{i+1}</span>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', width:170, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
            <div style={{ flex:1, height:5, borderRadius:999, background:'var(--secondary)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(d.count/max)*100}%`, borderRadius:999, background:COLORS[i%COLORS.length], transition:'width .6s' }}/>
            </div>
            <span style={{ fontSize:13, fontWeight:800, color:'var(--foreground)', width:52, textAlign:'right', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{d.count.toLocaleString('pt-BR')}</span>
            <span style={{ fontSize:10, color:'var(--muted-foreground)', width:30, textAlign:'right', flexShrink:0 }}>{Math.round(d.count/total*100)}%</span>
          </div>
        ))}
        {data.length===0&&<p style={{ textAlign:'center', padding:'24px 0', color:'var(--muted-foreground)', fontSize:12 }}>Sem dados no período.</p>}
      </div>
    </div>
  )
}

// ── Drill Modal ───────────────────────────────────────────────
function DrillModal({ title, rows, onClose }: { title:string;rows:Disparo[];onClose:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:900, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.3)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontSize:15, fontWeight:800, color:'var(--foreground)', margin:0 }}>{title}</h3>
            <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'2px 0 0' }}>{rows.length.toLocaleString('pt-BR')} registros</p>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}><X size={14}/></button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:'var(--secondary)', position:'sticky', top:0 }}>
              {['Data/Hora','Proprietário','Lead','Template','Etapa','Vertical'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontWeight:700, color:'var(--muted-foreground)', fontSize:10, textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'transparent':'var(--secondary)' }}>
                  <td style={{ padding:'8px 14px', color:'var(--muted-foreground)', whiteSpace:'nowrap' }}>{new Date(r.data_disparo).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'8px 14px', fontWeight:600, color:'var(--foreground)' }}>{r.proprietario}</td>
                  <td style={{ padding:'8px 14px', color:'var(--foreground)' }}>{r.nome_lead}</td>
                  <td style={{ padding:'8px 14px' }}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:5, background:`${ACCENT}18`, color:ACCENT, fontWeight:700 }}>{r.template}</span></td>
                  <td style={{ padding:'8px 14px', color:'var(--muted-foreground)' }}>{r.etapa??'—'}</td>
                  <td style={{ padding:'8px 14px', color:'var(--muted-foreground)' }}>{r.vertical??'—'}</td>
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

// ── Label do filtro ───────────────────────────────────────────
function FLabel({ children }: any) {
  return <label style={{ fontSize:9, fontWeight:800, color:ACCENT, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'.1em' }}>{children}</label>
}

// ── Main ──────────────────────────────────────────────────────
export function DisparosClient({ isAdmin }: { isAdmin:boolean }) {
  const supabase  = createClient()
  const [data,    setData]    = useState<Disparo[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<TabId>('geral')
  const [drill,   setDrill]   = useState<{title:string;rows:Disparo[]}|null>(null)
  const [tblPage, setTblPage] = useState(0)
  const PAGE = 50
  const [fOwner,  setFOwner]  = useState('')
  const [fTpl,    setFTpl]    = useState('')
  const [fVert,   setFVert]   = useState('')
  const [fEtapa,  setFEtapa]  = useState('')
  const [fFrom,   setFFrom]   = useState(new Date(Date.now()-89*86400000).toISOString().slice(0,10))
  const [fTo,     setFTo]     = useState(todayIso())
  const [search,  setSearch]  = useState('')
  const channelRef = useRef<any>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); let all:Disparo[]=[], from=0
    while(true){
      const{data:b}=await supabase.from('disparos').select('*')
        .gte('data_disparo',fFrom+'T00:00:00').lte('data_disparo',fTo+'T23:59:59')
        .order('data_disparo',{ascending:false}).range(from,from+999)
      if(!b||b.length===0)break; all=[...all,...b]; if(b.length<1000)break; from+=1000
    }
    setData(all); setLoading(false)
  },[fFrom,fTo])

  useEffect(()=>{fetchData()},[fetchData])
  useEffect(()=>{
    if(channelRef.current) supabase.removeChannel(channelRef.current)
    const ch=supabase.channel(`dis-${Math.random()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'disparos'},()=>fetchData())
      .subscribe()
    channelRef.current=ch; return()=>{supabase.removeChannel(ch)}
  },[fetchData])

  const filtered = useMemo(()=>data.filter(d=>{
    if(fOwner&&d.proprietario!==fOwner)return false
    if(fTpl  &&d.template!==fTpl)      return false
    if(fVert &&(d.vertical??'')!==fVert)return false
    if(fEtapa&&(d.etapa??'')!==fEtapa) return false
    if(search){const s=search.toLowerCase();return d.proprietario.toLowerCase().includes(s)||d.nome_lead.toLowerCase().includes(s)||d.template.toLowerCase().includes(s)}
    return true
  }),[data,fOwner,fTpl,fVert,fEtapa,search])

  const opts = useMemo(()=>({
    owners:[...new Set(data.map(d=>d.proprietario))].sort(),
    tpls:  [...new Set(data.map(d=>d.template))].sort(),
    verts: [...new Set(data.map(d=>d.vertical).filter(Boolean))].sort() as string[],
    etapas:[...new Set(data.map(d=>d.etapa).filter(Boolean))].sort() as string[],
  }),[data])

  const kpis = useMemo(()=>{
    const ownerCnt=filtered.reduce((m,d)=>{m[d.proprietario]=(m[d.proprietario]??0)+1;return m},{} as Record<string,number>)
    const tplCnt  =filtered.reduce((m,d)=>{m[d.template]=(m[d.template]??0)+1;return m},{} as Record<string,number>)
    const days=new Set(filtered.map(d=>d.data_disparo.slice(0,10))).size||1
    return{
      total:filtered.length,owners:Object.keys(ownerCnt).length,
      topOwner:Object.entries(ownerCnt).sort((a,b)=>b[1]-a[1])[0]?.[0]??'—',
      tpls:Object.keys(tplCnt).length,
      topTpl:Object.entries(tplCnt).sort((a,b)=>b[1]-a[1])[0]?.[0]??'—',
      media:Math.round(filtered.length/days),dias:days,
    }
  },[filtered])

  const byDay=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const k=d.data_disparo.slice(0,10);m[k]=(m[k]??0)+1});return Object.entries(m).sort().map(([dt,c])=>({date:fmtShortDate(dt),count:c,_date:dt}))},[filtered])
  const byHour=useMemo(()=>{const m:Record<number,number>={};for(let i=0;i<24;i++)m[i]=0;filtered.forEach(d=>{const h=new Date(d.data_disparo).getHours();m[h]=(m[h]??0)+1});return Object.entries(m).map(([h,c])=>({hora:`${pad(+h)}h`,count:c}))},[filtered])
  const byOwner=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{m[d.proprietario]=(m[d.proprietario]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([name,count])=>({name,count}))},[filtered])
  const byTemplate=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{m[d.template]=(m[d.template]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,count])=>({name:name.length>22?name.slice(0,22)+'…':name,count,_n:name}))},[filtered])
  const byVertical=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const v=d.vertical??'Sem vertical';m[v]=(m[v]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}))},[filtered])
  const byEtapa=useMemo(()=>{const m:Record<string,number>={};filtered.forEach(d=>{const e=d.etapa??'Sem etapa';m[e]=(m[e]??0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name:name.length>14?name.slice(0,14)+'…':name,count,_n:name}))},[filtered])

  const tableRows=useMemo(()=>filtered.slice(tblPage*PAGE,(tblPage+1)*PAGE),[filtered,tblPage])
  const totalPages=Math.ceil(filtered.length/PAGE)
  const hasFilters=fOwner||fTpl||fVert||fEtapa

  // CustomSelect options helpers
  const selOpts = (arr:string[]) => [{value:'',label:'Todos'},...arr.map(o=>({value:o,label:o}))]
  const selVertsOpts = (arr:string[]) => [{value:'',label:'Todas'},...arr.map(o=>({value:o,label:o}))]

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:1400, margin:'0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:11, background:`${ACCENT}18`, border:`1px solid ${ACCENT}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Send size={18} style={{ color:ACCENT }}/>
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, color:'var(--foreground)', margin:0, letterSpacing:'-.02em' }}>Disparos</h1>
            <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>Monitor de produtividade por templates</p>
          </div>
        </div>
        <a href="/disparos/links" style={{ display:'flex', alignItems:'center', gap:6, height:36, padding:'0 16px', borderRadius:10, border:`1px solid ${ACCENT}30`, background:`${ACCENT}10`, color:ACCENT, textDecoration:'none', fontSize:12, fontWeight:700 }}>
          🔗 Análise de Links →
        </a>
      </div>

      {/* Filter Bar — CustomSelect modernos */}
      <div style={FILTER_BAR}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
          <div>
            <FLabel>Closer</FLabel>
            <CustomSelect value={fOwner} onChange={v=>{setFOwner(v);setTblPage(0)}} options={selOpts(opts.owners)} placeholder="Todos"/>
          </div>
          <div>
            <FLabel>Template</FLabel>
            <CustomSelect value={fTpl} onChange={v=>{setFTpl(v);setTblPage(0)}} options={selOpts(opts.tpls)} placeholder="Todos"/>
          </div>
          <div>
            <FLabel>Vertical</FLabel>
            <CustomSelect value={fVert} onChange={v=>{setFVert(v);setTblPage(0)}} options={selVertsOpts(opts.verts)} placeholder="Todas"/>
          </div>
          <div>
            <FLabel>Etapa</FLabel>
            <CustomSelect value={fEtapa} onChange={v=>{setFEtapa(v);setTblPage(0)}} options={selVertsOpts(opts.etapas)} placeholder="Todas"/>
          </div>
          <div>
            <FLabel>De</FLabel>
            <div style={{ position:'relative' }}>
              <Calendar size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:ACCENT, pointerEvents:'none', opacity:.7 }}/>
              <input type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)}
                style={{ width:'100%', height:42, padding:'0 12px 0 30px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color .15s' }}
                onFocus={e=>{e.target.style.borderColor=ACCENT;e.target.style.boxShadow=`0 0 0 3px ${ACCENT}18`}}
                onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}}/>
            </div>
          </div>
          <div>
            <FLabel>Até</FLabel>
            <div style={{ position:'relative' }}>
              <Calendar size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:ACCENT, pointerEvents:'none', opacity:.7 }}/>
              <input type="date" value={fTo} onChange={e=>setFTo(e.target.value)}
                style={{ width:'100%', height:42, padding:'0 12px 0 30px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color .15s' }}
                onFocus={e=>{e.target.style.borderColor=ACCENT;e.target.style.boxShadow=`0 0 0 3px ${ACCENT}18`}}
                onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}}/>
            </div>
          </div>
          {hasFilters&&(
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button onClick={()=>{setFOwner('');setFTpl('');setFVert('');setFEtapa('')}} style={{ width:'100%', height:42, borderRadius:10, border:'1px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.06)', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>× Limpar</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, padding:4, background:'var(--secondary)', borderRadius:12, border:'1px solid var(--border)', width:'fit-content' }}>
        {TABS.map(t=>{const Icon=t.icon;const active=tab===t.id;return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ display:'flex', alignItems:'center', gap:6, height:34, padding:'0 16px', borderRadius:9, border:'none', background:active?ACCENT:'transparent', color:active?'#fff':'var(--muted-foreground)', fontSize:12, fontWeight:active?800:500, cursor:'pointer', fontFamily:'inherit', transition:'all .2s', boxShadow:active?`0 2px 8px ${ACCENT}44`:'none' }}>
            <Icon size={13}/>{t.label}
          </button>
        )})}
      </div>

      {/* KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <KpiCard icon={Send}      label="Total de Disparos"  value={kpis.total.toLocaleString('pt-BR')} sub="Todos os registros"              color={ACCENT}/>
        <KpiCard icon={Users}     label="Closers Ativos"     value={kpis.owners}                        sub={`Top: ${kpis.topOwner}`}          color="#60a5fa"/>
        <KpiCard icon={FileText}  label="Templates Usados"   value={kpis.tpls}                          sub={`Mais: ${kpis.topTpl.slice(0,18)}`} color="#34d399"/>
        <KpiCard icon={BarChart2} label="Média por Dia"      value={kpis.media.toLocaleString('pt-BR')} sub={`${kpis.dias} dias com disparos`} color="#fbbf24"/>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
          <div style={{ width:36, height:36, border:'3px solid var(--border)', borderTopColor:ACCENT, borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
        </div>
      ):(
        <>
          {/* VISÃO GERAL */}
          {tab==='geral'&&(
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={CARD}>
                <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Evolução Temporal</h3>
                <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Disparos por dia — clique para detalhar</p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={byDay} margin={{ top:20, right:20, bottom:0, left:0 }}
                    onClick={(p:any)=>p?.activePayload&&setDrill({title:`Dia ${p.activePayload[0].payload._date}`,rows:filtered.filter(d=>d.data_disparo.startsWith(p.activePayload[0].payload._date))})}>
                    <defs><linearGradient id="dg1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ACCENT} stopOpacity={0.3}/><stop offset="95%" stopColor={ACCENT} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--muted-foreground)' }} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:10, fill:'var(--muted-foreground)' }}/>
                    <Tooltip {...TIP}/>
                    <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} fill="url(#dg1)" name="Disparos" dot={false} activeDot={{ r:4, fill:ACCENT }}>
                      <LabelList dataKey="count" position="top" style={{ fontSize:9, fill:'var(--muted-foreground)', fontWeight:700 }}/>
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <RankingList data={byOwner} label="Ranking de Closers" onClick={n=>setDrill({title:`Closer: ${n}`,rows:filtered.filter(d=>d.proprietario===n)})}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={CARD}>
                  <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Por Vertical</h3>
                  <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 12px' }}>Distribuição de disparos</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart onClick={(p:any)=>p?.activePayload&&setDrill({title:`Vertical: ${p.activePayload[0].name}`,rows:filtered.filter(d=>(d.vertical??'Sem vertical')===p.activePayload[0].name)})}>
                      <Pie data={byVertical} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                        label={({name,percent})=>`${(name as string).slice(0,10)} ${((percent as number)*100).toFixed(0)}%`} labelLine={false}>
                        {byVertical.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip {...TIP}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={CARD}>
                  <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Por Etapa</h3>
                  <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 12px' }}>Volume por etapa do funil</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byEtapa} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Etapa: ${p.activePayload[0].payload._n}`,rows:filtered.filter(d=>(d.etapa??'Sem etapa')===p.activePayload[0].payload._n)})}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="name" tick={{ fontSize:9, fill:'var(--muted-foreground)' }} interval={0}/>
                      <YAxis tick={{ fontSize:9, fill:'var(--muted-foreground)' }}/>
                      <Tooltip {...TIP}/>
                      <Bar dataKey="count" radius={[5,5,0,0]} name="Disparos">
                        {byEtapa.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        <LabelList dataKey="count" position="top" style={{ fontSize:9, fill:'var(--muted-foreground)', fontWeight:700 }}/>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* POR CLOSER */}
          {tab==='closers'&&(
            <div style={CARD}>
              <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Disparos por Closer</h3>
              <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Clique para ver detalhes</p>
              <ResponsiveContainer width="100%" height={Math.max(300,byOwner.length*32)}>
                <BarChart data={byOwner} layout="vertical" margin={{ left:10, right:60 }}
                  onClick={(p:any)=>p?.activePayload&&setDrill({title:`Closer: ${p.activePayload[0].payload.name}`,rows:filtered.filter(d=>d.proprietario===p.activePayload[0].payload.name)})}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                  <XAxis type="number" tick={{ fontSize:10, fill:'var(--muted-foreground)' }}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'var(--foreground)' }} width={140}/>
                  <Tooltip {...TIP}/>
                  <Bar dataKey="count" radius={[0,6,6,0]} name="Disparos">
                    {byOwner.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    <LabelList dataKey="count" position="right" style={{ fontSize:11, fill:'var(--foreground)', fontWeight:700 }}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* POR TEMPLATE */}
          {tab==='templates'&&(
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={CARD}>
                <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Top Templates</h3>
                <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Clique para ver detalhes</p>
                <ResponsiveContainer width="100%" height={Math.max(300,byTemplate.length*34)}>
                  <BarChart data={byTemplate} layout="vertical" margin={{ left:10, right:60 }}
                    onClick={(p:any)=>p?.activePayload&&setDrill({title:`Template: ${p.activePayload[0].payload._n}`,rows:filtered.filter(d=>d.template===p.activePayload[0].payload._n)})}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                    <XAxis type="number" tick={{ fontSize:10, fill:'var(--muted-foreground)' }}/>
                    <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'var(--foreground)' }} width={160}/>
                    <Tooltip {...TIP}/>
                    <Bar dataKey="count" radius={[0,6,6,0]} name="Disparos">
                      {byTemplate.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      <LabelList dataKey="count" position="right" style={{ fontSize:11, fill:'var(--foreground)', fontWeight:700 }}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <RankingList data={byTemplate.map(t=>({name:t._n,count:t.count}))} label="Ranking de Templates" onClick={n=>setDrill({title:`Template: ${n}`,rows:filtered.filter(d=>d.template===n)})}/>
            </div>
          )}

          {/* TEMPORAL */}
          {tab==='temporal'&&(
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={CARD}>
                <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Evolução por Dia</h3>
                <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Clique para ver detalhes</p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={byDay} margin={{ top:20, right:20, bottom:0, left:0 }}
                    onClick={(p:any)=>p?.activePayload&&setDrill({title:`Dia ${p.activePayload[0].payload._date}`,rows:filtered.filter(d=>d.data_disparo.startsWith(p.activePayload[0].payload._date))})}>
                    <defs><linearGradient id="dg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ACCENT} stopOpacity={0.3}/><stop offset="95%" stopColor={ACCENT} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--muted-foreground)' }} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:10, fill:'var(--muted-foreground)' }}/>
                    <Tooltip {...TIP}/>
                    <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} fill="url(#dg2)" name="Disparos" dot={false} activeDot={{ r:4 }}>
                      <LabelList dataKey="count" position="top" style={{ fontSize:9, fill:'var(--muted-foreground)', fontWeight:700 }}/>
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={CARD}>
                <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Distribuição por Hora</h3>
                <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Horários de maior atividade</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byHour} onClick={(p:any)=>p?.activePayload&&setDrill({title:`Hora ${p.activePayload[0].payload.hora}`,rows:filtered.filter(d=>new Date(d.data_disparo).getHours()===+p.activePayload[0].payload.hora.replace('h',''))})}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="hora" tick={{ fontSize:9, fill:'var(--muted-foreground)' }}/>
                    <YAxis tick={{ fontSize:10, fill:'var(--muted-foreground)' }}/>
                    <Tooltip {...TIP}/>
                    <Bar dataKey="count" fill={ACCENT} radius={[4,4,0,0]} name="Disparos">
                      <LabelList dataKey="count" position="top" style={{ fontSize:8, fill:'var(--muted-foreground)', fontWeight:700 }} formatter={(v:number)=>v>0?v:''}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TABELA */}
          {tab==='tabela'&&(
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div><h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 2px' }}>Todos os Registros</h3><p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{filtered.length.toLocaleString('pt-BR')} disparos</p></div>
                <div style={{ marginLeft:'auto', position:'relative' }}>
                  <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted-foreground)', pointerEvents:'none' }}/>
                  <input value={search} onChange={e=>{setSearch(e.target.value);setTblPage(0)}} placeholder="Buscar..."
                    style={{ height:36, padding:'0 12px 0 30px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:12, outline:'none', width:200 }}/>
                </div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'var(--secondary)' }}>
                    {['Data/Hora','Proprietário','Lead','Template','Etapa','Vertical','ID Negócio'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'var(--muted-foreground)', fontSize:10, textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {tableRows.map((r,i)=>(
                      <tr key={r.id} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'transparent':'var(--secondary)', transition:'background .1s' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`${ACCENT}08`}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?'transparent':'var(--secondary)'}>
                        <td style={{ padding:'9px 14px', color:'var(--muted-foreground)', whiteSpace:'nowrap' }}>{new Date(r.data_disparo).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{ padding:'9px 14px', fontWeight:600, color:'var(--foreground)' }}>{r.proprietario}</td>
                        <td style={{ padding:'9px 14px', color:'var(--foreground)' }}>{r.nome_lead}</td>
                        <td style={{ padding:'9px 14px' }}><span style={{ fontSize:10, padding:'2px 9px', borderRadius:5, background:`${ACCENT}18`, color:ACCENT, fontWeight:700 }}>{r.template}</span></td>
                        <td style={{ padding:'9px 14px', color:'var(--muted-foreground)' }}>{r.etapa??'—'}</td>
                        <td style={{ padding:'9px 14px', color:'var(--muted-foreground)' }}>{r.vertical??'—'}</td>
                        <td style={{ padding:'9px 14px', color:'var(--muted-foreground)' }}>{r.id_negocio??'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tableRows.length===0&&<p style={{ textAlign:'center', padding:48, color:'var(--muted-foreground)' }}>Nenhum disparo no período.</p>}
              </div>
              {totalPages>1&&(
                <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'var(--muted-foreground)' }}>
                  <span>{tblPage*PAGE+1}–{Math.min((tblPage+1)*PAGE,filtered.length)} de {filtered.length.toLocaleString('pt-BR')}</span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>setTblPage(p=>Math.max(0,p-1))} disabled={tblPage===0} style={{ height:30, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', cursor:'pointer', fontFamily:'inherit', fontSize:12, opacity:tblPage===0?.4:1 }}>← Anterior</button>
                    <button onClick={()=>setTblPage(p=>Math.min(totalPages-1,p+1))} disabled={tblPage===totalPages-1} style={{ height:30, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', cursor:'pointer', fontFamily:'inherit', fontSize:12, opacity:tblPage===totalPages-1?.4:1 }}>Próxima →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {drill&&<DrillModal title={drill.title} rows={drill.rows} onClose={()=>setDrill(null)}/>}
    </div>
  )
}
