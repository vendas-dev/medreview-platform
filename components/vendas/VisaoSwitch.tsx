'use client'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

// ══ Troca de visão do topo de Vendas Gerais: duas abas GRANDES (ícone + título + o que cada uma mostra), a ativa preenchida com a cor da marca ═══════
// Largura toda, logo abaixo do título, aba ativa preenchida com a cor da marca. Só ícone e nome: baixa e direta.
export interface VisaoItem { value: string; titulo: string; icone: ReactNode }

export function VisaoSwitch({ name, value, onChange, items }: { name: string; value: string; onChange: (v: string) => void; items: VisaoItem[] }) {
  return (
    <div data-v="visao-switch" data-name={name} role="tablist" aria-label={name} className="vs">
      <style>{CSS}</style>
      {items.map(it => {
        const on = it.value === value
        return (
          <button key={it.value} type="button" role="tab" aria-selected={on} data-v="visao-tab" data-s={it.value} data-ativa={on ? 'sim' : 'nao'} onClick={() => onChange(it.value)} className={`vs-tab${on ? ' on' : ''}`}>
            {on && <motion.span layoutId={`vs-${name}`} className="vs-bg" transition={{ type: 'spring', stiffness: 380, damping: 34 }} aria-hidden />}
            <span className="vs-ico" aria-hidden>{it.icone}</span>
            <span className="vs-tit">{it.titulo}</span>
            {on && <span className="vs-end" aria-hidden><Check size={14} strokeWidth={3.2} /></span>}
          </button>
        )
      })}
    </div>
  )
}

const CSS = `
.vs{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:5px;border-radius:18px;background:color-mix(in srgb,var(--primary) 7%,var(--secondary));border:1.5px solid color-mix(in srgb,var(--primary) 24%,var(--border))}
.vs-tab{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;min-width:0;height:48px;padding:0 16px;border:0;border-radius:14px;background:transparent;cursor:pointer;font-family:inherit;color:var(--muted-foreground);transition:background .2s,color .2s,transform .2s}
.vs-tab:hover:not(.on){background:color-mix(in srgb,var(--card) 80%,transparent);color:var(--foreground)}
.vs-tab:active{transform:scale(.99)}
.vs-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 55%,transparent);outline-offset:2px}
.vs-bg{position:absolute;inset:0;border-radius:14px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 62%,#7c3aed));box-shadow:0 8px 18px -10px color-mix(in srgb,var(--primary) 85%,transparent)}
.vs-ico,.vs-tit,.vs-end{position:relative}
.vs-ico{flex:none;display:grid;place-items:center;color:var(--primary);transition:color .2s}
.vs-tab.on .vs-ico{color:#fff}
.vs-tit{font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1;white-space:nowrap}
.vs-tab.on .vs-tit{color:#fff}
.vs-end{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:99px;background:rgba(255,255,255,.24);color:#fff}
@media(prefers-reduced-motion:reduce){.vs-tab{transition:none}}
`
