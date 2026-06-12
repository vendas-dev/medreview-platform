'use client'
import Link from 'next/link'
import { Settings, BookOpen, Video, BarChart2, Bot, List, TrendingUp, Home, ArrowRight, Zap, Trophy, ChevronRight, Lock, Clock } from 'lucide-react'

const adminLinks = [
  { href: '/onboarding/config',     icon: Settings,  label: 'Configuração do Med.AI',  desc: 'Personalize a IA e o tom das respostas', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', emoji: '🤖' },
  { href: '/onboarding/trilha',     icon: BookOpen,  label: 'Trilha de Aprendizado',   desc: 'Monte a jornada do seu time',             grad: 'linear-gradient(135deg,#3b82f6,#4f46e5)', emoji: '📚' },
  { href: '/onboarding/videoaulas', icon: Video,     label: 'Biblioteca de Vídeos',    desc: 'Centralize todo o conteúdo em vídeo',     grad: 'linear-gradient(135deg,#ef4444,#ec4899)', emoji: '🎬' },
  { href: '/onboarding/dashboard',  icon: BarChart2, label: 'Analytics',               desc: 'KPIs e progresso do seu time',             grad: 'linear-gradient(135deg,#22c55e,#16a34a)', emoji: '📊' },
]

interface Step {
  id: string; title: string; day_number?: number | null
  status?: string; estimated_minutes?: number | null
}
interface Props {
  isAdmin: boolean; userName: string
  completed: number; total: number; pct: number
  nextSteps?: Step[]; trailMode?: string
}

export function OnboardingHub({ isAdmin, userName, completed, total, pct, nextSteps = [], trailMode = 'livre' }: Props) {
  const firstName = userName.split(' ')[0]
  // Apenas etapas pendentes (não concluídas)
  const pendingSteps = nextSteps.filter(s => s.status !== 'concluido')
  const firstPending = pendingSteps[0]
  const allDone = pct === 100 && total > 0

  if (isAdmin) return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 35%,#4f46e5 70%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(22px,3vw,36px)', marginBottom: 24, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', marginBottom: 12 }}>⚙️ Gestão · Onboarding</span>
          <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.2 }}>Central de Onboarding</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>Aqui você configura, acompanha e melhora a jornada do seu time do começo ao fim.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 14 }}>
        {adminLinks.map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', height: '100%' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 36px rgba(79,70,229,0.15)'; el.style.borderColor = 'rgba(99,102,241,0.35)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--shadow-sm)'; el.style.borderColor = 'var(--border)' }}>
                <div style={{ background: item.grad, padding: '20px 20px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} style={{ color: '#fff' }} /></div>
                    <span style={{ fontSize: 24 }}>{item.emoji}</span>
                  </div>
                </div>
                <div style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5 }}>{item.desc}</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#6366f1' }}>Acessar <ArrowRight size={11} /></div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )

  // ── VISÃO DO USUÁRIO ──────────────────────────────────────────
  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 900, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 70%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(22px,3vw,36px)', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', marginBottom: 12 }}>🚀 Programa de Onboarding</span>
          <h1 style={{ fontSize: 'clamp(20px,4vw,30px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.2 }}>
            {allDone ? `Missão cumprida, ${firstName}! 🏆` : `Você está indo muito bem, ${firstName}! 💪`}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', maxWidth: 460, lineHeight: 1.6, margin: '0 0 18px' }}>
            {allDone
              ? 'Você concluiu todo o programa. Agora é hora de aplicar tudo que aprendeu!'
              : firstPending
                ? `Próximo passo: ${firstPending.title}. Continue de onde parou!`
                : total === 0 ? 'A trilha está sendo preparada para você.' : 'Continue acessando o conteúdo e evoluindo!'
            }
          </p>
          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 400 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: allDone ? '#4ade80' : '#fff', width: `${pct}%`, transition: 'width 0.8s ease' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{pct}%</span>
            </div>
          )}
          {total > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '6px 0 0' }}>{completed} de {total} etapas concluídas</p>}
        </div>
      </div>

      {/* Próximos passos */}
      {!allDone && pendingSteps.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 18, padding: '18px 20px', marginBottom: 20, boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#4f46e5,#7c3aed,#ec4899)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} style={{ color: '#fff' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Continue de onde parou</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Seu sistema acompanha cada passo da sua evolução</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Mostra no máximo 3 etapas pendentes */}
            {pendingSteps.slice(0, 3).map((step, idx) => {
              const isNext   = idx === 0
              const isLocked = trailMode === 'sequencial' && idx > 0
              return (
                <div key={step.id}>
                  {isLocked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 11, background: 'var(--secondary)', border: '1px solid var(--border)', opacity: 0.65 }}>
                      <Lock size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', margin: 0 }}>{step.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>🔒 Conclua a etapa anterior para desbloquear</p>
                      </div>
                    </div>
                  ) : (
                    <Link href={`/onboarding/trilha/${step.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 11, background: isNext ? 'rgba(99,102,241,0.06)' : 'transparent', border: `1px solid ${isNext ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`, transition: 'all 0.15s', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isNext ? 'rgba(99,102,241,0.06)' : 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = isNext ? 'rgba(99,102,241,0.2)' : 'var(--border)' }}>
                        {isNext
                          ? <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}><Zap size={14} style={{ color: '#fff' }} /></div>
                          : <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Clock size={14} style={{ color: 'var(--muted-foreground)' }} /></div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: isNext ? 'var(--foreground)' : 'var(--muted-foreground)', margin: 0 }}>{step.title}</p>
                            {isNext && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>PRÓXIMO</span>}
                            {step.day_number && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>Dia {step.day_number}</span>}
                          </div>
                          {step.estimated_minutes && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>⏱ {step.estimated_minutes} min</p>}
                        </div>
                        <ChevronRight size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                      </div>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
          {/* Só mostra "Ver todas" se há MAIS de 3 pendentes */}
          {pendingSteps.length > 3 && (
            <Link href="/onboarding/trilha"
              style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
              Ver todas as {pendingSteps.length} etapas pendentes →
            </Link>
          )}
        </div>
      )}

      {/* Concluído */}
      {allDone && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 18, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 18px rgba(34,197,94,0.3)' }}>
            <Trophy size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', margin: '0 0 3px' }}>Onboarding 100% concluído! 🎉</p>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Você é oficial. Agora o céu é o limite — vai lá e arrasa!</p>
          </div>
        </div>
      )}

      {/* Atalhos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>
        {[
          { href: '/onboarding/trilha',     icon: List,       label: 'Minha Trilha', desc: 'Veja o conteúdo completo',      grad: 'linear-gradient(135deg,#3b82f6,#4f46e5)', emoji: '📚' },
          { href: '/onboarding/copilot',    icon: Bot,        label: 'Med.AI',       desc: 'Tire dúvidas com IA',           grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)', emoji: '🤖' },
          { href: '/onboarding/videoaulas', icon: Video,      label: 'Videoaulas',   desc: 'Assista o conteúdo em vídeo',  grad: 'linear-gradient(135deg,#ef4444,#ec4899)', emoji: '🎬' },
          { href: '/onboarding/progresso',  icon: TrendingUp, label: 'Progresso',    desc: 'Acompanhe sua evolução',       grad: 'linear-gradient(135deg,#22c55e,#16a34a)', emoji: '📈' },
        ].map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', transition: 'all 0.18s', cursor: 'pointer', boxShadow: 'var(--shadow-xs)' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 8px 24px rgba(79,70,229,0.12)'; el.style.borderColor = 'rgba(99,102,241,0.3)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--shadow-xs)'; el.style.borderColor = 'var(--border)' }}>
                <div style={{ background: item.grad, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={17} style={{ color: '#fff' }} /></div>
                    <span style={{ fontSize: 20 }}>{item.emoji}</span>
                  </div>
                </div>
                <div style={{ padding: '13px 16px' }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 3px' }}>{item.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.4 }}>{item.desc}</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1' }}>Acessar <ArrowRight size={10} /></div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
