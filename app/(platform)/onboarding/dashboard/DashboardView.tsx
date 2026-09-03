'use client'
import { useState, useMemo } from 'react'
import { Users, Trophy, Clock, MessageSquare, TrendingUp, AlertTriangle, CheckCircle2, BarChart3, Target, Filter, ChevronDown, X, Award, ThumbsDown } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'

interface Props {
  users: any[]; steps: any[]; progress: any[]
  totalConversations: number; totalMessages: number
  videoViews: any[]; attempts: any[]
}

const TOOLTIP_STYLE = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--foreground)' }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', ...style }}>
      {children}
    </div>
  )
}

function CardTitle({ icon: Icon, label, sub, color }: { icon: any; label: string; sub?: string; color: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={14} style={{ color }} />
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{label}</p>
      </div>
      {sub && <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '3px 0 0 22px' }}>{sub}</p>}
    </div>
  )
}

function Empty({ text = 'Sem dados ainda.' }: { text?: string }) {
  return <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '24px 0' }}>{text}</p>
}

const teamColor = (t: string) => t === 'OAO'
  ? { grad: 'linear-gradient(135deg,#3b82f6,#4f46e5)', dot: '#3b82f6' }
  : { grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)', dot: '#8b5cf6' }

// ── Avatar — mostra a foto do usuário quando existe; cai pra iniciais com
// gradiente do time só quando não tem foto cadastrada.
function Avatar({ name, url, size, grad }: { name: string; url?: string | null; size: number; grad: string }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {name.charAt(0)}
    </div>
  )
}

