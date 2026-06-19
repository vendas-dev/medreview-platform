'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import { Maximize2, Settings, RefreshCw, SlidersHorizontal, X, Volume2, VolumeX, TrendingUp, Users, Award } from 'lucide-react'
import Link from 'next/link'
import { useLiveData, LiveDataProvider } from '@/hooks/useLiveData'
import { VERTICALS, VERTICAL_LIST, GOLD, VerticalId, FilterState, EMPTY_FILTER, Closer, TelaoEvent, CloserStats } from '@/lib/telao/types'
import { computeCloserStats, computeHourBuckets, fmtBRL, todayKey, monthKey, initials, timeAgo } from '@/lib/telao/format'

// ── Sistema de sons ───────────────────────────────────────────
let _audioCtx: AudioContext | null = null
let _audioReady = false
function initAudio() {
  if (_audioCtx) { _audioReady = true; return }
  _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  _audioReady = true
}
function playTone(f: number, dur: number, type: OscillatorType = 'sine', gain = 0.25) {
  if (!_audioCtx || !_audioReady) return
  try {
    const o = _audioCtx.createOscillator(), g = _audioCtx.createGain()
    o.connect(g); g.connect(_audioCtx.destination)
    o.type = type; o.frequency.setValueAtTime(f, _audioCtx.currentTime)
    g.gain.setValueAtTime(gain, _audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + dur)
    o.start(); o.stop(_audioCtx.currentTime + dur)
  } catch {}
}
const playSale = () => [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,.18,'triangle',.3), i*75))
const playCert = () => [523,523,784,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,.22,'triangle',.28), i*85))

// ── Confete ───────────────────────────────────────────────────
function Confete({ color }: { color: string }) {
  const ps = useMemo(() => Array.from({length:90},(_,i)=>({
    x:Math.random()*100, y:-5-Math.random()*15,
    s:Math.random()*10+4, delay:Math.random()*1.5, dur:2.5+Math.random()*2,
    dx:(Math.random()-.5)*25,
    c:[color,'#c4b5fd',GOLD,'#fff','#a855f7'][i%5]
  })),[color])
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:999}}>
      {ps.map((p,i)=>(
        <motion.div key={i}
          initial={{x:`${p.x}vw`,y:`${p.y}vh`,rotate:0,opacity:1}}
          animate={{x:`${p.x+p.dx}vw`,y:'110vh',rotate:720,opacity:0}}
          transition={{duration:p.dur,delay:p.delay,ease:'linear'}}
          style={{position:'absolute',width:p.s,height:p.s,background:p.c,borderRadius:p.s<6?2:'50%'}}/>
      ))}
    </div>
  )
}

