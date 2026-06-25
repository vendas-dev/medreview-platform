'use client'
import { useState, useCallback } from 'react'
import { Target, ChevronLeft, ChevronRight, Save, Check, Loader2 } from 'lucide-react'

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

function CurrencyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [display, setDisplay] = useState(value > 0 ? maskBRL((value * 100).toFixed(0)) : '')

  // Quando value externo muda (troca de mês), resetar display
  const prevValue = value
  if (value === 0 && display !== '') {
    // será resetado pelo key no card pai
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskBRL(e.target.value)
    setDisplay(masked)
    onChange(parseBRL(masked))
  }

  return (
    <input type="text" inputMode="numeric" value={display} onChange={handleChange}
      placeholder="R$ 0,00"
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

// ── Card por closer — key={closer.id+month} força remount ao trocar mês ──
function CloserGoalCard({ closer, month }: { closer: any; month: string }) {
  const isR1  = closer.team === 'R1'
  const isOAO = closer.team === 'OAO'
  const verticals = isR1 ? VERTICALS_R1 : isOAO ? VERTICALS_OAO : []

  // Inicializa com os dados já carregados para este mês
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
      const res = await fetch('/api/intel/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: closer.id, month, goal_sales: goalSales, goal_ambassador: goalAmbassador, goals_by_vertical: goalsByVertical }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  const teamColor = isR1
    ? { bg: 'rgba(124,58,237,.1)', color: '#7c3aed' }
    : { bg: 'rgba(37,99,235,.1)',  color: '#2563eb' }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
          {closer.name.split(' ').slice(0,2).map((n: string) => n[0]).join('')}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{closer.name}</p>
          <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 6, background: teamColor.bg, color: teamColor.color, fontWeight: 700 }}>
            Time {closer.team ?? '—'}
          </span>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: saved ? '#22c55e' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1, transition: 'background .2s' }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> : saved ? <Check size={13}/> : <Save size={13}/>}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Campos */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <p style={{ margin: 0, fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8 }}>⚠ {error}</p>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>🎯 Meta geral de vendas</label>
          <CurrencyInput value={goalSales} onChange={setGoalSales}/>
        </div>

        {isR1 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>🌟 Meta de embaixadores</label>
            <CurrencyInput value={goalAmbassador} onChange={setGoalAmbassador}/>
          </div>
        )}

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

// ── GoalsManager ────────────────────────────────────────────
export function GoalsManager({ closers: initialClosers, month: initialMonth }: { closers: any[]; month: string }) {
  const [currentMonth,  setCurrentMonth]  = useState(initialMonth)
  const [closers,       setClosers]       = useState(initialClosers)
  const [loadingMonth,  setLoadingMonth]  = useState(false)
  const [filterTeam,    setFilterTeam]    = useState<'todos'|'R1'|'OAO'>('todos')

  const [y, m] = currentMonth.split('-').map(Number)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  async function changeMonth(delta: number) {
    const [cy, cm] = currentMonth.split('-').map(Number)
    const d = new Date(cy, cm - 1 + delta, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    setLoadingMonth(true)
    try {
      const res  = await fetch(`/api/intel/goals?month=${newMonth}`)
      const data = await res.json()
      setClosers(data.closers ?? [])
      setCurrentMonth(newMonth)
    } catch {
      // mantém o mês atual se falhar
    } finally {
      setLoadingMonth(false)
    }
  }

  const filtered = closers.filter(c =>
    filterTeam === 'todos' || c.team === filterTeam
  )

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,.3)' }}>
          <Target size={18} color="#fff"/>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.02em' }}>Metas dos Closers</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Metas mensais por closer e por vertical · cada mês é independente</p>
        </div>

        {/* Seletor de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 6px' }}>
          <button onClick={() => changeMonth(-1)} disabled={loadingMonth}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', opacity: loadingMonth ? .5 : 1 }}>
            <ChevronLeft size={14}/>
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>
            {loadingMonth ? '...' : monthLabel}
          </span>
          <button onClick={() => changeMonth(1)} disabled={loadingMonth}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', opacity: loadingMonth ? .5 : 1 }}>
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      {/* Filtro de time */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>Filtrar:</span>
        {([
          { key: 'todos', label: '👥 Todos' },
          { key: 'R1',   label: '🟣 Time R1' },
          { key: 'OAO',  label: '🔵 Time OAO' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setFilterTeam(t.key)}
            style={{
              height: 32, padding: '0 14px', borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${filterTeam === t.key ? '#6366f1' : 'var(--border)'}`,
              background: filterTeam === t.key ? 'rgba(99,102,241,.1)' : 'var(--background)',
              color: filterTeam === t.key ? '#6366f1' : 'var(--muted-foreground)',
              fontSize: 12, fontWeight: filterTeam === t.key ? 700 : 500,
              transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>
          {filtered.length} closer{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid — key inclui currentMonth para forçar remount dos cards ao trocar mês */}
      {loadingMonth ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted-foreground)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }}/>
          <p style={{ marginTop: 12, fontSize: 13 }}>Carregando metas...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(440px,1fr))', gap: 16 }}>
          {filtered.map(c => (
            // key com mês garante que o card remonta ao trocar de mês, zerando os estados
            <CloserGoalCard key={`${c.id}-${currentMonth}`} closer={c} month={currentMonth}/>
          ))}
        </div>
      )}

      {!loadingMonth && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted-foreground)' }}>
          <Target size={36} style={{ margin: '0 auto 12px', opacity: .3 }}/>
          <p style={{ fontSize: 14 }}>Nenhum consultor encontrado.</p>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
