'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CreateStepButton, StepAdminControls, TeamFilter } from './StepManager'
import { FileText, HelpCircle, CheckSquare, Clock, ArrowRight, Zap, Target, Trophy, Lock } from 'lucide-react'

const TEAM: Record<string,{label:string;color:string;bg:string;dot:string}> = {
  R1:    { label:'Time R1',   color:'#7c3aed', bg:'rgba(124,58,237,.12)', dot:'#a78bfa' },
  OAO:   { label:'Time OAO', color:'#2563eb', bg:'rgba(37,99,235,.12)',   dot:'#60a5fa' },
  ambos: { label:'Todos',     color:'#059669', bg:'rgba(5,150,105,.12)',   dot:'#34d399' },
}

export function TrilhaViewClient({ steps, isAdmin, unlockedStepIds }: { steps:any[]; isAdmin:boolean; unlockedStepIds?: string[] | null }) {
  const unlockedSet = unlockedStepIds ? new Set(unlockedStepIds) : null // null = sem restrição (admin)
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
        @keyframes floatMascot {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50%      { transform: translateY(-16px) rotate(1.5deg); }
        }
        .mascot-hero {
          position:absolute; z-index:2; pointer-events:none;
          right:clamp(4px,1.5vw,28px); bottom:0;
          height:clamp(96px,10vw,150px); width:auto;
          filter:drop-shadow(0 10px 18px rgba(0,0,0,.4)) drop-shadow(0 0 18px rgba(124,58,237,.3));
          animation: floatMascot 5s ease-in-out infinite, fadeIn .6s .1s ease both;
        }
        @media (max-width: 680px) {
          .mascot-hero { height:80px; }
        }
        @media (max-width: 480px) {
          .mascot-hero { display:none; }
        }
        .step-card {
          opacity:0;
          animation: fadeUp .5s cubic-bezier(.22,1,.36,1) forwards;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 6px 18px -10px rgba(15,15,35,.35);
        }
        .step-card:hover { transform:translateY(-2px); box-shadow:0 14px 32px -8px rgba(79,70,229,.18)!important; border-color:rgba(99,102,241,.35)!important; }
        .day-block { opacity:0; animation: fadeIn .45s ease forwards; }
        .enter-btn { transition: background .15s, transform .15s; }
        .enter-btn:hover { transform:translateY(-1px); }
      `}</style>

      {/* HERO */}
      <div style={{ position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'var(--grad-hero,linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 70%,#7c3aed 100%))' }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px)', backgroundSize:'28px 28px' }}/>
        <div style={{ position:'absolute', top:-70, left:-70, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,.4) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, right:-40, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(37,99,235,.35) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(124,58,237,.7) 35%,rgba(37,99,235,.7) 65%,transparent)' }}/>

        <img
          src="/onboarding/mascot-comercial.png"
          alt="Mascote Time Comercial apontando"
          className="mascot-hero"
        />

        <div style={{ position:'relative', zIndex:1, maxWidth:760, margin:'0 auto', padding:'22px 24px 40px', textAlign:'center' }}>

          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 13px', borderRadius:999, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.14)', marginBottom:10, animation:'fadeIn .4s ease forwards' }}>
            <Zap size={10} color="#a78bfa"/>
            <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.75)', letterSpacing:'.08em', textTransform:'uppercase' }}>Programa Comercial de Onboarding</span>
          </div>

          <h1 style={{ margin:'0 0 6px', fontSize:'clamp(18px,2.4vw,22px)', fontWeight:900, letterSpacing:'-.02em', lineHeight:1.2, color:'#fff', animation:'fadeUp .5s .05s ease both' }}>
            Sua trilha para o{' '}
            <span style={{ background:'linear-gradient(90deg,#a78bfa 0%,#60a5fa 50%,#34d399 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              primeiro fechamento
            </span>
          </h1>

          <p style={{ fontSize:12.5, color:'rgba(255,255,255,.5)', marginTop:0, marginBottom:14, lineHeight:1.6, maxWidth:400, marginLeft:'auto', marginRight:'auto', animation:'fadeUp .5s .1s ease both' }}>
            Complete cada etapa, domine a metodologia MedReview e feche com confiança desde o primeiro dia.
          </p>

          {totalSteps > 0 && (
            <div style={{ display:'flex', justifyContent:'center', gap:0, animation:'fadeUp .5s .15s ease both' }}>
              {[
                { Icon:Target,  n:totalDays,    label:'Dias',    show:totalDays>0 },
                { Icon:Zap,     n:totalSteps,   label:'Etapas',  show:true },
                { Icon:Trophy,  n:totalMinutes, label:'Minutos', show:totalMinutes>0 },
              ].filter(x => x.show).map((x,i,arr) => (
                <div key={x.label} style={{ display:'flex', alignItems:'center', gap:6, padding:'0 14px', borderRight:i<arr.length-1?'1px solid rgba(255,255,255,.08)':'none' }}>
                  <x.Icon size={11} color="rgba(255,255,255,.35)"/>
                  <span style={{ fontSize:16, fontWeight:900, color:'#fff', letterSpacing:'-.02em' }}>{x.n}</span>
                  <span style={{ fontSize:9.5, color:'rgba(255,255,255,.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>{x.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:26, background:'linear-gradient(to bottom,transparent,var(--background))' }}/>
        <svg viewBox="0 0 1440 46" preserveAspectRatio="none" style={{ position:'absolute', bottom:-1, left:0, width:'100%', height:46, display:'block' }}>
          <path d="M0,6 Q720,42 1440,6 L1440,46 L0,46 Z" fill="var(--background)"/>
        </svg>
      </div>

      {/* Leve nudge pra fechar qualquer linha de junção, sem cobrir a curva */}
      <div style={{ position:'relative', zIndex:2, marginTop:-2 }}>
      {/* BARRA DE AÇÕES (fora do hero — cores normais do tema, sem contraste ruim) */}
      {isAdmin && (
        <div style={{ maxWidth:880, margin:'0 auto', padding:'20px 24px 0', display:'flex', gap:10, justifyContent:'center', alignItems:'center', flexWrap:'wrap' }}>
          <TeamFilter value={teamFilter} onChange={setTeamFilter}/>
          <CreateStepButton/>
        </div>
      )}

      {/* TIMELINE */}
      <div style={{ maxWidth:880, margin:'0 auto', padding:'32px 24px 80px' }}>
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
                        width:56, height:56, borderRadius:'50%',
                        background: day !== null ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'linear-gradient(135deg,#94a3b8,#64748b)',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        boxShadow: day !== null ? '0 0 0 6px rgba(99,102,241,.1),0 6px 22px rgba(99,102,241,.35)' : 'none',
                        position:'relative', zIndex:2,
                      }}>
                        {day !== null ? (
                          <>
                            <span style={{ fontSize:8, fontWeight:900, color:'rgba(255,255,255,.7)', letterSpacing:'.1em', lineHeight:1 }}>DIA</span>
                            <span style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1.1 }}>{day}</span>
                          </>
                        ) : (
                          <span style={{ fontSize:7, fontWeight:900, color:'rgba(255,255,255,.85)', textAlign:'center', letterSpacing:'.04em', lineHeight:1.4 }}>{'SEM\nDIA'}</span>
                        )}
                      </div>
                      <div style={{ width:2.5, flex:1, background:'linear-gradient(to bottom,rgba(99,102,241,.4),rgba(99,102,241,.1))', minHeight:12 }}/>
                    </div>
                    <div style={{ flex:1, paddingTop:12, paddingLeft:16 }}>
                      <p style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--foreground)', letterSpacing:'-.01em' }}>
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
                      <div style={{ width:2.5, background: isLastDay ? 'transparent' : 'linear-gradient(to bottom,rgba(99,102,241,.22),rgba(99,102,241,.05))' }}/>
                    </div>
                    <div style={{ flex:1, paddingLeft:16, paddingTop:10, paddingBottom:isLastDay?0:44, display:'flex', flexDirection:'column', gap:10 }}>
                      {daySteps.map((step, si) => {
                        const ts  = TEAM[step.team] ?? TEAM.ambos
                        const mat = step.onboarding_materials?.[0]?.count ?? 0
                        const faq = step.onboarding_faqs?.[0]?.count ?? 0
                        const qz  = step.onboarding_questions?.[0]?.count ?? 0
                        const isLocked = !isAdmin && unlockedSet !== null && !unlockedSet.has(step.id)
                        const critNeedsMat  = step.completion_criteria==='visualizar' || step.completion_criteria==='ambos'
                        const critNeedsQuiz = step.completion_criteria==='quiz'       || step.completion_criteria==='ambos'
                        const misconfigured = isAdmin && ((critNeedsMat && mat===0) || (critNeedsQuiz && qz===0))

                        return (
                          <div key={step.id} className="step-card"
                            style={{ animationDelay:`${di*80+si*55+100}ms`, background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', opacity: isLocked?0.6:1 }}>
                            <div style={{ height:3, background:`linear-gradient(90deg,${ts.color},${ts.color}33)` }}/>
                            <div style={{ padding:'16px 18px' }}>
                              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                                <div style={{ width:30, height:30, borderRadius:9, background:ts.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, color:ts.color, marginTop:1 }}>
                                  {si+1}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                                    <span style={{ fontSize:15, fontWeight:800, color:'var(--foreground)', lineHeight:1.3, letterSpacing:'-.01em' }}>{step.title}</span>
                                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:999, background:ts.bg, color:ts.color, letterSpacing:'.04em' }}>
                                      <span style={{ width:5, height:5, borderRadius:'50%', background:ts.color }}/>
                                      {ts.label}
                                    </span>
                                  </div>
                                  {step.description && (
                                    <p style={{ fontSize:12, color:'var(--muted-foreground)', opacity:.85, margin:'0 0 10px', lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>
                                      {step.description}
                                    </p>
                                  )}
                                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', opacity:.8 }}>
                                    {mat>0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9.5, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 7px', borderRadius:999 }}><FileText size={9.5}/>{mat} {mat!==1?'materiais':'material'}</span>}
                                    {faq>0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9.5, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 7px', borderRadius:999 }}><HelpCircle size={9.5}/>{faq} flashcard{faq!==1?'s':''}</span>}
                                    {qz>0  && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9.5, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 7px', borderRadius:999 }}><CheckSquare size={9.5}/>{qz} {qz!==1?'questões':'questão'}</span>}
                                    {step.estimated_minutes>0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9.5, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 7px', borderRadius:999 }}><Clock size={9.5}/>{step.estimated_minutes} min</span>}
                                    {misconfigured && (
                                      <span title="Critério de conclusão exige conteúdo que essa etapa não tem — ninguém vai conseguir concluí-la assim"
                                        style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9.5, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.3)', padding:'2px 7px', borderRadius:999, opacity:1 }}>
                                        ⚠ nunca vai concluir
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                                  {isAdmin && (
                                    <StepAdminControls step={step} steps={daySteps} isFirst={si===0} isLast={si===daySteps.length-1}/>
                                  )}
                                  {isLocked ? (
                                    <div title="Conclua a etapa anterior para liberar"
                                      style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--secondary)', color:'var(--muted-foreground)', cursor:'not-allowed' }}>
                                      <Lock size={14}/>
                                    </div>
                                  ) : (
                                    <Link href={`/onboarding/trilha/${step.id}`} className="enter-btn"
                                      style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:`${ts.color}22`, border:`1px solid ${ts.color}38`, color:ts.color, textDecoration:'none' }}
                                      onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background=ts.color;(el.querySelector('svg') as SVGElement).style.color='#fff'}}
                                      onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background=`${ts.color}22`;(el.querySelector('svg') as SVGElement).style.color=ts.color}}>
                                      <ArrowRight size={15} style={{ color:ts.color }}/>
                                    </Link>
                                  )}
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
    </div>
  )
}
