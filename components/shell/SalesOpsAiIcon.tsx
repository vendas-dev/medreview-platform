'use client'
// Ícone do Sales Ops AI.
//  • Padrão: um fluxo (3 nós ligados — processos/roleta/CRM) com uma faísca de IA no canto (SVG, cor = currentColor, mesmo "contrato" dos ícones do lucide).
//  • Opcional: com a variável  NEXT_PUBLIC_SALES_OPS_AI_ICON=/sales-ops-ai.png  (e o PNG de fundo transparente em  public/sales-ops-ai.png)  a imagem é usada no lugar — no menu,
//    no cabeçalho e no chat. SEM a variável nada é carregado (nem 404 no console): o ícone desenhado é sempre usado.
import * as React from 'react'
import { useEffect, useState } from 'react'

export const SALES_OPS_AI_IMAGE = process.env.NEXT_PUBLIC_SALES_OPS_AI_ICON || ''

let probe: Promise<boolean> | null = null
// Testa UMA vez se a imagem existe (senão cada ícone da tela pediria o arquivo e geraria 404 repetido no console).
function probeImage(): Promise<boolean> {
  if (!probe) probe = typeof Image === 'undefined' || !SALES_OPS_AI_IMAGE ? Promise.resolve(false) : new Promise<boolean>(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = SALES_OPS_AI_IMAGE })
  return probe
}
/** true quando a imagem própria existe (aí os "blocos" coloridos atrás do ícone saem, pra imagem aparecer limpa). */
export function useSalesOpsAiImage(): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => { let alive = true; probeImage().then(v => { if (alive) setOk(v) }); return () => { alive = false } }, [])
  return ok
}

export function SalesOpsAiIcon({ size = 24, strokeWidth = 2, color = 'currentColor', style, className }: { size?: number | string; strokeWidth?: number; color?: string; style?: React.CSSProperties; className?: string }) {
  const hasImage = useSalesOpsAiImage()
  if (hasImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={SALES_OPS_AI_IMAGE} alt="" width={size} height={size} draggable={false} data-icon="sales-ops-ai" data-icon-kind="img" className={className} style={{ objectFit: 'contain', display: 'block', flexShrink: 0, ...style }} />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true" data-icon="sales-ops-ai" data-icon-kind="svg">
      {/* fluxo: nó de origem → nó do meio → nó de destino */}
      <circle cx="5" cy="6.5" r="2.4" />
      <circle cx="5" cy="17.5" r="2.4" />
      <rect x="9.6" y="13.9" width="4.8" height="4.8" rx="1.4" />
      <path d="M5 8.9v6.2" />
      <path d="M7.4 17.5h2.2" />
      <path d="M14.4 16.3h1.7a2.4 2.4 0 0 0 2.4-2.4V12" />
      {/* faísca de IA */}
      <path d="M17.6 2.6l1 2.55 2.55 1-2.55 1-1 2.55-1-2.55-2.55-1 2.55-1z" />
    </svg>
  )
}
