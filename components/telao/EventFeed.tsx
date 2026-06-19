'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { TelaoEvent, Closer, VERTICALS, GOLD } from '@/lib/telao/types'
import { fmtBRL, timeAgo, initials } from '@/lib/telao/format'

function CloserAv({ closer, name, size = 36 }: { closer: Closer | null; name: string; size?: number }) {
  const color = closer?.color ?? GOLD
  const text  = initials(name)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#0a0a0f', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif", boxShadow: `0 0 ${size/2}px ${color}44` }}>
      {text}
    </div>
  )
}

interface Props {
  events:   TelaoEvent[]
  closers:  Closer[]
  max?:     number
}

export function EventFeed({ events, closers, max = 20 }: Props) {
  const closersById = Object.fromEntries(closers.map(c => [c.id, c]))
  const shown = events.slice(0, max)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <AnimatePresence initial={false}>
        {shown.map(ev => {
          const closer  = ev.closer_id ? closersById[ev.closer_id] : null
          const name    = ev.is_self_checkout ? 'Self Checkout' : (closer?.name ?? ev.closer_name ?? '?')
          const vert    = VERTICALS[ev.vertical]
          const isSale  = ev.event_type === 'sale'

          return (
            <motion.div key={ev.id}
              initial={{ opacity: 0, x: 40, height: 0 }}
              animate={{ opacity: 1, x: 0,  height: 'auto' }}
              exit={{ opacity: 0, x: 40, height: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${vert.accent}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>

              <CloserAv closer={closer} name={name} size={34} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: vert.accent + '22', color: vert.accent }}>
                    {vert.short}
                  </span>
                  {isSale
                    ? <span style={{ fontSize: 11, color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>💰 VENDA</span>
                    : <span style={{ fontSize: 11, color: GOLD, fontFamily: "'JetBrains Mono', monospace" }}>🎓 EMBAIXADOR</span>
                  }
                </div>

                <p style={{ fontSize: 13, fontWeight: 700, color: '#eee', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isSale ? ev.lead_name : ev.ambassador_name}
                </p>
                <p style={{ fontSize: 11, color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isSale ? ev.product : `${ev.college}${ev.class ? ` · ${ev.class}` : ''}`}
                </p>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {isSale && ev.value && (
                  <p style={{ fontSize: 15, fontWeight: 900, color: vert.accent, margin: '0 0 2px', fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {fmtBRL(ev.value)}
                  </p>
                )}
                <p style={{ fontSize: 10, color: '#555', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                  {name.split(' ')[0]} · {timeAgo(ev.occurred_at)}
                </p>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {shown.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#333' }}>
          <p style={{ fontSize: 28 }}>⚡</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Aguardando eventos...</p>
        </div>
      )}
    </div>
  )
}
