'use client'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { teamCor, verticalCor, verticalCurto, verticalLabel } from '@/lib/vendas/format'

// ══ Design system das telas de Vendas: tudo parte das variáveis do app (claro/escuro) ═════════════════
/** Estilos compartilhados (hover, foco, animações). Renderize uma vez por tela. */
export function VendasStyle() {
  return <style>{`
.vd{font-feature-settings:'tnum' 1,'cv11' 1;-webkit-font-smoothing:antialiased;--vd-radius:18px;--vd-ring:color-mix(in srgb,var(--primary) 20%,transparent)}
.vd *{box-sizing:border-box}
.vd-title{letter-spacing:-0.03em}
.vd-card{background:var(--card);border:1px solid var(--border);border-radius:var(--vd-radius);box-shadow:0 1px 2px rgba(20,16,50,.04),0 10px 30px -18px rgba(20,16,50,.18);transition:box-shadow .22s ease,transform .22s ease,border-color .22s ease,opacity .22s ease}
.vd-lift:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(20,16,50,.05),0 18px 40px -16px rgba(20,16,50,.28);border-color:color-mix(in srgb,var(--primary) 30%,var(--border))}
.vd-btn{transition:transform .14s ease,box-shadow .2s ease,background .18s ease,filter .18s ease,border-color .18s ease,color .18s ease}
.vd-btn:hover:not(:disabled){transform:translateY(-1px)}
.vd-btn:active:not(:disabled){transform:translateY(0) scale(.975)}
.vd-btn:focus-visible,.vd-field:focus-visible,.vd-trigger:focus-visible{outline:none;box-shadow:0 0 0 4px var(--vd-ring)}
.vd-field{transition:border-color .16s ease,box-shadow .16s ease,background .16s ease}
.vd-field:hover{border-color:color-mix(in srgb,var(--primary) 35%,var(--border))}
.vd-field:focus,.vd-field:focus-within{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px var(--vd-ring)}
.vd-trigger{transition:border-color .16s ease,box-shadow .16s ease,transform .14s ease,background .16s ease}
.vd-trigger:hover{border-color:color-mix(in srgb,var(--primary) 40%,var(--border));transform:translateY(-1px)}
.vd-opt{transition:background .12s ease}.vd-opt:hover,.vd-opt[data-active="true"]{background:var(--secondary)}
.vd-icon:hover{background:var(--secondary);color:var(--foreground)}
.vd-row td{transition:background .15s ease}.vd-row:hover td{background:color-mix(in srgb,var(--primary) 5%,transparent)}
.vd-chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.vd-scroll{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.vd-scroll::-webkit-scrollbar{height:9px;width:9px}.vd-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}.vd-scroll::-webkit-scrollbar-thumb:hover{background:var(--muted-foreground)}
.vd-spin{animation:vd-spin 1s linear infinite}@keyframes vd-spin{to{transform:rotate(360deg)}}
.vd-shimmer{background:linear-gradient(90deg,var(--secondary) 25%,color-mix(in srgb,var(--secondary) 55%,var(--card)) 50%,var(--secondary) 75%);background-size:200% 100%;animation:vd-shim 1.4s ease-in-out infinite}@keyframes vd-shim{to{background-position:-200% 0}}
.vd-up{animation:vd-up .38s cubic-bezier(.2,.7,.2,1) backwards}@keyframes vd-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.vd-dim{opacity:.68}.vd-dim:hover{opacity:1}
.vd-pop{transition:transform .2s ease}.vd-pop:hover{transform:scale(1.03)}
@media (prefers-reduced-motion:reduce){.vd *,.vd-up,.vd-spin{animation:none!important;transition:none!important}}
`}</style>
}

