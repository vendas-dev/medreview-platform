'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { GOLD, brl, brlCompact } from './shared'

// Pódio de verdade: 1º no centro (mais alto), 2º à esquerda, 3º à direita. Os demais ficam numa lista abaixo (feita por quem chama).
export interface PodItem { name: string; value: number; count: number }
const SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const
const PED = [
  { n: 1, h: 132, cor: ['#fde68a', '#f59e0b'], txt: '#78350f', brilho: 'rgba(245,158,11,.55)', label: '1º lugar' },
  { n: 2, h: 98, cor: ['#e2e8f0', '#94a3b8'], txt: '#1e293b', brilho: 'rgba(148,163,184,.5)', label: '2º lugar' },
  { n: 3, h: 74, cor: ['#fdba74', '#c2410c'], txt: '#431407', brilho: 'rgba(234,88,12,.45)', label: '3º lugar' },
]
export function Podium({ items, total, compact }: { items: PodItem[]; total: number; compact?: boolean }) {
  const reduce = useReducedMotion()
  const top = items.slice(0, 3)
  if (top.length === 0) return null
  const ordem = top.length === 1 ? [0] : top.length === 2 ? [1, 0] : [1, 0, 2]          // 2º · 1º · 3º
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0)
  return (
    <div className={`pd${compact ? ' pd-sm' : ''}`} data-testid="podium" role="list" aria-label="Pódio dos produtos mais vendidos">
      <style>{PD_CSS}</style>
      {ordem.map((idx, col) => {
        const p = top[idx], ped = PED[idx], first = idx === 0, sh = share(p.value)
        return (
          <motion.div key={p.name} role="listitem" className={`pd-col${first ? ' pd-first' : ''}`} data-rank={idx + 1} whileHover={reduce ? undefined : { y: -6 }} transition={SPRING}>
            <motion.div className="pd-card" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: .35 + col * .08 }}
              style={{ ['--glow' as string]: ped.brilho }}>
              {first && <motion.span className="pd-crown" initial={reduce ? false : { scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING, delay: .9 }}><Crown size={22} fill={GOLD} color={GOLD} aria-hidden /></motion.span>}
              <div className="pd-name" title={p.name}>{p.name}</div>
              <div className="pd-val">{brlCompact(p.value)}</div>
              <div className="pd-meta">{p.count} {p.count === 1 ? 'venda' : 'vendas'} · {sh >= 1 ? Math.round(sh) : sh.toFixed(1)}%</div>
            </motion.div>
            <motion.div className="pd-block" initial={reduce ? false : { height: 0 }} animate={{ height: compact ? Math.round(ped.h * 0.5) : ped.h }} transition={{ ...SPRING, delay: first ? .25 : .05 + col * .1 }}
              style={{ background: `linear-gradient(180deg,${ped.cor[0]},${ped.cor[1]})`, boxShadow: `0 -6px 26px ${ped.brilho}` }} title={`${ped.label}: ${p.name} · ${brl(p.value)}`}>
              <span style={{ color: ped.txt }}>{ped.n}</span>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}
const PD_CSS = `
.pd{display:flex;align-items:flex-end;justify-content:center;gap:clamp(6px,1.6vw,18px);padding:8px 0 0;position:relative}
.pd-col{flex:1 1 0;max-width:260px;min-width:0;display:flex;flex-direction:column;align-items:stretch;cursor:default}.pd-first{flex-basis:0;flex-grow:1.18}
.pd-card{position:relative;text-align:center;padding:12px 10px 10px;margin-bottom:8px;border-radius:16px;border:1px solid var(--border);background:color-mix(in srgb,var(--card) 88%,transparent);transition:box-shadow .25s ease,border-color .25s ease}
.pd-col:hover .pd-card{box-shadow:0 10px 30px var(--glow);border-color:color-mix(in srgb,var(--glow) 80%,var(--border))}
.pd-crown{position:absolute;left:50%;top:-18px;transform:translateX(-50%);display:flex;filter:drop-shadow(0 4px 8px rgba(245,158,11,.6))}
.pd-name{font-size:13px;font-weight:800;line-height:1.25;color:var(--foreground);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em;overflow-wrap:anywhere}
.pd-val{font-size:clamp(17px,2.2vw,24px);font-weight:900;letter-spacing:-.02em;margin-top:6px;color:var(--foreground);font-variant-numeric:tabular-nums}.pd-first .pd-val{font-size:clamp(19px,2.6vw,28px)}
.pd-meta{font-size:11px;color:var(--muted-foreground);margin-top:2px;font-weight:600}
.pd-sm .pd-card{padding:8px 8px 7px;margin-bottom:6px;border-radius:12px}.pd-sm .pd-name{font-size:12px;min-height:2.4em}.pd-sm .pd-val{font-size:clamp(15px,1.4vw,19px);margin-top:3px}.pd-sm.pd .pd-first .pd-val{font-size:clamp(17px,1.6vw,22px)}.pd-sm .pd-meta{font-size:10.5px}.pd-sm .pd-block span{font-size:24px}.pd-sm .pd-crown{top:-15px}
.pd-block{border-radius:14px 14px 4px 4px;display:flex;align-items:flex-start;justify-content:center;padding-top:10px;overflow:hidden;position:relative}
.pd-block span{font-size:clamp(30px,4vw,48px);font-weight:900;line-height:1;opacity:.85}
.pd-block::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%);transform:translateX(-120%);transition:transform .7s ease}
.pd-col:hover .pd-block::after{transform:translateX(120%)}
@media(prefers-reduced-motion:reduce){.pd-block::after{transition:none}}
`
