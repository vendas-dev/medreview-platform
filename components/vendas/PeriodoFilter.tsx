'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react'
import { periodoPresets, periodoCustom, periodoRotulo, type Periodo } from '@/lib/vendas/periodo'

/** Filtro de período (mesmo visual dos outros dropdowns): Hoje, Ontem, Esta semana, Este mês…, Todo o período (opcional) e intervalo personalizado.
 *  value = null → "Todo o período". padrao = o valor ao qual o botão de limpar volta. */
export function PeriodoFilter({ value, onChange, allowAll = false, padrao }: { value: Periodo | null; onChange: (p: Periodo | null) => void; allowAll?: boolean; padrao: Periodo | null }) {
  const [open, setOpen] = useState(false); const [custom, setCustom] = useState(false); const [a, setA] = useState(''); const [b, setB] = useState(''); const [rect, setRect] = useState<DOMRect | null>(null)
  const btn = useRef<HTMLButtonElement>(null); const pop = useRef<HTMLDivElement>(null)
  const alterado = (value?.key ?? 'tudo') !== (padrao?.key ?? 'tudo') || (value?.key === 'custom')
  useEffect(() => {
    if (!open) return
    const medir = () => btn.current && setRect(btn.current.getBoundingClientRect())
    const clique = (e: MouseEvent) => { const t = e.target as Node; if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    window.addEventListener('resize', medir); window.addEventListener('scroll', medir, true); document.addEventListener('mousedown', clique); document.addEventListener('keydown', tecla)
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); document.removeEventListener('mousedown', clique); document.removeEventListener('keydown', tecla) }
  }, [open])
  const presets = periodoPresets(); const escolher = (p: Periodo | null) => { onChange(p); setOpen(false); setCustom(false) }
  const abrir = () => { if (btn.current) { setRect(btn.current.getBoundingClientRect()); setOpen(true) } }
  const opt = (key: string, text: string, ativo: boolean, sub: string | undefined, onPick: () => void) => (
    <div key={key} role="option" aria-selected={ativo} data-v="periodo-opt" data-key={key} className="vd-opt" onClick={onPick} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, padding: '6px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: ativo ? 700 : 500, color: 'var(--foreground)' }}>
      <span style={{ flex: 1 }}>{text}{sub && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>{sub}</span>}</span>{ativo && <Check size={16} style={{ color: 'var(--primary)' }} />}
    </div>)
  const dm = (p: Periodo) => (p.start === p.end ? `${p.start.slice(8, 10)}/${p.start.slice(5, 7)}` : `${p.start.slice(8, 10)}/${p.start.slice(5, 7)} – ${p.end.slice(8, 10)}/${p.end.slice(5, 7)}`)
  return (
    <div data-v="periodo" style={{ position: 'relative', minWidth: 250 }}>
      <button ref={btn} type="button" className="vd-trigger" data-v="periodo-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => (open ? setOpen(false) : abrir())}
        style={{ width: '100%', height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 0 14px', borderRadius: 14, border: `1.5px solid ${alterado ? 'color-mix(in srgb,var(--primary) 55%,var(--border))' : 'var(--border)'}`, background: alterado ? 'color-mix(in srgb,var(--primary) 5%,var(--card))' : 'var(--card)', color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <CalendarDays size={18} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Período</span>
          <span data-v="periodo-label" style={{ display: 'block', marginTop: 1, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value ? periodoRotulo(value) : 'Todo o período'}</span>
        </span>
        {alterado ? <span role="button" tabIndex={0} data-v="periodo-limpar" aria-label="Limpar período" onClick={e => { e.stopPropagation(); onChange(padrao) }} className="vd-icon" style={{ width: 24, height: 24, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={14} /></span> : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />}
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div ref={pop} data-v="periodo-menu" role="listbox" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.15 }}
              style={{ position: 'fixed', zIndex: 140, top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 310), width: 300, maxHeight: Math.max(280, window.innerHeight - rect.bottom - 24), overflowY: 'auto', padding: 6, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px -12px rgba(20,16,50,.35)' }} className="vd-scroll">
              {allowAll && opt('tudo', 'Todo o período', value === null, undefined, () => escolher(null))}
              {presets.map(p => opt(p.key, p.label, !!value && value.key === p.key, dm(p), () => escolher(p)))}
              {opt('custom', 'Intervalo personalizado', !!value && value.key === 'custom', undefined, () => setCustom(c => !c))}
              <AnimatePresence>{custom && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '12px 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--border)', marginTop: 6 }}>
                    {[['De', a, setA, 'periodo-de'], ['Até', b, setB, 'periodo-ate']].map(([l, v, set, dv]: any) => (
                      <label key={dv} style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{l}
                        <input data-v={dv} type="date" value={v} onChange={e => set(e.target.value)} className="vd-field" style={{ display: 'block', width: '100%', marginTop: 5, height: 42, padding: '0 10px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'inherit', fontSize: 13.5 }} /></label>))}
                    <button type="button" data-v="periodo-aplicar" disabled={!a || !b} className="vd-btn" onClick={() => escolher(periodoCustom(a, b))} style={{ gridColumn: '1 / -1', height: 42, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#8b5cf6))', color: '#fff', fontSize: 14, fontWeight: 700, cursor: !a || !b ? 'not-allowed' : 'pointer', opacity: !a || !b ? 0.5 : 1, fontFamily: 'inherit' }}>Aplicar período</button>
                  </div>
                </motion.div>)}</AnimatePresence>
            </motion.div>)}
        </AnimatePresence>, document.body)}
    </div>
  )
}