// ── Avatar: foto do closer; sem foto (ou foto quebrada) vira as iniciais num degradê estável por nome ──
const GRAD = [['#8b5cf6', '#6366f1'], ['#0ea5e9', '#2563eb'], ['#14b8a6', '#0ea5e9'], ['#f59e0b', '#f97316'], ['#ec4899', '#8b5cf6'], ['#22c55e', '#14b8a6'], ['#f43f5e', '#f97316'], ['#6366f1', '#0ea5e9']]
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
export const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
export function Avatar({ name, src, size = 40, ring }: { name: string; src?: string | null; size?: number; ring?: string }) {
  const [falhou, setFalhou] = useState(false); useEffect(() => setFalhou(false), [src])
  const [a, b] = GRAD[hash(name || '?') % GRAD.length]; const foto = !!src && !falhou
  return (
    <span data-v="avatar" data-foto={foto ? 'sim' : 'nao'} title={name} style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: foto ? 'var(--secondary)' : `linear-gradient(135deg,${a},${b})`, color: '#fff', fontSize: size * 0.36, fontWeight: 800, letterSpacing: '-0.02em', boxShadow: ring ? `0 0 0 2px var(--card), 0 0 0 4px ${ring}` : '0 0 0 1px var(--border)' }}>
      {foto ? <img src={src!} alt={name} onError={() => setFalhou(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciais(name)}
    </span>
  )
}

// ── Etiquetas ──
export function Chip({ cor, children, icon, solid, style }: { cor: string; children: ReactNode; icon?: ReactNode; solid?: boolean; style?: CSSProperties }) {
  return <span className="vd-chip" style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: solid ? '#fff' : cor, background: solid ? cor : `color-mix(in srgb, ${cor} 14%, transparent)`, ...style }}>{icon}{children}</span>
}
export const VerticalChip = ({ v, curto }: { v: string; curto?: boolean }) => <Chip cor={verticalCor(v)} icon={<i style={{ width: 7, height: 7, borderRadius: 99, background: verticalCor(v) }} />}>{curto ? verticalCurto(v) : verticalLabel(v)}</Chip>
export const TeamBadge = ({ team }: { team: string | null }) => team ? <span data-v="team-badge" style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: teamCor(team), background: `color-mix(in srgb, ${teamCor(team)} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${teamCor(team)} 28%, transparent)` }}>{team}</span> : null

