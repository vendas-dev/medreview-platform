'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CreateStepButton, StepAdminControls } from './StepManager'
import { FileText, HelpCircle, CheckSquare, Clock, ArrowRight, Zap, Target, Trophy } from 'lucide-react'

const TEAM: Record<string,{label:string;color:string;bg:string;dot:string}> = {
  R1:    { label:'Time R1',   color:'#7c3aed', bg:'rgba(124,58,237,.12)', dot:'#a78bfa' },
  OAO:   { label:'Time OAO', color:'#2563eb', bg:'rgba(37,99,235,.12)',   dot:'#60a5fa' },
  ambos: { label:'Todos',     color:'#059669', bg:'rgba(5,150,105,.12)',   dot:'#34d399' },
}

function TeamFilterStyled({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const opts = [
    { value:'ambos', label:'Ambos os times', dot:'rgba(255,255,255,.4)' },
    { value:'R1',    label:'Time R1',        dot:'#a78bfa' },
    { value:'OAO',   label:'Time OAO',       dot:'#60a5fa' },
  ]
  return (
    <div style={{ display:'flex', gap:6 }}>
      {opts.map(o => {
        const active = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{
              display:'inline-flex', alignItems:'center', gap:7,
              height:36, padding:'0 14px', borderRadius:10, cursor:'pointer',
              fontFamily:'inherit', fontSize:12, fontWeight:active?700:500,
              border: active ? '1px solid rgba(255,255,255,.3)' : '1px solid rgba(255,255,255,.1)',
              background: active ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)',
              color: active ? '#fff' : 'rgba(255,255,255,.5)',
              transition:'all .18s ease',
            }}>
            <span style={{
              width:8, height:8, borderRadius:'50%', flexShrink:0,
              background: active ? o.dot : 'rgba(255,255,255,.2)',
              boxShadow: active ? `0 0 8px ${o.dot}` : 'none',
              transition:'all .18s',
            }}/>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function TrilhaViewClient({ steps, isAdmin }: { steps:any[]; isAdmin:boolean }) {
  const [teamFilter, setTeamFilter] = useState('ambos')

  const filtered = isAdmin
    ? steps.filter(s => teamFilter === 'ambos' || s.team === teamFilter || s.team === 'ambos')
    : steps

  const dayMap = new Map<number|null, any[]>()
  for (const s of filtered) {
    const d = s.day_number ?? null
    if (!dayMap.has(d)) dayMap.set(d, [])
    dayMap.get(d)!.push(s)
  }
  const days = [...dayMap.keys()].sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return (a as number) - (b as number)
  })

  const totalDays    = days.filter(d => d !== null).length
  const totalSteps   = filtered.length
  const totalMinutes = filtered.reduce((s,e) => s + (e.estimated_minutes ?? 0), 0)

  return (
    <div style={{ minHeight:'100vh', background:'var(--background)', fontFamily:'inherit' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .step-card {
          opacity:0;
          animation: fadeUp .5s cubic-bezier(.22,1,.36,1) forwards;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .step-card:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(0,0,0,.1)!important; border-color:rgba(99,102,241,.3)!important; }
        .day-block { opacity:0; animation: fadeIn .45s ease forwards; }
        .enter-btn { transition: background .15s, transform .15s; }
        .enter-btn:hover { transform:translateY(-1px); }
      `}</style>

      {/* HERO */}
      <div style={{ position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#0f0c29 0%,#302b63 48%,#1a1a3e 100%)' }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px)', backgroundSize:'28px 28px' }}/>
        <div style={{ position:'absolute', top:-100, left:-100, width:380, height:380, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,.4) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-80, right:-60, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(37,99,235,.35) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(124,58,237,.7) 35%,rgba(37,99,235,.7) 65%,transparent)' }}/>

        <div style={{ position:'relative', zIndex:1, maxWidth:760, margin:'0 auto', padding:'52px 24px 48px', textAlign:'center' }}>

          <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 16px', borderRadius:999, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.14)', marginBottom:24, animation:'fadeIn .4s ease forwards' }}>
            <Zap size={12} color="#a78bfa"/>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.75)', letterSpacing:'.1em', textTransform:'uppercase' }}>Programa Comercial de Onboarding</span>
          </div>

          <h1 style={{ margin:'0 0 14px', fontSize:'clamp(26px,4vw,38px)', fontWeight:900, letterSpacing:'-.03em', lineHeight:1.12, color:'#fff', animation:'fadeUp .5s .05s ease both' }}>
            Sua trilha para o<br/>
            <span style={{ background:'linear-gradient(90deg,#a78bfa 0%,#60a5fa 50%,#34d399 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              primeiro fechamento
            </span>
          </h1>

          <p style={{ fontSize:14, color:'rgba(255,255,255,.5)', margin:'0 0 36px', lineHeight:1.7, maxWidth:420, marginLeft:'auto', marginRight:'auto', animation:'fadeUp .5s .1s ease both' }}>
            Complete cada etapa, domine a metodologia MedReview e feche com confiança desde o primeiro dia.
          </p>

          {totalSteps > 0 && (
            <div style={{ display:'flex', justifyContent:'center', gap:0, marginBottom:36, animation:'fadeUp .5s .15s ease both' }}>
              {[
                { Icon:Target,  n:totalDays,    label:'Dias',    show:totalDays>0 },
                { Icon:Zap,     n:totalSteps,   label:'Etapas',  show:true },
                { Icon:Trophy,  n:totalMinutes, label:'Minutos', show:totalMinutes>0 },
              ].filter(x => x.show).map((x,i,arr) => (
                <div key={x.label} style={{ flex:1, maxWidth:140, padding:'16px 8px', borderRight:i<arr.length-1?'1px solid rgba(255,255,255,.08)':'none' }}>
                  <x.Icon size={13} color="rgba(255,255,255,.35)" style={{ display:'block', margin:'0 auto 8px' }}/>
                  <div style={{ fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-.03em', lineHeight:1 }}>{x.n}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:4, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em' }}>{x.label}</div>
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <div style={{ display:'flex', gap:8, justifyContent:'center', alignItems:'center', flexWrap:'wrap', animation:'fadeUp .5s .2s ease both' }}>
              <TeamFilterStyled value={teamFilter} onChange={setTeamFilter}/>
              <div style={{ width:1, height:24, background:'rgba(255,255,255,.12)' }}/>
              <CreateStepButton/>
            </div>
          )}
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:64, background:'linear-gradient(to bottom,transparent,var(--background))' }}/>
      </div>

      {/* TIMELINE */}
      <div style={{ maxWidth:760, margin:'0 auto', padding:'32px 24px 80px' }}>
        {days.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'var(--muted-foreground)', animation:'fadeIn .4s ease' }}>
            <div style={{ fontSize:42, marginBottom:14 }}>📚</div>
            <p style={{ fontSize:15, fontWeight:600, color:'var(--foreground)', marginBottom:6 }}>Trilha ainda vazia</p>
            <p style={{ fontSize:13, margin:0 }}>{isAdmin ? 'Clique em "Nova etapa" para começar.' : 'A trilha será disponibilizada em breve.'}</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {days.map((day, di) => {
              const daySteps  = dayMap.get(day)!
              const isLastDay = di === days.length - 1
              const dayTotal  = daySteps.reduce((s,e) => s + (e.estimated_minutes??0), 0)

              return (
                <div key={day??'no-day'} className="day-block" style={{ animationDelay:`${di*80}ms` }}>

                  {/* Cabeçalho do dia */}
                  <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
                    <div style={{ width:56, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center' }}>
                      <div style={{
                        width:52, height:52, borderRadius:'50%',
                        background: day !== null ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'linear-gradient(135deg,#94a3b8,#64748b)',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        boxShadow: day !== null ? '0 0 0 6px rgba(99,102,241,.08),0 4px 20px rgba(99,102,241,.25)' : 'none',
                        position:'relative', zIndex:2,
                      }}>
                        {day !== null ? (
                          <>
                            <span style={{ fontSize:8, fontWeight:900, color:'rgba(255,255,255,.7)', letterSpacing:'.1em', lineHeight:1 }}>DIA</span>
                            <span style={{ fontSize:19, fontWeight:900, color:'#fff', lineHeight:1.1 }}>{day}</span>
                          </>
                        ) : (
                          <span style={{ fontSize:7, fontWeight:900, color:'rgba(255,255,255,.85)', textAlign:'center', letterSpacing:'.04em', lineHeight:1.4 }}>{'SEM\nDIA'}</span>
                        )}
                      </div>
                      <div style={{ width:2, flex:1, background:'linear-gradient(to bottom,rgba(99,102,241,.25),rgba(99,102,241,.06))', minHeight:12 }}/>
                    </div>
                    <div style={{ flex:1, paddingTop:12, paddingLeft:16 }}>
                      <p style={{ margin:0, fontSize:11, fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.1em' }}>
                        {day !== null ? `Dia ${day}` : 'Sem dia definido'}
                      </p>
                      <p style={{ margin:'2px 0 0', fontSize:13, color:'var(--muted-foreground)' }}>
                        {daySteps.length} etapa{daySteps.length!==1?'s':''}{dayTotal>0?` · ${dayTotal} min`:''}
                      </p>
                    </div>
                  </div>

                  {/* Etapas */}
                  <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
                    <div style={{ width:56, flexShrink:0, display:'flex', justifyContent:'center' }}>
                      <div style={{ width:2, background: isLastDay ? 'transparent' : 'linear-gradient(to bottom,rgba(99,102,241,.1),rgba(99,102,241,.02))' }}/>
                    </div>
                    <div style={{ flex:1, paddingLeft:16, paddingTop:10, paddingBottom:isLastDay?0:44, display:'flex', flexDirection:'column', gap:10 }}>
                      {daySteps.map((step, si) => {
                        const ts  = TEAM[step.team] ?? TEAM.ambos
                        const mat = step.onboarding_materials?.[0]?.count ?? 0
                        const faq = step.onboarding_faqs?.[0]?.count ?? 0
                        const qz  = step.onboarding_questions?.[0]?.count ?? 0
                        const gi  = filtered.indexOf(step)

                        return (
                          <div key={step.id} className="step-card"
                            style={{ animationDelay:`${di*80+si*55+100}ms`, background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                            <div style={{ height:3, background:`linear-gradient(90deg,${ts.color},${ts.color}33)` }}/>
                            <div style={{ padding:'16px 18px' }}>
                              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                                <div style={{ width:30, height:30, borderRadius:9, background:ts.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, color:ts.color, marginTop:1 }}>
                                  {gi+1}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                                    <span style={{ fontSize:14, fontWeight:700, color:'var(--foreground)', lineHeight:1.3 }}>{step.title}</span>
                                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:999, background:ts.bg, color:ts.color, letterSpacing:'.04em' }}>
                                      <span style={{ width:5, height:5, borderRadius:'50%', background:ts.color }}/>
                                      {ts.label}
                                    </span>
                                  </div>
                                  {step.description && (
                                    <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:'0 0 10px', lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>
                                      {step.description}
                                    </p>
                                  )}
                                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                    {mat>0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:999 }}><FileText size={10}/>{mat} material{mat!==1?'is':''}</span>}
                                    {faq>0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:999 }}><HelpCircle size={10}/>{faq} FAQ{faq!==1?'s':''}</span>}
                                    {qz>0  && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:999 }}><CheckSquare size={10}/>{qz} questão{qz!==1?'ões':''}</span>}
                                    {step.estimated_minutes>0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:999 }}><Clock size={10}/>{step.estimated_minutes} min</span>}
                                  </div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                                  {isAdmin && (
                                    <StepAdminControls step={step} steps={filtered} isFirst={gi===0} isLast={gi===filtered.length-1}/>
                                  )}
                                  <Link href={`/onboarding/trilha/${step.id}`} className="enter-btn"
                                    style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:`${ts.color}18`, color:ts.color, textDecoration:'none' }}
                                    onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background=ts.color;(el.querySelector('svg') as SVGElement).style.color='#fff'}}
                                    onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background=`${ts.color}18`;(el.querySelector('svg') as SVGElement).style.color=ts.color}}>
                                    <ArrowRight size={15} style={{ color:ts.color }}/>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
