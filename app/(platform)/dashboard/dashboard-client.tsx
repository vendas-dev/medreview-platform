'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Monitor, Calculator, Zap, Settings, ArrowRight } from 'lucide-react'
import type { Profile, Module } from '@/types/database'

const iconMap: Record<string, React.ElementType> = {
  monitor: Monitor,
  calculator: Calculator,
  zap: Zap,
  settings: Settings,
}

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const firstName = name.split(' ')[0]
  if (hour < 12) return `Bom dia, ${firstName}`
  if (hour < 18) return `Boa tarde, ${firstName}`
  return `Boa noite, ${firstName}`
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

interface DashboardClientProps {
  profile: Profile
  modules: Module[]
}

export function DashboardClient({ profile, modules }: DashboardClientProps) {
  const moduleHrefMap: Record<string, string> = {
    telao: '/telao',
    calculadora: '/calculadora',
    disparos: '/disparos',
    admin: '/admin',
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 lg:p-8 max-w-5xl mx-auto"
    >
      {/* Saudação */}
      <motion.div variants={item} className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          {getGreeting(profile?.name ?? 'usuário')} 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bem-vindo à plataforma operacional MedReview.
        </p>
      </motion.div>

      {/* Módulos disponíveis */}
      {modules.length > 0 && (
        <motion.div variants={item} className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider text-xs">
            Seus módulos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map(mod => {
              const Icon = iconMap[mod.icon] ?? Monitor
              const href = moduleHrefMap[mod.key] ?? '/dashboard'

              return (
                <Link key={mod.key} href={href}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="group bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon size={18} className="text-primary" />
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1"
                      />
                    </div>
                    <p className="text-sm font-medium text-foreground">{mod.label}</p>
                    {mod.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {mod.description}
                      </p>
                    )}
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Info do usuário */}
      <motion.div variants={item}>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-medium text-sm">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{profile?.name}</p>
              <p className="text-xs text-muted-foreground">{profile?.email} · <span className="capitalize">{profile?.role}</span></p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
