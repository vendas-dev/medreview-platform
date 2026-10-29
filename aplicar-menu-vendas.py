#!/usr/bin/env python3
"""
Menu — acrescenta as telas de Vendas na Sidebar (desktop) e no MobileDrawer (celular).

  uso (na raiz do projeto):   python aplicar-menu-vendas.py .

  CLOSER      → "Minhas Vendas" e, logo abaixo, "Trocas de Venda", ambos logo depois do Dashboard.
  SUPERADMIN  → a seção "Vendas" (Vendas Individuais · Trocas de Venda) logo depois do Dashboard, com o NÚMERO de pedidos pendentes
                (no item "Trocas de Venda" e também na seção "Vendas" quando ela está fechada). O número se atualiza sozinho.
  Também corrige 2 detalhes que apareceriam com as páginas novas: "Minhas Vendas" e "Trocas de Venda" não ficam acesas juntas,
  e a categoria "Administração" não abre sozinha quando você está em /admin/vendas.

Altera 2 arquivos SEM substituí-los, ancorado na estrutura do código: components/shell/Sidebar.tsx e components/shell/MobileDrawer.tsx.
TUDO-OU-NADA (se um trecho não bater, nada é gravado e ele diz qual), pode rodar de novo ("já aplicado"), mantém CRLF.
Requer os arquivos do pacote de Vendas (lib/vendas/useTrocasBadge.ts) no projeto.
"""
import os, sys
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
ROOT = sys.argv[1] if len(sys.argv) == 2 else None
if not ROOT: print(__doc__); sys.exit(2)
SB, MD = 'components/shell/Sidebar.tsx', 'components/shell/MobileDrawer.tsx'
MARK = 'useTrocasBadge'
def ler(rel):
    p = os.path.join(ROOT, *rel.split('/'))
    if not os.path.exists(p): print(f'NADA foi alterado: arquivo não encontrado: {rel} (rode na raiz do projeto)'); sys.exit(1)
    raw = open(p, 'rb').read().decode('utf-8'); return p, raw.replace('\r\n', '\n'), '\r\n' in raw
falhas = []
def sub(txt, old, new, rotulo, n=1):
    c = txt.count(old)
    if c != n: falhas.append(f'  - {rotulo}: esperava {n} ocorrência(s) e achei {c}'); return txt
    return txt.replace(old, new)
psb, sb, csb = ler(SB); pmd, md, cmd = ler(MD)
ja = [MARK in sb, MARK in md]
if all(ja): print('Já aplicado. Nada foi alterado.'); sys.exit(0)
if any(ja): print('NADA foi alterado.\n  - estado misto: só um dos dois arquivos já tem o menu de Vendas.'); sys.exit(1)

# ══ Sidebar.tsx ══
sb = sub(sb, "Target, Image as ImageIcon, PartyPopper, MonitorPlay, Trophy, Megaphone\n} from 'lucide-react'", "Target, Image as ImageIcon, PartyPopper, MonitorPlay, Trophy, Megaphone, Receipt, Repeat2\n} from 'lucide-react'", 'Sidebar: import dos ícones')
sb = sub(sb, "import { usePresence } from '@/hooks/usePresence'\n", "import { usePresence } from '@/hooks/usePresence'\nimport { useTrocasBadge } from '@/lib/vendas/useTrocasBadge'\n", 'Sidebar: import do contador de trocas')
sb = sub(sb, "children?: NavChild[] }\ninterface NavItem ", "children?: NavChild[]; badge?: number }\ninterface NavItem ", 'Sidebar: NavChild.badge')
sb = sub(sb, "collapsedLink?: boolean; children?: NavChild[] }", "collapsedLink?: boolean; children?: NavChild[]; badge?: number }", 'Sidebar: NavItem.badge')
sb = sub(sb, "const buildNav = (isAdmin: boolean): NavItem[] => [", "const buildNav = (isAdmin: boolean, trocasPendentes = 0): NavItem[] => [", 'Sidebar: assinatura do buildNav')
DASH = "    : { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', always: true },\n"
VENDAS = DASH + """  // Vendas — logo abaixo do Dashboard. CLOSER: "Minhas Vendas" e "Trocas de Venda". SUPERADMIN: a seção "Vendas" (Vendas Individuais · Trocas de Venda),
  // com o número de pedidos de troca PENDENTES (o mesmo estilo do sininho).
  ...(isAdmin
    ? [{
        key: 'vendas', label: 'Vendas', icon: Receipt, href: '/admin/vendas', always: true, collapsedLink: true, staticLabel: true, badge: trocasPendentes,
        children: [
          { label: 'Vendas Individuais', icon: Users, href: '/admin/vendas' },
          { label: 'Trocas de Venda', icon: Repeat2, href: '/admin/vendas/trocas', badge: trocasPendentes },
        ],
      } as NavItem]
    : [
        { key: 'minhas-vendas', label: 'Minhas Vendas', icon: Receipt, href: '/vendas', always: true, staticLabel: true } as NavItem,
        { key: 'trocas-venda', label: 'Trocas de Venda', icon: Repeat2, href: '/vendas/trocas', always: true, staticLabel: true } as NavItem,
      ]),
"""
sb = sub(sb, DASH, VENDAS, 'Sidebar: item Dashboard (ponto de inserção)')
sb = sub(sb, "['/','/dashboard','/onboarding','/ferramentas','/administracao'].includes(item.href)", "['/','/dashboard','/onboarding','/ferramentas','/administracao','/vendas'].includes(item.href)", 'Sidebar: "Minhas Vendas" só acende na própria página')
sb = sub(sb, "(c.href !== '/onboarding' && c.href !== '/intel' && pathname.startsWith(c.href))", "(c.href !== '/onboarding' && c.href !== '/intel' && !(c.href === '/admin' && pathname.startsWith('/admin/vendas')) && pathname.startsWith(c.href))", 'Sidebar: Administração não abre em /admin/vendas')
LAB = "?? item.label)}</motion.span>}"
PILL = "?? item.label)}{item.badge > 0 && <span data-v=\"nav-badge\" aria-label={`${item.badge} pendente(s)`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', minWidth: 18, height: 18, padding: '0 5px', marginLeft: 8, borderRadius: 99, background: '#ef4444', color: '#fff', fontSize: 10.5, fontWeight: 800, lineHeight: 1 }}>{item.badge > 99 ? '99+' : item.badge}</span>}</motion.span>}"
sb = sub(sb, LAB, PILL, 'Sidebar: número ao lado do rótulo (2 lugares)', n=2)
sb = sub(sb, "  const nav = buildNav(isAdmin)\n", "  const trocasPendentes = useTrocasBadge(isAdmin)\n  const nav = buildNav(isAdmin, trocasPendentes)\n", 'Sidebar: uso do contador')

