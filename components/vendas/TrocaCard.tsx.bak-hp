'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCircle2, Clock, Copy, ExternalLink, Hash, Loader2, MessageCircle, Package, Pencil, Quote, Save, ThumbsDown, ThumbsUp, User, XCircle } from 'lucide-react'
import type { Decisao, TrocaRow } from '@/lib/vendas/types'
import { fmtDataHora, teamCor } from '@/lib/vendas/format'
import { Avatar, Banner, Btn, TeamBadge, TextArea, VerticalChip } from './ui'

export const COR_STATUS = { pendente: '#f59e0b', concedida: '#16a34a', negada: '#dc2626', resolvida: '#64748b' }
const lbl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }
const statusDe = (t: TrocaRow): 'pendente' | 'concedida' | 'negada' | 'resolvida' => (t.status === 'pendente' ? 'pendente' : t.decision ?? 'resolvida')
const ROTULO = { pendente: 'Pendente', concedida: 'Concedida', negada: 'Negada', resolvida: 'Resolvida' }

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div style={{ minWidth: 0 }}><div style={lbl}>{icon}{label}</div><div style={{ marginTop: 7, fontSize: 15, fontWeight: 700, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>{children}</div></div>
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
  const corModo = modo ? COR_STATUS[modo] : cor
  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: resolvida ? 0.7 : 1, y: 0 }} whileHover={resolvida ? { opacity: 1 } : undefined} transition={{ duration: 0.3 }} data-v="troca" data-id={t.id} data-status={t.status} data-decision={t.decision ?? ''} data-resolved={resolvida ? 'true' : 'false'}
      className="vd-card vd-lift" style={{ position: 'relative', overflow: 'hidden', padding: '26px 28px 26px 34px' }}>
      <span aria-hidden style={{ position: 'absolute', inset: '0 auto 0 0', width: 7, background: `linear-gradient(180deg,${cor},color-mix(in srgb,${cor} 55%,transparent))` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Avatar name={t.requester_name} src={t.requester_avatar} size={52} ring={teamCor(t.requester_team)} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div data-v="troca-quem" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span className="vd-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{t.requester_name}</span><TeamBadge team={t.requester_team} /></div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted-foreground)' }}>Enviada em {fmtDataHora(t.created_at)}{t.edited_at && <span data-v="troca-editada"> · editada{t.edited_by_name ? <> por <strong style={{ color: 'var(--foreground)' }}>{t.edited_by_name}</strong></> : null} em {fmtDataHora(t.edited_at)}</span>}</div>
        </div>
        <span data-v="troca-status" className="vd-chip" style={{ padding: '8px 15px', borderRadius: 99, fontSize: 13, fontWeight: 800, color: cor, background: `color-mix(in srgb, ${cor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 30%, transparent)` }}>
          {st === 'pendente' ? <Clock size={15} /> : st === 'negada' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}{ROTULO[st]}
        </span>
        {podeEditar && <Btn data-v="troca-editar" size="sm" icon={<Pencil size={14} />} onClick={() => onEdit!(t)} title="Editar a solicitação">Editar</Btn>}
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '22px 28px' }}>
        <Info icon={<Package size={13} />} label="Produto"><div>{t.product}</div><div style={{ marginTop: 8 }}><VerticalChip v={t.vertical} /></div></Info>
        <Info icon={<Hash size={13} />} label="ID Transação">
          <button type="button" data-v="troca-copiar" title="Copiar ID" onClick={async () => { try { await navigator.clipboard.writeText(t.transaction_id); setCopiado(true); setTimeout(() => setCopiado(false), 1200) } catch { /* */ } }} className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 11px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, fontWeight: 600 }}>{t.transaction_id}{copiado ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} style={{ color: 'var(--muted-foreground)' }} />}</button>
        </Info>
        <Info icon={<User size={13} />} label="Nome do Lead">{t.lead_name}</Info>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '22px 0' }}>
        <a data-v="troca-link-hubspot" href={t.hubspot_url} target="_blank" rel="noopener noreferrer" className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 42, padding: '0 18px', borderRadius: 13, textDecoration: 'none', fontSize: 13.5, fontWeight: 700, color: '#ea580c', background: 'color-mix(in srgb,#f97316 11%,transparent)', border: '1px solid color-mix(in srgb,#f97316 26%,transparent)' }}><ExternalLink size={15} />Negócio no HubSpot</a>
        <a data-v="troca-link-botmaker" href={t.botmaker_url} target="_blank" rel="noopener noreferrer" className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 42, padding: '0 18px', borderRadius: 13, textDecoration: 'none', fontSize: 13.5, fontWeight: 700, color: '#2563eb', background: 'color-mix(in srgb,#3b82f6 11%,transparent)', border: '1px solid color-mix(in srgb,#3b82f6 26%,transparent)' }}><MessageCircle size={15} />Conversa no Botmaker</a>
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
    </motion.article>
  )
}
