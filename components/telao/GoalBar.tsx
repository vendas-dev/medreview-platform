'use client'
import { motion } from 'framer-motion'
import { Goal, GOLD } from '@/lib/telao/types'
import { fmtBRL } from '@/lib/telao/format'

interface Props {
  period:       'day' | 'month'
  periodKey:    string
  vertical:     string | null
  current:      number
  goals:        Goal[]
  accent?:      string
  totalLabel?:  string
  totalValue?:  number
}

export function GoalBar({ period, periodKey, vertical, current, goals, accent = GOLD, totalLabel, totalValue }: Props) {
  const goal = goals.find(g =>
    g.period === period &&
    g.period_key === periodKey &&
    (vertical ? g.vertical === vertical : g.vertical === null)
  )

  const target = goal?.target_value ?? 0
  const pct    = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const done   = pct >= 100
  const label  = period === 'day' ? 'Meta do Dia' : 'Meta do Mês'

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
          {totalLabel && totalValue !== undefined && (
            <span style={{ fontSize: 10, color: '#444', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              {totalLabel}: {fmtBRL(totalValue)}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: done ? '#22c55e' : accent, fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>
            {fmtBRL(current)}
          </span>
          {target > 0 && (
            <span style={{ fontSize: 11, color: '#444', marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>
              / {fmtBRL(target)}
            </span>
          )}
        </div>
      </div>

      {/* Barra */}
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 999, background: done ? '#22c55e' : `linear-gradient(90deg, ${accent}88, ${accent})`, boxShadow: done ? `0 0 12px #22c55e66` : `0 0 10px ${accent}55`, transition: 'background 0.3s' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: done ? '#22c55e' : '#555', fontFamily: "'JetBrains Mono', monospace", fontWeight: done ? 700 : 400 }}>
          {done ? '✅ META BATIDA!' : target > 0 ? `${pct.toFixed(0)}%` : '— sem meta'}
        </span>
        {target > 0 && !done && (
          <span style={{ fontSize: 11, color: '#444', fontFamily: "'JetBrains Mono', monospace" }}>
            faltam {fmtBRL(target - current)}
          </span>
        )}
      </div>
    </div>
  )
}
