'use client'
// ════════════════════════════════════════════════════════════════════════
// Animações do Telão Completo — COPIADAS LITERALMENTE de LiveWall.tsx (os
// números de linha de cada trecho estão nos comentários). Visual, som e
// tempo das celebrações são exatamente os do Telão ao vivo. Para não mexer
// no LiveWall (e não arriscar regressão), ficam duplicadas aqui.
// Única diferença de comportamento: a chave de "celebração já vista" é
// própria ('telao_completo_celebrated'), pra os dois telões não se calarem.
// ════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { VERTICALS, GOLD, VerticalId, Closer, TelaoEvent } from '@/lib/telao/types'
import { fmtBRL, initials } from '@/lib/telao/format'

// ── (copiado de LiveWall.tsx, linhas 12-27: persistência das celebrações já vistas) ──
// ── Persistência de celebrações já vistas ────────────────────────
// Sem isso, o Set fica só na memória do componente — toda vez que a página
// é recarregada (sair e voltar do telão), ele reseta e a celebração de meta
// já batida dispara de novo. Guardando em localStorage, sobrevive a
// navegação/recarregamento (nesse mesmo navegador).
const CELEBRATED_GOALS_KEY = 'telao_completo_celebrated'
export function loadCelebratedGoals(): Set<string> {
  try {
    const raw = localStorage.getItem(CELEBRATED_GOALS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
export function persistCelebratedGoal(key: string, set: Set<string>) {
  set.add(key)
  try { localStorage.setItem(CELEBRATED_GOALS_KEY, JSON.stringify([...set])) } catch {}
}

// ── (copiado de LiveWall.tsx, linhas 29-37: áudio) ──
// ── Áudio ────────────────────────────────────────────────────
let _ctx: AudioContext | null = null, _ready = false
export function initAudio() { if (_ctx) { _ready = true; return }; _ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); _ready = true }
function tone(f: number, d: number, type: OscillatorType = 'sine', g = .25) {
  if (!_ctx || !_ready) return
  try { const o = _ctx.createOscillator(), gn = _ctx.createGain(); o.connect(gn); gn.connect(_ctx.destination); o.type = type; o.frequency.setValueAtTime(f, _ctx.currentTime); gn.gain.setValueAtTime(g, _ctx.currentTime); gn.gain.exponentialRampToValueAtTime(.001, _ctx.currentTime + d); o.start(); o.stop(_ctx.currentTime + d) } catch {}
}
export const playSale = () => [523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f,.18,'triangle',.3), i*75))
export const playCert = () => [523,523,784,659,784,1047].forEach((f,i) => setTimeout(() => tone(f,.22,'triangle',.28), i*85))

// ── (copiado de LiveWall.tsx, linhas 39-47: confete) ──
// ── Confete ───────────────────────────────────────────────────
export function Confete({ color }: { color: string }) {
  const ps = useMemo(() => Array.from({length:80},(_,i) => ({ x:Math.random()*100, y:-5-Math.random()*15, s:Math.random()*10+4, delay:Math.random()*1.5, dur:2.5+Math.random()*2, dx:(Math.random()-.5)*25, c:[color,'#c4b5fd',GOLD,'#fff','#a855f7'][i%5] })),[color])
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:999}}>
      {ps.map((p,i) => <motion.div key={i} initial={{x:`${p.x}vw`,y:`${p.y}vh`,rotate:0,opacity:1}} animate={{x:`${p.x+p.dx}vw`,y:'110vh',rotate:720,opacity:0}} transition={{duration:p.dur,delay:p.delay,ease:'linear'}} style={{position:'absolute',width:p.s,height:p.s,background:p.c,borderRadius:p.s<6?2:'50%'}}/>)}
    </div>
  )
}

