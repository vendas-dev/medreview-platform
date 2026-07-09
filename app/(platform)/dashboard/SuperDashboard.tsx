'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Users, GraduationCap, TrendingUp, Zap, MessageSquare,
  BookOpen, Trophy, CheckCircle2, Activity, Circle,
  ArrowRight, BarChart2, Clock, Target
} from 'lucide-react'

// ── Mini bar ────────────────────────────────────────────────
function Bar({ pct, color, h = 6 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.8s ease' }} />
    </div>
  )
}

// ── Sparkline SVG ───────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  const w   = 80; const h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        points={pts.join(' ')} />
    </svg>
  )
}

// ── Bar chart simples ────────────────────────────────────────
function BarChart({ data }: { data: { day: string; completions: number; quizzes: number }[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.completions, d.quizzes]), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, paddingTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
            <div style={{ flex: 1, background: 'rgba(99,102,241,0.7)', borderRadius: '3px 3px 0 0', height: `${(d.completions / maxVal) * 100}%`, minHeight: d.completions > 0 ? 3 : 0, transition: 'height 0.6s ease' }} />
            <div style={{ flex: 1, background: 'rgba(34,197,94,0.7)', borderRadius: '3px 3px 0 0', height: `${(d.quizzes / maxVal) * 100}%`, minHeight: d.quizzes > 0 ? 3 : 0, transition: 'height 0.6s ease' }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{d.day}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, grad, color, href, spark }: any) {
  return (
    <Link href={href ?? '#'} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s', cursor: href ? 'pointer' : 'default' }}
        onMouseEnter={e => { if (href) { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--shadow-md)'; el.style.borderColor = color + '40' } }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--shadow-sm)'; el.style.borderColor = 'var(--border)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${color}35` }}>
            <Icon size={16} style={{ color: '#fff' }} />
          </div>
          {spark && <Sparkline data={spark} color={color} />}
        </div>
        <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color, marginTop: 4, fontWeight: 700 }}>{sub}</p>}
      </div>
    </Link>
  )
}

// ── Presença online dot ──────────────────────────────────────
function OnlineDot({ online }: { online: boolean }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#22c55e' : 'var(--border)', boxShadow: online ? '0 0 6px #22c55e' : 'none', transition: 'all 0.3s' }} />
      {online && <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid #22c55e', opacity: 0.4, animation: 'pulse 2s ease-in-out infinite' }} />}
    </div>
  )
}

// ── Tempo relativo ───────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// ── Avatar mini ──────────────────────────────────────────────
function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.38), fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials || '?'}
    </div>
  )
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  userName: string
  stats: {
    totalUsers: number; totalSteps: number; totalMaterials: number
    activeOnboarding: number; completedCount: number; avgCompletion: number
    onlineCount: number; passedRate: number; totalConversations: number
  }
  users: any[]
  progressByDay: { day: string; completions: number; quizzes: number }[]
}

