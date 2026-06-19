'use client'
import { useState, useEffect, useCallback } from 'react'
import { AppSettings, DEFAULT_SETTINGS } from '../lib/types'

const KEY = 'medreview-calc2-settings-v2'

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded,   setLoaded]        = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const p = JSON.parse(raw) as Partial<AppSettings>
        setSettingsState(prev => ({
          ...prev, ...p,
          columnMap:      { ...DEFAULT_SETTINGS.columnMap,      ...(p.columnMap      ?? {}) },
          verticalRates:  { ...DEFAULT_SETTINGS.verticalRates,  ...(p.verticalRates  ?? {}) },
          eventDiscounts: { ...DEFAULT_SETTINGS.eventDiscounts, ...(p.eventDiscounts ?? {}) },
        }))
      }
    } catch {}
    setLoaded(true)
  }, [])

  const setSettings = useCallback((update: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    setSettingsState(prev => {
      const next = typeof update === 'function' ? update(prev) : { ...prev, ...update }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch {}
    setSettingsState(DEFAULT_SETTINGS)
  }, [])

  return { settings, setSettings, reset, loaded }
}
