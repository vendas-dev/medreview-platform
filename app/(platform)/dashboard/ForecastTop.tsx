'use client'
import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { fmtMi, fmtReais, MONTHS_PT, metaOf, projecaoOf, VKEYS, VLABEL, type VKey, type YoYData } from '@/lib/dashboard/yoy'

// ══ Topo do Forecast: UM número (a projeção de fechamento), os três que o explicam e a barra da meta ═══════════════════════
// Tudo sai de lib/dashboard/projecao.ts — a mesma conta da tabela, da rota, do Radar Diário, do KPI de Vendas e da página inicial.
const VC: Record<VKey, { init: string; from: string; to: string; color: string }> = {
  anest: { init: 'AN', from: '#6f95f0', to: '#3f69d4', color: '#4f7be8' },
  oft: { init: 'OF', from: '#efbd3f', to: '#c58d0c', color: '#dba21a' },
  ortop: { init: 'OR', from: '#f1975a', to: '#d3652a', color: '#e67a38' },
  r1: { init: 'R1', from: '#a184f0', to: '#6f4bd0', color: '#8460e2' },
}
const ORDER: VKey[] = ['anest', 'oft', 'ortop', 'r1']
type Tom = 'good' | 'warn' | 'bad' | 'none'
/** A mesma régua de cor do KPI de Vendas: projeção ≥ 100% da meta = verde · 80 a 99% = âmbar · abaixo de 80% = vermelho. */
export const tomDe = (pct: number | null): Tom => (pct === null ? 'none' : pct >= 100 ? 'good' : pct >= 80 ? 'warn' : 'bad')
const pct0 = (v: number) => `${Math.round(v)}%`
const sg = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v))}%`

function Big({ v }: { v: number }) {
  const t = fmtMi(v), m = /^(−?)R\$ ([\d.,]+)(?: (mil|mi))?$/.exec(t)
  if (!m) return <>{t}</>
  return <>{m[1]}<small className="ft-cur">R$</small> {m[2]}{m[3] && <> <small className="ft-unit">{m[3]}</small></>}</>
}
function Live({ updatedAt, error }: { updatedAt: number | null; error: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const secs = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null, stale = error || (secs !== null && secs > 90)
  return <span className={`ft-live${stale ? ' ft-stale' : ''}`}><i />{stale ? 'RECONECTANDO' : 'AO VIVO'}{secs !== null && !stale && <em>· há {secs}s</em>}</span>
}

export function ForecastTop({ data, updatedAt, error, recorrencia, links }: { data: YoYData | null; updatedAt: number | null; error: boolean; recorrencia: number; links: { value: number; count: number } | null }) {
  if (!data) return <div className="ft-hero ft-skel" data-testid="ft-loading" aria-busy="true"><div className="ft-shim" style={{ height: 210 }} /></div>
  const p = projecaoOf(data, 'total'), mes = MONTHS_PT[+data.month.slice(5) - 1], N = data.daysInMonth.cur, D = data.dayOfMonth
  const tom = tomDe(p.pctVsMeta), temMeta = p.meta > 0
  const escala = Math.max(p.meta, p.projecao, p.realizado, 1) * 1.04, at = (v: number) => `${Math.min(100, Math.max(0, v / escala * 100))}%`
  const diff = temMeta ? (p.pctVsMeta as number) - 100 : 0
  const ritmoTxt = p.fonte === 'dias' ? `vs ${data.yearPrev}, nos ${p.diasFechados} ${p.diasFechados === 1 ? 'dia fechado' : 'dias fechados'}` : p.fonte === 'meta' ? 'dia 1: seguindo a meta' : p.fonte === 'igual' ? `igual a ${data.yearPrev} (sem meta)` : `sem base de ${data.yearPrev}: ritmo linear`
  const cobre = p.resto > 0 ? Math.round(((recorrencia + (links?.value ?? 0)) / p.resto) * 100) : 0
  return (
    <section className="ft-hero" data-testid="forecast-top" data-tom={tom}>
      <div className="ft-dots" aria-hidden />
      <header className="ft-hhead">
        <div className="ft-eyebrow"><span className="ft-ico"><TrendingUp size={17} /></span><b>Forecast</b><span className="ft-dim">{mes} de {data.yearCur} · dia {D} de {N}</span></div>
        <Live updatedAt={updatedAt} error={error} />
      </header>
      <div className="ft-main">
        <div className="ft-proj">
          <span className="ft-lab">Projeção de fechamento</span>
          <b className="ft-big" data-testid="ft-projecao" title={fmtReais(p.projecao)}><Big v={p.projecao} /></b>
          {temMeta ? <span className={`ft-pill ft-${tom}`} data-testid="ft-pill">{diff >= 0 ? '▲' : '▼'} {pct0(Math.abs(diff))} {diff >= 0 ? 'acima' : 'abaixo'} da meta</span> : <span className="ft-pill ft-none">sem meta cadastrada</span>}
        </div>
        <div className="ft-stats">
          <div className="ft-stat" title={fmtReais(p.realizado)}><span>Realizado</span><b><Big v={p.realizado} /></b><small>{temMeta ? `${pct0(p.realizado / p.meta * 100)} da meta` : 'até hoje'}</small></div>
          <div className="ft-stat" title={temMeta ? fmtReais(p.meta) : 'Cadastre a meta do mês'}><span>Meta do mês</span><b>{temMeta ? <Big v={p.meta} /> : '—'}</b><small>{temMeta ? (p.faltaPraMeta > 0 ? `faltam ${fmtMi(p.faltaPraMeta)}` : 'batida') : 'não cadastrada'}</small></div>
          <div className="ft-stat" data-testid="ft-ritmo" title="O que vendemos nos dias fechados ÷ o que o ano passado vendeu nos mesmos dias"><span>Ritmo</span><b className={p.ritmo >= 1 ? 'ft-upc' : 'ft-downc'}>{p.fonte === 'dias' ? sg((p.ritmo - 1) * 100) : '—'}</b><small>{ritmoTxt}</small></div>
        </div>
      </div>
      <div className="ft-track" data-testid="ft-track" role="img" aria-label={`Realizado ${fmtReais(p.realizado)}${temMeta ? `, meta ${fmtReais(p.meta)}` : ''}, projeção ${fmtReais(p.projecao)}`}>
        <div className="ft-rail">
          <div className="ft-projfill" style={{ width: at(p.projecao) }} />
          <div className="ft-realfill" style={{ width: at(p.realizado) }} />
        </div>
        {temMeta && <i className="ft-mark ft-mark-meta" style={{ left: at(p.meta) }}><span>Meta</span></i>}
        <i className="ft-mark ft-mark-proj" style={{ left: at(p.projecao) }}><span>Projeção</span></i>
      </div>
      <p className="ft-foot">
        {temMeta
          ? (p.faltaPraMeta > 0
            ? <>Faltam <b>{fmtMi(p.faltaPraMeta)}</b> para a meta{p.precisaDia !== null ? <> · <b>{fmtMi(p.precisaDia)}</b> por dia nos {p.diasRestantes} {p.diasRestantes === 1 ? 'dia' : 'dias'} que restam</> : null}</>
            : <>Meta batida: <b>{fmtMi(p.realizado - p.meta)}</b> acima. Tudo daqui para frente é ganho.</>)
          : <>Cadastre a meta do mês para ver quanto falta e quanto vender por dia.</>}
      </p>
      {(recorrencia > 0 || (links?.value ?? 0) > 0) && p.resto > 0 && (
        <div className="ft-chips" data-testid="ft-cobertura">
          <span className="ft-chip" title="Parcelas de assinaturas que ainda devem cair até o fim do mês"><b>{fmtMi(recorrencia)}</b> recorrência a receber</span>
          {links && <span className="ft-chip" title={`${links.count} ${links.count === 1 ? 'link válido' : 'links válidos'}, não pagos e não vencidos`}><b>{fmtMi(links.value)}</b> em links abertos</span>}
          <span className="ft-chipnote">já cobrem {Math.min(cobre, 999)}% do que ainda se espera vender ({fmtMi(p.resto)})</span>
        </div>
      )}
      <details className="ft-how">
        <summary>Como a projeção é calculada</summary>
        <p>Realizado até hoje + o resto do mês seguindo a forma de {data.yearPrev} (cada dia comparado com o mesmo dia da semana), no ritmo atual: o que vendemos nos dias fechados ÷ o que {data.yearPrev} vendeu nesses mesmos dias. Hoje, que ainda está em andamento, vale o maior entre o que já vendemos e o que o ritmo esperava. É a mesma conta da tabela, do Radar Diário, da página inicial e do KPI de Vendas. Recorrência e links em aberto não são somados: já fazem parte do que o ano passado também vendeu.</p>
      </details>
    </section>
  )
}

/** Uma carta por vertical: projeção, a barra da meta e a cor do KPI. */
export function VerticaisProjecao({ data }: { data: YoYData | null }) {
  if (!data) return <div className="ft-vgrid" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="ft-shim" style={{ height: 150 }} />)}</div>
  return (
    <div className="ft-vgrid" data-testid="ft-verticais">
      {ORDER.filter(k => VKEYS.includes(k)).map(k => {
        const p = projecaoOf(data, k), tom = tomDe(p.pctVsMeta), c = VC[k], temMeta = p.meta > 0
        const escala = Math.max(p.meta, p.projecao, p.realizado, 1) * 1.04, at = (v: number) => `${Math.min(100, Math.max(0, v / escala * 100))}%`
        return (
          <article key={k} className="ft-card ft-vcard" data-testid={`ft-v-${k}`} data-tom={tom} style={{ ['--vc' as any]: c.color }}>
            <header className="ft-vh"><span className="ft-vtile" style={{ background: `linear-gradient(135deg,${c.from},${c.to})` }}>{c.init}</span><b>{VLABEL[k]}</b>
              <span className={`ft-pill ft-${tom} ft-pill-s`} title="Projeção ÷ meta">{temMeta ? pct0(p.pctVsMeta as number) : 'sem meta'}</span></header>
            <div className="ft-vproj" title={fmtReais(p.projecao)}><small>Projeção</small><b><Big v={p.projecao} /></b></div>
            <div className="ft-vtrack" role="img" aria-label={`${VLABEL[k]}: realizado ${fmtReais(p.realizado)}, projeção ${fmtReais(p.projecao)}${temMeta ? `, meta ${fmtReais(p.meta)}` : ''}`}>
              <div className="ft-projfill" style={{ width: at(p.projecao) }} /><div className="ft-realfill" style={{ width: at(p.realizado) }} />
              {temMeta && <i className="ft-vmeta" style={{ left: at(p.meta) }} />}
            </div>
            <footer className="ft-vf"><span title={fmtReais(p.realizado)}>Realizado <b>{fmtMi(p.realizado)}</b></span><span title={temMeta ? fmtReais(p.meta) : undefined}>Meta <b>{temMeta ? fmtMi(p.meta) : '—'}</b></span></footer>
          </article>
        )
      })}
    </div>
  )
}

export const FT_CSS = `
.ft-hero,.ft-card,.ft-vgrid,.ft-radar{--ft-good:#16a34a;--ft-warn:#d97706;--ft-bad:#e11d48;--ft-good-ink:#15803d;--ft-warn-ink:#b45309;--ft-bad-ink:#be123c;font-family:inherit}
.ft-hero{position:relative;overflow:hidden;border-radius:26px;padding:22px clamp(16px,2.4vw,30px) 18px;color:#fff;background:linear-gradient(125deg,#1e1b4b 0%,#312e81 48%,#4338ca 100%);box-shadow:0 14px 34px rgba(49,46,129,.28);margin-bottom:14px}
.ft-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.09) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:linear-gradient(100deg,transparent 30%,#000 100%);mask-image:linear-gradient(100deg,transparent 30%,#000 100%);pointer-events:none}
.ft-hero>*{position:relative}
.ft-hhead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.ft-eyebrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13.5px}
.ft-eyebrow b{font-size:15px;font-weight:900;letter-spacing:-.01em}
.ft-ico{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);display:inline-flex;align-items:center;justify-content:center}
.ft-dim{color:rgba(255,255,255,.7);font-weight:600}
.ft-live{display:inline-flex;align-items:center;gap:7px;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);font-size:10.5px;font-weight:800;letter-spacing:.06em}
.ft-live i{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:ftPulse 2s ease-in-out infinite}
.ft-live em{font-style:normal;font-weight:600;opacity:.75;letter-spacing:0}
.ft-live.ft-stale i{background:#fbbf24;animation:none}
@keyframes ftPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
.ft-main{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1.6fr);gap:20px 28px;align-items:center}
.ft-proj{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0}
.ft-lab{font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.72)}
.ft-big{font-size:clamp(40px,6vw,64px);font-weight:900;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums}
.ft-big .ft-cur{font-size:.36em;font-weight:800;letter-spacing:0;opacity:.8;margin-right:.06em}
.ft-big .ft-unit{font-size:.4em;font-weight:800;letter-spacing:0;opacity:.85}
.ft-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;padding:5px 13px;border-radius:999px;white-space:nowrap}
.ft-hero .ft-good{background:rgba(74,222,128,.18);color:#bbf7d0;border:1px solid rgba(74,222,128,.4)}
.ft-hero .ft-warn{background:rgba(251,191,36,.18);color:#fde68a;border:1px solid rgba(251,191,36,.42)}
.ft-hero .ft-bad{background:rgba(251,113,133,.2);color:#fecdd3;border:1px solid rgba(251,113,133,.45)}
.ft-hero .ft-none{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.24)}
.ft-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ft-stat{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:12px 14px;min-width:0;backdrop-filter:blur(8px)}
.ft-stat span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.68)}
.ft-stat b{display:block;margin:5px 0 3px;font-size:clamp(19px,2.2vw,26px);font-weight:900;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap}
.ft-stat b .ft-cur{font-size:.55em;opacity:.8;font-weight:800}.ft-stat b .ft-unit{font-size:.58em;opacity:.85;font-weight:800}
.ft-stat>small{display:block;font-size:11px;color:rgba(255,255,255,.7);line-height:1.3}
.ft-upc{color:#86efac}.ft-downc{color:#fcd34d}
.ft-track{position:relative;margin:30px 4px 0;height:14px}
.ft-rail{position:relative;height:14px;border-radius:999px;background:rgba(255,255,255,.16);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.25)}
.ft-projfill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:repeating-linear-gradient(135deg,rgba(196,181,253,.7) 0 6px,rgba(196,181,253,.35) 6px 12px)}
.ft-realfill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#60a5fa,#a5b4fc);transition:width .9s ease}
.ft-mark{position:absolute;top:-6px;bottom:-6px;width:0;pointer-events:none}
.ft-mark:before{content:"";position:absolute;left:-1px;top:6px;bottom:6px;width:2px;background:#fff;border-radius:2px;opacity:.95}
.ft-mark span{position:absolute;bottom:100%;left:0;transform:translateX(-50%);margin-bottom:3px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;color:#fff;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:1px 8px}
.ft-mark-proj:before{background:#c4b5fd}.ft-mark-proj span{color:#ede9fe}
.ft-foot{margin:14px 2px 0;font-size:13px;color:rgba(255,255,255,.86)}.ft-foot b{color:#fff}
.ft-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.ft-chip{font-size:11.5px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.85)}.ft-chip b{color:#fff}
.ft-chipnote{font-size:11.5px;color:rgba(255,255,255,.66)}
.ft-how{margin-top:12px;font-size:12px;color:rgba(255,255,255,.72)}
.ft-how summary{cursor:pointer;font-weight:700;width:fit-content;color:rgba(255,255,255,.82)}
.ft-how summary:hover{color:#fff}
.ft-how p{margin:8px 0 0;max-width:860px;line-height:1.55}
.ft-shim{border-radius:18px;background:rgba(255,255,255,.1);animation:ftShim 1.4s ease-in-out infinite}
.ft-vgrid .ft-shim{background:var(--secondary);border:1px solid var(--border)}
@keyframes ftShim{0%,100%{opacity:.5}50%{opacity:.95}}
.ft-card{background:var(--card);border:1px solid var(--border);border-radius:22px;padding:18px clamp(14px,2vw,24px);box-shadow:0 1px 2px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.05);color:var(--foreground);min-width:0}
.dark .ft-card{box-shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.28)}
.ft-chart{margin-bottom:14px}
.ft-chead{margin-bottom:6px}
.ft-ctitle{margin:0;font-size:clamp(17px,2.1vw,22px);font-weight:900;letter-spacing:-.02em;line-height:1.2}
.ft-csub{margin:4px 0 0;font-size:12.5px;color:var(--muted-foreground);line-height:1.45;max-width:900px}
.ft-plot{width:100%;min-height:200px}
.ft-grid{stroke:var(--border);stroke-width:1}
.ft-ax{font-size:11.5px;fill:var(--muted-foreground);font-variant-numeric:tabular-nums}
.ft-vline{stroke:var(--muted-foreground);stroke-width:1;stroke-dasharray:2 3;opacity:.6}
.ft-hline{stroke:var(--foreground);stroke-width:1;opacity:.28}
.ft-l{fill:none;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
.ft-l-ref{stroke:#8b8f98;stroke-width:2.2}.ft-l-rota{stroke-width:2.4}
.ft-lb{font-size:12px;fill:var(--foreground);font-variant-numeric:tabular-nums}.ft-lb-strong{font-weight:800}
.ft-legend{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:6px;font-size:12px;color:var(--muted-foreground)}
.ft-legend span{display:inline-flex;align-items:center;gap:8px}
.ft-sw{display:inline-block;width:26px;height:3px;border-radius:3px}
.ft-sw-dash{height:0;border-top:3px dashed var(--c)}.ft-sw-dot{height:0;border-top:3px dotted var(--c)}
.ft-empty{margin:40px 0;text-align:center;color:var(--muted-foreground);font-size:13px}
.ft-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.ft-tip{position:absolute;z-index:5;min-width:200px;max-width:240px;padding:10px 12px;border-radius:12px;background:var(--card);border:1px solid var(--border);box-shadow:0 10px 30px rgba(15,23,42,.18);font-size:12px;pointer-events:none;display:flex;flex-direction:column;gap:5px}
.ft-tip b{font-size:12.5px}.ft-tip span{display:flex;align-items:center;gap:7px}.ft-tip span i{width:9px;height:9px;border-radius:3px;flex:none}.ft-tip span em{margin-left:auto;font-style:normal;font-weight:800;font-variant-numeric:tabular-nums}
.ft-up{color:var(--ft-good-ink);font-weight:800}.ft-down{color:var(--ft-bad-ink);font-weight:800}
.ft-vgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
.ft-vcard{padding:14px 16px;display:flex;flex-direction:column;gap:10px;transition:border-color .18s,box-shadow .18s}
.ft-vcard:hover{border-color:color-mix(in srgb,var(--vc) 50%,var(--border))}
.ft-vh{display:flex;align-items:center;gap:9px}.ft-vh b{font-size:13.5px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ft-vh .ft-pill{margin-left:auto}
.ft-vtile{width:30px;height:30px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;flex:none}
.ft-pill-s{font-size:11px;padding:3px 10px}
.ft-vcard .ft-good{background:color-mix(in srgb,var(--ft-good) 14%,transparent);color:var(--ft-good-ink);border:1px solid color-mix(in srgb,var(--ft-good) 34%,transparent)}
.ft-vcard .ft-warn{background:color-mix(in srgb,var(--ft-warn) 14%,transparent);color:var(--ft-warn-ink);border:1px solid color-mix(in srgb,var(--ft-warn) 34%,transparent)}
.ft-vcard .ft-bad{background:color-mix(in srgb,var(--ft-bad) 12%,transparent);color:var(--ft-bad-ink);border:1px solid color-mix(in srgb,var(--ft-bad) 32%,transparent)}
.ft-vcard .ft-none{background:var(--secondary);color:var(--muted-foreground);border:1px solid var(--border)}
.dark .ft-vcard .ft-good{color:#86efac}.dark .ft-vcard .ft-warn{color:#fcd34d}.dark .ft-vcard .ft-bad{color:#fda4af}
.ft-vproj>small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-foreground)}
.ft-vproj b{display:block;font-size:clamp(24px,2.6vw,32px);font-weight:900;letter-spacing:-.04em;line-height:1.05;margin-top:3px;font-variant-numeric:tabular-nums}
.ft-vproj b .ft-cur{font-size:.5em;font-weight:800;opacity:.7}.ft-vproj b .ft-unit{font-size:.5em;font-weight:800;opacity:.8}
.ft-vtrack{position:relative;height:9px;border-radius:999px;background:var(--border);overflow:hidden}
.ft-vtrack .ft-projfill{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--vc) 55%,transparent) 0 5px,color-mix(in srgb,var(--vc) 28%,transparent) 5px 10px)}
.ft-vtrack .ft-realfill{background:var(--vc)}
.ft-vmeta{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--foreground);opacity:.75;border-radius:2px}
.ft-vf{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--muted-foreground)}.ft-vf b{color:var(--foreground)}
@media(max-width:1020px){.ft-vgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.ft-main{grid-template-columns:minmax(0,1fr)}}
@media(max-width:560px){.ft-vgrid{grid-template-columns:minmax(0,1fr)}.ft-stats{grid-template-columns:minmax(0,1fr)}.ft-stat b{white-space:normal}}
@media(prefers-reduced-motion:reduce){.ft-live i,.ft-shim{animation:none}.ft-realfill{transition:none}}
`
