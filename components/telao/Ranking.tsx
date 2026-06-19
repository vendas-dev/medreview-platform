'use client'
import { motion } from 'framer-motion'
import { CloserStats, GOLD } from '@/lib/telao/types'
import { fmtBRL, initials } from '@/lib/telao/format'

const MEDALS = ['🥇', '🥈', '🥉']
const HALOS  = ['#FFD700', '#C0C0C0', '#CD7F32']

function CloserAvatar({ stats, rank, size = 44 }: { stats: CloserStats; rank: number; size?: number }) {
  const color = stats.closer?.color ?? GOLD
  const halo  = HALOS[rank] ?? 'transparent'
  const glow  = rank < 3 ? `0 0 ${size/1.5}px ${halo}66, 0 0 ${size}px ${halo}33` : 'none'

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 900, color: '#0a0a0f', fontFamily: "'Space Grotesk', sans-serif", boxShadow: glow, border: rank < 3 ? `2px solid ${halo}` : 'none' }}>
        {initials(stats.name)}
      </div>
      {rank < 3 && (
        <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 14 }}>{MEDALS[rank]}</span>
      )}
    </div>
  )
}

interface Props {
  stats:   CloserStats[]
  accent?: string
}

export function Ranking({ stats, accent = GOLD }: Props) {
  const max = stats[0]?.revenue ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stats.slice(0, 10).map((s, i) => {
        const pct    = max > 0 ? (s.revenue / max) * 100 : 0
        const isTop3 = i < 3

        return (
          <motion.div key={s.closer?.id ?? s.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 220, damping: 18 }}
            style={{ background: isTop3 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isTop3 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 12, padding: '10px 14px', position: 'relative', overflow: 'hidden' }}>

            {/* Barra de progresso de fundo */}
            <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: isTop3 ? `${HALOS[i]}0a` : 'rgba(255,255,255,0.02)', transition: 'width 0.6s ease', borderRadius: 12 }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Posição */}
              <span style={{ fontSize: isTop3 ? 22 : 16, fontWeight: 900, color: isTop3 ? HALOS[i] : '#444', width: 28, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                {isTop3 ? MEDALS[i] : `#${i+1}`}
              </span>

              <CloserAvatar stats={s} rank={i} size={isTop3 ? 42 : 34} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: isTop3 ? 15 : 13, fontWeight: 800, color: isTop3 ? '#fff' : '#aaa', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {s.name}
                </p>
                <p style={{ fontSize: 11, color: '#555', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                  {s.sales} {s.sales === 1 ? 'venda' : 'vendas'}{s.certs > 0 ? ` · ${s.certs} cert.` : ''}
                </p>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: isTop3 ? 18 : 14, fontWeight: 900, color: isTop3 ? accent : '#777', margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {fmtBRL(s.revenue)}
                </p>
              </div>
            </div>
          </motion.div>
        )
      })}

      {stats.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#333' }}>
          <p style={{ fontSize: 24 }}>🏆</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Sem dados ainda</p>
        </div>
      )}
    </div>
  )
}
