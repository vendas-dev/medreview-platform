'use client'
import { useState, useEffect } from 'react'
import { X, Settings, RotateCcw } from 'lucide-react'
import { AppSettings } from '../lib/types'

const VERTICALS = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

const inp: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 13px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--secondary)', borderRadius: 10, padding: '14px', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      {children}
    </div>
  )
}

export function SettingsDialog({ settings, onSave, onReset, onClose }: {
  settings: AppSettings; onSave: (s: AppSettings) => void; onReset: () => void; onClose: () => void
}) {
  const [local, setLocal] = useState<AppSettings>(settings)
  useEffect(() => setLocal(settings), [settings])
  // Esc fecha; a página de trás não rola enquanto o diálogo está aberto (celular).
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    const anterior = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = anterior }
  }, [onClose])

  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    setLocal(p => ({ ...p, [k]: v }))
  }

  return (
    <div className="calc2-settings" role="dialog" aria-modal="true" aria-label="Configurações da calculadora" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="calc2-settings-box" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 580, overflowY: 'auto', overscrollBehavior: 'contain', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

        <div className="calc2-settings-hdr" style={{ borderRadius: '12px 12px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={16} className="calc2-settings-hdr-icon" />
            <div>
              <h2 className="calc2-settings-hdr-title" style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>Configurações</h2>
              <p className="calc2-settings-hdr-sub" style={{ fontSize: 11.5, margin: '2px 0 0' }}>Calculadora Comercial 2</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="calc2-settings-hdr-close calc2-tap" style={{ width: 30, height: 30, minWidth: 30, flexShrink: 0, borderRadius: 7, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div className="calc2-settings-body" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* URL */}
          <Section title="📊 Fonte de dados">
            <label style={lbl}>URL da planilha (Google Sheets CSV)</label>
            <input value={local.spreadsheetUrl} onChange={e => set('spreadsheetUrl', e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              style={inp} onFocus={foc} onBlur={blr} />
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '7px 0 0', lineHeight: 1.5 }}>
              Publique a planilha como CSV em <strong>Arquivo → Compartilhar → Publicar na web</strong>. Dados atualizados a cada 60s.
            </p>
          </Section>

          {/* Mapeamento de colunas */}
          <Section title="📋 Colunas da planilha (índice 0-based)">
            <div className="calc2-set-grid" style={{ display: 'grid', gap: 9 }}>
              {Object.entries(local.columnMap).map(([k, v]) => (
                <div key={k}>
                  <label style={lbl}>{k}</label>
                  <input type="number" min={0} value={v}
                    onChange={e => set('columnMap', { ...local.columnMap, [k]: parseInt(e.target.value) || 0 })}
                    style={inp} onFocus={foc} onBlur={blr} />
                </div>
              ))}
            </div>
          </Section>

          {/* Condições padrão */}
          <Section title="💰 Condições padrão">
            <div className="calc2-set-grid" style={{ display: 'grid', gap: 11 }}>
              <div>
                <label style={lbl}>Desconto à vista padrão (%)</label>
                <input type="number" min={0} max={20} step={0.5}
                  value={local.cashDiscountPercent}
                  onChange={e => set('cashDiscountPercent', parseFloat(e.target.value) || 0)}
                  style={inp} onFocus={foc} onBlur={blr} />
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '5px 0 0' }}>Posição inicial da barra de negociação ao escolher "À vista". O limite máximo é configurado por vertical, mais abaixo.</p>
              </div>
              <div>
                <label style={lbl}>Juros padrão mensal (%)</label>
                <input type="number" min={0} max={100} step={0.01}
                  value={local.defaultMonthlyRate}
                  onChange={e => set('defaultMonthlyRate', parseFloat(e.target.value) || 0)}
                  style={inp} onFocus={foc} onBlur={blr} />
              </div>
            </div>
          </Section>

          {/* Juros por vertical */}
          <Section title="📈 Juros mensais por vertical (% a.m.)">
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '0 0 11px', lineHeight: 1.5 }}>
              Use <strong>0%</strong> para parcelamento sem juros. <strong>Med-Review R1</strong> padrão é 0% (12x sem juros).
            </p>
            <div className="calc2-set-grid" style={{ display: 'grid', gap: 9 }}>
              {VERTICALS.map(v => (
                <div key={v}>
                  <label style={lbl}>
                    {v}
                    {local.verticalRates[v] === 0 && <span style={{ color: '#22c55e', marginLeft: 4 }}>sem juros</span>}
                  </label>
                  <input type="number" min={0} max={100} step={0.01}
                    value={local.verticalRates[v] ?? local.defaultMonthlyRate}
                    onChange={e => set('verticalRates', { ...local.verticalRates, [v]: parseFloat(e.target.value) ?? 0 })}
                    style={{ ...inp, borderColor: (local.verticalRates[v] ?? local.defaultMonthlyRate) === 0 ? 'rgba(34,197,94,0.4)' : 'var(--border)' }}
                    onFocus={foc} onBlur={blr} />
                </div>
              ))}
            </div>
          </Section>

          {/* Limite da barra de negociação por vertical */}
          <Section title="🚧 Limite da barra de negociação por vertical (%)">
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '0 0 11px', lineHeight: 1.5 }}>
              Até onde a barra de desconto de cada vertical pode ir. Passou disso, o simulador avisa que está fora do limite.
            </p>
            <div className="calc2-set-grid" style={{ display: 'grid', gap: 9 }}>
              {VERTICALS.map(v => (
                <div key={v}>
                  <label style={lbl}>{v}</label>
                  <input type="number" min={0} max={100} step={0.5}
                    value={local.discountLimits?.[v] ?? 20}
                    onChange={e => set('discountLimits', { ...local.discountLimits, [v]: parseFloat(e.target.value) || 0 })}
                    style={inp} onFocus={foc} onBlur={blr} />
                </div>
              ))}
            </div>
          </Section>

          {/* Desconto evento */}
          <Section title="🎯 Desconto Evento por vertical (%)">
            <div className="calc2-set-grid" style={{ display: 'grid', gap: 9 }}>
              {VERTICALS.map(v => (
                <div key={v}>
                  <label style={lbl}>{v}</label>
                  <input type="number" min={0} max={100} step={0.1}
                    value={local.eventDiscounts[v] ?? 0}
                    onChange={e => set('eventDiscounts', { ...local.eventDiscounts, [v]: parseFloat(e.target.value) || 0 })}
                    style={inp} onFocus={foc} onBlur={blr} />
                </div>
              ))}
            </div>
          </Section>

          {/* Ações */}
          <div className="calc2-set-actions" style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={() => { onReset(); onClose() }} className="calc2-tap"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', gap: 6, height: 42, padding: '0 15px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <RotateCcw size={13} /> Restaurar padrões
            </button>
            <button onClick={onClose} className="calc2-tap"
              style={{ flex: '1 1 110px', height: 42, borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button onClick={() => { onSave(local); onClose() }} className="calc2-tap"
              style={{ flex: '2 1 170px', height: 42, borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}>
              Salvar configurações
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .calc2-settings-box { max-height: 92vh; max-height: calc(100dvh - 24px); }
        .calc2-set-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        .calc2-set-grid > div { min-width: 0; }
        /* rodapé sempre à vista: o formulário é longo e no celular o "Salvar" ficava lá embaixo */
        .calc2-set-actions { position: sticky; bottom: 0; z-index: 2; margin: 4px -22px -18px; padding: 12px 22px calc(14px + env(safe-area-inset-bottom)); background: var(--card); border-top: 1px solid var(--border); }
        @media (max-width: 520px) {
          .calc2-set-grid { grid-template-columns: minmax(0,1fr); }
          .calc2-settings-body { padding: 14px 14px !important; }
          .calc2-set-actions { margin: 4px -14px -14px; padding: 12px 14px calc(14px + env(safe-area-inset-bottom)); }
          .calc2-set-actions > button { flex: 1 1 calc(50% - 5px) !important; min-width: 0; height: auto !important; min-height: 44px; padding: 6px 10px !important; line-height: 1.2; }
          .calc2-set-actions > button:last-child { order: -1; flex: 1 1 100% !important; }      /* "Salvar" em linha própria, no topo */
        }
        @media (pointer: coarse) { .calc2-settings-hdr-close { width: 44px !important; height: 44px !important; } }
        /* Header do modal — claro por padrão (fundo neutro, texto escuro).
           .dark restaura o gradiente escuro original, ponto a ponto. */
        .calc2-settings-hdr { background: var(--card); border-bottom: 1px solid var(--border); }
        .calc2-settings-hdr-icon { color: var(--foreground); }
        .calc2-settings-hdr-title { color: var(--foreground); }
        .calc2-settings-hdr-sub { color: var(--muted-foreground); }
        .calc2-settings-hdr-close { background: var(--secondary); color: var(--muted-foreground); }
        .calc2-settings-hdr-close:hover { background: var(--border); color: var(--foreground); }

        .dark .calc2-settings-hdr { background: linear-gradient(135deg,#0f0524,#1e0b45,#2e1065); border-bottom: none; }
        .dark .calc2-settings-hdr-icon { color: #fff; }
        .dark .calc2-settings-hdr-title { color: #fff; }
        .dark .calc2-settings-hdr-sub { color: rgba(255,255,255,0.6); }
        .dark .calc2-settings-hdr-close { background: rgba(255,255,255,0.12); color: #fff; }
        .dark .calc2-settings-hdr-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
      `}</style>
    </div>
  )
}
