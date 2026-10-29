'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, CreditCard, FileText, Hash, Mail, Package, Pencil, Phone, Tag, User, Users, Wallet, X } from 'lucide-react'
import { api } from '@/lib/vendas/client'
import type { VendaRow } from '@/lib/vendas/types'
import { FORMAS_PAGAMENTO, VERTICAIS_ATIVAS, brtLocalToIso, formaPagamento, isoToBrtLocal, oferta, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { maskCoupon, maskEmail, maskInt, maskMoney, maskName, maskPhone, maskTx, moneyBlur, moneyToMasked, parseMoney, unmaskPhone } from '@/lib/vendas/mask'
import { validarEdicao } from '@/lib/vendas/validate'
import { Avatar, Banner, Btn, Chip, Field, Select, TextArea, TextInput, VerticalChip } from './ui'

function inicial(v: VendaRow) {
  return { occurred_at: isoToBrtLocal(v.occurred_at), transaction_id: v.transaction_id ?? '', vertical: v.vertical, product: v.product ?? '', value: moneyToMasked(v.value), coupon_code: v.coupon_code ?? '', lead_name: v.lead_name ?? '', email: v.email ?? '', phone: maskPhone(v.phone ?? ''), payment_type: (v.payment_type ?? '').toUpperCase(), payment_installments: v.payment_installments == null ? '' : String(v.payment_installments), ambassador_name: v.ambassador_name ?? '', obs: v.obs ?? '' }
}
type F = ReturnType<typeof inicial>
const item = (i: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.04 + i * 0.05, duration: 0.26, ease: [0.2, 0.7, 0.2, 1] as any } })
function Secao({ icon, titulo, children, i }: { icon: React.ReactNode; titulo: string; children: React.ReactNode; i: number }) {
  return (
    <motion.section {...item(i)} style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', background: 'color-mix(in srgb,var(--primary) 11%,transparent)' }}>{icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{titulo}</span><span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>{children}</div>
    </motion.section>
  )
}

