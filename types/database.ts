export type Role = 'superadmin' | 'consultor'
export type ModuleKey = 'telao' | 'calculadora' | 'disparos' | 'admin'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  avatar_url: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  key: string
  label: string
  url: string
  icon: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface UserModulePermission {
  id: string
  user_id: string
  module_id: string
  granted: boolean
  granted_by: string | null
  created_at: string
}

export type Database = { public: { Tables: any } }
