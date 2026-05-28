'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Monitor, Calculator, Zap, Settings,
  ChevronLeft, ChevronRight, LogOut, User
} from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canAccessModule, MODULE_META } from '@/lib/rbac/permissions'
import type { ModuleKey } from '@/types/database'

const iconMap = {
  LayoutDashboard, Monitor, Calculator, Zap, Settings,
}

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', alwaysVisible: true },
  { key: 'telao', label: 'Telão', icon: Monitor, href: '/telao' },
  { key: 'calculadora', label: 'Calculadora', icon: Calculator, href: '/calculadora' },
  { key: 'disparos', label: 'Disparos', icon: Zap, href: '/disparos' },
  { key: 'admin', label: 'Administração', icon: Settings, href: '/admin' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { profile, modules } = useCurrentUser()

  const visibleItems = NAV_ITEMS.filter(item =>
    item.alwaysVisible || canAccessModule(profile?.role ?? 'consultor', modules, item.key as ModuleKey)
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative h-screen bg-card border-r border-border flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">MedReview</span>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-hide">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`
                flex items-center gap-3 px-2.5 h-9 rounded-lg text-sm transition-colors relative group
                ${isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }
              `}
            >
              <Icon size={16} className="shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip quando collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-0.5 shrink-0">
        {collapsed && (
          <button
            onClick={onToggle}
            className="w-full h-9 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {!collapsed && profile && (
          <div className="px-2.5 py-2 rounded-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <User size={13} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{profile.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
              </div>
            </div>
          </div>
        )}

        <form action={logout}>
          <button
            type="submit"
            className={`
              w-full flex items-center gap-3 px-2.5 h-9 rounded-lg text-sm text-muted-foreground
              hover:text-foreground hover:bg-secondary transition-colors
            `}
          >
            <LogOut size={16} className="shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </form>
      </div>
    </motion.aside>
  )
}
