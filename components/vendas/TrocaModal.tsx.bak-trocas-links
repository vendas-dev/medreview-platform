'use client'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, FileText, Hash, Link2, Loader2, MessageCircle, Package, Pencil, Repeat2, Save, Send, User, X } from 'lucide-react'
import { api } from '@/lib/vendas/client'
import { verticaisDoTime, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { maskName, maskTx, maskUrl } from '@/lib/vendas/mask'
import { validarTroca } from '@/lib/vendas/validate'
import type { TrocaRow } from '@/lib/vendas/types'
import { Banner, Btn, Field, Select, TextArea, TextInput } from './ui'

const VAZIO = { vertical: '', product: '', transaction_id: '', lead_name: '', hubspot_url: '', botmaker_url: '', reason: '' }
const item = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 + i * 0.045, duration: 0.28, ease: [0.2, 0.7, 0.2, 1] as any } })

/** Popup central (com animação sutil): o closer SOLICITA a troca de uma venda; com `troca`, EDITA a solicitação (closer: a própria pendente; admin: qualquer uma). */
export function TrocaModal({ open, onClose, team, onCreated, troca, admin, onSaved }: { open: boolean; onClose: () => void; team: string | null; onCreated?: (t: TrocaRow) => void; troca?: TrocaRow | null; admin?: boolean; onSaved?: (t: TrocaRow) => void }) {
  const edicao = !!troca; const equipe = edicao ? troca!.requester_team : team      // a vertical vale para o time de QUEM pediu
  const opcoes = verticaisDoTime(equipe)
  const inicial: typeof VAZIO | null = troca ? { vertical: troca.vertical, product: troca.product, transaction_id: troca.transaction_id, lead_name: troca.lead_name, hubspot_url: troca.hubspot_url, botmaker_url: troca.botmaker_url, reason: troca.reason } : null
  const [f, setF] = useState({ ...VAZIO }); const [erros, setErros] = useState<Record<string, string>>({}); const [geral, setGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false); const [feito, setFeito] = useState(false); const primeiro = useRef<HTMLDivElement>(null)
  useEffect(() => { if (open) { setF(inicial ? { ...inicial } : { ...VAZIO, vertical: opcoes.length === 1 ? opcoes[0] : '' }); setErros({}); setGeral(null); setFeito(false); setEnviando(false) } /* eslint-disable-next-line */ }, [open])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[data-v="select-menu"]') && !enviando) onClose() }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [open, enviando, onClose])
  const set = (k: keyof typeof VAZIO, m?: (s: string) => string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const v = m ? m(e.target.value) : e.target.value; setF(s => ({ ...s, [k]: v })); if (erros[k]) setErros(s => { const n = { ...s }; delete n[k]; return n }) }
  const sujo = inicial ? Object.entries(f).some(([k, v]) => v.trim() !== (inicial as any)[k]) : Object.entries(f).some(([k, v]) => v.trim() && !(k === 'vertical' && opcoes.length === 1))

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setGeral(null)
    const v = validarTroca(f, equipe); if (!v.ok) { setErros(v.errors); return }
    if (inicial && (Object.keys(inicial) as (keyof typeof VAZIO)[]).every(k => v.value[k] === inicial[k])) { setGeral('Você não alterou nenhum campo.'); return }
    setEnviando(true)
    const r = edicao ? await api<{ troca: TrocaRow }>(`/api/trocas/${troca!.id}`, { method: 'PATCH', body: v.value }) : await api<{ troca: TrocaRow }>('/api/trocas', { method: 'POST', body: v.value })
    setEnviando(false)
    if (!r.ok) { setErros(r.errors ?? {}); setGeral(r.errors && Object.keys(r.errors).length && r.status !== 409 ? null : r.error ?? 'Não foi possível enviar.'); return }
    setFeito(true); if (edicao) onSaved?.(r.data!.troca); else onCreated?.(r.data!.troca); setTimeout(onClose, edicao ? 1200 : 1500)
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div data-v="troca-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }}
          onMouseDown={e => { if (e.target === e.currentTarget && !enviando && !sujo) onClose() }}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(10,8,28,0.58)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="troca-titulo" data-v="troca-modal" data-modo={edicao ? 'editar' : 'novo'} className="vd vd-scroll" initial={{ opacity: 0, y: 18, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }} transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{ width: 'min(660px, 100%)', maxHeight: '94vh', overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, boxShadow: '0 40px 90px -20px rgba(10,8,40,.55)' }}>
            {feito ? (
              <div data-v="troca-sucesso" style={{ padding: '72px 32px', textAlign: 'center' }}>
                <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} style={{ width: 88, height: 88, margin: '0 auto', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb,#16a34a 14%,transparent)', color: '#16a34a' }}><CheckCircle2 size={50} /></motion.div>
                <p className="vd-title" style={{ margin: '20px 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--foreground)' }}>{edicao ? 'Alterações salvas!' : 'Solicitação enviada!'}</p>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--muted-foreground)' }}>{edicao ? (admin ? 'O closer foi avisado do ajuste.' : 'Os superadmins foram avisados da edição.') : <>Os superadmins foram avisados. Você acompanha a resposta em <strong>Trocas de Venda</strong>.</>}</p>
              </div>
            ) : (
              <form onSubmit={enviar} noValidate>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,color-mix(in srgb,var(--primary) 13%,var(--card)),var(--card) 70%)', borderRadius: '24px 24px 0 0' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 17, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg,var(--primary),#8b5cf6)', boxShadow: '0 12px 24px -12px var(--primary)' }}>{edicao ? <Pencil size={22} /> : <Repeat2 size={24} />}</div>
                  <div style={{ flex: 1 }}><h2 id="troca-titulo" className="vd-title" style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--foreground)' }}>{edicao ? 'Editar solicitação de troca' : 'Solicitar troca de venda'}</h2><p data-v="troca-subtitulo" style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted-foreground)' }}>{edicao ? (admin ? `Editando o pedido de ${troca!.requester_name}. O closer será avisado do ajuste.` : 'Ajuste os dados enquanto o pedido está pendente. A gestão será avisada da edição.') : 'Preencha os dados para o time de gestão analisar o seu pedido.'}</p></div>
                  <button type="button" data-v="troca-fechar" onClick={onClose} disabled={enviando} aria-label="Fechar" className="vd-icon vd-btn" style={{ width: 38, height: 38, border: 'none', borderRadius: 12, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={19} /></button>
                </div>
                <div style={{ padding: '26px 28px 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 22 }}>
                  {geral && <div style={{ gridColumn: '1 / -1' }}><Banner tipo="erro">{geral}</Banner></div>}
                  <motion.div {...item(0)} ref={primeiro}><Field label="Vertical" erro={erros.vertical} icon={<FileText size={14} />}>
                    <Select compact name="troca-vertical" caption="Vertical" placeholder="Selecione a vertical" value={f.vertical} onChange={v => { setF(s => ({ ...s, vertical: v })); setErros(s => { const n = { ...s }; delete n.vertical; return n }) }} options={opcoes.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))} minWidth={0} />
                  </Field></motion.div>
                  <motion.div {...item(1)}><Field label="Produto" erro={erros.product} icon={<Package size={14} />}><TextInput data-v="troca-produto" erro={!!erros.product} value={f.product} onChange={set('product', s => maskName(s))} maxLength={200} placeholder="Ex.: Extensive TSA 2027" /></Field></motion.div>
                  <motion.div {...item(2)}><Field label="ID Transação Hotmart" erro={erros.transaction_id} icon={<Hash size={14} />} hint="Maiúsculas automáticas. Ex.: HP1234567890"><TextInput mono data-v="troca-tx" erro={!!erros.transaction_id} value={f.transaction_id} onChange={set('transaction_id', maskTx)} maxLength={80} placeholder="HP1234567890" /></Field></motion.div>
                  <motion.div {...item(3)}><Field label="Nome do Lead" erro={erros.lead_name} icon={<User size={14} />}><TextInput data-v="troca-lead" erro={!!erros.lead_name} value={f.lead_name} onChange={set('lead_name', s => maskName(s))} maxLength={200} placeholder="Nome do comprador" /></Field></motion.div>
                  <motion.div {...item(4)} style={{ gridColumn: '1 / -1' }}><Field label="Link do Negócio HubSpot" erro={erros.hubspot_url} icon={<Link2 size={14} />}><TextInput data-v="troca-hubspot" erro={!!erros.hubspot_url} value={f.hubspot_url} onChange={set('hubspot_url', maskUrl)} placeholder="https://app.hubspot.com/contacts/…" /></Field></motion.div>
                  <motion.div {...item(5)} style={{ gridColumn: '1 / -1' }}><Field label="Link da Conversa Botmaker" erro={erros.botmaker_url} icon={<MessageCircle size={14} />}><TextInput data-v="troca-botmaker" erro={!!erros.botmaker_url} value={f.botmaker_url} onChange={set('botmaker_url', maskUrl)} placeholder="https://go.botmaker.com/…" /></Field></motion.div>
                  <motion.div {...item(6)} style={{ gridColumn: '1 / -1' }}><Field label="Motivo da Troca" erro={erros.reason} icon={<FileText size={14} />} hint={<span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Conte o que aconteceu para a gestão decidir com contexto.</span><span>{f.reason.trim().length}/2000</span></span>}><TextArea data-v="troca-motivo" erro={!!erros.reason} value={f.reason} onChange={set('reason')} maxLength={2000} rows={4} placeholder="Explique por que esta venda deve ser trocada…" /></Field></motion.div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '20px 28px 26px' }}>
                  <Btn type="button" data-v="troca-cancelar" onClick={onClose} disabled={enviando}>Cancelar</Btn>
                  <Btn type="submit" data-v="troca-enviar" variant="primary" size="lg" loading={enviando} icon={edicao ? <Save size={16} /> : <Send size={16} />}>{enviando ? (edicao ? 'Salvando…' : 'Enviando…') : edicao ? 'Salvar alterações' : 'Enviar solicitação'}</Btn>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
