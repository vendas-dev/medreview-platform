'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ActiveModule {
  id:        string
  key:       string
  label:     string   // ← label do banco, atualizável em tempo real
  is_active: boolean
  sort_order:number
}

// Retorna null enquanto carrega — sidebar não esconde nada durante loading
export function useActiveModuleKeys(): string[] | null {
  const [keys, setKeys] = useState<string[] | null>(null)
  const fetchKeys = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('modules').select('key').eq('is_active', true)
    setKeys((data ?? []).map((m: any) => String(m.key)))
  }, [])
  useEffect(() => {
    fetchKeys()
    window.addEventListener('module-toggled', fetchKeys)
    const supabase = createClient()
    const channel = supabase.channel('active-modules-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modules' }, fetchKeys)
      .subscribe()
    return () => { window.removeEventListener('module-toggled', fetchKeys); supabase.removeChannel(channel) }
  }, [fetchKeys])
  return keys
}

// Retorna todos os módulos ativos COM label do banco — para o sidebar usar label dinâmico
export function useActiveModules(): ActiveModule[] | null {
  const [modules, setModules] = useState<ActiveModule[] | null>(null)
  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('modules').select('id,key,label,is_active,sort_order').eq('is_active', true).order('sort_order')
    setModules(data ?? [])
  }, [])
  useEffect(() => {
    fetch()
    window.addEventListener('module-toggled', fetch)
    const supabase = createClient()
    const channel = supabase.channel('active-modules-label-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modules' }, fetch)
      .subscribe()
    return () => { window.removeEventListener('module-toggled', fetch); supabase.removeChannel(channel) }
  }, [fetch])
  return modules
}
