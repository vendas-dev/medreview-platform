'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildRota, wdLabel } from '@/lib/dashboard/projecao'
import { fmtDataBR, fmtMi, fmtReais, metaRadarOf, MONTHS_PT, niceScale, radarOf, serieDe, type YoYData } from '@/lib/dashboard/yoy'

// ══ Receita acumulada do mês: ano passado × este ano × rota para a meta ═══════════════════════════════════════════════════
// 2026 (azul, até o último dia FECHADO) · rota para a meta (laranja tracejado) · ano passado (cinza, dia da semana com dia da semana)
// Os 3 cartões de cima são também a legenda: passar o mouse num deles destaca a linha.
const C26 = '#3b82f6', CROTA = '#f97316', CREF = '#94a3b8'
type Foco = 'cur' | 'rota' | 'ref' | null
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const dd = (n: number) => String(n).padStart(2, '0')
const mi = (v: number) => fmtMi(v).replace('R$ ', '')
const sgnMi = (v: number) => `${v >= 0 ? '+' : '−'}${fmtMi(Math.abs(v))}`
const sgnPct = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(p).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

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
/** Empurra rótulos que ficariam um em cima do outro (mantém a ordem vertical e uma distância mínima). */
function espalha(itens: { id: string; y: number }[], min: number, topo: number, base: number): Record<string, number> {
  const o = [...itens].sort((a, b) => a.y - b.y), out: Record<string, number> = {}
  let ant = topo - min
  for (const it of o) { const y = Math.max(it.y, ant + min); out[it.id] = y; ant = y }
  const ult = o[o.length - 1]; if (ult && out[ult.id] > base) { let lim = base; for (let i = o.length - 1; i >= 0; i--) { out[o[i].id] = Math.min(out[o[i].id], lim); lim = out[o[i].id] - min } }
  return out
}

function Kpi({ k, cor, estilo, titulo, valor, sub, chip, bom, foco, setFoco }: { foco: Foco; setFoco: (f: Foco) => void; k: Exclude<Foco, null>; cor: string; estilo: 'solid' | 'dash' | 'dot'; titulo: string; valor: string; sub: string; chip?: string | null; bom?: boolean }) {
  return (
    <div className={`rc-kpi${foco === k ? ' on' : ''}`} style={{ ['--c' as string]: cor }} onPointerEnter={() => setFoco(k)} onPointerLeave={() => setFoco(null)} data-kpi={k} tabIndex={0} onFocus={() => setFoco(k)} onBlur={() => setFoco(null)}>
    <div className="rc-kh"><i className={`rc-sw ${estilo}`} /><span>{titulo}</span></div>
    <b className="rc-kv">{valor}</b>
    <div className="rc-kf"><span>{sub}</span>{chip ? <em className={bom === undefined ? 'neu' : bom ? 'up' : 'down'}>{chip}</em> : null}</div>
    </div>
  )
}

