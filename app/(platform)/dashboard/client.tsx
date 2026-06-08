'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Monitor, Calculator, Zap, Settings, ArrowRight, Flame, FileText, Sparkles } from 'lucide-react'
import type { Profile, Module } from '@/types/database'

const iconMap: Record<string, any> = {
  monitor: Monitor, calculator: Calculator, zap: Zap,
  settings: Settings, 'file-text': FileText,
}
const hrefMap: Record<string, string> = {
  telao: '/telao', calculadora: '/calculadora',
  disparos: '/disparos', admin: '/admin', templates: '/templates',
}
const gradients: Record<string, string> = {
  telao:       'linear-gradient(135deg,#3b82f6,#4f46e5)',
  calculadora: 'linear-gradient(135deg,#8b5cf6,#a855f7)',
  disparos:    'linear-gradient(135deg,#f59e0b,#ef4444)',
  admin:       'linear-gradient(135deg,#22c55e,#16a34a)',
  templates:   'linear-gradient(135deg,#ec4899,#8b5cf6)',
  default:     'linear-gradient(135deg,#6366f1,#8b5cf6)',
}

const teamConfig: Record<string, { label: string; grad: string; emoji: string; msg: string }> = {
  OAO: {
    label: 'Time OAO',
    grad: 'linear-gradient(135deg,#1e40af,#3b82f6,#6366f1)',
    emoji: '🔵',
    msg: 'Você faz parte do time que move a MedReview. Bora vender!',
  },
  R1: {
    label: 'Time R1',
    grad: 'linear-gradient(135deg,#5b21b6,#7c3aed,#a855f7)',
    emoji: '🟣',
    msg: 'O time R1 não para. Foco, consistência e resultado!',
  },
}

function greeting(name: string) {
  const h = new Date().getHours(), f = name.split(' ')[0]
  if (h < 12) return `Bom dia, ${f}! ☀️`
  if (h < 18) return `Boa tarde, ${f}! 🚀`
  return `Boa noite, ${f}! 🌙`
}

const c = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const i = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

interface ProfileWithTeam extends Profile { avatar_url?: string | null; team?: string | null }

export function DashboardClient({ profile, modules }: { profile: ProfileWithTeam; modules: Module[] }) {
  const initials = profile?.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() ?? '?'
  const team = profile?.team as string | null
  const tc = team ? teamConfig[team] : null

  return (
    <motion.div variants={c} initial="hidden" animate="show"
      style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1000, margin: '0 auto' }}>

      {/* Hero principal */}
      <motion.div variants={i} style={{ marginBottom: 20 }}>
        <div style={{
          background: 'linear-gradient(135deg, #2e1065 0%, #3730a3 25%, #4f46e5 60%, #7c3aed 100%)',
          borderRadius: 22, padding: 'clamp(22px,3vw,36px)',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 16px 56px rgba(79,70,229,0.35), 0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {/* Orbs decorativos */}
          <div style={{ position:'absolute', top:-50, right:-50, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-70, left:'20%', width:280, height:280, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:'20%', left:'45%', width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.5)' }} />
          <div style={{ position:'absolute', top:'70%', right:'18%', width:4, height:4, borderRadius:'50%', background:'rgba(255,255,255,0.35)' }} />
          <div style={{ position:'absolute', top:'40%', right:'40%', width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.4)' }} />

          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', gap:20 }}>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.6)', marginBottom:8, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                🔥 Plataforma Operacional · Time Comercial
              </p>
              <h1 style={{ fontSize:'clamp(22px,4vw,34px)', fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:10, lineHeight:1.15 }}>
                {greeting(profile?.name ?? 'usuário')}
              </h1>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.72)', maxWidth:440, lineHeight:1.6 }}>
                Bem-vindo à central de operações da MedReview. Acesse seus módulos e bora fechar! 💪
              </p>
              <div style={{ display:'flex', gap:10, marginTop:18, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:999, background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80' }} className="pulse" />
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Sistema online</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:999, background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.15)' }}>
                  <Flame size={11} style={{ color:'#fbbf24' }} />
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>MedReview · {new Date().getFullYear()}</span>
                </div>
              </div>
            </div>

            {/* Avatar */}
            {profile?.avatar_url ? (
              <div style={{ width:'clamp(72px,10vw,96px)', height:'clamp(72px,10vw,96px)', borderRadius:'50%', flexShrink:0, border:'3px solid rgba(255,255,255,0.25)', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
                <img src={profile.avatar_url} alt={profile.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
            ) : (
              <div style={{ width:'clamp(72px,10vw,96px)', height:'clamp(72px,10vw,96px)', borderRadius:'50%', flexShrink:0, border:'3px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'clamp(22px,3vw,30px)', fontWeight:900, color:'#fff', backdropFilter:'blur(8px)', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
                {initials}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Banner do time — só se tiver time definido */}
      {tc && (
        <motion.div variants={i} style={{ marginBottom: 20 }}>
          <div style={{
            background: tc.grad,
            borderRadius: 16, padding: '18px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 8px 28px rgba(79,70,229,0.25)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
            <div style={{ width:52, height:52, borderRadius:15, background:'rgba(255,255,255,0.15)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, border:'1px solid rgba(255,255,255,0.2)' }}>
              {tc.emoji}
            </div>
            <div style={{ flex:1, position:'relative', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <Sparkles size={14} style={{ color:'rgba(255,255,255,0.8)' }} />
                <span style={{ fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Seu time</span>
              </div>
              <p style={{ fontSize:18, fontWeight:900, color:'#fff', margin:'0 0 3px', letterSpacing:'-0.02em' }}>
                Seja bem-vindo ao {tc.label}! 🎉
              </p>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', margin:0 }}>{tc.msg}</p>
            </div>
            <div style={{ flexShrink:0, padding:'6px 16px', borderRadius:999, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', backdropFilter:'blur(8px)' }}>
              <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{tc.label}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Módulos */}
      {modules.length > 0 && (
        <motion.div variants={i}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <p style={{ fontSize:10, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>Seus módulos</p>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap:12 }}>
            {modules.map(mod => {
              const Icon = iconMap[mod.icon] ?? ArrowRight
              const href = hrefMap[mod.key] ?? '/dashboard'
              const grad = gradients[mod.key] ?? gradients.default
              return (
                <motion.div key={mod.key} variants={i} whileHover={{ y:-3, transition:{duration:0.15} }} whileTap={{ scale:0.97 }}>
                  <Link href={href} style={{ textDecoration:'none', display:'block', height:'100%' }}>
                    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'18px', height:'100%', position:'relative', overflow:'hidden', transition:'all 0.18s', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}
                      onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.boxShadow='0 8px 28px rgba(79,70,229,0.12)'; el.style.borderColor='rgba(99,102,241,0.3)' }}
                      onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; el.style.borderColor='var(--border)' }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:grad }} />
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, paddingTop:6 }}>
                        <div style={{ width:42, height:42, borderRadius:11, background:grad, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
                          <Icon size={18} style={{ color:'#fff' }} />
                        </div>
                        <ArrowRight size={13} style={{ color:'var(--muted-foreground)', marginTop:4 }} />
                      </div>
                      <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', marginBottom:3 }}>{mod.label}</p>
                      {mod.description && <p style={{ fontSize:11, color:'var(--muted-foreground)', lineHeight:1.5 }}>{mod.description}</p>}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
