'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AppSettings, DEFAULT_SETTINGS } from '../lib/types'
import { createClient } from '@/lib/supabase/client'

const ROW_ID = 'default'

// Mescla o que veio do banco com os defaults, campo a campo — se uma
// configuração nova for adicionada no código antes de alguém salvar de
// novo, ela não fica faltando (mesma lógica de merge que já existia
// quando isso era localStorage).
function mergeWithDefaults(saved: Partial<AppSettings> | null | undefined): AppSettings {
  const p = saved ?? {}
  return {
    ...DEFAULT_SETTINGS, ...p,
    columnMap:      { ...DEFAULT_SETTINGS.columnMap,      ...(p.columnMap      ?? {}) },
    verticalRates:  { ...DEFAULT_SETTINGS.verticalRates,  ...(p.verticalRates  ?? {}) },
    eventDiscounts: { ...DEFAULT_SETTINGS.eventDiscounts, ...(p.eventDiscounts ?? {}) },
    discountLimits: { ...DEFAULT_SETTINGS.discountLimits, ...(p.discountLimits ?? {}) },
  }
}

// ── Configurações compartilhadas (Supabase), não mais por navegador ──────
// Antes ficavam no localStorage — só quem tinha configurado localmente
// enxergava o link da planilha, os limites de desconto, etc. Agora é uma
// linha única (singleton) na tabela calculadora2_settings, lida por todo
// mundo. A interface pública (settings, setSettings, reset, loaded)
// continua exatamente igual — nenhum outro arquivo (CalculadoraView,
// SettingsDialog) precisou mudar por causa disso.
export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded,   setLoaded]        = useState(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    supabase.from('calculadora2_settings').select('settings').eq('id', ROW_ID).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Tabela ainda não migrada, ou erro de rede — cai pros defaults
          // em vez de travar a tela pra sempre em "carregando".
          setSettingsState(DEFAULT_SETTINGS)
        } else {
          setSettingsState(mergeWithDefaults(data?.settings as Partial<AppSettings> | undefined))
        }
        setLoaded(true)
      })

    // Realtime: se alguém (ex: admin) salvar uma configuração nova, quem
    // já está com a calculadora aberta em outra aba/máquina recebe a
    // atualização sem precisar recarregar a página.
    const channel = supabase.channel('calc2-settings-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calculadora2_settings', filter: `id=eq.${ROW_ID}` }, (payload) => {
        const next = (payload.new as any)?.settings as Partial<AppSettings> | undefined
        if (next) setSettingsState(mergeWithDefaults(next))
      })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [])

  const setSettings = useCallback((update: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    setSettingsState(prev => {
      const next = typeof update === 'function' ? update(prev) : { ...prev, ...update }
      const supabase = supabaseRef.current
      supabase.from('calculadora2_settings').upsert({
        id: ROW_ID, settings: next, updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error('Erro ao salvar configurações da calculadora2:', error.message)
      })
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const supabase = supabaseRef.current
    supabase.from('calculadora2_settings').upsert({
      id: ROW_ID, settings: DEFAULT_SETTINGS, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    setSettingsState(DEFAULT_SETTINGS)
  }, [])

  return { settings, setSettings, reset, loaded }
}
