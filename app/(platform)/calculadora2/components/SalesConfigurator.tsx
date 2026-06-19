'use client'
import { useMemo, useState } from 'react'
import { PriceRow, PaymentMode } from '../lib/types'
import { fmt, rateForVertical } from '../lib/pricing'
import { AppSettings } from '../lib/types'
import { Plus, X } from 'lucide-react'
import { CustomSelect } from './CustomSelect'

// ── Design tokens inline ──────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
  overflow: 'hidden',
}

const sectionHeader = (emoji: string, title: string, subtitle?: string) => (
  <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 50%,var(--card))' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{subtitle}</p>}
      </div>
    </div>
  </div>
)

function unique(arr: string[]) { return [...new Set(arr.filter(Boolean))].sort() }
function toOpts(arr: string[]) { return arr.map(v => ({ value: v, label: v })) }

interface Props {
  rows:         PriceRow[]
  settings:     AppSettings
  vertical:     string; setVertical:    (v: string) => void
  produto:      string; setProduto:     (v: string) => void
  tempo:        string; setTempo:       (v: string) => void
  tipoAluno:    string; setTipoAluno:   (v: string) => void
  canal:        string; setCanal:       (v: string) => void
  upsellOn:     boolean; setUpsellOn:   (v: boolean) => void
  upsellProduto:string; setUpsellProduto:(v: string) => void
  upsellRow:    PriceRow | null
  usoInterno:   boolean; setUsoInterno:  (v: boolean) => void
  paymentMode:  PaymentMode; setPaymentMode: (v: PaymentMode) => void
  manualN:      number; setManualN:     (v: number) => void
  manualRate:   number; setManualRate:  (v: number) => void
  eventoSub:    'avista'|'parcelado'; setEventoSub: (v:'avista'|'parcelado')=>void
  selectedRow:  PriceRow | null
}

