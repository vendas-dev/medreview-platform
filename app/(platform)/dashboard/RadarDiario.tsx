'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, Radar as RadarIcon } from 'lucide-react'
import { MetaRadarEditor } from './MetaRadarEditor'
import { fmtMi, fmtReais, metaOf, radarOf, VLABEL, type VKey, type YoYData } from '@/lib/dashboard/yoy'

// ══ Radar Diário: a meta de cada dia, o que já foi feito e o ajuste automático do dia seguinte ═══════════════════════════
// Conta em lib/dashboard/projecao.ts (buildRadar). Visual: cartões-resumo no alto, uma linha por dia com barra de progresso. Não vem aberto.
const dd = (n: number) => String(n).padStart(2, '0')
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const sgn = (v: number) => `${v < 0 ? '−' : '+'}${fmtMi(Math.abs(v))}`
const fator3 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const CHIPS: { k: 'total' | VKey; label: string }[] = [{ k: 'total', label: 'Operação' }, { k: 'r1', label: VLABEL.r1 }, { k: 'anest', label: VLABEL.anest }, { k: 'oft', label: VLABEL.oft }, { k: 'ortop', label: VLABEL.ortop }]

export function RadarDiario({ data, onSaved }: { data: YoYData; onSaved?: () => void }) {
  const [aberto, setAberto] = useState(false), [vert, setVert] = useState<'total' | VKey>('total'), [acum, setAcum] = useState(false)
  const r = useMemo(() => radarOf(data, vert), [data, vert])
  const mm = data.month.slice(5), N = data.daysInMonth.cur
  const hoje = r.linhas.find(l => l.quando === 'hoje'), amanha = r.linhas.find(l => l.quando === 'amanha')
  const feito = useMemo(() => { const u = [...r.linhas].reverse().find(l => l.realAcum !== null); return u?.realAcum ?? r.realAntes }, [r])
  const falta = Math.max(r.meta - feito, 0), pctMeta = r.meta > 0 ? Math.min(feito / r.meta * 100, 100) : 0
  const pctHoje = hoje?.pct ?? null
  const base = useMemo(() => radarOf({ ...data, ajustes: [] }, 'total').linhas, [data])      // o plano sem os ajustes manuais (só para o painel de configuração)
  const resumo = hoje ? `Hoje ${fmtMi(hoje.ajustada)}${pctHoje !== null ? ` · ${Math.round(pctHoje)}%` : ''}` : r.ok ? 'Mês encerrado' : ''
  const ajustes = vert === 'total' ? data.ajustes ?? [] : []
  return (
    <div className="rd" data-testid="radar-diario">
      <style>{RADAR_CSS}</style>
      <button type="button" className="rd-head" aria-expanded={aberto} aria-controls="rd-corpo" onClick={() => setAberto(a => !a)} data-testid="radar-toggle">
        <span className="rd-ico"><RadarIcon size={18} /></span>
        <span className="rd-ttl"><b>Radar diário</b><small>{r.ok ? `${dd(r.inicio)} a ${dd(N)}/${mm}` : 'meta de cada dia'}</small></span>
        {!aberto && resumo && <span className="rd-pill" data-testid="radar-resumo">{resumo}{amanha ? ` · amanhã ${fmtMi(amanha.ajustada)}` : ''}</span>}
        <ChevronDown size={20} className={`rd-chev${aberto ? ' on' : ''}`} aria-hidden />
      </button>
      {aberto && (
        <div id="rd-corpo" className="rd-body" data-testid="radar-corpo">
          <div className="rd-bar">
            <div className="rd-seg" role="group" aria-label="Escolher a área do Radar">
              {CHIPS.map(c => <button key={c.k} type="button" aria-pressed={vert === c.k} className={vert === c.k ? 'on' : ''} onClick={() => setVert(c.k)}>{c.label}</button>)}
            </div>
            <MetaRadarEditor meta={data.metaRadar ?? 0} cadastrada={metaOf(data, 'total')} ajustes={data.ajustes ?? []} dias={base.map(l => ({ date: l.date, wd: l.wd, planejada: l.planejada }))} onSaved={onSaved ?? (() => {})} />
          </div>
          {!r.ok ? <p className="rd-msg" data-testid="radar-vazio">{r.motivo}</p> : (
            <>
              <div className="rd-kpis">
                <div className="rd-kpi"><span>Meta do mês</span><b data-testid="radar-meta-valor">{fmtMi(r.meta)}</b><i className="rd-track"><u style={{ width: `${pctMeta}%` }} /></i><small>{Math.round(pctMeta)}% vendido</small></div>
                <div className="rd-kpi"><span>Vendido</span><b>{fmtMi(feito)}</b><small>até agora</small></div>
                <div className="rd-kpi"><span>Falta</span><b>{fmtMi(falta)}</b><small>{hoje ? `${N - hoje.day + 1} dias, contando hoje` : ''}</small></div>
                {hoje && <div className="rd-kpi rd-hoje"><span>Meta de hoje</span><b>{fmtMi(hoje.ajustada)}</b>
                  <i className="rd-track"><u className={(pctHoje ?? 0) >= 100 ? 'ok' : ''} style={{ width: `${Math.min(pctHoje ?? 0, 100)}%` }} /></i><small>{fmtMi(hoje.realizado ?? 0)} feitos · {Math.round(pctHoje ?? 0)}%</small></div>}
                {amanha && <div className="rd-kpi"><span>Meta de amanhã</span><b>{fmtMi(amanha.ajustada)}</b><small>{amanha.ajuste === 0 ? 'como planejado' : amanha.ajuste > 0 ? `+${fmtMi(amanha.ajuste)} do hoje` : `${fmtMi(amanha.ajuste)} do hoje`}</small></div>}
              </div>
              <div className="rd-list" data-testid="radar-tabela" role="table" aria-label="Meta por dia">
                <div className={`rd-row rd-h${acum ? ' rd-ac' : ''}`} role="row"><span role="columnheader">Dia</span><span role="columnheader">Meta</span><span role="columnheader">Feito</span><span role="columnheader" className="rd-pcol">Progresso</span>{acum && <><span role="columnheader" className="rd-x">Meta acum.</span><span role="columnheader" className="rd-x">Feito acum.</span></>}<span role="columnheader">Saldo</span></div>
                {r.linhas.map(l => {
                  const ref = l.ajustada, pc = l.pct ?? 0, st = l.quando === 'passou' ? (pc >= 100 ? 'ok' : pc >= 80 ? 'mid' : 'low') : l.quando === 'hoje' ? 'now' : 'fut'
                  return (
                    <div key={l.day} role="row" className={`rd-row rd-q-${l.quando}${acum ? ' rd-ac' : ''}`} data-day={l.day} data-quando={l.quando} title={`Régua: ${l.refWd} ${dm(l.refDate)}/${data.yearPrev} (${fmtReais(l.refValor)})`}>
                      <span role="cell" className="rd-d"><b>{dm(l.date)}</b><small>{l.wd}{l.quando === 'hoje' ? ' · hoje' : ''}</small>{l.especial && <em>{l.especial}</em>}</span>
                      <span role="cell" className="rd-meta" data-c="ajust"><b>{fmtReais(ref)}</b>{Math.abs(l.ajuste) > 0.5 && <small data-c="plan">planejada {fmtReais(l.planejada)}</small>}</span>
                      <span role="cell" data-c="real">{l.realizado === null ? '—' : fmtReais(l.realizado)}</span>
                      <span role="cell" className="rd-pcol" data-c="pct">{l.realizado === null ? <i className="rd-track rd-empty" /> : <><i className="rd-track"><u className={st} style={{ width: `${Math.min(pc, 100)}%` }} /></i><em className={st}>{l.pct === null ? '—' : `${Math.round(pc)}%`}</em></>}</span>
                      {acum && <><span role="cell" className="rd-x" data-c="macum">{fmtReais(l.metaAcum)}</span><span role="cell" className="rd-x" data-c="racum">{l.realAcum === null ? '—' : fmtReais(l.realAcum)}</span></>}
                      <span role="cell" data-c="dif">{l.difAcum === null ? '—' : <b className={l.difAcum >= 0 ? 'rd-pos' : 'rd-neg'}>{sgn(l.difAcum)}</b>}</span>
                    </div>
                  )
                })}
              </div>
              <div className="rd-foot">
                <label className="rd-tgl"><input type="checkbox" checked={acum} onChange={e => setAcum(e.target.checked)} /> Mostrar acumulados</label>
                <details className="rd-how"><summary>Como funciona</summary>
                  <ul>
                    <li>Meta do dia = {data.yearPrev} no mesmo dia da semana × <b data-testid="radar-fator">{fator3(r.fator)}</b>, fechando <b>{fmtMi(r.meta)}</b> ({fmtMi(r.realAntes)} até {dd(r.inicio - 1)}/{mm} + {fmtMi(r.meta - r.realAntes)} a vender).</li>
                    <li>Meta ajustada = planejada − saldo acumulado até o dia anterior. O plano é refeito toda segunda.</li>
                    {ajustes.length > 0 && <li>Ajuste manual: {ajustes.map(a => `${dm(a.dia)} fixado em ${fmtReais(a.planejada)}, o resto vai para ${dm(a.para)}`).join('; ')}.</li>}
                  </ul>
                </details>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const RADAR_CSS = `
.rd{margin-top:14px;border:1px solid var(--border);border-radius:22px;background:var(--card);overflow:hidden;color:var(--foreground)}
.rd-head{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;flex-wrap:wrap}
.rd-head:hover{background:color-mix(in srgb,var(--secondary) 70%,transparent)}.rd-head:focus-visible{outline:2px solid #6366f1;outline-offset:-2px}
.rd-ico{width:38px;height:38px;border-radius:13px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none;box-shadow:0 6px 16px -6px rgba(79,70,229,.6)}
.rd-ttl{display:flex;flex-direction:column;min-width:0;flex:1 1 140px}.rd-ttl b{font-size:16px;font-weight:800;letter-spacing:-.01em}.rd-ttl small{font-size:12px;color:var(--muted-foreground);margin-top:1px}
.rd-pill{font-size:12px;font-weight:700;padding:6px 13px;border-radius:999px;background:var(--secondary);border:1px solid var(--border);white-space:nowrap}
.rd-chev{transition:transform .2s ease;color:var(--muted-foreground);flex:none}.rd-chev.on{transform:rotate(180deg)}
.rd-body{padding:6px 18px 18px;border-top:1px solid var(--border)}
.rd-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:14px 0 12px;position:relative}
.rd-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:999px;background:var(--secondary);border:1px solid var(--border)}
.rd-seg button{font:inherit;font-size:12px;font-weight:700;padding:6px 13px;border-radius:999px;border:0;background:transparent;color:var(--muted-foreground);cursor:pointer;transition:background .15s,color .15s}
.rd-seg button:hover{color:var(--foreground)}.rd-seg button.on{background:#4f46e5;color:#fff;box-shadow:0 4px 12px -4px rgba(79,70,229,.7)}
.rd-cfgbtn{font:inherit;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--foreground);cursor:pointer}
.rd-cfgbtn:hover{background:var(--secondary)}
.rd-cfg{flex-basis:100%;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;border:1px solid var(--border);background:var(--secondary);font-size:13px}
.rd-cfgrow{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.rd-cfgrow label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700;color:var(--muted-foreground);text-transform:uppercase;letter-spacing:.04em}
.rd-cfg input,.rd-cfg select{font:inherit;font-size:13px;font-weight:600;padding:8px 11px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--foreground);min-width:130px}
.rd-cfg button{font:inherit;font-size:12px;font-weight:700;padding:8px 14px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--foreground);cursor:pointer}
.rd-cfg button.rd-primary{background:#4f46e5;border-color:#4f46e5;color:#fff}.rd-cfg button:disabled{opacity:.6;cursor:default}
.rd-cfgsep{height:1px;background:var(--border)}.rd-cfgtit{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted-foreground)}
.rd-cfg small{color:var(--muted-foreground);font-size:12px}
.rd-chip{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;padding:6px 6px 6px 12px;border-radius:999px;background:var(--card);border:1px solid var(--border);font-size:12px}
.rd-chip button{padding:3px!important;border-radius:999px!important;display:inline-flex}.rd-err{color:#c0392b;font-style:normal;font-size:12px}
.rd-msg{margin:18px 0 6px;color:var(--muted-foreground);font-size:13px}
.rd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.rd-kpi{display:flex;flex-direction:column;gap:4px;padding:13px 14px;border-radius:16px;background:var(--secondary);border:1px solid var(--border);min-width:0}
.rd-kpi span{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground)}
.rd-kpi b{font-size:22px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}.rd-kpi small{font-size:12px;color:var(--muted-foreground)}
.rd-hoje{background:linear-gradient(135deg,color-mix(in srgb,#4f46e5 16%,var(--secondary)),color-mix(in srgb,#7c3aed 12%,var(--secondary)));border-color:color-mix(in srgb,#6366f1 45%,var(--border))}
.rd-track{display:block;height:7px;border-radius:999px;background:color-mix(in srgb,var(--foreground) 11%,transparent);overflow:hidden;margin:3px 0}
.rd-track u{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#6366f1,#4f46e5);transition:width .35s ease}
.rd-track u.ok{background:linear-gradient(90deg,#34d399,#059669)}.rd-track u.mid{background:linear-gradient(90deg,#fbbf24,#f59e0b)}.rd-track u.low{background:linear-gradient(90deg,#fb7185,#e11d48)}.rd-track u.now{background:linear-gradient(90deg,#818cf8,#4f46e5)}
.rd-list{border:1px solid var(--border);border-radius:18px;overflow:hidden;overflow-x:auto}
.rd-row{display:grid;grid-template-columns:minmax(96px,1.1fr) minmax(120px,1.3fr) minmax(100px,1fr) minmax(130px,1.4fr) minmax(90px,.9fr);gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid var(--border);font-size:13px;font-variant-numeric:tabular-nums;min-width:640px}
.rd-row.rd-ac{grid-template-columns:minmax(96px,1.1fr) minmax(120px,1.3fr) minmax(100px,1fr) minmax(130px,1.4fr) minmax(110px,1fr) minmax(110px,1fr) minmax(90px,.9fr);min-width:900px}
.rd-row:last-child{border-bottom:0}.rd-row>span:not(.rd-d):not(.rd-pcol){text-align:right}
.rd-h>span:first-child{text-align:left!important}
.rd-h{background:var(--secondary);font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground);padding-top:9px;padding-bottom:9px}
.rd-d{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}.rd-d b{font-size:15px;font-weight:800}.rd-d small{font-size:11px;color:var(--muted-foreground);font-weight:600}
.rd-d em{flex-basis:100%;font-style:normal;font-size:10.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#7c3aed}
.rd-meta{display:flex;flex-direction:column;align-items:flex-end}.rd-meta b{font-size:14px;font-weight:800}.rd-meta small{font-size:11px;color:var(--muted-foreground)}
.rd-pcol{display:flex;align-items:center;gap:10px}.rd-pcol .rd-track{flex:1;margin:0;min-width:60px}.rd-pcol em{font-style:normal;font-size:12px;font-weight:800;min-width:38px;text-align:right}
.rd-pcol em.ok{color:#15803d}.rd-pcol em.mid{color:#b45309}.rd-pcol em.low{color:#be123c}.rd-pcol em.now{color:#4f46e5}
.dark .rd-pcol em.ok{color:#86efac}.dark .rd-pcol em.mid{color:#fcd34d}.dark .rd-pcol em.low{color:#fda4af}.dark .rd-pcol em.now{color:#a5b4fc}
.rd-empty{opacity:.45}
.rd-pos{color:#15803d}.rd-neg{color:#be123c}.dark .rd-pos{color:#86efac}.dark .rd-neg{color:#fda4af}
.rd-q-hoje{background:color-mix(in srgb,#6366f1 11%,transparent);box-shadow:inset 3px 0 0 #6366f1}
.rd-q-vem,.rd-q-amanha{color:var(--muted-foreground)}.rd-q-vem .rd-meta b,.rd-q-amanha .rd-meta b{color:var(--foreground)}
.rd-foot{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-start;justify-content:space-between;margin-top:12px}
.rd-tgl{display:inline-flex;gap:8px;align-items:center;font-size:12px;font-weight:600;color:var(--muted-foreground);cursor:pointer}
.rd-how{font-size:12px;color:var(--muted-foreground);max-width:620px}.rd-how summary{cursor:pointer;font-weight:700}.rd-how ul{margin:8px 0 0;padding-left:18px;line-height:1.55}.rd-how b{color:var(--foreground)}
@media(max-width:700px){.rd-body{padding:4px 12px 14px}.rd-kpi b{font-size:19px}}
@media(prefers-reduced-motion:reduce){.rd-track u,.rd-chev{transition:none}}
`
