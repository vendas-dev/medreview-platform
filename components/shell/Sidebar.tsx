'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Monitor, Calculator, Zap, Settings, LogOut,
  ChevronLeft, ChevronRight, Sun, Moon, GraduationCap, ChevronDown,
  Bot, Video, BarChart2, List, TrendingUp, Home, Users, Package, FileText, CalendarDays, Send, Link2, FlaskConical,
  Target,
} from 'lucide-react'
import { logout } from '@/app/(auth)/login/actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canAccessModule } from '@/lib/rbac/permissions'
import { useTheme } from '@/components/ThemeProvider'
import { MedLogoSVG } from '@/components/MedLogo'
import { usePresence } from '@/hooks/usePresence'
import { useActiveModuleKeys, useActiveModules } from '@/hooks/useModules'
import type { ModuleKey } from '@/types/database'

interface NavChild { key?: string; label: string; icon: any; href: string; always?: boolean; children?: NavChild[] }
interface NavItem  { key: string; label: string; icon: any; href: string; always?: boolean; adminOnly?: boolean; children?: NavChild[] }

const buildNav = (isAdmin: boolean): NavItem[] => [
  { key: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard, href: '/dashboard',    always: true },
  {
    key: 'onboarding', label: 'Onboarding', icon: GraduationCap, href: '/onboarding', always: true,
    children: isAdmin ? [
      { label: 'Visão geral', icon: Home,           href: '/onboarding' },
      { label: 'Trilha',      icon: List,           href: '/onboarding/trilha' },
      { label: 'Videoaulas',  icon: Video,          href: '/onboarding/videoaulas' },
      { label: 'Config. IA',  icon: Bot,            href: '/onboarding/config' },
      { label: 'Dashboard',   icon: BarChart2,      href: '/onboarding/dashboard' },
      { label: 'Simulados',   icon: FlaskConical,   href: '/admin/simulados' },
    ] : [
      { label: 'Início',         icon: Home,          href: '/onboarding' },
      { label: 'Minha Trilha',   icon: List,          href: '/onboarding/trilha' },
      { label: 'Med.AI',         icon: Bot,           href: '/onboarding/copilot' },
      { label: 'Videoaulas',     icon: Video,         href: '/onboarding/videoaulas' },
      { label: 'Meu Progresso',  icon: TrendingUp,    href: '/onboarding/progresso' },
      { label: 'Simulado Final', icon: FlaskConical,  href: '/onboarding/simulado' },
    ],
  },
  // ── Ferramentas — agrupa tudo que antes ficava solto na raiz do menu.
  // Cada item carrega sua própria key de módulo, então é filtrado
  // individualmente (some sozinho se não estiver liberado pro usuário).
  {
    key: 'ferramentas', label: 'Ferramentas', icon: Zap, href: '/ferramentas', always: true,
    children: [
      { key: 'telao',        label: 'Telão',          icon: Monitor,      href: '/telao' },
      { key: 'calculadora',  label: 'Calculadora',    icon: Calculator,   href: '/calculadora' },
      { key: 'calculadora2', label: 'Calculadora 2',  icon: Calculator,   href: '/calculadora2' },
      { key: 'milestones',   label: 'Milestones',     icon: CalendarDays, href: '/milestones', always: true },
      { key: 'disparos',     label: 'Disparos',       icon: Send,         href: '/disparos' },
      { key: 'disparos',     label: 'Links',          icon: Link2,        href: '/disparos/links' },
      { key: 'templates',    label: 'Templates',      icon: FileText,     href: '/templates',  always: true },
    ],
  },
  // ── Administração — unifica o que antes era "Inteligência Comercial"
  // (Visão Geral / Metas / Meu Painel) e "Administração" (Usuários / Módulos)
  // numa seção só. Sempre visível — o conteúdo é que muda por role.
  {
    key: 'administracao', label: 'Administração', icon: Users, href: '/administracao', always: true,
    children: isAdmin ? [
      { label: 'Visão Geral',      icon: BarChart2, href: '/intel' },
      { label: 'Meta dos Closers', icon: Target,    href: '/intel/goals' },
      { label: 'Módulos',          icon: Package,   href: '/admin/modules' },
      { label: 'Usuários',         icon: Users,     href: '/admin' },
    ] : [
      { label: 'Meu Painel', icon: BarChart2, href: '/intel' },
    ],
  },
]

