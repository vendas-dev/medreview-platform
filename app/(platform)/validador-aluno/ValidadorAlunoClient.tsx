'use client'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { UserCheck, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2, UserPlus, History, CalendarRange, Copy, Check, RotateCcw, type LucideIcon } from 'lucide-react'
import { dataBR, diasAte, emailValido, normalizarEmail, progressoMatricula, type TipoAluno } from '@/lib/aluno/tipo'

interface Resp { email: string; tipo: TipoAluno; inicio: string | null; fim: string | null; ativas: number; expiradas: number }
const COR: Record<TipoAluno, { c: string; icone: LucideIcon; frase: string }> = {
  'Aluno':      { c: '#16a34a', icone: CheckCircle2, frase: 'Já é aluno, com matrícula ativa.' },
  'Ex-aluno':   { c: '#d97706', icone: History,      frase: 'Já foi aluno, mas não tem matrícula ativa agora.' },
  'Novo aluno': { c: '#2563eb', icone: UserPlus,     frase: 'Nunca teve matrícula: é um novo aluno.' },
}
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// Contagem animada (só transform/opacity e um número: leve). Sem animação, devolve o alvo direto.
function useContagem(alvo: number, ativo: boolean) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!ativo) return
    let raf = 0; const t0 = performance.now()
    const f = (t: number) => { const p = Math.min(1, (t - t0) / 900); setV(Math.round(alvo * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [alvo, ativo])
  return ativo ? v : alvo
}

function Dias({ dias, anima }: { dias: number; anima: boolean }) {
  const n = useContagem(Math.max(dias, 0), anima && dias > 1)
  if (dias > 1) return <><strong data-v="validador-dias" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</strong> dias restantes</>
  if (dias === 1) return <>Termina <strong>amanhã</strong></>
  if (dias === 0) return <>Termina <strong>hoje</strong></>
  return <>Terminou há <strong>{-dias}</strong> dia(s)</>
}

export function ValidadorAlunoClient() {
  const rm = !!useReducedMotion()
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [res, setRes] = useState<Resp | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [recentes, setRecentes] = useState<{ email: string; tipo: TipoAluno }[]>([])
  const [tremida, setTremida] = useState(0)
  const ref = useRef<HTMLInputElement>(null)

  async function validar(e?: React.FormEvent, forcado?: string) {
    e?.preventDefault()
    if (carregando) return
    const em = normalizarEmail(forcado ?? email)
    setRes(null)
    if (!emailValido(em)) { setErro('Digite um e-mail válido.'); setTremida(x => x + 1); return }
    if (forcado) setEmail(em)
    setErro(null); setCarregando(true)
    try {
      const r = await fetch('/api/validador-aluno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j?.error ?? 'Não foi possível validar agora.'); setTremida(x => x + 1) }
      else { setRes(j as Resp); setRecentes(l => [{ email: j.email, tipo: j.tipo as TipoAluno }, ...l.filter(x => x.email !== j.email)].slice(0, 5)) }
    } catch { setErro('Sem conexão. Tente de novo.'); setTremida(x => x + 1) }
    finally { setCarregando(false) }
  }

  function nova() { setRes(null); setErro(null); setEmail(''); setCopiado(false); ref.current?.focus() }
  async function copiar() {
    if (!res) return
    const per = res.tipo === 'Aluno' ? ` (matrícula ${dataBR(res.inicio)} → ${dataBR(res.fim)})` : ''
    try { await navigator.clipboard.writeText(`${res.email}: ${res.tipo}${per}`); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sem permissão de área de transferência */ }
  }

  const acc = res ? COR[res.tipo].c : 'var(--primary)'
  const hoje = hojeSP()
  const dias = res?.tipo === 'Aluno' ? diasAte(res.fim, hoje) : null
  const pct = res?.tipo === 'Aluno' ? progressoMatricula(res.inicio, res.fim, hoje) : null
  const dur = (s: number) => (rm ? 0 : s)

  return (
    <div className="va" style={{ ['--acc' as string]: acc }}>
      <style>{CSS}</style>
      <div className="va-glow" aria-hidden>
        <AnimatePresence>
          <motion.div key={acc} className="va-glow-i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur(0.6) }} />
        </AnimatePresence>
      </div>

      <motion.header className="va-head" initial={rm ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur(0.5), ease: [0.22, 1, 0.36, 1] }}>
        <div className="va-badge"><span className="va-ring" aria-hidden /><UserCheck size={26} /></div>
        <h1>Validador de Tipo de Aluno</h1>
        <p>Digite o e-mail do lead e descubra na hora se é <b>novo aluno</b>, <b>ex-aluno</b> ou <b>aluno</b>.</p>
      </motion.header>

      <motion.form onSubmit={validar} initial={rm ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur(0.5), delay: dur(0.08), ease: [0.22, 1, 0.36, 1] }}>
        <motion.div key={tremida} className={`va-bar${erro ? ' err' : ''}`} animate={!rm && tremida ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.38 }}>
          <Mail size={20} className="va-mail" aria-hidden />
          <input ref={ref} data-v="validador-email" type="email" inputMode="email" autoComplete="off" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="email@do-lead.com" aria-label="E-mail do lead" aria-invalid={!!erro} />
          <motion.button data-v="validador-enviar" type="submit" disabled={carregando || !email.trim()} whileHover={rm ? undefined : { scale: 1.03 }} whileTap={rm ? undefined : { scale: 0.96 }}>
            {carregando ? <Loader2 size={18} className="va-spin" /> : <>Validar<ArrowRight size={17} /></>}
          </motion.button>
          {carregando && <span className="va-scan" aria-hidden />}
        </motion.div>
      </motion.form>

      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {erro && (
            <motion.div key="erro" role="alert" data-v="validador-erro" className="va-erro" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: dur(0.2) }}>
              <AlertCircle size={18} />{erro}
            </motion.div>
          )}
          {carregando && (
            <motion.div key="load" className="va-card va-skel" aria-label="Consultando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur(0.2) }}>
              <div className="va-sk r1" /><div className="va-sk r2" /><div className="va-sk r3" />
            </motion.div>
          )}
          {res && !carregando && (() => { const { c, icone: Icone, frase } = COR[res.tipo]; return (
            <motion.section key={res.email + res.tipo} data-v="validador-resultado" data-tipo={res.tipo} className="va-card va-res" style={{ ['--acc' as string]: c }}
              initial={rm ? false : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
              <div className="va-res-top">
                <motion.div className="va-res-ico" initial={rm ? false : { scale: 0.4, rotate: -14 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 16, delay: dur(0.12) }}>
                  <span className="va-pop" aria-hidden /><Icone size={30} />
                </motion.div>
                <div style={{ minWidth: 0 }}>
                  <div className="va-mail-r">{res.email}</div>
                  <motion.div className="va-tipo" initial={rm ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: dur(0.18), duration: dur(0.35) }}>{res.tipo}</motion.div>
                  <div className="va-frase">{frase}</div>
                </div>
              </div>

              {res.tipo === 'Aluno' && (
                <motion.div className="va-per" initial={rm ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: dur(0.3), duration: dur(0.4) }}>
                  <div className="va-per-t"><CalendarRange size={14} />Matrícula ativa mais recente</div>
                  <div className="va-tiles">
                    <div className="va-tile"><span>Início</span><b data-v="validador-inicio">{dataBR(res.inicio)}</b></div>
                    <div className="va-tile"><span>Fim</span><b data-v="validador-fim">{dataBR(res.fim)}</b></div>
                  </div>
                  {pct !== null && (
                    <div className="va-prog" aria-label={`${pct}% da matrícula já passou`}>
                      <div className="va-track">
                        <motion.div className="va-fill" initial={rm ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: dur(1.1), delay: dur(0.45), ease: [0.22, 1, 0.36, 1] }} />
                        <motion.span className="va-now" initial={rm ? false : { left: '0%' }} animate={{ left: `${pct}%` }} transition={{ duration: dur(1.1), delay: dur(0.45), ease: [0.22, 1, 0.36, 1] }} />
                      </div>
                      <div className="va-prog-l"><span>{pct}% do período</span>{dias !== null && <span><Dias dias={dias} anima={!rm} /></span>}</div>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="va-acts">
                <button type="button" onClick={copiar} data-v="validador-copiar">{copiado ? <><Check size={15} />Copiado!</> : <><Copy size={15} />Copiar resultado</>}</button>
                <button type="button" onClick={nova} data-v="validador-nova"><RotateCcw size={15} />Nova consulta</button>
              </div>
            </motion.section>
          ) })()}
        </AnimatePresence>
      </div>

      {recentes.length > 0 && (
        <motion.div className="va-rec" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: dur(0.2) }}>
          <div className="va-rec-t">Consultados agora há pouco</div>
          <div className="va-rec-l">
            {recentes.map(r => (
              <button key={r.email} type="button" onClick={() => validar(undefined, r.email)} disabled={carregando} title={`Consultar de novo: ${r.email}`}>
                <i style={{ background: COR[r.tipo].c }} />
                <span>{r.email}</span><em>{r.tipo}</em>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

const CSS = `
.va{position:relative;max-width:700px;margin:0 auto;padding:clamp(28px,7vh,64px) 0 64px;isolation:isolate}
.va-glow{position:absolute;inset:0 -10% auto -10%;height:420px;z-index:-1;pointer-events:none;overflow:hidden}
.va-glow-i{position:absolute;left:50%;top:-120px;width:640px;height:420px;margin-left:-320px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--acc) 30%,transparent),transparent 72%);filter:blur(8px)}
.va-head{text-align:center;margin-bottom:28px}
.va-badge{position:relative;display:grid;place-items:center;width:64px;height:64px;margin:0 auto 16px;border-radius:20px;color:#fff;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 55%,#7c3aed));box-shadow:0 16px 34px -14px color-mix(in srgb,var(--primary) 80%,transparent)}
.va-ring{position:absolute;inset:0;border-radius:20px;border:2px solid var(--primary);opacity:0;animation:va-ring 2.6s ease-out infinite}
.va-head h1{margin:0;font-size:clamp(24px,5vw,32px);font-weight:800;letter-spacing:-.035em;color:var(--foreground);line-height:1.1}
.va-head p{margin:10px auto 0;max-width:430px;font-size:14px;line-height:1.5;color:var(--muted-foreground)}
.va-head p b{color:var(--foreground);font-weight:700;white-space:nowrap}
.va-bar{position:relative;display:flex;align-items:center;gap:10px;height:64px;padding:0 8px 0 18px;border-radius:20px;background:var(--card);border:1.5px solid var(--border);box-shadow:0 14px 34px -22px rgba(0,0,0,.45);overflow:hidden;transition:border-color .2s,box-shadow .2s}
.va-bar:focus-within{border-color:color-mix(in srgb,var(--primary) 70%,var(--border));box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 18%,transparent),0 14px 34px -22px rgba(0,0,0,.45)}
.va-bar.err{border-color:color-mix(in srgb,#ef4444 65%,var(--border));box-shadow:0 0 0 4px color-mix(in srgb,#ef4444 14%,transparent)}
.va-mail{flex:none;color:var(--muted-foreground)}
.va-bar:focus-within .va-mail{color:var(--primary)}
.va-bar input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--foreground);font-size:16px;font-weight:500}
.va-bar input::placeholder{color:var(--muted-foreground);opacity:.7}
.va-bar button{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:116px;height:48px;padding:0 20px;border:0;border-radius:14px;cursor:pointer;color:#fff;font-size:14.5px;font-weight:700;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 62%,#7c3aed));box-shadow:0 10px 22px -12px color-mix(in srgb,var(--primary) 90%,transparent)}
.va-bar button:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.va-scan{position:absolute;left:0;bottom:0;height:3px;width:34%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--primary),transparent);animation:va-scan 1.1s ease-in-out infinite}
.va-spin{animation:va-rot .8s linear infinite}
.va-erro{display:flex;align-items:center;gap:10px;margin-top:16px;padding:13px 16px;border-radius:14px;font-size:13.5px;color:var(--foreground);background:color-mix(in srgb,#ef4444 10%,var(--card));border:1px solid color-mix(in srgb,#ef4444 38%,transparent)}
.va-erro svg{flex:none;color:#ef4444}
.va-card{margin-top:18px;padding:22px;border-radius:24px;background:var(--card);border:1.5px solid var(--border)}
.va-skel{display:grid;gap:12px}
.va-sk{border-radius:12px;background:linear-gradient(100deg,var(--secondary) 30%,color-mix(in srgb,var(--primary) 12%,var(--secondary)) 50%,var(--secondary) 70%);background-size:220% 100%;animation:va-sh 1.3s linear infinite}
.va-sk.r1{height:64px;width:72%}.va-sk.r2{height:54px}.va-sk.r3{height:14px;width:55%}
.va-res{border-color:color-mix(in srgb,var(--acc) 50%,var(--border));background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 9%,var(--card)),var(--card) 55%);box-shadow:0 24px 50px -28px var(--acc)}
.va-res-top{display:flex;align-items:center;gap:16px}
.va-res-ico{position:relative;flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:20px;color:#fff;background:linear-gradient(135deg,var(--acc),color-mix(in srgb,var(--acc) 62%,#000));box-shadow:0 14px 28px -12px var(--acc)}
.va-pop{position:absolute;inset:0;border-radius:20px;border:2px solid var(--acc);animation:va-pop 1.2s ease-out .25s 2 both}
.va-mail-r{font-size:12.5px;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.va-tipo{font-size:clamp(30px,7vw,40px);font-weight:800;letter-spacing:-.04em;line-height:1.05;color:var(--acc);margin-top:2px}
.va-frase{margin-top:4px;font-size:13.5px;color:var(--muted-foreground)}
.va-per{margin-top:20px;padding-top:18px;border-top:1px solid color-mix(in srgb,var(--acc) 22%,var(--border))}
.va-per-t{display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-foreground)}
.va-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.va-tile{padding:12px 14px;border-radius:14px;background:var(--secondary)}
.va-tile span{display:block;font-size:11.5px;color:var(--muted-foreground)}
.va-tile b{display:block;margin-top:2px;font-size:clamp(18px,4.6vw,22px);font-weight:800;letter-spacing:-.025em;color:var(--foreground);font-variant-numeric:tabular-nums}
.va-prog{margin-top:16px}
.va-track{position:relative;height:10px;border-radius:99px;background:var(--secondary)}
.va-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 55%,transparent),var(--acc))}
.va-now{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff;border:4px solid var(--acc);box-shadow:0 4px 10px -2px var(--acc)}
.va-prog-l{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:12.5px;color:var(--muted-foreground)}
.va-prog-l strong{color:var(--foreground)}
.va-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.va-acts button{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:11px;border:1px solid var(--border);background:var(--secondary);color:var(--foreground);font-size:13px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
.va-acts button:hover{border-color:color-mix(in srgb,var(--acc) 50%,var(--border));background:color-mix(in srgb,var(--acc) 10%,var(--secondary))}
.va-acts button:active{transform:scale(.97)}
.va-rec{margin-top:26px}
.va-rec-t{margin-bottom:8px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-foreground)}
.va-rec-l{display:flex;flex-wrap:wrap;gap:8px}
.va-rec-l button{display:inline-flex;align-items:center;gap:8px;max-width:100%;height:34px;padding:0 12px;border-radius:99px;border:1px solid var(--border);background:var(--card);color:var(--foreground);font-size:12.5px;cursor:pointer;transition:border-color .15s,transform .15s}
.va-rec-l button:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 55%,var(--border));transform:translateY(-1px)}
.va-rec-l i{flex:none;width:8px;height:8px;border-radius:50%}
.va-rec-l span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.va-rec-l em{flex:none;font-style:normal;font-weight:700;color:var(--muted-foreground)}
@keyframes va-ring{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}
@keyframes va-pop{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.55)}}
@keyframes va-scan{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
@keyframes va-sh{0%{background-position:120% 0}100%{background-position:-120% 0}}
@keyframes va-rot{to{transform:rotate(360deg)}}
@media(max-width:520px){.va-bar{height:58px;padding-left:14px}.va-bar button{min-width:0;padding:0 14px}.va-res-top{gap:12px}.va-res-ico{width:54px;height:54px}.va-card{padding:18px}}
@media(prefers-reduced-motion:reduce){.va-ring,.va-pop,.va-scan,.va-sk,.va-spin{animation:none}.va-scan{width:100%;opacity:.5}}
`
