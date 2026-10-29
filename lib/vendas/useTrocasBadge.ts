'use client'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/** O numerozinho do menu: pedidos de troca PENDENTES (só conta para superadmin). Atualiza ao trocar de página, ao voltar para a aba,
 *  a cada 60s e quando uma tela avisa (window "trocas:atualizou"). Nunca quebra o menu: se a rota falhar, mantém o último número. */
export function useTrocasBadge(ativo: boolean): number {
  const [n, setN] = useState(0); const pathname = usePathname()
  const buscar = useCallback(async () => {
    if (!ativo) return
    try { const r = await fetch('/api/trocas/contagem', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); setN(Math.max(0, Number(j?.pendentes) || 0)) } } catch { /* mantém o último valor */ }
  }, [ativo])
  useEffect(() => { buscar() }, [buscar, pathname])
  useEffect(() => {
    if (!ativo) return
    const t = setInterval(buscar, 60_000); const f = () => { buscar() }
    window.addEventListener('focus', f); window.addEventListener('trocas:atualizou', f)
    return () => { clearInterval(t); window.removeEventListener('focus', f); window.removeEventListener('trocas:atualizou', f) }
  }, [ativo, buscar])
  return ativo ? n : 0
}
