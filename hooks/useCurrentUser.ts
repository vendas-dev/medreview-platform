'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ModuleKey } from '@/types/database'

interface UserState {
  profile: Profile | null
  modules: ModuleKey[]
  loading: boolean
}

export function useCurrentUser() {
  const [state, setState] = useState<UserState>({
    profile: null,
    modules: [],
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setState({ profile: null, modules: [], loading: false }); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: perms } = await supabase
        .from('user_module_permissions')
        .select('granted, modules(key)')
        .eq('user_id', user.id)
        .eq('granted', true)

      const modules = perms?.map((p: any) => p.modules?.key).filter(Boolean) as ModuleKey[] ?? []

      setState({ profile: profile as Profile, modules, loading: false })
    }

    load()
  }, [])

  return state
}
