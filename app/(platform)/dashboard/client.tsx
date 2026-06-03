'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Monitor, Calculator, Zap, Settings, Link as LinkIcon, ArrowRight } from 'lucide-react'
import type { Profile, Module } from '@/types/database'

const iconMap: Record<string, any> = { monitor: Monitor, calculator: Calculator, zap: Zap, settings: Settings, link: LinkIcon }
const hrefMap: Record<string, string> = { telao: '/telao', calculadora: '/calculadora', disparos: '/disparos', admin: '/admin' }
const colorMap: Record<string, { bg: string; icon: string; glow: string }> = {
  telao:       { bg: 'rgba(59,130,246,0.1)',  icon: '#3b82f6', glow: 'rgba(59,130,246,0.15)' },
  calculadora: { bg: 'rgba(139,92,246,0.1)',  icon: '#8b5cf6', glow: 'rgba(139,92,246,0.15)' },
  disparos:    { bg: 'rgba(245,158,11,0.1)',  icon: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
  admin:       { bg: 'rgba(16,185,129,0.1)',  icon: '#10b981', glow: 'rgba(16,185,129,0.15)' },
  default:     { bg: 'rgba(37,99,235,0.1)',   icon: '#2563eb', glow: 'rgba(37,99,235,0.15)' },
}

function greeting(name: string) {
  const h = new Date().getHours(), f = name.split(' ')[0]
  if (h < 12) return `Bom dia, ${f}`
  if (h < 18) return `Boa tarde, ${f}`
  return `Boa noite, ${f}`
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export function DashboardClient({ profile, modules }: { profile: Profile; modules: Module[] }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" style={{ padding: '24px 24px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Greeting */}
      <motion.div variants={item} style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{greeting(profile?.name ?? 'usuário')} 👋</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>Bem-vindo à plataforma operacional MedReview.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 12, fontWeight: 700, color: '#10b981' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulseSlow 2s ease-in-out infinite' }} />
          Online
        </div>
      </motion.div>

      {/* Módulos */}
      {modules.length > 0 && (
        <motion.div variants={item} style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Seus módulos</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {modules.map(mod => {
              const Icon = iconMap[mod.icon] ?? LinkIcon
              const href = hrefMap[mod.key] ?? '/dashboard'
              const colors = colorMap[mod.key] ?? colorMap.default
              return (
                <motion.div key={mod.key} variants={item} whileHover={{ y: -3, transition: { duration: 0.15 } }}>
                  <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = colors.icon; el.style.boxShadow = `0 4px 20px ${colors.glow}` }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'none' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={19} style={{ color: colors.icon }} />
                        </div>
                        <ArrowRight size={14} style={{ color: 'var(--muted-foreground)', marginTop: 4 }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>{mod.label}</p>
                      {mod.description && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{mod.description}</p>}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Conta */}
      <motion.div variants={item}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sua conta</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
            {profile?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{profile?.name}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</p>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: profile?.role === 'superadmin' ? 'rgba(59,130,246,0.12)' : 'var(--secondary)', color: profile?.role === 'superadmin' ? '#3b82f6' : 'var(--muted-foreground)', border: profile?.role === 'superadmin' ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)', flexShrink: 0 }}>
            {profile?.role === 'superadmin' ? 'Superadmin' : 'Consultor'}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}
