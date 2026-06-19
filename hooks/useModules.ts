'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Retorna null enquanto carrega — sidebar não esconde nada durante loading
export function useActiveModuleKeys(): string[] | null {
  const [keys, setKeys] = useState<string[] | null>(null)

  const fetchKeys = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('modules')
      .select('key')
      .eq('is_active', true)
    setKeys((data ?? []).map((m: any) => String(m.key)))
  }, [])

  useEffect(() => {
    fetchKeys()

    // 1) Atualização imediata na mesma sessão (sem Supabase Realtime)
    //    A página de módulos dispara este evento ao ativar/desativar
    window.addEventListener('module-toggled', fetchKeys)

    // 2) Supabase Realtime — atualiza outras abas/sessões
    //    Requer tabela modules habilitada em: Supabase → Database → Replication
    const supabase = createClient()
    const channel = supabase
      .channel('active-modules-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modules' }, fetchKeys)
      .subscribe()

    return () => {
      window.removeEventListener('module-toggled', fetchKeys)
      supabase.removeChannel(channel)
    }
  }, [fetchKeys])

  return keys
}
