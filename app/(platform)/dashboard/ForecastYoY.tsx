'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, BarChart3, Layers, AlertTriangle, Flag } from 'lucide-react'
import {
  buildRoutes, buildSeries, buildTable, chartScale, fmtAxis, fmtMi, fmtNum, fmtPct, fmtReais, MONTHS_PT, STATUS_LABEL,
  type Route, type Series, type Status, type TableRow, type VKey, type YoYData,
} from '@/lib/dashboard/yoy'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Forecast → "a rota para igualar o ano passado"
//   O gestor precisa fechar o mês PELO MENOS no valor do mesmo mês do ano passado. Então a seção responde, por vertical:
//   quanto falta · em quantos dias · quanto vender por dia · em que dias o ano passado concentrou a venda.
//   1) ROTA (resumo + uma carta por vertical + acumulado do mês)   2) tabela completa   3) dia a dia (total)   4) dia a dia por vertical
// Receita (R$), nunca quantidade. Só as 4 verticais ativas. Metas do cadastro. Só superadmin (a rota recusa os outros).
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ACCENT = '#6366f1', BRAND_A = '#4f46e5', BRAND_B = '#7c3aed'
const brandGrad = `linear-gradient(135deg,${BRAND_A},${BRAND_B})`
// as mesmas cores por vertical do resto do Forecast
const VC: Record<VKey, { label: string; init: string; color: string; from: string; to: string }> = {
  anest: { label: 'Anest-Review', init: 'AN', color: '#4f7be8', from: '#6f95f0', to: '#3f69d4' },
  oft: { label: 'Oft-Review', init: 'OF', color: '#dba21a', from: '#efbd3f', to: '#c58d0c' },
  ortop: { label: 'Ortop-Review', init: 'OR', color: '#e67a38', from: '#f1975a', to: '#d3652a' },
  r1: { label: 'Med-Review R1', init: 'R1', color: '#8460e2', from: '#a184f0', to: '#6f4bd0' },
}
const CHART_ORDER: VKey[] = ['anest', 'oft', 'ortop', 'r1']
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const dd2 = (n: number) => String(n).padStart(2, '0')
const sgn = (v: number | null) => (v === null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down')

// ── balão de informação: desenhado no <body>, por cima de TUDO (nunca fica atrás do título nem é cortado pelo quadro) ──────────
interface Anchor { x: number; y: number; w: number; h: number }
function Tip({ anchor, children, vars }: { anchor: Anchor | null; children: React.ReactNode; vars?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    if (!anchor || !ref.current) { setPos(null); return }
    const t = ref.current.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight
    const left = Math.max(10, Math.min(anchor.x + anchor.w / 2 - t.width / 2, vw - t.width - 10))
    let top = anchor.y - t.height - 14
    if (top < 10) top = Math.max(10, Math.min(anchor.y + anchor.h + 14, vh - t.height - 10))                     // sem espaço em cima: abre embaixo
    setPos({ left, top })
  }, [anchor, children])
  if (!anchor || typeof document === 'undefined') return null
  return createPortal(<div ref={ref} className="yy-tip" data-testid="yoy-tip" role="status" style={{ ...(vars as React.CSSProperties), left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>{children}</div>, document.body)
}
function useDismissOnScroll(clear: () => void) {
  useEffect(() => {
    window.addEventListener('scroll', clear, true); window.addEventListener('resize', clear)
    return () => { window.removeEventListener('scroll', clear, true); window.removeEventListener('resize', clear) }
  }, [clear])
}
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null); const [w, setW] = useState(960)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const measure = () => setW(Math.round(el.getBoundingClientRect().width) || 960); measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null; ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  return [ref, w]
}

// ── peças visuais ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function Tile({ children, grad = brandGrad, size = 46 }: { children: React.ReactNode; grad?: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 900, fontSize: size * 0.34, letterSpacing: '-0.02em', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3),0 8px 20px -6px rgba(79,70,229,.55)' }}>{children}</div>
}
function Panel({ icon: Icon, title, subtitle, right, children, testid }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; testid: string }) {
  return (
    <section className="yy-panel" data-testid={testid}>
      <header className="yy-head">
        <div className="yy-headL"><Tile><Icon size={22} /></Tile><div style={{ minWidth: 0 }}><h3 className="yy-title">{title}</h3>{subtitle && <p className="yy-sub">{subtitle}</p>}</div></div>
        {right}
      </header>
      {children}
    </section>
  )
}
function Chip({ children, tone = 'neutral', title }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'brand'; title?: string }) {
  return <span title={title} className={`yy-chip yy-chip-${tone}`}>{children}</span>
}
function StatusPill({ s, big }: { s: Status; big?: boolean }) { return <span className={`yy-status yy-st-${s}${big ? ' yy-big' : ''}`} data-status={s}><i />{STATUS_LABEL[s]}</span> }
function ScaleToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="yy-seg" role="group" aria-label="Escala dos gráficos" title="Ampliada: corta os dias muito altos para os menores aparecerem. Proporcional: todas as barras na mesma régua.">
      <button type="button" aria-pressed={on} className={on ? 'on' : ''} onClick={() => set(true)}>Escala ampliada</button>
      <button type="button" aria-pressed={!on} className={!on ? 'on' : ''} onClick={() => set(false)}>Proporcional</button>
    </div>
  )
}
function Skeleton({ h }: { h: number }) { return <div className="yy-shimmer" style={{ height: h, borderRadius: 22, background: 'var(--secondary)', border: '1px solid var(--border)' }} /> }
// Valor grande e elegante: o "R$" e a unidade (mil/mi) ficam menores, os dígitos grandes — cabe sem quebrar linha e lê mais rápido
function Big({ v, signed }: { v: number; signed?: boolean }) {
  const t = fmtMi(v, signed), m = /^([+−]?)R\$ ([\d.,]+)(?: (mil|mi))?$/.exec(t)
  if (!m) return <>{t}</>
  return <>{m[1]}<small className="yy-cur">R$</small> {m[2]}{m[3] && <> <small className="yy-unit">{m[3]}</small></>}</>
}

