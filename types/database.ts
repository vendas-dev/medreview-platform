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
  key: ModuleKey
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

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  target_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; name: string; email: string }
        Update: Partial<Profile>
      }
      modules: {
        Row: Module
        Insert: Partial<Module> & { key: ModuleKey; label: string; url: string; icon: string }
        Update: Partial<Module>
      }
      user_module_permissions: {
        Row: UserModulePermission
        Insert: Partial<UserModulePermission> & { user_id: string; module_id: string }
        Update: Partial<UserModulePermission>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Partial<AuditLog> & { action: string }
        Update: Partial<AuditLog>
      }
    }
  }
}
