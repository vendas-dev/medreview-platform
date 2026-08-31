'use client'
import { useMemo } from 'react'
import { PriceRow } from '../lib/types'
import { fmt } from '../lib/pricing'
import { AppSettings } from '../lib/types'
import { Plus, X, Eraser } from 'lucide-react'
import { CustomSelect } from './CustomSelect'

// ── Design tokens inline ──────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  overflow: 'hidden',
}

const sectionHeader = (emoji: string, title: string, subtitle?: string, action?: React.ReactNode) => (
  <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb,var(--secondary) 50%,var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>{subtitle}</p>}
      </div>
    </div>
    {action}
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
  selectedRow:  PriceRow | null
  onClearAll:   () => void
}

export function SalesConfigurator(props: Props) {
  const {
    rows, settings, vertical, setVertical, produto, setProduto,
    tempo, setTempo, tipoAluno, setTipoAluno, canal, setCanal,
    upsellOn, setUpsellOn, upsellProduto, setUpsellProduto, upsellRow,
    usoInterno, setUsoInterno,
    selectedRow, onClearAll,
  } = props

  // Cascata
  const verticals  = useMemo(() => toOpts(unique(rows.map(r => r.vertical))), [rows])
  const produtos   = useMemo(() => toOpts(unique(rows.filter(r => !vertical  || r.vertical  === vertical).map(r => r.produto))), [rows, vertical])
  const tempos     = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)).map(r => r.tempoAcesso))), [rows, vertical, produto])
  const tipos      = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)&&(!tempo||r.tempoAcesso===tempo)).map(r => r.tipoAluno))), [rows, vertical, produto, tempo])
  const canais     = useMemo(() => toOpts(unique(rows.filter(r => (!vertical||r.vertical===vertical)&&(!produto||r.produto===produto)&&(!tempo||r.tempoAcesso===tempo)&&(!tipoAluno||r.tipoAluno===tipoAluno)).map(r => r.canalVenda))), [rows, vertical, produto, tempo, tipoAluno])

  // Upsell: todos os produtos (da vertical do time) exceto o selecionado.
  const upsellOptions = useMemo(() => {
    const seen = new Set<string>()
    return rows
      .filter(r => r.produto !== produto)
      .reduce<{value:string;label:string}[]>((acc, r) => {
        if (!seen.has(r.produto)) {
          seen.add(r.produto)
          const lbl = r.vertical && r.vertical !== vertical
            ? `${r.produto} — ${r.vertical}`
            : r.produto
          acc.push({ value: r.produto, label: lbl })
        }
        return acc
      }, [])
      .sort((a,b) => a.label.localeCompare(b.label))
  }, [rows, produto, vertical])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Produto ──────────────────────────────────────── */}
      <div style={card}>
        {sectionHeader('🔍', 'Configurar venda', 'Selecione o produto e condições',
          vertical && (
            <button onClick={onClearAll}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
              <Eraser size={11} /> Limpar tudo
            </button>
          )
        )}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
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
          <div style={{ margin: '0 18px 14px', padding: '12px 14px', borderRadius: 8, background: 'color-mix(in srgb,rgba(99,102,241,0.08) 100%,var(--card))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✅ Selecionado</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{selectedRow.produto}</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{selectedRow.tempoAcesso} · {selectedRow.tipoAluno}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '0 0 2px', textDecoration: 'line-through' }}>{fmt(selectedRow.precoCheio)}</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: '#22c55e', margin: 0, letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(selectedRow.precoEspecial)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Upsell ───────────────────────────────────────── */}
      {selectedRow && upsellOptions.length > 0 && (
        <div style={{ ...card, border: upsellOn ? '1.5px solid rgba(34,197,94,0.35)' : '1px solid var(--border)' }}>
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: upsellOn ? 'rgba(34,197,94,0.05)' : 'transparent' }}
            onClick={() => { setUpsellOn(!upsellOn); if (upsellOn) setUpsellProduto('') }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: upsellOn ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {upsellOn ? <X size={14} style={{ color: '#fff' }} /> : <Plus size={14} style={{ color: 'var(--muted-foreground)' }} />}
              </div>
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Adicionar produto ao investimento</p>
                <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Upsell da mesma vertical</p>
              </div>
            </div>
            {upsellRow && (
              <span style={{ fontSize: 13, fontWeight: 800, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>+{fmt(upsellRow.precoEspecial)}</span>
            )}
          </div>

          {upsellOn && (
            <div style={{ padding: '0 18px 14px' }}>
              <CustomSelect label="Produto adicional" value={upsellProduto}
                onChange={setUpsellProduto} options={upsellOptions} placeholder="Selecionar produto adicional..." />
              {upsellRow && (
                <div style={{ marginTop: 9, padding: '9px 12px', borderRadius: 7, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a', margin: 0 }}>{upsellRow.produto}</p>
                    <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{upsellRow.tempoAcesso}</p>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', margin: 0, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(upsellRow.precoEspecial)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Uso Interno ──────────────────────────────────── */}
      <div style={{ ...card, padding: '12px 18px' }}>
        <label onClick={() => setUsoInterno(!usoInterno)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ width: 40, height: 22, borderRadius: 999, background: usoInterno ? '#4f46e5' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: usoInterno ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>🔒 Uso Interno</p>
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>Libera condições especiais</p>
          </div>
        </label>
      </div>
    </div>
  )
}