// ── (copiado de LiveWall.tsx, linhas 49-98: avatar) ──
// ── Avatar ─── CORRIGIDO: usa avatar_url quando disponível ────
export function Avatar({ closer, name, size=40, rank }: { closer:Closer|null; name:string; size?:number; rank?:number }) {
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

// ── (copiado de LiveWall.tsx, linhas 100-112: lookup de closer por hubspot_id) ──
// ── Helpers de lookup por hubspot_id ──────────────────────────
// A maioria dos eventos tem closer_id=null e só tem closer_hubspot_id.
// Essas funções garantem que sempre achamos o closer certo.
export function findCloser(
  closerId: string | null,
  hubspotId: string | null,
  byId: Record<string, Closer>,
  byHubId: Record<string, Closer>
): Closer | null {
  if (closerId && byId[closerId]) return byId[closerId]
  if (hubspotId && byHubId[hubspotId]) return byHubId[hubspotId]
  return null
}

// ── (copiado de LiveWall.tsx, linhas 114-135: CountUp) ──
// ── Relógio ───────────────────────────────────────────────────
// ── CountUp ─── conta do valor antigo até o novo, em vez de só "pular" ──
export function CountUp({ value, format, duration=700 }: { value:number; format:(v:number)=>string; duration?:number }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  useEffect(() => {
    const from = prevRef.current, to = value
    if (from === to) return
    prevRef.current = to
    const start = performance.now()
    let raf: number
    const step = (now:number) => {
      const t = Math.min((now-start)/duration, 1)
      const eased = 1 - Math.pow(1-t, 3)
      setDisplay(from + (to-from)*eased)
      if (t<1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{format(display)}</>
}

// ── (copiado de LiveWall.tsx, linhas 137-142: relógio) ──
// ── Clock ──────────────────────────────────────────────────────
export function Clock({ isDark=true }: { isDark?:boolean }) {
  const [t,setT]=useState(''); const [d,setD]=useState('')
  useEffect(()=>{ const tick=()=>{ const n=new Date(); setT(n.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})); setD(n.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})) }; tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id) },[])
  return <div suppressHydrationWarning style={{textAlign:'right'}}><p style={{fontSize:15,fontWeight:900,color:isDark?'#e9d5ff':'#4c1d95',margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'.06em'}}>{t}</p><p style={{fontSize:7,color:isDark?'#a78bfa':'#7c3aed',margin:0,textTransform:'capitalize',fontFamily:"'Space Grotesk',sans-serif"}}>{d}</p></div>
}

// ── (copiado de LiveWall.tsx, linhas 144-153: TrendBadge) ──
// ── Hero ─────────────────────────────────────────────────────
export function TrendBadge({ label, pct, isDark=true }: { label:string; pct:number|null; isDark?:boolean }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:800, color: up?'#16a34a':'#dc2626', fontFamily:"'JetBrains Mono',monospace" }}>
      {up?'▲':'▼'} {Math.abs(pct).toFixed(0)}% <span style={{ color:isDark?'rgba(196,181,253,.75)':'rgba(91,33,182,.8)', fontWeight:700 }}>{label}</span>
    </span>
  )
}

// ── (copiado de LiveWall.tsx, linhas 155-169: PaceThermometer) ──
// ── Termômetro de ritmo — 🟢 acima / 🟡 no ritmo / 🔴 abaixo ────
export function PaceThermometer({ status, isDark=true }: { status:'acima'|'no-ritmo'|'abaixo'|null; isDark?:boolean }) {
  if (!status) return null
  const cfg = {
    'acima':    { emoji:'🟢', label:'ACIMA DO RITMO', color:'#22c55e', bg:'rgba(34,197,94,.12)',  border:'rgba(34,197,94,.35)' },
    'no-ritmo': { emoji:'🟡', label:'NO RITMO',        color:'#eab308', bg:'rgba(234,179,8,.12)',  border:'rgba(234,179,8,.35)' },
    'abaixo':   { emoji:'🔴', label:'ABAIXO DO RITMO', color:'#ef4444', bg:'rgba(239,68,68,.12)',  border:'rgba(239,68,68,.35)' },
  }[status]
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:999,background:cfg.bg,border:`1px solid ${cfg.border}`}}>
      <span style={{fontSize:13}}>{cfg.emoji}</span>
      <span style={{fontSize:11,fontWeight:900,color:cfg.color,letterSpacing:'.1em',fontFamily:"'JetBrains Mono',monospace"}}>{cfg.label}</span>
    </div>
  )
}

// ── (copiado de LiveWall.tsx, linhas 360-373: smoothPath) ──
export function smoothPath(pts: {x:number;y:number}[]): string {
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

// ── (copiado de LiveWall.tsx, linhas 744-755: Ticker de vendas) ──
export function Ticker({ events }: { events:TelaoEvent[] }) {
  const sales=events.filter(e=>e.event_type==='sale'&&e.value).slice(0,20)
  if(!sales.length) return null
  const items=[...sales,...sales]
  return (
    <div style={{background:'rgba(88,28,135,.15)',borderTop:'1px solid rgba(168,85,247,.1)',overflow:'hidden',height:26,display:'flex',alignItems:'center'}}>
      <div style={{display:'flex',animation:'ticker 40s linear infinite',whiteSpace:'nowrap'}}>
        {items.map((ev,i)=>{ const v=VERTICALS[ev.vertical]; return <span key={`${ev.id}-${i}`} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'0 20px',borderRight:'1px solid rgba(168,85,247,.1)',fontFamily:"'JetBrains Mono',monospace",fontSize:10}}><span style={{color:v.accent,fontWeight:700}}>{v.short}</span><span style={{color:'#a898c9'}}>{ev.lead_name}</span><span style={{color:GOLD,fontVariantNumeric:'tabular-nums',fontWeight:700}}>{fmtBRL(ev.value!)}</span></span> })}
      </div>
    </div>
  )
}