// ── 1) A ROTA (enxuta: um resumo com UM número de ação + uma linha por vertical, sempre as mesmas 4 colunas) ───────────────────────────
function RouteBar({ r, yearPrev, dark }: { r: Route; yearPrev: number; dark?: boolean }) {
  const fill = Math.min(r.pctFech, 100), mark = Math.min(r.pctPrevHoje, 100)
  return (
    <div className={`yy-pbar${dark ? ' yy-pbar-dark' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill)}
      aria-label={`${r.label}: ${Math.round(r.pctFech)}% do fechamento de ${yearPrev}`} title={`${r.label}: ${Math.round(r.pctFech)}% do fechamento de ${yearPrev} · ${yearPrev} estava em ${Math.round(r.pctPrevHoje)}% neste mesmo dia`}>
      <div className="yy-fill" data-testid="route-fill" style={{ width: `${fill}%` }} />
      <i className="yy-tick" data-testid="route-mark" style={{ left: `${mark}%` }} />
    </div>
  )
}
function RouteHero({ r, d }: { r: Route; d: YoYData }) {
  const mes = MONTHS_PT[+d.month.slice(5) - 1], batido = r.status === 'batido', sem = r.status === 'semBase'
  return (
    <div className="yy-hero" data-testid="route-hero" data-status={r.status}>
      <div className="yy-hero-dots" aria-hidden />
      <div className="yy-hero-grid">
        <div className="yy-hero-main">
          <StatusPill s={r.status} big />
          <h3 className="yy-hero-h" data-testid="route-headline">{sem
            ? <>Não há vendas de {mes} de {d.yearPrev} para comparar</>
            : batido ? <>Já passamos {mes} de {d.yearPrev}: <b>{fmtMi(r.accCur - r.fechPrev)}</b> acima</>
            : <>Faltam <b>{fmtMi(r.falta)}</b> para igualar {mes} de {d.yearPrev}</>}</h3>
          <RouteBar r={r} yearPrev={d.yearPrev} dark />
          <div className="yy-hero-cap"><span>{d.yearCur}: <b>{Math.round(r.pctFech)}%</b> · {d.yearPrev} neste dia: <b>{Math.round(r.pctPrevHoje)}%</b></span><span>100% = {fmtMi(r.fechPrev)}</span></div>
        </div>
        <div className="yy-hero-day">
          <span>{batido ? 'Tudo daqui para frente é ganho' : 'Precisa vender por dia'}</span>
          <b data-k="porDia">{batido || sem || r.precisaDia === null ? '—' : <Big v={r.precisaDia} />}</b>
          <small>{r.diasRestantes > 0 ? `nos ${r.diasRestantes} ${r.diasRestantes === 1 ? 'dia' : 'dias'} que restam · média atual ${fmtMi(r.ritmoDia)}/dia` : 'último dia do mês'}</small>
        </div>
      </div>
    </div>
  )
}
function RouteList({ routes, d, foco }: { routes: Route[]; d: YoYData; foco?: string }) {
  return (
    <div className="yy-rwrap">
      <table className="yy-rtable" data-testid="route-list">
        <thead><tr><th scope="col">Vertical</th><th scope="col">Vendido · % do fechamento de {d.yearPrev}</th><th scope="col" className="yy-r">Falta</th><th scope="col" className="yy-r">Por dia</th><th scope="col" className="yy-r">Situação</th></tr></thead>
        <tbody>
          {routes.map(r => {
            const k = r.key as VKey, c = VC[k], batido = r.status === 'batido', sem = r.status === 'semBase'
            return (
              <tr key={k} data-testid={`yoy-rota-${k}`} data-status={r.status} style={{ ['--yy-c' as any]: c.color, ['--yy-c1' as any]: c.from, ['--yy-c2' as any]: c.to }}>
                <th scope="row"><span className="yy-rname"><Tile size={34} grad={`linear-gradient(135deg,${c.from},${c.to})`}>{c.init}</Tile><span>{c.label}</span>{k === foco && <em className="yy-foco" title="A vertical com o maior valor a recuperar">FOCO</em>}</span></th>
                <td data-label="Vendido"><div className="yy-rprog"><RouteBar r={r} yearPrev={d.yearPrev} /><b>{Math.round(r.pctFech)}%</b></div></td>
                <td className="yy-r" data-label="Falta"><b data-k="falta">{sem ? '—' : batido ? '✓ igualou' : fmtMi(r.falta)}</b></td>
                <td className="yy-r" data-label="Por dia"><b data-k="porDia">{batido || sem || r.precisaDia === null ? '—' : fmtMi(r.precisaDia)}</b></td>
                <td className="yy-r" data-label="Situação"><StatusPill s={r.status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
function Picos({ r, d }: { r: Route; d: YoYData }) {
  if (!r.picos.length) return null
  const share = Math.round(r.picos.reduce((a, p) => a + p.share, 0))
  return (
    <div className="yy-picoline" data-testid="picos-total">
      <span className="yy-picolab">★ Onde {d.yearPrev} concentrou o resto do mês</span>
      {r.picos.map(p => <em key={p.day} title={`Em ${d.yearPrev} o dia ${p.day} vendeu ${fmtReais(p.valor)}`}><b>{dd2(p.day)}/{d.month.slice(5)}</b> {p.wd} · {Math.round(p.share)}%</em>)}
      <small>{share}% do que 2025 vendeu daqui até o fim do mês</small>
    </div>
  )
}

// ── 2) tabela ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const TIPS = {
  acc: 'Receita de todas as vendas do dia 1 até hoje, em cada ano.',
  cresc: 'Acumulado deste ano menos o acumulado do ano passado, até o mesmo dia.',
  ritmo: 'Acumulado ÷ dias passados × dias do mês: quanto o mês fecharia se o ritmo médio dos dias passados continuasse.',
  proj: 'Acumulado deste ano + o que o ano passado vendeu do dia seguinte até o fim do mês: se o resto do mês repetir o comportamento do ano passado.',
  fech: 'Quanto o mesmo mês do ano passado fechou, no mês inteiro.',
  meta: 'Meta do mês como está CADASTRADA (a mesma do resto do Forecast); "Operação" usa a meta geral cadastrada.',
  gap: 'Ritmo linear deste ano menos a meta: positivo = o ritmo atual bate a meta; negativo = ficaria abaixo.',
}
function YoYTable({ rows, d, routes }: { rows: TableRow[]; d: YoYData; routes: Route[] }) {
  const range = d.dayOfMonth === 1 ? 'DIA 1' : `1 A ${d.dayOfMonth}`
  const H: { k: string; label: string; tip: string; g?: string }[] = [
    { k: 'area', label: 'ÁREA', tip: '' },
    { k: 'accP', label: `ACUMULADO ${d.yearPrev} (${range})`, tip: TIPS.acc, g: 'a' }, { k: 'accC', label: `ACUMULADO ${d.yearCur} (${range})`, tip: TIPS.acc, g: 'a' },
    { k: 'gP', label: 'CRESCIMENTO %', tip: TIPS.cresc, g: 'b' }, { k: 'gR', label: 'CRESCIMENTO R$', tip: TIPS.cresc, g: 'b' },
    { k: 'rP', label: `RITMO LINEAR ${d.yearPrev}`, tip: TIPS.ritmo, g: 'c' }, { k: 'rC', label: `RITMO LINEAR ${d.yearCur}`, tip: TIPS.ritmo, g: 'c' },
    { k: 'proj', label: `PROJEÇÃO PELO COMPORTAMENTO DE ${d.yearPrev}`, tip: TIPS.proj, g: 'd' }, { k: 'fech', label: `FECHAMENTO REAL ${d.yearPrev}`, tip: TIPS.fech, g: 'd' },
    { k: 'meta', label: `META ${d.yearCur}`, tip: TIPS.meta, g: 'e' }, { k: 'gap', label: `RITMO ${d.yearCur} – META`, tip: TIPS.gap, g: 'e' },
  ]
  const Pill = ({ v, children }: { v: number | null; children: React.ReactNode }) => <span className={`yy-pill yy-${sgn(v)}`}>{children}</span>
  return (
    <div className="yy-scroll" data-testid="yoy-table-scroll">
      <table className="yy-table" data-testid="yoy-table">
        <thead><tr>{H.map(h => <th key={h.k} scope="col" title={h.tip || undefined} className={`${h.k === 'area' ? 'yy-left ' : ''}${h.g ? 'yy-g-' + h.g : ''}`}>{h.label}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => {
            const total = r.key === 'total', hasMeta = r.meta > 0, c = total ? null : VC[r.key as VKey], st = routes.find(x => x.key === r.key)?.status
            return (
              <tr key={r.key} data-row={r.key} className={total ? 'yy-total' : ''} style={c ? { ['--yy-c' as any]: c.color } : undefined}>
                <th scope="row" className="yy-left">
                  <span className="yy-area">
                    <span aria-hidden className="yy-areatile" style={{ background: total ? brandGrad : `linear-gradient(135deg,${c!.from},${c!.to})` }}>{total ? 'OP' : c!.init}</span>
                    <span>{r.label}</span>{st && <i className={`yy-dot yy-st-${st}`} title={STATUS_LABEL[st]} />}
                  </span>
                </th>
                <td data-c="accP" title={fmtReais(r.accPrev)}>{fmtNum(r.accPrev)}</td><td data-c="accC" className="yy-strong" title={fmtReais(r.accCur)}>{fmtNum(r.accCur)}</td>
                <td data-c="gP"><Pill v={r.growthPct}>{fmtPct(r.growthPct)}</Pill></td>
                <td data-c="gR" title={fmtReais(r.growthR)}><Pill v={r.growthR}>{fmtNum(r.growthR, true)}</Pill></td>
                <td data-c="rP" title={fmtReais(r.ritmoPrev)}>{fmtNum(r.ritmoPrev)}</td><td data-c="rC" className="yy-strong" title={fmtReais(r.ritmoCur)}>{fmtNum(r.ritmoCur)}</td>
                <td data-c="proj" className="yy-strong" title={fmtReais(r.projecao)}>{fmtNum(r.projecao)}</td><td data-c="fech" title={fmtReais(r.fechPrev)}>{fmtNum(r.fechPrev)}</td>
                <td data-c="meta" title={hasMeta ? fmtReais(r.meta) : 'Sem meta cadastrada'}>{hasMeta ? fmtNum(r.meta) : '—'}</td>
                <td data-c="gap" title={hasMeta ? fmtReais(r.gapMeta) : undefined}>{hasMeta ? <Pill v={r.gapMeta}>{fmtNum(r.gapMeta, true)}</Pill> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── 3) e 4) barras dia a dia ────────────────────────────────────────────────────────────────────────────────────────────────────
function DayBars({ s, d, from, to, id, name, peaks, ampliada }: { s: Series; d: YoYData; from: string; to: string; id: string; name: string; peaks: Set<number>; ampliada: boolean }) {
  const [hover, setHover] = useState<{ i: number; a: Anchor } | null>(null)
  const N = s.days.length, sc = useMemo(() => chartScale(s, ampliada), [s, ampliada]), { top, ticks } = sc, cut = useMemo(() => new Set(sc.clipped), [sc]), nivel = useMemo(() => { const m = new Map<number, number>(); let antDia = -99, ant = -1; for (const dia of sc.clipped) { const n = dia - antDia <= 2 ? (ant + 1) % 3 : 0; m.set(dia, n); antDia = dia; ant = n } return m }, [sc]), mes = MONTHS_PT[+d.month.slice(5) - 1]
  const pct = (v: number | null) => (v && v > 0 ? `${Math.min(100, (v / top) * 100)}%` : '0%')
  const h = hover ? s.days[hover.i] : null, m2 = d.month.slice(5), empty = s.max <= 0
  const clear = useCallback(() => setHover(null), []); useDismissOnScroll(clear)
  const show = (i: number, el: HTMLElement) => { const r = el.getBoundingClientRect(), p = s.days[i], frac = Math.min(1, Math.max(p.cur ?? 0, p.prev ?? 0) / top); setHover({ i, a: { x: r.left, y: Math.max(r.top, r.bottom - r.height * frac), w: r.width, h: Math.min(r.height * frac, r.height) } }) }
  return (
    <div data-testid={`chart-${id}`} style={{ ['--yy-c' as any]: from, ['--yy-c2' as any]: to }}>
      <div className="yy-legend" aria-hidden>
        <span><i className="yy-sw" style={{ background: `linear-gradient(180deg,${from},${to})` }} />{d.yearCur} · até hoje</span>
        <span><i className="yy-sw yy-sw-prev" />{d.yearPrev} · mês inteiro</span>
        {peaks.size > 0 && <span><i className="yy-starsw">★</i>dia forte de {d.yearPrev} que ainda vem</span>}
      </div>
      <div className="yy-chartscroll">
        <div className="yy-chartin" style={{ minWidth: N * 28 + 60 }}>
          <div className="yy-plot" role="img" aria-label={`${name}: receita por dia de ${mes}, ${d.yearCur} contra ${d.yearPrev}. ${d.yearCur} até hoje: ${fmtReais(s.toDateCur)}; ${d.yearPrev} no mesmo período: ${fmtReais(s.toDatePrev)}.`}>
            <div className="yy-ylab" aria-hidden>{ticks.map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{fmtAxis(t)}</span>)}</div>
            <div className="yy-area">
              {ticks.map(t => <div key={t} className="yy-line" style={{ bottom: `${(t / top) * 100}%` }} />)}
              <div className="yy-cols" style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))` }} onMouseLeave={clear}>
                {s.days.map((p, i) => (
                  <div key={p.day} className={`yy-col${hover?.i === i ? ' yy-on' : ''}${p.day === d.dayOfMonth ? ' yy-today' : ''}`} data-day={p.day} tabIndex={0}
                    aria-label={`Dia ${p.day}: ${d.yearCur} ${p.cur === null ? 'sem dado' : fmtReais(p.cur)}; ${d.yearPrev} ${p.prev === null ? 'sem dado' : fmtReais(p.prev)}`}
                    onMouseEnter={e => show(i, e.currentTarget)} onFocus={e => show(i, e.currentTarget)} onBlur={clear}>
                    {peaks.has(p.day) && !cut.has(p.day) && <i className="yy-star" data-star={p.day} style={{ bottom: `calc(${pct(Math.max(p.prev ?? 0, p.cur ?? 0))} + 6px)` }} title={`Dia forte de ${d.yearPrev}`}>★</i>}
                    {cut.has(p.day) && <em className={`yy-cutlbl${i >= N - 2 ? ' yy-cutr' : i <= 1 ? ' yy-cutl' : ''}`} data-cut={p.day} data-nivel={nivel.get(p.day) ?? 0} style={{ bottom: `calc(100% + 3px + ${(nivel.get(p.day) ?? 0) * 22}px)` }}>{peaks.has(p.day) && <b className="yy-lstar">★</b>}{fmtNum(Math.max(p.prev ?? 0, p.cur ?? 0))}</em>}
                    <span className={`yy-bar yy-cur${(p.cur ?? 0) > top ? ' yy-cutbar' : ''}`} data-bar="cur" style={{ height: pct(p.cur), minHeight: p.cur && p.cur > 0 ? 4 : 0 }} />
                    <span className={`yy-bar yy-prev${p.prev && p.prev > 0 ? '' : ' yy-zero'}${(p.prev ?? 0) > top ? ' yy-cutbar' : ''}`} data-bar="prev" style={{ height: pct(p.prev), minHeight: p.prev && p.prev > 0 ? 4 : 0 }} />
                  </div>
                ))}
              </div>
              {empty && <p className="yy-empty">Sem vendas neste período.</p>}
            </div>
          </div>
          <div className="yy-x" style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))` }} aria-hidden>
            {s.days.map(p => { const done = p.cur !== null && p.day < d.dayOfMonth, win = done && (p.cur as number) >= (p.prev ?? 0); return <span key={p.day} className={p.day === d.dayOfMonth ? 'yy-xtoday' : done ? (win ? 'yy-xwin' : 'yy-xlose') : ''}>{p.day}</span> })}
          </div>
        </div>
      </div>
      <Tip anchor={hover?.a ?? null} vars={{ '--yy-c': from }}>{h && (() => {
        const dif = h.cur !== null && h.prev !== null ? h.cur - h.prev : null
        return (
          <>
            <b>{dd2(h.day)}/{m2}{h.day === d.dayOfMonth ? ' · hoje (em andamento)' : ''}{peaks.has(h.day) ? ' · ★ dia forte' : ''}</b>
            <span><i className="yy-sw" style={{ background: `linear-gradient(180deg,${from},${to})` }} />{d.yearCur} ({h.wdCur})<em>{h.cur === null ? (h.day > d.dayOfMonth ? 'ainda não chegou' : '—') : fmtReais(h.cur)}</em></span>
            <span><i className="yy-sw yy-sw-prev" />{d.yearPrev} ({h.wdPrev || '—'})<em>{h.prev === null ? '—' : fmtReais(h.prev)}</em></span>
            {dif !== null && <span className={`yy-tipdelta yy-${sgn(dif)}`}>{dif >= 0 ? '▲' : '▼'} {fmtMi(dif, true)}{h.prev ? ` (${fmtPct(((h.cur as number) - h.prev) / h.prev * 100)})` : ''}</span>}
          </>
        )
      })()}</Tip>
    </div>
  )
}
function Summary({ s, d }: { s: Series; d: YoYData }) {
  const tone = s.growthR > 0 ? 'good' : s.growthR < 0 ? 'bad' : 'neutral'
  return (
    <div className="yy-summary">
      <Chip title={`Receita de ${d.yearCur} do dia 1 até hoje`}>{d.yearCur}: <b>{fmtMi(s.toDateCur)}</b></Chip>
      <Chip title={`Receita de ${d.yearPrev} do dia 1 ao mesmo dia`}>{d.yearPrev}: <b>{fmtMi(s.toDatePrev)}</b></Chip>
      <Chip tone={tone} title="Diferença no acumulado até hoje">{s.growthR >= 0 ? '▲' : '▼'} <b>{fmtMi(s.growthR, true)}</b> · {fmtPct(s.growthPct)}</Chip>
    </div>
  )
}

export function ForecastYoY() {
  const [data, setData] = useState<YoYData | null>(null)
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/forecast/yoy', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json()); setError(false)
    } catch { setError(true) }
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') load() }, 120_000)       // venda nova entra sozinha
    return () => clearInterval(id)
  }, [load])
  const rows = useMemo(() => (data ? buildTable(data) : []), [data])
  const routes = useMemo(() => (data ? buildRoutes(data) : []), [data])
  const total = useMemo(() => (data ? buildSeries(data, 'total') : null), [data])
  const per = useMemo(() => (data ? Object.fromEntries(CHART_ORDER.map(k => [k, buildSeries(data, k)])) as Record<VKey, Series> : null), [data])
  const [ampliada, setAmpliada] = useState(true)
  const algumCorte = useMemo(() => !!total && !!per && [total, ...Object.values(per)].some(s => chartScale(s, true).ampliada), [total, per])
  const mes = data ? MONTHS_PT[+data.month.slice(5) - 1] : ''

  if (!data) {
    return (
      <div data-testid="yoy-loading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{CSS}</style>
        {error ? (
          <div className="yy-panel" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <AlertTriangle size={22} color="#d97706" />
            <div style={{ flex: 1, minWidth: 220 }}><p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>Não consegui carregar o comparativo com o ano passado.</p><p className="yy-sub" style={{ margin: '3px 0 0' }}>Vou tentar de novo sozinho em instantes.</p></div>
            <button type="button" className="yy-btn" onClick={load}>Tentar agora</button>
          </div>
        ) : <><Skeleton h={360} /><Skeleton h={300} /><Skeleton h={420} /></>}
      </div>
    )
  }
  const hero = routes[0], vroutes = routes.slice(1), foco = vroutes.filter(r => r.falta > 0).sort((a, b) => b.falta - a.falta)[0]?.key
  const peaksOf = (k: 'total' | VKey) => new Set((routes.find(r => r.key === k)?.picos ?? []).map(p => p.day))
  return (
    <>
      <style>{CSS}</style>
      <Panel testid="yoy-rota" icon={Flag} title={`A rota para igualar ${mes} de ${data.yearPrev}`}
        subtitle={`Objetivo: fechar ${mes} pelo menos igual a ${mes} de ${data.yearPrev} · hoje é dia ${data.dayOfMonth} de ${data.daysInMonth.cur}`}
        right={<Chip tone="brand" title="Hoje">Hoje: {dm(data.today)}</Chip>}>
        <RouteHero r={hero} d={data} />
        <RouteList routes={vroutes} d={data} foco={foco} />
        <Picos r={hero} d={data} />
        <p className="yy-foot" data-testid="route-foot"><b>Como ler:</b> a barra mostra quanto do fechamento de {data.yearPrev} já foi vendido e o traço marca onde {data.yearPrev} estava neste dia. <b>No caminho</b>: repetir o resto de {data.yearPrev} já iguala. <b>Atenção</b>: precisa superar {data.yearPrev} em até 15%. <b>Acelerar</b>: mais de 15%.</p>
      </Panel>

      <Panel testid="yoy-tabela" icon={CalendarRange} title={`${mes[0].toUpperCase()}${mes.slice(1)} de ${data.yearCur} × ${mes} de ${data.yearPrev}`}
        subtitle={`Acumulado do dia 1 ao dia ${data.dayOfMonth} em cada ano · receita de todas as vendas (novas e recorrentes) · hoje, dia ${data.dayOfMonth}, ainda está em andamento`}
        right={<Chip title="Todos os valores da tabela estão em reais; passe o mouse num valor para ver o número exato">Valores em R$ · mil = milhares · mi = milhões</Chip>}>
        <YoYTable rows={rows} d={data} routes={routes} />
        <p className="yy-foot">Receita só das 4 verticais ativas; “Operação” é a soma delas. As metas vêm do cadastro de metas do mês. Datas como a plataforma registra cada venda (confirmação do pagamento), nos dois anos. A bolinha ao lado do nome é a situação da rota. Passe o mouse no título de uma coluna para ver como ela é calculada.<span className="yy-hint"> Arraste a tabela para o lado para ver todas as colunas.</span></p>
      </Panel>

      <Panel testid="yoy-total" icon={BarChart3} title="Dia a dia — todas as verticais" subtitle={`Receita de cada dia de ${mes}: ${data.yearCur} ao lado de ${data.yearPrev}, na mesma data · ★ = dia forte de ${data.yearPrev} que ainda vem${algumCorte && ampliada ? ' · ✂ = barra cortada para ampliar os dias menores (o valor está escrito no topo)' : ''}`} right={<div className="yy-rightstack">{algumCorte && <ScaleToggle on={ampliada} set={setAmpliada} />}{total ? <Summary s={total} d={data} /> : null}</div>}>
        {total && <DayBars s={total} d={data} from="#6366f1" to="#4f46e5" id="total" name="Todas as verticais" peaks={peaksOf('total')} ampliada={ampliada} />}
      </Panel>

      <Panel testid="yoy-verticais" icon={Layers} title="Dia a dia — por vertical" subtitle={`Um gráfico por vertical, cada uma na sua cor · ${data.yearCur} sólido, ${data.yearPrev} vazado${algumCorte && ampliada ? ' · ✂ = barra cortada (valor no topo)' : ''}`} right={algumCorte ? <ScaleToggle on={ampliada} set={setAmpliada} /> : undefined}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {CHART_ORDER.map(k => { const r = routes.find(x => x.key === k)!; return per && (
            <div key={k} className="yy-card yy-vchart" data-testid={`yoy-card-${k}`} style={{ ['--yy-c' as any]: VC[k].color }}>
              <div className="yy-vchead">
                <div className="yy-vname"><Tile size={36} grad={`linear-gradient(135deg,${VC[k].from},${VC[k].to})`}>{VC[k].init}</Tile>{VC[k].label}<StatusPill s={r.status} /></div>
                <Summary s={per[k]} d={data} />
              </div>
              <DayBars s={per[k]} d={data} from={VC[k].from} to={VC[k].to} id={k} name={VC[k].label} peaks={peaksOf(k)} ampliada={ampliada} />
            </div>
          ) })}
        </div>
      </Panel>
    </>
  )
}

const CSS = `
.yy-panel{--yy-good:#16a34a;--yy-bad:#e11d48;--yy-warn:#d97706;--yy-good-ink:#166534;--yy-bad-ink:#9f1239;--yy-warn-ink:#92400e;--yy-mute:color-mix(in srgb,var(--foreground) 68%,transparent);--yy-soft:color-mix(in srgb,var(--foreground) 82%,transparent);
  font-family:inherit;background:linear-gradient(180deg,var(--secondary),color-mix(in srgb,var(--secondary) 55%,var(--card)));border:1px solid var(--border);border-radius:26px;padding:26px clamp(14px,2vw,28px);box-shadow:0 1px 2px rgba(15,23,42,.04),0 14px 36px rgba(15,23,42,.07);min-width:0;color:var(--foreground)}
