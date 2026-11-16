'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCircle2, Clock, Copy, ExternalLink, Hash, Loader2, MessageCircle, Package, Pencil, Quote, Save, ThumbsDown, ThumbsUp, User, X, XCircle, ChevronDown } from 'lucide-react'
import type { Decisao, TrocaRow } from '@/lib/vendas/types'
import { fmtDataHora, teamCor } from '@/lib/vendas/format'
import { Avatar, Banner, Btn, TeamBadge, TextArea, VerticalChip } from './ui'
import { ArrowRightLeft, Search as SearchIcon } from 'lucide-react'
import { ConsultarHpModal, TransferirVendaModal } from './HpModais'

export const COR_STATUS = { pendente: '#f59e0b', concedida: '#16a34a', negada: '#dc2626', resolvida: '#64748b' }
const lbl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }
const statusDe = (t: TrocaRow): 'pendente' | 'concedida' | 'negada' | 'resolvida' => (t.status === 'pendente' ? 'pendente' : t.decision ?? 'resolvida')
const ROTULO = { pendente: 'Pendente', concedida: 'Concedida', negada: 'Negada', resolvida: 'Resolvida' }

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div style={{ minWidth: 0 }}><div style={lbl}>{icon}{label}</div><div style={{ marginTop: 7, fontSize: 15, fontWeight: 700, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>{children}</div></div>
}

/** Botão de link do pedido. UM link: abre direto (como sempre). DOIS links do mesmo tipo: abre um pequeno popup com os dois, cada um com o seu "abrir". */
const estiloLink = (cor: string, tint: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 9, height: 42, padding: '0 18px', borderRadius: 13, textDecoration: 'none', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: cor, background: `color-mix(in srgb,${tint} 11%,transparent)`, border: `1px solid color-mix(in srgb,${tint} 26%,transparent)` })
function LinkBotao({ links, rotulo, titulo, itemRotulo, cor, tint, icon, dataV }: { links: string[]; rotulo: string; titulo: string; itemRotulo: string; cor: string; tint: string; icon: React.ReactNode; dataV: string }) {
  const [aberto, setAberto] = useState(false)
  const primeiro = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!aberto) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('keydown', k)
    const f = requestAnimationFrame(() => primeiro.current?.focus())          // o React só aplica autoFocus em campos e botões, não em links
    return () => { document.removeEventListener('keydown', k); cancelAnimationFrame(f) }
  }, [aberto])
  const estilo = estiloLink(cor, tint)
  if (links.length <= 1) return <a data-v={dataV} href={links[0]} target="_blank" rel="noopener noreferrer" className="vd-btn" style={estilo}>{icon}{rotulo}</a>
  return (
    <>
      <button type="button" data-v={dataV} data-links={links.length} aria-haspopup="dialog" aria-expanded={aberto} onClick={() => setAberto(true)} className="vd-btn" style={estilo}>{icon}{rotulo}<span data-v="troca-link-contador" style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, color: '#fff', background: cor }}>{links.length}</span></button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <div data-v="troca-links-fundo" className="vd" onMouseDown={e => { if (e.target === e.currentTarget) setAberto(false) }} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(10,8,28,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label={titulo} data-v="troca-links-popup" style={{ width: 'min(420px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px -18px rgba(10,8,40,.5)', padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{titulo}</div><div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--muted-foreground)' }}>Este pedido tem {links.length} links. Abra o que precisar.</div></div>
              <button type="button" data-v="troca-links-fechar" aria-label="Fechar" onClick={() => setAberto(false)} className="vd-btn vd-icon" style={{ width: 40, height: 40, flexShrink: 0, border: 'none', borderRadius: 12, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {links.map((u, i) => (
                <a key={u + i} data-v="troca-link-item" href={u} target="_blank" rel="noopener noreferrer" ref={i === 0 ? primeiro : undefined} className="vd-btn" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 14px', borderRadius: 14, textDecoration: 'none', color: 'var(--foreground)', border: '1.5px solid var(--border)', background: 'var(--background)' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cor, background: `color-mix(in srgb,${tint} 14%,transparent)` }}>{icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{itemRotulo} {i + 1}</span><span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.replace(/^https?:\/\//, '')}</span></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 13, fontWeight: 800, color: cor }}><ExternalLink size={15} />Abrir</span>
                </a>
              ))}
            </div>
          </div>
        </div>, document.body)}
    </>
  )
}