// ── Avatar do closer ──────────────────────────────────────────
function Avatar({ closer, name, size=40, rank }: { closer:Closer|null; name:string; size?:number; rank?:number }) {
  const col = closer?.color ?? '#7c3aed'
  const medals = ['🥇','🥈','🥉']
  const halos  = ['#FFD700','#C0C0C0','#CD7F32']
  return (
    <div style={{position:'relative',flexShrink:0}}>
      <div style={{width:size,height:size,borderRadius:'50%',background:`linear-gradient(135deg,${col},${col}99)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.38,fontWeight:900,color:'#fff',fontFamily:"'Space Grotesk',sans-serif",border:rank!==undefined&&rank<3?`2px solid ${halos[rank]}`:`1.5px solid ${col}44`,boxShadow:rank!==undefined&&rank<3?`0 0 ${size*.8}px ${halos[rank]}44`:`0 0 ${size*.4}px ${col}33`}}>
        {initials(name)}
      </div>
      {rank!==undefined&&rank<3&&<span style={{position:'absolute',top:-4,right:-4,fontSize:Math.max(10,size*.3)}}>{medals[rank]}</span>}
    </div>
  )
}

// ── Número animado ────────────────────────────────────────────
function AnimatedNumber({ value, prefix='', className='' }: { value:number; prefix?:string; className?:string }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const start = prev.current, end = value, dur = 800, startTime = Date.now()
    prev.current = value
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / dur, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * ease)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  const formatted = prefix === 'R$'
    ? fmtBRL(display)
    : Math.round(display).toString()
  return <span className={className}>{formatted}</span>
}

// ── Relógio ───────────────────────────────────────────────────
function Clock() {
  const [t,setT]=useState(''); const [d,setD]=useState('')
  useEffect(()=>{
    const tick=()=>{ const n=new Date()
      setT(n.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
      setD(n.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}))
    }; tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id)
  },[])
  return (
    <div suppressHydrationWarning style={{textAlign:'right'}}>
      <p style={{fontSize:22,fontWeight:900,color:'#e9d5ff',margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.06em'}}>{t}</p>
      <p style={{fontSize:10,color:'#6b21a8',margin:0,fontFamily:"'Space Grotesk',sans-serif",textTransform:'capitalize'}}>{d}</p>
    </div>
  )
}

// ── Card de métrica hero ──────────────────────────────────────
function HeroMetrics({ events, accent, vf }: { events:TelaoEvent[]; accent:string; vf:VerticalId|null }) {
  const sales   = events.filter(e=>e.event_type==='sale')
  const certs   = events.filter(e=>e.event_type==='ambassador_certified')
  const revenue = sales.reduce((s,e)=>s+(e.value??0),0)
  const vert    = vf ? VERTICALS[vf] : null

  return (
    <div style={{
      background:'linear-gradient(135deg,rgba(88,28,135,.35) 0%,rgba(59,7,100,.25) 50%,rgba(15,3,25,.4) 100%)',
      border:'1px solid rgba(168,85,247,.25)',
      borderRadius:24,
      padding:'24px 28px',
      position:'relative',
      overflow:'hidden',
      backdropFilter:'blur(20px)',
      boxShadow:'0 0 60px rgba(88,28,135,.2), inset 0 1px 0 rgba(255,255,255,.06)',
    }}>
      {/* Glow radial de fundo */}
      <div style={{position:'absolute',top:-60,right:-60,width:240,height:240,borderRadius:'50%',background:`radial-gradient(${accent}22,transparent 70%)`,pointerEvents:'none'}}/>

      {/* Mascote da vertical */}
      {vert && (
        <motion.img src={vert.mascot} alt={vert.label}
          initial={{opacity:0,scale:.8,x:20}} animate={{opacity:1,scale:1,x:0}}
          transition={{type:'spring',stiffness:220,damping:18}}
          style={{position:'absolute',right:16,bottom:0,height:130,objectFit:'contain',filter:`drop-shadow(0 0 20px ${accent}66)`,pointerEvents:'none'}}/>
      )}
      {!vert && (
        <div style={{position:'absolute',right:24,top:'50%',transform:'translateY(-50%)',fontSize:64,opacity:.12}}>⭐</div>
      )}

      <div style={{position:'relative',zIndex:1}}>
        <p style={{fontSize:10,fontWeight:800,color:'#7c3aed',textTransform:'uppercase',letterSpacing:'.12em',margin:'0 0 6px',fontFamily:"'JetBrains Mono',monospace"}}>
          {vert ? `${vert.label} · Hoje` : 'Geral · Hoje'}
        </p>
        <AnimatedNumber value={revenue} prefix="R$"
          className="" />
        <p style={{fontSize:44,fontWeight:900,color:accent,margin:'0 0 20px',fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-0.03em',lineHeight:1}}>
          {fmtBRL(revenue)}
        </p>

        <div style={{display:'flex',gap:28}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:10,background:'rgba(168,85,247,.15)',border:'1px solid rgba(168,85,247,.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <TrendingUp size={15} style={{color:'#a855f7'}}/>
            </div>
            <div>
              <p style={{fontSize:20,fontWeight:900,color:'#e9d5ff',margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{sales.length}</p>
              <p style={{fontSize:9,color:'#6b21a8',margin:0,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Vendas</p>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:10,background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Award size={15} style={{color:GOLD}}/>
            </div>
            <div>
              <p style={{fontSize:20,fontWeight:900,color:GOLD,margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{certs.length}</p>
              <p style={{fontSize:9,color:'#6b21a8',margin:0,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Embaixadores</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Cards das verticais ───────────────────────────────────────
function VerticalCards({ events, selected, onSelect }: { events:TelaoEvent[]; selected:VerticalId|null; onSelect:(v:VerticalId|null)=>void }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
      {VERTICAL_LIST.map(v=>{
        const count   = events.filter(e=>e.vertical===v.id).length
        const revenue = events.filter(e=>e.vertical===v.id&&e.event_type==='sale').reduce((s,e)=>s+(e.value??0),0)
        const active  = selected===v.id
        return (
          <motion.button key={v.id}
            whileHover={{scale:1.02}} whileTap={{scale:.98}}
            onClick={()=>onSelect(active?null:v.id)}
            style={{
              background:active?`linear-gradient(135deg,${v.accent}25,${v.accent}10)`:'rgba(255,255,255,.02)',
              border:`1.5px solid ${active?v.accent+'66':'rgba(255,255,255,.06)'}`,
              borderRadius:18,padding:'14px 14px 8px',cursor:'pointer',textAlign:'left',
              position:'relative',overflow:'hidden',backdropFilter:'blur(8px)',
              boxShadow:active?`0 0 24px ${v.glow},inset 0 1px 0 rgba(255,255,255,.06)`:'none',
              transition:'all .2s',
            }}>
            {/* Mascote mini */}
            <img src={v.mascot} alt={v.label}
              style={{position:'absolute',right:-10,bottom:-6,height:72,objectFit:'contain',opacity:active?.9:.35,filter:`drop-shadow(0 0 8px ${v.accent}44)`,transition:'opacity .2s',pointerEvents:'none'}}/>
            <div style={{position:'relative',zIndex:1}}>
              <span style={{fontSize:9,fontWeight:800,color:active?v.accent:'#4a2d6b',letterSpacing:'.1em',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase'}}>{v.short}</span>
              <p style={{fontSize:16,fontWeight:900,color:active?v.accent:'#9ca3af',margin:'4px 0 6px',fontFamily:"'Space Grotesk',sans-serif",fontVariantNumeric:'tabular-nums',letterSpacing:'-.01em'}}>
                {fmtBRL(revenue)}
              </p>
              <p style={{fontSize:10,color:active?v.accent+'aa':'#374151',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>
                {count}v · {v.label.split('-')[0]}
              </p>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── GoalBar ───────────────────────────────────────────────────
function GoalBar({ period, periodKey, vertical, current, goals, accent, extra }: {
  period:'day'|'month'; periodKey:string; vertical:string|null; current:number; goals:any[]; accent:string; extra?:{label:string;value:number}
}) {
  const goal   = goals.find(g=>g.period===period&&g.period_key===periodKey&&g.vertical===vertical)
  const target = goal?.target_value??0
  const pct    = target>0?Math.min((current/target)*100,100):0
  const done   = pct>=100

  return (
    <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(168,85,247,.1)',borderRadius:18,padding:'16px 18px',backdropFilter:'blur(8px)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <p style={{fontSize:9,fontWeight:800,color:'#4a2d6b',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 4px',fontFamily:"'JetBrains Mono',monospace"}}>{period==='day'?'Meta do Dia':'Meta do Mês'}</p>
          {extra&&<p style={{fontSize:9,color:'#3b1d6e',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{extra.label}: {fmtBRL(extra.value)}</p>}
        </div>
        <div style={{textAlign:'right'}}>
          <p style={{fontSize:22,fontWeight:900,color:done?'#22c55e':accent,margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em'}}>{fmtBRL(current)}</p>
          {target>0&&<p style={{fontSize:10,color:'#3b1d6e',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>/ {fmtBRL(target)}</p>}
        </div>
      </div>

      <div style={{height:5,background:'rgba(168,85,247,.1)',borderRadius:999,overflow:'hidden',marginBottom:8}}>
        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.9,ease:'easeOut'}}
          style={{height:'100%',borderRadius:999,background:done?'linear-gradient(90deg,#22c55e,#16a34a)':`linear-gradient(90deg,${accent}66,${accent})`,boxShadow:`0 0 8px ${done?'#22c55e66':accent+'44'}`}}/>
      </div>

      <p style={{fontSize:10,color:done?'#22c55e':'#3b1d6e',margin:0,fontFamily:"'JetBrains Mono',monospace",fontWeight:done?800:400}}>
        {done?'✅ META BATIDA!':target>0?`${pct.toFixed(0)}% — faltam ${fmtBRL(target-current)}`:'— sem meta'}
      </p>
    </div>
  )
}

// ── EventFeed ─────────────────────────────────────────────────
function EventFeed({ events, closers }: { events:TelaoEvent[]; closers:Closer[] }) {
  const byId = Object.fromEntries(closers.map(c=>[c.id,c]))
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6,overflowY:'auto',flex:1,paddingRight:2}}>
      <AnimatePresence initial={false}>
        {events.slice(0,16).map(ev=>{
          const closer = ev.closer_id?byId[ev.closer_id]:null
          const name   = ev.is_self_checkout?'Self Checkout':(closer?.name??ev.closer_name??'?')
          const v      = VERTICALS[ev.vertical]
          const isSale = ev.event_type==='sale'
          const isAmb  = ev.sold_by_ambassador || ev.seller_type==='ambassador'
          return (
            <motion.div key={ev.id}
              initial={{opacity:0,x:20,height:0}} animate={{opacity:1,x:0,height:'auto'}} exit={{opacity:0,height:0}}
              transition={{type:'spring',stiffness:280,damping:24}}
              style={{
                background:'rgba(255,255,255,.03)',
                border:`1px solid rgba(255,255,255,.06)`,
                borderLeft:`3px solid ${v.accent}`,
                borderRadius:12,padding:'10px 12px',
                display:'flex',alignItems:'center',gap:10,overflow:'hidden',
                backdropFilter:'blur(4px)',
              }}>
              <Avatar closer={closer} name={name} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                  <span style={{fontSize:8,fontWeight:800,padding:'2px 6px',borderRadius:5,background:v.accent+'22',color:v.accent,fontFamily:"'JetBrains Mono',monospace"}}>{v.short}</span>
                  {isSale&&<span style={{fontSize:8,color:'#4a2d6b',fontFamily:"'JetBrains Mono',monospace"}}>💰 VENDA</span>}
                  {!isSale&&<span style={{fontSize:8,color:GOLD,fontFamily:"'JetBrains Mono',monospace"}}>🎓 EMBAIXADOR</span>}
                  {isAmb&&<span style={{fontSize:8,color:'#22c55e',fontFamily:"'JetBrains Mono',monospace"}}>🌟 AMB</span>}
                </div>
                <p style={{fontSize:12,fontWeight:700,color:'#e9d5ff',margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {isSale?ev.lead_name:ev.ambassador_name}
                </p>
                <p style={{fontSize:9,color:'#4a2d6b',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'JetBrains Mono',monospace"}}>
                  {name.split(' ')[0]} · {timeAgo(ev.occurred_at)}
                </p>
              </div>
              {isSale&&ev.value&&(
                <span style={{fontSize:14,fontWeight:900,color:v.accent,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",flexShrink:0}}>
                  {fmtBRL(ev.value)}
                </span>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
      {events.length===0&&(
        <div style={{textAlign:'center',padding:'40px 0',color:'#2d1b4e'}}>
          <p style={{fontSize:32}}>⚡</p>
          <p style={{fontSize:11,marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>Aguardando eventos...</p>
        </div>
      )}
    </div>
  )
}

// ── Ranking ───────────────────────────────────────────────────
function Ranking({ stats, accent }: { stats:CloserStats[]; accent:string }) {
  const max = stats[0]?.revenue??1
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6,overflowY:'auto',flex:1}}>
      {stats.slice(0,8).map((s,i)=>{
        const pct  = max>0?(s.revenue/max)*100:0
        const top3 = i<3
        const halos=['#FFD700','#C0C0C0','#CD7F32']
        return (
          <motion.div key={s.closer?.id??s.name}
            initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
            transition={{delay:i*.05,type:'spring',stiffness:220,damping:20}}
            style={{
              background:top3?`linear-gradient(135deg,${halos[i]}08,rgba(255,255,255,.02))`:'rgba(255,255,255,.02)',
              border:`1px solid ${top3?halos[i]+'22':'rgba(255,255,255,.05)'}`,
              borderRadius:14,padding:'10px 14px',position:'relative',overflow:'hidden',
              backdropFilter:'blur(8px)',
            }}>
            <div style={{position:'absolute',inset:0,width:`${pct}%`,background:top3?`${halos[i]}06`:'rgba(168,85,247,.03)',borderRadius:14,transition:'width .6s ease'}}/>
            <div style={{position:'relative',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:top3?20:13,width:28,textAlign:'center',fontWeight:900,color:top3?halos[i]:'#2d1b4e',fontFamily:top3?'inherit':"'JetBrains Mono',monospace",flexShrink:0}}>
                {top3?['🥇','🥈','🥉'][i]:`#${i+1}`}
              </span>
              <Avatar closer={s.closer} name={s.name} size={top3?40:32} rank={i}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:top3?14:12,fontWeight:800,color:top3?'#f3e8ff':'#9ca3af',margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Space Grotesk',sans-serif"}}>
                  {s.name} {s.isAmbassador&&<span style={{fontSize:9,color:'#22c55e'}}>🌟</span>}
                </p>
                <p style={{fontSize:9,color:'#2d1b4e',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>
                  {s.sales}v{s.certs>0?` · ${s.certs}★`:''}
                </p>
              </div>
              <span style={{fontSize:top3?16:13,fontWeight:900,color:top3?accent:'#4a2d6b',fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",flexShrink:0}}>
                {fmtBRL(s.revenue)}
              </span>
            </div>
          </motion.div>
        )
      })}
      {stats.length===0&&(
        <div style={{textAlign:'center',padding:'32px 0',color:'#2d1b4e'}}>
          <p style={{fontSize:24}}>🏆</p>
          <p style={{fontSize:11,marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>Sem dados ainda</p>
        </div>
      )}
    </div>
  )
}

// ── HourlyChart ───────────────────────────────────────────────
function HourlyChart({ events, closers, accent }: { events:TelaoEvent[]; closers:Closer[]; accent:string }) {
  const byId    = Object.fromEntries(closers.map(c=>[c.id,c]))
  const buckets = computeHourBuckets(events, byId)
  const max     = Math.max(...buckets.map(b=>b.topRevenue),1)
  const ref     = useRef<HTMLDivElement>(null)
  useEffect(()=>{ if(ref.current) ref.current.scrollLeft=ref.current.scrollWidth },[])

  return (
    <div ref={ref} style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none'}}>
      {buckets.map((b,i)=>{
        const pct   = (b.topRevenue/max)*100
        const empty = b.total===0
        const now   = i===buckets.length-1
        return (
          <div key={b.hourIso} style={{flexShrink:0,width:78,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div style={{
              background:now?`rgba(168,85,247,.12)`:'rgba(255,255,255,.02)',
              border:`1px solid ${now?'rgba(168,85,247,.3)':'rgba(255,255,255,.05)'}`,
              borderRadius:14,width:'100%',minHeight:76,padding:'8px 6px',
              display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              opacity:empty?.25:1,backdropFilter:'blur(4px)',
              boxShadow:now?'0 0 16px rgba(168,85,247,.15)':'none',
            }}>
              {!empty&&b.topCloser&&(
                <>
                  <Avatar closer={b.topCloser} name={b.topName} size={26} rank={0}/>
                  <p style={{fontSize:8,color:'#c4b5fd',fontWeight:700,margin:0,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%',padding:'0 2px',fontFamily:"'Space Grotesk',sans-serif"}}>{b.topName.split(' ')[0]}</p>
                  <p style={{fontSize:8,color:accent,margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(b.topRevenue)}</p>
                  <span style={{fontSize:8,color:'#2d1b4e',fontFamily:"'JetBrains Mono',monospace"}}>{b.total}v</span>
                </>
              )}
              {empty&&<span style={{fontSize:18,color:'#1a0533'}}>—</span>}
            </div>
            <div style={{height:36,width:'68%',background:'rgba(168,85,247,.07)',borderRadius:6,overflow:'hidden',display:'flex',alignItems:'flex-end'}}>
              <div style={{width:'100%',height:`${pct}%`,background:empty?'transparent':`linear-gradient(0deg,${accent},${accent}44)`,borderRadius:6,transition:'height .5s ease'}}/>
            </div>
            <span style={{fontSize:9,color:now?accent:'#2d1b4e',fontFamily:"'JetBrains Mono',monospace",fontWeight:now?800:400}}>{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Ticker ────────────────────────────────────────────────────
function Ticker({ events }: { events:TelaoEvent[] }) {
  const sales = events.filter(e=>e.event_type==='sale'&&e.value).slice(0,20)
  if(!sales.length) return null
  const items=[...sales,...sales]
  return (
    <div style={{background:'rgba(88,28,135,.15)',borderTop:'1px solid rgba(168,85,247,.1)',overflow:'hidden',height:26,display:'flex',alignItems:'center'}}>
      <div style={{display:'flex',animation:'ticker 40s linear infinite',whiteSpace:'nowrap'}}>
        {items.map((ev,i)=>{
          const v=VERTICALS[ev.vertical]
          return(
            <span key={`${ev.id}-${i}`} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'0 20px',borderRight:'1px solid rgba(168,85,247,.1)',fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>
              <span style={{color:v.accent,fontWeight:700}}>{v.short}</span>
              <span style={{color:'#4a2d6b'}}>{ev.lead_name}</span>
              <span style={{color:GOLD,fontVariantNumeric:'tabular-nums',fontWeight:700}}>{fmtBRL(ev.value!)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Celebration overlay ───────────────────────────────────────
function Celebration({ ev, closer, onDone }: { ev:TelaoEvent; closer:Closer|null; onDone:()=>void }) {
  const [count, setCount] = useState(0)
  const v     = VERTICALS[ev.vertical]
  const isSale= ev.event_type==='sale'
  const name  = ev.is_self_checkout?'Self Checkout':(closer?.name??ev.closer_name??'?')
  const target= ev.value??0

  useEffect(()=>{
    if(isSale){ playSale(); let c=0; const step=target/60; const id=setInterval(()=>{ c=Math.min(c+step,target); setCount(Math.floor(c)); if(c>=target)clearInterval(id) },16) }
    else playCert()
    const t=setTimeout(onDone,7000); return()=>clearTimeout(t)
  },[])

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(ellipse at 60% 40%,${v.accent}20 0%,rgba(13,0,21,.96) 65%)`,backdropFilter:'blur(14px)'}}>
      <Confete color={v.accent}/>

      <motion.div initial={{scale:.7,y:40}} animate={{scale:1,y:0}} exit={{scale:.9,opacity:0}}
        transition={{type:'spring',stiffness:200,damping:20}}
        style={{textAlign:'center',maxWidth:580,padding:'0 40px',position:'relative',zIndex:1001}}>

        {/* Mascote grande */}
        <motion.img src={v.mascot} alt={v.label}
          initial={{scale:0,rotate:-10}} animate={{scale:1,rotate:0}}
          transition={{type:'spring',stiffness:240,damping:16,delay:.1}}
          style={{height:160,objectFit:'contain',margin:'0 auto 20px',display:'block',filter:`drop-shadow(0 0 40px ${v.accent}88)`}}/>

        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}}
          style={{fontSize:11,fontWeight:800,color:v.accent,textTransform:'uppercase',letterSpacing:'.16em',marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>
          {isSale?'💰 VENDA FECHADA!':'🎓 EMBAIXADOR CERTIFICADO!'}
        </motion.p>

        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.25}}
          style={{fontSize:38,fontWeight:900,color:'#f3e8ff',marginBottom:8,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em',lineHeight:1.1}}>
          {isSale?name:ev.ambassador_name}
        </motion.p>

        <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.3}}
          style={{fontSize:15,color:'#7c3aed',marginBottom:30,fontFamily:"'Space Grotesk',sans-serif"}}>
          {isSale?`${ev.lead_name} · ${ev.product}`:`${ev.college}${ev.class?` · Turma ${ev.class}`:''}`}
        </motion.p>

        {isSale&&(
          <motion.p initial={{scale:.4,opacity:0}} animate={{scale:1,opacity:1}}
            transition={{type:'spring',stiffness:300,damping:14,delay:.4}}
            style={{fontSize:72,fontWeight:900,color:v.accent,fontVariantNumeric:'tabular-nums',lineHeight:1,fontFamily:"'Space Grotesk',sans-serif",textShadow:`0 0 60px ${v.accent}88`,margin:0}}>
            {fmtBRL(count)}
          </motion.p>
        )}

        {/* Badge da vertical */}
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.55}}
          style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:24,padding:'8px 20px',borderRadius:999,background:`${v.accent}18`,border:`1px solid ${v.accent}33`}}>
          <img src={v.mascot} alt="" style={{height:20,objectFit:'contain'}}/>
          <span style={{fontSize:12,fontWeight:700,color:v.accent,fontFamily:"'JetBrains Mono',monospace"}}>{v.label}</span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// ── FilterBar ─────────────────────────────────────────────────
function FilterBar({ filter, onChange, closers }: { filter:FilterState; onChange:(f:FilterState)=>void; closers:Closer[] }) {
  const [open,setOpen]=useState(false)
  const [draft,setDraft]=useState(filter)
  const count=(filter.start?1:0)+(filter.end?1:0)+filter.closerKeys.length

  return (
    <div style={{position:'relative'}}>
      <motion.button whileTap={{scale:.97}}
        onClick={()=>{ setDraft(filter); setOpen(o=>!o) }}
        style={{display:'flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:10,border:`1px solid ${count>0?'rgba(168,85,247,.5)':'rgba(255,255,255,.08)'}`,background:count>0?'rgba(168,85,247,.12)':'rgba(255,255,255,.03)',color:count>0?'#c4b5fd':'#4a2d6b',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",transition:'all .15s',backdropFilter:'blur(4px)'}}>
        <SlidersHorizontal size={13}/> Filtros
        {count>0&&<span style={{background:'#7c3aed',color:'#fff',fontSize:9,borderRadius:999,padding:'1px 6px',fontWeight:900}}>{count}</span>}
      </motion.button>

      <AnimatePresence>
        {open&&(
          <>
            <div style={{position:'fixed',inset:0,zIndex:50}} onClick={()=>setOpen(false)}/>
            <motion.div initial={{opacity:0,y:-6,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6}}
              style={{position:'absolute',top:40,right:0,zIndex:100,width:300,background:'rgba(13,0,21,.95)',border:'1px solid rgba(168,85,247,.2)',borderRadius:18,padding:20,boxShadow:'0 24px 60px rgba(0,0,0,.7)',backdropFilter:'blur(20px)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
                <span style={{fontSize:13,fontWeight:800,color:'#c4b5fd',fontFamily:"'Space Grotesk',sans-serif"}}>Filtros</span>
                <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',color:'#2d1b4e',cursor:'pointer'}}><X size={14}/></button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                {(['start','end'] as const).map(k=>(
                  <div key={k}>
                    <label style={{fontSize:9,color:'#2d1b4e',display:'block',marginBottom:4,fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>{k==='start'?'De':'Até'}</label>
                    <input type="date" value={draft[k]??''} onChange={e=>setDraft(p=>({...p,[k]:e.target.value||null}))}
                      style={{width:'100%',height:34,padding:'0 8px',borderRadius:9,border:'1px solid rgba(168,85,247,.2)',background:'rgba(168,85,247,.06)',color:'#c4b5fd',fontSize:11,fontFamily:"'JetBrains Mono',monospace",outline:'none',colorScheme:'dark'}}/>
                  </div>
                ))}
              </div>
              <p style={{fontSize:9,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>Closers</p>
              <div style={{maxHeight:160,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
                {[{id:'self',name:'↻ Self Checkout',color:'#4a2d6b'},...closers].map(c=>{
                  const sel=draft.closerKeys.includes(c.id)
                  return (
                    <label key={c.id} onClick={()=>setDraft(p=>({...p,closerKeys:sel?p.closerKeys.filter(k=>k!==c.id):[...p.closerKeys,c.id]}))}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderRadius:8,cursor:'pointer',background:sel?'rgba(168,85,247,.1)':'transparent',transition:'background .12s'}}>
                      <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${sel?'#a855f7':'rgba(168,85,247,.2)'}`,background:sel?'#a855f7':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {sel&&<span style={{fontSize:8,color:'#fff',fontWeight:900}}>✓</span>}
                      </div>
                      <span style={{width:7,height:7,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                      <span style={{fontSize:11,color:sel?'#c4b5fd':'#4a2d6b',fontFamily:"'Space Grotesk',sans-serif"}}>{c.name}</span>
                    </label>
                  )
                })}
              </div>
              <div style={{display:'flex',gap:8,marginTop:14}}>
                <button onClick={()=>{ const e=EMPTY_FILTER; setDraft(e); onChange(e); setOpen(false) }} style={{flex:1,height:32,borderRadius:9,border:'1px solid rgba(168,85,247,.2)',background:'transparent',color:'#2d1b4e',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif"}}>× Limpar</button>
                <button onClick={()=>{ onChange(draft); setOpen(false) }} style={{flex:2,height:32,borderRadius:9,border:'none',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif"}}>Aplicar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── LiveWallInner ─────────────────────────────────────────────
function LiveWallInner({ isAdmin }: { isAdmin:boolean }) {
  const { events, closers, goals, monthRevenue, latest, clearLatest, loading, refetch } = useLiveData()
  const [vf,    setVf]    = useState<VerticalId|null>(null)
  const [filter,setFilter]= useState<FilterState>(EMPTY_FILTER)
  const [audioOn,setAudio]= useState(false)
  const [celeb, setCeleb] = useState<TelaoEvent|null>(null)

  const byId   = useMemo(()=>Object.fromEntries(closers.map(c=>[c.id,c])),[closers])
  const accent = vf?VERTICALS[vf].accent:'#a855f7'

  const viewEvents = useMemo(()=>{
    let evs=events
    if(vf)           evs=evs.filter(e=>e.vertical===vf)
    if(filter.start) evs=evs.filter(e=>e.occurred_at>=filter.start!)
    if(filter.end)   evs=evs.filter(e=>e.occurred_at<=filter.end!+'T23:59:59')
    if(filter.closerKeys.length>0)
      evs=evs.filter(e=>e.is_self_checkout?filter.closerKeys.includes('self'):filter.closerKeys.includes(e.closer_id??''))
    return evs
  },[events,vf,filter])

  const stats     = useMemo(()=>computeCloserStats(viewEvents,closers),[viewEvents,closers])
  const todayRev  = useMemo(()=>viewEvents.filter(e=>e.event_type==='sale').reduce((s,e)=>s+(e.value??0),0),[viewEvents])
  const monthRev  = vf?(monthRevenue.byVertical[vf]??0):monthRevenue.overall
  const streak    = viewEvents.filter(e=>Date.now()-new Date(e.occurred_at).getTime()<90000).length

  useEffect(()=>{
    if(!latest) return
    if(vf&&latest.vertical!==vf){ clearLatest(); return }
    setCeleb(latest); clearLatest()
  },[latest])

  return (
    <div style={{background:'#0a0015',minHeight:'100vh',color:'#fff',fontFamily:"'Space Grotesk',sans-serif",position:'relative',overflowX:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(168,85,247,.3);border-radius:999px;}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @media(max-width:960px){.telao-main{grid-template-columns:1fr!important;}.telao-vert{grid-template-columns:repeat(2,1fr)!important;}}
      `}</style>

      {/* Fundo com noise texture e glow */}
      <div style={{position:'fixed',inset:0,background:'radial-gradient(ellipse at 20% 50%,rgba(88,28,135,.12) 0%,transparent 50%)',pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'fixed',inset:0,backgroundImage:'radial-gradient(rgba(168,85,247,.04) 1px,transparent 1px)',backgroundSize:'32px 32px',pointerEvents:'none',zIndex:0}}/>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{position:'sticky',top:0,zIndex:40,background:'rgba(10,0,21,.9)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(168,85,247,.12)',padding:'10px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',rowGap:8}}>
          {/* Dot + label */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 8px #22c55e',animation:'pulse 2s ease-in-out infinite'}}/>
            <span style={{fontSize:10,fontWeight:900,color:'rgba(168,85,247,.7)',letterSpacing:'.16em',fontFamily:"'JetBrains Mono',monospace"}}>LIVE WALL</span>
            {vf&&<span style={{fontSize:10,fontWeight:900,color:accent,letterSpacing:'.1em',fontFamily:"'JetBrains Mono',monospace",transition:'color .3s'}}>· {VERTICALS[vf].short}</span>}
          </div>

          {/* Chips */}
          <div style={{display:'flex',gap:5,flex:1,flexWrap:'wrap'}}>
            <motion.button whileTap={{scale:.96}} onClick={()=>setVf(null)}
              style={{height:28,padding:'0 14px',borderRadius:8,border:`1px solid ${!vf?'rgba(168,85,247,.5)':'rgba(255,255,255,.07)'}`,background:!vf?'rgba(168,85,247,.15)':'transparent',color:!vf?'#c4b5fd':'#2d1b4e',fontSize:10,fontWeight:800,cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",transition:'all .15s'}}>
              ★ GERAL
            </motion.button>
            {VERTICAL_LIST.map(v=>(
              <motion.button key={v.id} whileTap={{scale:.96}} onClick={()=>setVf(vf===v.id?null:v.id)}
                style={{height:28,padding:'0 14px',borderRadius:8,border:`1px solid ${vf===v.id?v.accent+'88':'rgba(255,255,255,.07)'}`,background:vf===v.id?v.accent+'18':'transparent',color:vf===v.id?v.accent:'#2d1b4e',fontSize:10,fontWeight:800,cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",transition:'all .15s'}}>
                {v.short}
              </motion.button>
            ))}
            {streak>=3&&(
              <motion.span initial={{scale:0}} animate={{scale:1}}
                style={{height:28,padding:'0 14px',borderRadius:999,background:'linear-gradient(135deg,#f97316,#f59e0b)',fontSize:10,fontWeight:900,color:'#000',display:'inline-flex',alignItems:'center'}}>
                🔥 STREAK ×{streak}
              </motion.span>
            )}
          </div>

          {/* Ações */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <FilterBar filter={filter} onChange={setFilter} closers={closers}/>
            <motion.button whileTap={{scale:.95}} onClick={()=>{ if(!audioOn){initAudio();setAudio(true)}else setAudio(false) }}
              style={{width:34,height:34,borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:audioOn?'rgba(168,85,247,.12)':'rgba(255,255,255,.02)',color:audioOn?'#c4b5fd':'#2d1b4e',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
              {audioOn?<Volume2 size={13}/>:<VolumeX size={13}/>}
            </motion.button>
            <motion.button whileTap={{scale:.95}} onClick={refetch}
              style={{width:34,height:34,borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:'rgba(255,255,255,.02)',color:'#2d1b4e',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <RefreshCw size={13} style={{animation:loading?'spin 1s linear infinite':'none'}}/>
            </motion.button>
            {isAdmin&&(
              <Link href="/telao/settings" style={{display:'flex',alignItems:'center',gap:5,height:34,padding:'0 12px',borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:'rgba(255,255,255,.02)',color:'#2d1b4e',fontSize:11,fontWeight:700,textDecoration:'none',backdropFilter:'blur(4px)'}}>
                <Settings size={12}/>
              </Link>
            )}
            <motion.button whileTap={{scale:.95}} onClick={()=>document.documentElement.requestFullscreen?.()}
              style={{width:34,height:34,borderRadius:10,border:'1px solid rgba(168,85,247,.15)',background:'rgba(255,255,255,.02)',color:'#2d1b4e',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Maximize2 size={13}/>
            </motion.button>
            <Clock/>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div style={{position:'relative',zIndex:1}}><Ticker events={viewEvents}/></div>

      {/* ── Layout principal ───────────────────────────────── */}
      <div className="telao-main" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 380px',gap:16,padding:'16px 20px',position:'relative',zIndex:1}}>

        {/* Coluna esquerda */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <HeroMetrics events={viewEvents} accent={accent} vf={vf}/>

          <div className="telao-vert"><VerticalCards events={events} selected={vf} onSelect={v=>setVf(v)}/></div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <GoalBar period="day" periodKey={todayKey()} vertical={vf} current={todayRev} goals={goals} accent={accent} extra={{label:'Mês acumulado',value:monthRev}}/>
            <GoalBar period="month" periodKey={monthKey()} vertical={vf} current={monthRev} goals={goals} accent={accent}/>
          </div>

          <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.1)',borderRadius:20,padding:'14px 16px',backdropFilter:'blur(8px)'}}>
            <p style={{fontSize:9,fontWeight:800,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 12px',fontFamily:"'JetBrains Mono',monospace"}}>⏱ Batalha por hora</p>
            <HourlyChart events={viewEvents} closers={closers} accent={accent}/>
          </div>
        </div>

        {/* Coluna direita */}
        <div style={{display:'flex',flexDirection:'column',gap:12,position:'sticky',top:76,height:'calc(100vh - 92px)'}}>
          <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.1)',borderRadius:20,padding:'14px 16px',flex:'0 0 50%',display:'flex',flexDirection:'column',overflow:'hidden',backdropFilter:'blur(8px)'}}>
            <p style={{fontSize:9,fontWeight:800,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 10px',fontFamily:"'JetBrains Mono',monospace"}}>⚡ Feed ao vivo</p>
            <EventFeed events={viewEvents} closers={closers}/>
          </div>
          <div style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(168,85,247,.1)',borderRadius:20,padding:'14px 16px',flex:1,display:'flex',flexDirection:'column',overflow:'hidden',backdropFilter:'blur(8px)'}}>
            <p style={{fontSize:9,fontWeight:800,color:'#2d1b4e',textTransform:'uppercase',letterSpacing:'.1em',margin:'0 0 10px',fontFamily:"'JetBrains Mono',monospace"}}>🏆 Ranking{vf?` ${VERTICALS[vf].short}`:''}</p>
            <Ranking stats={stats} accent={accent}/>
          </div>
        </div>
      </div>

      {/* Celebration */}
      <AnimatePresence mode="wait">
        {celeb&&<Celebration key={celeb.id} ev={celeb} closer={celeb.closer_id?byId[celeb.closer_id]??null:null} onDone={()=>setCeleb(null)}/>}
      </AnimatePresence>
    </div>
  )
}

export function LiveWall({ isAdmin }:{ isAdmin:boolean }) {
  return <LiveDataProvider><LiveWallInner isAdmin={isAdmin}/></LiveDataProvider>
}
