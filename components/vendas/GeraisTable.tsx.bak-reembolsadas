'use client'
import { useState, type CSSProperties } from 'react'
import { Barcode, Check, ChevronLeft, ChevronRight, Copy, CreditCard, FileText, HelpCircle, Megaphone, QrCode, Repeat2, ShoppingCart, Tag, Wallet, Zap } from 'lucide-react'
import { Avatar, Chip, TeamBadge } from './ui'
import { CANAL_COR, CANAL_ROTULO, destacar, textoCor, type CanalId, type VendaGeral } from '@/lib/vendas/gerais'
import { fmtBRL, fmtData, fmtDataHora, formaPagamento, formatPhone, oferta, parcelas, teamCor, verticalCor, verticalLabel } from '@/lib/vendas/format'

const TH: CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: 'color-mix(in srgb,var(--secondary) 85%,var(--card))', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD: CSSProperties = { padding: '12px 16px', height: 76, fontSize: 14, color: 'var(--foreground)', borderBottom: '1px solid color-mix(in srgb,var(--border) 70%,transparent)', verticalAlign: 'middle', overflow: 'hidden' }
const ELL: CSSProperties = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const MONO: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }
const muted: CSSProperties = { color: 'var(--muted-foreground)' }
/** [largura, rótulo, alinhamento] — a MESMA lista desenha o cabeçalho e as larguras (colgroup): é o que mantém texto e foto alinhados. */
const COLS: [number, string, 'left' | 'right' | 'center'][] = [[128, 'Data', 'left'], [152, 'Vertical', 'left'], [250, 'Produto', 'left'], [136, 'Valor', 'right'], [152, 'Canal', 'left'], [262, 'Vendedor', 'left'], [262, 'Lead', 'left'], [152, 'Telefone', 'left'], [180, 'ID Transação', 'left'], [172, 'Cupom', 'left'], [196, 'Pagamento', 'left'], [138, 'Tipo', 'left']]
export const LARGURA_TABELA = COLS.reduce((s, c) => s + c[0], 0)

function Hit({ t, tokens }: { t: string | null | undefined; tokens: string[] }) {
  return <>{destacar(t, tokens).map((p, i) => p.hit ? <mark key={i} data-v="hit" style={{ background: 'color-mix(in srgb,var(--primary) 24%,transparent)', color: 'var(--foreground)', borderRadius: 4, padding: '0 1px', boxShadow: '0 0 0 1px color-mix(in srgb,var(--primary) 12%,transparent)' }}>{p.t}</mark> : <span key={i}>{p.t}</span>)}</>
}
function PagIcon({ t }: { t: string | null }) {
  const k = (t ?? '').toUpperCase()
  return k === 'PIX' ? <QrCode size={15} /> : k === 'BILLET' || k === 'BOLETO' ? <Barcode size={15} /> : k === 'WALLET' ? <Wallet size={15} /> : !k ? <FileText size={15} /> : <CreditCard size={15} />
}
function CopyId({ id, tokens }: { id: string | null; tokens: string[] }) {
  const [done, setDone] = useState(false)
  if (!id) return <span style={muted}>—</span>
  return (
    <button type="button" data-v="copiar-id" title="Copiar ID da transação" className="vd-btn" onClick={async () => { try { await navigator.clipboard.writeText(id); setDone(true); setTimeout(() => setDone(false), 1200) } catch { /* sem permissão */ } }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)', cursor: 'pointer', color: 'var(--foreground)', ...MONO }}>
      <span style={ELL}><Hit t={id} tokens={tokens} /></span>{done ? <Check size={13} style={{ color: '#16a34a', flexShrink: 0 }} /> : <Copy size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />}
    </button>
  )
}
const ICONE_CANAL: Record<CanalId, JSX.Element> = { self: <ShoppingCart size={13} />, embaixador: <Megaphone size={13} />, closer: <Zap size={13} />, sem: <HelpCircle size={13} /> }
export function CanalTag({ canal }: { canal: CanalId }) {
  return <span data-v="canal-tag" data-canal={canal} className="vd-chip" style={{ padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: 800, color: textoCor(CANAL_COR[canal]), background: `color-mix(in srgb, ${CANAL_COR[canal]} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${CANAL_COR[canal]} 26%, transparent)` }}>{ICONE_CANAL[canal]}{CANAL_ROTULO[canal]}</span>
}
const Bolha = ({ cor, children, size = 38 }: { cor: string; children: React.ReactNode; size?: number }) => <span data-v="vendedor-icone" style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cor, background: `color-mix(in srgb, ${cor} 14%, transparent)`, boxShadow: `0 0 0 2px color-mix(in srgb, ${cor} 30%, transparent)` }}>{children}</span>