// ── Botões ──
type BtnVar = 'primary' | 'ghost' | 'soft' | 'success' | 'danger'
const BTN: Record<BtnVar, CSSProperties> = {
  primary: { background: 'linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#8b5cf6))', color: '#fff', border: '1px solid transparent', boxShadow: '0 8px 20px -10px var(--primary)' },
  ghost: { background: 'var(--card)', color: 'var(--foreground)', border: '1.5px solid var(--border)' },
  soft: { background: 'color-mix(in srgb,var(--primary) 11%,transparent)', color: 'var(--primary)', border: '1px solid transparent' },
  success: { background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', border: '1px solid transparent', boxShadow: '0 8px 20px -10px #16a34a' },
  danger: { background: 'linear-gradient(135deg,#dc2626,#f43f5e)', color: '#fff', border: '1px solid transparent', boxShadow: '0 8px 20px -10px #dc2626' },
}
export function Btn({ variant = 'ghost', size = 'md', icon, loading, children, style, ...r }: { variant?: BtnVar; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const h = size === 'sm' ? 34 : size === 'lg' ? 48 : 42
  return <button className="vd-btn" {...r} disabled={r.disabled || loading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: h, padding: size === 'sm' ? '0 13px' : '0 20px', borderRadius: size === 'sm' ? 11 : 13, fontSize: size === 'sm' ? 12.5 : 14, fontWeight: 700, fontFamily: 'inherit', cursor: r.disabled || loading ? 'not-allowed' : 'pointer', opacity: r.disabled && !loading ? 0.55 : 1, whiteSpace: 'nowrap', ...BTN[variant], ...style }}>{loading ? <Loader2 size={16} className="vd-spin" /> : icon}{children}</button>
}

// ── Estrutura ──
export const card: CSSProperties = {}                          // (compat) use className="vd-card"
export function Card({ children, style, lift, ...r }: { children: ReactNode; style?: CSSProperties; lift?: boolean } & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>) {
  return <div {...r} className={`vd-card${lift ? ' vd-lift' : ''}`} style={style}>{children}</div>
}
export function PageHeader({ icon, title, subtitle, left, right }: { icon?: ReactNode; title: string; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="vd-up" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      {left ?? (icon ? <div style={{ width: 56, height: 56, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg,var(--primary),#8b5cf6)', boxShadow: '0 14px 28px -14px var(--primary)' }}>{icon}</div> : null)}
      <div style={{ flex: 1, minWidth: 240 }}>
        <h1 className="vd-title" style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: 'var(--foreground)' }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.5, color: 'var(--muted-foreground)', maxWidth: 680 }}>{subtitle}</p>}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>{right}</div>}
    </header>
  )
}
export function Kpi({ label, value, icon, cor, dataV, hint }: { label: string; value: ReactNode; icon: ReactNode; cor: string; dataV?: string; hint?: ReactNode }) {
  return (
    <div data-v={dataV} className="vd-card vd-lift vd-up" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', inset: '0 auto 0 0', width: 4, background: cor }} />
      <span style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cor, background: `color-mix(in srgb, ${cor} 13%, transparent)`, flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{label}</span>
        <span data-v="kpi-valor-texto" className="vd-title" style={{ display: 'block', marginTop: 3, fontSize: 26, lineHeight: 1.1, fontWeight: 800, color: 'var(--foreground)' }}>{value}</span>
        {hint && <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: 'var(--muted-foreground)' }}>{hint}</span>}
      </span>
    </div>
  )
}
/** Barra de filtros: um cartão com respiro entre os controles e o botão "Limpar filtros" (só quando algo foi alterado). */
export function FilterBar({ children, topo, ativo, onClear }: { children: ReactNode; topo?: ReactNode; ativo: boolean; onClear: () => void }) {
  const limpar = (
    <AnimatePresence>{ativo && <motion.div key="limpar" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }} style={{ marginLeft: 'auto' }}>
      <Btn data-v="limpar-filtros" variant="soft" size="sm" icon={<X size={14} />} onClick={onClear} style={{ height: 52 }}>Limpar filtros</Btn>
    </motion.div>}</AnimatePresence>
  )
  // com "topo": o controle principal (ex.: status) fica SOZINHO na 1ª linha e os demais filtros na linha de baixo
  if (topo) return (
    <div data-v="filtros" className="vd-card vd-up" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div data-v="filtros-topo" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>{topo}{limpar}</div>
      <div data-v="filtros-baixo" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border)' }}>{children}</div>
    </div>
  )
  return (
    <div data-v="filtros" className="vd-card vd-up" style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
      {children}
      {limpar}
    </div>
  )
}

