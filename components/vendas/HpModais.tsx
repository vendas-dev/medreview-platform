'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Copy, Hash, Info, Loader2, Search, ShieldCheck, Split, UserCheck, X, XCircle, Mail, Package, Tag, User, Wallet } from 'lucide-react'
import type { TrocaRow } from '@/lib/vendas/types'
import { fmtBRL, fmtDataHora } from '@/lib/vendas/format'
import { Btn, VerticalChip } from './ui'

// ══ Popups do superadmin na troca de venda: "Consultar HP" (só lê) e "Transferir Venda" (grava e confirma) ════════════
const COR = { ok: '#16a34a', atencao: '#d97706', erro: '#dc2626', info: '#6366f1' }
const TOM_ICONE = { ok: CheckCircle2, atencao: AlertTriangle, erro: XCircle, info: Info } as const
const lbl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }

function Shell({ cor, icone, titulo, subtitulo, onClose, children, rodape, dataV }: { cor: string; icone: ReactNode; titulo: string; subtitulo?: ReactNode; onClose: () => void; children: ReactNode; rodape?: ReactNode; dataV: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = prev }
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <motion.div data-v={dataV} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,14,30,.55)', backdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div role="dialog" aria-modal="true" aria-label={titulo} initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        style={{ width: 'min(680px, 100%)', maxHeight: 'min(90vh, 860px)', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 26, boxShadow: '0 40px 90px -30px rgba(0,0,0,.55)', overflow: 'hidden' }}>
        <div style={{ position: 'relative', padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16, background: `linear-gradient(135deg, color-mix(in srgb, ${cor} 16%, var(--card)), color-mix(in srgb, ${cor} 5%, var(--card)))`, borderBottom: `1px solid color-mix(in srgb, ${cor} 25%, var(--border))` }}>
          <span aria-hidden style={{ position: 'absolute', inset: '0 auto 0 0', width: 6, background: cor }} />
          <span style={{ width: 48, height: 48, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 65%, #000))`, boxShadow: `0 10px 24px -10px ${cor}`, flexShrink: 0 }}>{icone}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 data-v="hp-titulo" style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>{titulo}</h3>
            {subtitulo && <div style={{ marginTop: 3, fontSize: 13, color: 'var(--muted-foreground)' }}>{subtitulo}</div>}
          </div>
          <button type="button" data-v="hp-fechar-x" aria-label="Fechar" onClick={onClose} className="vd-btn" style={{ width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={17} /></button>
        </div>
        <div style={{ padding: '22px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
        <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', background: 'var(--secondary)' }}>{rodape}<Btn data-v="hp-fechar" onClick={onClose}>Fechar</Btn></div>
      </motion.div>
    </motion.div>, document.body)
}
const Secao = ({ titulo, children, dataV }: { titulo: string; children: ReactNode; dataV?: string }) => <section data-v={dataV}><div style={{ ...lbl, marginBottom: 10 }}>{titulo}</div>{children}</section>
function Tile({ icon, rotulo, children, dataV, full }: { icon: ReactNode; rotulo: string; children: ReactNode; dataV: string; full?: boolean }) {
  return <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--secondary)', minWidth: 0, gridColumn: full ? '1 / -1' : undefined }}><div style={lbl}>{icon}{rotulo}</div><div data-v={dataV} style={{ marginTop: 6, fontSize: 14.5, fontWeight: 700, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>{children}</div></div>
}
function Linha({ tom, titulo, texto }: { tom: keyof typeof COR; titulo?: string; texto: string }) {
  const Ic = TOM_ICONE[tom], c = COR[tom]
  return (
    <div data-v="hp-linha" data-tom={tom} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 14, background: `color-mix(in srgb, ${c} 7%, var(--card))`, border: `1px solid color-mix(in srgb, ${c} 22%, transparent)` }}>
      <Ic size={18} color={c} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--foreground)' }}>{titulo && <strong style={{ display: 'block', fontSize: 11.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: c, marginBottom: 2 }}>{titulo}</strong>}{texto}</div>
    </div>
  )
}
const copiar = (t: string) => { try { void navigator.clipboard.writeText(t) } catch { /* */ } }