// ── (copiado de LiveWall.tsx, linhas 757-864: celebrações: closer, meta do dia, venda) ──
// ── Celebration ─── CORRIGIDO: lookup por hubspot_id ─────────
// ── GoalCelebration ─── meta do dia batida (geral ou de uma vertical) —
// diferente da celebração de venda: sem contador, foco no marco atingido.
// ── CloserGoalCelebration ─── closer bateu a meta individual do mês ────
export function CloserGoalCelebration({ closer, name, value, onDone }: { closer:Closer|null; name:string; value:number; onDone:()=>void }) {
  const color = closer?.color ?? GOLD

  useEffect(() => {
    playCert()
    const t = setTimeout(onDone, 6500)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(ellipse at 50% 40%,${color}25,rgba(13,0,21,.96) 65%)`,backdropFilter:'blur(14px)'}}>
      <Confete color={color}/>
      <motion.div initial={{scale:.6,y:40}} animate={{scale:1,y:0}} exit={{scale:.9,opacity:0}} transition={{type:'spring',stiffness:190,damping:18}} style={{textAlign:'center',maxWidth:600,padding:'0 40px',position:'relative',zIndex:1001}}>
        <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:.1,type:'spring',stiffness:220,damping:16}} style={{margin:'0 auto 18px',display:'flex',justifyContent:'center'}}>
          <Avatar closer={closer} name={name} size={96}/>
        </motion.div>
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.15}} style={{fontSize:13,fontWeight:800,color,textTransform:'uppercase',letterSpacing:'.18em',marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>
          🏆 META DO MÊS BATIDA!
        </motion.p>
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}} style={{fontSize:32,fontWeight:900,color:'#f3e8ff',marginBottom:16,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em',lineHeight:1.1}}>
          {name}
        </motion.p>
        <motion.p initial={{scale:.4,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:300,damping:14,delay:.3}} style={{fontSize:60,fontWeight:900,color,fontVariantNumeric:'tabular-nums',lineHeight:1,fontFamily:"'Space Grotesk',sans-serif",textShadow:`0 0 60px ${color}88`,margin:0}}>
          {fmtBRL(value)}
        </motion.p>
        <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.5}} style={{fontSize:14,color:'rgba(233,213,255,.7)',marginTop:16,fontFamily:"'JetBrains Mono',monospace"}}>
          🎉 Parabéns pelo empenho esse mês!
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

export function GoalCelebration({ vertical, value, onDone }: { vertical:VerticalId|null; value:number; onDone:()=>void }) {
  const v = vertical ? VERTICALS[vertical] : null
  const color = v?.accent ?? GOLD

  useEffect(() => {
    playCert()
    const t = setTimeout(onDone, 6500)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(ellipse at 50% 40%,${color}25,rgba(13,0,21,.96) 65%)`,backdropFilter:'blur(14px)'}}>
      <Confete color={color}/>
      <motion.div initial={{scale:.6,y:40}} animate={{scale:1,y:0}} exit={{scale:.9,opacity:0}} transition={{type:'spring',stiffness:190,damping:18}} style={{textAlign:'center',maxWidth:600,padding:'0 40px',position:'relative',zIndex:1001}}>
        {v && <motion.img src={v.mascot} alt={v.label} initial={{scale:0,rotate:-8}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:230,damping:16,delay:.1}} style={{height:150,objectFit:'contain',margin:'0 auto 16px',display:'block',filter:`drop-shadow(0 0 40px ${color}88)`}}/>}
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.15}} style={{fontSize:13,fontWeight:800,color,textTransform:'uppercase',letterSpacing:'.18em',marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>
          🎯 META DO DIA BATIDA!
        </motion.p>
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}} style={{fontSize:32,fontWeight:900,color:'#f3e8ff',marginBottom:16,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em',lineHeight:1.1}}>
          {v ? v.label : 'Meta Geral'}
        </motion.p>
        <motion.p initial={{scale:.4,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:300,damping:14,delay:.3}} style={{fontSize:64,fontWeight:900,color,fontVariantNumeric:'tabular-nums',lineHeight:1,fontFamily:"'Space Grotesk',sans-serif",textShadow:`0 0 60px ${color}88`,margin:0}}>
          {fmtBRL(value)}
        </motion.p>
        <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.5}} style={{fontSize:14,color:'rgba(233,213,255,.7)',marginTop:16,fontFamily:"'JetBrains Mono',monospace"}}>
          👏 Time inteiro, parabéns pelo empenho hoje!
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