function Vendedor({ v, tokens }: { v: VendaGeral; tokens: string[] }) {
  const nome = v.vendedor.nome
  let foto: React.ReactNode, titulo: React.ReactNode, sub: React.ReactNode
  if (v.canal === 'self') { foto = <Bolha cor={CANAL_COR.self}><ShoppingCart size={18} /></Bolha>; titulo = 'Self-Checkout'; sub = <span style={muted}>compra direta</span> }
  else if (v.canal === 'embaixador') { foto = nome ? <Avatar name={nome} size={38} ring={CANAL_COR.embaixador} /> : <Bolha cor={CANAL_COR.embaixador}><Megaphone size={18} /></Bolha>; titulo = nome ? <Hit t={nome} tokens={tokens} /> : <span style={muted}>Embaixador</span>; sub = <span style={muted}>Embaixador</span> }
  else if (nome) { foto = <Avatar name={nome} src={v.vendedor.avatar_url} size={38} ring={teamCor(v.vendedor.team)} />; titulo = <Hit t={nome} tokens={tokens} />; sub = v.vendedor.team ? <TeamBadge team={v.vendedor.team} /> : <span style={muted}>sem time</span> }
  else { foto = <Bolha cor="#94a3b8"><HelpCircle size={18} /></Bolha>; titulo = <span style={muted}>Sem closer atribuído</span>; sub = <span style={muted}>sem time</span> }
  return (
    <div data-v="vendedor" data-canal={v.canal} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        {foto}
        {v.co && <span data-v="vendedor-co" title={`Co-closer: ${v.co.nome}`} style={{ position: 'absolute', right: -9, bottom: -5, borderRadius: 999, boxShadow: '0 0 0 2px var(--card)', display: 'inline-flex' }}><Avatar name={v.co.nome ?? '?'} src={v.co.avatar_url} size={22} ring={teamCor(v.co.team)} /></span>}
      </span>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span data-v="vendedor-nome" style={{ ...ELL, fontWeight: 700, fontSize: 14 }}>{titulo}</span>
        <span style={{ ...ELL, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{sub}{v.co && <span data-v="vendedor-co-nome" style={{ ...muted, ...ELL }}>+ {v.co.nome}</span>}</span>
      </span>
    </div>
  )
}

export interface GeraisTableProps { rows: VendaGeral[]; tokens: string[]; carregando: boolean; total: number; page: number; pages: number; pageSize: number; onPage: (n: number) => void; onPageSize: (n: number) => void; vazio: React.ReactNode; cor?: string }
export function GeraisTable({ rows, tokens, carregando, total, page, pages, pageSize, onPage, onPageSize, vazio, cor }: GeraisTableProps) {
  const ini = total === 0 ? 0 : (page - 1) * pageSize + 1, fim = Math.min(total, page * pageSize)
  return (
    <div data-v="gerais-table" aria-busy={carregando} style={{ position: 'relative' }}>
      {carregando && <div data-v="tabela-carregando" className="vd-shimmer" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 5 }} />}
      {rows.length === 0 && !carregando ? vazio : (
        <div className="vd-scroll" style={{ overflowX: 'auto', maxHeight: 720, overflowY: 'auto', opacity: carregando ? 0.55 : 1, transition: 'opacity .18s ease', pointerEvents: carregando ? 'none' : 'auto' }}>
          <table style={{ width: '100%', minWidth: LARGURA_TABELA, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
            <colgroup>{COLS.map(c => <col key={c[1]} style={{ width: c[0] }} />)}</colgroup>
            <thead><tr>{COLS.map(([, r, al], i) => <th key={r} style={{ ...TH, textAlign: al, paddingLeft: i === 0 ? 22 : 16, ...(cor ? { borderBottom: `2px solid color-mix(in srgb, ${cor} 55%, var(--border))` } : {}) }}>{r}</th>)}</tr></thead>
            <tbody>
              {rows.map(v => {
                const c = verticalCor(v.vertical), of = oferta(v.coupon_code), rec = v.sale_type === 'recorrente' || v.is_recurring === true
                return (
                  <tr key={v.id} data-v="row" data-id={v.id} data-vertical={v.vertical} data-canal={v.canal} className="vd-row">
                    <td data-col="data" style={{ ...TD, paddingLeft: 22, boxShadow: `inset 5px 0 0 ${c}`, whiteSpace: 'nowrap' }}><span style={{ display: 'block', fontWeight: 700 }}>{fmtData(v.occurred_at)}</span><span style={{ display: 'block', marginTop: 3, fontSize: 12.5, ...muted }}>{fmtDataHora(v.occurred_at).slice(11)}</span></td>
                    <td data-col="vertical" style={{ ...TD, whiteSpace: 'nowrap' }}><Chip cor={c} icon={<i style={{ width: 7, height: 7, borderRadius: 99, background: c }} />}>{verticalLabel(v.vertical)}</Chip></td>
                    <td data-col="produto" title={v.product ?? ''} style={{ ...TD, fontWeight: 600 }}><span style={ELL}><Hit t={v.product || '—'} tokens={tokens} /></span></td>
                    <td data-col="valor" style={{ ...TD, textAlign: 'right', fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(v.value)}</td>
                    <td data-col="canal" style={{ ...TD, whiteSpace: 'nowrap' }}><CanalTag canal={v.canal} /></td>
                    <td data-col="vendedor" style={TD}><Vendedor v={v} tokens={tokens} /></td>
                    <td data-col="lead" title={`${v.lead_name ?? ''}${v.email ? ' · ' + v.email : ''}`} style={TD}><span data-v="lead-nome" style={{ ...ELL, fontWeight: 700 }}>{v.lead_name ? <Hit t={v.lead_name} tokens={tokens} /> : '—'}</span><span data-v="lead-email" style={{ ...ELL, marginTop: 3, fontSize: 12.5, ...muted }}>{v.email ? <Hit t={v.email} tokens={tokens} /> : '—'}</span></td>
                    <td data-col="telefone" style={{ ...TD, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatPhone(v.phone)}</td>
                    <td data-col="transaction_id" style={{ ...TD }}><CopyId id={v.transaction_id} tokens={tokens} /></td>
                    <td data-col="cupom" style={TD}>{v.coupon_code ? <><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '4px 9px', borderRadius: 8, background: 'var(--secondary)', ...MONO }}><Tag size={12} style={{ ...muted, flexShrink: 0 }} /><span style={ELL}><Hit t={v.coupon_code} tokens={tokens} /></span></span>{of && <span style={{ display: 'block', marginTop: 4, fontSize: 12, fontWeight: 700, color: '#b45309' }}>{of} de desconto</span>}</> : <span style={muted}>Sem cupom</span>}</td>
                    <td data-col="pagamento" style={{ ...TD, whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span style={{ width: 30, height: 30, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--secondary)', color: 'var(--muted-foreground)' }}><PagIcon t={v.payment_type} /></span><span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{formaPagamento(v.payment_type)}</span><span style={{ fontSize: 12, ...muted }}>{parcelas(v) === '—' ? 'à vista' : parcelas(v)}</span></span></span></td>
                    <td data-col="tipo" style={{ ...TD, whiteSpace: 'nowrap' }}>{rec ? <Chip cor="#8b5cf6" icon={<Repeat2 size={13} />}>Recorrente{v.installment_number ? ` ${v.installment_number}${v.total_installments ? '/' + v.total_installments : ''}` : ''}</Chip> : <Chip cor="#64748b">Nova</Chip>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div data-v="paginacao" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid var(--border)', fontSize: 13.5, color: 'var(--muted-foreground)' }}>
        <span data-v="paginacao-info">Mostrando <strong style={{ color: 'var(--foreground)' }}>{ini}–{fim}</strong> de <strong style={{ color: 'var(--foreground)' }}>{total}</strong></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>Linhas
            <select data-v="tamanho-pagina" value={pageSize} onChange={e => onPageSize(Number(e.target.value))} className="vd-field" style={{ height: 36, padding: '0 10px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--card)', color: 'var(--foreground)', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit' }}>{[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" data-v="pag-ant" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Página anterior" className="vd-btn" style={{ width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--card)', color: 'var(--foreground)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={17} /></button>
            <span data-v="pag-atual" style={{ minWidth: 64, textAlign: 'center', fontWeight: 800, color: 'var(--foreground)' }}>{page} / {pages}</span>
            <button type="button" data-v="pag-prox" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} aria-label="Próxima página" className="vd-btn" style={{ width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--card)', color: 'var(--foreground)', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={17} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