.dark .yy-panel{--yy-good:#4ade80;--yy-bad:#fb7185;--yy-warn:#fbbf24;--yy-good-ink:#4ade80;--yy-bad-ink:#fb7185;--yy-warn-ink:#fbbf24;box-shadow:0 1px 2px rgba(0,0,0,.3),0 14px 36px rgba(0,0,0,.34)}
.yy-panel *{font-family:inherit}
.yy-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:22px}
.yy-headL{display:flex;align-items:center;gap:14px;min-width:0}
.yy-title{font-size:21px;font-weight:900;letter-spacing:-0.025em;margin:0;line-height:1.15;color:var(--foreground)}
.yy-sub{font-size:13.5px;line-height:1.45;color:var(--yy-mute);margin:4px 0 0;font-weight:500}
@keyframes yyPulse{0%,100%{opacity:.45}50%{opacity:.9}}
.yy-shimmer{animation:yyPulse 1.4s ease-in-out infinite}
.yy-btn{border:1px solid var(--border);background:var(--card);color:var(--foreground);font:inherit;font-size:13.5px;font-weight:800;padding:9px 18px;border-radius:12px;cursor:pointer}.yy-btn:hover{border-color:${ACCENT}}
.yy-chip{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:7px 13px;border-radius:999px;background:var(--card);border:1px solid var(--border);color:var(--yy-soft);white-space:nowrap}
.yy-chip b{font-weight:900;color:var(--foreground);font-size:14px;letter-spacing:-0.01em}
.yy-chip-good{background:color-mix(in srgb,var(--yy-good) 14%,var(--card));border-color:color-mix(in srgb,var(--yy-good) 45%,transparent);color:var(--yy-good-ink)}.yy-chip-good b{color:inherit}
.yy-chip-bad{background:color-mix(in srgb,var(--yy-bad) 13%,var(--card));border-color:color-mix(in srgb,var(--yy-bad) 45%,transparent);color:var(--yy-bad-ink)}.yy-chip-bad b{color:inherit}
.yy-chip-brand{background:linear-gradient(135deg,${BRAND_A},${BRAND_B});border-color:transparent;color:#fff;box-shadow:0 6px 16px -6px rgba(79,70,229,.6)}
.yy-summary{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
/* situação */
.yy-status{--c:var(--yy-good);--ci:var(--yy-good-ink);display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:800;padding:6px 13px;border-radius:999px;color:var(--ci,var(--c));background:color-mix(in srgb,var(--c) 15%,var(--card));border:1px solid color-mix(in srgb,var(--c) 50%,transparent);width:fit-content;letter-spacing:-0.005em}
.yy-status i{width:9px;height:9px;border-radius:50%;background:var(--c);box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 22%,transparent)}
.yy-status.yy-big{font-size:14.5px;padding:8px 16px}
.yy-st-semBase{--c:#64748b;--ci:#475569}.dark .yy-st-semBase{--ci:#cbd5e1}.yy-hero .yy-st-semBase{--c:#cbd5e1}.yy-st-ok,.yy-st-batido{--c:var(--yy-good);--ci:var(--yy-good-ink)}.yy-st-atencao{--c:var(--yy-warn);--ci:var(--yy-warn-ink)}.yy-st-acelerar{--c:var(--yy-bad);--ci:var(--yy-bad-ink)}
.yy-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 25%,transparent);flex-shrink:0}
/* herói: título + barra + UM número de ação */
.yy-hero{position:relative;overflow:hidden;border-radius:22px;padding:26px 30px;color:#fff;background:linear-gradient(125deg,#1e1b4b 0%,#312e81 45%,#4338ca 100%);box-shadow:0 18px 40px rgba(49,46,129,.34);margin-bottom:16px}
.yy-hero-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.1) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:linear-gradient(100deg,transparent 0%,#000 70%);mask-image:linear-gradient(100deg,transparent 0%,#000 70%);pointer-events:none}
.yy-hero-grid{position:relative;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:28px;align-items:center}
.yy-hero-main{display:flex;flex-direction:column;gap:14px;min-width:0}
.yy-hero .yy-status{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.28);color:var(--c);background:color-mix(in srgb,var(--c) 18%,rgba(15,12,50,.55))}
.yy-hero .yy-st-ok,.yy-hero .yy-st-batido{--c:#4ade80}.yy-hero .yy-st-atencao{--c:#fbbf24}.yy-hero .yy-st-acelerar{--c:#fb7185}
.yy-hero-h{font-size:clamp(25px,2.8vw,34px);font-weight:700;letter-spacing:-0.035em;line-height:1.14;margin:0;color:#fff}
.yy-hero-h b{font-weight:900;background:linear-gradient(90deg,#fff,#c7d2fe);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.yy-hero-cap{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.82)}.yy-hero-cap b{color:#fff;font-weight:900}
.yy-hero-day{position:relative;display:flex;flex-direction:column;gap:6px;padding:20px 22px;border-radius:20px;background:linear-gradient(135deg,rgba(251,191,36,.24),rgba(244,114,182,.18));border:1px solid rgba(251,191,36,.5)}
.yy-hero-day>span{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.yy-hero-day b{white-space:nowrap;font-size:clamp(32px,3.4vw,44px);font-weight:900;letter-spacing:-0.045em;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}
.yy-hero-day small{font-size:13.5px;line-height:1.4;color:rgba(255,255,255,.85);font-weight:600}
.yy-cur{font-size:.46em;font-weight:800;opacity:.85;vertical-align:.5em;letter-spacing:0}.yy-unit{font-size:.5em;font-weight:800;opacity:.9;letter-spacing:0}
/* barra de progresso (igual no resumo e nas linhas) */
.yy-pbar{position:relative;height:14px;border-radius:999px;background:color-mix(in srgb,var(--foreground) 12%,transparent);overflow:visible;min-width:90px}
.yy-pbar-dark{background:rgba(255,255,255,.18);height:16px}
.yy-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--yy-c1,#818cf8),var(--yy-c2,#6366f1));box-shadow:0 4px 12px -3px color-mix(in srgb,var(--yy-c2,#6366f1) 70%,transparent);transition:width .6s ease;min-width:8px}
.yy-pbar-dark .yy-fill{background:linear-gradient(90deg,#38bdf8,#818cf8 55%,#c084fc)}
.yy-tick{position:absolute;top:-5px;bottom:-5px;width:3px;margin-left:-1.5px;border-radius:2px;background:var(--foreground)}.yy-pbar-dark .yy-tick{background:#fff}
/* lista por vertical: mesmas colunas em todas as linhas */
.yy-rwrap{margin-bottom:14px;container:yyr/inline-size}
.yy-rtable{width:100%;border-collapse:separate;border-spacing:0 8px}
.yy-rtable thead th{font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--yy-mute);text-align:left;padding:0 14px 2px}
.yy-rtable .yy-r{text-align:right}
.yy-rtable tbody th,.yy-rtable tbody td{background:color-mix(in srgb,var(--yy-c) 7%,var(--card));padding:13px 14px;vertical-align:middle;border-top:1px solid color-mix(in srgb,var(--yy-c) 30%,var(--border));border-bottom:1px solid color-mix(in srgb,var(--yy-c) 30%,var(--border))}
.yy-rtable tbody th{border-left:5px solid var(--yy-c);border-radius:16px 0 0 16px;text-align:left;width:26%}
.yy-rtable tbody td:last-child{border-right:1px solid color-mix(in srgb,var(--yy-c) 30%,var(--border));border-radius:0 16px 16px 0}
.yy-rname{display:flex;align-items:center;gap:11px;font-size:16px;font-weight:900;letter-spacing:-0.015em;color:var(--foreground);white-space:nowrap}
.yy-foco{font-style:normal;font-size:11px;font-weight:900;letter-spacing:.09em;padding:3px 8px;border-radius:7px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff}
.yy-rprog{display:flex;align-items:center;gap:12px}.yy-rprog .yy-pbar{flex:1}.yy-rprog b{font-size:15px;font-weight:900;min-width:38px;text-align:right;color:var(--foreground);font-variant-numeric:tabular-nums}
.yy-rtable td b[data-k]{font-size:19px;font-weight:900;letter-spacing:-0.03em;color:var(--foreground);font-variant-numeric:tabular-nums;white-space:nowrap}
.yy-rtable tr[data-status=batido] td b[data-k=falta]{color:var(--yy-good-ink)}
.yy-picoline{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;margin:0 0 4px;padding:12px 16px;border-radius:14px;background:color-mix(in srgb,#f59e0b 10%,var(--card));border:1px solid color-mix(in srgb,#f59e0b 38%,var(--border))}
.yy-picolab{font-size:13px;font-weight:900;color:var(--foreground)}
.yy-picoline em{font-style:normal;font-size:13px;font-weight:700;padding:4px 10px;border-radius:9px;background:var(--card);border:1px solid color-mix(in srgb,#f59e0b 45%,var(--border));color:var(--foreground);white-space:nowrap}.yy-picoline em b{font-weight:900}
.yy-picoline small{font-size:12.5px;color:var(--yy-mute);font-weight:600;margin-left:auto}
@container yyr (max-width:760px){
  .yy-rtable thead{display:none}.yy-rtable,.yy-rtable tbody,.yy-rtable tr{display:block}.yy-rtable tr{margin-bottom:10px;border-radius:16px;border:1px solid color-mix(in srgb,var(--yy-c) 35%,var(--border));border-left:5px solid var(--yy-c);background:linear-gradient(180deg,color-mix(in srgb,var(--yy-c) 9%,var(--card)),var(--card));padding:12px 14px}
  .yy-rtable tbody th,.yy-rtable tbody td{display:flex;align-items:center;justify-content:space-between;gap:10px;background:none;border:0;border-radius:0;padding:6px 0;width:auto;text-align:left}
  .yy-rtable td::before{content:attr(data-label);font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--yy-mute)}
  .yy-rtable .yy-r{text-align:right}.yy-rprog{flex:1;max-width:60%}
}
/* escolha de escala + resumos dos gráficos */
.yy-rightstack{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.yy-seg{display:inline-flex;padding:3px;border-radius:12px;background:color-mix(in srgb,var(--foreground) 8%,var(--card));border:1px solid var(--border)}
.yy-seg button{border:0;background:none;font:inherit;font-size:13px;font-weight:800;color:var(--yy-soft);padding:7px 13px;border-radius:9px;cursor:pointer}
.yy-seg button.on{background:linear-gradient(135deg,${BRAND_A},${BRAND_B});color:#fff;box-shadow:0 5px 14px -5px rgba(79,70,229,.7)}
/* cartões internos */
.yy-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:20px 22px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 8px 22px rgba(15,23,42,.06);min-width:0}
.dark .yy-card{box-shadow:0 1px 2px rgba(0,0,0,.3),0 8px 22px rgba(0,0,0,.3)}
.yy-vchart{border-left:6px solid var(--yy-c)}
.yy-vchead{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}
.yy-vname{margin:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:18px;font-weight:900;letter-spacing:-0.02em;color:var(--foreground)}
/* tabela */
.yy-scroll{container:yyt/inline-size;overflow-x:auto;border-radius:18px;border:1px solid var(--border);background:var(--card);box-shadow:0 1px 2px rgba(15,23,42,.04)}
.yy-table{width:100%;border-collapse:separate;border-spacing:0;font-size:14.5px;font-variant-numeric:tabular-nums}
.yy-table thead th{text-align:right;font-size:11px;font-weight:800;letter-spacing:.045em;color:color-mix(in srgb,var(--foreground) 78%,transparent);padding:16px 16px;line-height:1.3;border-bottom:2px solid var(--border);background:color-mix(in srgb,var(--secondary) 85%,var(--card));cursor:help;vertical-align:bottom;white-space:normal}
.yy-table thead th.yy-g-a{box-shadow:inset 0 3px 0 #94a3b8}.yy-table thead th.yy-g-b{box-shadow:inset 0 3px 0 #22c55e}.yy-table thead th.yy-g-c{box-shadow:inset 0 3px 0 #38bdf8}.yy-table thead th.yy-g-d{box-shadow:inset 0 3px 0 #a855f7}.yy-table thead th.yy-g-e{box-shadow:inset 0 3px 0 #f59e0b}
.yy-table .yy-left{text-align:left;padding-left:22px}
.yy-table tbody th{font-weight:800;color:var(--foreground);padding:18px 16px 18px 22px;white-space:nowrap;text-align:left;position:sticky;left:0;z-index:1;background:var(--card);box-shadow:inset 5px 0 0 var(--yy-c,transparent)}
.yy-table td{text-align:right;padding:18px 16px;color:var(--foreground);white-space:nowrap;font-weight:600;background:var(--card)}
.yy-table td.yy-strong{font-weight:900}
.yy-table tbody tr+tr th,.yy-table tbody tr+tr td{border-top:1px solid color-mix(in srgb,var(--border) 75%,transparent)}
.yy-table tbody tr:hover th,.yy-table tbody tr:hover td{background:color-mix(in srgb,var(--yy-c,${ACCENT}) 9%,var(--card))}
.yy-table tr.yy-total th,.yy-table tr.yy-total td{background:linear-gradient(90deg,color-mix(in srgb,${BRAND_A} 16%,var(--card)),color-mix(in srgb,${BRAND_B} 12%,var(--card)));font-weight:900;font-size:15px;box-shadow:none}
.yy-table tr.yy-total th{box-shadow:inset 5px 0 0 ${BRAND_B}}
.yy-area{display:inline-flex;align-items:center;gap:13px}
.yy-areatile{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.yy-pill{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:900;font-size:13.5px;border:1px solid transparent}
.yy-pill.yy-up{color:var(--yy-good-ink);background:color-mix(in srgb,var(--yy-good) 15%,var(--card));border-color:color-mix(in srgb,var(--yy-good) 40%,transparent)}
.yy-pill.yy-down{color:var(--yy-bad-ink);background:color-mix(in srgb,var(--yy-bad) 13%,var(--card));border-color:color-mix(in srgb,var(--yy-bad) 40%,transparent)}
.yy-pill.yy-flat{color:var(--yy-mute);background:color-mix(in srgb,var(--foreground) 7%,var(--card))}
.yy-foot{font-size:12.5px;color:var(--yy-mute);margin:14px 0 0;line-height:1.55;font-weight:500}
.yy-hint{display:none}
/* gráficos de barra */
.yy-legend{display:flex;gap:10px 18px;flex-wrap:wrap;font-size:13px;color:var(--yy-soft);font-weight:700;margin:0 0 14px}
.yy-legend span{display:inline-flex;align-items:center;gap:8px}
.yy-sw{display:inline-block;width:14px;height:14px;border-radius:4px;flex-shrink:0}
.yy-swdash{width:26px;height:0;border-top:3px dashed var(--yy-c);border-radius:0;background:none}
.yy-sw-prev,.yy-prev{--yy-p:color-mix(in srgb,var(--yy-c) 45%,#94a3b8);background:color-mix(in srgb,var(--yy-p) 34%,transparent);border:2px solid color-mix(in srgb,var(--yy-p) 95%,transparent);box-sizing:border-box}      /* 2025: a cor da vertical deslocada um pouco para o cinza-azulado, para se distinguir do 2026 vivo */
.yy-starsw{color:#f59e0b;font-style:normal;font-size:15px;line-height:1}
.yy-chartscroll{overflow-x:auto;overflow-y:hidden;padding:6px 2px 6px}
.yy-chartin{width:100%}
.yy-plot{position:relative;display:flex;height:436px;padding:76px 0 0 62px;box-sizing:border-box}
.yy-ylab{position:absolute;left:0;top:76px;bottom:0;width:58px}
.yy-ylab span{position:absolute;right:8px;transform:translateY(50%);font-size:12px;font-weight:600;color:var(--yy-mute);font-variant-numeric:tabular-nums;white-space:nowrap}
.yy-area{position:relative;flex:1;min-width:0}
.yy-line{position:absolute;left:0;right:0;height:0;border-top:1px dashed color-mix(in srgb,var(--foreground) 16%,transparent)}
.yy-cols{position:absolute;inset:0;display:grid;gap:0}
.yy-col{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:1px;padding:0 1px;border-radius:6px 6px 0 0;outline:none;cursor:crosshair;transition:background .12s}
.yy-col.yy-on,.yy-col:focus-visible{background:color-mix(in srgb,var(--yy-c,${ACCENT}) 16%,transparent)}
.yy-col.yy-today{background:color-mix(in srgb,${ACCENT} 11%,transparent);box-shadow:inset 0 -3px 0 ${ACCENT}}
.yy-bar{display:block;flex:1;border-radius:5px 5px 0 0;transition:height .35s ease}
.yy-bar.yy-cur{background:linear-gradient(180deg,var(--yy-c),var(--yy-c2,var(--yy-c)));box-shadow:0 6px 16px -5px color-mix(in srgb,var(--yy-c2,var(--yy-c)) 75%,transparent)}
.yy-bar.yy-prev{border-bottom:0}.yy-bar.yy-zero{border-width:0!important;box-shadow:none}
.yy-star{position:absolute;left:50%;transform:translateX(-50%);font-style:normal;font-size:15px;line-height:1;color:#f59e0b;text-shadow:0 1px 6px rgba(245,158,11,.55);pointer-events:none}
.yy-cutbar{clip-path:polygon(0 7px,16% 0,33% 7px,50% 0,66% 7px,83% 0,100% 7px,100% 100%,0 100%)}
.yy-cutlbl{position:absolute;left:50%;transform:translateX(-50%);font-style:normal;font-size:12px;font-weight:900;white-space:nowrap;color:var(--yy-c);background:var(--card);border:1px solid color-mix(in srgb,var(--yy-c) 55%,transparent);border-radius:7px;padding:1px 6px;pointer-events:none;z-index:1}
.yy-lstar{color:#f59e0b;margin-right:3px}
.yy-cutlbl.yy-cutr{left:auto;right:0;transform:none}.yy-cutlbl.yy-cutl{left:0;transform:none}
.yy-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0;font-size:14px;font-weight:600;color:var(--yy-mute)}
.yy-x{display:grid;margin-left:62px;font-size:12.5px;font-weight:600;color:var(--yy-mute);font-variant-numeric:tabular-nums;margin-top:8px}
.yy-x span{text-align:center;padding:2px 0;border-radius:6px}
.yy-x .yy-xwin{color:var(--yy-good-ink);font-weight:800}.yy-x .yy-xlose{color:var(--yy-bad-ink);font-weight:800}
.yy-x .yy-xtoday{background:${ACCENT};color:#fff;font-weight:900}
/* acumulado (SVG) */
.yy-gridline{stroke:color-mix(in srgb,var(--foreground) 16%,transparent);stroke-dasharray:3 5}
.yy-axis{font-size:12.5px;font-weight:600;fill:color-mix(in srgb,var(--foreground) 66%,transparent);font-variant-numeric:tabular-nums}.yy-axis-today{fill:var(--foreground);font-weight:900}
.yy-note{font-size:13px;font-weight:800;fill:color-mix(in srgb,var(--foreground) 80%,transparent)}.yy-note-cur{fill:#6366f1;font-size:14px;font-weight:900}.dark .yy-note-cur{fill:#a5b4fc}.yy-note-floor{font-size:13px;font-weight:900}
.yy-cross{stroke:color-mix(in srgb,var(--foreground) 35%,transparent);stroke-width:1.5;stroke-dasharray:4 4}
/* balão */
.yy-tip{position:fixed;z-index:2147483000;pointer-events:none;min-width:220px;display:flex;flex-direction:column;gap:6px;padding:13px 15px;border-radius:16px;background:var(--card,#fff);color:var(--foreground,#111);border:1px solid color-mix(in srgb,var(--foreground,#111) 18%,transparent);box-shadow:0 18px 44px rgba(15,23,42,.32),0 2px 6px rgba(15,23,42,.14);font-size:14px;font-weight:600;white-space:nowrap;font-family:inherit}
.dark .yy-tip{box-shadow:0 18px 44px rgba(0,0,0,.7),0 2px 6px rgba(0,0,0,.5)}
.yy-tip b{font-size:14.5px;font-weight:900;margin-bottom:2px;letter-spacing:-0.01em}
.yy-tip span{display:flex;align-items:center;gap:8px}.yy-tip em{font-style:normal;font-weight:900;margin-left:auto;padding-left:18px;font-variant-numeric:tabular-nums}
.yy-tip .yy-sw{width:12px;height:12px}
.yy-tipdelta{margin-top:3px;padding:5px 10px;border-radius:9px;font-weight:900;justify-content:center}
.yy-tipdelta.yy-up{color:#15803d;background:#dcfce7}.yy-tipdelta.yy-down{color:#be123c;background:#ffe4e6}.yy-tipdelta.yy-flat{background:#f1f5f9;color:#475569}
.dark .yy-tipdelta.yy-up{color:#86efac;background:rgba(34,197,94,.2)}.dark .yy-tipdelta.yy-down{color:#fda4af;background:rgba(244,63,94,.22)}.dark .yy-tipdelta.yy-flat{background:rgba(148,163,184,.2);color:#cbd5e1}
/* a tabela se adapta ao espaço: confortável quando sobra largura, mais compacta quando não sobra — e nunca esconde as colunas do fim (Meta e Ritmo − Meta) */
@container yyt (max-width:1559px){.yy-table thead th{padding:15px 12px}.yy-table td{padding:16px 12px}.yy-table tbody th{padding:16px 12px 16px 18px}.yy-table .yy-left{padding-left:18px}.yy-area{gap:11px}.yy-pill{padding:5px 12px}}
@container yyt (max-width:1399px){.yy-table thead th{padding:15px 10px}.yy-table td{padding:16px 10px}.yy-table tbody th{padding:16px 10px 16px 16px}.yy-table .yy-left{padding-left:16px}.yy-area{gap:10px}.yy-pill{padding:5px 11px}}
@container yyt (max-width:1330px){.yy-table{font-size:13.5px}.yy-table thead th{font-size:11px;letter-spacing:.02em;padding:13px 8px}.yy-table td{padding:14px 8px}.yy-table tbody th{padding:14px 9px 14px 12px}.yy-table .yy-left{padding-left:12px}.yy-areatile{width:28px;height:28px}.yy-area{gap:9px}.yy-pill{font-size:12.5px;padding:4px 10px}.yy-table tr.yy-total th,.yy-table tr.yy-total td{font-size:14px}}
@container yyt (max-width:1230px){.yy-table{font-size:13px}.yy-table thead th{font-size:11px;letter-spacing:.01em;padding:12px 5px}.yy-table td{padding:13px 5px}.yy-table tbody th{padding:13px 6px 13px 10px}.yy-table .yy-left{padding-left:10px}.yy-areatile{display:none}.yy-area{gap:8px}.yy-pill{font-size:12px;padding:3px 8px}.yy-dot{width:8px;height:8px}.yy-table tr.yy-total th,.yy-table tr.yy-total td{font-size:13.5px}}
@container yyt (max-width:1060px){.yy-table{font-size:12.5px}.yy-table thead th{font-size:10.5px;letter-spacing:0;padding:10px 5px}.yy-table td{padding:12px 5px}.yy-table tbody th{padding:12px 5px 12px 8px}.yy-areatile{display:none}.yy-pill{font-size:12px;padding:3px 6px}}
@container yyt (max-width:1000px){.yy-table{font-size:12px}.yy-table thead th{padding:9px 3px}.yy-table td{padding:10px 3px}.yy-table tbody th{padding:10px 3px 10px 7px}.yy-dot{display:none}.yy-pill{padding:2px 5px;font-size:11.5px}.yy-table .yy-left{padding-left:7px}}
@container yyt (max-width:960px){.yy-table thead th{padding:9px 2px}.yy-table td{padding:10px 2px}.yy-table tbody th{padding:10px 2px 10px 6px;font-size:12px}.yy-pill{padding:2px 4px;font-size:11px}.yy-area{gap:5px}}
@media(max-width:1180px){.yy-hint{display:inline}}
@media(max-width:900px){.yy-hero-grid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:700px){.yy-panel{padding:18px 14px;border-radius:22px}.yy-hero{padding:20px 16px}.yy-card{padding:16px 12px}.yy-title{font-size:19px}.yy-picoline small{margin-left:0}.yy-plot{height:320px}}
@media(max-width:560px){.yy-hero-h{font-size:24px}.yy-hero-day b{font-size:34px}.yy-chip{white-space:normal}.yy-rightstack{justify-content:flex-start}.yy-seg button{padding:7px 10px}}
@media(prefers-reduced-motion:reduce){.yy-bar,.yy-fill,.yy-shimmer{transition:none;animation:none}}
`