/** Um pedido de troca. Pendente = âmbar; Concedida = verde; Negada = vermelho (esmaecidos, mas voltam ao normal no hover).
 *  admin + onDecide → botões Conceder e Negar; os DOIS exigem uma justificativa, que o closer recebe. */
type Res = Promise<{ ok: boolean; error?: string }>
export function TrocaCard({ t, admin, onDecide, onEdit, onEditResposta }: { t: TrocaRow; admin?: boolean; onDecide?: (id: string, decision: Decisao, texto: string) => Res; onEdit?: (t: TrocaRow) => void; onEditResposta?: (id: string, decision: Decisao, texto: string) => Res }) {
  const st = statusDe(t); const cor = COR_STATUS[st]; const resolvida = t.status === 'resolvida'
  const [modo, setModo] = useState<Decisao | null>(null); const [texto, setTexto] = useState(''); const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<string | null>(null); const [copiado, setCopiado] = useState(false)
  // editar a RESPOSTA já enviada (superadmin): decisão + justificativa
  const [editResp, setEditResp] = useState(false); const [modo2, setModo2] = useState<Decisao>('concedida'); const [texto2, setTexto2] = useState(''); const [salvando2, setSalvando2] = useState(false); const [erro2, setErro2] = useState<string | null>(null)
  const podeEditar = !!onEdit && (admin || t.status === 'pendente')     // closer: só enquanto pendente; superadmin: sempre
  const abrirEdicaoResposta = () => { setModo2(t.decision ?? 'concedida'); setTexto2(t.response ?? ''); setErro2(null); setEditResp(true) }
  async function salvarResposta() {
    if (!texto2.trim()) { setErro2(modo2 === 'concedida' ? 'Justifique a concessão antes de salvar.' : 'Justifique a negativa antes de salvar.'); return }
    if (modo2 === t.decision && texto2.trim() === (t.response ?? '').trim()) { setErro2('Você não alterou nada.'); return }
    setSalvando2(true); setErro2(null); const r = await onEditResposta!(t.id, modo2, texto2); setSalvando2(false)
    if (!r.ok) setErro2(r.error ?? 'Não foi possível salvar.'); else setEditResp(false)
  }
  async function confirmar() {
    if (!texto.trim()) { setErro(modo === 'concedida' ? 'Justifique a concessão antes de confirmar.' : 'Justifique a negativa antes de confirmar.'); return }
    setSalvando(true); setErro(null); const r = await onDecide!(t.id, modo!, texto); setSalvando(false)
    if (!r.ok) setErro(r.error ?? 'Não foi possível resolver.')
  }
  const [hpAberto, setHpAberto] = useState(false); const [transfAberto, setTransfAberto] = useState(false); const [transferida, setTransferida] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)      // minimizada por padrão: o gestor expande só a que quer ler
  const corModo = modo ? COR_STATUS[modo] : cor
  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: resolvida ? 0.7 : 1, y: 0 }} whileHover={resolvida ? { opacity: 1 } : undefined} transition={{ duration: 0.3 }} data-v="troca" data-id={t.id} data-status={t.status} data-decision={t.decision ?? ''} data-resolved={resolvida ? 'true' : 'false'}
      className="vd-card vd-lift" style={{ position: 'relative', overflow: 'hidden', padding: '26px 28px 26px 34px' }}>
      <span aria-hidden style={{ position: 'absolute', inset: '0 auto 0 0', width: 7, background: `linear-gradient(180deg,${cor},color-mix(in srgb,${cor} 55%,transparent))` }} />
      <div data-v="troca-cabecalho" onClick={e => { if (!(e.target as HTMLElement).closest('button, a, input, textarea, select')) setAberto(a => !a) }} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', cursor: 'pointer' }}>
        <Avatar name={t.requester_name} src={t.requester_avatar} size={52} ring={teamCor(t.requester_team)} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div data-v="troca-quem" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span className="vd-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{t.requester_name}</span><TeamBadge team={t.requester_team} /></div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted-foreground)' }}>Enviada em {fmtDataHora(t.created_at)}{t.edited_at && <span data-v="troca-editada"> · editada{t.edited_by_name ? <> por <strong style={{ color: 'var(--foreground)' }}>{t.edited_by_name}</strong></> : null} em {fmtDataHora(t.edited_at)}</span>}</div>
        </div>
        <span data-v="troca-status" className="vd-chip" style={{ padding: '8px 15px', borderRadius: 99, fontSize: 13, fontWeight: 800, color: cor, background: `color-mix(in srgb, ${cor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 30%, transparent)` }}>
          {st === 'pendente' ? <Clock size={15} /> : st === 'negada' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}{ROTULO[st]}
        </span>
        {podeEditar && <Btn data-v="troca-editar" size="sm" icon={<Pencil size={14} />} onClick={() => onEdit!(t)} title="Editar a solicitação">Editar</Btn>}
        <button type="button" data-v="troca-toggle" aria-expanded={aberto} aria-controls={`troca-corpo-${t.id}`} aria-label={aberto ? 'Minimizar a solicitação' : 'Expandir a solicitação'} title={aberto ? 'Minimizar' : 'Expandir'} onClick={() => setAberto(a => !a)} className="vd-btn" style={{ width: 42, height: 42, borderRadius: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--foreground)', cursor: 'pointer', flexShrink: 0 }}><ChevronDown size={20} style={{ transition: 'transform .22s', transform: aberto ? 'rotate(180deg)' : 'none' }} /></button>
      </div>
      {!aberto && (
        <div data-v="troca-resumo" role="button" tabIndex={0} aria-expanded={false} onClick={() => setAberto(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(true) } }} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px 22px', marginTop: 18, padding: '14px 18px', borderRadius: 16, background: 'var(--secondary)', cursor: 'pointer' }}>
          <span data-v="troca-resumo-vertical"><VerticalChip v={t.vertical} /></span>
          <span data-v="troca-resumo-produto" title={t.product} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}><Package size={15} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product}</span></span>
          <span data-v="troca-resumo-hp" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}><Hash size={14} />HP<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 14, fontWeight: 800, letterSpacing: 0, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>{t.transaction_id}</code></span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div key="corpo" id={`troca-corpo-${t.id}`} data-v="troca-corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden', margin: '0 -6px -6px', padding: '0 6px 6px' }}>
      <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '22px 28px' }}>
        <Info icon={<Package size={13} />} label="Produto"><div>{t.product}</div><div style={{ marginTop: 8 }}><VerticalChip v={t.vertical} /></div></Info>
        <Info icon={<Hash size={13} />} label="ID Transação">
          <button type="button" data-v="troca-copiar" title="Copiar ID" onClick={async () => { try { await navigator.clipboard.writeText(t.transaction_id); setCopiado(true); setTimeout(() => setCopiado(false), 1200) } catch { /* */ } }} className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 11px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, fontWeight: 600 }}>{t.transaction_id}{copiado ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} style={{ color: 'var(--muted-foreground)' }} />}</button>
          {admin && <div style={{ marginTop: 10 }}><Btn data-v="troca-consultar-hp" size="sm" variant="soft" icon={<SearchIcon size={14} />} onClick={() => setHpAberto(true)} title="Conferir se este HP existe no banco e como a venda está registrada">Consultar HP</Btn></div>}
        </Info>
        <Info icon={<User size={13} />} label="Nome do Lead">{t.lead_name}</Info>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '22px 0' }}>
        <LinkBotao dataV="troca-link-hubspot" links={[t.hubspot_url, t.hubspot_url_2].filter((x): x is string => !!x)} rotulo="Negócio no HubSpot" titulo="Negócios no HubSpot" itemRotulo="Negócio" cor="#ea580c" tint="#f97316" icon={<ExternalLink size={15} />} />
        <LinkBotao dataV="troca-link-botmaker" links={[t.botmaker_url, t.botmaker_url_2].filter((x): x is string => !!x)} rotulo="Conversa no Botmaker" titulo="Conversas no Botmaker" itemRotulo="Conversa" cor="#2563eb" tint="#3b82f6" icon={<MessageCircle size={15} />} />
      </div>
      <div style={{ padding: '18px 20px', borderRadius: 16, background: 'var(--secondary)' }}>
        <div style={lbl}><Quote size={13} />Motivo da troca</div>
        <p data-v="troca-motivo-texto" style={{ margin: '9px 0 0', fontSize: 14.5, lineHeight: 1.65, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{t.reason}</p>
      </div>
      {resolvida && (
        <div data-v="troca-resposta" data-decisao={st} style={{ marginTop: 18, padding: '18px 20px', borderRadius: 16, background: `color-mix(in srgb, ${cor} 8%, var(--card))`, border: `1px solid color-mix(in srgb, ${cor} 30%, transparent)`, borderLeft: `5px solid ${cor}` }}>
          <div style={{ ...lbl, color: cor }}>{st === 'negada' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}{st === 'concedida' ? 'Troca concedida' : st === 'negada' ? 'Troca negada' : 'Resposta'}</div>
          <p style={{ margin: '9px 0 14px', fontSize: 14.5, lineHeight: 1.65, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{t.response}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={t.resolved_by_name ?? 'Superadmin'} src={t.resolved_by_avatar} size={28} />
            <span data-v="troca-resposta-quem" style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{st === 'negada' ? 'Negada' : st === 'concedida' ? 'Concedida' : 'Respondida'} por <strong style={{ color: 'var(--foreground)' }}>{t.resolved_by_name ?? 'Superadmin'}</strong> em {fmtDataHora(t.resolved_at)}</span>
          </div>
          {t.response_edited_at && <div data-v="troca-resposta-editada" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted-foreground)' }}>Resposta editada{t.response_edited_by_name ? <> por <strong style={{ color: 'var(--foreground)' }}>{t.response_edited_by_name}</strong></> : null} em {fmtDataHora(t.response_edited_at)}</div>}
          {admin && onEditResposta && !editResp && <div style={{ marginTop: 14 }}><Btn data-v="troca-editar-resposta" size="sm" icon={<Pencil size={14} />} onClick={abrirEdicaoResposta}>Editar resposta</Btn></div>}
          <AnimatePresence initial={false}>
            {admin && editResp && (
              <motion.div key="edicao-resposta" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                <div data-v="troca-form-edicao-resposta" data-decisao={modo2} style={{ marginTop: 16, padding: 18, borderRadius: 14, background: 'var(--card)', border: `1.5px solid color-mix(in srgb, ${COR_STATUS[modo2]} 40%, transparent)`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ ...lbl, fontSize: 12 }}><Pencil size={13} />Editar resposta — o closer será avisado</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn data-v="troca-resp-decisao-concedida" aria-pressed={modo2 === 'concedida'} variant={modo2 === 'concedida' ? 'success' : 'ghost'} icon={<ThumbsUp size={15} />} onClick={() => { setModo2('concedida'); setErro2(null) }}>Concedida</Btn>
                    <Btn data-v="troca-resp-decisao-negada" aria-pressed={modo2 === 'negada'} variant={modo2 === 'negada' ? 'danger' : 'ghost'} icon={<ThumbsDown size={15} />} onClick={() => { setModo2('negada'); setErro2(null) }}>Negada</Btn>
                  </div>
                  <TextArea data-v="troca-resposta-campo-edicao" autoFocus rows={3} maxLength={2000} value={texto2} onChange={e => { setTexto2(e.target.value); setErro2(null) }} disabled={salvando2} erro={!!erro2} placeholder="Justificativa — o closer recebe este texto…" />
                  {erro2 && <Banner tipo="erro">{erro2}</Banner>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Btn data-v="troca-salvar-resposta" variant={modo2 === 'concedida' ? 'success' : 'danger'} loading={salvando2} icon={<Save size={15} />} onClick={salvarResposta}>Salvar alterações</Btn>
                    <Btn data-v="troca-cancelar-edicao" onClick={() => { setEditResp(false); setErro2(null) }} disabled={salvando2}>Cancelar</Btn>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {admin && !resolvida && onDecide && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Btn data-v="troca-conceder" variant="success" size="lg" icon={<ThumbsUp size={17} />} onClick={() => { setModo('concedida'); setErro(null) }} style={{ minWidth: 168, outline: modo === 'concedida' ? '3px solid color-mix(in srgb,#16a34a 30%,transparent)' : 'none', outlineOffset: 2 }}>Conceder</Btn>
            <Btn data-v="troca-negar" variant="danger" size="lg" icon={<ThumbsDown size={17} />} onClick={() => { setModo('negada'); setErro(null) }} style={{ minWidth: 168, outline: modo === 'negada' ? '3px solid color-mix(in srgb,#dc2626 30%,transparent)' : 'none', outlineOffset: 2 }}>Negar</Btn>
          </div>
          <AnimatePresence initial={false}>
            {modo && (
              <motion.div key={modo} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                <div data-v="troca-form-resposta" data-decisao={modo} style={{ marginTop: 16, padding: 20, borderRadius: 16, background: `color-mix(in srgb, ${corModo} 7%, var(--card))`, border: `1.5px solid color-mix(in srgb, ${corModo} 38%, transparent)`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ ...lbl, color: corModo, fontSize: 12 }}>{modo === 'concedida' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}{modo === 'concedida' ? 'Conceder esta troca' : 'Negar esta troca'}</div>
                  {modo === 'concedida' && (
                    <div data-v="troca-transferir-bloco" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, background: 'color-mix(in srgb, #6366f1 7%, var(--card))', border: '1px dashed color-mix(in srgb, #6366f1 40%, transparent)' }}>
                      <Btn data-v="troca-transferir" variant="soft" icon={<ArrowRightLeft size={15} />} onClick={() => setTransfAberto(true)}>Transferir Venda</Btn>
                      {transferida ? <span data-v="troca-transferida" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#16a34a' }}><CheckCircle2 size={14} />Venda transferida no banco</span> : <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>Passa a venda do HP para {t.requester_name} no banco, antes de você responder.</span>}
                    </div>
                  )}
                  <TextArea data-v="troca-resposta-campo" autoFocus rows={3} maxLength={2000} value={texto} onChange={e => { setTexto(e.target.value); setErro(null) }} disabled={salvando} erro={!!erro} placeholder={modo === 'concedida' ? 'Justifique a concessão — o closer vai receber este texto…' : 'Explique o motivo da negativa — o closer vai receber este texto…'} />
                  {erro && <Banner tipo="erro">{erro}</Banner>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Btn data-v="troca-confirmar" variant={modo === 'concedida' ? 'success' : 'danger'} loading={salvando} onClick={confirmar}>{modo === 'concedida' ? 'Confirmar concessão' : 'Confirmar negativa'}</Btn>
                    <Btn data-v="troca-cancelar-resposta" onClick={() => { setModo(null); setTexto(''); setErro(null) }} disabled={salvando}>Cancelar</Btn>
                    <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>A justificativa é obrigatória e é enviada ao closer.</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* fim troca-corpo */}
      {admin && hpAberto && <ConsultarHpModal troca={t} onClose={() => setHpAberto(false)} />}
      {admin && transfAberto && <TransferirVendaModal troca={t} onClose={() => setTransfAberto(false)} onTransferida={r => setTransferida(r.resultado)} />}
    </motion.article>
  )
}
