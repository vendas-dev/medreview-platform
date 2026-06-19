'use client'

// ── Mascotes SVG inline por vertical ─────────────────────────
export function MascotR1({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corpo médico R1 - estilo cartoon */}
      <circle cx="40" cy="28" r="20" fill="#7c3aed" opacity="0.9"/>
      <circle cx="40" cy="28" r="16" fill="#a855f7"/>
      {/* Rosto */}
      <circle cx="34" cy="26" r="3" fill="#1a0533"/>
      <circle cx="46" cy="26" r="3" fill="#1a0533"/>
      <circle cx="35" cy="25" r="1.2" fill="white"/>
      <circle cx="47" cy="25" r="1.2" fill="white"/>
      <path d="M35 33 Q40 37 45 33" stroke="#1a0533" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Chapéu de médico */}
      <rect x="26" y="10" width="28" height="6" rx="3" fill="#2e1065"/>
      <rect x="34" y="6" width="12" height="6" rx="2" fill="#4c1d95"/>
      {/* Cruz médica */}
      <rect x="37" y="8" width="6" height="2" rx="1" fill="#c4b5fd"/>
      <rect x="39.5" y="6.5" width="2" height="5" rx="1" fill="#c4b5fd"/>
      {/* Corpo */}
      <rect x="28" y="46" width="24" height="22" rx="8" fill="#7c3aed"/>
      <rect x="33" y="48" width="14" height="10" rx="4" fill="#a855f7" opacity="0.6"/>
      {/* Braços */}
      <rect x="16" y="48" width="12" height="7" rx="5" fill="#7c3aed"/>
      <rect x="52" y="48" width="12" height="7" rx="5" fill="#7c3aed"/>
      {/* Pernas */}
      <rect x="30" y="66" width="8" height="10" rx="4" fill="#4c1d95"/>
      <rect x="42" y="66" width="8" height="10" rx="4" fill="#4c1d95"/>
    </svg>
  )
}

export function MascotAnest({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="28" r="20" fill="#1e40af" opacity="0.9"/>
      <circle cx="40" cy="28" r="16" fill="#3b82f6"/>
      <circle cx="34" cy="26" r="3" fill="#0f172a"/>
      <circle cx="46" cy="26" r="3" fill="#0f172a"/>
      <circle cx="35" cy="25" r="1.2" fill="white"/>
      <circle cx="47" cy="25" r="1.2" fill="white"/>
      <path d="M35 33 Q40 36 45 33" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Máscara de anestesia */}
      <ellipse cx="40" cy="35" rx="10" ry="7" fill="#1d4ed8" opacity="0.8"/>
      <rect x="38" y="40" width="4" height="8" rx="2" fill="#60a5fa"/>
      <rect x="26" y="10" width="28" height="6" rx="3" fill="#1e3a8a"/>
      <rect x="34" y="6" width="12" height="6" rx="2" fill="#1d4ed8"/>
      <rect x="28" y="46" width="24" height="22" rx="8" fill="#2563eb"/>
      <rect x="33" y="48" width="14" height="10" rx="4" fill="#3b82f6" opacity="0.6"/>
      <rect x="16" y="48" width="12" height="7" rx="5" fill="#2563eb"/>
      <rect x="52" y="48" width="12" height="7" rx="5" fill="#2563eb"/>
      <rect x="30" y="66" width="8" height="10" rx="4" fill="#1d4ed8"/>
      <rect x="42" y="66" width="8" height="10" rx="4" fill="#1d4ed8"/>
    </svg>
  )
}

