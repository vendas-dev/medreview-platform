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

interface NavChild { key?: string; label: string; icon: any; href: string; always?: boolean; staticLabel?: boolean; children?: NavChild[] }
interface NavItem  { key: string; label: string; icon: any; href: string; always?: boolean; adminOnly?: boolean; children?: NavChild[] }

const buildNav = (isAdmin: boolean): NavItem[] => [
  { key: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard, href: '/dashboard',    always: true },
  {
    key: 'onboarding', label: 'Onboarding', icon: GraduationCap, href: '/onboarding', always: true,
    children: isAdmin ? [
      { label: 'Visão geral', icon: Home,           href: '/onboarding' },
      { label: 'Trilha',      icon: List,           href: '/onboarding/trilha' },
      { label: 'Videoaulas',  icon: Video,          href: '/onboarding/videoaulas' },
      { label: 'Medy',        icon: Bot,            href: '/onboarding/copilot' },
      { label: 'Config. IA',  icon: Bot,            href: '/onboarding/config' },
      { label: 'Dashboard',   icon: BarChart2,      href: '/onboarding/dashboard' },
      { label: 'Simulados',   icon: FlaskConical,   href: '/admin/simulados' },
    ] : [
      { label: 'Início',         icon: Home,          href: '/onboarding' },
      { label: 'Minha Trilha',   icon: List,          href: '/onboarding/trilha' },
      { label: 'Medy',         icon: Bot,           href: '/onboarding/copilot' },
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
      { key: 'disparos',     label: 'Links',          icon: Link2,        href: '/disparos/links', staticLabel: true },
      { key: 'templates',    label: 'Templates',      icon: FileText,     href: '/templates',  always: true },
    ],
  },
  // ── Administração — unifica o que antes era "Inteligência Comercial"
  // (Visão Geral / Metas / Meu Painel) e "Administração" (Usuários / Módulos)
  // numa seção só. AGORA só aparece pra admin — o usuário comum não usa
  // mais essa seção (o "Meu Painel" que existia aqui pra ele foi
  // descontinuado), então o item inteiro nem entra no array pro usuário.
  ...(isAdmin ? [{
    key: 'administracao', label: 'Administração', icon: Users, href: '/administracao', always: true,
    children: [
      { label: 'Visão Geral',      icon: BarChart2, href: '/intel' },
      { label: 'Meta dos Closers', icon: Target,    href: '/intel/goals' },
      { label: 'Módulos',          icon: Package,   href: '/admin/modules' },
      { label: 'Usuários',         icon: Users,     href: '/admin' },
    ],
  } as NavItem] : []),
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

  const h  = depth === 0 ? 44 : 36
  const fs = depth === 0 ? 13.5 : 12.5
  const ic = depth === 0 ? 17 : 14

  // O item ativo agora é um "pill" elevado (fundo branco + sombra leve),
  // contrastando com o fundo próprio da sidebar (--sidebar-bg) — preserva
  // a mesma linguagem visual do dark, onde o item ativo também se destaca
  // por elevação, não por preenchimento de cor.
  const activeBg    = 'var(--card)'
  const activeColor = 'var(--foreground)'
  const hoverBg     = 'var(--border)'
  const activeShadow = 'var(--shadow-xs)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {hasChildren ? (
          <button onClick={() => setOpen(o => !o)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: h, padding: `0 ${!collapsed ? '6px' : '10px'} 0 12px`, borderRadius: hasChildren && !collapsed ? '10px 0 0 10px' : 10, border: 'none', background: (isActive || anyChildActive) ? activeBg : 'transparent', boxShadow: (isActive || anyChildActive) ? activeShadow : 'none', cursor: 'pointer', fontSize: fs, fontWeight: (isActive || anyChildActive) ? 700 : 500, color: (isActive || anyChildActive) ? activeColor : 'var(--muted-foreground)', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.14s', whiteSpace: 'nowrap', position: 'relative' }}
            onMouseEnter={e => { if (!isActive && !anyChildActive) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = 'var(--foreground)' } }}
            onMouseLeave={e => { if (!isActive && !anyChildActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' } }}>
            {depth === 0 && (isActive || anyChildActive) && (
              <span style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 99, background: 'var(--primary)' }} />
            )}
            <Icon size={ic} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
              {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.staticLabel ? item.label : (activeModules?.find(m => m.key === item.key)?.label ?? item.label)}</motion.span>}
            </AnimatePresence>
          </button>
        ) : (
          <Link href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: h, padding: '0 12px', borderRadius: 10, background: isActive ? activeBg : 'transparent', boxShadow: isActive ? activeShadow : 'none', fontSize: fs, fontWeight: isActive ? 700 : 500, color: isActive ? activeColor : 'var(--muted-foreground)', transition: 'all 0.14s', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative' }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = hoverBg; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)' } }}>
              {depth === 0 && isActive && (
                <span style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 99, background: 'var(--primary)' }} />
              )}
              <Icon size={ic} style={{ flexShrink: 0 }} />
              <AnimatePresence initial={false}>
                {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.staticLabel ? item.label : (activeModules?.find(m => m.key === item.key)?.label ?? item.label)}</motion.span>}
              </AnimatePresence>
            </div>
          </Link>
        )}
        {hasChildren && !collapsed && (
          <button onClick={() => setOpen(o => !o)}
            style={{ width: 28, height: h, border: 'none', background: (isActive || anyChildActive) ? activeBg : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', borderRadius: '0 10px 10px 0', transition: 'background 0.14s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = (isActive || anyChildActive) ? activeBg : 'transparent')}>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={12} />
            </motion.div>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {hasChildren && !collapsed && open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginLeft: 18, paddingLeft: 14, borderLeft: '2px solid var(--border)', marginTop: 3, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
      animate={{ width: collapsed ? 60 : 260 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ height: '100vh', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', zIndex: 20, boxShadow: isDark ? '2px 0 20px rgba(0,0,0,0.28)' : '2px 0 20px rgba(15,23,42,0.05), 1px 0 0 var(--border)' }}>

      {/* Logo */}
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>
            <MedLogoSVG size={19} color="#fff" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.25 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--foreground)', whiteSpace: 'nowrap', letterSpacing: '-0.025em' }}>{isAdmin ? 'Gestão360' : 'Comercial360'}</span>
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', opacity: 0.65 }}>{isAdmin ? 'Gestão Operacional' : 'Plataforma Operacional'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={onToggle}
          style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.14s', boxShadow: 'var(--shadow-xs)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 3 }} className="scrollbar-hide">
        {visible.map(item => <NavNode key={item.key} item={item} depth={0} collapsed={collapsed} activeModules={activeModules} />)}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {!collapsed && profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--card)', marginBottom: 8, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
              <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{profile.role}</p>
            </div>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.14s', flexShrink: 0, boxShadow: 'var(--shadow-xs)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        )}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', boxShadow: 'var(--shadow-xs)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        )}
        <form action={logout}>
          <button type="submit"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 38, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.14s', justifyContent: collapsed ? 'center' : 'flex-start' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
            <LogOut size={14} style={{ flexShrink: 0 }} />
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
