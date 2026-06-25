'use client'
import { useState, useCallback } from 'react'
import { Target, ChevronLeft, ChevronRight, Save, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Verticais por time ─────────────────────────────────────
const VERTICALS_R1  = ['Med-Review R1']
const VERTICALS_OAO = ['Anest-Review', 'Oft-Review', 'Ortop-Review']

// ── Máscara BRL ────────────────────────────────────────────
function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function parseBRL(v: string): number {
  return parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')) || 0
}

function CurrencyInput({ value, onChange, placeholder = 'R$ 0,00' }: {
  value: number; onChange: (v: number) => void; placeholder?: string
}) {
  const [display, setDisplay] = useState(value > 0 ? maskBRL((value * 100).toFixed(0)) : '')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskBRL(e.target.value)
    setDisplay(masked)
    onChange(parseBRL(masked))
  }

  return (
    <input
      type="text" inputMode="numeric" value={display} onChange={handleChange}
      placeholder={placeholder}
      style={{
        width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
        border: '1.5px solid var(--border)', background: 'var(--background)',
        color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit',
        fontVariantNumeric: 'tabular-nums', outline: 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
      onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,.1)' }}
      onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

// ── Card de meta por closer ────────────────────────────────
function CloserGoalCard({ closer, month, onSaved }: { closer: any; month: string; onSaved: () => void }) {
  const isR1  = closer.team === 'R1'
  const isOAO = closer.team === 'OAO'
  const verticals = isR1 ? VERTICALS_R1 : isOAO ? VERTICALS_OAO : []

  const [goalSales,       setGoalSales]       = useState<number>(closer.goal?.goal_sales      ?? 0)
  const [goalAmbassador,  setGoalAmbassador]  = useState<number>(closer.goal?.goal_ambassador ?? 0)
  const [goalsByVertical, setGoalsByVertical] = useState<Record<string,number>>(closer.goal?.goals_by_vertical ?? {})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  function setVerticalGoal(vert: string, val: number) {
    setGoalsByVertical(prev => ({ ...prev, [vert]: val }))
  }

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res  = await fetch('/api/intel/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: closer.id, month, goal_sales: goalSales, goal_ambassador: goalAmbassador, goals_by_vertical: goalsByVertical }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
      setSaved(true); onSaved()
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
      {/* Header do card */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
          {closer.name.split(' ').slice(0,2).map((n: string) => n[0]).join('')}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{closer.name}</p>
          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 6, background: isR1 ? 'rgba(99,102,241,.1)' : 'rgba(168,85,247,.1)', color: isR1 ? '#6366f1' : '#a855f7', fontWeight: 700 }}>Time {closer.team ?? '—'}</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: saved ? '#22c55e' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1, transition: 'all .2s' }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> : saved ? <Check size={13}/> : <Save size={13}/>}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Campos */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <p style={{ margin: 0, fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8 }}>⚠ {error}</p>}

        {/* Meta geral de vendas */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>🎯 Meta geral de vendas</label>
          <CurrencyInput value={goalSales} onChange={setGoalSales}/>
        </div>

        {/* Meta de embaixadores — só R1 */}
        {isR1 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>🌟 Meta de embaixadores</label>
            <CurrencyInput value={goalAmbassador} onChange={setGoalAmbassador}/>
          </div>
        )}

        {/* Metas por vertical */}
        {verticals.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>📊 Meta por vertical</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {verticals.map(v => (
                <div key={v} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{v}</span>
                  <CurrencyInput value={goalsByVertical[v] ?? 0} onChange={val => setVerticalGoal(v, val)}/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── GoalsManager principal ─────────────────────────────────
export function GoalsManager({ closers, month }: { closers: any[]; month: string }) {
  const router = useRouter()
  const [savedCount, setSavedCount] = useState(0)

  // Navegação de mês
  const [currentMonth, setCurrentMonth] = useState(month)
  function changeMonth(delta: number) {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(newMonth)
    router.refresh()
  }

  const [y, m] = currentMonth.split('-').map(Number)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,.3)' }}>
          <Target size={18} color="#fff"/>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.02em' }}>Metas dos Closers</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Defina as metas mensais por closer e por vertical</p>
        </div>

        {/* Seletor de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 6px' }}>
          <button onClick={() => changeMonth(-1)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
            <ChevronLeft size={14}/>
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
          <button onClick={() => changeMonth(1)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      {savedCount > 0 && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          ✅ {savedCount} meta{savedCount > 1 ? 's' : ''} salva{savedCount > 1 ? 's' : ''} com sucesso
        </div>
      )}

      {/* Grid de closers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(440px,1fr))', gap: 16 }}>
        {closers.map(c => (
          <CloserGoalCard key={c.id} closer={c} month={currentMonth} onSaved={() => setSavedCount(n => n + 1)}/>
        ))}
      </div>

      {closers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted-foreground)' }}>
          <Target size={36} style={{ margin: '0 auto 12px', opacity: .3 }}/>
          <p style={{ fontSize: 14 }}>Nenhum consultor cadastrado.</p>
        </div>
      )}
    </div>
  )
}