// ── Ranking de pessoas (aprovação / erros) — visual de leaderboard, não
// gráfico de barras, porque o assunto aqui são PESSOAS competindo, não
// uma métrica estrutural. Medalha nos 3 primeiros.
function PeopleRanking({ icon, label, sub, color, items, metric }: {
  icon: any; label: string; sub: string; color: string
  items: { id: string; name: string; team: string; avatarUrl?: string | null; value: number; suffix: string }[]
  metric: (v: number) => string
}) {
  return (
    <Card>
      <CardTitle icon={icon} label={label} sub={sub} color={color} />
      {items.length === 0 ? <Empty /> : (
        <div>
          {items.map((u, i) => {
            const tc = teamColor(u.team)
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ width: 22, textAlign: 'center', fontSize: medal ? 15 : 11, fontWeight: 900, color: medal ? undefined : 'var(--muted-foreground)', flexShrink: 0 }}>
                  {medal ?? i + 1}
                </span>
                <Avatar name={u.name} url={u.avatarUrl} size={28} grad={tc.grad} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                  <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: u.team === 'OAO' ? 'rgba(59,130,246,.1)' : 'rgba(139,92,246,.1)', color: u.team === 'OAO' ? '#2563eb' : '#7c3aed' }}>Time {u.team}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, color, flexShrink: 0 }}>{metric(u.value)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Gráfico de barras horizontais — substitui as antigas "linhas de
// progresso" empilhadas por algo com cara de gráfico de verdade.
function truncateLabel(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

// Rótulo customizado do eixo Y — trunca textos longos (o eixo padrão do
// recharts cortava sem "…" e ficava com aparência de erro), com fonte maior
// e mais legível. O nome completo continua disponível no tooltip ao passar
// o mouse na barra.
function YAxisLabel(props: any) {
  const { x, y, payload } = props
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--foreground)">
      {truncateLabel(String(payload.value), 24)}
    </text>
  )
}

function HBarChart({ data, dataKey, labelKey, colorFn, unit = '%', height }: {
  data: any[]; dataKey: string; labelKey: string; colorFn: (v: number) => string; unit?: string; height?: number
}) {
  if (data.length === 0) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={height ?? data.length * 40 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 46, bottom: 4, left: 4 }} barCategoryGap={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={labelKey} width={172} tick={<YAxisLabel />} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--secondary)' }} labelFormatter={(v) => v} />
        <Bar dataKey={dataKey} radius={[0, 7, 7, 0]} maxBarSize={18}>
          {data.map((d, i) => <Cell key={i} fill={colorFn(d[dataKey])} />)}
          <LabelList dataKey={dataKey} position="right" formatter={(v: number) => `${v}${unit}`} style={{ fontSize: 12, fontWeight: 800, fill: 'var(--foreground)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
  const totalU = filteredUsers.length

  // ── Primeira tentativa de cada usuário em cada etapa — usada tanto pro
  // ranking de erro por etapa quanto pros rankings de pessoas. "Primeira"
  // = created_at mais antigo entre todas as tentativas daquele usuário
  // naquela etapa específica (reincidências não contam aqui).
  const firstArr = useMemo(() => {
    const acc: Record<string, any> = {}
    filteredAttempts.forEach((a: any) => {
      const key = `${a.user_id}-${a.step_id}`
      if (!acc[key] || new Date(a.created_at) < new Date(acc[key].created_at)) acc[key] = a
    })
    return Object.values(acc) as any[]
  }, [filteredAttempts])
  const passedFirst = firstArr.filter((a: any) => a.passed).length
  const firstPassRate = firstArr.length > 0 ? Math.round((passedFirst / firstArr.length) * 100) : 0

  // ── Cartão por usuário — base de tudo daqui pra baixo. `isComplete`
  // exige TODAS as etapas aplicáveis ao time dele concluídas (não só uma
  // etapa qualquer — esse era o bug do "14 concluíram"). `hasStarted`
  // marca quem já tocou no onboarding de alguma forma, usado pra tirar
  // gente antiga que nunca vai fazer da tabela de desempenho individual.
  const userCards = useMemo(() => filteredUsers.map(u => {
    const up   = filteredProgress.filter(p => p.user_id === u.id)
    const ua   = filteredAttempts.filter((a: any) => a.user_id === u.id)
    const done = up.filter(p => p.status === 'concluido').length
    const ts   = steps.filter(s => s.team === u.team || s.team === 'ambos')
    const pct  = ts.length > 0 ? Math.round((done / ts.length) * 100) : 0
    const avg  = ua.length > 0 ? Math.round(ua.reduce((x: number, a: any) => x + a.score, 0) / ua.length) : null
    const hasStarted = done > 0 || up.some(p => p.status === 'em_andamento') || ua.length > 0
    const isComplete = ts.length > 0 && done === ts.length
    const myFirst = firstArr.filter((a: any) => a.user_id === u.id)
    const failedFirst = myFirst.filter((a: any) => !a.passed).length
    const passRate = myFirst.length > 0 ? Math.round((myFirst.filter((a: any) => a.passed).length / myFirst.length) * 100) : null
    return { ...u, done, total: ts.length, pct, avg, attempts: ua.length, hasStarted, isComplete, failedFirst, passRate, quizAttempts: myFirst.length }
  }), [filteredUsers, filteredProgress, filteredAttempts, steps, firstArr])

  // ── Visão geral — três grupos MUTUAMENTE EXCLUSIVOS que somam totalU.
  // "Concluíram" agora exige 100% da trilha (o bug antigo contava qualquer
  // etapa concluída, por isso aparecia gente que só fez uma etapa).
  const completedU  = userCards.filter(u => u.isComplete).length
  const activeU     = userCards.filter(u => u.hasStarted && !u.isComplete).length
  const notStartedU = totalU - completedU - activeU
  const completionRate = totalU > 0 ? Math.round((completedU / totalU) * 100) : 0

  // ── Só pros KPIs "Participantes" e "Taxa de conclusão" do topo — tem
  // muita gente cadastrada que nunca vai iniciar o onboarding (contas
  // antigas, etc.), e contar ela no denominador diluía a taxa de conclusão
  // artificialmente. Aqui a base é só quem já tocou no onboarding.
  const startedCount = activeU + completedU
  const completionRateStarted = startedCount > 0 ? Math.round((completedU / startedCount) * 100) : 0

  const overviewData = [
    { label: 'Concluíram (100%)', value: completedU,  color: '#22c55e' },
    { label: 'Em andamento',      value: activeU,     color: '#f59e0b' },
    { label: 'Não iniciaram',     value: notStartedU, color: '#94a3b8' },
  ].filter(d => d.value > 0)

  // ── Etapas com maior erro na 1ª tentativa — só entre quem já tentou.
  const stepErrorMap: Record<string, { title: string; total: number; failed: number }> = {}
  firstArr.forEach((a: any) => {
    const step = steps.find(s => s.id === a.step_id)
    if (!step) return
    if (!stepErrorMap[a.step_id]) stepErrorMap[a.step_id] = { title: step.title, total: 0, failed: 0 }
    stepErrorMap[a.step_id].total++
    if (!a.passed) stepErrorMap[a.step_id].failed++
  })
  const errorRanking = Object.values(stepErrorMap)
    .map(e => ({ ...e, rate: e.total > 0 ? Math.round((e.failed / e.total) * 100) : 0 }))
    .filter(e => e.total > 0).sort((a, b) => b.rate - a.rate).slice(0, 8)

  // ── Conclusão por etapa — corrigido pra dividir só pelas pessoas às
  // quais aquela etapa se aplica (o time dela, ou "ambos"), não pelo total
  // geral filtrado. Sem isso, etapa exclusiva de um time sempre parecia
  // com % artificialmente baixa quando o filtro incluía os dois times.
  const stepProgressData = steps.map(s => {
    const applicable = filteredUsers.filter(u => s.team === u.team || s.team === 'ambos')
    const applicableIds = new Set(applicable.map(u => u.id))
    const done = filteredProgress.filter(p => p.step_id === s.id && p.status === 'concluido' && applicableIds.has(p.user_id)).length
    const total = applicable.length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { title: s.title, pct, done, total }
  }).filter(s => s.total > 0).sort((a, b) => b.pct - a.pct)

  const stepScores = steps.map(s => {
    const sa = filteredAttempts.filter((a: any) => a.step_id === s.id)
    const avg = sa.length > 0 ? Math.round(sa.reduce((x: number, a: any) => x + a.score, 0) / sa.length) : null
    return { title: s.title, avg, attempts: sa.length }
  }).filter(s => s.avg !== null).sort((a, b) => (b.avg as number) - (a.avg as number))

  // ── Rankings de pessoas — só entre quem já respondeu pelo menos 1 quiz.
  const withQuiz = userCards.filter(u => u.quizAttempts > 0)
  const rankingApproval = [...withQuiz].filter(u => u.passRate !== null)
    .sort((a, b) => (b.passRate as number) - (a.passRate as number)).slice(0, 8)
  const rankingErrors = [...withQuiz].filter(u => u.failedFirst > 0)
    .sort((a, b) => b.failedFirst - a.failedFirst).slice(0, 8)

  // ── Desempenho individual — só quem já iniciou (sem poluir com gente
  // antiga que nunca vai fazer o onboarding), dividido por time porque as
  // trilhas de OAO e R1 são estruturalmente diferentes.
  const startedCards = userCards.filter(u => u.hasStarted)
  const oaoCards = startedCards.filter(u => u.team === 'OAO').sort((a, b) => b.pct - a.pct)
  const r1Cards  = startedCards.filter(u => u.team === 'R1').sort((a, b) => b.pct - a.pct)

  function PerformanceRow({ u, tc }: { u: any; tc: { grad: string; dot: string } }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <Avatar name={u.name} url={u.avatar_url} size={32} grad={tc.grad} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', minWidth: 130, flexShrink: 0 }}>{u.name}</span>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: u.pct === 100 ? '#22c55e' : tc.dot, width: `${u.pct}%`, transition: 'width .5s' }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: u.pct === 100 ? '#22c55e' : 'var(--foreground)', minWidth: 60, textAlign: 'right' }}>{u.done}/{u.total} · {u.pct}%</span>
        </div>
        {u.avg !== null && (
          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: u.avg >= 70 ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)', color: u.avg >= 70 ? '#16a34a' : '#d97706', flexShrink: 0 }}>
            {u.avg}% score
          </span>
        )}
        {u.pct === 100 && <CheckCircle2 size={15} style={{ color: '#22c55e', flexShrink: 0 }} />}
      </div>
    )
  }

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

      {/* Row 1: 4 KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          { icon:Users,          label:'Participantes',       value:startedCount,     sub:`de ${totalU} cadastrados no time`, grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', color:'#3b82f6' },
          { icon:Trophy,         label:'Taxa de conclusão',   value:`${completionRateStarted}%`, sub:`${completedU}/${startedCount} de quem começou`,   grad:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#22c55e' },
          { icon:Clock,          label:'Em andamento',        value:activeU,          sub:`${notStartedU} não iniciaram`, grad:'linear-gradient(135deg,#8b5cf6,#a855f7)', color:'#8b5cf6' },
          { icon:MessageSquare,  label:'Conversas Medy',    value:totalConversations, sub:`${totalMessages} mensagens`, grad:'linear-gradient(135deg,#ec4899,#8b5cf6)', color:'#ec4899' },
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

      {/* Row 2: Visão Geral (donut) + Etapas com maior erro (barras) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <Card style={{ display:'flex', flexDirection:'column' }}>
          <CardTitle icon={Target} label="Visão Geral" sub="Conclusão = 100% da trilha do próprio time, não só 1 etapa" color="#6366f1" />
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:28 }}>
            <div style={{ position:'relative', width:150, height:150, flexShrink:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overviewData.length > 0 ? overviewData : [{ label:'Sem dados', value:1, color:'var(--border)' }]}
                    dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3} strokeWidth={0}>
                    {(overviewData.length > 0 ? overviewData : [{ color:'var(--border)' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} pessoa${v !== 1 ? 's' : ''}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <span style={{ fontSize:22, fontWeight:900, color:'var(--foreground)', lineHeight:1 }}>{completionRate}%</span>
                <span style={{ fontSize:9, color:'var(--muted-foreground)', fontWeight:700, marginTop:2 }}>completo</span>
              </div>
            </div>
            <div style={{ width:190, flexShrink:0 }}>
              {[
                { label:'Concluíram (100%)', value:completedU,  color:'#22c55e' },
                { label:'Em andamento',      value:activeU,     color:'#f59e0b' },
                { label:'Não iniciaram',     value:notStartedU, color:'#94a3b8' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0' }}>
                  <span style={{ width:9, height:9, borderRadius:'50%', background:item.color, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:12, color:'var(--muted-foreground)' }}>{item.label}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:'var(--foreground)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle icon={AlertTriangle} label="Etapas com maior erro" sub="% de quem errou o quiz na 1ª tentativa (reincidência não conta)" color="#ef4444" />
          <HBarChart data={errorRanking} dataKey="rate" labelKey="title" colorFn={v => v >= 60 ? '#ef4444' : v >= 30 ? '#f59e0b' : '#22c55e'} />
        </Card>
      </div>

      {/* Row 3: Conclusão por etapa + Score médio */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <Card>
          <CardTitle icon={BarChart3} label="Conclusão por etapa" sub="% de quem tem essa etapa no próprio time e já concluiu" color="#4f46e5" />
          <HBarChart data={stepProgressData.slice(0, 8)} dataKey="pct" labelKey="title" colorFn={v => v === 100 ? '#22c55e' : '#4f46e5'} />
        </Card>

        <Card>
          <CardTitle icon={TrendingUp} label="Score médio no quiz por etapa" sub="Média de todas as tentativas, não só a 1ª" color="#22c55e" />
          <HBarChart data={stepScores.slice(0, 8).map(s => ({ title: s.title, avg: s.avg ?? 0 }))} dataKey="avg" labelKey="title" colorFn={v => v >= 70 ? '#22c55e' : '#f59e0b'} />
        </Card>
      </div>

      {/* Row 4: Rankings de pessoas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <PeopleRanking icon={Award} label="Ranking de aprovação" sub="Maior % de acerto na 1ª tentativa dos quizzes" color="#22c55e"
          items={rankingApproval.map(u => ({ id: u.id, name: u.name, team: u.team, avatarUrl: u.avatar_url, value: u.passRate as number, suffix: '%' }))}
          metric={v => `${v}%`} />
        <PeopleRanking icon={ThumbsDown} label="Ranking de erros" sub="Mais respostas erradas na 1ª tentativa dos quizzes" color="#ef4444"
          items={rankingErrors.map(u => ({ id: u.id, name: u.name, team: u.team, avatarUrl: u.avatar_url, value: u.failedFirst, suffix: '' }))}
          metric={v => `${v} erro${v !== 1 ? 's' : ''}`} />
      </div>

      {/* Row 5: Desempenho individual — dividido por time, só quem já iniciou */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
          <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'color-mix(in srgb, var(--secondary) 60%, var(--card))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Users size={13} style={{ color:'#3b82f6' }} />
              <span style={{ fontSize:11, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Desempenho individual — Time OAO</span>
            </div>
            <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{oaoCards.length} já iniciaram</span>
          </div>
          {oaoCards.length === 0
            ? <div style={{ padding:'32px 24px' }}><Empty text="Ninguém do time OAO iniciou o onboarding ainda." /></div>
            : oaoCards.map(u => <PerformanceRow key={u.id} u={u} tc={teamColor('OAO')} />)}
        </div>

        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
          <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'color-mix(in srgb, var(--secondary) 60%, var(--card))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Users size={13} style={{ color:'#8b5cf6' }} />
              <span style={{ fontSize:11, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Desempenho individual — Time R1</span>
            </div>
            <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>{r1Cards.length} já iniciaram</span>
          </div>
          {r1Cards.length === 0
            ? <div style={{ padding:'32px 24px' }}><Empty text="Ninguém do time R1 iniciou o onboarding ainda." /></div>
            : r1Cards.map(u => <PerformanceRow key={u.id} u={u} tc={teamColor('R1')} />)}
        </div>
      </div>
    </div>
  )
}
