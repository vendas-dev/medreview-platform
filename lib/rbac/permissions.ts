import type { Role, ModuleKey } from '@/types/database'

// 'admin' continua travado pra superadmin sempre, por segurança — não é
// liberável por usuário. 'disparos' NÃO fica mais aqui: agora que dá pra
// liberar módulo por usuário (tela de editar usuário), quem decide se um
// usuário comum acessa é a liberação individual (`granted`), não uma
// trava fixa por role.
export const SUPERADMIN_ONLY: ModuleKey[] = ['admin']

export function canAccessModule(role: Role, granted: ModuleKey[], module: ModuleKey): boolean {
  if (SUPERADMIN_ONLY.includes(module) && role !== 'superadmin') return false
  return granted.includes(module)
}
