'use client'
import { useRef, useEffect } from 'react'
import { TelaoEvent, VERTICALS, GOLD } from '@/lib/telao/types'
import { fmtBRL } from '@/lib/telao/format'

interface Props {
  events: TelaoEvent[]
}

export function Ticker({ events }: Props) {
  const sales = events.filter(e => e.event_type === 'sale' && e.value).slice(0, 30)

  if (sales.length === 0) return null

  const items = [...sales, ...sales] // duplicar para loop contínuo

  return (
    <div style={{ background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', height: 32, display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, animation: 'ticker 40s linear infinite', whiteSpace: 'nowrap' }}>
        {items.map((ev, i) => {
          const vert = VERTICALS[ev.vertical]
          return (
            <span key={`${ev.id}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.06)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              <span style={{ color: vert.accent, fontWeight: 700 }}>{vert.short}</span>
              <span style={{ color: '#888' }}>{ev.lead_name}</span>
              <span style={{ color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtBRL(ev.value!)}</span>
              <span style={{ color: '#444' }}>·</span>
              <span style={{ color: '#555' }}>{ev.closer_name?.split(' ')[0] ?? 'SC'}</span>
            </span>
          )
        })}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  )
}