# ══ MobileDrawer.tsx ══
md = sub(md, "import { LayoutDashboard, Monitor, Calculator, Zap, Settings, X, LogOut } from 'lucide-react'", "import { LayoutDashboard, Monitor, Calculator, Zap, Settings, X, LogOut, Receipt, Repeat2 } from 'lucide-react'", 'MobileDrawer: import dos ícones')
md = sub(md, "import { UserAvatar } from '@/components/shell/Sidebar'\n", "import { UserAvatar } from '@/components/shell/Sidebar'\nimport { useTrocasBadge } from '@/lib/vendas/useTrocasBadge'\n", 'MobileDrawer: import do contador')
md = sub(md, "  { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard, href: '/dashboard',   always: true },\n", """  { key: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard, href: '/dashboard',   always: true },
  { key: 'minhas-vendas', label: 'Minhas Vendas',   icon: Receipt, href: '/vendas',              always: true, closerOnly: true },
  { key: 'trocas-venda',  label: 'Trocas de Venda', icon: Repeat2, href: '/vendas/trocas',       always: true, closerOnly: true },
  { key: 'vendas-admin',  label: 'Vendas Individuais', icon: Receipt, href: '/admin/vendas',     always: true, adminOnly: true },
  { key: 'trocas-admin',  label: 'Trocas de Venda', icon: Repeat2, href: '/admin/vendas/trocas', always: true, adminOnly: true },
""", 'MobileDrawer: itens de Vendas')
md = sub(md, "  const isAdmin = profile?.role === 'superadmin'\n", "  const isAdmin = profile?.role === 'superadmin'\n  const trocasPendentes = useTrocasBadge(isAdmin)\n", 'MobileDrawer: contador')
md = sub(md, "    if (i.key === 'admin') return isAdmin\n", "    if (i.key === 'admin') return isAdmin\n    if ((i as any).closerOnly) return !isAdmin\n    if ((i as any).adminOnly) return isAdmin\n", 'MobileDrawer: quem vê o quê')
md = sub(md, "const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)", "const active = item.href === '/dashboard' || item.href === '/vendas' || item.href === '/admin/vendas' ? pathname === item.href : item.href === '/admin' ? pathname.startsWith('/admin') && !pathname.startsWith('/admin/vendas') : pathname.startsWith(item.href)", 'MobileDrawer: item ativo')
md = sub(md, "                      {item.label}\n", "                      {item.label}\n                      {item.key === 'trocas-admin' && trocasPendentes > 0 && <span data-v=\"nav-badge\" style={{ marginLeft: 'auto', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{trocasPendentes > 99 ? '99+' : trocasPendentes}</span>}\n", 'MobileDrawer: número ao lado do rótulo')
if falhas:
    print('NADA foi alterado. Estes pontos não bateram com o esperado:'); print('\n'.join(falhas)); print('  Me mande o(s) arquivo(s) atual(is) que eu ajusto o script.'); sys.exit(1)
open(psb, 'wb').write((sb.replace('\n', '\r\n') if csb else sb).encode('utf-8')); open(pmd, 'wb').write((md.replace('\n', '\r\n') if cmd else md).encode('utf-8'))
print('OK: menu de Vendas aplicado.\n  ✓ ' + SB + '\n  ✓ ' + MD + '\nPRÓXIMO PASSO: commit + push na master (as páginas e APIs de Vendas precisam estar no projeto também).')