function NavNode({ item, depth = 0, collapsed, activeModules }: { item: any; depth?: number; collapsed: boolean; activeModules: any[] | null }) {
  const pathname = usePathname()
  const Icon = item.icon
  const hasChildren = item.children?.length > 0
  const isActive = depth === 0
    ? ['/','/dashboard','/onboarding','/ferramentas','/administracao'].includes(item.href)
        ? pathname === item.href
        : pathname.startsWith(item.href)
    : pathname === item.href
  const anyChildActive = hasChildren && item.children.some((c: any) =>
    pathname === c.href || (c.href !== '/onboarding' && c.href !== '/intel' && pathname.startsWith(c.href))
  )
  const [open, setOpen] = useState(anyChildActive)

  const h  = depth === 0 ? 36 : 30
  const fs = depth === 0 ? 13 : 12
  const ic = depth === 0 ? 15 : 12

  const activeBg    = 'rgba(79,70,229,0.1)'
  const activeColor = '#4f46e5'
  const hoverBg     = 'var(--secondary)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {hasChildren ? (
          <button onClick={() => setOpen(o => !o)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: h, padding: `0 ${!collapsed ? '6px' : '10px'} 0 10px`, borderRadius: hasChildren && !collapsed ? '8px 0 0 8px' : 8, border: 'none', background: (isActive || anyChildActive) ? activeBg : 'transparent', cursor: 'pointer', fontSize: fs, fontWeight: (isActive || anyChildActive) ? 600 : 500, color: (isActive || anyChildActive) ? activeColor : 'var(--muted-foreground)', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { if (!isActive && !anyChildActive) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = 'var(--foreground)' } }}
            onMouseLeave={e => { if (!isActive && !anyChildActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' } }}>
            <Icon size={ic} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
              {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeModules?.find(m => m.key === item.key)?.label ?? item.label}</motion.span>}
            </AnimatePresence>
          </button>
        ) : (
          <Link href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: h, padding: '0 10px', borderRadius: 8, background: isActive ? activeBg : 'transparent', fontSize: fs, fontWeight: isActive ? 600 : 500, color: isActive ? activeColor : 'var(--muted-foreground)', transition: 'all 0.12s', cursor: 'pointer', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = hoverBg; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)' } }}>
              <Icon size={ic} style={{ flexShrink: 0 }} />
              <AnimatePresence initial={false}>
                {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeModules?.find(m => m.key === item.key)?.label ?? item.label}</motion.span>}
              </AnimatePresence>
            </div>
          </Link>
        )}
        {hasChildren && !collapsed && (
          <button onClick={() => setOpen(o => !o)}
            style={{ width: 24, height: h, border: 'none', background: (isActive || anyChildActive) ? activeBg : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', borderRadius: '0 8px 8px 0', transition: 'background 0.12s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = (isActive || anyChildActive) ? activeBg : 'transparent')}>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={11} />
            </motion.div>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {hasChildren && !collapsed && open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginLeft: 14, paddingLeft: 10, borderLeft: '2px solid var(--border)', marginTop: 1, marginBottom: 2 }}>
              {item.children.map((c: any) => <NavNode key={c.href} item={c} depth={depth + 1} collapsed={collapsed} activeModules={activeModules} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile, modules } = useCurrentUser()
  const activeKeys    = useActiveModuleKeys()
  const activeModules = useActiveModules()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const isAdmin = profile?.role === 'superadmin'
  const nav = buildNav(isAdmin)

  // Cada item de "Ferramentas" carrega sua própria key de módulo — filtra
  // individualmente (some sozinho o que não estiver liberado), e some a
  // seção inteira se não sobrar nenhuma ferramenta liberada.
  const gate = (key: string, always?: boolean) => {
    if (always) return true
    if (activeKeys !== null && !activeKeys.includes(key)) return false
    return canAccessModule(profile?.role ?? 'consultor', modules, key as ModuleKey)
  }

  const visible = nav
    .map(i => i.key === 'ferramentas' && i.children
      ? { ...i, children: i.children.filter(c => gate(c.key!, c.always)) }
      : i
    )
    .filter(i => {
      if (i.adminOnly) return isAdmin
      if (i.key === 'ferramentas') return (i.children?.length ?? 0) > 0
      if (i.always) return true
      return gate(i.key, i.always)
    })

  usePresence()

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 248 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ height: '100vh', background: 'var(--card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', zIndex: 20, boxShadow: isDark ? '2px 0 20px rgba(0,0,0,0.4)' : '2px 0 20px rgba(17,24,39,0.06), 1px 0 0 var(--border)' }}>

      {/* Logo */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>
            <MedLogoSVG size={18} color="#fff" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', whiteSpace: 'nowrap', letterSpacing: '-0.025em' }}>MedReview</motion.span>}
          </AnimatePresence>
        </div>
        <button onClick={onToggle}
          style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s', boxShadow: 'var(--shadow-xs)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--secondary)')}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }} className="scrollbar-hide">
        {visible.map(item => <NavNode key={item.key} item={item} depth={0} collapsed={collapsed} activeModules={activeModules} />)}
      </nav>

      {/* Footer */}
      <div style={{ padding: '6px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {!collapsed && profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10, background: 'var(--secondary)', marginBottom: 4, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
              <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{profile.role}</p>
            </div>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s', flexShrink: 0, boxShadow: 'var(--shadow-xs)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
              {isDark ? <Sun size={12} /> : <Moon size={12} />}
            </button>
          </div>
        )}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', boxShadow: 'var(--shadow-xs)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--secondary)')}>
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        )}
        <form action={logout}>
          <button type="submit"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 34, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.12s', justifyContent: collapsed ? 'center' : 'flex-start' }}
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
  const px = { sm: 28, md: 36, lg: 54 }[size]
  const fs = { sm: 11, md: 13, lg: 18 }[size]
  const initials = name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || '?'
  if (avatarUrl) return <img src={avatarUrl} alt={name} style={{ width: px, height: px, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0, boxShadow: 'var(--shadow-xs)' }} />
  return (
    <div style={{ width: px, height: px, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fs, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>
      {initials}
    </div>
  )
}
