'use client'
import Link from 'next/link'
import { Trophy, CheckCircle2, Clock, Star, Target, ArrowRight, Circle } from 'lucide-react'

export function ProgressoView({ steps, progress, attempts, videoViews }: any) {
  const progressMap = new Map(progress.map((p: any) => [p.step_id, p]))
  const total = steps.length
  const completed = steps.filter((s: any) => progressMap.get(s.id)?.status === 'concluido').length
  const inProgress = steps.filter((s: any) => progressMap.get(s.id)?.status === 'em_andamento').length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((a: number, b: any) => a + b.score, 0) / attempts.length)
    : null
  const videosWatched = videoViews.filter((v: any) => v.completed).length

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Meu Progresso</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Acompanhe sua evolução no onboarding</p>
      </div>

      {/* Card principal de progresso */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: pct === 100 ? 'rgba(34,197,94,0.06)' : 'rgba(59,130,246,0.05)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 4px' }}>Progresso geral</p>
            <p style={{ fontSize: 42, fontWeight: 800, color: pct === 100 ? '#22c55e' : 'var(--foreground)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>{pct}%</p>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: pct === 100 ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={28} style={{ color: pct === 100 ? '#22c55e' : '#3b82f6' }} />
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: 'var(--border)', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>{completed} de {total} etapas concluídas</p>
        {pct === 100 && (
          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', margin: 0 }}>🎉 Parabéns! Você concluiu o onboarding!</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Concluídas', value: completed, icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
          { label: 'Em andamento', value: inProgress, icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Média no quiz', value: avgScore !== null ? `${avgScore}%` : '—', icon: Star, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
          { label: 'Vídeos assistidos', value: videosWatched, icon: Target, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon size={16} style={{ color: stat.color }} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 2px', lineHeight: 1 }}>{stat.value}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Lista de etapas */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 14px' }}>Detalhes por etapa</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step: any) => {
          const prog = progressMap.get(step.id)
          const status = prog?.status ?? 'nao_iniciado'
          const statusColor = status === 'concluido' ? '#22c55e' : status === 'em_andamento' ? '#f59e0b' : 'var(--muted-foreground)'
          const statusLabel = status === 'concluido' ? 'Concluído' : status === 'em_andamento' ? 'Em andamento' : 'Não iniciado'
          const stepAttempts = attempts.filter((a: any) => a.step_id === step.id)
          return (
            <Link key={step.id} href={`/onboarding/trilha/${step.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.18s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'color-mix(in srgb, var(--foreground) 20%, transparent)'; el.style.transform = 'translateX(3px)'; el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'none'; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {status === 'concluido' ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                    : status === 'em_andamento' ? <Clock size={18} style={{ color: '#f59e0b' }} />
                    : <Circle size={18} style={{ color: 'var(--border)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{step.title}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {prog?.quiz_score != null && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Quiz: {prog.quiz_score}%</span>}
                    {stepAttempts.length > 0 && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{stepAttempts.length} tentativa{stepAttempts.length > 1 ? 's' : ''}</span>}
                    {prog?.completed_at && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Concluído em {new Date(prog.completed_at).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <ArrowRight size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