export function SalesConfigurator(props: Props) {
  const {
    rows, settings, vertical, setVertical, produto, setProduto,
    tempo, setTempo, tipoAluno, setTipoAluno, canal, setCanal,
    upsellOn, setUpsellOn, upsellProduto, setUpsellProduto, upsellRow,
    usoInterno, setUsoInterno, paymentMode, setPaymentMode,
    manualN, setManualN, manualRate, setManualRate, eventoSub, setEventoSub,
    selectedRow,
  } = props

  // Cascata
  const verticals  = useMemo(() => toOpts(unique(rows.map(r => r.vertical))), [rows])
  const produtos   = useMemo(() => toOpts(unique(rows.filter(r => !vertical  || r.vertical  === vertical).map(r => r.produto))), [rows, vertical])
  const tempos     = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)).map(r => r.tempoAcesso))), [rows, vertical, produto])
  const tipos      = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)&&(!tempo||r.tempoAcesso===tempo)).map(r => r.tipoAluno))), [rows, vertical, produto, tempo])
  const canais     = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)&&(!tempo||r.tempoAcesso===tempo)&&(!tipoAluno||r.tipoAluno===tipoAluno)).map(r => r.canalVenda))), [rows, vertical, produto, tempo, tipoAluno])

  // Upsell: produtos da mesma vertical, excluindo o selecionado
  const upsellOptions = useMemo(() => toOpts(unique(
    rows.filter(r =>
      r.vertical === vertical &&
      r.produto  !== produto &&
      (!tempo     || r.tempoAcesso === tempo) &&
      (!tipoAluno || r.tipoAluno   === tipoAluno) &&
      (!canal     || r.canalVenda  === canal)
    ).map(r => r.produto)
  )), [rows, vertical, produto, tempo, tipoAluno, canal])

  const MODES: { mode: PaymentMode; label: string; desc: string; internal?: boolean }[] = [
    { mode: 'parcelado', label: 'Parcelado', desc: `até 12x c/ juros` },
    { mode: 'avista',    label: 'À Vista',   desc: `${settings.cashDiscountPercent}% de desconto` },
    { mode: 'evento',    label: 'Evento',    desc: 'desconto especial' },
    { mode: '3x',        label: '3x Sem Juros', desc: 'divisão simples', internal: true },
    { mode: 'manual',    label: 'Manual',    desc: 'configurar parcelas', internal: true },
  ]
  const visibleModes = MODES.filter(m => !m.internal || usoInterno)
  const currentRate  = rateForVertical(vertical || '', settings)
  const isSemJuros   = currentRate === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Produto ──────────────────────────────────────── */}
      <div style={card}>
        {sectionHeader('🔍', 'Configurar venda', 'Selecione o produto e condições')}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CustomSelect label="Vertical" value={vertical}
            onChange={v => { setVertical(v); setProduto(''); setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto('') }}
            options={verticals} placeholder="Selecionar vertical..." />
          <CustomSelect label="Produto" value={produto}
            onChange={v => { setProduto(v); setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto('') }}
            options={produtos} disabled={!vertical} placeholder="Selecionar produto..." />
          <CustomSelect label="Tempo de acesso" value={tempo}
            onChange={v => { setTempo(v); setTipoAluno(''); setCanal('') }}
            options={tempos} disabled={!produto} placeholder="Selecionar período..." />
          <CustomSelect label="Tipo de aluno" value={tipoAluno}
            onChange={v => { setTipoAluno(v); setCanal('') }}
            options={tipos} disabled={!tempo} placeholder="Selecionar tipo..." />
          <CustomSelect label="Canal de venda" value={canal}
            onChange={setCanal} options={canais} disabled={!tipoAluno} placeholder="Selecionar canal..." />
        </div>

        {/* Resumo do produto */}
        {selectedRow && (
          <div style={{ margin: '0 20px 16px', padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(124,58,237,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✅ Selecionado</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{selectedRow.produto}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{selectedRow.tempoAcesso} · {selectedRow.tipoAluno}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 2px', textDecoration: 'line-through' }}>{fmt(selectedRow.precoCheio)}</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#22c55e', margin: 0, letterSpacing: '-0.02em' }}>{fmt(selectedRow.precoEspecial)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Upsell ───────────────────────────────────────── */}
      {selectedRow && upsellOptions.length > 0 && (
        <div style={{ ...card, border: upsellOn ? '1.5px solid rgba(34,197,94,0.35)' : '1px solid var(--border)' }}>
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: upsellOn ? 'rgba(34,197,94,0.05)' : 'transparent' }}
            onClick={() => { setUpsellOn(!upsellOn); if (upsellOn) setUpsellProduto('') }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: upsellOn ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {upsellOn ? <X size={15} style={{ color: '#fff' }} /> : <Plus size={15} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Adicionar produto ao investimento</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Upsell da mesma vertical</p>
              </div>
            </div>
            {upsellRow && (
              <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>+{fmt(upsellRow.precoEspecial)}</span>
            )}
          </div>

          {upsellOn && (
            <div style={{ padding: '0 20px 16px' }}>
              <CustomSelect label="Produto adicional" value={upsellProduto}
                onChange={setUpsellProduto} options={upsellOptions} placeholder="Selecionar produto adicional..." />
              {upsellRow && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 11, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', margin: 0 }}>{upsellRow.produto}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{upsellRow.tempoAcesso}</p>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', margin: 0 }}>{fmt(upsellRow.precoEspecial)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Forma de pagamento ────────────────────────────── */}
      <div style={card}>
        {sectionHeader('💳', 'Forma de pagamento', isSemJuros ? `${vertical} — 12x sem juros` : `${vertical} — ${currentRate}% a.m.`)}
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleModes.map(m => {
            const active = paymentMode === m.mode
            return (
              <label key={m.mode} onClick={() => setPaymentMode(m.mode)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 13, border: `1.5px solid ${active ? '#4f46e5' : 'var(--border)'}`, background: active ? 'rgba(99,102,241,0.06)' : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.25)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? '#4f46e5' : 'var(--border)'}`, background: active ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#4f46e5' : 'var(--foreground)', margin: 0 }}>{m.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{m.desc}</p>
                </div>
              </label>
            )
          })}
        </div>

        {/* Sub-opção Evento */}
        {paymentMode === 'evento' && (
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
            {(['parcelado', 'avista'] as const).map(sub => (
              <button key={sub} onClick={() => setEventoSub(sub)}
                style={{ flex: 1, height: 38, borderRadius: 10, border: `1.5px solid ${eventoSub === sub ? '#4f46e5' : 'var(--border)'}`, background: eventoSub === sub ? 'rgba(99,102,241,0.08)' : 'transparent', color: eventoSub === sub ? '#4f46e5' : 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {sub === 'parcelado' ? '📅 Parcelado' : '💵 À Vista'}
              </button>
            ))}
          </div>
        )}

        {/* Campos Manual */}
        {paymentMode === 'manual' && (
          <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nº de parcelas</label>
              <input type="number" min={1} max={60} value={manualN} onChange={e => setManualN(parseInt(e.target.value) || 1)}
                style={{ width: '100%', height: 48, padding: '0 16px', borderRadius: 13, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Taxa mensal (%)</label>
              <input type="number" min={0} step={0.01} value={manualRate} onChange={e => setManualRate(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', height: 48, padding: '0 16px', borderRadius: 13, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Uso Interno ──────────────────────────────────── */}
      <div style={{ ...card, padding: '14px 20px' }}>
        <label onClick={() => setUsoInterno(!usoInterno)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ width: 42, height: 24, borderRadius: 999, background: usoInterno ? '#4f46e5' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: usoInterno ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>🔒 Uso Interno</p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Libera condições especiais</p>
          </div>
        </label>
      </div>
    </div>
  )
}
