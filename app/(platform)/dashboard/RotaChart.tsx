'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildRota } from '@/lib/dashboard/projecao'
import { fmtDataBR, fmtReais, metaRadarOf, MONTHS_PT, niceScale, radarOf, serieDe, type YoYData } from '@/lib/dashboard/yoy'
import { wdLabel } from '@/lib/dashboard/projecao'

// ══ Receita acumulada do mês: ano passado × este ano × rota para a meta ═══════════════════════════════════════════════════
// 2026 (linha azul, até o último dia FECHADO) · rota para a meta (tracejado laranja: a curva do ano passado escalada para fechar exatamente na meta)
// · ano passado (cinza, dia da semana com dia da semana) · projeção (pontilhado roxo: de hoje até o fim do mês, na mesma conta do topo do Forecast).
const C26 = '#2f6fd6', CROTA = '#e8743b', CPROJ = '#7c3aed'
const mm = (v: number, d = 2) => `${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}MM`
const mmCurto = (v: number) => { const x = v / 1_000_000; return Number.isInteger(x) ? `${x}MM` : `${x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}MM` }
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const dd = (n: number) => String(n).padStart(2, '0')

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

export function RotaChart({ data }: { data: YoYData }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const s = useMemo(() => serieDe(data, 'total'), [data]), meta = metaRadarOf(data, 'total')
  const r = useMemo(() => buildRota(s, meta, radarOf(data, 'total')), [s, meta, data])
  const mes = MONTHS_PT[+data.month.slice(5) - 1], N = r.N, D = r.D, F = r.ultimoFechado, rd = data.prevDates ?? []
  const temRota = r.fatorRota !== null, semBase = !(r.refTotal > 0)
  const maxV = Math.max(meta, r.refTotal, r.projecao, r.curHoje, 1), sc = useMemo(() => niceScale(maxV * 1.02), [maxV])
  const H = Math.round(Math.min(400, Math.max(280, W * 0.4))), compact = W < 560
  const L = compact ? 40 : 54, R = compact ? 92 : 132, T = 34, B = 40, pw = Math.max(W - L - R, 120), ph = H - T - B
  const x = (day: number) => L + ((day - 1) / Math.max(N - 1, 1)) * pw, y = (v: number) => T + ph - (v / sc.top) * ph
  const linha = (pts: { d: number; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const ptsRef = r.pontos.map(p => ({ d: p.day, v: p.ref })), ptsRota = temRota ? r.pontos.map(p => ({ d: p.day, v: p.rota as number })) : []
  const ptsCur = r.pontos.filter(p => p.cur !== null && p.day <= F).map(p => ({ d: p.day, v: p.cur as number }))
  const cF = F >= 1 ? r.pontos[F - 1] : null, cH = r.pontos[D - 1]
  const ptsHoje = cF && cH.cur !== null ? [{ d: F, v: cF.cur as number }, { d: D, v: cH.cur }] : cH.cur !== null && F < 1 ? [{ d: 1, v: cH.cur }] : []
  const ptsProj = r.pontos.filter(p => p.proj !== null && p.day >= Math.max(F, 1)).map(p => ({ d: p.day, v: p.proj as number }))
  if (cF && ptsProj.length && ptsProj[0].d !== F) ptsProj.unshift({ d: F, v: cF.cur as number })
  const xt = useMemo(() => { const base = [1, 5, 10, 15, 20, 25, N].filter((v, i, a) => v >= 1 && v <= N && a.indexOf(v) === i); const extra = F >= 1 ? [F] : []; return [...base.filter(b => !extra.some(e => Math.abs(e - b) <= (compact ? 2 : 1))), ...extra].sort((a, b) => a - b) }, [N, F, compact])
  // rótulos ao lado dos pontos do último dia fechado (2026 no alto; rota e ano passado embaixo, sem se encostar)
  const lab = (() => {
    if (!cF) return null
    const it = [{ id: 'cur', v: cF.cur as number }, ...(temRota ? [{ id: 'rota', v: cF.rota as number }] : []), { id: 'ref', v: cF.ref }].sort((a, b) => b.v - a.v)
    const out: Record<string, { y: number; above: boolean }> = {}, abaixo: { id: string; y: number }[] = []
    it.forEach((q, i) => { if (i === 0) out[q.id] = { y: y(q.v) - 11, above: true }; else abaixo.push({ id: q.id, y: y(q.v) + 19 }) })
    const p = espalha(abaixo, 17, T, H - B - 4); abaixo.forEach(a => { out[a.id] = { y: p[a.id], above: false } })
    return out
  })()
  const fim = espalha([...(temRota ? [{ id: 'meta', y: y(meta) }] : []), { id: 'ref', y: y(r.refTotal) }, { id: 'proj', y: y(r.projecao) }].map(q => ({ id: q.id, y: q.y + 4 })), 16, T + 6, H - B)
  const hv = hover !== null ? r.pontos[hover - 1] : null
  const onMove = (e: React.MouseEvent<SVGRectElement>) => { const b = e.currentTarget.getBoundingClientRect(), f = (e.clientX - b.left) / b.width; setHover(Math.min(N, Math.max(1, Math.round(f * (N - 1)) + 1))) }
  const tituloRota = temRota ? ` e rota para R$ ${mmCurto(meta)}` : ''
  const resumo = `Receita acumulada em ${mes}: ${data.yearPrev}, ${data.yearCur}${tituloRota}. ${data.yearCur} até ${F >= 1 ? dm(`${data.month}-${dd(F)}`) : 'ontem'}: ${fmtReais(r.curFechado)}${temRota && r.rotaNoFechado !== null ? `; rota no mesmo dia: ${fmtReais(r.rotaNoFechado)}` : ''}; ${data.yearPrev} no mesmo dia: ${fmtReais(r.refNoFechado)}. Projeção de fechamento: ${fmtReais(r.projecao)}.`
  const refDeHoje = rd[D - 1]
  return (
    <section className="ft-card ft-chart" data-testid="rota-chart" aria-label="Receita acumulada do mês">
      <header className="ft-chead">
        <div><h3 className="ft-ctitle">Receita acumulada em {mes}: {data.yearPrev}, {data.yearCur}{tituloRota}</h3>
          <p className="ft-csub">Receita aprovada, em reais, por dia da venda. {data.yearCur} até {F >= 1 ? dm(`${data.month}-${dd(F)}`) : 'ontem'} (dia fechado). {data.yearPrev} comparado dia da semana com dia da semana{rd.length ? ` (${dm(rd[0])} a ${dm(rd[N - 1])}/${rd[N - 1].slice(0, 4)})` : ''}.</p></div>
      </header>
      <div ref={wrap} className="ft-plot" style={{ position: 'relative' }}>
        {semBase ? <p className="ft-empty">O ano passado não tem vendas neste período para servir de régua.</p> : (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumo} style={{ display: 'block', overflow: 'visible' }}>
            {sc.ticks.map(t => (<g key={t}><line x1={L} x2={L + pw} y1={y(t)} y2={y(t)} className="ft-grid" /><text x={L - 8} y={y(t) + 4} textAnchor="end" className="ft-ax">{t === 0 ? '0 MM' : `${(t / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MM`}</text></g>))}
            {xt.map(d => (<text key={d} x={x(d)} y={H - B + 20} textAnchor="middle" className="ft-ax" style={d === F ? { fontWeight: 800, fill: 'var(--foreground)' } : undefined}>{`${dd(d)}/${data.month.slice(5)}`}</text>))}
            {F >= 1 && F < N && (<g><line x1={x(F)} x2={x(F)} y1={T - 6} y2={H - B} className="ft-vline" /><text x={x(F) + 6} y={T - 12} className="ft-ax">último dia fechado</text></g>)}
            <path d={linha(ptsRef)} className="ft-l ft-l-ref" data-line="ref" />
            {temRota && <path d={linha(ptsRota)} className="ft-l ft-l-rota" data-line="rota" stroke={CROTA} strokeDasharray="7 5" />}
            {ptsProj.length > 1 && <path d={linha(ptsProj)} className="ft-l" data-line="proj" stroke={CPROJ} strokeDasharray="2 5" strokeWidth={2.4} strokeLinecap="round" />}
            {ptsCur.length > 0 && <path d={linha(ptsCur)} className="ft-l ft-l-cur" data-line="cur" stroke={C26} />}
            {ptsHoje.length > 1 && <path d={linha(ptsHoje)} className="ft-l" data-line="hoje" stroke={C26} strokeDasharray="3 4" strokeWidth={2.4} opacity={0.7} />}
            {cH.cur !== null && D > F && <circle cx={x(D)} cy={y(cH.cur)} r={4.5} fill="var(--card)" stroke={C26} strokeWidth={2} data-dot="hoje"><title>{`Hoje (${dm(`${data.month}-${dd(D)}`)}), em andamento: ${fmtReais(cH.cur)}`}</title></circle>}
            {cF && (<g>
              <circle cx={x(F)} cy={y(cF.cur as number)} r={5} fill={C26} data-dot="cur" />
              {temRota && <circle cx={x(F)} cy={y(cF.rota as number)} r={5} fill={CROTA} data-dot="rota" />}
              <circle cx={x(F)} cy={y(cF.ref)} r={5} fill="#8b8f98" data-dot="ref" />
              {lab && <>
                <text x={x(F) + (lab.cur.above ? -8 : 10)} y={lab.cur.y} textAnchor={lab.cur.above ? 'end' : 'start'} className="ft-lb ft-lb-strong" fill={C26} data-lab="cur">{`${data.yearCur}: R$ ${mm(cF.cur as number)}`}</text>
                {temRota && <text x={x(F) + (lab.rota.above ? -8 : 10)} y={lab.rota.y} textAnchor={lab.rota.above ? 'end' : 'start'} className="ft-lb" data-lab="rota">{`rota: R$ ${mm(cF.rota as number)}`}</text>}
                <text x={x(F) + (lab.ref.above ? -8 : 10)} y={lab.ref.y} textAnchor={lab.ref.above ? 'end' : 'start'} className="ft-lb" data-lab="ref">{`${data.yearPrev}: R$ ${mm(cF.ref)}`}</text>
              </>}
            </g>)}
            <g className="ft-lb">
              {temRota && <text x={x(N) + 9} y={fim.meta} data-end="meta">{`Meta R$ ${mm(meta)}`}</text>}
              <text x={x(N) + 9} y={fim.ref} data-end="ref">{`${data.yearPrev} R$ ${mm(r.refTotal)}`}</text>
              <text x={x(N) + 9} y={fim.proj} fill={CPROJ} className="ft-lb-strong" data-end="proj">{`Projeção R$ ${mm(r.projecao)}`}</text>
            </g>
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="ft-hline" />}
            <rect x={L} y={T} width={pw} height={ph} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} data-testid="rota-hover" />
          </svg>
        )}
        {hv && !semBase && (() => {
          const left = Math.min(Math.max(x(hv.day) + 14, 8), Math.max(W - 232, 8)), dif = temRota && hv.cur !== null && hv.rota !== null ? hv.cur - hv.rota : null
          const dt = `${data.month}-${dd(hv.day)}`, rf = rd[hv.day - 1]
          return (
            <div className="ft-tip" role="status" data-testid="rota-tip" style={{ left, top: 8 }}>
              <b>{dm(dt)} · {wdLabel(dt)}{hv.day === D ? ' · hoje (em andamento)' : ''}</b>
              <span><i style={{ background: C26 }} />{data.yearCur}<em>{hv.cur === null ? 'ainda não chegou' : fmtReais(hv.cur)}</em></span>
              {temRota && <span><i style={{ background: CROTA }} />Rota<em>{fmtReais(hv.rota as number)}</em></span>}
              <span><i style={{ background: '#8b8f98' }} />{rf ? `${fmtDataBR(rf)} (${wdLabel(rf)})` : data.yearPrev}<em>{fmtReais(hv.ref)}</em></span>
              {hv.proj !== null && hv.day > F && <span><i style={{ background: CPROJ }} />Projeção<em>{fmtReais(hv.proj)}</em></span>}
              {dif !== null && <span className={dif >= 0 ? 'ft-up' : 'ft-down'}>{dif >= 0 ? '▲' : '▼'} {fmtReais(Math.abs(dif))} {dif >= 0 ? 'à frente' : 'atrás'} da rota</span>}
            </div>
          )
        })()}
      </div>
      <div className="ft-legend" aria-hidden>
        <span><i className="ft-sw" style={{ background: C26 }} />{data.yearCur} realizado</span>
        {temRota && <span><i className="ft-sw ft-sw-dash" style={{ ['--c' as any]: CROTA }} />Rota para R$ {mmCurto(meta)} (a meta planejada do Radar)</span>}
        <span><i className="ft-sw" style={{ background: '#8b8f98' }} />{data.yearPrev} realizado</span>
        <span><i className="ft-sw ft-sw-dot" style={{ ['--c' as any]: CPROJ }} />Projeção de fechamento</span>
      </div>
      {refDeHoje && <span className="ft-sr">Hoje, {dm(`${data.month}-${dd(D)}`)}, corresponde a {fmtDataBR(refDeHoje)} em {data.yearPrev}.</span>}
    </section>
  )
}
