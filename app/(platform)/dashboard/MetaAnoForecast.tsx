'use client'
import { useCallback, useEffect, useState } from 'react'
import { MetaAnoCard } from '@/components/dashboard/MetaAnoCard'

// Forecast → meta do ano: busca a receita de 1º de janeiro até hoje e desenha a régua 60 mi → 72 mi. Atualiza sozinha a cada minuto (e ao voltar para a aba).
export function MetaAnoForecast() {
  const [d, setD] = useState<{ realizado: number; today: string } | null>(null)
  const [erro, setErro] = useState(false)
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/meta-ano', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const j = await res.json(); if (typeof j.realizado !== 'number' || typeof j.today !== 'string') throw new Error('formato')
      setD({ realizado: j.realizado, today: j.today }); setErro(false)
    } catch { setErro(true) }
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') load() }, 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [load])
  return <MetaAnoCard realizado={d?.realizado ?? null} today={d?.today ?? null} erro={erro && !d} />
}
