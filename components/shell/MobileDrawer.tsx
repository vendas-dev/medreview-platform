'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Monitor, Calculator, Zap, Settings, X, LogOut } from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canAccessModule } from '@/lib/rbac/permissions'
import { UserAvatar } from '@/components/shell/Sidebar'
import { MedLogoSVG } from '@/components/MedLogo'
import { useTheme } from '@/components/ThemeProvider'
import type { ModuleKey } from '@/types/database'

const NAV = [
  { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard, href: '/dashboard',   always: true },
  { key: 'telao',       label: 'Telão',         icon: Monitor,         href: '/telao' },
  { key: 'calculadora', label: 'Calculadora',   icon: Calculator,      href: '/calculadora' },
  { key: 'disparos',    label: 'Disparos',      icon: Zap,             href: '/disparos' },
  { key: 'admin',       label: 'Administração', icon: Settings,        href: '/admin' },
]

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { profile, modules } = useCurrentUser()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const visible = NAV.filter(i => i.always || canAccessModule(profile?.role ?? 'consultor', modules, i.key as ModuleKey))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 40 }} />
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 280, background: 'var(--card)', borderRight: '1px solid var(--border)', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MedLogoSVG size={26} color={isDark ? '#e8e8e8' : '#3d3d3d'} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>MedReview</span>
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>
            <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }} className="scrollbar-hide">
              {visible.map(item => {
                const Icon = item.icon
                const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
                return (
                  <Link key={item.key} href={item.href} onClick={onClose} style={{ textDecoration: 'none' }}>
                    <div className={active ? 'nav-active' : 'sidebar-link'}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', height: 44, borderRadius: 12, fontSize: 14, fontWeight: active ? 600 : 500, color: active ? 'var(--foreground)' : 'var(--muted-foreground)', transition: 'all 0.15s' }}>
                      <Icon size={18} style={{ flexShrink: 0 }} />
                      {item.label}
                    </div>
                  </Link>
                )
              })}
            </nav>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {profile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--secondary)', marginBottom: 4 }}>
                  <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{profile.role}</p>
                  </div>
                </div>
              )}
              <form action={logout}>
                <button type="submit" className="sidebar-link" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', height: 44, borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  <LogOut size={17} /><span>Sair da conta</span>
                </button>
              </form>
            </div>
            <style>{`.sidebar-link:hover { background: var(--secondary) !important; color: var(--foreground) !important; }`}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
