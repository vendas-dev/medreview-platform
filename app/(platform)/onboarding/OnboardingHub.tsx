'use client'
import Link from 'next/link'
import { Settings, BookOpen, Video, BarChart2, Bot, List, TrendingUp, Home, ArrowRight, Zap, Trophy, Users } from 'lucide-react'

const adminLinks = [
  { href:'/onboarding/config',     icon:Settings,  label:'Configuração do Copilot', desc:'Configure a IA, tom e instruções',  grad:'linear-gradient(135deg,#6366f1,#8b5cf6)', emoji:'🤖' },
  { href:'/onboarding/trilha',     icon:BookOpen,  label:'Trilha de Aprendizado',   desc:'Etapas, FAQs, materiais e quizzes', grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', emoji:'📚' },
  { href:'/onboarding/videoaulas', icon:Video,     label:'Biblioteca de Videoaulas', desc:'Gerencie todos os vídeos',          grad:'linear-gradient(135deg,#ef4444,#ec4899)', emoji:'🎬' },
  { href:'/onboarding/dashboard',  icon:BarChart2, label:'Dashboard',                desc:'Métricas e progresso dos usuários', grad:'linear-gradient(135deg,#22c55e,#16a34a)', emoji:'📊' },
]
const userLinks = [
  { href:'/onboarding',            icon:Home,       label:'Início',        desc:'Visão geral do seu onboarding',    grad:'linear-gradient(135deg,#4f46e5,#7c3aed)', emoji:'🏠' },
  { href:'/onboarding/trilha',     icon:List,       label:'Minha Trilha',  desc:'Continue seu aprendizado',         grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', emoji:'📚' },
  { href:'/onboarding/copilot',    icon:Bot,        label:'Copilot IA',    desc:'Tire dúvidas com inteligência artificial', grad:'linear-gradient(135deg,#8b5cf6,#a855f7)', emoji:'🤖' },
  { href:'/onboarding/videoaulas', icon:Video,      label:'Videoaulas',    desc:'Assista os conteúdos em vídeo',    grad:'linear-gradient(135deg,#ef4444,#ec4899)', emoji:'🎬' },
  { href:'/onboarding/progresso',  icon:TrendingUp, label:'Meu Progresso', desc:'Acompanhe sua evolução',           grad:'linear-gradient(135deg,#22c55e,#16a34a)', emoji:'📈' },
]

interface Props {
  isAdmin: boolean; userName: string
  completed: number; total: number; pct: number
}

export function OnboardingHub({ isAdmin, userName, completed, total, pct }: Props) {
  const links = isAdmin ? adminLinks : userLinks

  return (
    <div style={{ padding:'clamp(14px,3vw,28px)', maxWidth:960, margin:'0 auto' }}>

      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg, #3730a3 0%, #4f46e5 40%, #7c3aed 100%)', borderRadius:22, padding:'clamp(22px,3vw,36px)', marginBottom:28, position:'relative', overflow:'hidden', boxShadow:'0 16px 48px rgba(79,70,229,0.3)' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
        <div style={{ position:'absolute', bottom:-60, left:'20%', width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', padding:'3px 12px', borderRadius:999, background:'rgba(255,255,255,0.15)', color:'#fff', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.2)' }}>
            {isAdmin ? '⚙️ Gestão do Onboarding' : '🚀 Programa de Onboarding'}
          </span>
          <h1 style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:900, color:'#fff', letterSpacing:'-0.03em', margin:'12px 0 8px', lineHeight:1.2 }}>
            {isAdmin ? 'Central de Onboarding' : `Olá, ${userName}! 👋`}
          </h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.75)', maxWidth:460, lineHeight:1.6 }}>
            {isAdmin
              ? 'Configure e gerencie todo o programa de onboarding da MedReview.'
              : 'Bem-vindo ao seu programa de onboarding. Aqui você vai aprender tudo sobre a MedReview!'
            }
          </p>
        </div>
      </div>

      {/* Barra de progresso — só usuários */}
      {!isAdmin && total > 0 && (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 24px', marginBottom:24, position:'relative', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#4f46e5,#7c3aed,#ec4899)' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:14 }}>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', margin:'0 0 2px' }}>Seu progresso geral</p>
              <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>{completed} de {total} etapas concluídas</p>
            </div>
            <span style={{ fontSize:32, fontWeight:900, letterSpacing:'-0.03em', color:pct===100?'#22c55e':'var(--foreground)' }}>{pct}%</span>
          </div>
          <div style={{ height:10, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999, background:pct===100?'linear-gradient(90deg,#22c55e,#16a34a)':'linear-gradient(90deg,#4f46e5,#7c3aed)', width:`${pct}%`, transition:'width 0.8s ease' }} />
          </div>
          {pct===100 && (
            <div style={{ marginTop:14, padding:'10px 14px', borderRadius:11, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', display:'flex', alignItems:'center', gap:8 }}>
              <Trophy size={16} style={{ color:'#22c55e' }} />
              <p style={{ fontSize:13, fontWeight:700, color:'#22c55e', margin:0 }}>Parabéns! Você concluiu o onboarding! 🎉</p>
            </div>
          )}
        </div>
      )}

      {/* Grid de módulos com design impactante */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap:14 }}>
        {links.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration:'none', display:'block' }}>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'0', overflow:'hidden', transition:'all 0.2s', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', height:'100%' }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-4px)'; el.style.boxShadow='0 12px 36px rgba(79,70,229,0.15)'; el.style.borderColor='rgba(99,102,241,0.35)' }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.transform='none'; el.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; el.style.borderColor='var(--border)' }}>

                {/* Área colorida no topo */}
                <div style={{ background:item.grad, padding:'20px 20px 18px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.1)' }} />
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ width:44, height:44, borderRadius:13, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
                      <Icon size={20} style={{ color:'#fff' }} />
                    </div>
                    <span style={{ fontSize:24 }}>{item.emoji}</span>
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding:'16px 18px' }}>
                  <p style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 5px', letterSpacing:'-0.01em' }}>{item.label}</p>
                  <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:'0 0 12px', lineHeight:1.5 }}>{item.desc}</p>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, color:'#6366f1' }}>
                    Acessar <ArrowRight size={11} />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