// ── Consultar HP ─────────────────────────────────────────────────────────────────────────────────────────────────
export function ConsultarHpModal({ troca, onClose }: { troca: TrocaRow; onClose: () => void }) {
  const [d, setD] = useState<any>(null); const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const r = await fetch(`/api/admin/trocas/${troca.id}/consultar-hp`, { cache: 'no-store' }); const j = await r.json().catch(() => ({}))
        if (off) return; if (!r.ok) setErro(j.error ?? 'Não foi possível consultar o HP.'); else setD(j)
      } catch { if (!off) setErro('Erro de conexão. Tente de novo.') }
    })()
    return () => { off = true }
  }, [troca.id])
  const achou = d?.encontrada === true, conf = d?.conferencia?.resumo as string | undefined
  const estado = erro ? { cor: COR.erro, t: 'Não foi possível consultar', i: <XCircle size={24} /> }
    : !d ? { cor: COR.info, t: 'Consultando o banco…', i: <Loader2 size={24} className="vd-spin" /> }
    : !achou ? { cor: COR.erro, t: 'HP não encontrado no banco', i: <XCircle size={24} /> }
    : d.duplicada ? { cor: COR.atencao, t: 'HP duplicado no banco', i: <AlertTriangle size={24} /> }
    : conf === 'confere' ? { cor: COR.ok, t: 'HP encontrado e confere', i: <ShieldCheck size={24} /> }
    : { cor: COR.atencao, t: 'HP encontrado — confira as divergências', i: <AlertTriangle size={24} /> }
  const v = d?.venda
  return (
    <Shell dataV="hp-modal-consulta" cor={estado.cor} icone={estado.i} titulo={estado.t} onClose={onClose}
      subtitulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hash size={13} /><span data-v="hp-id" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{troca.transaction_id}</span> · pedido de {troca.requester_name}</span>}>
      {!d && !erro && <div data-v="hp-carregando" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 54, borderRadius: 14, background: 'var(--secondary)', opacity: 0.7 }} />)}</div>}
      {erro && <div data-v="hp-erro" role="alert"><Linha tom="erro" texto={erro} /></div>}
      {d && !achou && (<>
        <div data-v="hp-nao-encontrado"><Linha tom="erro" titulo="Não existe venda com este HP" texto={d.mensagem} /></div>
        <Secao titulo="Você quis dizer?" dataV="hp-parecidas">
          {d.parecidas?.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{d.parecidas.map((p: any) => (
            <div key={p.hp} data-v="hp-parecida" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: 'var(--secondary)' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: 14 }}>{p.hp}</div><div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', overflowWrap: 'anywhere' }}>{p.nome} · {p.produto} · {fmtBRL(p.valor)} · {fmtDataHora(p.data)}</div></div>
              <span style={{ fontSize: 11, fontWeight: 800, color: COR.info }}>{p.motivo}</span>
              <button type="button" className="vd-btn" title="Copiar HP" onClick={() => copiar(p.hp)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)' }}><Copy size={14} /></button>
            </div>))}</div>
            : <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted-foreground)' }}>Nenhuma venda parecida encontrada (nem pelo início do ID, nem pelo nome do lead).</p>}
        </Secao>
      </>)}
      {d && achou && (<>
        {d.duplicada && <div data-v="hp-duplicado"><Linha tom="atencao" titulo="Atenção" texto={`Existem ${d.quantidade} vendas com este HP. Mostrando a mais recente. A transferência fica bloqueada até corrigir a duplicidade.`} /></div>}
        <Secao titulo="Dados da venda no banco" dataV="hp-dados">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            <Tile icon={<User size={13} />} rotulo="Nome do Lead" dataV="hp-nome">{v.nome ?? '—'}</Tile>
            <Tile icon={<Mail size={13} />} rotulo="E-mail" dataV="hp-email">{v.email ?? '—'}</Tile>
            <Tile icon={<Tag size={13} />} rotulo="Vertical" dataV="hp-vertical">{v.vertical ? <VerticalChip v={v.vertical} /> : '—'}</Tile>
            <Tile icon={<Wallet size={13} />} rotulo="Valor" dataV="hp-valor"><span style={{ fontSize: 17, fontWeight: 900 }}>{fmtBRL(v.valor)}</span></Tile>
            <Tile icon={<Package size={13} />} rotulo="Produto" dataV="hp-produto" full>{v.produto ?? '—'}</Tile>
            <Tile icon={<Tag size={13} />} rotulo="Cupom" dataV="hp-cupom">{v.cupom ? <span style={{ fontFamily: 'ui-monospace, monospace', padding: '2px 9px', borderRadius: 8, background: 'color-mix(in srgb, #6366f1 12%, transparent)', color: '#6366f1' }}>{v.cupom}</span> : <span style={{ color: 'var(--muted-foreground)' }}>sem cupom</span>}</Tile>
            <Tile icon={<Hash size={13} />} rotulo="Data da venda" dataV="hp-data">{fmtDataHora(v.data)}</Tile>
          </div>
        </Secao>
        <Secao titulo="Como esta venda está no banco" dataV="hp-traducao">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{d.traducao.linhas.map((l: any) => <Linha key={l.chave} tom={l.tom} titulo={l.titulo} texto={l.texto} />)}</div>
          <p data-v="hp-sugestao" style={{ margin: '12px 2px 0', fontSize: 13, lineHeight: 1.55, color: 'var(--muted-foreground)' }}><strong style={{ color: 'var(--foreground)' }}>O que fazer: </strong>{d.traducao.sugestao}</p>
          {d.parcelas?.outras > 0 && <p data-v="hp-parcelas" style={{ margin: '6px 2px 0', fontSize: 12.5, color: 'var(--muted-foreground)' }}>Esta assinatura tem mais {d.parcelas.outras} parcela(s) registrada(s); {d.parcelas.pendentes} ainda não {d.parcelas.pendentes === 1 ? 'é' : 'são'} de {d.pedido.closer}.</p>}
        </Secao>
        <Secao titulo="Confere com o que o closer digitou?" dataV="hp-conferencia">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{d.conferencia.campos.filter((c: any) => c.status === 'confere').map((c: any) => <span key={c.campo} data-v="hp-conf-ok" title={`“${c.banco}”`} className="vd-chip" style={{ padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, color: COR.ok, background: `color-mix(in srgb, ${COR.ok} 12%, transparent)` }}><CheckCircle2 size={14} />{c.rotulo} confere</span>)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: d.conferencia.campos.some((c: any) => c.status !== 'confere') ? 10 : 0 }}>{d.conferencia.campos.filter((c: any) => c.status !== 'confere').map((c: any) => (
            <Linha key={c.campo} tom={c.status === 'diverge' ? 'atencao' : 'info'} titulo={c.rotulo}
              texto={c.status === 'diverge' ? `Diverge — o closer informou “${c.pedido}”, mas no banco está “${c.banco}”` : `Sem dado no banco para comparar (o closer informou “${c.pedido}”)`} />))}</div>
        </Secao>
      </>)}
    </Shell>
  )
}

