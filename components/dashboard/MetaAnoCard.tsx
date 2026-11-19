'use client'
import { useEffect, useMemo, useState } from 'react'
import { Trophy, Flag, Sparkles } from 'lucide-react'
import { buildMetaAno } from '@/lib/dashboard/metaAno'
import { fmtMi } from '@/lib/dashboard/yoy'

// ══ Meta do ano — o banner de topo: placar grande, régua única 0 → 72 mi (essencial de 60 mi marcada no caminho) e o time de mascotes da casa ═══════════
// Sempre escuro (é o "palco" da página), então fica igual no tema claro e no escuro, no Forecast e no Telão Completo.
// Até 60 mi o preenchimento é azul→violeta (a marca); de 60 mi em diante continua dourado, rumo ao desafio.
// Os mascotes são decorativos (alt vazio) e ficam em /public/mascotes. A altura é compacta de propósito: o banner não domina a página.
const dec = (v: number, n: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n })
const pct = (v: number) => `${dec(v, v >= 100 ? 0 : 1)}%`
/** "R$ 38,42 mi" quebrado em partes para o "R$" e a unidade ficarem menores que os dígitos. */
function partes(v: number): { num: string; unit: string } {
  const a = Math.abs(v)
  if (a >= 1_000_000) return { num: dec(a / 1_000_000, 2), unit: 'mi' }
  if (a >= 1000) return { num: dec(a / 1000, 1), unit: 'mil' }
  return { num: dec(a, 0), unit: '' }
}
/** Marcos da régua: "R$ 60 mi" quando é número redondo (e não "R$ 60,00 mi"). */
const marco = (v: number) => (v >= 1_000_000 && v % 1_000_000 === 0 ? `R$ ${v / 1_000_000} mi` : fmtMi(v))
const dm = (today: string) => `${today.slice(8, 10)}/${today.slice(5, 7)}`
const SQUAD = [
  { k: 'trovao', src: '/mascotes/trovao.webp', cls: 'm-trovao' },
  { k: 'ouro', src: '/mascotes/ouro.webp', cls: 'm-ouro' },
  { k: 'mago', src: '/mascotes/mago.webp', cls: 'm-mago' },
  { k: 'azul', src: '/mascotes/azul.webp', cls: 'm-azul' },       // o último fica na frente
] as const

function Squad() {
  return (
    <div className="ma-squad" aria-hidden>
      {SQUAD.map(m => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.k} src={m.src} alt="" className={`ma-m ${m.cls}`} draggable={false} decoding="async" />
      ))}
    </div>
  )
}