export function RotaChart({ data }: { data: YoYData }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null), [foco, setFoco] = useState<Foco>(null)
  const s = useMemo(() => serieDe(data, 'total'), [data]), meta = metaRadarOf(data, 'total')
  const r = useMemo(() => buildRota(s, meta, radarOf(data, 'total')), [s, meta, data])
  const mes = MONTHS_PT[+data.month.slice(5) - 1], N = r.N, D = r.D, F = r.ultimoFechado, rd = data.prevDates ?? []
  const temRota = r.fatorRota !== null, semBase = !(r.refTotal > 0)
  const maxV = Math.max(meta, r.refTotal, r.curHoje, 1), sc = useMemo(() => niceScale(maxV * 1.04), [maxV])
  const compact = W < 560, H = Math.round(Math.min(440, Math.max(300, W * 0.42)))
  const L = compact ? 40 : 50, R = compact ? 56 : 96, T = 30, B = 34, pw = Math.max(W - L - R, 120), ph = H - T - B
  const x = (day: number) => L + ((day - 1) / Math.max(N - 1, 1)) * pw, y = (v: number) => T + ph - (v / sc.top) * ph
  const linha = (pts: { d: number; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const ptsRef = r.pontos.map(p => ({ d: p.day, v: p.ref })), ptsRota = temRota ? r.pontos.map(p => ({ d: p.day, v: p.rota as number })) : []
  const ptsCur = r.pontos.filter(p => p.cur !== null && p.day <= F).map(p => ({ d: p.day, v: p.cur as number }))
  const cF = F >= 1 ? r.pontos[F - 1] : null, cH = r.pontos[D - 1]
  const ptsHoje = cF && cH.cur !== null ? [{ d: F, v: cF.cur as number }, { d: D, v: cH.cur }] : cH.cur !== null && F < 1 ? [{ d: 1, v: cH.cur }] : []
  const area = ptsCur.length > 1 ? `${linha(ptsCur)} L${x(ptsCur[ptsCur.length - 1].d).toFixed(1)},${y(0).toFixed(1)} L${x(ptsCur[0].d).toFixed(1)},${y(0).toFixed(1)} Z` : ''
  const xt = useMemo(() => { const base = [1, 5, 10, 15, 20, 25, N].filter((v, i, a) => v >= 1 && v <= N && a.indexOf(v) === i); const extra = F >= 1 ? [F] : []; return [...base.filter(b => !extra.some(e => Math.abs(e - b) <= (compact ? 2 : 1))), ...extra].sort((a, b) => a - b) }, [N, F, compact])
  // valores no fim do mês (à direita): meta e ano passado, sem se encostar
  const fim = espalha([...(temRota ? [{ id: 'meta', y: y(meta) }] : []), { id: 'ref', y: y(r.refTotal) }], 20, T + 8, H - B - 2)
  const hv = hover !== null ? r.pontos[hover - 1] : null
  const onMove = (e: React.PointerEvent<SVGRectElement>) => { const b = e.currentTarget.getBoundingClientRect(), f = (e.clientX - b.left) / b.width; setHover(Math.min(N, Math.max(1, Math.round(f * (N - 1)) + 1))) }
  const op = (k: Exclude<Foco, null>) => (foco === null || foco === k ? 1 : 0.18)
  const nomeFech = F >= 1 ? dm(`${data.month}-${dd(F)}`) : 'ontem'
  const difRota = temRota && cF && cF.rota !== null ? (cF.cur as number) - cF.rota : null
  const difRef = cF && cF.ref > 0 ? ((cF.cur as number) / cF.ref - 1) * 100 : null
  const tituloRota = temRota ? ` e rota para ${fmtMi(meta)}` : ''
  const resumo = `Receita acumulada em ${mes}: ${data.yearPrev}, ${data.yearCur}${tituloRota}. ${data.yearCur} até ${nomeFech}: ${fmtReais(r.curFechado)}${temRota && r.rotaNoFechado !== null ? `; rota no mesmo dia: ${fmtReais(r.rotaNoFechado)}` : ''}; ${data.yearPrev} no mesmo dia: ${fmtReais(r.refNoFechado)}..`
  const refDeHoje = rd[D - 1]
  return (
    <section className="rc" data-testid="rota-chart" aria-label="Receita acumulada do mês">
      <style>{RC_CSS}</style>
      <header className="rc-head">
        <h3 className="rc-title">Receita acumulada em {mes}</h3>
        <p className="rc-sub">{data.yearCur} até {nomeFech} (dia fechado) · {data.yearPrev} comparado dia da semana com dia da semana{rd.length ? ` (${dm(rd[0])} a ${dm(rd[N - 1])}/${rd[N - 1].slice(0, 4)})` : ''} · receita aprovada, por dia da venda</p>
      </header>
      {!semBase && cF && (
        <div className="rc-kpis">
          <Kpi foco={foco} setFoco={setFoco} k="cur" cor={C26} estilo="solid" titulo={`${data.yearCur} até ${nomeFech}`} valor={fmtMi(cF.cur as number)} sub={difRef !== null ? `${sgnPct(difRef)} vs ${data.yearPrev}` : `${data.yearPrev}: ${fmtMi(cF.ref)}`} chip={difRota !== null ? `${sgnMi(difRota)} ${difRota >= 0 ? 'à frente' : 'atrás'} da rota` : null} bom={difRota !== null ? difRota >= 0 : undefined} />
          {temRota && cF.rota !== null && <Kpi foco={foco} setFoco={setFoco} k="rota" cor={CROTA} estilo="dash" titulo="Rota (meta do Radar)" valor={fmtMi(cF.rota)} sub={`no mesmo dia · fecha em ${fmtMi(meta)}`} />}
          <Kpi foco={foco} setFoco={setFoco} k="ref" cor={CREF} estilo="solid" titulo={`${data.yearPrev} no mesmo dia`} valor={fmtMi(cF.ref)} sub={`fechou o mês em ${fmtMi(r.refTotal)}`} />
        </div>
      )}
      <div ref={wrap} className="rc-plot">
        {semBase ? <p className="rc-empty">O ano passado não tem vendas neste período para servir de régua.</p> : (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumo} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="rc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C26} stopOpacity=".28" /><stop offset="100%" stopColor={C26} stopOpacity="0" /></linearGradient>
            </defs>
            {F >= 1 && F < N && <rect x={x(F)} y={T - 8} width={Math.max(x(N) - x(F), 0)} height={ph + 8} rx={8} className="rc-fut" />}
            {sc.ticks.map(t => (<g key={t}><line x1={L} x2={L + pw} y1={y(t)} y2={y(t)} className="rc-grid" /><text x={L - 10} y={y(t) + 4} textAnchor="end" className="rc-ax">{t === 0 ? '0' : `${(t / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`}</text></g>))}
            {xt.map(d => (<text key={d} x={x(d)} y={H - B + 22} textAnchor="middle" className={`rc-ax${d === F ? ' rc-axb' : ''}`}>{`${dd(d)}/${data.month.slice(5)}`}</text>))}
            {F >= 1 && F < N && (<g><line x1={x(F)} x2={x(F)} y1={T - 8} y2={H - B} className="rc-vline" /><text x={x(F) + 8} y={T + 4} className="rc-tag">dias restantes</text></g>)}
            {area && <path d={area} fill="url(#rc-area)" style={{ opacity: foco === null || foco === 'cur' ? 1 : 0.2, transition: 'opacity .2s' }} />}
            <path d={linha(ptsRef)} className="rc-l" stroke={CREF} strokeWidth={2.4} data-line="ref" style={{ opacity: op('ref') }} />
            {temRota && <path d={linha(ptsRota)} className="rc-l" stroke={CROTA} strokeWidth={2.4} strokeDasharray="7 6" data-line="rota" style={{ opacity: op('rota') }} />}
            {ptsCur.length > 0 && <path d={linha(ptsCur)} className="rc-l" stroke={C26} strokeWidth={3.4} data-line="cur" style={{ opacity: op('cur') }} />}
            {ptsHoje.length > 1 && <path d={linha(ptsHoje)} className="rc-l" stroke={C26} strokeWidth={2.6} strokeDasharray="2 5" data-line="hoje" style={{ opacity: op('cur') * 0.8 }} />}
            {cH.cur !== null && D > F && <circle cx={x(D)} cy={y(cH.cur)} r={5} className="rc-dot-hoje" stroke={C26} data-dot="hoje"><title>{`Hoje (${dm(`${data.month}-${dd(D)}`)}), em andamento: ${fmtReais(cH.cur)}`}</title></circle>}
            {cF && (<g>
              {temRota && cF.rota !== null && <circle cx={x(F)} cy={y(cF.rota)} r={5.5} fill={CROTA} className="rc-dot" data-dot="rota" />}
              <circle cx={x(F)} cy={y(cF.ref)} r={5.5} fill={CREF} className="rc-dot" data-dot="ref" />
              <circle cx={x(F)} cy={y(cF.cur as number)} r={6.5} fill={C26} className="rc-dot" data-dot="cur" />
            </g>)}
            <g>
              {temRota && <g transform={`translate(${x(N) + 10},${fim.meta})`} data-end="meta"><circle cx={0} cy={0} r={3.5} fill={CROTA} /><text x={10} y={4} className="rc-end">{!compact && <><tspan className="rc-endk">meta</tspan>{' '}</>}{mi(meta)}</text></g>}
              <g transform={`translate(${x(N) + 10},${fim.ref})`} data-end="ref"><circle cx={0} cy={0} r={3.5} fill={CREF} /><text x={10} y={4} className="rc-end">{!compact && <><tspan className="rc-endk">{data.yearPrev}</tspan>{' '}</>}{mi(r.refTotal)}</text></g>
            </g>
            {hv && <g>
              <line x1={x(hv.day)} x2={x(hv.day)} y1={T - 8} y2={H - B} className="rc-hline" />
              {hv.cur !== null && hv.day <= Math.max(F, D) && <circle cx={x(hv.day)} cy={y(hv.cur)} r={5} fill={C26} className="rc-dot" />}
              {temRota && hv.rota !== null && <circle cx={x(hv.day)} cy={y(hv.rota)} r={4.5} fill={CROTA} className="rc-dot" />}
              <circle cx={x(hv.day)} cy={y(hv.ref)} r={4.5} fill={CREF} className="rc-dot" />
            </g>}
            <rect x={L} y={T - 8} width={pw} height={ph + 8} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} data-testid="rota-hover" />
          </svg>
        )}
        {hv && !semBase && (() => {
          const TW = 262, px = x(hv.day), left = px + 18 + TW > W ? Math.max(px - 18 - TW, 4) : px + 18
          const dt = `${data.month}-${dd(hv.day)}`, rf = rd[hv.day - 1]
          const dRota = temRota && hv.cur !== null && hv.rota !== null ? hv.cur - hv.rota : null
          const dRef = hv.cur !== null && hv.ref > 0 ? (hv.cur / hv.ref - 1) * 100 : null
          return (
            <div className="rc-tip" role="status" data-testid="rota-tip" style={{ left, top: 4, width: TW }}>
              <div className="rc-th"><b>{wdLabel(dt)}, {dm(dt)}</b>{hv.day === D ? <u>hoje · em andamento</u> : hv.day <= F ? <u className="f">fechado</u> : <u className="p">previsto</u>}</div>
              <div className="rc-tr"><i style={{ background: C26 }} /><s>{data.yearCur}</s><b>{hv.cur === null ? 'ainda não chegou' : fmtReais(hv.cur)}</b></div>
              {temRota && hv.rota !== null && <div className="rc-tr"><i style={{ background: CROTA }} /><s>Rota</s><b>{fmtReais(hv.rota)}</b></div>}
              <div className="rc-tr"><i style={{ background: CREF }} /><s>{rf ? `${fmtDataBR(rf)} · ${wdLabel(rf)}` : data.yearPrev}</s><b>{fmtReais(hv.ref)}</b></div>
              {(dRota !== null || dRef !== null) && <div className="rc-td">
                {dRota !== null && <span className={dRota >= 0 ? 'up' : 'down'}>{dRota >= 0 ? '▲' : '▼'} {fmtMi(Math.abs(dRota))} {dRota >= 0 ? 'à frente' : 'atrás'} da rota</span>}
                {dRef !== null && <span className={dRef >= 0 ? 'up' : 'down'}>{dRef >= 0 ? '▲' : '▼'} {Math.abs(dRef).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% {dRef >= 0 ? 'acima' : 'abaixo'} de {data.yearPrev}</span>}
              </div>}
            </div>
          )
        })()}
      </div>
      {refDeHoje && <span className="rc-sr">Hoje, {dm(`${data.month}-${dd(D)}`)}, corresponde a {fmtDataBR(refDeHoje)} em {data.yearPrev}.</span>}
    </section>
  )
}

