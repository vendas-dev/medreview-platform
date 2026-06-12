'use client'
import { useState, useMemo } from 'react'
import { Users, Trophy, Clock, MessageSquare, TrendingUp, AlertTriangle, CheckCircle2, BarChart3, Target, Zap, Filter, ChevronDown, X, Play } from 'lucide-react'

interface Props {
  users: any[]; steps: any[]; progress: any[]
  totalConversations: number; totalMessages: number
  videoViews: any[]; attempts: any[]
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function DonutChart({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', ...style }}>
      {children}
    </div>
  )
}

function CardTitle({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon size={14} style={{ color }} />
      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{label}</p>
    </div>
  )
}

export function DashboardView({ users, steps, progress, totalConversations, totalMessages, videoViews, attempts }: Props) {
  const [filterTeam, setFilterTeam] = useState<'todos'|'OAO'|'R1'>('todos')
  const [filterUser, setFilterUser] = useState<string>('todos')
  const [showFilters, setShowFilters] = useState(false)

  const filteredUsers = useMemo(() => users.filter(u => {
    if (filterTeam !== 'todos' && u.team !== filterTeam) return false
    if (filterUser !== 'todos' && u.id !== filterUser) return false
    return true
  }), [users, filterTeam, filterUser])

  const filteredIds     = new Set(filteredUsers.map(u => u.id))
  const filteredProgress = progress.filter(p => filteredIds.has(p.user_id))
  const filteredAttempts = attempts.filter(a => filteredIds.has(a.user_id))

  const totalU       = filteredUsers.length
  const completedU   = new Set(filteredProgress.filter(p => p.status==='concluido').map(p=>p.user_id)).size
  const activeU      = new Set(filteredProgress.filter(p => p.status==='em_andamento').map(p=>p.user_id)).size
  const notStartedU  = totalU - completedU - activeU
  const completionRate = totalU > 0 ? Math.round((completedU/totalU)*100) : 0

  const firstAttempts = filteredAttempts.reduce((acc: Record<string,any>, a: any) => {
    const key = `${a.user_id}-${a.step_id}`
    if (!acc[key] || new Date(a.created_at) < new Date(acc[key].created_at)) acc[key] = a
    return acc
  }, {})
  const firstArr = Object.values(firstAttempts) as any[]
  const passedFirst = firstArr.filter((a:any) => a.passed).length
  const firstPassRate = firstArr.length > 0 ? Math.round((passedFirst/firstArr.length)*100) : 0

  const stepErrorMap: Record<string,{title:string;total:number;failed:number}> = {}
  firstArr.forEach((a:any) => {
    const step = steps.find(s=>s.id===a.step_id)
    if (!step) return
    if (!stepErrorMap[a.step_id]) stepErrorMap[a.step_id] = { title:step.title, total:0, failed:0 }
    stepErrorMap[a.step_id].total++
    if (!a.passed) stepErrorMap[a.step_id].failed++
  })
  const errorRanking = Object.values(stepErrorMap)
    .map(e => ({ ...e, rate: e.total>0 ? Math.round((e.failed/e.total)*100) : 0 }))
    .filter(e => e.total>0).sort((a,b)=>b.rate-a.rate).slice(0,6)

  const stepProgressData = steps.map(s => {
    const done = filteredProgress.filter(p=>p.step_id===s.id&&p.status==='concluido').length
    const pct = totalU>0 ? Math.round((done/totalU)*100) : 0
    return { title:s.title, pct, done, total:totalU }
  }).sort((a,b)=>b.pct-a.pct)

  const stepScores = steps.map(s => {
    const sa = filteredAttempts.filter((a:any)=>a.step_id===s.id)
    const avg = sa.length>0 ? Math.round(sa.reduce((x:number,a:any)=>x+a.score,0)/sa.length) : null
    return { title:s.title, avg, attempts:sa.length }
  }).filter(s=>s.avg!==null)

  const userCards = filteredUsers.map(u => {
    const up   = filteredProgress.filter(p=>p.user_id===u.id)
    const ua   = filteredAttempts.filter((a:any)=>a.user_id===u.id)
    const done = up.filter(p=>p.status==='concluido').length
    const ts   = steps.filter(s=>s.team===u.team||s.team==='ambos')
    const pct  = ts.length>0 ? Math.round((done/ts.length)*100) : 0
    const avg  = ua.length>0 ? Math.round(ua.reduce((x:number,a:any)=>x+a.score,0)/ua.length) : null
    return { ...u, done, total:ts.length, pct, avg, attempts:ua.length }
  })

  const teamColor = (t:string) => t==='OAO'
    ? { grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', dot:'#3b82f6' }
    : { grad:'linear-gradient(135deg,#8b5cf6,#a855f7)', dot:'#8b5cf6' }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ background: 'var(--grad-hero,linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 70%,#7c3aed 100%))', borderRadius: 20, padding: '20px 26px', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 10px', borderRadius:999, background:'rgba(255,255,255,0.15)', color:'#fff' }}>📊 Analytics</span>
            <h1 style={{ fontSize:'clamp(17px,3vw,22px)', fontWeight:900, color:'#fff', margin:'7px 0 3px', letterSpacing:'-0.025em' }}>Dashboard de Onboarding</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', margin:0 }}>Acompanhe cada passo do seu time em tempo real</p>
          </div>
          <button onClick={() => setShowFilters(f=>!f)}
            style={{ display:'flex', alignItems:'center', gap:8, height:38, padding:'0 16px', borderRadius:10, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', backdropFilter:'blur(8px)', transition:'all 0.15s' }}>
            <Filter size={14} /> Filtros {showFilters && <X size={12} />}
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div style={{ background:'var(--card)', border:'1px solid rgba(99,102,241,0.18)', borderRadius:14, padding:'14px 20px', marginBottom:18, display:'flex', gap:14, flexWrap:'wrap', alignItems:'center', boxShadow:'var(--shadow-sm)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Time:</span>
            {(['todos','OAO','R1'] as const).map(t => (
              <button key={t} onClick={() => { setFilterTeam(t); setFilterUser('todos') }}
                style={{ height:32, padding:'0 13px', borderRadius:8, border:'1.5px solid', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', background:filterTeam===t?'linear-gradient(135deg,#4f46e5,#7c3aed)':'transparent', color:filterTeam===t?'#fff':'var(--muted-foreground)', borderColor:filterTeam===t?'transparent':'var(--border)' }}>
                {t==='todos'?'Todos':`Time ${t}`}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Usuário:</span>
            <div style={{ position:'relative' }}>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                style={{ height:32, padding:'0 30px 0 11px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:12, fontFamily:'inherit', outline:'none', appearance:'none', cursor:'pointer', minWidth:150, boxShadow:'var(--shadow-xs)' }}>
                <option value="todos">Todos</option>
                {(filterTeam==='todos'?users:users.filter(u=>u.team===filterTeam)).map(u=>(
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <ChevronDown size={10} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--muted-foreground)' }} />
            </div>
          </div>
          {(filterTeam!=='todos'||filterUser!=='todos') && (
            <button onClick={() => { setFilterTeam('todos'); setFilterUser('todos') }}
              style={{ display:'flex', alignItems:'center', gap:5, height:32, padding:'0 11px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              <X size={10} /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Row 1: 5 KPI cards em grid uniforme */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:16 }}>
        {[
          { icon:Users,          label:'Participantes',       value:totalU,           sub:`${completedU} concluíram`, grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', color:'#3b82f6' },
          { icon:Trophy,         label:'Taxa de conclusão',   value:`${completionRate}%`, sub:`${completedU}/${totalU}`,   grad:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#22c55e' },
          { icon:Zap,            label:'Aprovação 1ª tent.',  value:`${firstPassRate}%`, sub:`${passedFirst}/${firstArr.length} quiz`, grad:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'#f59e0b' },
          { icon:Clock,          label:'Em andamento',        value:activeU,          sub:`${notStartedU} não iniciaram`, grad:'linear-gradient(135deg,#8b5cf6,#a855f7)', color:'#8b5cf6' },
          { icon:MessageSquare,  label:'Conversas Med.AI',    value:totalConversations, sub:`${totalMessages} mensagens`, grad:'linear-gradient(135deg,#ec4899,#8b5cf6)', color:'#ec4899' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', position:'relative', overflow:'hidden', boxShadow:'var(--shadow-sm)', transition:'all 0.18s' }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-2px)'; el.style.boxShadow='var(--shadow-md)' }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.transform='none'; el.style.boxShadow='var(--shadow-sm)' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:s.grad }} />
              <div style={{ width:36, height:36, borderRadius:10, background:s.grad, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:`0 4px 12px ${s.color}35` }}>
                <Icon size={16} style={{ color:'#fff' }} />
              </div>
              <p style={{ fontSize:26, fontWeight:900, color:'var(--foreground)', margin:'0 0 2px', lineHeight:1, letterSpacing:'-0.03em' }}>{s.value}</p>
              <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{s.label}</p>
              {s.sub && <p style={{ fontSize:10, color:s.color, marginTop:4, fontWeight:700 }}>{s.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* Row 2: Visão geral + Erros (2 colunas iguais) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <Card>
          <CardTitle icon={Target} label="Visão Geral" color="#6366f1" />
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <DonutChart pct={completionRate} color="#22c55e" size={96} />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:17, fontWeight:900, color:'var(--foreground)' }}>{completionRate}%</span>
              </div>
            </div>
            <div style={{ flex:1 }}>
              {[
                { label:'Concluíram',    value:completedU,  color:'#22c55e', pct:totalU>0?(completedU/totalU)*100:0 },
                { label:'Em andamento',  value:activeU,     color:'#f59e0b', pct:totalU>0?(activeU/totalU)*100:0 },
                { label:'Não iniciaram', value:notStartedU, color:'var(--border)', pct:totalU>0?(notStartedU/totalU)*100:0 },
              ].map(item => (
                <div key={item.label} style={{ marginBottom:9 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{item.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--foreground)' }}>{item.value}</span>
                  </div>
                  <MiniBar pct={item.pct} color={item.color} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle icon={AlertTriangle} label="Etapas com maior erro (1ª tentativa)" color="#ef4444" />
          {errorRanking.length === 0
            ? <p style={{ fontSize:12, color:'var(--muted-foreground)', textAlign:'center', padding:'16px 0' }}>Nenhum quiz respondido ainda.</p>
            : errorRanking.map((e, i) => (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'68%' }}>{e.title}</span>
                  <span style={{ fontSize:11, fontWeight:800, color:e.rate>=60?'#ef4444':e.rate>=30?'#f59e0b':'#22c55e', flexShrink:0 }}>{e.rate}% erro</span>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <MiniBar pct={e.rate} color={e.rate>=60?'#ef4444':e.rate>=30?'#f59e0b':'#22c55e'} />
                  <span style={{ fontSize:9, color:'var(--muted-foreground)', flexShrink:0 }}>{e.failed}/{e.total}</span>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Row 3: Conclusão por etapa + Score médio (2 colunas iguais) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <Card>
          <CardTitle icon={BarChart3} label="Conclusão por etapa" color="#6366f1" />
          {stepProgressData.slice(0, 8).map((s, i) => (
            <div key={i} style={{ marginBottom:9 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, color:'var(--muted-foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{s.title}</span>
                <span style={{ fontSize:11, fontWeight:700, color:s.pct===100?'#22c55e':'var(--foreground)' }}>{s.pct}%</span>
              </div>
              <MiniBar pct={s.pct} color={s.pct===100?'#22c55e':'#4f46e5'} />
            </div>
          ))}
        </Card>

        <Card>
          <CardTitle icon={TrendingUp} label="Score médio no quiz por etapa" color="#22c55e" />
          {stepScores.length === 0
            ? <p style={{ fontSize:12, color:'var(--muted-foreground)', textAlign:'center', padding:'16px 0' }}>Nenhuma tentativa ainda.</p>
            : stepScores.slice(0, 8).map((s, i) => (
              <div key={i} style={{ marginBottom:9 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'var(--muted-foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'68%' }}>{s.title}</span>
                  <div style={{ display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:(s.avg??0)>=70?'#22c55e':'#f59e0b' }}>{s.avg}%</span>
                    <span style={{ fontSize:9, color:'var(--muted-foreground)' }}>({s.attempts}x)</span>
                  </div>
                </div>
                <MiniBar pct={s.avg??0} color={(s.avg??0)>=70?'#22c55e':'#f59e0b'} />
              </div>
            ))
          }
        </Card>
      </div>

      {/* Row 4: Tabela individual full-width */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
        <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'color-mix(in srgb, var(--secondary) 60%, var(--card))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Users size={13} style={{ color:'#6366f1' }} />
            <span style={{ fontSize:11, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Desempenho individual</span>
          </div>
          <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{userCards.length} usuários</span>
        </div>
        {userCards.length===0
          ? <div style={{ padding:'40px 24px', textAlign:'center' }}><p style={{ fontSize:13, color:'var(--muted-foreground)' }}>Nenhum usuário corresponde ao filtro.</p></div>
          : userCards.map((u, idx) => {
            const tc = u.team ? teamColor(u.team) : { grad:'linear-gradient(135deg,#6366f1,#8b5cf6)', dot:'#6366f1' }
            return (
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 20px', borderBottom:idx<userCards.length-1?'1px solid var(--border)':'none', transition:'background 0.15s', flexWrap:'wrap' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='color-mix(in srgb,var(--secondary) 50%,transparent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:tc.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', flexShrink:0, boxShadow:`0 3px 10px ${tc.dot}30` }}>
                  {u.name.charAt(0)}
                </div>
                <div style={{ minWidth:140 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', margin:'0 0 2px' }}>{u.name}</p>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {u.team && <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:999, background:u.team==='OAO'?'rgba(59,130,246,0.1)':'rgba(139,92,246,0.1)', color:u.team==='OAO'?'#2563eb':'#7c3aed' }}>Time {u.team}</span>}
                    <span style={{ fontSize:9, color:'var(--muted-foreground)' }}>{u.email}</span>
                  </div>
                </div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{u.done}/{u.total} etapas</span>
                    <span style={{ fontSize:11, fontWeight:800, color:u.pct===100?'#22c55e':'var(--foreground)' }}>{u.pct}%</span>
                  </div>
                  <MiniBar pct={u.pct} color={u.pct===100?'#22c55e':tc.dot} />
                </div>
                <div style={{ display:'flex', gap:12, flexShrink:0, flexWrap:'wrap' }}>
                  {u.avg!==null && <div style={{ textAlign:'center' }}><p style={{ fontSize:13, fontWeight:800, color:u.avg>=70?'#22c55e':'#f59e0b', margin:0 }}>{u.avg}%</p><p style={{ fontSize:9, color:'var(--muted-foreground)', margin:0 }}>Score</p></div>}
                  <div style={{ textAlign:'center' }}><p style={{ fontSize:13, fontWeight:800, color:'var(--foreground)', margin:0 }}>{u.attempts}</p><p style={{ fontSize:9, color:'var(--muted-foreground)', margin:0 }}>Tentativas</p></div>
                  {u.pct===100 && <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:999, background:'rgba(34,197,94,0.1)', color:'#16a34a', border:'1px solid rgba(34,197,94,0.2)', alignSelf:'center' }}>✓ Concluído</span>}
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