/** `variant="telao"`: no Telão Completo o banner veste as cores do painel (roxo translúcido, fonte mono nos títulos) — `vars` traz as variáveis --tc-* e a fonte do tema; no Forecast é o palco escuro de sempre. */
export function MetaAnoCard({ realizado, today, erro, vars, variant }: { realizado: number | null; today: string | null; erro?: boolean; vars?: React.CSSProperties; variant?: 'forecast' | 'telao' }) {
  const m = useMemo(() => (realizado === null || !today ? null : buildMetaAno(realizado, today)), [realizado, today])
  const [pronto, setPronto] = useState(false)                                  // a barra nasce vazia e cresce até o valor (uma vez)
  useEffect(() => { if (!m) return; const id = requestAnimationFrame(() => setPronto(true)); return () => cancelAnimationFrame(id) }, [m === null])        // eslint-disable-line react-hooks/exhaustive-deps
  const estilo = variant === 'telao' ? vars : undefined
  const cls = variant === 'telao' ? 'ma ma-tc' : 'ma'
  if (!m) {
    return (
      <section className={cls} data-testid="meta-ano" data-estado={erro ? 'erro' : 'carregando'} style={estilo} aria-busy={!erro}>
        <style>{CSS}</style>
        <div className="ma-top">
          <div className="ma-main">
            <p className="ma-eyebrow"><Trophy size={14} strokeWidth={2.6} /> Meta do ano</p>
            {erro ? <p className="ma-erro" role="alert">Não consegui carregar a receita do ano agora. Tentando de novo em instantes.</p> : <div className="ma-skel" />}
          </div>
          <Squad />
        </div>
      </section>
    )
  }
  const v = partes(m.realizado), fill1 = Math.min(m.fillPct, m.markPct), fill2 = Math.max(m.fillPct - m.markPct, 0)
  const bateuE = m.fase !== 'caminho', bateuD = m.fase === 'desafio'
  const frase = m.fase === 'caminho'
    ? <>Rumo aos <b>{marco(m.essencial)}</b>{m.diasRestantes > 0 ? <> · faltam <b>{m.diasRestantes}</b> {m.diasRestantes === 1 ? 'dia' : 'dias'}</> : <> · último dia do ano</>}</>
    : m.fase === 'essencial'
      ? <><b>Meta essencial batida!</b> Agora é o desafio de <b>{marco(m.desafio)}</b></>
      : <><b>Desafio batido!</b> Ano para a história</>
  return (
    <section className={cls} data-testid="meta-ano" data-fase={m.fase} style={estilo}>
      <style>{CSS}</style>
      <div className="ma-top">
        <div className="ma-main">
          <p className="ma-eyebrow"><Trophy size={14} strokeWidth={2.6} /> Meta do ano · {m.ano}</p>
          <div className="ma-numrow">
            <p className="ma-valor" data-k="realizado" title={m.realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}><small>R$</small> {v.num}{v.unit && <> <small>{v.unit}</small></>}</p>
            <div className="ma-pcts">
              <div className={`ma-pct${bateuE ? ' ok' : ''}`} data-k="pct-essencial"><b>{pct(m.pctEssencial)}</b><span>da essencial</span></div>
              <div className={`ma-pct ma-pct2${bateuD ? ' ok' : ''}`} data-k="pct-desafio"><b>{pct(m.pctDesafio)}</b><span>do desafio</span></div>
            </div>
          </div>
          <p className="ma-frase" data-k="frase"><Sparkles size={14} strokeWidth={2.4} />{frase}</p>
        </div>
        <Squad />
      </div>

      <div className="ma-bar">
        <div className="ma-track" role="progressbar" aria-valuemin={0} aria-valuemax={m.desafio} aria-valuenow={Math.round(Math.min(m.realizado, m.desafio))}
          aria-valuetext={`${fmtMi(m.realizado)} vendidos de 1º de janeiro até hoje: ${pct(m.pctEssencial)} da meta essencial de ${marco(m.essencial)} e ${pct(m.pctDesafio)} do desafio de ${marco(m.desafio)}`}>
          <div className="ma-zone" style={{ left: `${m.markPct}%` }} aria-hidden />
          <div className="ma-fill ma-f1" data-testid="meta-ano-fill" style={{ width: pronto ? `${fill1}%` : 0 }} />
          {fill2 > 0 && <div className="ma-fill ma-f2" data-testid="meta-ano-fill2" style={{ left: `${m.markPct}%`, width: pronto ? `${fill2}%` : 0 }} />}
          <i className="ma-mark" style={{ left: `${m.markPct}%` }} aria-hidden />
          {m.fillPct > 0 && m.fillPct < 100 && <i className="ma-dot" style={{ left: pronto ? `${m.fillPct}%` : 0 }} aria-hidden />}
        </div>
        <div className="ma-labels">
          <span className="ma-l0">R$ 0</span>
          <span className={`ma-lm${bateuE ? ' ok' : ''}`} style={{ left: `${m.markPct}%` }} data-k="flag-essencial"><em>{bateuE ? '✓ Essencial' : 'Essencial'}</em><b>{marco(m.essencial)}</b></span>
          <span className={`ma-ld${bateuD ? ' ok' : ''}`} data-k="rotulo-desafio"><em>{bateuD ? '✓ Desafio' : 'Desafio'}</em><b>{marco(m.desafio)}</b></span>
        </div>
      </div>

      <footer className="ma-foot">
        {m.fase === 'caminho' && <span data-k="falta-essencial"><Flag size={13} strokeWidth={2.6} />Faltam <b>{fmtMi(m.faltaEssencial)}</b> para a essencial{m.porDiaEssencial !== null && <> · <b>{fmtMi(m.porDiaEssencial)}</b> por dia até 31/12</>}</span>}
        {m.fase === 'essencial' && <span className="ok" data-k="essencial-batida"><Flag size={13} strokeWidth={2.6} />Essencial batida: <b>{fmtMi(m.realizado - m.essencial)}</b> acima</span>}
        {m.fase === 'desafio' && <span className="ok" data-k="desafio-batido"><Flag size={13} strokeWidth={2.6} />Desafio batido: <b>{fmtMi(m.realizado - m.desafio)}</b> acima dos {marco(m.desafio)}</span>}
        {m.fase !== 'desafio' && <span data-k="falta-desafio">Faltam <b>{fmtMi(m.faltaDesafio)}</b> para o desafio{m.fase === 'essencial' && m.porDiaDesafio !== null && <> · <b>{fmtMi(m.porDiaDesafio)}</b> por dia até 31/12</>}</span>}
        <span className="ma-data">vendido de 1º/jan até {dm(today!)}</span>
      </footer>
    </section>
  )
}

