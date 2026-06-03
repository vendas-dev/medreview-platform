
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Monitor, Calculator, Zap,
  Settings, LogOut, ChevronLeft, ChevronRight, Sun, Moon, GraduationCap
} from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canAccessModule } from '@/lib/rbac/permissions'
import { useTheme } from '@/components/ThemeProvider'
import { MedLogoSVG } from '@/components/MedLogo'
import type { ModuleKey } from '@/types/database'

const NAV = [
  { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard, href: '/dashboard',   always: true },
  { key: 'telao',       label: 'Telão',         icon: Monitor,         href: '/telao' },
  { key: 'calculadora', label: 'Calculadora',   icon: Calculator,      href: '/calculadora' },
  { key: 'disparos',    label: 'Disparos',      icon: Zap,             href: '/disparos' },
  { key: 'admin',       label: 'Administração', icon: Settings,        href: '/admin' },
  { key: 'onboarding', label: 'Onboarding', icon: GraduationCap, href: '/onboarding', always: true },
]

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const { profile, modules } = useCurrentUser()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const logoColor = isDark ? '#e2e8f0' : '#3d3d3d'

  const visible = NAV.filter(i =>
    i.always || canAccessModule(profile?.role ?? 'consultor', modules, i.key as ModuleKey)
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 248 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        height: '100vh', background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, overflow: 'hidden', zIndex: 20,
        position: 'relative',
      }}
    >
      {/* ── Header: logo fixo à esquerda, botão fixo à direita ── */}
      <div style={{
        height: 60, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        padding: '0 10px',
        gap: 8,
      }}>
        {/* Logo — sempre ocupa espaço fixo */}
        <div style={{
          width: 32, height: 32, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MedLogoSVG size={26} color={logoColor} />
        </div>

        {/* Nome — aparece/some com animação */}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                style={{
                  display: 'block', fontSize: 14, fontWeight: 700,
                  color: 'var(--foreground)', whiteSpace: 'nowrap',
                  letterSpacing: '-0.02em',
                }}
              >
                MedReview
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Botão toggle — sempre fixo à direita, nunca sobrepõe logo */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{
            width: 28, height: 28, flexShrink: 0,
            borderRadius: 8, border: 'none', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--muted-foreground)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--secondary)'
            e.currentTarget.style.color = 'var(--foreground)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--muted-foreground)'
          }}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav style={{
        flex: 1, padding: '10px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
        overflowY: 'auto', overflowX: 'hidden',
      }}>
        {visible.map(item => {
          const Icon = item.icon
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link key={item.key} href={item.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, padding: '0 10px', height: 38,
                  borderRadius: 10, fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  background: active
                    ? 'color-mix(in srgb, var(--foreground) 8%, transparent)'
                    : 'transparent',
                  position: 'relative',
                  overflow: 'visible',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
                  }
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip quando collapsed */}
                {collapsed && (
                  <div className="sidebar-tooltip" style={{
                    position: 'absolute', left: '100%', top: '50%',
                    transform: 'translateY(-50%)',
                    marginLeft: 10, padding: '6px 12px',
                    borderRadius: 8, background: 'var(--card)',
                    border: '1px solid var(--border)',
                    fontSize: 12, fontWeight: 500, color: 'var(--foreground)',
                    whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    pointerEvents: 'none', opacity: 0,
                    transition: 'opacity 0.15s', zIndex: 100,
                  }}>
                    {item.label}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div style={{
        padding: 8, borderTop: '1px solid var(--border)',
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {/* Perfil + tema quando expandido */}
        {!collapsed && profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 10,
            background: 'var(--secondary)',
          }}>
            <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12, fontWeight: 700, color: 'var(--foreground)',
                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>
                {profile.role}
              </p>
            </div>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{
                width: 28, height: 28, borderRadius: 7, border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--muted-foreground)', flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        )}

        {/* Tema quando collapsed */}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{
                width: 34, height: 34, borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--muted-foreground)', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        )}

        {/* Sair */}
        <form action={logout}>
          <button
            type="submit"
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 10, padding: '0 10px', height: 38, borderRadius: 10,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)',
              fontFamily: 'inherit', transition: 'all 0.15s',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--secondary)'
              e.currentTarget.style.color = 'var(--foreground)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }}
          >
            <LogOut size={15} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
                >
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </form>
      </div>

      <style>{`
        .sidebar-tooltip { opacity: 0 !important; }
        *:hover > .sidebar-tooltip { opacity: 1 !important; }
      `}</style>
    </motion.aside>
  )
}

export function UserAvatar({
  name, avatarUrl, size = 'sm',
}: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 28, md: 36, lg: 56 }[size]
  const fs = { sm: 11, md: 13, lg: 18 }[size]
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name} style={{
        width: s, height: s, borderRadius: '50%',
        objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0,
      }} />
    )
  }
  return (
    <div style={{
      width: s, height: s, borderRadius: '50%',
      background: 'color-mix(in srgb, var(--foreground) 10%, var(--card))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fs, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}
