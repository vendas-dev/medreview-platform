'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, Radar as RadarIcon } from 'lucide-react'
import { fmtDataBR, fmtMi, fmtReais, radarOf, VLABEL, type VKey, type YoYData } from '@/lib/dashboard/yoy'

// ══ Radar Diário: a meta de cada dia, o que foi feito e o ajuste automático do dia seguinte ═══════════════════════════════
// Conta em lib/dashboard/projecao.ts (buildRadar): meta planejada = curva do ano passado (dia da semana com dia da semana) × um fator que fecha a meta; refeita toda segunda-feira.
// Meta ajustada = planejada − diferença acumulada até o dia anterior. Não vem aberto: clique no título para expandir.
const dd = (n: number) => String(n).padStart(2, '0')
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const sgn = (v: number) => `${v < 0 ? '−' : '+'}${fmtReais(Math.abs(v))}`
const fator3 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const CHIPS: { k: 'total' | VKey; label: string }[] = [{ k: 'total', label: 'Operação' }, { k: 'r1', label: VLABEL.r1 }, { k: 'anest', label: VLABEL.anest }, { k: 'oft', label: VLABEL.oft }, { k: 'ortop', label: VLABEL.ortop }]

export function RadarDiario({ data }: { data: YoYData }) {
  const [aberto, setAberto] = useState(false)
  const [vert, setVert] = useState<'total' | VKey>('total')
  const r = useMemo(() => radarOf(data, vert), [data, vert])
  const mm = data.month.slice(5), N = data.daysInMonth.cur
  const hoje = r.linhas.find(l => l.quando === 'hoje'), amanha = r.linhas.find(l => l.quando === 'amanha')
  const titulo = r.ok ? `Radar diário de ${dd(r.inicio)} a ${dd(N)}/${mm}` : 'Radar diário'
  const destaques = useMemo(() => {
    if (!r.ok) return []
    const maior = r.linhas.reduce((b, l) => (l.refValor > b.refValor ? l : b), r.linhas[0])
    const ls = r.linhas.filter(l => l.especial || l === maior)
    return ls.map(l => `${l.especial ? l.especial + ': ' : ''}${l.wd} ${dm(l.date)}/${data.yearCur} ↔ ${l.refWd} ${fmtDataBR(l.refDate)}${l === maior ? `, o maior dia do período em ${data.yearPrev}` : ''}`)
  }, [r, data.yearCur, data.yearPrev])
  const resumo = hoje ? `Hoje: meta ajustada ${fmtReais(hoje.ajustada)}${hoje.realizado !== null ? ` · ${Math.round(hoje.pct ?? 0)}% feito` : ''}` : r.ok ? 'Mês encerrado' : ''
  return (
    <div className="ft-radar" data-testid="radar-diario">
      <style>{RADAR_CSS}</style>
      <button type="button" className="ft-rhead" aria-expanded={aberto} aria-controls="ft-radar-corpo" onClick={() => setAberto(a => !a)} data-testid="radar-toggle">
        <span className="ft-rico"><RadarIcon size={18} /></span>
        <span className="ft-rtxt"><b>{titulo}</b><small>Meta de cada dia, o que foi feito e o ajuste automático do dia seguinte</small></span>
        {!aberto && resumo && <span className="ft-rsum" data-testid="radar-resumo">{resumo}{amanha ? ` · amanhã ${fmtReais(amanha.ajustada)}` : ''}</span>}
        <ChevronDown size={20} className={`ft-rchev${aberto ? ' on' : ''}`} aria-hidden />
      </button>
      {aberto && (
        <div id="ft-radar-corpo" className="ft-rbody" data-testid="radar-corpo">
          <div className="ft-rchips" role="group" aria-label="Escolher a área do Radar">
            {CHIPS.map(c => <button key={c.k} type="button" aria-pressed={vert === c.k} className={vert === c.k ? 'on' : ''} onClick={() => setVert(c.k)}>{c.label}</button>)}
          </div>
          {!r.ok ? <p className="ft-rmsg" data-testid="radar-vazio">{r.motivo}</p> : (
            <>
              <div className="ft-rintro">
                <p>A meta de cada dia segue o mesmo dia da semana de {data.yearPrev}{destaques.length > 0 ? <>. {destaques.map((t, i) => <span key={i} className="ft-rdest">{t}</span>)}</> : '.'}</p>
                <p>Os valores de {data.yearPrev} foram multiplicados por <b data-testid="radar-fator">{fator3(r.fator)}</b>, o que fecha exatamente <b>{fmtReais(r.meta)}</b>
                  {r.inicio > 1 ? <> ({fmtMi(r.realAntes)} vendidos até {dd(r.inicio - 1)}/{mm} + {fmtMi(r.meta - r.realAntes)} a vender de {dd(r.inicio)} a {dd(N)}/{mm})</> : null}. O plano é refeito toda segunda-feira com o que falta para a meta.</p>
                {hoje && (hoje.ajuste !== 0 || (amanha && amanha.ajuste !== 0)) && (
                  <p>{hoje.ajuste !== 0 && <>A meta de hoje ({dm(hoje.date)}) {hoje.ajuste < 0 ? 'foi reduzida' : 'subiu'} para <b>{fmtReais(hoje.ajustada)}</b>. </>}
                    {amanha && amanha.ajuste !== 0 && <>A de amanhã ({dm(amanha.date)}) {amanha.ajuste < 0 ? 'cai' : 'sobe'} para <b>{fmtReais(amanha.ajustada)}</b>, descontando a diferença de hoje.</>}</p>
                )}
              </div>
              <div className="ft-rscroll">
                <table className="ft-rtable" data-testid="radar-tabela">
                  <thead><tr>
                    <th scope="col" className="ft-l">Dia</th><th scope="col">Meta planejada</th><th scope="col">Meta ajustada</th><th scope="col">Realizado</th><th scope="col">% da meta ajustada</th><th scope="col">Meta acumulada</th><th scope="col">Realizado acumulado</th><th scope="col">Diferença acumulada</th>
                  </tr></thead>
                  <tbody>
                    {r.linhas.map(l => {
                      const tom = l.ajuste < -0.5 ? 'ft-rg' : l.ajuste > 0.5 ? 'ft-rr' : ''
                      return (
                        <tr key={l.day} className={`ft-q-${l.quando}`} data-day={l.day} data-quando={l.quando}>
                          <th scope="row" className="ft-l" title={`Régua: ${l.refWd} ${fmtDataBR(l.refDate)} (${fmtReais(l.refValor)})`}>{dm(l.date)}{l.quando === 'hoje' ? ' (hoje)' : ''}<small>{l.wd}{l.especial ? ` · ${l.especial}` : ''}</small></th>
                          <td data-c="plan">{fmtReais(l.planejada)}</td>
                          <td data-c="ajust" className={tom}>{fmtReais(l.ajustada)}</td>
                          <td data-c="real">{l.realizado === null ? '—' : fmtReais(l.realizado)}</td>
                          <td data-c="pct" className={l.pct !== null && l.quando === 'passou' ? (l.pct >= 100 ? 'ft-rg' : 'ft-rm') : ''}>{l.pct === null ? '—' : `${Math.round(l.pct)}%`}</td>
                          <td data-c="macum">{fmtReais(l.metaAcum)}</td>
                          <td data-c="racum">{l.realAcum === null ? '—' : fmtReais(l.realAcum)}</td>
                          <td data-c="dif" className={l.difAcum === null ? '' : l.difAcum >= 0 ? 'ft-rg' : 'ft-rr'}>{l.difAcum === null ? '—' : sgn(l.difAcum)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="ft-rnote"><b>Meta ajustada:</b> a meta planejada do dia menos a diferença acumulada até o dia anterior. Se o acumulado está acima do planejado, a meta do dia seguinte cai nesse valor (em verde); se está abaixo, sobe (em vermelho). A meta de amanhã já desconta a diferença de hoje, mesmo com o dia em andamento. Os dias depois de amanhã mostram a meta planejada. O dia de hoje está em andamento e aparece em negrito.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const RADAR_CSS = `
.ft-radar{margin-top:14px;border:1px solid var(--border);border-radius:20px;background:var(--card);overflow:hidden;color:var(--foreground)}
.ft-rhead{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;flex-wrap:wrap}
.ft-rhead:hover{background:color-mix(in srgb,var(--secondary) 70%,transparent)}
.ft-rhead:focus-visible{outline:2px solid #6366f1;outline-offset:-2px}
.ft-rico{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ft-rtxt{display:flex;flex-direction:column;min-width:0;flex:1 1 220px}.ft-rtxt b{font-size:15px;font-weight:800;letter-spacing:-.01em}.ft-rtxt small{font-size:12px;color:var(--muted-foreground);margin-top:1px}
.ft-rsum{font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;background:var(--secondary);border:1px solid var(--border);white-space:nowrap}
.ft-rchev{transition:transform .2s ease;color:var(--muted-foreground);flex:none}.ft-rchev.on{transform:rotate(180deg)}
.ft-rbody{padding:4px 18px 18px;border-top:1px solid var(--border)}
.ft-rchips{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 10px}
.ft-rchips button{font:inherit;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--muted-foreground);cursor:pointer}
.ft-rchips button.on{background:#4f46e5;border-color:#4f46e5;color:#fff}
.ft-rintro p{margin:0 0 7px;font-size:13px;line-height:1.55;color:var(--foreground)}
.ft-rdest{display:block;color:var(--muted-foreground);font-size:12.5px}
.ft-rmsg{margin:18px 0 6px;color:var(--muted-foreground);font-size:13px}
.ft-rscroll{overflow-x:auto;margin-top:10px;border:1px solid var(--border);border-radius:14px;max-height:560px;overflow-y:auto}
.ft-rtable{width:100%;min-width:860px;border-collapse:separate;border-spacing:0;font-size:13px;font-variant-numeric:tabular-nums}
.ft-rtable th,.ft-rtable td{padding:9px 12px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--border)}
.ft-rtable thead th{position:sticky;top:0;z-index:1;background:var(--secondary);font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground);white-space:normal;line-height:1.25}
.ft-rtable .ft-l{text-align:left}.ft-rtable tbody th{font-weight:700}.ft-rtable tbody th small{display:block;font-size:11px;font-weight:600;color:var(--muted-foreground)}
.ft-rtable tr:last-child td,.ft-rtable tr:last-child th{border-bottom:0}
.ft-rtable .ft-q-hoje{font-weight:800;background:color-mix(in srgb,#6366f1 10%,transparent)}.ft-rtable .ft-q-hoje th{font-weight:800}
.ft-rtable .ft-q-vem td,.ft-rtable .ft-q-vem th{color:var(--muted-foreground)}
.ft-rg{color:#15803d}.ft-rr{color:#be123c}.ft-rm{color:#b45309}
.dark .ft-rg{color:#86efac}.dark .ft-rr{color:#fda4af}.dark .ft-rm{color:#fcd34d}
.ft-rnote{margin:12px 2px 0;font-size:12px;line-height:1.55;color:var(--muted-foreground)}.ft-rnote b{color:var(--foreground)}
`