// ── Dropdown bonito (substitui o <select> do navegador): popover em portal, teclado, busca, cor/foto por opção, botão de limpar ──
export interface Opt { value: string; label: string; cor?: string; avatar?: { name: string; src?: string | null }; sub?: string }
export function Select({ name, caption, value, onChange, options, defaultValue, icon, minWidth = 200, searchable, full, placeholder, compact }: { name: string; caption: string; placeholder?: string; compact?: boolean; value: string; onChange: (v: string) => void; options: Opt[]; defaultValue?: string; icon?: ReactNode; minWidth?: number; searchable?: boolean; full?: boolean }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [active, setActive] = useState(0); const [rect, setRect] = useState<DOMRect | null>(null)
  const btn = useRef<HTMLButtonElement>(null); const pop = useRef<HTMLDivElement>(null)
  const sel = options.find(o => o.value === value); const lista = searchable && q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options
  const alterado = defaultValue !== undefined && value !== defaultValue
  const abrir = () => { if (!btn.current) return; setRect(btn.current.getBoundingClientRect()); setQ(''); setActive(Math.max(0, options.findIndex(o => o.value === value))); setOpen(true) }
  const fechar = (foco = true) => { setOpen(false); if (foco) btn.current?.focus() }
  const escolher = (v: string) => { onChange(v); fechar() }
  useEffect(() => {
    if (!open) return
    const medir = () => btn.current && setRect(btn.current.getBoundingClientRect())
    const clique = (e: MouseEvent) => { const t = e.target as Node; if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false) }
    window.addEventListener('resize', medir); window.addEventListener('scroll', medir, true); document.addEventListener('mousedown', clique)
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); document.removeEventListener('mousedown', clique) }
  }, [open])
  function teclas(e: React.KeyboardEvent) {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir() } return }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); fechar() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(lista.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) } else if (e.key === 'End') { e.preventDefault(); setActive(lista.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (lista[active]) escolher(lista[active].value) }
  }
  const acima = rect ? rect.bottom + 330 > window.innerHeight && rect.top > 340 : false
  return (
    <div data-v="select" data-name={name} data-alterado={alterado ? 'sim' : 'nao'} style={{ position: 'relative', minWidth, flex: full ? '1 1 100%' : undefined }}>
      <button ref={btn} type="button" className="vd-trigger" data-v="select-trigger" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-label={caption} onClick={() => (open ? fechar(false) : abrir())} onKeyDown={teclas}
        style={{ width: '100%', height: compact ? 48 : 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 0 14px', borderRadius: compact ? 13 : 14, border: `1.5px solid ${alterado ? 'color-mix(in srgb,var(--primary) 55%,var(--border))' : 'var(--border)'}`, background: alterado ? 'color-mix(in srgb,var(--primary) 5%,var(--card))' : compact ? 'var(--background)' : 'var(--card)', color: compact && !sel ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        {sel?.avatar ? <Avatar name={sel.avatar.name} src={sel.avatar.src} size={26} /> : sel?.cor ? <i style={{ width: 10, height: 10, borderRadius: 99, background: sel.cor, flexShrink: 0 }} /> : icon ? <span style={{ color: 'var(--muted-foreground)', display: 'flex' }}>{icon}</span> : null}
        <span style={{ flex: 1, minWidth: 0 }}>
          {!compact && <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{caption}</span>}
          <span data-v="select-valor" style={{ display: 'block', marginTop: compact ? 0 : 1, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel?.label ?? placeholder ?? '—'}</span>
        </span>
        {alterado ? <span role="button" tabIndex={0} data-v="select-limpar" aria-label={`Limpar ${caption}`} onClick={e => { e.stopPropagation(); onChange(defaultValue!) }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onChange(defaultValue!) } }} className="vd-icon" style={{ width: 24, height: 24, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={14} /></span>
          : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />}
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div ref={pop} data-v="select-menu" data-name={name} role="listbox" initial={{ opacity: 0, y: acima ? 6 : -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.15 }}
              onKeyDown={teclas} style={{ position: 'fixed', zIndex: 140, left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 250) - 12), ...(acima ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }), width: Math.max(rect.width, 250), maxHeight: 320, display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px -12px rgba(20,16,50,.35)', overflow: 'hidden' }}>
              {searchable && <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}><label className="vd-field" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 10px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--background)' }}><Search size={15} style={{ color: 'var(--muted-foreground)' }} /><input autoFocus data-v="select-busca" value={q} onChange={e => { setQ(e.target.value); setActive(0) }} onKeyDown={teclas} placeholder="Buscar…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 13.5, fontFamily: 'inherit' }} /></label></div>}
              <div className="vd-scroll" style={{ overflowY: 'auto', padding: 6 }}>
                {lista.length === 0 && <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>Nada encontrado</div>}
                {lista.map((o, i) => (
                  <div key={o.value} role="option" aria-selected={o.value === value} data-v="select-opt" data-value={o.value} data-active={i === active} className="vd-opt" onMouseEnter={() => setActive(i)} onClick={() => escolher(o.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, padding: '6px 10px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: o.value === value ? 700 : 500, color: 'var(--foreground)' }}>
                    {o.avatar ? <Avatar name={o.avatar.name} src={o.avatar.src} size={28} /> : o.cor ? <i style={{ width: 10, height: 10, borderRadius: 99, background: o.cor, flexShrink: 0 }} /> : null}
                    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>{o.sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted-foreground)' }}>{o.sub}</span>}</span>
                    {o.value === value && <Check size={16} style={{ color: 'var(--primary)' }} />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </div>
  )
}

/** Controle segmentado com a "pílula" deslizando entre as opções. */
export function Segmented({ name, value, onChange, items }: { name: string; value: string; onChange: (v: string) => void; items: { value: string; label: string; count?: number; cor?: string }[] }) {
  return (
    <div role="group" aria-label={name} data-v="segmented" data-name={name} className="vd-scroll" style={{ display: 'inline-flex', maxWidth: '100%', overflowX: 'auto', padding: 4, gap: 2, borderRadius: 15, background: 'var(--secondary)', height: 52, alignItems: 'stretch' }}>
      {items.map(it => {
        const on = it.value === value
        return (
          <button key={it.value} type="button" data-v="seg-opt" data-name={name} data-s={it.value} aria-pressed={on} onClick={() => onChange(it.value)} className="vd-btn"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', border: 'none', borderRadius: 12, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
            {on && <motion.span layoutId={`seg-${name}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'var(--card)', boxShadow: '0 2px 8px rgba(20,16,50,.12)' }} />}
            <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7 }}>{it.cor && <i style={{ width: 8, height: 8, borderRadius: 99, background: it.cor }} />}{it.label}{it.count !== undefined && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: on ? 'color-mix(in srgb,var(--primary) 14%,transparent)' : 'color-mix(in srgb,var(--muted-foreground) 16%,transparent)', color: on ? 'var(--primary)' : 'var(--muted-foreground)' }}>{it.count}</span>}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, dataV }: { checked: boolean; onChange: (v: boolean) => void; label: string; dataV?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} data-v={dataV} onClick={() => onChange(!checked)} className="vd-trigger"
      style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 0 14px', borderRadius: 14, border: `1.5px solid ${checked ? 'color-mix(in srgb,var(--primary) 55%,var(--border))' : 'var(--border)'}`, background: checked ? 'color-mix(in srgb,var(--primary) 5%,var(--card))' : 'var(--card)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--foreground)' }}>
      <span style={{ position: 'relative', width: 38, height: 22, borderRadius: 99, background: checked ? 'var(--primary)' : 'color-mix(in srgb,var(--muted-foreground) 35%,transparent)', transition: 'background .2s', flexShrink: 0 }}>
        <motion.span initial={false} animate={{ x: checked ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} style={{ position: 'absolute', top: 2, left: 0, width: 18, height: 18, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

/** Campo de busca com lupa e botão de limpar. */
export function SearchBox({ value, onChange, placeholder, dataV = 'busca' }: { value: string; onChange: (v: string) => void; placeholder: string; dataV?: string }) {
  return (
    <label className="vd-field" style={{ flex: '1 1 260px', maxWidth: 420, height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 0 14px', border: '1.5px solid var(--border)', borderRadius: 14, background: 'var(--card)' }}>
      <Search size={17} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      <input data-v={dataV} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit' }} />
      {value && <button type="button" data-v="busca-limpar" aria-label="Limpar busca" onClick={() => onChange('')} className="vd-icon" style={{ width: 26, height: 26, borderRadius: 99, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>}
    </label>
  )
}

// ── Formulários ──
export function Field({ label, erro, hint, children, full, icon }: { label: string; erro?: string; hint?: ReactNode; children: ReactNode; full?: boolean; icon?: ReactNode }) {
  return (
    <label style={{ display: 'block', gridColumn: full ? '1 / -1' : undefined, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', marginBottom: 7 }}>{icon && <span style={{ color: 'var(--muted-foreground)', display: 'flex' }}>{icon}</span>}{label}</span>
      {children}
      {erro ? <span role="alert" style={{ display: 'block', marginTop: 6, fontSize: 12.5, fontWeight: 600, color: '#dc2626' }}>{erro}</span> : hint ? <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>{hint}</span> : null}
    </label>
  )
}
/** Campo de texto com ícone à esquerda e/ou prefixo (ex.: "R$"). */
export function TextInput({ icon, prefix, erro, mono, style, ...r }: { icon?: ReactNode; prefix?: string; erro?: boolean; mono?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="vd-field" style={{ display: 'flex', alignItems: 'center', gap: 9, height: 48, padding: '0 14px', borderRadius: 13, border: `1.5px solid ${erro ? '#dc2626' : 'var(--border)'}`, background: 'var(--background)', ...style }}>
      {icon && <span style={{ color: 'var(--muted-foreground)', display: 'flex', flexShrink: 0 }}>{icon}</span>}
      {prefix && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted-foreground)' }}>{prefix}</span>}
      <input {...r} style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 14.5, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', fontWeight: 500 }} />
    </span>
  )
}
export function TextArea({ erro, style, ...r }: { erro?: boolean } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...r} className="vd-field" style={{ width: '100%', minHeight: 104, padding: '12px 14px', borderRadius: 13, border: `1.5px solid ${erro ? '#dc2626' : 'var(--border)'}`, background: 'var(--background)', color: 'var(--foreground)', fontSize: 14.5, lineHeight: 1.55, fontFamily: 'inherit', resize: 'vertical', ...style }} />
}
export function Banner({ tipo, children }: { tipo: 'erro' | 'aviso' | 'ok'; children: ReactNode }) {
  const c = tipo === 'erro' ? '#dc2626' : tipo === 'aviso' ? '#b45309' : '#15803d'
  return <div role={tipo === 'erro' ? 'alert' : 'status'} data-v={`banner-${tipo}`} className="vd-up" style={{ padding: '12px 16px', borderRadius: 13, fontSize: 13.5, fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 9%, var(--card))`, border: `1px solid color-mix(in srgb, ${c} 28%, transparent)` }}>{children}</div>
}
export function EmptyState({ icon, title, text, dataV = 'vazio' }: { icon: ReactNode; title: string; text?: string; dataV?: string }) {
  return (
    <div data-v={dataV} className="vd-card vd-up" style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div style={{ width: 68, height: 68, borderRadius: 22, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', background: 'color-mix(in srgb,var(--primary) 11%,transparent)' }}>{icon}</div>
      <p className="vd-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>{title}</p>
      {text && <p style={{ margin: '6px auto 0', maxWidth: 420, fontSize: 14, lineHeight: 1.55, color: 'var(--muted-foreground)' }}>{text}</p>}
    </div>
  )
}
export function Skeleton({ linhas = 4 }: { linhas?: number }) {
  return <div data-v="carregando" className="vd-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>{Array.from({ length: linhas }).map((_, i) => <div key={i} className="vd-shimmer" style={{ height: 22, borderRadius: 8, width: `${92 - i * 9}%` }} />)}</div>
}
/** Legenda rápida: as cores das verticais e dos times. */
export function Legenda({ verticais = ['medreview', 'anestreview', 'oftreview', 'ortopreview'], times = true }: { verticais?: string[]; times?: boolean }) {
  return (
    <div data-v="legenda" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted-foreground)' }}>
      <span style={{ fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', fontSize: 11 }}>Legenda</span>
      {verticais.map(v => <VerticalChip key={v} v={v} />)}
      {times && <><span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />{['R1', 'OAO'].map(t => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><TeamBadge team={t} /><span>{t === 'R1' ? 'só Med-Review R1' : 'Anest · Oft · Ortop'}</span></span>)}</>}
    </div>
  )
}
