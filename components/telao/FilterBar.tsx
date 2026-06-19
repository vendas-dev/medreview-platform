'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { Closer, FilterState, GOLD } from '@/lib/telao/types'

interface Props {
  filter:    FilterState
  onChange:  (f: FilterState) => void
  closers:   Closer[]
}

export function FilterBar({ filter, onChange, closers }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterState>(filter)

  const activeCount = (filter.start ? 1 : 0) + (filter.end ? 1 : 0) + filter.closerKeys.length

  function apply() { onChange(draft); setOpen(false) }
  function clear()  { const empty = { start: null, end: null, closerKeys: [] }; setDraft(empty); onChange(empty); setOpen(false) }

  function toggleCloser(key: string) {
    setDraft(prev => ({
      ...prev,
      closerKeys: prev.closerKeys.includes(key)
        ? prev.closerKeys.filter(k => k !== key)
        : [...prev.closerKeys, key],
    }))
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setDraft(filter); setOpen(o => !o) }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 9, border: `1px solid ${activeCount > 0 ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: activeCount > 0 ? GOLD + '11' : 'rgba(255,255,255,0.03)', color: activeCount > 0 ? GOLD : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s' }}>
        <SlidersHorizontal size={14} />
        Filtros
        {activeCount > 0 && (
          <span style={{ background: GOLD, color: '#000', fontSize: 10, fontWeight: 900, borderRadius: 999, padding: '1px 6px', marginLeft: 2 }}>
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              style={{ position: 'absolute', top: 42, right: 0, zIndex: 100, width: 320, background: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd', fontFamily: "'Space Grotesk', sans-serif" }}>Filtro avançado</span>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={14} /></button>
              </div>

              {/* Datas */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Período</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['start', 'end'] as const).map(k => (
                    <input key={k} type="date" value={draft[k] ?? ''}
                      onChange={e => setDraft(p => ({ ...p, [k]: e.target.value || null }))}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#ddd', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: 'none', colorScheme: 'dark', width: '100%' }} />
                  ))}
                </div>
              </div>

              {/* Closers */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Closer</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {/* Self checkout */}
                  <label onClick={() => toggleCloser('self')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', background: draft.closerKeys.includes('self') ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.12s' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${draft.closerKeys.includes('self') ? GOLD : '#333'}`, background: draft.closerKeys.includes('self') ? GOLD : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {draft.closerKeys.includes('self') && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#555', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#aaa', fontFamily: "'Space Grotesk', sans-serif" }}>↻ Self Checkout</span>
                  </label>

                  {closers.map(c => (
                    <label key={c.id} onClick={() => toggleCloser(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', background: draft.closerKeys.includes(c.id) ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.12s' }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${draft.closerKeys.includes(c.id) ? c.color : '#333'}`, background: draft.closerKeys.includes(c.id) ? c.color : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {draft.closerKeys.includes(c.id) && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#ddd', fontFamily: "'Space Grotesk', sans-serif" }}>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={clear} style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
                  × Limpar
                </button>
                <button onClick={apply} style={{ flex: 2, height: 34, borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${GOLD}cc, ${GOLD})`, color: '#000', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Aplicar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
