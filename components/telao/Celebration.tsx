'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TelaoEvent, Closer, VERTICALS, GOLD, Goal } from '@/lib/telao/types'
import { fmtBRL, initials } from '@/lib/telao/format'

// ── Confete simples via canvas ────────────────────────────────
function ConfettiCanvas({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 3,
      d: Math.random() * 120 + 60,
      color: [color, '#fff', GOLD, '#a855f7', '#4ea3e6'][Math.floor(Math.random() * 5)],
      tilt: Math.random() * 10 - 10,
      speed: Math.random() * 2 + 1,
      drift: Math.random() * 2 - 1,
    }))

    let raf: number
    let angle = 0

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      angle += 0.01
      particles.forEach(p => {
        ctx.save()
        ctx.beginPath()
        ctx.translate(p.x + p.tilt, p.y)
        ctx.rotate(angle + p.d)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5)
        ctx.restore()
        p.y += p.speed
        p.x += p.drift
        p.tilt = Math.sin(angle + p.d) * 5
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width }
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [color])

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }} />
}

// ── CelebrationLayer — venda/certificação ────────────────────
interface CelebProps {
  event:    TelaoEvent
  closer:   Closer | null
  onDone:   () => void
  vertical: string
  accent:   string
}

function SaleCelebration({ event, closer, onDone, accent }: CelebProps) {
  const [value, setVal] = useState(0)
  const target = event.value ?? 0
  const name   = event.is_self_checkout ? 'Self Checkout' : (closer?.name ?? event.closer_name ?? '?')

  useEffect(() => {
    let start = 0
    const step = target / 60
    const id = setInterval(() => {
      start = Math.min(start + step, target)
      setVal(Math.floor(start))
      if (start >= target) clearInterval(id)
    }, 16)
    const t = setTimeout(onDone, 6000)
    return () => { clearInterval(id); clearTimeout(t) }
  }, [target, onDone])

  return (
    <>
      <ConfettiCanvas color={accent} />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at center, ${accent}22 0%, rgba(10,10,15,0.92) 70%)`, backdropFilter: 'blur(8px)' }}>

        <div style={{ textAlign: 'center', maxWidth: 600, padding: '0 32px' }}>
          {/* Avatar gigante */}
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            style={{ width: 120, height: 120, borderRadius: '50%', background: closer?.color ?? GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontWeight: 900, color: '#0a0a0f', margin: '0 auto 24px', boxShadow: `0 0 60px ${accent}88, 0 0 120px ${accent}44`, fontFamily: "'Space Grotesk', sans-serif", border: `4px solid ${accent}` }}>
            {initials(name)}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 14, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
            💰 VENDA FECHADA!
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            style={{ fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
            {name}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ fontSize: 15, color: '#aaa', marginBottom: 24, fontFamily: "'Space Grotesk', sans-serif" }}>
            {event.lead_name} · {event.product}
          </motion.p>

          <motion.p
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.4 }}
            style={{ fontSize: 72, fontWeight: 900, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif", textShadow: `0 0 40px ${accent}` }}>
            {fmtBRL(value)}
          </motion.p>
        </div>
      </motion.div>
    </>
  )
}

function CertCelebration({ event, closer, onDone, accent }: CelebProps) {
  const name = event.is_self_checkout ? '—' : (closer?.name ?? event.closer_name ?? '?')

  useEffect(() => {
    const t = setTimeout(onDone, 6000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <>
      <ConfettiCanvas color={GOLD} />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -60 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at center, ${GOLD}22 0%, rgba(10,10,15,0.92) 70%)`, backdropFilter: 'blur(8px)' }}>

        <div style={{ textAlign: 'center', maxWidth: 640, padding: '0 32px' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}
            style={{ fontSize: 80, marginBottom: 16 }}>🎓</motion.div>

          <p style={{ fontSize: 13, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            NOVO EMBAIXADOR CERTIFICADO!
          </p>

          <p style={{ fontSize: 44, fontWeight: 900, color: '#fff', marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
            {event.ambassador_name}
          </p>

          <p style={{ fontSize: 18, color: GOLD, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
            {event.college}
          </p>

          {event.class && (
            <p style={{ fontSize: 14, color: '#888', marginBottom: 20, fontFamily: "'JetBrains Mono', monospace" }}>
              Turma {event.class}
            </p>
          )}

          {name !== '—' && (
            <p style={{ fontSize: 13, color: '#555', fontFamily: "'Space Grotesk', sans-serif" }}>
              Closer: <strong style={{ color: '#aaa' }}>{name}</strong>
            </p>
          )}
        </div>
      </motion.div>
    </>
  )
}

// ── GoalCelebrationLayer ──────────────────────────────────────
export function GoalCelebrationLayer({ goals, revenue, vertical }: {
  goals: Goal[]
  revenue: number
  vertical: string | null
}) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    for (const g of goals) {
      if (revenue < g.target_value) continue
      const key = `goal-cel-${g.id}`
      if (localStorage.getItem(key)) continue
      localStorage.setItem(key, '1')
      setShown(true)
      setTimeout(() => setShown(false), 5000)
      break
    }
  }, [goals, revenue])

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)' }}>
          <ConfettiCanvas color={GOLD} />
          <div style={{ textAlign: 'center' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.6 }}
              style={{ fontSize: 100 }}>🎯</motion.div>
            <p style={{ fontSize: 56, fontWeight: 900, color: GOLD, fontFamily: "'Space Grotesk', sans-serif", textShadow: `0 0 60px ${GOLD}` }}>
              META BATIDA!
            </p>
            <p style={{ fontSize: 20, color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
              {fmtBRL(revenue)} realizados
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── CelebrationLayer principal ────────────────────────────────
interface LayerProps {
  latest:       TelaoEvent | null
  closers:      Closer[]
  onClear:      () => void
  verticalFilter: string | null
}

export function CelebrationLayer({ latest, closers, onClear, verticalFilter }: LayerProps) {
  const closersById = Object.fromEntries(closers.map(c => [c.id, c]))

  if (!latest) return null
  if (verticalFilter && latest.vertical !== verticalFilter) return null

  const closer = latest.closer_id ? closersById[latest.closer_id] ?? null : null
  const vert   = VERTICALS[latest.vertical]

  const props: CelebProps = {
    event:    latest,
    closer,
    onDone:   onClear,
    vertical: latest.vertical,
    accent:   vert.accent,
  }

  return (
    <AnimatePresence mode="wait">
      {latest.event_type === 'sale'
        ? <SaleCelebration key={latest.id} {...props} />
        : <CertCelebration key={latest.id} {...props} />
      }
    </AnimatePresence>
  )
}
