'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Play, CheckCircle2, Circle, Lock, Clock, ArrowRight,
  BookOpen, Video, HelpCircle, Trophy, Zap, Target,
  ChevronRight, Star, TrendingUp, AlertCircle
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.36), fontWeight: 800, color: '#fff', border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────
interface Step {
  id: string; title: string; description?: string | null
  day_number?: number | null; estimated_minutes?: number | null
  status: string; quiz_score?: number | null; completed_at?: string | null
  completion_criteria?: string
}

interface Props {
  userName: string; avatarUrl?: string | null
  completed: number; total: number; pct: number
  steps: Step[]; uncheckedMaterials: any[]
  trailMode: string; teamName: string
}

export function UserMissionCenter({
  userName, avatarUrl, completed, total, pct,
  steps, uncheckedMaterials, trailMode, teamName,
}: Props) {
  const [activities, setActivities]   = useState<any[]>([])
  const [loadingAct, setLoadingAct]   = useState(true)

  useEffect(() => {
    fetch('/api/onboarding/my-activity')
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoadingAct(false) })
      .catch(() => setLoadingAct(false))
  }, [])

  const hour   = new Date().getHours()
  const greet  = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = userName.split(' ')[0]

  const allDone    = pct === 100 && total > 0
  const isSequential = trailMode === 'sequencial'

  // Próximas etapas pendentes
  const pending  = steps.filter(s => s.status !== 'concluido')
  const nextStep = pending[0]
  const inProgress = steps.find(s => s.status === 'em_andamento')

  // Etapa atual: em andamento > primeira pendente
  const currentStep = inProgress ?? nextStep

  // Bloqueadas em modo sequencial
  function isBlocked(s: Step): boolean {
    if (!isSequential) return false
    const idx = steps.findIndex(x => x.id === s.id)
    if (idx === 0) return false
    return steps[idx - 1].status !== 'concluido'
  }

  // Pendências concretas
  const pendingTasks: { text: string; icon: any; color: string; href: string }[] = []

  if (uncheckedMaterials.length > 0) {
    uncheckedMaterials.slice(0, 3).forEach(m => {
      const icon = m.type === 'video' ? Video : BookOpen
      pendingTasks.push({
        text:  `Assistir "${m.title}"`,
        icon,
        color: m.type === 'video' ? '#8b5cf6' : '#3b82f6',
        href:  `/onboarding/trilha/${m.step_id}`,
      })
    })
  }

  if (currentStep && currentStep.completion_criteria?.includes('quiz')) {
    pendingTasks.push({
      text:  `Finalizar avaliação: "${currentStep.title}"`,
      icon:  HelpCircle,
      color: '#f59e0b',
      href:  `/onboarding/trilha/${currentStep.id}`,
    })
  }

  if (pending.length > 0 && pendingTasks.length === 0) {
    pendingTasks.push({
      text:  `Continuar: "${pending[0].title}"`,
      icon:  Play,
      color: '#6366f1',
      href:  `/onboarding/trilha/${pending[0].id}`,
    })
  }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Hero personalizado ──────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 68%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(20px,3vw,32px)', marginBottom: 22, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(79,70,229,0.35)' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '40%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Topo: avatar + saudação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Avatar name={userName} url={avatarUrl} size={52} />
            <div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: '0 0 3px', fontWeight: 500 }}>
                {greet}! {teamName ? `Time ${teamName} ·` : ''} {allDone ? '🏆 Trilha concluída!' : '🚀 Continue evoluindo'}
              </p>
              <h1 style={{ fontSize: 'clamp(20px,4vw,28px)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                {allDone ? `Missão cumprida, ${firstName}!` : `Vamos nessa, ${firstName}!`}
              </h1>
            </div>
          </div>

          {/* Barra de progresso grande */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                Progresso geral da trilha
              </span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: allDone
                  ? 'linear-gradient(90deg,#4ade80,#22c55e)'
                  : 'linear-gradient(90deg,#a78bfa,#818cf8,#fff)',
                width: `${pct}%`,
                transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 0 12px rgba(255,255,255,0.3)',
              }} />
              {/* Marcadores de milestone */}
              {[25, 50, 75].map(m => (
                <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m}%`, width: 1, background: 'rgba(255,255,255,0.2)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{completed} de {total} etapas concluídas</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{pending.length} restantes</span>
            </div>
          </div>

          {/* CTA principal */}
          {!allDone && currentStep && (
            <Link href={`/onboarding/trilha/${currentStep.id}`} style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: 12, background: '#fff', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)' }}>
                <Play size={14} style={{ color: '#4f46e5', fill: '#4f46e5' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5' }}>
                  {inProgress ? 'Continuar de onde parou' : 'Começar próxima etapa'}
                </span>
                <ArrowRight size={13} style={{ color: '#4f46e5' }} />
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ── Layout de 2 colunas ─────────────────────────────── */}
      <div className="mission-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>

        {/* COLUNA ESQUERDA: Missões */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Central de Missões */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={14} style={{ color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Central de Missões</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Sua trilha personalizada</p>
                </div>
              </div>
              <Link href="/onboarding/trilha" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1', textDecoration: 'none', padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                Ver tudo <ArrowRight size={11} />
              </Link>
            </div>

            {/* Lista de etapas */}
            <div style={{ padding: '8px 0' }}>
              {steps.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Trilha sendo preparada para você!</p>
                </div>
              ) : steps.slice(0, 6).map((s, idx) => {
                const done    = s.status === 'concluido'
                const active  = s.status === 'em_andamento'
                const blocked = isBlocked(s)
                const isNext  = !done && !blocked && idx === steps.findIndex(x => x.status !== 'concluido')

                return (
                  <div key={s.id}>
                    {s.day_number && (idx === 0 || steps[idx - 1]?.day_number !== s.day_number) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px 4px', marginTop: idx > 0 ? 4 : 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          Dia {s.day_number}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}
                    <div style={{ opacity: blocked ? 0.45 : 1 }}>
                      {blocked || done ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                          <StatusIcon done={done} active={active} blocked={blocked} isNext={isNext} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: done ? 600 : 500, color: done ? 'var(--muted-foreground)' : 'var(--foreground)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
                              {s.title}
                            </p>
                            {done && s.completed_at && (
                              <p style={{ fontSize: 10, color: '#22c55e', margin: 0, fontWeight: 600 }}>
                                ✓ Concluído {timeAgo(s.completed_at)}
                              </p>
                            )}
                            {blocked && <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>🔒 Complete a etapa anterior</p>}
                          </div>
                          {done && s.quiz_score && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>{s.quiz_score}%</span>
                          )}
                        </div>
                      ) : (
                        <Link href={`/onboarding/trilha/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)', background: isNext ? 'rgba(99,102,241,0.04)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isNext ? 'rgba(99,102,241,0.04)' : 'transparent'}>
                            <StatusIcon done={done} active={active} blocked={blocked} isNext={isNext} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                                <p style={{ fontSize: 13, fontWeight: isNext ? 700 : 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {s.title}
                                </p>
                                {isNext && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', flexShrink: 0 }}>PRÓXIMO</span>}
                                {active && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>EM ANDAMENTO</span>}
                              </div>
                              {s.estimated_minutes && (
                                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={10} /> {s.estimated_minutes} min
                                </p>
                              )}
                            </div>
                            <ChevronRight size={14} style={{ color: isNext ? '#6366f1' : 'var(--muted-foreground)', flexShrink: 0 }} />
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
              {steps.length > 6 && (
                <div style={{ padding: '10px 18px' }}>
                  <Link href="/onboarding/trilha" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
                    Ver mais {steps.length - 6} etapas →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Pendências */}
          {pendingTasks.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} style={{ color: '#d97706' }} />
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Pendências</p>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>{pendingTasks.length}</span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {pendingTasks.map((task, i) => {
                  const Icon = task.icon
                  return (
                    <Link key={i} href={task.href} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: i < pendingTasks.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: task.color + '15', border: `1px solid ${task.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={14} style={{ color: task.color }} />
                        </div>
                        <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.4 }}>{task.text}</p>
                        <ArrowRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: Atividades + Atalhos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Conquistas rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-xs)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }} />
              <p style={{ fontSize: 26, fontWeight: 900, color: '#22c55e', margin: '4px 0 2px', letterSpacing: '-0.03em' }}>{completed}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Etapas concluídas</p>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-xs)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
              <p style={{ fontSize: 26, fontWeight: 900, color: '#d97706', margin: '4px 0 2px', letterSpacing: '-0.03em' }}>{pending.length}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Etapas restantes</p>
            </div>
          </div>

          {/* Atalhos rápidos */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', boxShadow: 'var(--shadow-xs)' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acesso rápido</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: '/onboarding/trilha',     emoji: '📚', label: 'Minha Trilha',   color: '#4f46e5' },
                { href: '/onboarding/videoaulas', emoji: '🎬', label: 'Videoaulas',     color: '#8b5cf6' },
                { href: '/onboarding/copilot',    emoji: '🤖', label: 'Medy',         color: '#ec4899' },
                { href: '/onboarding/progresso',  emoji: '📈', label: 'Meu Progresso',  color: '#22c55e' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', transition: 'all 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = item.color + '40'; el.style.background = item.color + '08'; el.style.transform = 'translateX(2px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--background)'; el.style.transform = 'none' }}>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{item.label}</span>
                    <ChevronRight size={13} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Feed de atividades pessoais */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} style={{ color: '#6366f1' }} />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Minhas atividades</p>
            </div>

            <div style={{ maxHeight: 280, overflowY: 'auto' }} className="scrollbar-hide">
              {loadingAct ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#6366f1', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                </div>
              ) : activities.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhuma atividade ainda. Comece agora!</p>
                  <Link href="/onboarding/trilha" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
                    Ir para a trilha →
                  </Link>
                </div>
              ) : activities.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < activities.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--secondary) 40%, transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--foreground)', margin: '0 0 1px', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.type === 'completion' && <><strong>Concluiu</strong> &ldquo;{a.subject}&rdquo;</>}
                      {a.type === 'quiz'       && <><strong>{a.detail && parseInt(a.detail) >= 70 ? 'Passou' : 'Fez'} o quiz</strong> de &ldquo;{a.subject}&rdquo;{a.detail ? ` · ${a.detail}` : ''}</>}
                      {a.type === 'video'      && <><strong>Assistiu</strong> &ldquo;{a.subject}&rdquo;</>}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0 }}>{timeAgo(a.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 1024px) {
          .mission-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── Ícone de status da etapa ───────────────────────────────────
function StatusIcon({ done, active, blocked, isNext }: { done: boolean; active: boolean; blocked: boolean; isNext: boolean }) {
  const size = 20
  if (done)    return <CheckCircle2 size={size} style={{ color: '#22c55e', flexShrink: 0 }} />
  if (blocked) return <Lock size={size} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
  if (active || isNext) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(79,70,229,0.4)' }}>
      <Play size={9} style={{ color: '#fff', fill: '#fff', marginLeft: 1 }} />
    </div>
  )
  return <Circle size={size} style={{ color: 'var(--border)', flexShrink: 0 }} />
}
