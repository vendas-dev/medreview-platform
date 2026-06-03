'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ModuleKey } from '@/types/database'

export function useCurrentUser() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modules, setModules] = useState<ModuleKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: perms } = await supabase
        .from('user_module_permissions')
        .select('granted, modules(key)')
        .eq('user_id', user.id).eq('granted', true)
      setProfile(p as any)
      setModules((perms?.map((p: any) => p.modules?.key).filter(Boolean) ?? []) as ModuleKey[])
      setLoading(false)
    }
    load()
  }, [])

  return { profile, modules, loading }
}
