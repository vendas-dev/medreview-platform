'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Coloque este hook no layout principal para rastrear presença em toda plataforma
export function usePresence() {
  const pathname  = usePathname()
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function heartbeat() {
      try {
        await fetch('/api/admin/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: pathname }),
        })
      } catch {}
    }

    heartbeat() // imediato ao entrar na página
    timerRef.current = setInterval(heartbeat, 60_000) // a cada 1 minuto

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pathname])
}
