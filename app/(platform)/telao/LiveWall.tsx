'use client'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Settings, RefreshCw, SlidersHorizontal, X, Volume2, VolumeX, TrendingUp, Award } from 'lucide-react'
import Link from 'next/link'
import { useLiveData, LiveDataProvider } from '@/hooks/useLiveData'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { VERTICALS, VERTICAL_LIST, GOLD, VerticalId, FilterState, EMPTY_FILTER, Closer, TelaoEvent, CloserStats } from '@/lib/telao/types'
import { computeCloserStats, fmtBRL, todayKey, monthKey, initials, timeAgo, eventMoneyLeftOnTable } from '@/lib/telao/format'
import { todayInSaoPaulo, dayBoundsSaoPaulo, addDaysToDateStr, hourInSaoPaulo, weekdayInSaoPaulo } from '@/lib/timezone'

// ── Áudio ────────────────────────────────────────────────────
let _ctx: AudioContext | null = null, _ready = false
function initAudio() { if (_ctx) { _ready = true; return }; _ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); _ready = true }
function tone(f: number, d: number, type: OscillatorType = 'sine', g = .25) {
  if (!_ctx || !_ready) return
  try { const o = _ctx.createOscillator(), gn = _ctx.createGain(); o.connect(gn); gn.connect(_ctx.destination); o.type = type; o.frequency.setValueAtTime(f, _ctx.currentTime); gn.gain.setValueAtTime(g, _ctx.currentTime); gn.gain.exponentialRampToValueAtTime(.001, _ctx.currentTime + d); o.start(); o.stop(_ctx.currentTime + d) } catch {}
}
const playSale = () => [523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f,.18,'triangle',.3), i*75))
const playCert = () => [523,523,784,659,784,1047].forEach((f,i) => setTimeout(() => tone(f,.22,'triangle',.28), i*85))

// ── Confete ───────────────────────────────────────────────────
function Confete({ color }: { color: string }) {
  const ps = useMemo(() => Array.from({length:80},(_,i) => ({ x:Math.random()*100, y:-5-Math.random()*15, s:Math.random()*10+4, delay:Math.random()*1.5, dur:2.5+Math.random()*2, dx:(Math.random()-.5)*25, c:[color,'#c4b5fd',GOLD,'#fff','#a855f7'][i%5] })),[color])
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:999}}>
      {ps.map((p,i) => <motion.div key={i} initial={{x:`${p.x}vw`,y:`${p.y}vh`,rotate:0,opacity:1}} animate={{x:`${p.x+p.dx}vw`,y:'110vh',rotate:720,opacity:0}} transition={{duration:p.dur,delay:p.delay,ease:'linear'}} style={{position:'absolute',width:p.s,height:p.s,background:p.c,borderRadius:p.s<6?2:'50%'}}/>)}
    </div>
  )
}

// ── Avatar ─── CORRIGIDO: usa avatar_url quando disponível ────
function Avatar({ closer, name, size=40, rank }: { closer:Closer|null; name:string; size?:number; rank?:number }) {
  const col   = closer?.color ?? '#7c3aed'
  const halos = ['#FFD700','#C0C0C0','#CD7F32']
  const halo  = rank !== undefined && rank < 3
  const ini   = initials(name) || '?'

  return (
    <div style={{position:'relative',flexShrink:0}}>
      {closer?.avatar_url ? (
        <div style={{
          width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0,
          border: halo ? `2px solid ${halos[rank!]}` : `1.5px solid ${col}44`,
          boxShadow: halo ? `0 0 ${size*.8}px ${halos[rank!]}44` : `0 0 ${size*.4}px ${col}33`,
        }}>
          <img
            src={closer.avatar_url}
            alt={name}
            style={{width:'100%', height:'100%', objectFit:'cover'}}
            onError={(e:any) => {
              e.currentTarget.style.display = 'none'
              const p = e.currentTarget.parentElement!
              p.style.background = `linear-gradient(135deg,${col},${col}88)`
              p.style.display = 'flex'
              p.style.alignItems = 'center'
              p.style.justifyContent = 'center'
              p.style.fontSize = `${size*.38}px`
              p.style.fontWeight = '900'
              p.style.color = '#fff'
              p.textContent = ini
            }}
          />
        </div>
      ) : (
        <div style={{
          width:size, height:size, borderRadius:'50%',
          background:`linear-gradient(135deg,${col},${col}88)`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:size*.38, fontWeight:900, color:'#fff',
          fontFamily:"'Space Grotesk',sans-serif",
          border: halo ? `2px solid ${halos[rank!]}` : `1.5px solid ${col}44`,
          boxShadow: halo ? `0 0 ${size*.8}px ${halos[rank!]}44` : `0 0 ${size*.4}px ${col}33`,
        }}>
          {ini}
        </div>
      )}
      {halo && <span style={{position:'absolute',top:-4,right:-4,fontSize:Math.max(10,size*.3)}}>{['🥇','🥈','🥉'][rank!]}</span>}
    </div>
  )
}

// ── Helpers de lookup por hubspot_id ──────────────────────────
// A maioria dos eventos tem closer_id=null e só tem closer_hubspot_id.
// Essas funções garantem que sempre achamos o closer certo.
function findCloser(
  closerId: string | null,
  hubspotId: string | null,
  byId: Record<string, Closer>,
  byHubId: Record<string, Closer>
): Closer | null {
  if (closerId && byId[closerId]) return byId[closerId]
  if (hubspotId && byHubId[hubspotId]) return byHubId[hubspotId]
  return null
}

// ── Relógio ───────────────────────────────────────────────────
function Clock({ isDark=true }: { isDark?:boolean }) {
  const [t,setT]=useState(''); const [d,setD]=useState('')
  useEffect(()=>{ const tick=()=>{ const n=new Date(); setT(n.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})); setD(n.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})) }; tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id) },[])
  return <div suppressHydrationWarning style={{textAlign:'right'}}><p style={{fontSize:15,fontWeight:900,color:isDark?'#e9d5ff':'#4c1d95',margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'.06em'}}>{t}</p><p style={{fontSize:7,color:isDark?'#a78bfa':'#7c3aed',margin:0,textTransform:'capitalize',fontFamily:"'Space Grotesk',sans-serif"}}>{d}</p></div>
}

// ── Hero ─────────────────────────────────────────────────────
function TrendBadge({ label, pct, isDark=true }: { label:string; pct:number|null; isDark?:boolean }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:800, color: up?'#16a34a':'#dc2626', fontFamily:"'JetBrains Mono',monospace" }}>
      {up?'▲':'▼'} {Math.abs(pct).toFixed(0)}% <span style={{ color:isDark?'rgba(196,181,253,.75)':'rgba(91,33,182,.8)', fontWeight:700 }}>{label}</span>
    </span>
  )
}