export function MascotOft({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="28" r="20" fill="#854d0e" opacity="0.9"/>
      <circle cx="40" cy="28" r="16" fill="#eab308"/>
      <circle cx="34" cy="26" r="3" fill="#1a0a00"/>
      <circle cx="46" cy="26" r="3" fill="#1a0a00"/>
      <circle cx="35" cy="25" r="1.2" fill="white"/>
      <circle cx="47" cy="25" r="1.2" fill="white"/>
      <path d="M35 33 Q40 37 45 33" stroke="#1a0a00" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Óculos de oftalmologista */}
      <circle cx="34" cy="27" r="7" fill="none" stroke="#1a0a00" strokeWidth="2.5"/>
      <circle cx="46" cy="27" r="7" fill="none" stroke="#1a0a00" strokeWidth="2.5"/>
      <line x1="41" y1="27" x2="39" y2="27" stroke="#1a0a00" strokeWidth="2.5"/>
      <rect x="26" y="10" width="28" height="6" rx="3" fill="#713f12"/>
      <rect x="34" y="6" width="12" height="6" rx="2" fill="#854d0e"/>
      <rect x="28" y="46" width="24" height="22" rx="8" fill="#ca8a04"/>
      <rect x="33" y="48" width="14" height="10" rx="4" fill="#eab308" opacity="0.6"/>
      <rect x="16" y="48" width="12" height="7" rx="5" fill="#ca8a04"/>
      <rect x="52" y="48" width="12" height="7" rx="5" fill="#ca8a04"/>
      <rect x="30" y="66" width="8" height="10" rx="4" fill="#713f12"/>
      <rect x="42" y="66" width="8" height="10" rx="4" fill="#713f12"/>
    </svg>
  )
}

export function MascotOrtop({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="28" r="20" fill="#9a3412" opacity="0.9"/>
      <circle cx="40" cy="28" r="16" fill="#f97316"/>
      <circle cx="34" cy="26" r="3" fill="#1a0800"/>
      <circle cx="46" cy="26" r="3" fill="#1a0800"/>
      <circle cx="35" cy="25" r="1.2" fill="white"/>
      <circle cx="47" cy="25" r="1.2" fill="white"/>
      <path d="M34 33 Q40 38 46 33" stroke="#1a0800" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Osso / bengala */}
      <rect x="26" y="10" width="28" height="6" rx="3" fill="#7c2d12"/>
      <rect x="34" y="6" width="12" height="6" rx="2" fill="#9a3412"/>
      <rect x="28" y="46" width="24" height="22" rx="8" fill="#ea580c"/>
      <rect x="33" y="48" width="14" height="10" rx="4" fill="#f97316" opacity="0.6"/>
      <rect x="16" y="48" width="12" height="7" rx="5" fill="#ea580c"/>
      <rect x="52" y="48" width="12" height="7" rx="5" fill="#ea580c"/>
      {/* Perna com gesso */}
      <rect x="30" y="66" width="8" height="10" rx="4" fill="#7c2d12"/>
      <rect x="42" y="66" width="10" height="11" rx="4" fill="#fed7aa"/>
      {/* Cruz no gesso */}
      <line x1="47" y1="68" x2="47" y2="76" stroke="#f97316" strokeWidth="1.5"/>
      <line x1="44" y1="72" x2="50" y2="72" stroke="#f97316" strokeWidth="1.5"/>
    </svg>
  )
}

// ── Sistema de sons via Web Audio API ────────────────────────
let audioCtx: AudioContext | null = null
let audioReady = false

export function initAudio() {
  if (audioCtx) { audioReady = true; return }
  try {
    audioCtx    = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioReady  = true
  } catch {}
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
  if (!audioCtx || !audioReady) return
  try {
    const osc = audioCtx.createOscillator()
    const g   = audioCtx.createGain()
    osc.connect(g); g.connect(audioCtx.destination)
    osc.type      = type
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
    g.gain.setValueAtTime(gain, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
    osc.start(); osc.stop(audioCtx.currentTime + duration)
  } catch {}
}

export function playSaleSound() {
  // Cha-ching: sequência ascendente
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.18, 'triangle', 0.35), i * 80)
  })
}

export function playCertSound() {
  // Fanfarra: sequência especial
  [523, 523, 784, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.22, 'triangle', 0.3), i * 90)
  })
}

export function playGoalSound() {
  // Celebração grande
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, 'sine', 0.4), i * 70)
  })
}

export { audioReady }