// ── Transferir Venda ─────────────────────────────────────────────────────────────────────────────────────────────
type Estado = { fase: 'executando' } | { fase: 'ok'; r: any } | { fase: 'erro'; msg: string }
export function TransferirVendaModal({ troca, onClose, onTransferida }: { troca: TrocaRow; onClose: () => void; onTransferida?: (r: any) => void }) {
  const [e, setE] = useState<Estado>({ fase: 'executando' }); const iniciou = useRef(false)
  const executar = useCallback(async (corpo: Record<string, any>) => {
    setE({ fase: 'executando' })
    try {
      const r = await fetch(`/api/admin/trocas/${troca.id}/transferir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }); const j = await r.json().catch(() => ({}))
      if (!r.ok) { setE({ fase: 'erro', msg: j.error ?? 'Não foi possível transferir a venda.' }); return }
      setE({ fase: 'ok', r: j }); if (j.resultado === 'transferida' || j.resultado === 'parcial') onTransferida?.(j)
    } catch { setE({ fase: 'erro', msg: 'Erro de conexão. Nada foi confirmado: consulte o HP para ver como ficou.' }) }
  }, [troca.id, onTransferida])
  useEffect(() => { if (iniciou.current) return; iniciou.current = true; void executar({}) }, [executar])      // 1 clique = 1 transferência (a guarda evita rodar 2× no modo estrito do React)
  const r = e.fase === 'ok' ? e.r : null, res = r?.resultado as string | undefined
  const cor = e.fase === 'executando' ? COR.info : e.fase === 'erro' ? COR.erro : res === 'transferida' ? COR.ok : res === 'parcial' || res === 'precisa_escolher' ? COR.atencao : res === 'nada_a_fazer' ? COR.info : COR.erro
  const icone = e.fase === 'executando' ? <Loader2 size={24} className="vd-spin" /> : res === 'transferida' ? <CheckCircle2 size={24} /> : res === 'precisa_escolher' ? <Split size={24} /> : res === 'nada_a_fazer' ? <UserCheck size={24} /> : res === 'parcial' ? <AlertTriangle size={24} /> : <XCircle size={24} />
  const titulo = e.fase === 'executando' ? 'Transferindo a venda…' : e.fase === 'erro' ? 'Não foi possível transferir' : r.titulo
  const pend = r?.parcelas?.pendentes ?? 0
  return (
    <Shell dataV="hp-modal-transferir" cor={cor} icone={icone} titulo={titulo} onClose={onClose}
      subtitulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowRightLeft size={13} />HP <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{troca.transaction_id}</span> → {troca.requester_name}</span>}
      rodape={res === 'transferida' || res === 'parcial' ? <span data-v="hp-proximo-passo" style={{ marginRight: 'auto', fontSize: 12.5, color: 'var(--muted-foreground)' }}>Agora escreva a justificativa e confirme a concessão.</span> : undefined}>
      {e.fase === 'executando' && <div data-v="hp-executando" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 2px', color: 'var(--muted-foreground)', fontSize: 14 }}><Loader2 size={20} className="vd-spin" />Verificando o HP no banco, gravando a transferência e conferindo o resultado…</div>}
      {e.fase === 'erro' && <div data-v="hp-erro" role="alert"><Linha tom="erro" texto={e.msg} /></div>}
      {r && (<>
        <div data-v="hp-resultado" data-resultado={res}><Linha tom={res === 'transferida' ? 'ok' : res === 'precisa_escolher' || res === 'parcial' ? 'atencao' : res === 'nada_a_fazer' ? 'info' : 'erro'} texto={r.mensagem} /></div>
        {res === 'precisa_escolher' && (
          <Secao titulo="Como transferir?" dataV="hp-escolha">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
              <button type="button" data-v="hp-opcao-dividir" className="vd-btn" onClick={() => executar({ modo: 'dividir' })} style={{ textAlign: 'left', padding: 16, borderRadius: 16, border: '1.5px solid var(--border)', background: 'var(--card)', cursor: 'pointer', color: 'var(--foreground)' }}>
                <Split size={20} color={COR.info} /><div style={{ marginTop: 8, fontWeight: 800, fontSize: 15 }}>Dividir o crédito</div><div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{troca.requester_name} entra como <strong>co-closer</strong> e {r.outro} continua como closer. Os dois recebem; o total da empresa não duplica.</div>
              </button>
              <button type="button" data-v="hp-opcao-total" className="vd-btn" onClick={() => executar({ modo: 'total' })} style={{ textAlign: 'left', padding: 16, borderRadius: 16, border: '1.5px solid var(--border)', background: 'var(--card)', cursor: 'pointer', color: 'var(--foreground)' }}>
                <ArrowRightLeft size={20} color={COR.atencao} /><div style={{ marginTop: 8, fontWeight: 800, fontSize: 15 }}>Transferir totalmente</div><div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{troca.requester_name} passa a ser o <strong>dono</strong> da venda e {r.outro} deixa de ter o crédito.</div>
              </button>
            </div>
          </Secao>
        )}
        {r.checks?.length > 0 && (
          <Secao titulo="Conferência no banco" dataV="hp-checks">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{r.checks.map((c: any, i: number) => <Linha key={i} tom={c.ok ? 'ok' : c.aviso ? 'atencao' : 'erro'} texto={c.texto} />)}</div>
          </Secao>
        )}
        {(res === 'transferida' || res === 'parcial') && r.depois?.length > 0 && (
          <Secao titulo="Como ficou" dataV="hp-depois"><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{r.depois.map((l: any) => <Linha key={l.chave} tom={l.tom} titulo={l.titulo} texto={l.texto} />)}</div></Secao>
        )}
        {(res === 'transferida' || res === 'parcial' || res === 'nada_a_fazer') && pend > 0 && r.parcelas?.aplicadas === 0 && (
          <div data-v="hp-parcelas-bloco" style={{ padding: 16, borderRadius: 16, background: 'color-mix(in srgb, #6366f1 7%, var(--card))', border: '1px dashed color-mix(in srgb, #6366f1 40%, transparent)' }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>Esta é uma assinatura recorrente: existem <strong>{pend}</strong> parcela(s) já registrada(s) que ainda não {pend === 1 ? 'é' : 'são'} de {troca.requester_name}. As próximas já seguem a regra gravada; as anteriores só mudam se você pedir.</div>
            <div style={{ marginTop: 12 }}><Btn data-v="hp-aplicar-parcelas" variant="soft" icon={<Copy size={15} />} onClick={() => executar({ modo: r.modo, incluir_parcelas: true })}>Aplicar também às {pend} parcela(s) anterior(es)</Btn></div>
          </div>
        )}
      </>)}
    </Shell>
  )
}
