'use client'
import Link from 'next/link'
import { Settings, BookOpen, Video, BarChart2, Bot, List, Play, TrendingUp } from 'lucide-react'

const adminLinks = [
  { href: '/onboarding/config',     icon: Settings,  label: 'Configuração do Copilot',       desc: 'Configure a IA e o tom das respostas',    color: '#8b5cf6' },
  { href: '/onboarding/trilha',     icon: BookOpen,  label: 'Trilha de Aprendizado',          desc: 'Gerencie etapas, FAQs e quizzes',         color: '#3b82f6' },
  { href: '/onboarding/videoaulas', icon: Video,     label: 'Biblioteca de Videoaulas',       desc: 'Gerencie os vídeos do programa',          color: '#ef4444' },
  { href: '/onboarding/dashboard',  icon: BarChart2, label: 'Dashboard de Acompanhamento',    desc: 'Métricas e progresso dos usuários',       color: '#10b981' },
]

const userLinks = [
  { href: '/onboarding/trilha',     icon: List,        label: 'Minha Trilha',   desc: 'Continue seu aprendizado',      color: '#3b82f6' },
  { href: '/onboarding/copilot',    icon: Bot,         label: 'Copilot',        desc: 'Tire dúvidas com a IA',         color: '#8b5cf6' },
  { href: '/onboarding/videoaulas', icon: Play,        label: 'Videoaulas',     desc: 'Assista os conteúdos em vídeo', color: '#ef4444' },
  { href: '/onboarding/progresso',  icon: TrendingUp,  label: 'Meu Progresso',  desc: 'Acompanhe sua evolução',        color: '#10b981' },
]

interface Props {
  isAdmin: boolean
  userName: string
  completed: number
  total: number
  pct: number
}

export function OnboardingHub({ isAdmin, userName, completed, total, pct }: Props) {
  const links = isAdmin ? adminLinks : userLinks

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>
          {isAdmin ? 'Onboarding' : `Olá, ${userName} 👋`}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          {isAdmin ? 'Gerencie o programa de onboarding da MedReview.' : 'Bem-vindo ao seu programa de onboarding.'}
        </p>
      </div>

      {!isAdmin && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Seu progresso geral</p>
            <span style={{ fontSize: 22, fontWeight: 700, color: pct === 100 ? '#10b981' : 'var(--foreground)' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 999, background: pct === 100 ? '#10b981' : '#3b82f6', width: `${pct}%`, transition: 'width 0.6s ease' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{completed} de {total} etapas concluídas</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {links.map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', cursor: 'pointer', transition: 'all 0.18s' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'
                  el.style.transform = 'translateY(-2px)'
                  el.style.borderColor = `${item.color}40`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.boxShadow = 'none'
                  el.style.transform = 'none'
                  el.style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon size={20} style={{ color: item.color }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{item.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}