const CSS = `
.ma{--ma-a:#38bdf8;--ma-b:#6366f1;--ma-c:#a855f7;--ma-g1:#f59e0b;--ma-g2:#fde68a;--ma-ok:#4ade80;--ma-t:#fff;--ma-mt:rgba(226,232,255,.74);--ma-strong:#fff;--ma-eye:#fde68a;--ma-p1:#c7d2fe;--ma-p2:#fde68a;--ma-trk:rgba(255,255,255,.1);--ma-fa:#38bdf8;--ma-fb:#6366f1;--ma-fc:#a855f7;
  position:relative;isolation:isolate;overflow:hidden;border-radius:24px;padding:18px clamp(16px,2.4vw,30px) 14px;color:var(--ma-t);border:1px solid rgba(165,180,252,.22);
  background:radial-gradient(60% 120% at 88% 108%,rgba(168,85,247,.42),transparent 62%),radial-gradient(40% 90% at 100% -10%,rgba(245,158,11,.20),transparent 70%),radial-gradient(46% 100% at 0% 100%,rgba(56,189,248,.16),transparent 70%),linear-gradient(118deg,#0b1030 0%,#161a52 52%,#241466 100%);
  box-shadow:0 22px 50px -26px rgba(67,56,202,.75),inset 0 1px 0 rgba(255,255,255,.08)}
.ma::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.2px);background-size:22px 22px;-webkit-mask-image:linear-gradient(100deg,transparent 12%,#000 80%);mask-image:linear-gradient(100deg,transparent 12%,#000 80%);opacity:.55}
.ma-top{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.ma-main{position:relative;z-index:2;min-width:0;padding-bottom:6px}
.ma-eyebrow{display:flex;align-items:center;gap:7px;margin:0 0 4px;font-size:11.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--ma-eye)}
.ma-numrow{display:flex;align-items:flex-end;flex-wrap:wrap;gap:6px 18px}
.ma-valor{margin:0;font-size:clamp(40px,5.2vw,62px);font-weight:900;letter-spacing:-.05em;line-height:.98;font-variant-numeric:tabular-nums;text-shadow:0 4px 28px rgba(99,102,241,.65)}
.ma-valor small{font-size:.36em;font-weight:800;letter-spacing:-.01em;color:var(--ma-mt);margin-right:3px;text-shadow:none}
.ma-valor small:last-child{margin:0 0 0 2px}
.ma-pcts{display:flex;gap:8px;padding-bottom:6px}
.ma-pct{display:flex;align-items:baseline;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(99,102,241,.22);border:1px solid rgba(165,180,252,.36);backdrop-filter:blur(6px)}
.ma-pct b{font-size:17px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ma-p1)}
.ma-pct span{font-size:11.5px;font-weight:700;color:var(--ma-mt)}
.ma-pct2{background:rgba(245,158,11,.16);border-color:rgba(253,230,138,.38)}.ma-pct2 b{color:var(--ma-p2)}
.ma-pct.ok{background:rgba(74,222,128,.16);border-color:rgba(74,222,128,.5)}.ma-pct.ok b{color:var(--ma-ok)}
.ma-frase{display:flex;align-items:center;gap:7px;margin:9px 0 0;font-size:13.5px;font-weight:600;color:var(--ma-mt)}
.ma-frase svg{color:var(--ma-g1);flex:none}.ma-frase b{color:var(--ma-strong);font-weight:800}
.ma-squad{position:relative;z-index:1;flex:none;width:clamp(290px,38vw,440px);aspect-ratio:440/142;margin:-6px 0 -8px;pointer-events:none;user-select:none}
.ma-squad::before{content:"";position:absolute;left:4%;right:4%;bottom:2px;height:34%;border-radius:50%;background:radial-gradient(closest-side,rgba(129,140,248,.55),transparent);filter:blur(8px)}
.ma-m{position:absolute;bottom:0;width:auto;max-width:none;filter:drop-shadow(0 12px 16px rgba(2,6,23,.55));animation:ma-float 5.4s ease-in-out infinite}
.m-trovao{left:0;height:80%;animation-delay:-1.6s;z-index:1}
.m-ouro{left:42%;height:88%;animation-delay:-3.1s;z-index:2}
.m-mago{left:72%;height:80%;animation-delay:-.6s;z-index:1}
.m-azul{left:20%;height:98%;animation-delay:-2.3s;animation-duration:4.8s;z-index:3}
@keyframes ma-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.ma-bar{position:relative;z-index:3;margin-top:8px}
.ma-track{position:relative;height:15px;border-radius:999px;background:var(--ma-trk);box-shadow:inset 0 1px 3px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.06)}
.ma-zone{position:absolute;top:0;bottom:0;right:0;border-radius:0 999px 999px 0;background:repeating-linear-gradient(135deg,rgba(245,158,11,.30) 0 6px,rgba(245,158,11,.09) 6px 12px)}
.ma-fill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;overflow:hidden;transition:width 1.2s cubic-bezier(.22,.8,.24,1)}
.ma-f1{background:linear-gradient(90deg,var(--ma-fa),var(--ma-fb) 58%,var(--ma-fc));box-shadow:0 0 18px -1px rgba(99,102,241,.9)}
.ma-f2{border-radius:0 999px 999px 0;background:linear-gradient(90deg,var(--ma-g1),var(--ma-g2));box-shadow:0 0 18px -1px rgba(245,158,11,.9)}
.ma-fill::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.38),transparent 55%)}
.ma-fill::before{content:"";position:absolute;top:0;bottom:0;width:38%;left:-40%;z-index:1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);animation:ma-sweep 3.8s ease-in-out infinite}
@keyframes ma-sweep{0%,35%{left:-40%}100%{left:130%}}
.ma-mark{position:absolute;top:-5px;bottom:-5px;width:3px;margin-left:-1.5px;border-radius:3px;background:var(--ma-strong);box-shadow:0 0 10px color-mix(in srgb,var(--ma-strong) 70%,transparent)}
.ma-dot{position:absolute;top:50%;width:23px;height:23px;margin:-11.5px 0 0 -11.5px;border-radius:50%;background:#fff;border:5px solid var(--ma-b);box-shadow:0 3px 12px rgba(0,0,0,.5),0 0 18px rgba(129,140,248,.9);transition:left 1.2s cubic-bezier(.22,.8,.24,1);animation:ma-pulse 2.6s ease-in-out infinite}
.ma[data-fase=essencial] .ma-dot,.ma[data-fase=desafio] .ma-dot{border-color:var(--ma-g1);box-shadow:0 3px 12px rgba(0,0,0,.5),0 0 18px rgba(245,158,11,.9)}
@keyframes ma-pulse{0%,100%{outline:0 solid rgba(165,180,252,.55)}50%{outline:9px solid transparent}}
.ma-dot{outline:0 solid rgba(165,180,252,.55)}
.ma-labels{position:relative;height:30px;margin-top:6px;font-size:11.5px}
.ma-labels em{display:block;font-style:normal;font-weight:700;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ma-mt)}
.ma-labels b{display:block;font-weight:800;font-size:12.5px;color:var(--ma-strong);font-variant-numeric:tabular-nums}
.ma-l0,.ma-lm,.ma-ld{position:absolute;top:0;line-height:1.25;white-space:nowrap}
.ma-l0{left:0;padding-top:7px;font-weight:800;color:var(--ma-mt)}
.ma-lm{transform:translateX(-100%);text-align:right;padding-right:7px}
.ma-ld{right:0;text-align:right}
.ma-ld em{color:var(--ma-p2)}.ma-lm.ok em,.ma-ld.ok em,.ma-lm.ok b,.ma-ld.ok b{color:var(--ma-ok)}
.ma-foot{display:flex;flex-wrap:wrap;align-items:center;gap:5px 22px;margin-top:6px;padding-top:9px;border-top:1px solid rgba(165,180,252,.18);font-size:12.5px;color:var(--ma-mt);font-weight:600}
.ma-foot svg{color:var(--ma-g1);display:inline-block;vertical-align:-2px;margin-right:6px}
.ma-foot b{color:var(--ma-strong);font-weight:800;font-variant-numeric:tabular-nums}.ma-foot .ok,.ma-foot .ok svg{color:var(--ma-ok)}.ma-foot .ok b{color:var(--ma-ok)}
.ma-data{margin-left:auto;font-size:11.5px;opacity:.8}
.ma-skel{width:min(320px,70%);height:64px;border-radius:14px;background:rgba(255,255,255,.1);animation:ma-shim 1.4s ease-in-out infinite}
@keyframes ma-shim{0%,100%{opacity:.5}50%{opacity:1}}
.ma-erro{margin:6px 0 0;font-size:13px;color:var(--ma-mt)}
/* Telão Completo: mesmas formas, cores do painel (roxo translúcido como o Hero e os Panels) */
.ma-tc{--ma-ok:var(--tc-ok,#4ade80);--ma-t:var(--tc-t);--ma-mt:var(--tc-m);--ma-strong:var(--tc-t);--ma-eye:var(--tc-eye);--ma-p1:var(--tc-p1);--ma-p2:var(--tc-p2);--ma-trk:var(--tc-trk);--ma-fa:var(--tc-fa);--ma-fb:var(--tc-fb);--ma-fc:var(--tc-fc);
  background:var(--tc-bg);border:var(--tc-br);border-radius:24px;box-shadow:var(--tc-sh);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.ma-tc::before{display:none}
.ma-tc::after{content:"";position:absolute;top:-70px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(var(--tc-glow),transparent 70%);pointer-events:none;z-index:-1}
.ma-tc .ma-eyebrow{font-family:var(--tc-mono);font-size:10.5px;letter-spacing:.14em;font-weight:800}
.ma-tc .ma-valor{color:var(--tc-num);text-shadow:none}
.ma-tc .ma-valor small{color:var(--ma-mt)}
.ma-tc .ma-pct{background:var(--tc-pill);border-color:var(--tc-pillb)}
.ma-tc .ma-pct2{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.32)}
.ma-tc .ma-pct.ok{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.45)}
.ma-tc .ma-labels em,.ma-tc .ma-foot{font-family:var(--tc-mono)}
.ma-tc .ma-labels em{font-size:9.5px;letter-spacing:.1em}
.ma-tc .ma-foot{border-top-color:var(--tc-line)}
.ma-tc .ma-squad::before{background:radial-gradient(closest-side,var(--tc-glow),transparent);opacity:.9}
.ma-tc .ma-m{opacity:.94;filter:drop-shadow(0 10px 14px rgba(15,3,25,.5)) saturate(.92)}
.ma-tc .ma-f1{box-shadow:0 0 16px -2px color-mix(in srgb,var(--ma-fb) 70%,transparent)}
.ma-tc .ma-dot{border-color:var(--ma-fb);box-shadow:0 3px 10px rgba(0,0,0,.4),0 0 14px color-mix(in srgb,var(--ma-fc) 70%,transparent)}
.ma-tc[data-fase=essencial] .ma-dot,.ma-tc[data-fase=desafio] .ma-dot{border-color:var(--ma-g1)}
.ma-tc .ma-mark{opacity:.85}
@media(max-width:860px){.ma-squad{width:clamp(250px,34vw,330px)}.ma-pcts{padding-bottom:0}}
@media(max-width:640px){
  .ma{border-radius:20px;padding-top:16px}
  .ma-top{display:block}
  .ma-squad{position:absolute;top:-4px;right:-8px;width:min(52%,210px);margin:0;aspect-ratio:440/150}
  .m-trovao,.m-mago{display:none}.m-azul{left:6%;height:96%}.m-ouro{left:44%;height:84%}
  .ma-valor{font-size:clamp(38px,11vw,48px)}
  .ma-pcts{width:100%;padding-bottom:0;margin-top:2px}.ma-pct{flex:1 1 0;justify-content:center;min-width:0;padding:6px 8px}
  .ma-frase{margin-top:10px;font-size:13px}
  .ma-data{margin-left:0;width:100%}
  .ma-labels em{letter-spacing:.03em}
}
@media(prefers-reduced-motion:reduce){.ma-m,.ma-dot,.ma-fill::before,.ma-skel{animation:none}.ma-fill,.ma-dot{transition:none}}
`
