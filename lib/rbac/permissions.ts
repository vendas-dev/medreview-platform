import type { Role, ModuleKey } from '@/types/database'

export const SUPERADMIN_ONLY: ModuleKey[] = ['disparos', 'admin']

export function canAccessModule(role: Role, granted: ModuleKey[], module: ModuleKey): boolean {
  if (SUPERADMIN_ONLY.includes(module) && role !== 'superadmin') return false
  return granted.includes(module)
}
