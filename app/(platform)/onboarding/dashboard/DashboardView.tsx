'use client'
import { Users, MessageSquare, Play, Trophy } from 'lucide-react'

interface Props {
  users: any[]
  progress: any[]
  totalConversations: number
  totalMessages: number
  videoViews: any[]
  steps: any[]
}

export function DashboardView({ users, progress, totalConversations, totalMessages, videoViews, steps }: Props) {
  const totalUsers     = users.length
  const completedUsers = new Set(progress.filter(p => p.status === 'concluido').map(p => p.user_id)).size
  const activeUsers    = new Set(progress.filter(p => p.status === 'em_andamento').map(p => p.user_id)).size
  const videosCompleted = videoViews.filter(v => v.completed).length
  const oaoUsers = users.filter(u => u.team === 'OAO')
  const r1Users  = users.filter(u => u.team === 'R1')

  const userProgress = users.map(u => {
    const userProgs  = progress.filter(p => p.user_id === u.id)
    const completed  = userProgs.filter(p => p.status === 'concluido').length
    const teamSteps  = steps.filter(s => s.team === u.team || s.team === 'ambos')
    const pct        = teamSteps.length > 0 ? Math.round((completed / teamSteps.length) * 100) : 0
    const scores     = userProgs.filter(p => p.quiz_score !== null)
    const avgScore   = scores.length > 0 ? Math.round(scores.reduce((a: number, p: any) => a + p.quiz_score, 0) / scores.length) : 0
    return { ...u, completed, total: teamSteps.length, pct, avgScore }
  })

  const stats = [
    { label: 'Total de usuários',      value: totalUsers,         icon: Users,         color: '#3b82f6', sub: `${oaoUsers.length} OAO · ${r1Users.length} R1` },
    { label: 'Concluíram onboarding',  value: completedUsers,     icon: Trophy,        color: '#10b981', sub: `${totalUsers > 0 ? Math.round(completedUsers/totalUsers*100) : 0}% do total` },
    { label: 'Em andamento',           value: activeUsers,        icon: Users,         color: '#f59e0b', sub: undefined },
    { label: 'Conversas no Copilot',   value: totalConversations, icon: MessageSquare, color: '#8b5cf6', sub: `${totalMessages} mensagens` },
    { label: 'Vídeos concluídos',      value: videosCompleted,    icon: Play,          color: '#ef4444', sub: undefined },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Dashboard de Acompanhamento</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Métricas gerais do programa de onboarding</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={17} style={{ color: s.color }} />
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{s.label}</p>
              {s.sub && <p style={{ fontSize: 11, color: s.color, marginTop: 4 }}>{s.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* Por time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Time OAO', team: 'OAO', users: oaoUsers, color: '#3b82f6' },
          { label: 'Time R1',  team: 'R1',  users: r1Users,  color: '#8b5cf6' },
        ].map(t => (
          <div key={t.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{t.label}</h3>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>({t.users.length})</span>
            </div>
            {t.users.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhum usuário neste time.</p>
              : userProgress.filter(u => u.team === t.team).map(u => (
                <div key={u.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{u.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{u.completed}/{u.total} · {u.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--border)' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: u.pct === 100 ? '#10b981' : t.color, width: `${u.pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))
            }
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 50%, transparent)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progresso individual</span>
        </div>
        {userProgress.length === 0
          ? <div style={{ padding: 32, textAlign: 'center' }}><p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhum usuário cadastrado.</p></div>
          : userProgress.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in srgb, var(--foreground) 10%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>
                {u.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>{u.name}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Time {u.team ?? '—'}</p>
              </div>
              <div style={{ flex: 2, minWidth: 180 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{u.completed}/{u.total} etapas</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: u.pct === 100 ? '#10b981' : 'var(--foreground)' }}>{u.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--border)' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: u.pct === 100 ? '#10b981' : '#3b82f6', width: `${u.pct}%` }} />
                </div>
              </div>
              {u.avgScore > 0 && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>Quiz: {u.avgScore}%</span>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}
