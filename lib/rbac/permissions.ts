import type { Role, ModuleKey } from '@/types/database'

export const ROLE_DEFAULT_MODULES: Record<Role, ModuleKey[]> = {
  superadmin: ['telao', 'calculadora', 'disparos', 'admin'],
  consultor: ['telao', 'calculadora'],
}

export const MODULE_REQUIRES_SUPERADMIN: ModuleKey[] = ['disparos', 'admin']

export function canAccessModule(
  role: Role,
  grantedModules: ModuleKey[],
  module: ModuleKey
): boolean {
  if (MODULE_REQUIRES_SUPERADMIN.includes(module) && role !== 'superadmin') {
    return false
  }
  return grantedModules.includes(module)
}

export const MODULE_META: Record<ModuleKey, { label: string; icon: string; href: string; description: string }> = {
  telao: {
    label: 'Telão ao Vivo',
    icon: 'monitor',
    href: '/telao',
    description: 'Ranking de vendas em tempo real',
  },
  calculadora: {
    label: 'Calculadora',
    icon: 'calculator',
    href: '/calculadora',
    description: 'Cálculo de ofertas e condições',
  },
  disparos: {
    label: 'Disparos',
    icon: 'zap',
    href: '/disparos',
    description: 'Links, cupons e rastreamento',
  },
  admin: {
    label: 'Administração',
    icon: 'settings',
    href: '/admin',
    description: 'Gestão de usuários e permissões',
  },
}
