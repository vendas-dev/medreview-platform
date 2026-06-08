'use client'
import { Users, MessageSquare, Play, Trophy, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react'

interface Props {
  users: any[]; steps: any[]; progress: any[]
  totalConversations: number; totalMessages: number
  videoViews: any[]; attempts: any[]
}

export function DashboardView({ users, steps, progress, totalConversations, totalMessages, videoViews, attempts }: Props) {
  const totalUsers     = users.length
  const completedUsers = new Set(progress.filter(p=>p.status==='concluido').map(p=>p.user_id)).size
  const activeUsers    = new Set(progress.filter(p=>p.status==='em_andamento').map(p=>p.user_id)).size
  const videosCompleted = videoViews.filter(v=>v.completed).length
  const oaoUsers       = users.filter(u=>u.team==='OAO')
  const r1Users        = users.filter(u=>u.team==='R1')

  const userProgress = users.map(u => {
    const up    = progress.filter(p=>p.user_id===u.id)
    const done  = up.filter(p=>p.status==='concluido').length
    const tSteps = steps.filter(s=>s.team===u.team||s.team==='ambos')
    const pct   = tSteps.length>0 ? Math.round((done/tSteps.length)*100) : 0
    const scores = up.filter(p=>p.quiz_score!=null)
    const avg   = scores.length>0 ? Math.round(scores.reduce((a:number,p:any)=>a+p.quiz_score,0)/scores.length) : 0
    return { ...u, done, total:tSteps.length, pct, avg }
  })

  const stats = [
    { label:'Usuários',       value:totalUsers,      icon:Users,        grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', sub:`${oaoUsers.length} OAO · ${r1Users.length} R1`, color:'#3b82f6' },
    { label:'Concluíram',     value:completedUsers,  icon:Trophy,       grad:'linear-gradient(135deg,#22c55e,#16a34a)', sub:`${totalUsers>0?Math.round(completedUsers/totalUsers*100):0}% do total`, color:'#22c55e' },
    { label:'Em andamento',   value:activeUsers,     icon:Clock,        grad:'linear-gradient(135deg,#f59e0b,#ef4444)', sub:undefined, color:'#f59e0b' },
    { label:'Conversas',      value:totalConversations, icon:MessageSquare, grad:'linear-gradient(135deg,#8b5cf6,#a855f7)', sub:`${totalMessages} mensagens`, color:'#8b5cf6' },
    { label:'Vídeos assistidos', value:videosCompleted, icon:Play,      grad:'linear-gradient(135deg,#ec4899,#8b5cf6)', sub:undefined, color:'#ec4899' },
  ]

  const teamSections = [
    { label:'Time OAO', users:oaoUsers, grad:'linear-gradient(135deg,#1e40af,#3b82f6)', dot:'#3b82f6', emoji:'🔵' },
    { label:'Time R1',  users:r1Users,  grad:'linear-gradient(135deg,#5b21b6,#7c3aed)', dot:'#8b5cf6', emoji:'🟣' },
  ]

  return (
    <div style={{ padding:'clamp(14px,3vw,28px)', maxWidth:1200, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 70%,#7c3aed 100%)', borderRadius:20, padding:'22px 28px', marginBottom:24, position:'relative', overflow:'hidden', boxShadow:'0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 10px', borderRadius:999, background:'rgba(255,255,255,0.15)', color:'#fff', backdropFilter:'blur(8px)' }}>
            📊 Analytics
          </span>
          <h1 style={{ fontSize:'clamp(18px,3vw,24px)', fontWeight:900, color:'#fff', margin:'8px 0 4px', letterSpacing:'-0.025em' }}>Dashboard de Acompanhamento</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', margin:0 }}>Métricas em tempo real do programa de onboarding</p>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(180px,100%),1fr))', gap:14, marginBottom:24 }}>
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 20px', position:'relative', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', transition:'all 0.18s' }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-2px)'; el.style.boxShadow=`0 8px 24px rgba(0,0,0,0.08)` }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.transform='none'; el.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:s.grad }} />
              <div style={{ width:40, height:40, borderRadius:11, background:s.grad, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:`0 4px 12px ${s.color}35` }}>
                <Icon size={17} style={{ color:'#fff' }} />
              </div>
              <p style={{ fontSize:30, fontWeight:900, color:'var(--foreground)', margin:'0 0 3px', lineHeight:1, letterSpacing:'-0.03em' }}>{s.value}</p>
              <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>{s.label}</p>
              {s.sub && <p style={{ fontSize:10, color:s.color, marginTop:5, fontWeight:700 }}>{s.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* Times */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(340px,100%),1fr))', gap:16, marginBottom:24 }}>
        {teamSections.map(t => {
          const teamUsers = userProgress.filter(u => u.team === (t.label === 'Time OAO' ? 'OAO' : 'R1'))
          return (
            <div key={t.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ background:t.grad, padding:'14px 20px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>{t.emoji}</span>
                <div>
                  <p style={{ fontSize:14, fontWeight:800, color:'#fff', margin:0 }}>{t.label}</p>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.75)', margin:0 }}>{t.users.length} usuário{t.users.length!==1?'s':''}</p>
                </div>
              </div>
              <div style={{ padding:'16px 20px' }}>
                {teamUsers.length === 0
                  ? <p style={{ fontSize:13, color:'var(--muted-foreground)', textAlign:'center', padding:'16px 0' }}>Nenhum usuário neste time.</p>
                  : teamUsers.map(u => (
                    <div key={u.id} style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:t.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>
                            {u.name.charAt(0)}
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--foreground)' }}>{u.name}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          {u.pct===100 && <CheckCircle2 size={12} style={{ color:'#22c55e' }} />}
                          <span style={{ fontSize:12, fontWeight:800, color:u.pct===100?'#22c55e':t.dot }}>{u.pct}%</span>
                        </div>
                      </div>
                      <div style={{ height:7, borderRadius:999, background:'var(--border)', overflow:'hidden', marginBottom:4 }}>
                        <div style={{ height:'100%', borderRadius:999, background:u.pct===100?'#22c55e':t.grad, width:`${u.pct}%`, transition:'width 0.6s ease' }} />
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <span style={{ fontSize:10, color:'var(--muted-foreground)' }}>{u.done}/{u.total} etapas</span>
                        {u.avg>0 && <span style={{ fontSize:10, color:'var(--muted-foreground)' }}>Quiz: {u.avg}%</span>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela individual */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg,rgba(79,70,229,0.04) 0%,transparent 100%)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <TrendingUp size={14} style={{ color:'#6366f1' }} />
            <span style={{ fontSize:11, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Progresso individual</span>
          </div>
          <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{userProgress.length} usuários</span>
        </div>
        {userProgress.length === 0
          ? <div style={{ padding:'40px 24px', textAlign:'center' }}><p style={{ fontSize:13, color:'var(--muted-foreground)' }}>Nenhum usuário cadastrado.</p></div>
          : userProgress.map((u, i) => (
            <div key={u.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom: i < userProgress.length-1 ? '1px solid var(--border)' : 'none', transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='color-mix(in srgb, var(--secondary) 50%, transparent)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', flexShrink:0, boxShadow:'0 3px 10px rgba(79,70,229,0.25)' }}>
                {u.name.charAt(0)}
              </div>
              <div style={{ minWidth:160 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--foreground)', margin:'0 0 2px' }}>{u.name}</p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color:'var(--muted-foreground)' }}>{u.email}</span>
                  {u.team && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:999, background: u.team==='OAO'?'rgba(59,130,246,0.1)':'rgba(139,92,246,0.1)', color: u.team==='OAO'?'#3b82f6':'#8b5cf6' }}>Time {u.team}</span>}
                </div>
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{u.done}/{u.total} etapas</span>
                  <span style={{ fontSize:11, fontWeight:800, color:u.pct===100?'#22c55e':'var(--foreground)' }}>{u.pct}%</span>
                </div>
                <div style={{ height:7, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:999, background:u.pct===100?'linear-gradient(90deg,#22c55e,#16a34a)':'linear-gradient(90deg,#4f46e5,#7c3aed)', width:`${u.pct}%`, transition:'width 0.6s' }} />
                </div>
              </div>
              {u.avg > 0 && <span style={{ fontSize:11, color:'var(--muted-foreground)', flexShrink:0, whiteSpace:'nowrap' }}>Quiz: {u.avg}%</span>}
              {u.pct === 100 && <span style={{ fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:999, background:'rgba(34,197,94,0.12)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.25)', flexShrink:0 }}>✓ Concluído</span>}
            </div>
          ))
        }
      </div>
    </div>
  )
}