function HeroMetrics({ events, accent, vf, yesterdayRev, yesterdaySameHourRev, trend, isDark=true }: { events:TelaoEvent[]; accent:string; vf:VerticalId|null; yesterdayRev?:number; yesterdaySameHourRev?:number; trend?:{label:string;value:number}[]; isDark?:boolean }) {
  const sales=events.filter(e=>e.event_type==='sale'), certs=events.filter(e=>e.event_type==='ambassador_certified')
  const revenue=sales.reduce((s,e)=>s+(e.value??0),0)
  const vert=vf?VERTICALS[vf]:null

  const avgTicket = sales.length>0 ? revenue/sales.length : 0
  const hoursElapsed = Math.max(hourInSaoPaulo(new Date()) + (new Date().getMinutes()/60), 1)
  const salesPerHour = sales.length/hoursElapsed

  const pctVsYesterday = (yesterdayRev && yesterdayRev>0) ? ((revenue-yesterdayRev)/yesterdayRev)*100 : null
  const pctVsSameHour  = (yesterdaySameHourRev && yesterdaySameHourRev>0) ? ((revenue-yesterdaySameHourRev)/yesterdaySameHourRev)*100 : null
  const labelMuted = isDark ? '#a78bfa' : '#6d28d9'
  const heroText   = isDark ? '#e9d5ff' : '#3b0764'

  return (
    <div style={{background:isDark?'linear-gradient(135deg,rgba(88,28,135,.35),rgba(59,7,100,.25),rgba(15,3,25,.4))':'linear-gradient(135deg,rgba(196,181,253,.55),rgba(233,213,255,.65),rgba(255,255,255,.5))',border:isDark?'1px solid rgba(168,85,247,.25)':'1px solid rgba(139,92,246,.35)',borderRadius:24,padding:'24px 28px',position:'relative',overflow:'hidden',backdropFilter:'blur(20px)',boxShadow:isDark?'0 0 60px rgba(88,28,135,.2),inset 0 1px 0 rgba(255,255,255,.06)':'0 8px 32px rgba(139,92,246,.18),inset 0 1px 0 rgba(255,255,255,.5)'}}>
      <div style={{position:'absolute',top:-60,right:-60,width:240,height:240,borderRadius:'50%',background:`radial-gradient(${accent}${isDark?'22':'33'},transparent 70%)`,pointerEvents:'none'}}/>
      {vert&&<motion.img src={vert.mascot} alt={vert.label} initial={{opacity:0,scale:.8,x:20}} animate={{opacity:1,scale:1,x:0}} transition={{type:'spring',stiffness:220,damping:18}} style={{position:'absolute',right:16,bottom:0,height:130,objectFit:'contain',filter:`drop-shadow(0 0 20px ${accent}66)`,pointerEvents:'none'}}/>}
      {trend && <Sparkline data={trend} accent={accent} compact={!!vert} isDark={isDark}/>}
      <div style={{position:'relative',zIndex:1}}>
        <p style={{fontSize:10,fontWeight:800,color:isDark?'#c084fc':'#7c3aed',textTransform:'uppercase',letterSpacing:'.12em',margin:'0 0 4px',fontFamily:"'JetBrains Mono',monospace"}}>{vert?`${vert.label} · Hoje`:'Geral · Hoje'}</p>
        <div style={{display:'flex',alignItems:'baseline',gap:14,flexWrap:'wrap',marginBottom:6}}>
          <motion.p key={revenue} initial={{scale:1}} animate={{scale:[1,1.04,1]}} transition={{duration:.4}} style={{fontSize:44,fontWeight:900,color:accent,margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.03em',lineHeight:1}}>{fmtBRL(revenue)}</motion.p>
        </div>
        <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:18}}>
          <TrendBadge label="vs ontem" pct={pctVsYesterday} isDark={isDark}/>
          <TrendBadge label="vs mesma hora ontem" pct={pctVsSameHour} isDark={isDark}/>
        </div>
        <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:10,background:isDark?'rgba(168,85,247,.15)':'rgba(124,58,237,.15)',border:isDark?'1px solid rgba(168,85,247,.2)':'1px solid rgba(124,58,237,.3)',display:'flex',alignItems:'center',justifyContent:'center'}}><TrendingUp size={15} style={{color:isDark?'#a855f7':'#7c3aed'}}/></div>
            <div><p style={{fontSize:20,fontWeight:900,color:heroText,margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{sales.length}</p><p style={{fontSize:9,color:labelMuted,margin:0,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Vendas</p></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:10,background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.3)',display:'flex',alignItems:'center',justifyContent:'center'}}><Award size={15} style={{color:GOLD}}/></div>
            <div><p style={{fontSize:20,fontWeight:900,color:GOLD,margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{certs.length}</p><p style={{fontSize:9,color:labelMuted,margin:0,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Embaixadores</p></div>
          </div>
          {sales.length>0 && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:32,height:32,borderRadius:10,background:'rgba(34,197,94,.15)',border:'1px solid rgba(34,197,94,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🎯</div>
              <div><p style={{fontSize:20,fontWeight:900,color:isDark?'#4ade80':'#16a34a',margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{fmtBRL(avgTicket)}</p><p style={{fontSize:9,color:labelMuted,margin:0,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Ticket médio</p></div>
            </div>
          )}
          {sales.length>0 && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:32,height:32,borderRadius:10,background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>⚡</div>
              <div><p style={{fontSize:20,fontWeight:900,color:isDark?'#60a5fa':'#2563eb',margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{salesPerHour.toFixed(1)}</p><p style={{fontSize:9,color:labelMuted,margin:0,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Vendas/h</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sparkline ─── linha suave, sem rigidez, valores nas pontas ──
function smoothPath(pts: {x:number;y:number}[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i=0; i<pts.length-1; i++) {
    const p0 = pts[i-1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i+1]
    const p3 = pts[i+2] ?? p2
    const c1x = p1.x + (p2.x-p0.x)/6, c1y = p1.y + (p2.y-p0.y)/6
    const c2x = p2.x - (p3.x-p1.x)/6, c2y = p2.y - (p3.y-p1.y)/6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

function CompactBars({ data, accent, isDark=true }: { data:{label:string;value:number}[]; accent:string; isDark?:boolean }) {
  if (data.length < 2 || !data.some(d=>d.value>0)) return null
  const max = Math.max(...data.map(d=>d.value), 1)
  const H = 90
  const fmtShort = (v:number) => v>=1000?`${(v/1000).toFixed(1)}k`:v.toFixed(0)
  const labelC = isDark ? 'rgba(168,85,247,.45)' : 'rgba(109,40,217,.55)'
  const valueC = isDark ? 'rgba(233,213,255,.5)' : 'rgba(91,33,182,.55)'
  return (
    <div style={{ position:'absolute', top:'50%', right:260, transform:'translateY(-50%)', width:210, pointerEvents:'none' }}>
      <p style={{ margin:'0 0 11px', fontSize:9, fontWeight:800, color:labelC, textTransform:'uppercase', letterSpacing:'.1em', fontFamily:"'JetBrains Mono',monospace", textAlign:'center' }}>Últimos dias</p>
      <div style={{ display:'flex', alignItems:'flex-end', gap:7, height:H }}>
        {data.map((d,i)=>{
          const isLast = i===data.length-1
          const h = Math.max((d.value/max)*H, d.value>0?7:2)
          return (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, height:'100%', justifyContent:'flex-end' }}>
              <span style={{ fontSize:8.5, fontWeight:isLast?900:700, color:isLast?accent:valueC, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>
                {d.value>0?fmtShort(d.value):''}
              </span>
              <motion.div initial={{height:0}} animate={{height:h}} transition={{duration:.5,delay:i*.05,ease:'easeOut'}}
                style={{ width:'100%', borderRadius:'4px 4px 0 0', background:isLast?accent:`${accent}55`, boxShadow:isLast?`0 0 8px ${accent}66`:'none' }}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Sparkline({ data, accent, compact=false, isDark=true }: { data:{label:string;value:number}[]; accent:string; compact?:boolean; isDark?:boolean }) {
  if (compact) return <CompactBars data={data} accent={accent} isDark={isDark}/>
  if (data.length < 2 || !data.some(d=>d.value>0)) return null
  const W=380, H=130, padX=10, padY=24
  const max = Math.max(...data.map(d=>d.value), 1)
  const min = Math.min(...data.map(d=>d.value), 0)
  const range = Math.max(max-min, 1)
  const step = (W-padX*2)/(data.length-1)
  const pts = data.map((d,i)=>({ x: padX+i*step, y: padY + (H-padY-12) * (1-(d.value-min)/range) }))
  const linePath = smoothPath(pts)
  const areaPath = `${linePath} L ${pts[pts.length-1].x},${H} L ${pts[0].x},${H} Z`
  const gid = 'sparkgrad'
  const titleC = isDark ? 'rgba(168,85,247,.45)' : 'rgba(109,40,217,.55)'
  const valueC = isDark ? 'rgba(233,213,255,.55)' : 'rgba(91,33,182,.6)'
  const dayC   = isDark ? 'rgba(168,85,247,.4)'  : 'rgba(109,40,217,.45)'
  const dotFill = isDark ? '#fff' : '#f5f3ff'
  return (
    <div style={{ position:'absolute', right:28, top:'50%', transform:'translateY(-50%)', width:W, height:H, pointerEvents:'none' }}>
      <p style={{ position:'absolute', top:-18, left:0, right:0, textAlign:'center', margin:0, fontSize:8, fontWeight:800, color:titleC, textTransform:'uppercase', letterSpacing:'.12em', fontFamily:"'JetBrains Mono',monospace" }}>Últimos dias</p>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity=".35"/>
            <stop offset="100%" stopColor={accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <motion.path d={areaPath} fill={`url(#${gid})`} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.6}}/>
        <motion.path d={linePath} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ duration:1.1, ease:'easeOut' }}/>
        {pts.map((p,i)=>{
          const isLast = i===pts.length-1
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={isLast?4:2.5} fill={isLast?accent:dotFill} stroke={accent} strokeWidth={isLast?0:1.5}/>
              <text x={p.x} y={p.y-8} textAnchor="middle" fontSize={9} fontWeight={isLast?900:700} fill={isLast?accent:valueC} fontFamily="'JetBrains Mono',monospace">
                {data[i].value>=1000?`${(data[i].value/1000).toFixed(1)}k`:data[i].value.toFixed(0)}
              </text>
              <text x={p.x} y={H+6} textAnchor="middle" fontSize={8} fill={dayC} fontFamily="'JetBrains Mono',monospace">{data[i].label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
function VerticalCards({ events, selected, onSelect, isDark, verticals=VERTICAL_LIST }: { events:TelaoEvent[]; selected:VerticalId|null; onSelect:(v:VerticalId|null)=>void; isDark:boolean; verticals?:typeof VERTICAL_LIST }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
      {verticals.map(v=>{
        const count=events.filter(e=>e.vertical===v.id).length
        const revenue=events.filter(e=>e.vertical===v.id&&e.event_type==='sale').reduce((s,e)=>s+(e.value??0),0)
        const active=selected===v.id
        return (
          <motion.button key={v.id} whileHover={{scale:1.02}} whileTap={{scale:.98}} onClick={()=>onSelect(active?null:v.id)}
            style={{background:active?`linear-gradient(135deg,${v.accent}25,${v.accent}10)`:'rgba(255,255,255,.02)',border:`1.5px solid ${active?v.accent+'66':'rgba(255,255,255,.06)'}`,borderRadius:18,padding:'14px 14px 8px',cursor:'pointer',textAlign:'left',position:'relative',overflow:'hidden',backdropFilter:'blur(8px)',boxShadow:active?`0 0 24px ${v.glow},inset 0 1px 0 rgba(255,255,255,.06)`:'none',transition:'all .2s'}}>
            <img src={v.mascot} alt={v.label} style={{position:'absolute',right:-10,bottom:-6,height:72,objectFit:'contain',opacity:active?1:(isDark?0.35:0.72),filter:`drop-shadow(0 0 12px ${active?v.accent+'99':v.accent+'44'})`,transition:'opacity .2s, filter .2s',pointerEvents:'none'}}/>
            <div style={{position:'relative',zIndex:1}}>
              <span style={{fontSize:9,fontWeight:800,color:active?v.accent:(isDark?'#4a2d6b':'#6d28d9'),letterSpacing:'.1em',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase'}}>{v.short}</span>
              <p style={{fontSize:16,fontWeight:900,color:active?v.accent:(isDark?'#9ca3af':'#4c1d95'),margin:'4px 0 4px',fontFamily:"'Space Grotesk',sans-serif",fontVariantNumeric:'tabular-nums'}}>{fmtBRL(revenue)}</p>
              <p style={{fontSize:10,color:active?v.accent+'aa':(isDark?'#374151':'#7c3aed'),margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{count}v · {v.label.split('-')[0]}</p>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── GoalBar ───────────────────────────────────────────────────
function GoalBar({ period, periodKey, vertical, current, goals, accent, extra, isDark=true }: { period:'day'|'month'; periodKey:string; vertical:string|null; current:number; goals:any[]; accent:string; extra?:{label:string;value:number}; isDark?:boolean }) {
  const goal=goals.find(g=>g.period===period&&g.period_key===periodKey&&g.vertical===vertical)
  const target=goal?.target_value??0, pct=target>0?Math.min((current/target)*100,100):0, done=pct>=100
  const muted = isDark ? '#4a2d6b' : '#6d28d9'
  const muted2 = isDark ? '#3b1d6e' : '#7c3aed'
  return (
    <div style={{background:isDark?'rgba(255,255,255,.025)':'rgba(255,255,255,.55)',border:isDark?'1px solid rgba(168,85,247,.1)':'1px solid rgba(139,92,246,.25)',borderRadius:18,padding:'16px 18px',backdropFilter:'blur(8px)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div><p style={{fontSize:9,fontWeight:800,color:muted,textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 4px',fontFamily:"'JetBrains Mono',monospace"}}>{period==='day'?'Meta do Dia':'Meta do Mês'}</p>{extra&&<p style={{fontSize:9,color:muted2,margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{extra.label}: {fmtBRL(extra.value)}</p>}</div>
        <div style={{textAlign:'right'}}><p style={{fontSize:22,fontWeight:900,color:done?'#16a34a':accent,margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em'}}>{fmtBRL(current)}</p>{target>0&&<p style={{fontSize:10,color:muted2,margin:0,fontFamily:"'JetBrains Mono',monospace"}}>/ {fmtBRL(target)}</p>}</div>
      </div>
      <div style={{height:5,background:isDark?'rgba(168,85,247,.1)':'rgba(139,92,246,.18)',borderRadius:999,overflow:'hidden',marginBottom:8}}>
        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.9,ease:'easeOut'}} style={{height:'100%',borderRadius:999,background:done?'linear-gradient(90deg,#22c55e,#16a34a)':`linear-gradient(90deg,${accent}66,${accent})`,boxShadow:`0 0 8px ${done?'#22c55e66':accent+'44'}`}}/>
      </div>
      <p style={{fontSize:10,color:done?'#16a34a':muted2,margin:0,fontFamily:"'JetBrains Mono',monospace",fontWeight:done?800:600}}>{done?'✅ META BATIDA!':target>0?`${pct.toFixed(0)}% — faltam ${fmtBRL(target-current)}`:'— sem meta definida'}</p>
    </div>
  )
}

// ── EventFeed ─── CORRIGIDO: lookup por hubspot_id ────────────
function EventFeed({ events, byId, byHubId }: { events:TelaoEvent[]; byId:Record<string,Closer>; byHubId:Record<string,Closer> }) {
  return (
    <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,paddingRight:4,paddingBottom:4}}>
      <AnimatePresence initial={false}>
        {events.slice(0,30).map(ev=>{
          const closer = findCloser(ev.closer_id, (ev as any).closer_hubspot_id, byId, byHubId)
          const name=ev.is_self_checkout?'Self Checkout':(closer?.name??ev.closer_name??'?')
          const v=VERTICALS[ev.vertical]
          const isSale=ev.event_type==='sale'
          const isAmb=ev.sold_by_ambassador||ev.seller_type==='ambassador'
          return (
            <motion.div key={ev.id}
              initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}}
              transition={{type:'spring',stiffness:280,damping:24}}
              style={{background:'var(--tw-card)',border:'1px solid var(--tw-border)',boxShadow:'var(--tw-shadow)',borderLeft:`3px solid ${v.accent}`,borderRadius:10,padding:'9px 11px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              <Avatar closer={closer} name={name} size={30}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:5,background:v.accent+'25',color:v.accent,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'.06em'}}>{v.short}</span>
                  <span style={{fontSize:9,color:isSale?'#7c3aed':GOLD,fontFamily:"'JetBrains Mono',monospace"}}>{isSale?'💰 VENDA':'🎓 EMBAIXADOR'}</span>
                  {isAmb&&<span style={{fontSize:9,color:'#22c55e',fontFamily:"'JetBrains Mono',monospace"}}>🌟 AMB</span>}
                  {(ev as any).is_recurring && (ev as any).installment_number > 1 && (
                    <span style={{fontSize:9,color:'#0d9488',background:'rgba(13,148,136,.15)',padding:'2px 6px',borderRadius:5,fontFamily:"'JetBrains Mono',monospace"}}>
                      🔄 {(ev as any).installment_number}/{(ev as any).total_installments}
                    </span>
                  )}
                </div>
                <p style={{fontSize:12,fontWeight:700,color:'var(--tw-text)',margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{isSale?ev.lead_name:ev.ambassador_name}</p>
                {isSale&&ev.product&&<p style={{fontSize:10,color:'var(--tw-muted-text)',margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'JetBrains Mono',monospace"}}>{ev.product}</p>}
                <p style={{fontSize:9,color:'var(--tw-muted)',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{name.split(' ')[0]} · {timeAgo(ev.occurred_at)}</p>
              </div>
              {isSale&&ev.value&&(
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{fontSize:14,fontWeight:900,color:v.accent,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",margin:0}}>{fmtBRL(ev.value)}</p>
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
      {events.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:'#2d1b4e'}}><p style={{fontSize:32}}>⚡</p><p style={{fontSize:11,marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>Aguardando eventos...</p></div>}
    </div>
  )
}

// ── Ranking ─── CORRIGIDO: enriquece closer via hubspot_id ────
function Ranking({ stats, accent }: { stats:CloserStats[]; accent:string }) {
  const max=stats[0]?.revenue??1
  return (
    <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:4,paddingBottom:4}}>
      <AnimatePresence initial={false}>
      {stats.slice(0,15).map((s,i)=>{
        const pct=max>0?(s.revenue/max)*100:0, top3=i<3, halos=['#FFD700','#C0C0C0','#CD7F32']
        return (
          <motion.div key={s.closer?.id??s.name} layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.03,type:'spring',stiffness:260,damping:24}}
            style={{background:top3?`linear-gradient(135deg,${halos[i]}08,rgba(255,255,255,.02))`:'rgba(255,255,255,.02)',border:`1px solid ${top3?halos[i]+'22':'rgba(255,255,255,.05)'}`,borderRadius:10,padding:'7px 11px',position:'relative',overflow:'hidden',flexShrink:0}}>
            <div style={{position:'absolute',inset:0,width:`${pct}%`,background:top3?`${halos[i]}06`:'rgba(168,85,247,.03)',borderRadius:10,transition:'width .6s ease'}}/>
            <div style={{position:'relative',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:top3?15:10,width:20,textAlign:'center',fontWeight:900,color:top3?halos[i]:'var(--muted-foreground)',fontFamily:top3?'inherit':"'JetBrains Mono',monospace",flexShrink:0}}>{top3?['🥇','🥈','🥉'][i]:`#${i+1}`}</span>
              <Avatar closer={s.closer} name={s.name} size={top3?30:24} rank={i}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:top3?12:11,fontWeight:800,color:'var(--foreground)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Space Grotesk',sans-serif"}}>{s.name}{s.isAmbassador&&<span style={{fontSize:8,color:'#22c55e',marginLeft:3}}>🌟</span>}</p>
                <p style={{fontSize:8,color:'var(--muted-foreground)',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{s.sales}v{s.certs>0?` · ${s.certs}★`:''}</p>
              </div>
              <motion.span key={s.revenue} initial={{scale:1}} animate={{scale:[1,1.12,1]}} transition={{duration:.35}} style={{fontSize:top3?13:11,fontWeight:900,color:top3?accent:'var(--muted-foreground)',fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",flexShrink:0}}>{fmtBRL(s.revenue)}</motion.span>
            </div>
          </motion.div>
        )
      })}
      </AnimatePresence>
      {stats.length===0&&<div style={{textAlign:'center',padding:'32px 0',color:'#2d1b4e'}}><p style={{fontSize:24}}>🏆</p><p style={{fontSize:11,marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>Sem dados ainda</p></div>}
    </div>
  )
}

// ── HourlyChart ─── Heatmap de vendas por hora (últimas 12h) ──
function HourlyChart({ events, closers, byHubId, accent, pulseHour, isDark=true }: { events:TelaoEvent[]; closers:Closer[]; byHubId:Record<string,Closer>; accent:string; pulseHour?:number|null; isDark?:boolean }) {
  const byId = useMemo(() => Object.fromEntries(closers.map(c=>[c.id,c])), [closers])

  const buckets = useMemo(() => {
    const curHour = hourInSaoPaulo(new Date())
    const hours = Array.from({length:12}, (_,i) => (curHour-11+i+24)%24)
    const b = hours.map(h => ({ hour:h, total:0, count:0, topName:null as string|null, topRevenue:0, topHubId:null as string|null, topCloserId:null as string|null }))
    events.forEach(e => {
      if (e.event_type!=='sale') return
      const h = hourInSaoPaulo(e.occurred_at)
      const bucket = b.find(x=>x.hour===h)
      if (!bucket) return
      bucket.total += (e.value??0)
      bucket.count += 1
      if ((e.value??0) >= bucket.topRevenue) {
        bucket.topRevenue = e.value??0
        bucket.topName    = e.closer_name ?? null
        bucket.topHubId   = (e as any).closer_hubspot_id ?? null
        bucket.topCloserId= e.closer_id ?? null
      }
    })
    return b
  }, [events])

  const maxTotal = Math.max(...buckets.map(b=>b.total), 1)
  const curHour = hourInSaoPaulo(new Date())
  const emptyBg     = isDark ? 'rgba(255,255,255,.03)' : 'rgba(139,92,246,.08)'
  const emptyBorder = isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(139,92,246,.18)'

  return (
    <div style={{display:'flex',gap:5}}>
      {buckets.map(b=>{
        const intensity = b.total/maxTotal // 0..1
        const isNow = b.hour===curHour
        const closer = b.topCloserId ? byId[b.topCloserId] : (b.topHubId ? byHubId[b.topHubId] : null)
        const label = String(b.hour).padStart(2,'0')+'h'
        return (
          <div key={b.hour} title={b.total>0?`${label} — ${fmtBRL(b.total)} · ${b.count}v${b.topName?` · top: ${b.topName}`:''}`:label}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div style={{
              width:'100%',height:52,borderRadius:9,position:'relative',overflow:'hidden',
              background: b.total>0 ? `${accent}${Math.round((isDark?18:30)+intensity*70).toString(16).padStart(2,'0')}` : emptyBg,
              border: isNow ? `1.5px solid ${accent}` : (b.total>0 ? `1px solid ${accent}33` : emptyBorder),
              boxShadow: isNow ? `0 0 14px ${accent}55` : 'none',
              animation: isNow && pulseHour===b.hour ? 'cellPulse .7s ease-out' : 'none',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>
              {closer && b.total>0 && (
                <div style={{position:'absolute',top:3,right:3}}><Avatar closer={closer} name={b.topName||'?'} size={16}/></div>
              )}
              {b.total>0 && (
                <span style={{fontSize:intensity>.45?10:9,fontWeight:800,color:intensity>.45?'#fff':(isDark?accent:'#3b0764'),fontFamily:"'JetBrains Mono',monospace"}}>
                  {b.total>=1000?`${(b.total/1000).toFixed(1)}k`:b.total.toFixed(0)}
                </span>
              )}
            </div>
            <span style={{fontSize:8,color:isNow?accent:(isDark?'#2d1b4e':'#7c3aed'),fontFamily:"'JetBrains Mono',monospace",fontWeight:isNow?800:600}}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Ticker ────────────────────────────────────────────────────
function Ticker({ events }: { events:TelaoEvent[] }) {
  const sales=events.filter(e=>e.event_type==='sale'&&e.value).slice(0,20)
  if(!sales.length) return null
  const items=[...sales,...sales]
  return (
    <div style={{background:'rgba(88,28,135,.15)',borderTop:'1px solid rgba(168,85,247,.1)',overflow:'hidden',height:26,display:'flex',alignItems:'center'}}>
      <div style={{display:'flex',animation:'ticker 40s linear infinite',whiteSpace:'nowrap'}}>
        {items.map((ev,i)=>{ const v=VERTICALS[ev.vertical]; return <span key={`${ev.id}-${i}`} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'0 20px',borderRight:'1px solid rgba(168,85,247,.1)',fontFamily:"'JetBrains Mono',monospace",fontSize:10}}><span style={{color:v.accent,fontWeight:700}}>{v.short}</span><span style={{color:'#4a2d6b'}}>{ev.lead_name}</span><span style={{color:GOLD,fontVariantNumeric:'tabular-nums',fontWeight:700}}>{fmtBRL(ev.value!)}</span></span> })}
      </div>
    </div>
  )
}

// ── Celebration ─── CORRIGIDO: lookup por hubspot_id ─────────
function Celebration({ ev, byId, byHubId, onDone }: { ev:TelaoEvent; byId:Record<string,Closer>; byHubId:Record<string,Closer>; onDone:()=>void }) {
  const [count,setCount]=useState(0)
  const v=VERTICALS[ev.vertical], isSale=ev.event_type==='sale', target=ev.value??0
  const closer = findCloser(ev.closer_id, (ev as any).closer_hubspot_id, byId, byHubId)
  const name=ev.is_self_checkout?'Self Checkout':(closer?.name??ev.closer_name??'?')

  useEffect(()=>{
    if(isSale){ playSale(); let c=0; const step=target/60; const id=setInterval(()=>{ c=Math.min(c+step,target); setCount(Math.floor(c)); if(c>=target)clearInterval(id) },16) }
    else playCert()
    const t=setTimeout(onDone,7000); return()=>clearTimeout(t)
  },[])

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(ellipse at 60% 40%,${v.accent}20,rgba(13,0,21,.96) 65%)`,backdropFilter:'blur(14px)'}}>
      <Confete color={v.accent}/>
      <motion.div initial={{scale:.7,y:40}} animate={{scale:1,y:0}} exit={{scale:.9,opacity:0}} transition={{type:'spring',stiffness:200,damping:20}} style={{textAlign:'center',maxWidth:580,padding:'0 40px',position:'relative',zIndex:1001}}>
        <motion.img src={v.mascot} alt={v.label} initial={{scale:0,rotate:-10}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:240,damping:16,delay:.1}} style={{height:160,objectFit:'contain',margin:'0 auto 20px',display:'block',filter:`drop-shadow(0 0 40px ${v.accent}88)`}}/>
        {/* Avatar do closer na celebração */}
        <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:.15,type:'spring',stiffness:220,damping:16}}
          style={{margin:'0 auto 16px',display:'flex',justifyContent:'center'}}>
          <Avatar closer={closer} name={name} size={64}/>
        </motion.div>
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}} style={{fontSize:11,fontWeight:800,color:v.accent,textTransform:'uppercase',letterSpacing:'.16em',marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>
          {isSale?'💰 VENDA FECHADA!':'🎓 EMBAIXADOR CERTIFICADO!'}
          {(ev as any).is_recurring && (ev as any).installment_number > 1 && (
            <span style={{ marginLeft:10, color:'#0d9488' }}>🔄 RECORRENTE {(ev as any).installment_number}/{(ev as any).total_installments}</span>
          )}
        </motion.p>
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.25}} style={{fontSize:38,fontWeight:900,color:'#f3e8ff',marginBottom:8,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em',lineHeight:1.1}}>{isSale?name:ev.ambassador_name}</motion.p>
        <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.3}} style={{fontSize:15,color:'#7c3aed',marginBottom:30,fontFamily:"'Space Grotesk',sans-serif"}}>{isSale?`${ev.lead_name} · ${ev.product}`:`${ev.college}${ev.class?` · Turma ${ev.class}`:''}`}</motion.p>
        {isSale&&<motion.p initial={{scale:.4,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:300,damping:14,delay:.4}} style={{fontSize:72,fontWeight:900,color:v.accent,fontVariantNumeric:'tabular-nums',lineHeight:1,fontFamily:"'Space Grotesk',sans-serif",textShadow:`0 0 60px ${v.accent}88`,margin:0}}>{fmtBRL(count)}</motion.p>}
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.55}} style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:24,padding:'8px 20px',borderRadius:999,background:`${v.accent}18`,border:`1px solid ${v.accent}33`}}>
          <img src={v.mascot} alt="" style={{height:20,objectFit:'contain'}}/>
          <span style={{fontSize:12,fontWeight:700,color:v.accent,fontFamily:"'JetBrains Mono',monospace"}}>{v.label}</span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// ── Presets rápidos de data (estilo HubSpot), sempre em horário de SP ──
function datePresets(): { label:string; start:string; end:string }[] {
  const today = todayInSaoPaulo()
  const wd = weekdayInSaoPaulo(new Date()) // 0=dom..6=sáb
  const daysSinceMonday = (wd+6)%7
  return [
    { label:'Hoje',            start:today,                              end:today },
    { label:'Ontem',           start:addDaysToDateStr(today,-1),          end:addDaysToDateStr(today,-1) },
    { label:'Esta semana',     start:addDaysToDateStr(today,-daysSinceMonday), end:today },
    { label:'Este mês',        start:today.slice(0,8)+'01',               end:today },
    { label:'Últimos 7 dias',  start:addDaysToDateStr(today,-6),          end:today },
    { label:'Últimos 30 dias', start:addDaysToDateStr(today,-29),         end:today },
    { label:'Últimos 3 meses', start:addDaysToDateStr(today,-89),         end:today },
  ]
}

// ── Dinheiro deixado na mesa ─── calculado a partir do cupom (_X% no final) ──
function MoneyLeftOnTable({ value, isDark=true }: { value:number; isDark?:boolean }) {
  const muted = isDark ? '#4a2d6b' : '#6d28d9'
  return (
    <div style={{background:isDark?'linear-gradient(135deg,rgba(245,158,11,.06),rgba(255,255,255,.02))':'linear-gradient(135deg,rgba(245,158,11,.1),rgba(255,255,255,.5))',border:isDark?'1px solid rgba(245,158,11,.15)':'1px solid rgba(245,158,11,.3)',borderRadius:20,padding:'16px 18px',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',gap:16}}>
      <div style={{width:44,height:44,borderRadius:12,background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>💸</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:9,fontWeight:800,color:'#d97706',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 3px',fontFamily:"'JetBrains Mono',monospace"}}>Dinheiro deixado na mesa</p>
        <p style={{fontSize:10,color:muted,margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>Desconto concedido pelos closers (via cupom) no período, sem contar self-checkout nem parcelas repetidas</p>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <p style={{fontSize:24,fontWeight:900,color:value>0?'#f59e0b':muted,margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em'}}>{fmtBRL(value)}</p>
        <p style={{fontSize:8,color:muted,margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{value===0?'sem descontos no período':'no período'}</p>
      </div>
    </div>
  )
}

// ── FilterBar ─────────────────────────────────────────────────
function FilterBar({ filter, onChange, closers, events, isAdmin, activeVertical, isDark=true }: { filter:FilterState; onChange:(f:FilterState)=>void; closers:Closer[]; events:TelaoEvent[]; isAdmin:boolean; activeVertical:VerticalId|null; isDark?:boolean }) {
  const [open,setOpen]=useState(false)
  const [draft,setDraft]=useState(filter)
  const count=(filter.start?1:0)+(filter.end?1:0)+filter.closerKeys.length

  const allFilterClosers = useMemo(()=>{
    const map = new Map<string,{id:string;name:string;color:string}>()
    closers.forEach(c => map.set(c.id, { id:c.id, name:c.name, color:c.color }))
    const filtEvents = activeVertical ? events.filter(e=>e.vertical===activeVertical) : events
    filtEvents.forEach(ev => {
      if(ev.is_self_checkout) return
      if(ev.closer_id && !map.has(ev.closer_id)) {
        map.set(ev.closer_id, { id:ev.closer_id, name:ev.closer_name??'?', color:'#7c3aed' })
      } else if(!ev.closer_id && ev.closer_name) {
        const key=`name-${ev.closer_name}`
        if(!map.has(key)) map.set(key, { id:key, name:ev.closer_name, color:'#7c3aed' })
      }
    })
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name))
  },[closers,events,activeVertical])

  const DI: React.CSSProperties = {
    height: 32, padding: '0 10px', borderRadius: 8,
    border: isDark ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(109,40,217,.2)',
    background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(109,40,217,.06)',
    color: isDark ? 'rgba(255,255,255,.85)' : 'rgba(60,0,100,.85)',
    fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
    colorScheme: isDark ? 'dark' as any : 'light' as any, transition: 'border-color .15s, background .15s',
  }

  if(!isAdmin) return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{fontSize:10,fontWeight:500,letterSpacing:'.04em',whiteSpace:'nowrap',userSelect:'none',color: isDark ? 'rgba(255,255,255,.4)' : 'rgba(80,20,120,.5)'}}>Período</span>
      <select value="" onChange={e=>{ const p=datePresets().find(x=>x.label===e.target.value); if(!p) return; const nd={...draft,start:p.start,end:p.end}; setDraft(nd); onChange(nd) }}
        style={{...DI, cursor:'pointer'}}>
        <option value="" disabled>Atalho rápido…</option>
        {datePresets().map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
      </select>
      <input type="date" value={draft.start??''} onChange={e=>{ const v=e.target.value||null; const nd={...draft,start:v}; setDraft(nd); onChange(nd) }} style={DI}
        onFocus={e=>{ e.target.style.borderColor='rgba(168,85,247,.6)'; e.target.style.background='rgba(168,85,247,.1)' }}
        onBlur={e=>{ e.target.style.borderColor=isDark?'rgba(255,255,255,.12)':'rgba(109,40,217,.2)'; e.target.style.background=isDark?'rgba(255,255,255,.06)':'rgba(109,40,217,.06)' }}/>
      <span style={{ fontSize:12, fontWeight:300, color: isDark?'rgba(255,255,255,.2)':'rgba(80,20,120,.25)' }}>—</span>
      <input type="date" value={draft.end??''} onChange={e=>{ const v=e.target.value||null; const nd={...draft,end:v}; setDraft(nd); onChange(nd) }} style={DI}
        onFocus={e=>{ e.target.style.borderColor='rgba(168,85,247,.6)'; e.target.style.background='rgba(168,85,247,.1)' }}
        onBlur={e=>{ e.target.style.borderColor=isDark?'rgba(255,255,255,.12)':'rgba(109,40,217,.2)'; e.target.style.background=isDark?'rgba(255,255,255,.06)':'rgba(109,40,217,.06)' }}/>
      {(draft.start||draft.end) && (
        <button onClick={()=>{ const nd={...draft,start:null,end:null}; setDraft(nd); onChange(nd) }}
          style={{display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:8,border: isDark?'1px solid rgba(255,255,255,.1)':'1px solid rgba(109,40,217,.15)',background: isDark?'rgba(255,255,255,.05)':'rgba(109,40,217,.05)',color: isDark?'rgba(255,255,255,.45)':'rgba(80,20,120,.5)',cursor:'pointer',fontSize:12,lineHeight:1,transition:'all .15s'}}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,.15)'; e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='rgba(239,68,68,.3)' }}
          onMouseLeave={e=>{ e.currentTarget.style.background=isDark?'rgba(255,255,255,.05)':'rgba(109,40,217,.05)'; e.currentTarget.style.color=isDark?'rgba(255,255,255,.45)':'rgba(80,20,120,.5)'; e.currentTarget.style.borderColor=isDark?'rgba(255,255,255,.1)':'rgba(109,40,217,.15)' }}>
          ✕
        </button>
      )}
    </div>
  )

  return (
    <div style={{position:'relative'}}>
      <motion.button whileTap={{scale:.97}} onClick={()=>{ setDraft(filter); setOpen(o=>!o) }}
        style={{display:'flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:`1px solid ${count>0?'rgba(168,85,247,.5)':'rgba(255,255,255,.08)'}`,background:count>0?'rgba(168,85,247,.12)':'rgba(255,255,255,.03)',color:count>0?'#c4b5fd':'#4a2d6b',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",backdropFilter:'blur(4px)'}}>
        <SlidersHorizontal size={13}/> Filtros
        {count>0&&<span style={{background:'#7c3aed',color:'#fff',fontSize:9,borderRadius:999,padding:'1px 6px',fontWeight:900}}>{count}</span>}
      </motion.button>
      <AnimatePresence>
        {open&&(
          <>
            <div style={{position:'fixed',inset:0,zIndex:50}} onClick={()=>setOpen(false)}/>
            <motion.div initial={{opacity:0,y:-6,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6}}
              style={{position:'absolute',top:40,right:0,zIndex:100,width:300,background:'var(--card)',border:'1px solid var(--border)',borderRadius:18,padding:20,boxShadow:'0 24px 60px rgba(0,0,0,.25)',backdropFilter:'blur(20px)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
                <span style={{fontSize:13,fontWeight:800,color:'var(--foreground)'}}>Filtros</span>
                <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',color:'var(--muted-foreground)',cursor:'pointer'}}><X size={14}/></button>
              </div>

              <p style={{fontSize:9,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Atalhos rápidos</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
                {datePresets().map(p=>{
                  const active = draft.start===p.start && draft.end===p.end
                  return (
                    <button key={p.label} onClick={()=>{ const nd={...draft,start:p.start,end:p.end}; setDraft(nd); onChange(nd) }}
                      style={{height:26,padding:'0 10px',borderRadius:7,border:`1px solid ${active?'#a855f7':'var(--border)'}`,background:active?'rgba(168,85,247,.15)':'transparent',color:active?'#a855f7':'var(--muted-foreground)',fontSize:10.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                      {p.label}
                    </button>
                  )
                })}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                {(['start','end'] as const).map(k=>(
                  <div key={k}><label style={{fontSize:9,color:'var(--muted-foreground)',display:'block',marginBottom:4,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>{k==='start'?'De':'Até'}</label><input type="date" value={draft[k]??''} onChange={e=>setDraft(p=>({...p,[k]:e.target.value||null}))} style={{width:'100%',height:34,padding:'0 8px',borderRadius:9,border:'1px solid var(--border)',background:'var(--background)',color:'var(--foreground)',fontSize:11,fontFamily:"'JetBrains Mono',monospace",outline:'none'}}/></div>
                ))}
              </div>
              <p style={{fontSize:9,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Closers ({allFilterClosers.length})</p>
              <div style={{maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:3,marginBottom:14}}>
                <label onClick={()=>setDraft(p=>({...p,closerKeys:p.closerKeys.includes('self')?p.closerKeys.filter(k=>k!=='self'):[...p.closerKeys,'self']}))}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,cursor:'pointer',background:draft.closerKeys.includes('self')?'rgba(168,85,247,.1)':'transparent'}}>
                  <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${draft.closerKeys.includes('self')?'#a855f7':'rgba(168,85,247,.2)'}`,background:draft.closerKeys.includes('self')?'#a855f7':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{draft.closerKeys.includes('self')&&<span style={{fontSize:8,color:'#fff',fontWeight:900}}>✓</span>}</div>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#4a2d6b',flexShrink:0}}/>
                  <span style={{fontSize:11,color:draft.closerKeys.includes('self')?'#c4b5fd':'#4a2d6b'}}>↻ Self Checkout</span>
                </label>
                {allFilterClosers.map(c=>{
                  const sel=draft.closerKeys.includes(c.id)
                  return (
                    <label key={c.id} onClick={()=>setDraft(p=>({...p,closerKeys:sel?p.closerKeys.filter(k=>k!==c.id):[...p.closerKeys,c.id]}))}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,cursor:'pointer',background:sel?'rgba(168,85,247,.1)':'transparent',transition:'background .12s'}}>
                      <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${sel?'#a855f7':'rgba(168,85,247,.2)'}`,background:sel?'#a855f7':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{sel&&<span style={{fontSize:8,color:'#fff',fontWeight:900}}>✓</span>}</div>
                      <span style={{width:7,height:7,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                      <span style={{fontSize:11,color:sel?'#6366f1':'var(--foreground)'}}>{c.name}</span>
                    </label>
                  )
                })}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{ const e=EMPTY_FILTER; setDraft(e); onChange(e); setOpen(false) }} style={{flex:1,height:32,borderRadius:9,border:'1px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>× Limpar</button>
                <button onClick={()=>{ onChange(draft); setOpen(false) }} style={{flex:2,height:32,borderRadius:9,border:'none',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer'}}>Aplicar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── LiveWallInner ─────────────────────────────────────────────
interface Props { isAdmin: boolean; userCloserId: string | null; userHubspotId: string | null; userTeam: string | null }

function LiveWallInner({ isAdmin, userCloserId, userHubspotId, userTeam }: Props) {
  const { events, closers, goals, monthRevenue, latest, clearLatest, loading, refetch } = useLiveData()
  const [vf,    setVf]    = useState<VerticalId|null>(null)
  const [filter,setFilter]= useState<FilterState>(EMPTY_FILTER)
  const [audioOn,setAudio]= useState(false)
  const [celeb,        setCeleb]        = useState<TelaoEvent|null>(null)
  const [rangeEvents,   setRangeEvents]   = useState<TelaoEvent[] | null>(null)
  const [rangeFetching, setRangeFetching] = useState(false)
  const [allUserEvs,    setAllUserEvs]    = useState<TelaoEvent[]>([])
  const [allFetched,    setAllFetched]    = useState(false)

  // ── Maps de lookup ─── CORRIGIDO: byHubId para todos os componentes
  const byId    = useMemo(() => Object.fromEntries(closers.map(c => [c.id, c])), [closers])
  const byHubId = useMemo(() => Object.fromEntries(
    closers.filter(c => c.hubspot_id).map(c => [String(c.hubspot_id!), c])
  ), [closers])

  const [isDark, setIsDark] = useState(true)
  useEffect(()=>{
    const check = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
      const isLight = bg.includes('f0') || bg.includes('ff') || bg.includes('240') || bg.includes('248')
      setIsDark(!isLight)
    }
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class','style','data-theme'] })
    return () => obs.disconnect()
  }, [])

  const TH = isDark ? {
    bg: '#0a0015', card: 'rgba(255,255,255,.02)', border: 'rgba(168,85,247,.1)',
    text: '#fff', muted: '#2d1b4e', mutedText: '#4a2d6b',
  } : {
    bg: '#f7f3ff', card: 'rgba(255,255,255,0.9)', border: 'rgba(109,40,217,0.22)',
    text: '#1e0040', muted: '#5b21b6', mutedText: '#7c3aed',
  }
  const accent = vf?VERTICALS[vf].accent:'#a855f7'

  const visibleVerticals = isAdmin
    ? VERTICAL_LIST
    : userTeam === 'R1'
      ? VERTICAL_LIST.filter(v => v.id === 'medreview')
      : userTeam === 'OAO'
        ? VERTICAL_LIST.filter(v => v.id !== 'medreview')
        : VERTICAL_LIST

  const sourceEvents = rangeEvents ?? events

  const baseEvents = useMemo(()=>{
    if(isAdmin) return sourceEvents
    return sourceEvents.filter(e => {
      if(userCloserId   && e.closer_id === userCloserId)                  return true
      if(userHubspotId  && (e as any).closer_hubspot_id === userHubspotId) return true
      return false
    })
  },[sourceEvents,isAdmin,userCloserId,userHubspotId])

  const viewEvents = useMemo(()=>{
    let evs=baseEvents
    if(vf) evs=evs.filter(e=>e.vertical===vf)
    if(!rangeEvents) {
      if(filter.start) evs=evs.filter(e=>e.occurred_at>=dayBoundsSaoPaulo(filter.start!).start)
      if(filter.end)   evs=evs.filter(e=>e.occurred_at<=dayBoundsSaoPaulo(filter.end!).end)
    }
    if(filter.closerKeys.length>0)
      evs=evs.filter(e=>e.is_self_checkout?filter.closerKeys.includes('self'):(filter.closerKeys.includes(e.closer_id??'')||filter.closerKeys.includes(`name-${e.closer_name??''}`)))
    return evs
  },[baseEvents,vf,filter,rangeEvents])

  // ── Stats com enriquecimento via hubspot_id ────────────────
  const stats = useMemo(() => {
    const raw = computeCloserStats(viewEvents, closers)
    return raw.map(s => {
      // Se já tem avatar, não precisa enriquecer
      if (s.closer?.avatar_url) return s
      // Tentar encontrar via hubspot_id do evento
      const ev  = viewEvents.find(e => e.closer_name === s.name && (e as any).closer_hubspot_id)
      const hub = ev ? String((ev as any).closer_hubspot_id) : null
      const hit = hub ? byHubId[hub] : null
      return hit ? { ...s, closer: hit } : s
    })
  }, [viewEvents, closers, byHubId])

  const todayRev = useMemo(()=>viewEvents.filter(e=>e.event_type==='sale').reduce((s,e)=>s+(e.value??0),0),[viewEvents])
  const monthRev = vf?(monthRevenue.byVertical[vf]??0):monthRevenue.overall

  // Para consultor: buscar todos eventos históricos
  useEffect(()=>{
    if(isAdmin || allFetched) return
    const supabase = createBrowserClient()
    setAllFetched(true)
    supabase.from('telao_events').select('*').order('occurred_at',{ascending:false}).limit(5000)
      .then(({data})=>{
        const myEvs = (data??[]).filter((e:any)=>{
          if(userCloserId  && e.closer_id === userCloserId) return true
          if(userHubspotId && e.closer_hubspot_id === userHubspotId) return true
          return false
        })
        setAllUserEvs(myEvs as TelaoEvent[])
      })
  },[isAdmin, allFetched, userCloserId, userHubspotId])

  const accRev   = useMemo(()=>allUserEvs.filter(e=>e.event_type==='sale'&&(!vf||e.vertical===vf)).reduce((s,e)=>s+(e.value??0),0),[allUserEvs,vf])
  const accCount = useMemo(()=>allUserEvs.filter(e=>e.event_type==='sale'&&(!vf||e.vertical===vf)).length,[allUserEvs,vf])

  const yesterdayBounds = dayBoundsSaoPaulo(addDaysToDateStr(todayInSaoPaulo(), -1))

  const yesterdayRev = useMemo(()=>allUserEvs.filter(e=>{
    if(e.event_type!=='sale') return false
    if(vf && e.vertical!==vf) return false
    return e.occurred_at>=yesterdayBounds.start && e.occurred_at<=yesterdayBounds.end
  }).reduce((s,e)=>s+(e.value??0),0),[allUserEvs,vf])

  const last7Days = useMemo(()=>{
    const days: {label:string;rev:number;date:Date}[] = []
    const today = todayInSaoPaulo()
    for(let i=6;i>=0;i--){
      const dateStr = addDaysToDateStr(today, -i)
      const { start, end } = dayBoundsSaoPaulo(dateStr)
      const rev=allUserEvs.filter(e=>{
        if(e.event_type!=='sale') return false
        if(vf && e.vertical!==vf) return false
        return e.occurred_at>=start && e.occurred_at<=end
      }).reduce((s,e)=>s+(e.value??0),0)
      const [dy,dm,dd] = dateStr.split('-').map(Number)
      const d = new Date(Date.UTC(dy,dm-1,dd))
      days.push({label:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getUTCDay()],rev,date:d})
    }
    return days
  },[allUserEvs,vf])

  // ── Dados dos últimos dias pro admin (ontem + tendência do sparkline) ──
  // Consultor já tem isso via allUserEvs (histórico completo).
  const [recentSalesAdmin, setRecentSalesAdmin] = useState<{value:number;vertical:string;occurred_at:string}[]>([])
  useEffect(() => {
    if (!isAdmin) return
    const supabase = createBrowserClient()
    const startDate = addDaysToDateStr(todayInSaoPaulo(), -7)
    const { start } = dayBoundsSaoPaulo(startDate)
    const { end }   = dayBoundsSaoPaulo(todayInSaoPaulo())
    supabase.from('telao_events').select('value,vertical,occurred_at').eq('event_type','sale')
      .gte('occurred_at', start).lte('occurred_at', end)
      .then(({ data }) => setRecentSalesAdmin((data ?? []) as any))
  }, [isAdmin])

  const nowHourSP = hourInSaoPaulo(new Date())

  const yesterdayRevAdmin = useMemo(() =>
    recentSalesAdmin.filter(e => (!vf || e.vertical === vf) && e.occurred_at>=yesterdayBounds.start && e.occurred_at<=yesterdayBounds.end)
      .reduce((s, e) => s + (e.value || 0), 0)
  , [recentSalesAdmin, vf, yesterdayBounds])

  const yesterdaySameHourRevAdmin = useMemo(() =>
    recentSalesAdmin.filter(e => (!vf || e.vertical === vf) && e.occurred_at>=yesterdayBounds.start && e.occurred_at<=yesterdayBounds.end && hourInSaoPaulo(e.occurred_at) <= nowHourSP)
      .reduce((s, e) => s + (e.value || 0), 0)
  , [recentSalesAdmin, vf, yesterdayBounds, nowHourSP])

  // Tendência dos últimos dias, pro sparkline do Hero
  const trendAdmin = useMemo(() => {
    const today = todayInSaoPaulo()
    const days: {label:string;value:number}[] = []
    for (let i=6; i>=0; i--) {
      const dateStr = addDaysToDateStr(today, -i)
      const { start, end } = dayBoundsSaoPaulo(dateStr)
      const rev = recentSalesAdmin.filter(e => (!vf||e.vertical===vf) && e.occurred_at>=start && e.occurred_at<=end)
        .reduce((s,e)=>s+(e.value||0),0)
      const [dy,dm,dd] = dateStr.split('-').map(Number)
      const d = new Date(Date.UTC(dy,dm-1,dd))
      days.push({ label:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getUTCDay()], value:rev })
    }
    return days
  }, [recentSalesAdmin, vf])

  const trendUser = useMemo(() => last7Days.map(d => ({ label:d.label, value:d.rev })), [last7Days])

  // Consultor já tem allUserEvs (todo o histórico) — calcula "mesma hora ontem" a partir dele
  const yesterdaySameHourRevUser = useMemo(() => allUserEvs.filter(e => {
    if (e.event_type!=='sale') return false
    if (vf && e.vertical!==vf) return false
    if (!(e.occurred_at>=yesterdayBounds.start && e.occurred_at<=yesterdayBounds.end)) return false
    return hourInSaoPaulo(e.occurred_at) <= nowHourSP
  }).reduce((s,e)=>s+(e.value??0),0), [allUserEvs, vf, nowHourSP])

  // Pulso na célula do heatmap quando uma venda nova chega
  const [pulseHour, setPulseHour] = useState<number|null>(null)
  useEffect(() => {
    if (!latest || latest.event_type!=='sale') return
    const h = hourInSaoPaulo(latest.occurred_at)
    setPulseHour(h)
    const t = setTimeout(() => setPulseHour(null), 700)
    return () => clearTimeout(t)
  }, [latest])

  const moneyLeftTotal = useMemo(() =>
    viewEvents.reduce((s,e) => s + eventMoneyLeftOnTable(e), 0)
  , [viewEvents])

  const streak = viewEvents.filter(e=>Date.now()-new Date(e.occurred_at).getTime()<90000).length

  useEffect(()=>{
    if(!filter.start){ setRangeEvents(null); return }
    const supabase = createBrowserClient()
    setRangeFetching(true)
    const { start: startISO } = dayBoundsSaoPaulo(filter.start)
    const { end:   endISO }   = dayBoundsSaoPaulo(filter.end ?? filter.start)
    supabase.from('telao_events')
      .select('*').gte('occurred_at', startISO).lte('occurred_at', endISO)
      .order('occurred_at', { ascending: false }).limit(2000)
      .then(({ data }) => { setRangeEvents((data??[]) as TelaoEvent[]); setRangeFetching(false) })
  },[filter.start, filter.end])

  useEffect(()=>{
    if(!latest) return
    if(vf&&latest.vertical!==vf){ clearLatest(); return }
    setCeleb(latest); clearLatest()
  },[latest])

  return (
    <div
      style={{
        background:TH.bg, minHeight:'100vh', color:TH.text,
        fontFamily:"'Space Grotesk',sans-serif", position:'relative', overflowX:'hidden',
        '--tw-card'      : TH.card,
        '--tw-border'    : TH.border,
        '--tw-text'      : TH.text,
        '--tw-muted'     : TH.muted,
        '--tw-muted-text': TH.mutedText,
        '--tw-shadow'    : isDark ? 'none' : '0 2px 12px rgba(109,40,217,.08)',
      } as React.CSSProperties}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:rgba(88,28,135,.1);}
        ::-webkit-scrollbar-thumb{background:rgba(168,85,247,.4);border-radius:999px;}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes cellPulse{0%{box-shadow:0 0 0 0 ${accent}88}70%{box-shadow:0 0 0 10px ${accent}00}100%{box-shadow:0 0 0 0 ${accent}00}}
        @media(max-width:960px){.tw-main{grid-template-columns:1fr!important;}.tw-vert{grid-template-columns:repeat(2,1fr)!important;}}
      `}</style>

      <div style={{position:'fixed',inset:0,background:isDark?'radial-gradient(ellipse at 20% 50%,rgba(88,28,135,.12),transparent 50%)':'radial-gradient(ellipse at 10% 30%,rgba(139,92,246,.15),transparent 50%)',pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'fixed',inset:0,backgroundImage:isDark?'radial-gradient(rgba(168,85,247,.04) 1px,transparent 1px)':'radial-gradient(rgba(109,40,217,.12) 1px,transparent 1px)',backgroundSize:'32px 32px',pointerEvents:'none',zIndex:0}}/>

      {/* Header */}
      <div style={{position:'sticky',top:0,zIndex:40,background:isDark?'rgba(10,0,21,.9)':'rgba(237,233,254,.97)',backdropFilter:'blur(24px)',borderBottom:`1px solid ${TH.border}`,boxShadow:isDark?'none':'0 2px 20px rgba(109,40,217,.1)',padding:'10px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',rowGap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 8px #22c55e',animation:'pulse 2s ease-in-out infinite'}}/>
            <span style={{fontSize:10,fontWeight:900,color:'rgba(168,85,247,.7)',letterSpacing:'.16em',fontFamily:"'JetBrains Mono',monospace"}}>LIVE WALL</span>
            {vf&&<span style={{fontSize:10,fontWeight:900,color:accent,letterSpacing:'.1em',fontFamily:"'JetBrains Mono',monospace",transition:'color .3s'}}>· {VERTICALS[vf].short}</span>}
            {!isAdmin&&<span style={{fontSize:9,color:'#4a2d6b',fontFamily:"'JetBrains Mono',monospace"}}>· Suas vendas</span>}
          </div>

          <div style={{display:'flex',gap:5,flex:1,flexWrap:'wrap'}}>
            {(['geral',...visibleVerticals.map(v=>v.id)] as const).map((id)=>{
              const v=id==='geral'?null:VERTICALS[id as VerticalId]
              const active=id==='geral'?!vf:vf===id
              return (
                <motion.button key={id} whileTap={{scale:.96}} onClick={()=>setVf(v?v.id:null)}
                  style={{height:28,padding:'0 14px',borderRadius:8,border:`1px solid ${active?(v?.accent??'rgba(168,85,247,.5)')+'88':'rgba(255,255,255,.07)'}`,background:active?(v?.accent??'rgba(168,85,247,.5)')+'18':'transparent',color:active?(v?.accent??'#c4b5fd'):'#2d1b4e',fontSize:10,fontWeight:800,cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",transition:'all .15s'}}>
                  {v?v.short:'★ GERAL'}
                </motion.button>
              )
            })}
            {streak>=3&&<motion.span initial={{scale:0}} animate={{scale:1}} style={{height:28,padding:'0 14px',borderRadius:999,background:'linear-gradient(135deg,#f97316,#f59e0b)',fontSize:10,fontWeight:900,color:'#000',display:'inline-flex',alignItems:'center'}}>🔥 STREAK ×{streak}</motion.span>}
          </div>

          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <FilterBar filter={filter} onChange={setFilter} closers={closers} events={sourceEvents} isAdmin={isAdmin} activeVertical={vf} isDark={isDark}/>
            <motion.button whileTap={{scale:.95}} onClick={()=>{ if(!audioOn){initAudio();setAudio(true)}else setAudio(false) }}
              style={{width:34,height:34,borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:audioOn?'rgba(168,85,247,.12)':'rgba(255,255,255,.02)',color:audioOn?'#c4b5fd':'#2d1b4e',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {audioOn?<Volume2 size={13}/>:<VolumeX size={13}/>}
            </motion.button>
            <motion.button whileTap={{scale:.95}} onClick={refetch} style={{width:34,height:34,borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:'rgba(255,255,255,.02)',color:'#2d1b4e',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <RefreshCw size={13} style={{animation:(loading||rangeFetching)?'spin 1s linear infinite':'none'}}/>
            </motion.button>
            {isAdmin&&(
              <Link href="/telao/settings" style={{display:'flex',alignItems:'center',gap:5,height:34,padding:'0 12px',borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:'rgba(255,255,255,.02)',color:'#2d1b4e',fontSize:11,fontWeight:700,textDecoration:'none'}}>
                <Settings size={12}/> Meta
              </Link>
            )}
            <motion.button whileTap={{scale:.95}} onClick={()=>document.documentElement.requestFullscreen?.()} style={{width:34,height:34,borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:'rgba(255,255,255,.02)',color:'#2d1b4e',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Maximize2 size={13}/>
            </motion.button>
            <Clock isDark={isDark}/>
          </div>
        </div>
      </div>

      <div style={{position:'relative',zIndex:1}}><Ticker events={viewEvents}/></div>

      {/* Grid principal */}
      <div className="tw-main" style={{display:'grid',gridTemplateColumns:isAdmin?'minmax(0,1fr) 400px':'1fr',gap:16,padding:'16px 20px',position:'relative',zIndex:1}}>

        {/* Esquerda */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <HeroMetrics events={viewEvents} accent={accent} vf={vf} isDark={isDark}
            yesterdayRev={isAdmin?yesterdayRevAdmin:yesterdayRev}
            yesterdaySameHourRev={isAdmin?yesterdaySameHourRevAdmin:yesterdaySameHourRevUser}
            trend={isAdmin?trendAdmin:trendUser}/>

          {/* Painel acumulado — apenas consultor */}
          {!isAdmin && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(168,85,247,.2)',borderRadius:16,padding:'14px 18px',backdropFilter:'blur(8px)'}}>
                  <p style={{margin:'0 0 4px',fontSize:8,fontWeight:900,color:'rgba(168,85,247,.5)',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.12em'}}>💰 Hoje{vf?` · ${VERTICALS[vf].short}`:''}</p>
                  <p style={{margin:0,fontSize:22,fontWeight:900,color:'#c4b5fd',letterSpacing:'-0.03em',fontVariantNumeric:'tabular-nums'}}>{fmtBRL(todayRev)}</p>
                  <p style={{margin:'3px 0 0',fontSize:8,color:'#4a2d6b',fontFamily:"'JetBrains Mono',monospace"}}>{viewEvents.filter(e=>e.event_type==='sale').length}v hoje</p>
                </div>
                <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.15)',borderRadius:16,padding:'14px 18px',backdropFilter:'blur(8px)'}}>
                  <p style={{margin:'0 0 4px',fontSize:8,fontWeight:900,color:'rgba(168,85,247,.4)',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.12em'}}>📅 Ontem</p>
                  <p style={{margin:0,fontSize:22,fontWeight:900,color:'rgba(196,181,253,.7)',letterSpacing:'-0.03em',fontVariantNumeric:'tabular-nums'}}>{fmtBRL(yesterdayRev)}</p>
                </div>
                <div style={{background:'rgba(168,85,247,.06)',border:'1px solid rgba(168,85,247,.25)',borderRadius:16,padding:'14px 18px',backdropFilter:'blur(8px)'}}>
                  <p style={{margin:'0 0 4px',fontSize:8,fontWeight:900,color:'rgba(168,85,247,.5)',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.12em'}}>📊 Acumulado</p>
                  <p style={{margin:0,fontSize:22,fontWeight:900,color:'#e9d5ff',letterSpacing:'-0.03em',fontVariantNumeric:'tabular-nums'}}>{fmtBRL(accRev)}</p>
                  <p style={{margin:'3px 0 0',fontSize:8,color:'#7c3aed',fontFamily:"'JetBrains Mono',monospace"}}>{accCount}v total</p>
                </div>
              </div>
              {last7Days.some(d=>d.rev>0)&&(
                <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.12)',borderRadius:16,padding:'14px 16px',backdropFilter:'blur(8px)'}}>
                  <p style={{margin:'0 0 12px',fontSize:8,fontWeight:900,color:'rgba(168,85,247,.5)',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.12em'}}>📈 Últimos 7 dias</p>
                  <div style={{display:'flex',gap:5,alignItems:'flex-end',height:90}}>
                    {last7Days.map((d,i)=>{
                      const maxRev=Math.max(...last7Days.map(x=>x.rev),1), pct=(d.rev/maxRev)*100, isToday=i===6
                      return (
                        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:0}}>
                          <div style={{height:22,display:'flex',alignItems:'flex-end',justifyContent:'center',marginBottom:2}}>
                            {d.rev>0&&<span style={{fontSize:d.rev>=1000?7:8,fontWeight:isToday?900:600,color:isToday?accent:'rgba(168,85,247,.7)',fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap',lineHeight:1}}>
                              {d.rev>=1000?`R$${(d.rev/1000).toFixed(0)}k`:`R$${d.rev.toFixed(0)}`}
                            </span>}
                          </div>
                          <div style={{width:'100%',height:56,display:'flex',alignItems:'flex-end'}}>
                            <div style={{width:'100%',height:`${Math.max(pct,d.rev>0?10:2)}%`,borderRadius:'5px 5px 0 0',background:isToday?accent:d.rev>0?'rgba(168,85,247,.45)':'rgba(168,85,247,.12)',transition:'height .5s cubic-bezier(.4,0,.2,1)',minHeight:d.rev>0?5:1,boxShadow:isToday?`0 0 10px ${accent}50`:'none'}}/>
                          </div>
                          <span style={{fontSize:8,marginTop:4,color:isToday?accent:'rgba(168,85,247,.5)',fontFamily:"'JetBrains Mono',monospace",fontWeight:isToday?900:400}}>{d.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="tw-vert"><VerticalCards events={isAdmin?events:baseEvents} selected={vf} onSelect={v=>setVf(v)} isDark={isDark} verticals={visibleVerticals}/></div>

          {isAdmin&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <GoalBar period="day" periodKey={todayKey()} vertical={vf} current={todayRev} goals={goals} accent={accent} extra={{label:'Mês acumulado',value:monthRev}} isDark={isDark}/>
              <GoalBar period="month" periodKey={monthKey()} vertical={vf} current={monthRev} goals={goals} accent={accent} isDark={isDark}/>
            </div>
          )}

          {isAdmin && <MoneyLeftOnTable value={moneyLeftTotal} isDark={isDark}/>}

          {isAdmin && (
            <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.1)',borderRadius:20,padding:'14px 16px',backdropFilter:'blur(8px)'}}>
              <p style={{fontSize:9,fontWeight:800,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 12px',fontFamily:"'JetBrains Mono',monospace"}}>⏱ Batalha por hora</p>
              <HourlyChart events={viewEvents} closers={closers} byHubId={byHubId} accent={accent} pulseHour={pulseHour} isDark={isDark}/>
            </div>
          )}
        </div>

        {/* Direita — Feed + Ranking */}
        {isAdmin && <div style={{display:'flex',flexDirection:'column',gap:12,position:'sticky',top:76,height:'calc(100vh - 92px)'}}>
          <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.1)',borderRadius:20,padding:'14px 16px',flex:'0 0 62%',display:'flex',flexDirection:'column',overflow:'hidden',backdropFilter:'blur(8px)',minHeight:0}}>
            <p style={{fontSize:9,fontWeight:800,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 10px',fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>⚡ Feed ao vivo — {viewEvents.length} eventos</p>
            <EventFeed events={viewEvents} byId={byId} byHubId={byHubId}/>
          </div>
          <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.1)',borderRadius:20,padding:'14px 16px',flex:1,display:'flex',flexDirection:'column',overflow:'hidden',backdropFilter:'blur(8px)',minHeight:0}}>
            <p style={{fontSize:9,fontWeight:800,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 10px',fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>🏆 Ranking{vf?` ${VERTICALS[vf].short}`:''}</p>
            <Ranking stats={stats} accent={accent}/>
          </div>
        </div>}
      </div>

      <AnimatePresence mode="wait">
        {celeb&&<Celebration key={celeb.id} ev={celeb} byId={byId} byHubId={byHubId} onDone={()=>setCeleb(null)}/>}
      </AnimatePresence>
    </div>
  )
}

export function LiveWall({ isAdmin, userCloserId, userHubspotId, userTeam }: Props) {
  return <LiveDataProvider><LiveWallInner isAdmin={isAdmin} userCloserId={userCloserId} userHubspotId={userHubspotId} userTeam={userTeam}/></LiveDataProvider>
}