/** Superadmin: edita QUALQUER campo da tabela de vendas, com máscaras. Só vai o que mudou; tudo fica registrado (quem, quando, valor antigo e novo). */
export function EditarVendaModal({ venda, closerNome, closerFoto, onClose, onSaved }: { venda: VendaRow | null; closerNome?: string; closerFoto?: string | null; onClose: () => void; onSaved: (v: VendaRow, auditoria: boolean) => void }) {
  const [f, setF] = useState<F | null>(null); const [erros, setErros] = useState<Record<string, string>>({}); const [geral, setGeral] = useState<string | null>(null); const [salvando, setSalvando] = useState(false)
  useEffect(() => { if (venda) { setF(inicial(venda)); setErros({}); setGeral(null); setSalvando(false) } }, [venda])
  useEffect(() => { if (!venda) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[data-v="select-menu"]') && !salvando) onClose() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [venda, salvando, onClose])
  const limpaErro = (k: string) => setErros(s => { if (!s[k]) return s; const n = { ...s }; delete n[k]; return n })
  const set = (k: keyof F, m?: (s: string) => string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const v = m ? m(e.target.value) : e.target.value; setF(s => (s ? { ...s, [k]: v } : s)); limpaErro(k) }
  const sel = (k: keyof F) => (v: string) => { setF(s => (s ? { ...s, [k]: v } : s)); limpaErro(k) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!venda || !f) return; setGeral(null)
    const base = inicial(venda); const body: Record<string, any> = {}
    for (const k of Object.keys(f) as (keyof F)[]) {
      if (f[k] === base[k]) continue
      if (k === 'occurred_at') { const iso = brtLocalToIso(f.occurred_at); if (!iso) { setErros({ occurred_at: 'Data inválida.' }); return } body.occurred_at = iso }
      else if (k === 'payment_installments') body[k] = f[k].trim() === '' ? null : Number(f[k])
      else if (k === 'value') body[k] = parseMoney(f.value) ?? ''
      else if (k === 'phone') body[k] = unmaskPhone(f.phone)
      else body[k] = f[k]
    }
    if (Object.keys(body).length === 0) { setGeral('Nenhuma alteração para salvar.'); return }
    const v = validarEdicao(body); if (!v.ok) { setErros(v.errors); return }
    setSalvando(true); const r = await api<{ venda: VendaRow; auditoria: boolean }>(`/api/admin/vendas/${venda.id}`, { method: 'PATCH', body }); setSalvando(false)
    if (!r.ok) { setErros(r.errors ?? {}); setGeral(r.errors && Object.keys(r.errors).length ? null : r.error ?? 'Não foi possível salvar.'); return }
    onSaved(r.data!.venda, r.data!.auditoria)
  }
  const verticais = [...VERTICAIS_ATIVAS as readonly string[], ...(venda && !(VERTICAIS_ATIVAS as readonly string[]).includes(venda.vertical) ? [venda.vertical] : [])]
  const pagos = [...FORMAS_PAGAMENTO, ...(f && f.payment_type && !FORMAS_PAGAMENTO.includes(f.payment_type) ? [f.payment_type] : [])]
  const of = f ? oferta(f.coupon_code) : null
  return (
    <AnimatePresence>
      {venda && f && (
        <motion.div data-v="editar-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(10,8,28,0.58)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="editar-titulo" data-v="editar-modal" className="vd vd-scroll" initial={{ opacity: 0, y: 18, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }} transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{ width: 'min(820px, 100%)', maxHeight: '94vh', overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, boxShadow: '0 40px 90px -20px rgba(10,8,40,.55)' }}>
            <form onSubmit={salvar} noValidate>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '22px 28px', borderBottom: '1px solid var(--border)', background: `linear-gradient(135deg,color-mix(in srgb,${verticalCor(venda.vertical)} 14%,var(--card)),var(--card) 70%)`, borderRadius: '24px 24px 0 0' }}>
                <Avatar name={closerNome ?? venda.closer_name ?? 'Closer'} src={closerFoto} size={54} ring={verticalCor(venda.vertical)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 id="editar-titulo" className="vd-title" style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--foreground)' }}>Editar venda</h2>
                  <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><VerticalChip v={venda.vertical} /><span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{venda.lead_name}</span><span>· {closerNome ?? venda.closer_name ?? ''}</span></p>
                </div>
                <button type="button" data-v="editar-fechar" onClick={onClose} disabled={salvando} aria-label="Fechar" className="vd-icon vd-btn" style={{ width: 38, height: 38, border: 'none', borderRadius: 12, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={19} /></button>
              </div>
              <div style={{ padding: '26px 28px 4px', display: 'grid', gap: 26 }}>
                {geral && <Banner tipo={geral.startsWith('Nenhuma') ? 'aviso' : 'erro'}>{geral}</Banner>}
                <Secao i={0} icon={<Hash size={15} />} titulo="Identificação">
                  <Field label="Data da venda (Brasília)" erro={erros.occurred_at} icon={<Calendar size={14} />}><TextInput data-v="ed-occurred_at" type="datetime-local" erro={!!erros.occurred_at} value={f.occurred_at} onChange={set('occurred_at')} /></Field>
                  <Field label="ID Transação" erro={erros.transaction_id} icon={<Hash size={14} />}><TextInput mono data-v="ed-transaction_id" erro={!!erros.transaction_id} value={f.transaction_id} onChange={set('transaction_id', maskTx)} /></Field>
                  <Field label="Vertical" erro={erros.vertical} icon={<FileText size={14} />}><Select compact name="ed-vertical" caption="Vertical" value={f.vertical} onChange={sel('vertical')} options={verticais.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))} minWidth={0} /></Field>
                  <Field label="Produto" erro={erros.product} icon={<Package size={14} />}><TextInput data-v="ed-product" erro={!!erros.product} value={f.product} onChange={set('product', s => maskName(s))} /></Field>
                </Secao>
                <Secao i={1} icon={<Wallet size={15} />} titulo="Valores e pagamento">
                  <Field label="Valor" icon={<Wallet size={14} />} erro={erros.value} hint="Digite só números e vírgula: 7777,5 vira 7.777,50"><TextInput data-v="ed-value" prefix="R$" inputMode="decimal" erro={!!erros.value} value={f.value} onChange={set('value', maskMoney)} onBlur={() => setF(s => (s ? { ...s, value: moneyBlur(s.value) } : s))} placeholder="0,00" /></Field>
                  <Field label="Cupom" erro={erros.coupon_code} icon={<Tag size={14} />} hint={of ? <Chip cor="#d97706">Oferta: {of} de desconto</Chip> : 'Sem desconto (a Oferta vem do sufixo _X% do cupom)'}><TextInput mono data-v="ed-coupon_code" erro={!!erros.coupon_code} value={f.coupon_code} onChange={set('coupon_code', maskCoupon)} placeholder="AN123_7.5%" /></Field>
                  <Field label="Forma de pagamento" erro={erros.payment_type} icon={<CreditCard size={14} />}><Select compact name="ed-payment_type" caption="Forma de pagamento" placeholder="— sem informação —" value={f.payment_type} onChange={sel('payment_type')} options={[{ value: '', label: '— sem informação —' }, ...pagos.map(p => ({ value: p, label: formaPagamento(p) }))]} minWidth={0} /></Field>
                  <Field label="Qnt. Parcelas" icon={<Hash size={14} />} erro={erros.payment_installments} hint="De 1 a 99"><TextInput data-v="ed-payment_installments" inputMode="numeric" erro={!!erros.payment_installments} value={f.payment_installments} onChange={set('payment_installments', s => maskInt(s, 2))} placeholder="12" /></Field>
                </Secao>
                <Secao i={2} icon={<User size={15} />} titulo="Cliente e afiliado">
                  <Field label="Nome" erro={erros.lead_name} icon={<User size={14} />}><TextInput data-v="ed-lead_name" erro={!!erros.lead_name} value={f.lead_name} onChange={set('lead_name', s => maskName(s))} /></Field>
                  <Field label="E-mail" erro={erros.email} icon={<Mail size={14} />}><TextInput data-v="ed-email" inputMode="email" erro={!!erros.email} value={f.email} onChange={set('email', maskEmail)} placeholder="nome@email.com" /></Field>
                  <Field label="Telefone" erro={erros.phone} icon={<Phone size={14} />}><TextInput data-v="ed-phone" inputMode="tel" erro={!!erros.phone} value={f.phone} onChange={set('phone', maskPhone)} placeholder="(41) 99999-9999" /></Field>
                  <Field label="Afiliado" erro={erros.ambassador_name} icon={<Users size={14} />} hint='Vazio ou "Não" = sem afiliado.'><TextInput data-v="ed-ambassador_name" erro={!!erros.ambassador_name} value={f.ambassador_name} onChange={set('ambassador_name', s => maskName(s))} /></Field>
                </Secao>
                <Secao i={3} icon={<Pencil size={15} />} titulo="Observação">
                  <Field label="Obs" icon={<FileText size={14} />} erro={erros.obs} full hint={<span style={{ display: 'flex', justifyContent: 'space-between' }}><span>Visível para o closer.</span><span>{f.obs.length}/2000</span></span>}><TextArea data-v="ed-obs" erro={!!erros.obs} value={f.obs} onChange={set('obs')} rows={3} maxLength={2000} /></Field>
                </Secao>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 28px 26px' }}>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted-foreground)' }}>Cada alteração fica registrada: quem, quando, valor antigo e novo.</span>
                <Btn type="button" data-v="editar-cancelar" onClick={onClose} disabled={salvando}>Cancelar</Btn>
                <Btn type="submit" data-v="editar-salvar" variant="primary" size="lg" loading={salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</Btn>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
