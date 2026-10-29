'use client'
import { useEffect, useMemo, useState } from 'react'
import { Barcode, Check, ChevronLeft, ChevronRight, Copy, CreditCard, FileText, Loader2, Pencil, Plus, QrCode, Tag, Users, Wallet, X } from 'lucide-react'
import type { VendaRow } from '@/lib/vendas/types'
import { afiliado, fmtBRL, fmtDataHora, formaPagamento, formatPhone, oferta, parcelas, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { Chip } from './ui'

type SaveObs = (row: VendaRow, texto: string | null) => Promise<{ ok: boolean; error?: string }>
const TH: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: 'color-mix(in srgb,var(--secondary) 85%,var(--card))', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '16px', fontSize: 14, color: 'var(--foreground)', borderBottom: '1px solid color-mix(in srgb,var(--border) 70%,transparent)', verticalAlign: 'middle' }
const ELLIPSIS = (w: number): React.CSSProperties => ({ maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
const muted: React.CSSProperties = { color: 'var(--muted-foreground)' }
const MONO: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }

function PagIcon({ t }: { t: string | null }) {
  const k = (t ?? '').toUpperCase()
  if (k === 'PIX') return <QrCode size={15} />
  if (k === 'BILLET' || k === 'BOLETO') return <Barcode size={15} />
  if (k === 'WALLET') return <Wallet size={15} />
  if (!k) return <FileText size={15} />
  return <CreditCard size={15} />
}
function CopyId({ id }: { id: string | null }) {
  const [done, setDone] = useState(false)
  if (!id) return <span style={muted}>—</span>
  return (
    <button type="button" data-v="copiar-id" title="Copiar ID da transação" className="vd-btn" onClick={async () => { try { await navigator.clipboard.writeText(id); setDone(true); setTimeout(() => setDone(false), 1200) } catch { /* sem permissão */ } }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)', cursor: 'pointer', color: 'var(--foreground)', ...MONO }}>
      {id}{done ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} style={{ color: 'var(--muted-foreground)' }} />}
    </button>
  )
}

function ObsCell({ row, onSave }: { row: VendaRow; onSave: SaveObs }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(row.obs ?? ''); const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null); const [flash, setFlash] = useState(false)
  useEffect(() => { if (!editing) setDraft(row.obs ?? '') }, [row.obs, editing])
  async function save() {
    setSaving(true); setErr(null); const r = await onSave(row, draft.trim() ? draft : null); setSaving(false)
    if (r.ok) { setEditing(false); setFlash(true); setTimeout(() => setFlash(false), 1600) } else setErr(r.error ?? 'Não foi possível salvar.')
  }
  if (!editing) return (
    <button type="button" data-v="obs-abrir" onClick={() => setEditing(true)} title="Editar observação" className="vd-btn"
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 190, maxWidth: 270, padding: '8px 11px', borderRadius: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13.5, color: row.obs ? 'var(--foreground)' : 'var(--muted-foreground)', background: row.obs ? 'color-mix(in srgb,var(--primary) 6%,transparent)' : 'transparent', border: row.obs ? '1px solid color-mix(in srgb,var(--primary) 22%,transparent)' : '1.5px dashed var(--border)' }}>
      {row.obs ? <Pencil size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} /> : <Plus size={14} style={{ flexShrink: 0 }} />}
      <span data-v="obs-texto" style={{ flex: 1, ...ELLIPSIS(210), fontWeight: row.obs ? 600 : 500 }}>{row.obs || 'Adicionar obs'}</span>
      {flash && <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />}
    </button>
  )
  return (
    <div style={{ minWidth: 270 }}>
      <textarea data-v="obs-campo" className="vd-field" autoFocus rows={3} maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} disabled={saving} placeholder="Escreva uma observação sobre esta venda…"
        onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') { setEditing(false); setErr(null) } }}
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
      {err && <p data-v="obs-erro" style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{err}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <button type="button" data-v="obs-salvar" onClick={save} disabled={saving} className="vd-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 13px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{saving ? <Loader2 size={13} className="vd-spin" /> : <Check size={13} />}Salvar</button>
        <button type="button" data-v="obs-cancelar" onClick={() => { setEditing(false); setErr(null) }} disabled={saving} className="vd-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><X size={13} />Cancelar</button>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted-foreground)' }}>{draft.length}/2000 · Ctrl+Enter salva</span>
      </div>
    </div>
  )
}

