'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Monitor, Calculator, Zap, Settings, LogOut,
  ChevronLeft, ChevronRight, Sun, Moon, GraduationCap, ChevronDown,
  Bot, Video, BarChart2, List, TrendingUp, Home, Users, Package,
  FileText,
} from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canAccessModule } from '@/lib/rbac/permissions'
import { useTheme } from '@/components/ThemeProvider'
import { MedLogoSVG } from '@/components/MedLogo'
import type { ModuleKey } from '@/types/database'

interface NavChild { label: string; icon: any; href: string; children?: NavChild[] }
interface NavItem  { key: string; label: string; icon: any; href: string; always?: boolean; adminOnly?: boolean; children?: NavChild[] }

const buildNav = (isAdmin: boolean): NavItem[] => [
  { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard, href: '/dashboard', always: true },
  {
    key: 'onboarding', label: 'Onboarding', icon: GraduationCap, href: '/onboarding', always: true,
    children: isAdmin ? [
      { label: 'Visão geral', icon: Home,     href: '/onboarding' },
      { label: 'Trilha',      icon: List,     href: '/onboarding/trilha' },
      { label: 'Videoaulas',  icon: Video,    href: '/onboarding/videoaulas' },
      { label: 'Config. IA',  icon: Bot,      href: '/onboarding/config' },
      { label: 'Dashboard',   icon: BarChart2,href: '/onboarding/dashboard' },
    ] : [
      { label: 'Início',        icon: Home,       href: '/onboarding' },
      { label: 'Minha Trilha',  icon: List,       href: '/onboarding/trilha' },
      { label: 'Copilot IA',    icon: Bot,        href: '/onboarding/copilot' },
      { label: 'Videoaulas',    icon: Video,      href: '/onboarding/videoaulas' },
      { label: 'Meu Progresso', icon: TrendingUp, href: '/onboarding/progresso' },
    ],
  },
  { key: 'telao',       label: 'Telão',         icon: Monitor,   href: '/telao' },
  { key: 'calculadora', label: 'Calculadora',   icon: Calculator,href: '/calculadora' },
  { key: 'disparos',    label: 'Disparos',      icon: Zap,       href: '/disparos' },
  { key: 'templates',   label: 'Templates',     icon: FileText,  href: '/templates', always: true },
  {
    key: 'admin', label: 'Administração', icon: Users, href: '/admin', adminOnly: true,
    children: [
      { label: 'Usuários', icon: Users,   href: '/admin' },
      { label: 'Módulos',  icon: Package, href: '/admin/modules' },
    ],
  },
]

function NavNode({ item, depth = 0, collapsed }: { item: any; depth?: number; collapsed: boolean }) {
  const pathname = usePathname()
  const Icon = item.icon
  const hasChildren = item.children?.length > 0
  const isActive = depth === 0
    ? ['/','/dashboard','/onboarding','/admin'].includes(item.href)
        ? pathname === item.href
        : pathname.startsWith(item.href)
    : pathname === item.href
  const anyChildActive = hasChildren && item.children.some((c: any) =>
    pathname === c.href || (c.href !== '/onboarding' && pathname.startsWith(c.href))
  )
  const [open, setOpen] = useState(anyChildActive)

  const h   = depth === 0 ? 36 : 30
  const fs  = depth === 0 ? 13 : 12
  const ic  = depth === 0 ? 15 : 12
  const fw  = (isActive || anyChildActive) ? 600 : 500
  const col = (isActive || anyChildActive) ? 'var(--foreground)' : 'var(--muted-foreground)'
  const bg  = (isActive || anyChildActive) ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {hasChildren ? (
          <button onClick={() => setOpen(o => !o)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: h, padding: `0 ${hasChildren && !collapsed ? '6px' : '10px'} 0 10px`, borderRadius: hasChildren && !collapsed ? '8px 0 0 8px' : 8, border: 'none', background: bg, cursor: 'pointer', fontSize: fs, fontWeight: fw, color: col, fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { if (!isActive && !anyChildActive) { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--foreground)' } }}
            onMouseLeave={e => { if (!isActive && !anyChildActive) { e.currentTarget.style.background = bg; e.currentTarget.style.color = col } }}>
            <Icon size={ic} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
              {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</motion.span>}
            </AnimatePresence>
          </button>
        ) : (
          <Link href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: h, padding: '0 10px', borderRadius: 8, background: bg, fontSize: fs, fontWeight: fw, color: col, transition: 'all 0.12s', cursor: 'pointer', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = bg; (e.currentTarget as HTMLElement).style.color = col } }}>
              <Icon size={ic} style={{ flexShrink: 0 }} />
              <AnimatePresence initial={false}>
                {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</motion.span>}
              </AnimatePresence>
            </div>
          </Link>
        )}
        {hasChildren && !collapsed && (
          <button onClick={() => setOpen(o => !o)}
            style={{ width: 24, height: h, border: 'none', background: bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', borderRadius: '0 8px 8px 0', transition: 'background 0.12s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = bg)}>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={11} />
            </motion.div>
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {hasChildren && !collapsed && open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginLeft: 14, paddingLeft: 10, borderLeft: '1.5px solid var(--border)', marginTop: 1, marginBottom: 2 }}>
              {item.children.map((c: any) => <NavNode key={c.href} item={c} depth={depth + 1} collapsed={collapsed} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile, modules } = useCurrentUser()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const isAdmin = profile?.role === 'superadmin'
  const nav = buildNav(isAdmin)
  const visible = nav.filter(i =>
    i.adminOnly ? isAdmin : (i.always || canAccessModule(profile?.role ?? 'consultor', modules, i.key as ModuleKey))
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 248 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ height: '100vh', background: 'var(--card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', zIndex: 20, boxShadow: '2px 0 12px rgba(0,0,0,0.04)' }}
    >
      {/* Header com gradiente sutil */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MedLogoSVG size={24} color={isDark ? '#a5b4fc' : '#4f46e5'} />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                MedReview
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button onClick={onToggle}
          style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'background 0.12s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }} className="scrollbar-hide">
        {visible.map(item => <NavNode key={item.key} item={item} depth={0} collapsed={collapsed} />)}
      </nav>

      {/* Footer */}
      <div style={{ padding: '6px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {!collapsed && profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 9, background: 'var(--secondary)', marginBottom: 4 }}>
            <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
              <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{profile.role}</p>
            </div>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {isDark ? <Sun size={12} /> : <Moon size={12} />}
            </button>
          </div>
        )}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        )}
        <form action={logout}>
          <button type="submit"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', height: 34, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.12s', justifyContent: collapsed ? 'center' : 'flex-start' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
            <LogOut size={13} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
              {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ whiteSpace: 'nowrap' }}>Sair</motion.span>}
            </AnimatePresence>
          </button>
        </form>
      </div>
    </motion.aside>
  )
}

export function UserAvatar({ name, avatarUrl, size = 'sm' }: { name: string; avatarUrl?: string | null; size?: 'sm'|'md'|'lg' }) {
  const px = { sm: 26, md: 34, lg: 52 }[size]
  const fs = { sm: 10, md: 12, lg: 17 }[size]
  const initials = name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || '?'
  if (avatarUrl) return <img src={avatarUrl} alt={name} style={{ width: px, height: px, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
  return (
    <div style={{ width: px, height: px, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fs, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}
