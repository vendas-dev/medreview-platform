// Visual de cada evento por vertical: cores, mascote (os mesmos do Telão), gradiente do destaque e um padrão
// de fundo próprio. Sem vertical escolhida usa o visual neutro (rosa/roxo).
import type { CSSProperties } from 'react'

export type ThemeId = 'default' | 'anestreview' | 'oftreview' | 'ortopreview' | 'medreview'
export interface EventTheme {
  id: ThemeId; label: string; short: string
  a: string; b: string            // cor principal / secundária
  hero: string                    // gradiente do destaque
  heroHit: string                 // gradiente quando a meta é batida
  mascot: string | null
  pattern: string                 // url(...) de um padrão SVG translúcido
  tagline: string
}

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`
const W = 'fill="none" stroke="white" stroke-opacity="0.09" stroke-width="2"'

export const THEMES: Record<ThemeId, EventTheme> = {
  default: {
    id: 'default', label: 'Evento', short: 'EVENTO', a: '#ec4899', b: '#8b5cf6', mascot: null, tagline: 'Bora bater a meta!',
    hero: 'linear-gradient(135deg,#2e1065 0%,#5b21b6 55%,#be185d 130%)', heroHit: 'linear-gradient(135deg,#78350f,#b45309 45%,#ec4899)',
    pattern: svg('<circle cx="4" cy="4" r="2" fill="white" fill-opacity="0.10"/>', 22, 22),
  },
  ortopreview: {
    id: 'ortopreview', label: 'Ortop-Review', short: 'ORTOP', a: '#fb923c', b: '#ea580c', mascot: '/telao/mascots/ortop.png', tagline: 'Força total, osso duro de roer!',
    hero: 'linear-gradient(135deg,#3b1204 0%,#9a3412 52%,#f97316 135%)', heroHit: 'linear-gradient(135deg,#713f12,#ca8a04 50%,#fb923c)',
    // "ossinhos": cápsulas inclinadas
    pattern: svg(`<g transform="rotate(-35 40 40)"><rect x="14" y="36" width="52" height="9" rx="4.5" ${W}/><circle cx="14" cy="36" r="6" ${W}/><circle cx="14" cy="45" r="6" ${W}/><circle cx="66" cy="36" r="6" ${W}/><circle cx="66" cy="45" r="6" ${W}/></g>`, 80, 80),
  },
  anestreview: {
    id: 'anestreview', label: 'Anest-Review', short: 'ANEST', a: '#38bdf8', b: '#0284c7', mascot: '/telao/mascots/anest.png', tagline: 'Sem dor, só resultado!',
    hero: 'linear-gradient(135deg,#06182f 0%,#075985 55%,#0ea5e9 135%)', heroHit: 'linear-gradient(135deg,#064e3b,#0d9488 50%,#38bdf8)',
    // ondas (monitor / respiração)
    pattern: svg(`<path d="M0 20 Q15 0 30 20 T60 20" ${W}/><path d="M0 44 Q15 24 30 44 T60 44" ${W}/>`, 60, 60),
  },
  oftreview: {
    id: 'oftreview', label: 'Oft-Review', short: 'OFT', a: '#fbbf24', b: '#d97706', mascot: '/telao/mascots/oft.png', tagline: 'De olho na meta!',
    hero: 'linear-gradient(135deg,#2e1d05 0%,#92400e 55%,#f59e0b 135%)', heroHit: 'linear-gradient(135deg,#14532d,#65a30d 50%,#fbbf24)',
    // olhos / íris: círculos concêntricos
    pattern: svg(`<circle cx="40" cy="40" r="30" ${W}/><circle cx="40" cy="40" r="19" ${W}/><circle cx="40" cy="40" r="8" ${W}/>`, 80, 80),
  },
  medreview: {
    id: 'medreview', label: 'Med-Review R1', short: 'R1', a: '#c084fc', b: '#7c3aed', mascot: '/telao/mascots/r1.png', tagline: 'R1 no topo!',
    hero: 'linear-gradient(135deg,#1e0b4a 0%,#5b21b6 55%,#a855f7 135%)', heroHit: 'linear-gradient(135deg,#78350f,#ca8a04 50%,#c084fc)',
    // cruzes (saúde)
    pattern: svg(`<path d="M30 16v28M16 30h28" ${W} stroke-linecap="round"/>`, 60, 60),
  },
}

export const VERTICAL_THEME_LIST: EventTheme[] = (['ortopreview', 'anestreview', 'oftreview', 'medreview'] as const).map(k => THEMES[k])
export const themeOf = (v: string | null | undefined): EventTheme => THEMES[(v as ThemeId) ?? 'default'] ?? THEMES.default
export const themeVars = (t: EventTheme): CSSProperties => ({ ['--ev-a' as string]: t.a, ['--ev-b' as string]: t.b } as CSSProperties)
