'use client'
import { useState, useEffect } from 'react'
import { X, Settings, RotateCcw } from 'lucide-react'
import { AppSettings } from '../lib/types'

const VERTICALS = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

const inp: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px', borderRadius: 11,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--secondary)', borderRadius: 14, padding: '16px', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      {children}
    </div>
  )
}

export function SettingsDialog({ settings, onSave, onReset, onClose }: {
  settings: AppSettings; onSave: (s: AppSettings) => void; onReset: () => void; onClose: () => void
}) {
  const [local, setLocal] = useState<AppSettings>(settings)
  useEffect(() => setLocal(settings), [settings])

  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    setLocal(p => ({ ...p, [k]: v }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

        <div style={{ background: 'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius: '24px 24px 0 0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={17} style={{ color: '#fff' }} />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>Configurações</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Calculadora Comercial 2</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* URL */}
          <Section title="📊 Fonte de dados">
            <label style={lbl}>URL da planilha (Google Sheets CSV)</label>
            <input value={local.spreadsheetUrl} onChange={e => set('spreadsheetUrl', e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              style={inp} onFocus={foc} onBlur={blr} />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Publique a planilha como CSV em <strong>Arquivo → Compartilhar → Publicar na web</strong>. Dados atualizados a cada 60s.
            </p>
          </Section>

          {/* Mapeamento de colunas */}
          <Section title="📋 Colunas da planilha (índice 0-based)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Desconto à vista (%)</label>
                <input type="number" min={0} max={100} step={0.1}
                  value={local.cashDiscountPercent}
                  onChange={e => set('cashDiscountPercent', parseFloat(e.target.value) || 0)}
                  style={inp} onFocus={foc} onBlur={blr} />
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
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Use <strong>0%</strong> para parcelamento sem juros. <strong>Med-Review R1</strong> padrão é 0% (12x sem juros).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

          {/* Desconto evento */}
          <Section title="🎯 Desconto Evento por vertical (%)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { onReset(); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <RotateCcw size={13} /> Restaurar padrões
            </button>
            <button onClick={onClose}
              style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button onClick={() => { onSave(local); onClose() }}
              style={{ flex: 2, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}>
              Salvar configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
