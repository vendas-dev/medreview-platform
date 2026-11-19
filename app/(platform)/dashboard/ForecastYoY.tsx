'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, BarChart3, Layers, AlertTriangle, Flag } from 'lucide-react'
import {
  buildPlanoDia, buildRoutes, buildSeries, buildTable, chartScale, fmtAxis, fmtMi, fmtNum, fmtPct, fmtReais, fmtShare, MONTHS_PT, niceScale, STATUS_LABEL,
  type PlanoDia, type Route, type Series, type Status, type TableRow, type VKey, type YoYData,
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
// bar1/bar2 = as cores das BARRAS de 2026 (sólidas); prevMix = quanto % da cor da vertical entra nas barras vazadas de 2025 (o resto é cinza-azulado).
// Anest: azul mais FORTE e 2025 mais acinzentado — com o tom antigo as duas séries ficavam parecidas (distância 56 de 441; agora ~111, mais que Oft 97 e Ortop 90).
const VC: Record<VKey, { label: string; init: string; color: string; from: string; to: string; bar1: string; bar2: string; prevMix: number }> = {
  anest: { label: 'Anest-Review', init: 'AN', color: '#4f7be8', from: '#6f95f0', to: '#3f69d4', bar1: '#2f5fe3', bar2: '#2146b8', prevMix: 20 },
  oft: { label: 'Oft-Review', init: 'OF', color: '#dba21a', from: '#efbd3f', to: '#c58d0c', bar1: '#efbd3f', bar2: '#c58d0c', prevMix: 45 },
  ortop: { label: 'Ortop-Review', init: 'OR', color: '#e67a38', from: '#f1975a', to: '#d3652a', bar1: '#f1975a', bar2: '#d3652a', prevMix: 45 },
  r1: { label: 'Med-Review R1', init: 'R1', color: '#8460e2', from: '#a184f0', to: '#6f4bd0', bar1: '#a184f0', bar2: '#6f4bd0', prevMix: 45 },
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
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
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
// ── os dias fortes do mês INTEIRO de 2025 (% FIXA) e o plano HORA A HORA do dia clicado ──────────────────────────────────────
const HSP = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }) : null
const horaAgoraSP = () => (HSP ? +HSP.format(new Date()) : new Date().getHours())
const hh = (h: number) => `${h}h`
function Picos({ r, d }: { r: Route; d: YoYData }) {
  const [aberto, setAberto] = useState<number | null>(null)
  const plano = useMemo(() => (aberto === null ? null : buildPlanoDia(d, 'total', aberto)), [d, aberto])
  if (!r.picosMes.length) return null
  const mes = MONTHS_PT[+d.month.slice(5) - 1], mm = d.month.slice(5), n = r.picosMes.length, par = r.picosMes.some(p => p.dayPrev !== p.day)       // dias fortes deste ano que casam com outras datas do ano passado
  return (
    <div className="yy-picos" data-testid="picos-total">
      <div className="yy-picoline">
        <div className="yy-pichead">
          <span className="yy-picolab">{par ? <>★ Dias fortes de {mes}: {d.yearCur} × {d.yearPrev}</> : <>★ Onde {d.yearPrev} concentrou a receita de {mes}</>}</span>
          <small data-testid="picos-soma">{par ? (n === 1 ? 'o dia equivalente' : `os ${n} dias equivalentes`) + ` em ${d.yearPrev}` : (n === 1 ? 'esse dia' : `esses ${n} dias`)} = {fmtShare(r.picosMesShare)} de toda a receita de {mes} de {d.yearPrev}</small>
        </div>
        <div className="yy-picgrid">
          {r.picosMes.map(p => (
            <button key={p.day} type="button" className={`yy-pico${aberto === p.day ? ' on' : ''}`} data-day={p.day} data-quando={p.quando} aria-expanded={aberto === p.day} aria-controls="yy-plano-total"
              title={`${p.dayPrev !== p.day ? `Comparado com ${dd2(p.dayPrev)}/${mm}/${d.yearPrev} (${p.wdPrev}): ` : `Em ${d.yearPrev} o dia ${p.day} `}vendeu ${fmtReais(p.valor)}, ${fmtShare(p.share)} da receita de ${mes} de ${d.yearPrev}. Clique para ver quanto fazer hora a hora.`} onClick={() => setAberto(a => (a === p.day ? null : p.day))}>
              <span className="yy-pl">
                <span className="yy-pl1"><b>{dd2(p.day)}/{mm}</b> {p.wd}{p.quando !== 'vem' && <u>{p.quando === 'hoje' ? 'hoje' : 'já passou'}</u>}</span>
                <span className="yy-pl2">{p.dayPrev !== p.day ? <span className="yy-par" data-k="par">↔ {dd2(p.dayPrev)}/{mm}/{d.yearPrev}</span> : <span className="yy-par">em {d.yearPrev}</span>}</span>
              </span>
              <span className="yy-pr"><b data-k="share">{fmtShare(p.share)}</b><i className="yy-caret" aria-hidden>▾</i></span>
            </button>
          ))}
        </div>
      </div>
      {aberto === null && <p className="yy-picohint">Clique em um dia para ver quanto fazer, hora a hora, para ele pesar o mesmo na nossa meta de {d.yearCur}.</p>}
      {plano && <HourPlan p={plano} d={d} id="yy-plano-total" onClose={() => setAberto(null)} />}
    </div>
  )
}
function HourPlan({ p, d, id, onClose }: { p: PlanoDia; d: YoYData; id: string; onClose: () => void }) {
  const [hover, setHover] = useState<{ h: number; a: Anchor } | null>(null)
  const clear = useCallback(() => setHover(null), []); useDismissOnScroll(clear)
  const [wrapRef, w] = useWidth<HTMLDivElement>()
  const mes = MONTHS_PT[+d.month.slice(5) - 1], mm = d.month.slice(5), meta = p.temMeta
  const val = (x: { alvo: number; prev: number }) => (meta ? x.alvo : x.prev)
  const valores = p.horas.map(val), maxV = Math.max(0, ...valores), sc = useMemo(() => niceScale(maxV), [maxV])
  const acum = useMemo(() => { let a = 0; return p.horas.map(x => (a += val(x))) }, [p, meta])           // sem meta: o acumulado de 2025
  const totalRef = meta ? p.alvoDia : p.valorPrev
  const W = Math.max(w, 660), H = 300, L = 62, R = 70, T = 34, B = 42, pw = W - L - R, ph = H - T - B, bw = pw / 24
  const xc = (h: number) => L + bw * h + bw / 2, yv = (v: number) => T + ph - (sc.top > 0 ? v / sc.top : 0) * ph, yc = (v: number) => T + ph - (totalRef > 0 ? v / totalRef : 0) * ph
  const agora = p.quando === 'hoje' ? horaAgoraSP() : null
  const top3 = useMemo(() => new Set([...p.horas].sort((a, b) => val(b) - val(a) || a.h - b.h).slice(0, 3).filter(x => val(x) > 0).map(x => x.h)), [p, meta])
  const forte = p.horaForte === null ? null : p.horas[p.horaForte]
  // no celular o gráfico é mais largo que a tela: abre já com a hora mais forte à vista (a pessoa ainda pode arrastar; se já arrastou, não mexe)
  useEffect(() => { const el = wrapRef.current; if (!el || !forte || el.scrollWidth <= el.clientWidth || el.scrollLeft > 0) return; el.scrollLeft = Math.max(0, xc(forte.h) - el.clientWidth / 2) }, [p.day, p.key, w, meta])       // eslint-disable-line react-hooks/exhaustive-deps
  const gid = `yy-pg-${id}`, line = p.horas.map((x, i) => `${xc(x.h).toFixed(1)},${yc(acum[i]).toFixed(1)}`).join(' ')
  const quandoTxt = p.quando === 'hoje' ? 'hoje: a faixa marca a hora de agora (Brasília)' : p.quando === 'passou' ? 'este dia já passou: a curva mostra quanto teria sido preciso fazer em cada hora' : 'este dia ainda vem'
  const show = (h: number, el: Element) => { const r = el.getBoundingClientRect(), bh = Math.min(r.height, Math.max(2, (sc.top > 0 ? val(p.horas[h]) / sc.top : 0) * r.height)); setHover({ h, a: { x: r.left, y: r.bottom - bh, w: r.width, h: bh } }) }
  const hv = hover ? p.horas[hover.h] : null
  return (
    <section className="yy-plano" id={id} data-testid="yoy-plano" data-day={p.day} data-modo={meta ? 'meta' : 'prev'} data-quando={p.quando} aria-label={`Quanto fazer hora a hora no dia ${dd2(p.day)}/${mm}`}>
      <header className="yy-plhead">
        <div style={{ minWidth: 0 }}>
          <h4 className="yy-pltitle">{dd2(p.day)}/{mm}: quanto fazer, hora a hora</h4>
          <p className="yy-plsub">{p.wdCur} em {d.yearCur} ({p.dayPrev !== p.day ? <>comparado com {dd2(p.dayPrev)}/{mm}/{d.yearPrev}, {p.wdPrev}</> : <>em {d.yearPrev} foi {p.wdPrev}</>}) · {quandoTxt}</p>
        </div>
        <button type="button" className="yy-plclose" aria-label="Fechar o gráfico hora a hora" onClick={onClose}>×</button>
      </header>
      <div className="yy-plcards">
        <div className="yy-plcard" data-k="peso"><span>{p.dayPrev !== p.day ? `Peso de ${dd2(p.dayPrev)}/${mm}` : 'Peso do dia'} em {d.yearPrev}</span><b>{fmtShare(p.share)}</b><small>{fmtReais(p.valorPrev)} de {fmtReais(p.fechPrev)} (receita de {mes} de {d.yearPrev})</small></div>
        <div className="yy-plcard" data-k="meta"><span>Nossa meta de {mes} de {d.yearCur}</span><b>{meta ? fmtMi(p.meta) : '—'}</b><small>{meta ? 'a meta cadastrada (a geral)' : 'sem meta cadastrada para este mês'}</small></div>
        <div className="yy-plcard yy-plhero" data-k="dia"><span>Meta deste dia</span><b>{meta ? fmtMi(p.alvoDia) : '—'}</b><small>{meta ? `${fmtShare(p.share)} × ${fmtMi(p.meta)} = ${fmtReais(p.alvoDia)}` : 'cadastre a meta do mês para calcular'}</small></div>
        <div className="yy-plcard" data-k="forte"><span>Hora mais forte</span><b>{forte ? `${hh(forte.h)} às ${hh((forte.h + 1) % 24)}` : '—'}</b><small>{forte ? `${fmtReais(val(forte))}${totalRef > 0 ? ` · ${fmtShare(val(forte) / totalRef * 100)} do dia` : ''}` : 'sem detalhe por hora'}</small></div>
      </div>
      {!p.temHoras ? <p className="yy-plvazio" data-testid="plano-sem-horas">Não há detalhe por hora das vendas de {d.yearPrev} neste dia, então não dá para repartir a meta do dia pelas horas.</p> : (
        <>
          {!meta && <p className="yy-plaviso" role="note" data-testid="plano-sem-meta">Sem meta cadastrada para {mes} de {d.yearCur}: as barras mostram como {d.yearPrev} vendeu em cada hora. Cadastre a meta do mês para ver quanto fazer.</p>}
          <div className="yy-legend" aria-hidden>
            <span><i className="yy-sw" style={{ background: 'linear-gradient(180deg,#818cf8,#4f46e5)' }} />{meta ? 'Meta de cada hora' : `Como ${d.yearPrev} vendeu em cada hora`}</span>
            <span><i className="yy-swline" />{meta ? `Acumulado até a hora (termina na meta do dia: ${fmtMi(p.alvoDia)})` : `Acumulado de ${d.yearPrev} (termina em ${fmtMi(p.valorPrev)})`}</span>
          </div>
          <p className="yy-plhint" data-testid="plano-dica">Arraste o gráfico para o lado para ver as outras horas.</p>
          <div className="yy-plscroll" ref={wrapRef} data-testid="plano-chart">
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${meta ? 'Meta' : 'Receita de ' + d.yearPrev} por hora do dia ${dd2(p.day)}/${mm}: ${forte ? `a hora mais forte é ${hh(forte.h)} às ${hh((forte.h + 1) % 24)} com ${fmtReais(val(forte))}` : ''}. Total do dia ${fmtReais(totalRef)}.`}>
              <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#4f46e5" /></linearGradient></defs>
              {sc.ticks.map(t => <g key={t}><line className="yy-gridline" x1={L} x2={W - R} y1={yv(t)} y2={yv(t)} /><text className="yy-axis" x={L - 8} y={yv(t) + 4} textAnchor="end">{fmtAxis(t)}</text></g>)}
              {[0, 0.25, 0.5, 0.75, 1].map(f => <text key={f} className="yy-axis yy-axis-r" x={W - R + 8} y={yc(totalRef * f) + 4}>{f === 1 ? fmtAxis(totalRef) : `${Math.round(f * 100)}%`}</text>)}
              {agora !== null && <rect className="yy-agora" data-testid="plano-agora" x={L + bw * agora} y={T} width={bw} height={ph} />}
              {p.horas.map((x, i) => { const v = valores[i], hgt = sc.top > 0 ? (v / sc.top) * ph : 0; return (
                <g key={x.h}>
                  <rect className={`yy-plbar${top3.has(x.h) ? ' yy-top' : ''}${v <= 0 ? ' yy-zero' : ''}`} data-testid="plano-bar" data-h={x.h} data-v={v} x={L + bw * x.h + bw * 0.16} width={bw * 0.68} y={T + ph - hgt} height={hgt} rx={3} fill={`url(#${gid})`} />
                  <text className={`yy-axis${agora === x.h ? ' yy-axis-today' : ''}`} x={xc(x.h)} y={H - B + 18} textAnchor="middle">{bw >= 28 || x.h % 2 === 0 ? hh(x.h) : ''}</text>
                </g>) })}
              <polyline className="yy-plline" data-testid="plano-linha" points={line} fill="none" />
              {p.horas.map((x, i) => <circle key={x.h} className="yy-pldot" cx={xc(x.h)} cy={yc(acum[i])} r={hover?.h === x.h ? 5 : 2.6} />)}
              {p.horas.map(x => <rect key={x.h} className="yy-plhit" data-testid="plano-hit" data-h={x.h} x={L + bw * x.h} y={T} width={bw} height={ph} fill="transparent" tabIndex={0}
                aria-label={`${hh(x.h)} às ${hh((x.h + 1) % 24)}: ${meta ? 'meta' : 'receita de ' + d.yearPrev} ${fmtReais(val(x))}, acumulado ${fmtReais(acum[x.h])}`}
                onMouseEnter={e => show(x.h, e.currentTarget)} onFocus={e => show(x.h, e.currentTarget)} onBlur={clear} onMouseLeave={clear} />)}
              <text className="yy-axis" x={L} y={T - 14} textAnchor="start">{meta ? 'por hora' : `${d.yearPrev}, por hora`}</text><text className="yy-axis yy-axis-r" x={W - R} y={T - 14} textAnchor="end">acumulado</text>
            </svg>
          </div>
          <details className="yy-pltab" data-testid="plano-tabela">
            <summary>Ver em tabela</summary>
            <div className="yy-plscroll2"><table className="yy-pltable">
              <thead><tr><th scope="col">Hora</th><th scope="col">{meta ? 'Meta da hora' : `Receita de ${d.yearPrev}`}</th><th scope="col">Acumulado</th><th scope="col">% do dia</th>{meta && <th scope="col">Em {d.yearPrev}</th>}<th scope="col">Vendas em {d.yearPrev}</th></tr></thead>
              <tbody>{p.horas.map((x, i) => <tr key={x.h} data-h={x.h}><th scope="row">{hh(x.h)} às {hh((x.h + 1) % 24)}</th><td>{fmtReais(val(x))}</td><td>{fmtReais(acum[i])}</td><td>{fmtShare(totalRef > 0 ? val(x) / totalRef * 100 : 0)}</td>{meta && <td>{fmtReais(x.prev)}</td>}<td>{x.prevN}</td></tr>)}</tbody>
            </table></div>
          </details>
        </>
      )}
      <Tip anchor={hover?.a ?? null}>{hv && (
        <>
          <b>{hh(hv.h)} às {hh((hv.h + 1) % 24)}{agora === hv.h ? ' · agora' : ''}</b>
          <span>{meta ? 'Meta da hora' : `Receita de ${d.yearPrev}`}<em>{fmtReais(val(hv))}</em></span>
          <span>Acumulado até {hh((hv.h + 1) % 24)}<em>{fmtReais(acum[hv.h])}{totalRef > 0 ? ` · ${fmtShare(acum[hv.h] / totalRef * 100)}` : ''}</em></span>
          {meta && <span>Em {d.yearPrev} nessa hora<em>{fmtReais(hv.prev)}</em></span>}
          <span>Vendas em {d.yearPrev}<em>{hv.prevN}</em></span>
        </>
      )}</Tip>
    </section>
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
function DayBars({ s, d, from, to, id, name, peaks, ampliada, pmix = 45 }: { s: Series; d: YoYData; from: string; to: string; id: string; name: string; peaks: Set<number>; ampliada: boolean; pmix?: number }) {
  const [hover, setHover] = useState<{ i: number; a: Anchor } | null>(null)
  const N = s.days.length, sc = useMemo(() => chartScale(s, ampliada), [s, ampliada]), { top, ticks } = sc, cut = useMemo(() => new Set(sc.clipped), [sc]), nivel = useMemo(() => { const m = new Map<number, number>(); let antDia = -99, ant = -1; for (const dia of sc.clipped) { const n = dia - antDia <= 2 ? (ant + 1) % 3 : 0; m.set(dia, n); antDia = dia; ant = n } return m }, [sc]), mes = MONTHS_PT[+d.month.slice(5) - 1]
  const pct = (v: number | null) => (v && v > 0 ? `${Math.min(100, (v / top) * 100)}%` : '0%')
  const h = hover ? s.days[hover.i] : null, m2 = d.month.slice(5), empty = s.max <= 0
  const clear = useCallback(() => setHover(null), []); useDismissOnScroll(clear)
  const show = (i: number, el: HTMLElement) => { const r = el.getBoundingClientRect(), p = s.days[i], frac = Math.min(1, Math.max(p.cur ?? 0, p.prev ?? 0) / top); setHover({ i, a: { x: r.left, y: Math.max(r.top, r.bottom - r.height * frac), w: r.width, h: Math.min(r.height * frac, r.height) } }) }
  return (
    <div data-testid={`chart-${id}`} style={{ ['--yy-c' as any]: from, ['--yy-c2' as any]: to, ['--yy-pmix' as any]: `${pmix}%` }}>
      <div className="yy-legend" aria-hidden>
        <span><i className="yy-sw" style={{ background: `linear-gradient(180deg,${from},${to})` }} />{d.yearCur} · até hoje</span>
        <span><i className="yy-sw yy-sw-prev" />{d.yearPrev} · mês inteiro</span>
        {peaks.size > 0 && <span><i className="yy-starsw">★</i>dia forte que ainda vem</span>}
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
                    {peaks.has(p.day) && !cut.has(p.day) && <i className="yy-star" data-star={p.day} style={{ bottom: `calc(${pct(Math.max(p.prev ?? 0, p.cur ?? 0))} + 6px)` }} title="Dia forte">★</i>}
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
      </Panel>

      <Panel testid="yoy-tabela" icon={CalendarRange} title={`${mes[0].toUpperCase()}${mes.slice(1)} de ${data.yearCur} × ${mes} de ${data.yearPrev}`}
        subtitle={`Acumulado do dia 1 ao dia ${data.dayOfMonth} em cada ano · receita de todas as vendas (novas e recorrentes) · hoje, dia ${data.dayOfMonth}, ainda está em andamento`}
        right={<Chip title="Todos os valores da tabela estão em reais; passe o mouse num valor para ver o número exato">Valores em R$ · mil = milhares · mi = milhões</Chip>}>
        <YoYTable rows={rows} d={data} routes={routes} />
        <p className="yy-foot">Receita só das 4 verticais ativas; “Operação” é a soma delas. As metas vêm do cadastro de metas do mês. Datas como a plataforma registra cada venda (confirmação do pagamento), nos dois anos. A bolinha ao lado do nome é a situação da rota. Passe o mouse no título de uma coluna para ver como ela é calculada.<span className="yy-hint"> Arraste a tabela para o lado para ver todas as colunas.</span></p>
      </Panel>

      <Panel testid="yoy-total" icon={BarChart3} title="Dia a dia — todas as verticais" subtitle={`Receita de cada dia de ${mes}: ${data.yearCur} ao lado de ${data.yearPrev}, na mesma data · ★ = dia forte que ainda vem${algumCorte && ampliada ? ' · ✂ = barra cortada para ampliar os dias menores (o valor está escrito no topo)' : ''}`} right={<div className="yy-rightstack">{algumCorte && <ScaleToggle on={ampliada} set={setAmpliada} />}{total ? <Summary s={total} d={data} /> : null}</div>}>
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
              <DayBars s={per[k]} d={data} from={VC[k].bar1} to={VC[k].bar2} pmix={VC[k].prevMix} id={k} name={VC[k].label} peaks={peaksOf(k)} ampliada={ampliada} />
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
.yy-picoline{display:flex;flex-direction:column;align-items:stretch;gap:12px;margin:0 0 4px;padding:12px 16px;border-radius:14px;background:color-mix(in srgb,#f59e0b 10%,var(--card));border:1px solid color-mix(in srgb,#f59e0b 38%,var(--border))}
.yy-picolab{font-size:13px;font-weight:900;color:var(--foreground)}
.yy-picoline em{font-style:normal;font-size:13px;font-weight:700;padding:4px 10px;border-radius:9px;background:var(--card);border:1px solid color-mix(in srgb,#f59e0b 45%,var(--border));color:var(--foreground);white-space:nowrap}.yy-picoline em b{font-weight:900}
.yy-pichead{display:flex;align-items:baseline;justify-content:space-between;gap:4px 16px;flex-wrap:wrap}
.yy-picoline small{font-size:12.5px;color:var(--yy-mute);font-weight:600}
.yy-picgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.yy-picos{margin:0 0 4px}.yy-picos .yy-picoline{margin-bottom:0}
.yy-pico{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;font:inherit;font-size:13px;font-weight:700;padding:9px 14px;border-radius:12px;background:var(--card);border:1px solid color-mix(in srgb,#f59e0b 45%,var(--border));color:var(--foreground);white-space:nowrap;cursor:pointer;min-height:58px;transition:background .15s,border-color .15s,transform .15s}.yy-pico b{font-weight:900}
.yy-pl{display:flex;flex-direction:column;gap:3px;min-width:0}.yy-pl1{display:flex;align-items:center;gap:8px;font-size:14px}.yy-pl1 b{font-size:15px}.yy-pl2{font-size:12px}
.yy-pr{display:flex;align-items:center;gap:8px;flex:none}.yy-pr b{font-size:17px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.yy-pico:hover{background:color-mix(in srgb,#f59e0b 14%,var(--card));border-color:#f59e0b}.yy-pico:focus-visible{outline:3px solid color-mix(in srgb,${ACCENT} 55%,transparent);outline-offset:2px}
.yy-pico.on{background:linear-gradient(135deg,${BRAND_A},${BRAND_B});border-color:transparent;color:#fff;box-shadow:0 6px 16px -6px rgba(79,70,229,.65)}.yy-pico.on b,.yy-pico.on span{color:#fff}
.yy-pico u{text-decoration:none;font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--foreground) 10%,transparent);color:var(--yy-mute)}.yy-pico.on u{background:rgba(255,255,255,.2);color:#fff}
.yy-caret{font-style:normal;font-size:11px;opacity:.7;transition:transform .2s}.yy-pico.on .yy-caret{transform:rotate(180deg);opacity:1}
.yy-par{font-size:12px;font-weight:700;opacity:.72}.yy-pico.on .yy-par{opacity:.9}
.yy-picohint{margin:8px 4px 0;font-size:12.5px;color:var(--yy-mute);font-weight:600}
.yy-plano{margin-top:12px;padding:20px clamp(12px,2vw,22px) 18px;border-radius:20px;background:linear-gradient(180deg,color-mix(in srgb,${ACCENT} 7%,var(--card)),var(--card));border:1px solid color-mix(in srgb,${ACCENT} 32%,var(--border));box-shadow:0 10px 28px -14px rgba(79,70,229,.45);min-width:0;animation:yy-abre .28s ease both}
@keyframes yy-abre{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.yy-plhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.yy-pltitle{margin:0;font-size:clamp(17px,1.9vw,21px);font-weight:900;letter-spacing:-.02em}.yy-plsub{margin:3px 0 0;font-size:13.5px;color:var(--yy-mute);font-weight:600}
.yy-plclose{flex-shrink:0;width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--card);color:var(--foreground);font-size:22px;line-height:1;cursor:pointer}.yy-plclose:hover{background:color-mix(in srgb,var(--yy-bad) 12%,var(--card))}.yy-plclose:focus-visible{outline:3px solid color-mix(in srgb,${ACCENT} 55%,transparent);outline-offset:2px}
.yy-plcards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
.yy-plcard{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--border);min-width:0}.yy-plcard span{font-size:12px;font-weight:800;color:var(--yy-mute);letter-spacing:.02em}.yy-plcard b{font-size:clamp(20px,2vw,26px);font-weight:900;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1;overflow-wrap:anywhere}.yy-plcard small{font-size:12px;color:var(--yy-mute);font-weight:600;line-height:1.35;overflow-wrap:anywhere}
.yy-plhero{background:linear-gradient(135deg,${BRAND_A},${BRAND_B});border-color:transparent;color:#fff}.yy-plhero span,.yy-plhero small{color:rgba(255,255,255,.85)}.yy-plhero b{color:#fff}
.yy-plaviso{margin:0 0 12px;padding:10px 14px;border-radius:12px;font-size:13.5px;font-weight:700;background:color-mix(in srgb,var(--yy-warn) 13%,var(--card));border:1px solid color-mix(in srgb,var(--yy-warn) 45%,transparent);color:var(--yy-warn-ink)}
.yy-plvazio{margin:0;padding:16px;border-radius:12px;background:var(--secondary);border:1px dashed var(--border);font-size:14px;font-weight:600;color:var(--yy-soft)}
.yy-swline{display:inline-block;width:24px;height:0;border-top:3px solid #f59e0b;border-radius:2px;position:relative}.yy-swline::after{content:'';position:absolute;left:8px;top:-6px;width:8px;height:8px;border-radius:50%;background:#f59e0b}
.yy-plhint{display:none;margin:0 0 6px;font-size:12.5px;color:var(--yy-mute);font-weight:600}
.yy-plscroll{overflow-x:auto;overflow-y:hidden;border-radius:12px;-webkit-overflow-scrolling:touch}.yy-plscroll svg{display:block;max-width:none}
.yy-plbar{opacity:.62;transition:opacity .15s}.yy-plbar.yy-top{opacity:1}.yy-plbar.yy-zero{opacity:0}.yy-plhit:hover,.yy-plhit:focus-visible{fill:color-mix(in srgb,${ACCENT} 14%,transparent);outline:none}
.yy-plhit:hover~.yy-plbar{opacity:1}
.yy-plline{stroke:#f59e0b;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}.yy-pldot{fill:#f59e0b;stroke:var(--card);stroke-width:1.5;pointer-events:none}
.yy-agora{fill:color-mix(in srgb,${ACCENT} 14%,transparent);stroke:${ACCENT};stroke-width:1;stroke-dasharray:3 3}
.yy-axis-r{fill:color-mix(in srgb,#b45309 80%,var(--foreground))}.dark .yy-axis-r{fill:#fbbf24}
.yy-pltab{margin-top:10px}.yy-pltab summary{cursor:pointer;font-size:13.5px;font-weight:800;color:var(--foreground);padding:8px 0;min-height:36px;display:flex;align-items:center}.yy-pltab summary:focus-visible{outline:3px solid color-mix(in srgb,${ACCENT} 55%,transparent);outline-offset:2px;border-radius:8px}
.yy-plscroll2{overflow-x:auto;border:1px solid var(--border);border-radius:12px;max-height:420px;overflow-y:auto}
.yy-pltable{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}.yy-pltable th,.yy-pltable td{padding:8px 12px;text-align:right;white-space:nowrap;border-bottom:1px solid color-mix(in srgb,var(--border) 75%,transparent)}
.yy-pltable thead th{position:sticky;top:0;background:color-mix(in srgb,var(--secondary) 90%,var(--card));font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--yy-mute);z-index:1}.yy-pltable tbody th{text-align:left;font-weight:800}.yy-pltable thead th:first-child{text-align:left}
.yy-plnota{margin:12px 2px 0;font-size:12.5px;line-height:1.5;color:var(--yy-mute);font-weight:500}.yy-plnota b{color:var(--foreground)}
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
.yy-sw-prev,.yy-prev{--yy-p:color-mix(in srgb,var(--yy-c) var(--yy-pmix,45%),#94a3b8);background:color-mix(in srgb,var(--yy-p) 34%,transparent);border:2px solid color-mix(in srgb,var(--yy-p) 95%,transparent);box-sizing:border-box}      /* 2025: a cor da vertical deslocada um pouco para o cinza-azulado, para se distinguir do 2026 vivo */
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
@media(max-width:900px){.yy-plcards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.yy-plhint{display:block}.yy-plcards{gap:8px}.yy-plcard{padding:10px 12px}.yy-pico{min-height:56px}.yy-picgrid{grid-template-columns:1fr}.yy-panel{padding:18px 14px;border-radius:22px}.yy-hero{padding:20px 16px}.yy-card{padding:16px 12px}.yy-title{font-size:19px}.yy-picoline small{margin-left:0}.yy-plot{height:320px}}
@media(max-width:560px){.yy-hero-h{font-size:24px}.yy-hero-day b{font-size:34px}.yy-chip{white-space:normal}.yy-rightstack{justify-content:flex-start}.yy-seg button{padding:7px 10px}}
@media(prefers-reduced-motion:reduce){.yy-bar,.yy-fill,.yy-shimmer,.yy-plano,.yy-plbar,.yy-caret{transition:none;animation:none}}
`