export function VendasTable({ rows, mode, onSaveObs, onEdit, pageSize = 25, empty = 'Nenhuma venda neste período.' }: { rows: VendaRow[]; mode: 'closer' | 'admin'; onSaveObs: SaveObs; onEdit?: (row: VendaRow) => void; pageSize?: number; empty?: string }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  useEffect(() => { setPage(p => Math.min(p, pages - 1)) }, [pages])
  const slice = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize])
  if (rows.length === 0) return <div data-v="tabela-vazia" style={{ padding: '44px 16px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14.5 }}>{empty}</div>
  const cols = ['Data', 'ID Transação', 'Vertical', 'Produto', 'Valor', 'Cupom', 'Nome', 'E-mail', 'Telefone', 'Oferta', 'Forma de pagamento', 'Qnt. Parcelas', 'Afiliado', 'Obs']
  return (
    <div data-v="vendas-table">
      <div className="vd-scroll" style={{ overflowX: 'auto', maxHeight: 680, overflowY: 'auto' }}>
        <table style={{ width: '100%', minWidth: mode === 'admin' ? 2000 : 1940, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead><tr>{mode === 'admin' && <th style={{ ...TH, width: 56 }} aria-label="Ações" />}{cols.map(c => <th key={c} style={{ ...TH, textAlign: c === 'Valor' ? 'right' : c === 'Qnt. Parcelas' ? 'center' : 'left' }}>{c}</th>)}</tr></thead>
          <tbody>
            {slice.map(v => {
              const of = oferta(v.coupon_code); const cor = verticalCor(v.vertical); const af = afiliado(v)
              return (
                <tr key={v.id} data-v="row" data-id={v.id} className="vd-row">
                  {mode === 'admin' && <td style={{ ...TD, padding: '10px 8px 10px 14px' }}><button type="button" data-v="editar-venda" title="Editar venda" aria-label="Editar venda" onClick={() => onEdit?.(v)} className="vd-icon vd-btn" style={{ width: 36, height: 36, padding: 0, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={15} /></button></td>}
                  <td data-col="data" style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDataHora(v.occurred_at)}</td>
                  <td data-col="transaction_id" style={{ ...TD, whiteSpace: 'nowrap' }}><CopyId id={v.transaction_id} /></td>
                  <td data-col="vertical" style={{ ...TD, whiteSpace: 'nowrap' }}><Chip cor={cor} icon={<i style={{ width: 7, height: 7, borderRadius: 99, background: cor }} />}>{verticalLabel(v.vertical)}</Chip></td>
                  <td data-col="produto" title={v.product ?? ''} style={{ ...TD, ...ELLIPSIS(220), fontWeight: 600 }}>{v.product || '—'}</td>
                  <td data-col="valor" style={{ ...TD, textAlign: 'right', fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>{fmtBRL(v.value)}</td>
                  <td data-col="cupom" style={{ ...TD, whiteSpace: 'nowrap' }}>{v.coupon_code ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 8, background: 'var(--secondary)', ...MONO }}><Tag size={12} style={muted} />{v.coupon_code}</span> : <span style={muted}>—</span>}</td>
                  <td data-col="nome" title={v.lead_name ?? ''} style={{ ...TD, fontWeight: 700, ...ELLIPSIS(210) }}>{v.lead_name || '—'}</td>
                  <td data-col="email" title={v.email ?? ''} style={{ ...TD, ...ELLIPSIS(220) }}>{v.email || <span style={muted}>—</span>}</td>
                  <td data-col="telefone" style={{ ...TD, whiteSpace: 'nowrap' }}>{formatPhone(v.phone)}</td>
                  <td data-col="oferta" style={{ ...TD, whiteSpace: 'nowrap' }}>{of ? <Chip cor="#d97706">{of} de desconto</Chip> : <span style={muted}>Sem desconto</span>}</td>
                  <td data-col="pagamento" style={{ ...TD, whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 28, height: 28, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--secondary)', color: 'var(--muted-foreground)' }}><PagIcon t={v.payment_type} /></span>{formaPagamento(v.payment_type)}</span></td>
                  <td data-col="parcelas" style={{ ...TD, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700 }}>{parcelas(v)}</td>
                  <td data-col="afiliado" style={{ ...TD, whiteSpace: 'nowrap' }}>{af === 'Não' ? <span style={muted}>Não</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700 }}><Users size={14} style={{ color: '#0ea5e9' }} />{af}</span>}</td>
                  <td data-col="obs" style={{ ...TD, minWidth: 220 }}><ObsCell row={v} onSave={onSaveObs} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div data-v="paginacao" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid var(--border)', fontSize: 13.5, color: 'var(--muted-foreground)' }}>
        <span data-v="paginacao-info">Mostrando <strong style={{ color: 'var(--foreground)' }}>{page * pageSize + 1}–{Math.min(rows.length, page * pageSize + pageSize)}</strong> de <strong style={{ color: 'var(--foreground)' }}>{rows.length}</strong></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" data-v="pag-ant" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} aria-label="Página anterior" className="vd-btn" style={{ width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--card)', color: 'var(--foreground)', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={16} /></button>
          <span style={{ minWidth: 64, textAlign: 'center', fontWeight: 800, color: 'var(--foreground)' }}>{page + 1} / {pages}</span>
          <button type="button" data-v="pag-prox" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Próxima página" className="vd-btn" style={{ width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--card)', color: 'var(--foreground)', cursor: page >= pages - 1 ? 'not-allowed' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  )
}