const RC_CSS = `
.rc{--rc-good:#16a34a;--rc-bad:#e11d48;background:var(--card);border:1px solid var(--border);border-radius:24px;padding:clamp(16px,2.2vw,26px);box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 32px rgba(15,23,42,.06);color:var(--foreground);min-width:0;margin-bottom:14px;font-feature-settings:"tnum" 1,"cv11" 1}
.dark .rc{--rc-good:#4ade80;--rc-bad:#fb7185;box-shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px rgba(0,0,0,.3)}
.rc-title{margin:0;font-size:clamp(18px,2.2vw,24px);font-weight:900;letter-spacing:-.025em;line-height:1.15}
.rc-sub{margin:6px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted-foreground);max-width:980px}
.rc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:16px 0 8px}
.rc-kpi{--c:#888;position:relative;display:flex;flex-direction:column;gap:5px;padding:12px 14px 12px;border-radius:16px;border:1px solid var(--border);background:color-mix(in srgb,var(--c) 5%,var(--card));cursor:default;outline:none;transition:transform .18s,border-color .18s,box-shadow .18s,background .18s;overflow:hidden}
.rc-kpi::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--c)}
.rc-kpi:hover,.rc-kpi.on,.rc-kpi:focus-visible{transform:translateY(-2px);border-color:color-mix(in srgb,var(--c) 55%,var(--border));background:color-mix(in srgb,var(--c) 10%,var(--card));box-shadow:0 8px 22px color-mix(in srgb,var(--c) 18%,transparent)}
.rc-kh{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:var(--muted-foreground);letter-spacing:.01em}
.rc-sw{display:inline-block;width:22px;height:0;border-top:3px solid var(--c);border-radius:3px;flex:none}.rc-sw.dash{border-top-style:dashed}.rc-sw.dot{border-top-style:dotted}
.rc-kv{font-size:clamp(20px,2.1vw,26px);font-weight:900;letter-spacing:-.025em;line-height:1.1;font-variant-numeric:tabular-nums}
.rc-kf{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:11.5px;color:var(--muted-foreground)}
.rc-kf em{font-style:normal;font-weight:800;padding:2px 8px;border-radius:99px;font-size:11px}
.rc-kf em.up,.rc-td .up{color:var(--rc-good)}.rc-kf em.down,.rc-td .down{color:var(--rc-bad)}
.rc-kf em.up{background:color-mix(in srgb,var(--rc-good) 14%,transparent)}.rc-kf em.down{background:color-mix(in srgb,var(--rc-bad) 13%,transparent)}
.rc-plot{position:relative;width:100%;min-height:200px;margin-top:6px}
.rc-grid{stroke:color-mix(in srgb,var(--foreground) 9%,transparent);stroke-width:1;stroke-dasharray:3 5}
.rc-ax{font-size:11.5px;font-weight:600;fill:var(--muted-foreground);font-variant-numeric:tabular-nums}.rc-axb{fill:var(--foreground);font-weight:800}
.rc-fut{fill:color-mix(in srgb,#8b5cf6 6%,transparent)}
.rc-vline{stroke:var(--muted-foreground);stroke-width:1;stroke-dasharray:3 4;opacity:.55}
.rc-tag{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;fill:#8b5cf6;opacity:.85}
.rc-l{fill:none;stroke-linejoin:round;stroke-linecap:round;transition:opacity .2s}
.rc-dot{stroke:var(--card);stroke-width:2.5;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35))}
.rc-dot-hoje{fill:var(--card);stroke-width:2.5}
.rc-hline{stroke:var(--foreground);stroke-width:1;opacity:.22}
.rc-end{font-size:12.5px;font-weight:700;fill:var(--foreground);font-variant-numeric:tabular-nums}.rc-endk{font-weight:600;fill:var(--muted-foreground);font-size:11px}
.rc-empty{margin:40px 0;text-align:center;color:var(--muted-foreground);font-size:13px}
.rc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.rc-tip{position:absolute;z-index:6;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(10px);border:1px solid var(--border);box-shadow:0 16px 40px rgba(15,23,42,.22);font-size:12.5px;pointer-events:none;display:flex;flex-direction:column;gap:7px;animation:rcIn .14s ease-out}
@keyframes rcIn{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}
.rc-th{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:7px;border-bottom:1px solid var(--border)}.rc-th b{font-size:13.5px;font-weight:900;text-transform:capitalize}
.rc-th u{text-decoration:none;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;background:color-mix(in srgb,#3b82f6 16%,transparent);color:#3b82f6}.rc-th u.f{background:var(--secondary);color:var(--muted-foreground)}.rc-th u.p{background:color-mix(in srgb,#8b5cf6 16%,transparent);color:#8b5cf6}
.rc-tr{display:flex;align-items:center;gap:8px}.rc-tr i{width:10px;height:10px;border-radius:4px;flex:none}.rc-tr s{text-decoration:none;color:var(--muted-foreground);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rc-tr b{margin-left:auto;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
.rc-td{display:flex;flex-direction:column;gap:4px;margin-top:2px;padding-top:8px;border-top:1px solid var(--border);font-size:12px;font-weight:800}
@media (max-width:560px){.rc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.rc-end{font-size:11px}}
@media (prefers-reduced-motion:reduce){.rc-kpi,.rc-l,.rc-tip{transition:none;animation:none}}
`
