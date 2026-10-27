'use client'
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ══ "Ajustar à tela" — o telão sem rolagem ═════════════════════════════════════════
// Objetivo: tudo (placar, verticais, ritmo, canais E o gráfico do mês) visível de uma vez, em qualquer tela.
//
//  1) useFitRoot  → mede a altura que o telão pode ocupar (a área visível do <main> do app, que é quem rola)
//                   e devolve a altura em px pra ele ocupar EXATAMENTE isso (nada de rolagem da página).
//  2) FitColumn   → na coluna da esquerda: os blocos de cima ficam no tamanho natural e o GRÁFICO absorve o espaço que sobrar
//                   (em TV Full HD ele cresce). Se nem com o gráfico no mínimo couber, a coluna é REDUZIDA proporcionalmente
//                   (transform: scale) até caber. Abaixo do piso de redução volta a ter rolagem, em vez de ficar ilegível.
//
// Só vale em telas largas (≥ 961 px, onde o telão tem 2 colunas). No celular o telão continua rolando como antes.

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect
export const FIT_MIN_WIDTH = 961      // o mesmo ponto em que o grid do LiveWall vira 1 coluna (@media max-width:960px)
const FIT_MIN_HEIGHT = 360            // abaixo disso não adianta tentar caber

export function useFitRoot(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [st, setSt] = useState<{ active: boolean; height: number }>({ active: false, height: 0 })
  useIso(() => {
    const el = ref.current
    if (!enabled || !el) { setSt(s => (s.active ? { active: false, height: 0 } : s)); return }
    const parent = el.parentElement
    const calc = () => {
      let h = 0
      // dentro do app o pai é o <main> com rolagem: a altura certa é a área visível dele (NÃO 100vh: tem menu/topbar)
      if (parent) { const cs = getComputedStyle(parent); if (/(auto|scroll|hidden)/.test(cs.overflowY) && parent.clientHeight > 0) h = parent.clientHeight }
      if (!h) h = window.innerHeight - (el.getBoundingClientRect().top + window.scrollY)       // sem <main> com rolagem: até o fim da janela
      h = Math.floor(h)
      const active = window.innerWidth >= FIT_MIN_WIDTH && h >= FIT_MIN_HEIGHT
      setSt(s => (s.active === active && s.height === h ? s : { active, height: h }))
    }
    calc()
    const ro = new ResizeObserver(calc)
    if (parent) ro.observe(parent)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [enabled])
  return { ref, active: enabled && st.active, height: st.height }
}

// ── Modo compacto dos blocos de CIMA (só no "ajustar à tela") ─────────────────────────────────────────────────────────────────────────
// Deixa placar, verticais, "deixado na mesa" e canais mais enxutos pra sobrar altura pro gráfico do mês (as barras e os números ficam maiores).
// Só mexe em espaçamentos (nada de conteúdo some). Fora do modo ajustado, nada disso se aplica. Escopado em [data-fit-column].
const COMPACT_CSS = `
[data-fit-column] [data-hero]{padding:12px 20px 10px !important}
[data-fit-column] [data-hero-kpis]{margin-bottom:6px !important}
[data-fit-column] [data-hero-kpi]{padding:4px 12px 4px 8px !important}
[data-fit-column] [data-hero-compare]{margin-bottom:6px !important}
[data-fit-column] [data-hero-spark]{padding-top:20px !important}          /* reserva o espaço do rótulo "ÚLTIMOS DIAS" (fica 18px acima do mini-gráfico) pra não encostar no selo de ritmo */
[data-fit-column] [data-vcard]{padding:8px 12px 5px !important}
[data-fit-column] [data-vcard] img{height:52px !important}
[data-fit-column] [data-mesa]{padding-top:5px !important;padding-bottom:5px !important}
[data-fit-column] [data-canais] > div{padding:8px 14px !important}
[data-fit-column] [data-canais] > div > div:first-child{margin-bottom:4px !important}
`

interface FitColumnProps {
  enabled: boolean                         // false → renderiza como antes (coluna normal, o gráfico no fim)
  gap?: number                             // espaço entre os blocos (o mesmo da coluna original)
  chartMin?: number                        // altura mínima do gráfico (antes de reduzir a coluna)
  chartMax?: number                        // altura máxima (em telas gigantes sobra espaço em branco em vez de barras esticadas demais)
  minScale?: number                        // piso da redução (0.55 = 55%)
  chart: (height: number | null) => ReactNode      // recebe a altura que o gráfico deve ter (null = tamanho natural)
  children: ReactNode                      // os blocos de cima
}

export function FitColumn({ enabled, gap: gapNormal = 12, chartMin = 330, chartMax = 760, minScale = 0.55, chart, children }: FitColumnProps) {
  const gap = enabled ? Math.max(6, gapNormal - 4) : gapNormal         // no modo ajustado os blocos ficam um pouco mais juntos (ganha altura)
  const outer = useRef<HTMLDivElement>(null)
  const others = useRef<HTMLDivElement>(null)
  const [m, setM] = useState({ s: 1, chartH: chartMin, ready: false, scroll: false })
  const mRef = useRef(m)
  mRef.current = m
  const changes = useRef({ n: 0, t: 0 })

  useIso(() => {
    if (!enabled) { setM(x => (x.ready ? { s: 1, chartH: chartMin, ready: false, scroll: false } : x)); return }
    const o = outer.current, ot = others.current
    if (!o || !ot) return
    let raf = 0
    const measure = () => {
      const availH = o.clientHeight, othersH = ot.offsetHeight         // offsetHeight ignora o scale: é a altura "natural"
      if (availH <= 0) return
      const need = othersH + gap + chartMin
      let s = Math.min(1, availH / need), scroll = false
      if (s < minScale) { s = minScale; scroll = true }
      s = Math.floor(s * 100) / 100
      const prev = mRef.current
      // anti-oscilação: encolher é sempre imediato (nunca deixa passar da tela); crescer só se for um ganho de verdade
      const grewTiny = prev.ready && s >= prev.s && s - prev.s < 0.03
      const nextS = grewTiny ? prev.s : s
      const chartH = Math.round(Math.min(chartMax, Math.max(chartMin, availH / nextS - othersH - gap)))     // o que sobra vira altura do gráfico (com a escala que de fato vale)
      if (prev.ready && nextS === prev.s && Math.abs(prev.chartH - chartH) < 6 && prev.scroll === scroll) return
      const now = Date.now(), c = changes.current
      if (now - c.t > 1500) { c.n = 0; c.t = now }
      if (++c.n > 12) return                                           // trava de segurança: nunca entra em laço de medidas
      setM({ s: nextS, chartH, ready: true, scroll })
    }
    const tick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    measure()
    const fallback = setTimeout(() => setM(x => (x.ready ? x : { ...x, ready: true })), 700)     // se a medição não rodar, mostra mesmo assim (nunca fica invisível)
    const ro = new ResizeObserver(tick)
    ro.observe(o); ro.observe(ot)
    return () => { ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(fallback) }
  }, [enabled, gap, chartMin, chartMax, minScale])

  // sem ajuste: exatamente a coluna de antes
  if (!enabled) return <div style={{ display: 'flex', flexDirection: 'column', gap: gapNormal }}>{children}{chart(null)}</div>

  return (
    <div ref={outer} data-fit-column data-fit-scale={m.s} data-fit-chart={m.chartH}
      style={{ position: 'relative', minHeight: 0, minWidth: 0, overflowX: 'hidden', overflowY: m.scroll ? 'auto' : 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: `${100 / m.s}%`, transform: m.s < 1 ? `scale(${m.s})` : undefined, transformOrigin: '0 0', opacity: m.ready ? 1 : 0, transition: 'opacity .15s' }}>
        <style>{COMPACT_CSS}</style>
        <div ref={others} style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
        <div data-fit-chart-box style={{ height: m.chartH, marginTop: gap }}>{chart(m.chartH)}</div>
      </div>
    </div>
  )
}