export function Celebration({ ev, byId, byHubId, onDone }: { ev:TelaoEvent; byId:Record<string,Closer>; byHubId:Record<string,Closer>; onDone:()=>void }) {
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

// ── (copiado de LiveWall.tsx, linhas 882-899: Dinheiro deixado na mesa) ──
// ── Dinheiro deixado na mesa ─── calculado a partir do cupom (_X% no final) ──
export function MoneyLeftOnTable({ value, totalRevenue, isDark=true }: { value:number; totalRevenue:number; isDark?:boolean }) {
  const muted = isDark ? '#a898c9' : '#6d28d9'
  const pct = totalRevenue>0 ? (value/totalRevenue)*100 : 0
  const empty = value === 0
  return (
    <div style={{background:empty?(isDark?'rgba(255,255,255,.02)':'rgba(255,255,255,.5)'):(isDark?'linear-gradient(135deg,rgba(245,158,11,.06),rgba(255,255,255,.02))':'linear-gradient(135deg,rgba(245,158,11,.1),rgba(255,255,255,.5))'),border:empty?(isDark?'1px solid rgba(168,85,247,.1)':'1px solid rgba(139,92,246,.2)'):(isDark?'1px solid rgba(245,158,11,.15)':'1px solid rgba(245,158,11,.3)'),borderRadius:14,padding:empty?'8px 14px':'11px 16px',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',gap:12,transition:'padding .3s ease'}}>
      <div style={{width:empty?28:38,height:empty?28:38,borderRadius:empty?8:11,background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:empty?13:18,flexShrink:0,transition:'all .3s ease'}}>💸</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:empty?10:12,fontWeight:900,color:'#d97706',textTransform:'uppercase',letterSpacing:'.1em',margin:0,fontFamily:"'JetBrains Mono',monospace"}}>Deixado na Mesa</p>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <p style={{fontSize:empty?15:20,fontWeight:900,color:value>0?'#f59e0b':muted,margin:0,fontVariantNumeric:'tabular-nums',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em'}}>{fmtBRL(value)}</p>
        <p style={{fontSize:9,fontWeight:700,color:value>0?'#d97706':muted,margin:0,fontFamily:"'JetBrains Mono',monospace"}}>{value===0?'sem descontos no período':`${pct.toFixed(1)}% da receita do período`}</p>
      </div>
    </div>
  )
}

// ── (variante de LiveWall.tsx linhas 794-824: GoalCelebration com os textos de "mês") ──
export function MonthGoalCelebration({ vertical, value, onDone }: { vertical:VerticalId|null; value:number; onDone:()=>void }) {
  const v = vertical ? VERTICALS[vertical] : null
  const color = v?.accent ?? GOLD

  useEffect(() => {
    playCert()
    const t = setTimeout(onDone, 6500)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:`radial-gradient(ellipse at 50% 40%,${color}25,rgba(13,0,21,.96) 65%)`,backdropFilter:'blur(14px)'}}>
      <Confete color={color}/>
      <motion.div initial={{scale:.6,y:40}} animate={{scale:1,y:0}} exit={{scale:.9,opacity:0}} transition={{type:'spring',stiffness:190,damping:18}} style={{textAlign:'center',maxWidth:600,padding:'0 40px',position:'relative',zIndex:1001}}>
        {v && <motion.img src={v.mascot} alt={v.label} initial={{scale:0,rotate:-8}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:230,damping:16,delay:.1}} style={{height:150,objectFit:'contain',margin:'0 auto 16px',display:'block',filter:`drop-shadow(0 0 40px ${color}88)`}}/>}
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.15}} style={{fontSize:13,fontWeight:800,color,textTransform:'uppercase',letterSpacing:'.18em',marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>
          🏆 META DO MÊS BATIDA!
        </motion.p>
        <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2}} style={{fontSize:32,fontWeight:900,color:'#f3e8ff',marginBottom:16,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.02em',lineHeight:1.1}}>
          {v ? v.label : 'Meta Geral'}
        </motion.p>
        <motion.p initial={{scale:.4,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:300,damping:14,delay:.3}} style={{fontSize:64,fontWeight:900,color,fontVariantNumeric:'tabular-nums',lineHeight:1,fontFamily:"'Space Grotesk',sans-serif",textShadow:`0 0 60px ${color}88`,margin:0}}>
          {fmtBRL(value)}
        </motion.p>
        <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.5}} style={{fontSize:14,color:'rgba(233,213,255,.7)',marginTop:16,fontFamily:"'JetBrains Mono',monospace"}}>
          👏 Time inteiro, parabéns pelo mês!
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