export function SuperDashboard({ userName, stats, users, progressByDay }: Props) {
  const [activities, setActivities] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [loadingActivity, setLoadingActivity] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Busca atividade recente
  useEffect(() => {
    fetch('/api/admin/activity')
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoadingActivity(false) })
      .catch(() => setLoadingActivity(false))
  }, [])

  // Heartbeat + busca presença online a cada 30s
  useEffect(() => {
    async function tick() {
      await fetch('/api/admin/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: '/dashboard' }) })
      const r = await fetch('/api/admin/presence')
      const d = await r.json()
      setOnlineUsers(new Set((d.online ?? []).map((p: any) => p.user_id)))
    }
    tick()
    intervalRef.current = setInterval(tick, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const now   = new Date()
  const hour  = now.getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const sparkData = progressByDay.map(d => d.completions)

  // Usuários online com detalhes
  const usersWithPresence = users.map(u => ({ ...u, isOnline: onlineUsers.has(u.id) }))
  const onlineList = usersWithPresence.filter(u => u.isOnline)

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 68%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(20px,3vw,32px)', marginBottom: 24, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(79,70,229,0.35)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                🚀 Plataforma Operacional · Time Comercial
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              {greet}, {userName}!
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', margin: '0 0 18px', maxWidth: 440, lineHeight: 1.6 }}>
              Central de controle da MedReview. Tudo que você precisa saber em um só lugar.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Sistema online</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <Users size={12} style={{ color: '#fff' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{onlineList.length} online agora</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>MedReview · {now.getFullYear()}</span>
              </div>
            </div>
          </div>
          {/* Mini gauge de progresso geral */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 96, height: 96 }}>
              <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
                <circle cx="48" cy="48" r="38" fill="none" stroke="#4ade80" strokeWidth="10"
                  strokeDasharray={`${(stats.avgCompletion / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{stats.avgCompletion}%</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>conclusão</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs — grid de 4 + 4 */}
      <div className="sd-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard icon={Users}         label="Usuários ativos"        value={stats.totalUsers}           sub={`${onlineList.length} online agora`}        grad="linear-gradient(135deg,#3b82f6,#4f46e5)"   color="#3b82f6"  href="/admin"                  spark={sparkData} />
        <KpiCard icon={GraduationCap} label="Trilhas criadas"        value={stats.totalSteps}           sub={`${stats.totalMaterials} materiais`}         grad="linear-gradient(135deg,#8b5cf6,#a855f7)"   color="#8b5cf6"  href="/onboarding/trilha"       />
        <KpiCard icon={Activity}      label="Onboardings ativos"     value={stats.activeOnboarding}     sub="em andamento"                               grad="linear-gradient(135deg,#f59e0b,#ef4444)"   color="#f59e0b"  href="/onboarding/dashboard"    />
        <KpiCard icon={Trophy}        label="Conclusões"             value={stats.completedCount}       sub={`de ${stats.totalUsers} usuários`}          grad="linear-gradient(135deg,#22c55e,#16a34a)"   color="#22c55e"  href="/onboarding/dashboard"    />
        <KpiCard icon={Target}        label="Média de conclusão"     value={`${stats.avgCompletion}%`}  sub="todos os usuários"                          grad="linear-gradient(135deg,#6366f1,#8b5cf6)"   color="#6366f1"  href="/onboarding/dashboard"    />
        <KpiCard icon={Zap}           label="Aprovação 1ª tentativa" value={`${stats.passedRate}%`}     sub="quizzes"                                    grad="linear-gradient(135deg,#ec4899,#8b5cf6)"   color="#ec4899"  href="/onboarding/dashboard"    />
        <KpiCard icon={MessageSquare} label="Conversas Medy"       value={stats.totalConversations}   sub="total de conversas"                         grad="linear-gradient(135deg,#14b8a6,#3b82f6)"   color="#14b8a6"  href="/onboarding/copilot"      />
        <KpiCard icon={BookOpen}      label="Materiais disponíveis"  value={stats.totalMaterials}       sub="vídeos e documentos"                        grad="linear-gradient(135deg,#f97316,#ef4444)"   color="#f97316"  href="/onboarding/videoaulas"   />
      </div>

      {/* Row 2: Atividade semanal + Online agora */}
      <div className="sd-row2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, marginBottom: 16 }}>

        {/* Gráfico de atividade semanal */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={15} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Atividade — últimos 7 dias</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(99,102,241,0.7)' }} />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Conclusões</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(34,197,94,0.7)' }} />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Quizzes</span>
              </div>
            </div>
          </div>
          <BarChart data={progressByDay} />
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[
              { label: 'Total esta semana', value: progressByDay.reduce((s, d) => s + d.completions, 0), unit: 'conclusões', color: '#6366f1' },
              { label: 'Quizzes feitos', value: progressByDay.reduce((s, d) => s + d.quizzes, 0), unit: 'tentativas', color: '#22c55e' },
              { label: 'Média diária', value: Math.round(progressByDay.reduce((s, d) => s + d.completions, 0) / 7), unit: 'conclusões/dia', color: '#f59e0b' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, minWidth: 80 }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: item.color, margin: 0, letterSpacing: '-0.02em' }}>{item.value}</p>
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Online agora */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Online agora</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 9px', borderRadius: 999 }}>
              {onlineList.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }} className="scrollbar-hide">
            {onlineList.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '20px 0' }}>
                Nenhum usuário ativo no momento
              </p>
            ) : (
              onlineList.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 11, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={u.name} url={u.avatar_url} size={30} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', border: '1.5px solid var(--card)', boxShadow: '0 0 5px #22c55e' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>Time {u.team ?? '—'}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>{u.pct}%</span>
                </div>
              ))
            )}
          </div>

          {/* Todos os usuários com indicador */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Todos os usuários</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }} className="scrollbar-hide">
              {usersWithPresence.slice(0, 8).map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <OnlineDot online={u.isOnline} />
                  <span style={{ fontSize: 12, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{u.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Atividade recente + Progresso individual */}
      <div className="sd-row3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>

        {/* Feed de atividade recente */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Atividade recente</p>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>últimos 7 dias</span>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }} className="scrollbar-hide">
            {loadingActivity ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#6366f1', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
              </div>
            ) : activities.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhuma atividade nos últimos 7 dias.</p>
              </div>
            ) : activities.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 18px', borderBottom: i < activities.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--secondary) 40%, transparent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                {/* Ícone */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${a.color}18`, border: `1px solid ${a.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1.4 }}>
                    <strong style={{ fontWeight: 700 }}>{a.user?.name ?? 'Alguém'}</strong>{' '}
                    {a.type === 'completion'   && 'concluiu a trilha'}
                    {a.type === 'quiz'         && 'passou no quiz de'}
                    {a.type === 'video'        && 'assistiu'}
                    {a.type === 'step_created' && 'trilha criada:'}
                    {' '}<span style={{ color: a.color, fontWeight: 600 }}>"{a.subject}"</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{timeAgo(a.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progresso individual */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} style={{ color: '#22c55e' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Progresso individual</p>
            </div>
            <Link href="/onboarding/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
              Ver tudo <ArrowRight size={11} />
            </Link>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }} className="scrollbar-hide">
            {usersWithPresence.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhum usuário cadastrado.</p>
              </div>
            ) : usersWithPresence.slice(0, 12).map((u, i) => {
              const tc = u.team === 'OAO'
                ? { dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
                : u.team === 'R1'
                  ? { dot: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' }
                  : { dot: '#6366f1', bg: 'rgba(99,102,241,0.1)' }

              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < usersWithPresence.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--secondary) 40%, transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={u.name} url={u.avatar_url} size={32} />
                    {u.isOnline && (
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', border: '1.5px solid var(--card)' }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      {u.team && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: tc.bg, color: tc.dot, flexShrink: 0 }}>{u.team}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Bar pct={u.pct} color={u.pct === 100 ? '#22c55e' : tc.dot} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: u.pct === 100 ? '#22c55e' : 'var(--foreground)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{u.pct}%</span>
                    </div>
                  </div>

                  {u.pct === 100 && (
                    <CheckCircle2 size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @media (max-width: 1024px) {
          .sd-row2 { grid-template-columns: 1fr !important; }
          .sd-row3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .sd-kpi  { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .sd-kpi  { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
