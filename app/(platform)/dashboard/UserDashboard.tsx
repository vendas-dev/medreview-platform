'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Play, CheckCircle2, Circle, Lock, Clock, ArrowRight,
  BookOpen, Video, HelpCircle, Trophy, Zap, Target,
  ChevronRight, TrendingUp, AlertCircle, Star, Flame
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)       return 'agora'
  if (diff < 3600)     return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 86400*7)  return `${Math.floor(diff / 86400)}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Avatar({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.35)', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.36), fontWeight: 800, color: '#fff', border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function StatusIcon({ done, blocked, isNext, active }: any) {
  if (done)    return <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
  if (blocked) return <Lock size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
  if (active || isNext) return (
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(79,70,229,0.4)' }}>
      <Play size={9} style={{ color: '#fff', fill: '#fff', marginLeft: 1 }} />
    </div>
  )
  return <Circle size={18} style={{ color: 'var(--border)', flexShrink: 0 }} />
}

interface Step {
  id: string; title: string; day_number?: number | null
  estimated_minutes?: number | null; status: string
  quiz_score?: number | null; completed_at?: string | null
  completion_criteria?: string
}

interface Props {
  userName: string; avatarUrl?: string | null; teamName: string
  completed: number; total: number; pct: number
  steps: Step[]; uncheckedMaterials: any[]
  trailMode: string
}

export function UserDashboard({ userName, avatarUrl, teamName, completed, total, pct, steps, uncheckedMaterials, trailMode }: Props) {
  const [activities, setActivities] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetch('/api/onboarding/my-activity')
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const hour      = new Date().getHours()
  const greet     = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = userName.split(' ')[0]
  const allDone   = pct === 100 && total > 0
  const isSeq     = trailMode === 'sequencial'

  const pending    = steps.filter(s => s.status !== 'concluido')
  const inProgress = steps.find(s => s.status === 'em_andamento')
  const nextStep   = pending[0]
  const current    = inProgress ?? nextStep

  function isBlocked(s: Step) {
    if (!isSeq) return false
    const idx = steps.findIndex(x => x.id === s.id)
    return idx > 0 && steps[idx - 1].status !== 'concluido'
  }

  // Pendências
  const tasks: { text: string; icon: any; color: string; href: string }[] = []
  uncheckedMaterials.slice(0, 3).forEach(m => {
    tasks.push({ text: `Assistir "${m.title}"`, icon: m.type === 'video' ? Video : BookOpen, color: m.type === 'video' ? '#8b5cf6' : '#3b82f6', href: `/onboarding/trilha/${m.step_id}` })
  })
  if (current?.completion_criteria?.includes('quiz')) {
    tasks.push({ text: `Finalizar avaliação: "${current.title}"`, icon: HelpCircle, color: '#f59e0b', href: `/onboarding/trilha/${current.id}` })
  }
  if (tasks.length === 0 && pending.length > 0) {
    tasks.push({ text: `Continuar: "${pending[0].title}"`, icon: Play, color: '#6366f1', href: `/onboarding/trilha/${pending[0].id}` })
  }

  // Sequência de dias para exibir cabeçalho
  let lastDay: number | null | undefined = undefined

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1080, margin: '0 auto' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 28%,#4f46e5 65%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(22px,3vw,36px)', marginBottom: 24, position: 'relative', overflow: 'hidden', boxShadow: '0 20px 60px rgba(79,70,229,0.4)' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: '35%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', top: 20, right: 120, width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ position: 'absolute', top: 60, right: 80, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Linha topo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={userName} url={avatarUrl} size={54} />
              <div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', letterSpacing: '0.03em' }}>
                  {greet} · {teamName ? `Time ${teamName}` : 'MedReview'}
                </p>
                <h1 style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {allDone ? `Missão cumprida, ${firstName}! 🏆` : `Vamos nessa, ${firstName}! 🚀`}
                </h1>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', label: 'Concluídas', value: completed },
                { icon: '⏳', label: 'Restantes',  value: pending.length },
                { icon: '🔥', label: 'Sequência',  value: `${activities.filter(a => a.type === 'completion').length}` },
              ].map((s, i) => (
                <div key={i} style={{ padding: '8px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', minWidth: 70 }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: '0 0 2px', lineHeight: 1 }}>{s.icon} {s.value}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Barra de progresso */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Progresso na Trilha Comercial</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{pct}%</span>
            </div>
            <div style={{ height: 16, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: allDone ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#c4b5fd,#a78bfa,#818cf8,#fff)',
                width: `${pct}%`,
                transition: 'width 1.4s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 0 16px rgba(255,255,255,0.25)',
              }} />
              {[25, 50, 75].map(m => (
                <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m}%`, width: 1, background: 'rgba(255,255,255,0.15)' }} />
              ))}
              {/* Bolinha na ponta */}
              {pct > 3 && pct < 98 && (
                <div style={{ position: 'absolute', top: '50%', left: `calc(${pct}% - 8px)`, transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.8)' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{completed}/{total} módulos</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{pending.length} para concluir</span>
            </div>
          </div>

          {/* CTA */}
          {!allDone && current && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href={`/onboarding/trilha/${current.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 22px', borderRadius: 13, background: '#fff', cursor: 'pointer', transition: 'all 0.18s', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.25)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)' }}>
                  <Play size={14} style={{ color: '#4f46e5', fill: '#4f46e5' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5' }}>
                    {inProgress ? 'Continuar de onde parou' : 'Começar próxima etapa'}
                  </span>
                  <ArrowRight size={14} style={{ color: '#4f46e5' }} />
                </div>
              </Link>
              <Link href="/onboarding/trilha" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px', borderRadius: 13, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.15s', backdropFilter: 'blur(8px)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}>
                  <BookOpen size={14} style={{ color: '#fff' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Ver trilha completa</span>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── GRID PRINCIPAL ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>

        {/* ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Continue de onde parou */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>
                  <Target size={14} style={{ color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>📚 Trilha Comercial</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Progresso: {completed}/{total} módulos</p>
                </div>
              </div>
              <Link href="/onboarding/trilha" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1', textDecoration: 'none', padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}>
                Ver tudo <ArrowRight size={11} />
              </Link>
            </div>

            <div style={{ padding: '8px 0' }}>
              {steps.slice(0, 7).map((s, idx) => {
                const done    = s.status === 'concluido'
                const active  = s.status === 'em_andamento'
                const blocked = isBlocked(s)
                const isNext  = !done && !blocked && idx === steps.findIndex(x => x.status !== 'concluido')

                // Cabeçalho de dia
                const showDayHeader = s.day_number && s.day_number !== lastDay
                if (showDayHeader) lastDay = s.day_number

                return (
                  <div key={s.id}>
                    {showDayHeader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px 4px', marginTop: idx > 0 ? 2 : 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                          Dia {s.day_number}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}

                    {done || blocked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '1px solid var(--border)', opacity: blocked ? 0.4 : 0.7 }}>
                        <StatusIcon done={done} blocked={blocked} isNext={false} active={false} />
                        <p style={{ flex: 1, fontSize: 13, fontWeight: 500, color: done ? 'var(--muted-foreground)' : 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
                          {s.title}
                        </p>
                        {done && s.completed_at && (
                          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>✓</span>
                        )}
                      </div>
                    ) : (
                      <Link href={`/onboarding/trilha/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)', background: isNext ? 'rgba(99,102,241,0.04)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.07)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isNext ? 'rgba(99,102,241,0.04)' : 'transparent'}>
                          <StatusIcon done={false} blocked={false} isNext={isNext} active={active} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <p style={{ fontSize: 13, fontWeight: isNext ? 700 : 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                              {isNext && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', flexShrink: 0 }}>PRÓXIMO</span>}
                              {active && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>EM ANDAMENTO</span>}
                            </div>
                            {s.estimated_minutes && <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>⏱ {s.estimated_minutes} min</p>}
                          </div>
                          <ChevronRight size={14} style={{ color: isNext ? '#6366f1' : 'var(--muted-foreground)', flexShrink: 0 }} />
                        </div>
                      </Link>
                    )}
                  </div>
                )
              })}
              {steps.length > 7 && (
                <div style={{ padding: '10px 18px' }}>
                  <Link href="/onboarding/trilha" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
                    + {steps.length - 7} etapas restantes →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Pendências */}
          {tasks.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={14} style={{ color: '#d97706' }} />
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Pendências</p>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>{tasks.length}</span>
              </div>
              {tasks.map((t, i) => {
                const Icon = t.icon
                return (
                  <Link key={i} href={t.href} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: t.color + '14', border: `1px solid ${t.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} style={{ color: t.color }} />
                      </div>
                      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.4 }}>{t.text}</p>
                      <ArrowRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* KPIs pessoais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Concluídas', value: completed, color: '#22c55e', grad: 'linear-gradient(90deg,#22c55e,#16a34a)', icon: '🏆' },
              { label: 'Restantes',  value: pending.length, color: '#6366f1', grad: 'linear-gradient(90deg,#4f46e5,#7c3aed)', icon: '🎯' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.grad }} />
                <p style={{ fontSize: 11, margin: '6px 0 4px' }}>{k.icon}</p>
                <p style={{ fontSize: 28, fontWeight: 900, color: k.color, margin: '0 0 2px', letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Acesso rápido */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', boxShadow: 'var(--shadow-xs)' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acesso rápido</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: '/onboarding',            emoji: '🏠', label: 'Início Onboarding', color: '#4f46e5' },
                { href: '/onboarding/trilha',     emoji: '📚', label: 'Minha Trilha',       color: '#3b82f6' },
                { href: '/onboarding/videoaulas', emoji: '🎬', label: 'Videoaulas',         color: '#8b5cf6' },
                { href: '/onboarding/copilot',    emoji: '🤖', label: 'Medy',             color: '#ec4899' },
                { href: '/onboarding/progresso',  emoji: '📈', label: 'Meu Progresso',      color: '#22c55e' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', transition: 'all 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = item.color + '45'; el.style.background = item.color + '08'; el.style.transform = 'translateX(3px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--background)'; el.style.transform = 'none' }}>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{item.label}</span>
                    <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Atividades pessoais */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Minhas atividades</p>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }} className="scrollbar-hide">
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#6366f1', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                </div>
              ) : activities.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>Nenhuma atividade ainda.</p>
                  <Link href="/onboarding/trilha" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>Começar agora →</Link>
                </div>
              ) : activities.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < activities.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb,var(--secondary) 40%,transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{a.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--foreground)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                      {a.type === 'completion' && <><strong>Concluiu</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'quiz'       && <><strong>{a.detail && parseInt(a.detail) >= 70 ? 'Passou' : 'Fez quiz'}</strong> em &ldquo;{a.subject}&rdquo;{a.detail ? ` · ${a.detail}` : ''}</>}
                      {a.type === 'video'      && <><strong>Assistiu</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'material'   && <><strong>Concluiu material</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'simulado'   && <><strong>{a.detail && parseFloat(a.detail) >= 70 ? '🏅 Aprovado no' : '📋 Realizou o'}</strong> {a.subject}{a.detail ? ` · ${a.detail}` : ''}</>}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>{timeAgo(a.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
