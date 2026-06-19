'use client'
import { useRef, useEffect } from 'react'
import { HourBucket, GOLD } from '@/lib/telao/types'
import { fmtBRL, initials } from '@/lib/telao/format'

const MEDALS = ['🥇', '🥈', '🥉']

interface Props {
  buckets: HourBucket[]
  accent?: string
}

export function HourlyChart({ buckets, accent = GOLD }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll para o fim (hora atual)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [])

  const maxRevenue = Math.max(...buckets.map(b => b.topRevenue), 1)

  return (
    <div ref={scrollRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 8px', scrollbarWidth: 'none' }}>
      {buckets.map((bucket, i) => {
        const isEmpty  = bucket.total === 0
        const barPct   = (bucket.topRevenue / maxRevenue) * 100
        const isRecent = i === buckets.length - 1

        return (
          <div key={bucket.hourIso} style={{ flexShrink: 0, width: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>

            {/* Mini pódio */}
            <div style={{ background: isEmpty ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isRecent ? accent + '44' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '8px 6px', width: '100%', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: isEmpty ? 0.35 : 1, boxShadow: isRecent ? `0 0 12px ${accent}22` : 'none' }}>

              {!isEmpty && bucket.top3.slice(0, 1).map((s, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
                  <span style={{ fontSize: 9 }}>{MEDALS[j]}</span>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.closer?.color ?? GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#0a0a0f', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {initials(s.name)}
                  </div>
                  <p style={{ fontSize: 9, color: '#bbb', margin: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                    {s.name.split(' ')[0]}
                  </p>
                  <p style={{ fontSize: 9, color: accent, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtBRL(s.revenue)}
                  </p>
                </div>
              ))}

              {/* 2º e 3º */}
              {!isEmpty && bucket.top3.length > 1 && (
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {bucket.top3.slice(1).map((s, j) => (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.closer?.color ?? '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#0a0a0f' }}>
                        {initials(s.name)}
                      </div>
                      <span style={{ fontSize: 7 }}>{MEDALS[j+1]}</span>
                    </div>
                  ))}
                </div>
              )}

              {isEmpty && <span style={{ fontSize: 18, opacity: 0.3 }}>—</span>}
            </div>

            {/* Barra vertical */}
            <div style={{ height: 40, width: '70%', background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${barPct}%`, background: isEmpty ? 'rgba(255,255,255,0.08)' : `linear-gradient(0deg, ${accent}cc, ${accent}44)`, borderRadius: 4, transition: 'height 0.5s ease', boxShadow: isEmpty ? 'none' : `0 0 8px ${accent}44` }} />
            </div>

            {/* Label da hora */}
            <span style={{ fontSize: 10, color: isRecent ? accent : '#444', fontFamily: "'JetBrains Mono', monospace", fontWeight: isRecent ? 700 : 400 }}>
              {bucket.label}
            </span>

            {/* Contagem */}
            <span style={{ fontSize: 9, color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>
              {bucket.total > 0 ? `${bucket.total}v` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
