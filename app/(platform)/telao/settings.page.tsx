'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, ChevronLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { VERTICAL_LIST, GOLD } from '@/lib/telao/types'

function pad(n: number) { return String(n).padStart(2, '0') }
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function localMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}`
}

const inp: React.CSSProperties = {
  height: 38, padding: '0 12px', borderRadius: 9,
  border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
  color: '#c4b5fd', fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: 'none',
  colorScheme: 'dark', width: '100%',
}
const dateInp: React.CSSProperties = { ...inp, width: '100%', padding: '0 10px' }

export default function TelaoSettings() {
  const supabase = createClient()
  const [goals,       setGoals]       = useState<any[]>([])
  const [closers,     setClosers]     = useState<any[]>([])
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState('')
  // Seleção de período para metas
  const [selectedDay,   setSelectedDay]   = useState(localToday())
  const [selectedMonth, setSelectedMonth] = useState(localMonth())

  useEffect(() => {
    supabase.from('telao_goals').select('*').then(({ data }) => setGoals(data ?? []))
    supabase.from('closers').select('*').order('name').then(({ data }) => setClosers(data ?? []))
  }, [])

  async function upsertGoal(period: 'day'|'month', periodKey: string, vertical: string|null, value: string) {
    const v = parseFloat(value)
    if (isNaN(v) || v < 0) return
    setSaving(true)
    await supabase.from('telao_goals').upsert(
      { period, period_key: periodKey, vertical, target_value: v, updated_at: new Date().toISOString() },
      { onConflict: 'period,period_key,vertical' }
    )
    const { data } = await supabase.from('telao_goals').select('*')
    setGoals(data ?? [])
    setSaving(false)
    flash('Meta salva!')
  }

  function getGoal(period: 'day'|'month', periodKey: string, vertical: string|null) {
    return goals.find(g => g.period === period && g.period_key === periodKey && g.vertical === vertical)?.target_value ?? ''
  }

  async function deleteGoal(period: 'day'|'month', periodKey: string, vertical: string|null) {
    await supabase.from('telao_goals').delete().match({ period, period_key: periodKey, vertical })
    const { data } = await supabase.from('telao_goals').select('*')
    setGoals(data ?? [])
    flash('Meta removida.')
  }

  async function saveCloser(c: any) {
    setSaving(true)
    if (c.id) {
      await supabase.from('closers').update({ name: c.name, color: c.color, aliases: c.aliases, badge: c.badge }).eq('id', c.id)
    } else {
      const norm = c.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9 ]/g,'').trim()
      await supabase.from('closers').insert({ name: c.name, normalized_name: norm, color: c.color, aliases: c.aliases, badge: c.badge })
    }
    const { data } = await supabase.from('closers').select('*').order('name')
    setClosers(data ?? [])
    setSaving(false)
    flash('Closer salvo!')
  }

  async function deleteCloser(id: string) {
    await supabase.from('closers').delete().eq('id', id)
    setClosers(prev => prev.filter(c => c.id !== id))
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  const card: React.CSSProperties = {
    background: 'rgba(139,92,246,.06)',
    border: '1px solid rgba(139,92,246,.18)',
    borderRadius: 18, padding: '20px 22px', marginBottom: 20,
  }
  const sectionH: React.CSSProperties = {
    fontSize: 13, fontWeight: 800, color: GOLD,
    fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase',
    letterSpacing: '.08em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
  }

  return (
    <div style={{ background: '#0d0015', minHeight: '100vh', color: '#fff', fontFamily: "'Space Grotesk',sans-serif", padding: 'clamp(20px,4vw,40px)', maxWidth: 840, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=JetBrains+Mono&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Link href="/telao" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4a2d6b', textDecoration: 'none', fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }}>
          <ChevronLeft size={16} /> Voltar ao Telão
        </Link>
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 12, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace", background: 'rgba(34,197,94,.1)', padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,.2)' }}>✓ {msg}</span>}
        {saving && <span style={{ fontSize: 11, color: '#7c3aed', fontFamily: "'JetBrains Mono',monospace" }}>Salvando...</span>}
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f3e8ff', margin: '0 0 28px', letterSpacing: '-.02em' }}>Configurações</h1>

      {/* ── Seleção de período ──────────────────────────────── */}
      <div style={{ ...card, borderColor: 'rgba(139,92,246,.3)' }}>
        <p style={sectionH}><Calendar size={14}/> Período selecionado</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, color: '#4a2d6b', display: 'block', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '.08em' }}>Dia</label>
            <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={dateInp} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#4a2d6b', display: 'block', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '.08em' }}>Mês</label>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={dateInp} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#4a2d6b', marginTop: 12, fontFamily: "'JetBrains Mono',monospace" }}>
          As metas abaixo são para: <strong style={{ color: '#a855f7' }}>{selectedDay}</strong> (dia) e <strong style={{ color: '#a855f7' }}>{selectedMonth}</strong> (mês)
        </p>
      </div>

      {/* ── Meta do dia ─────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionH}>🎯 Meta do Dia — {selectedDay}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {/* Geral */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 10, color: '#4a2d6b', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>Geral (R$)</label>
              {getGoal('day', selectedDay, null) !== '' && (
                <button onClick={() => deleteGoal('day', selectedDay, null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>remover</button>
              )}
            </div>
            <input style={inp} type="number" min="0" defaultValue={getGoal('day', selectedDay, null)} key={`geral-day-${selectedDay}`}
              onBlur={e => upsertGoal('day', selectedDay, null, e.target.value)} />
          </div>
          {VERTICAL_LIST.map(v => (
            <div key={v.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 10, color: v.accent, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>{v.short}</label>
                {getGoal('day', selectedDay, v.id) !== '' && (
                  <button onClick={() => deleteGoal('day', selectedDay, v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>remover</button>
                )}
              </div>
              <input style={inp} type="number" min="0" defaultValue={getGoal('day', selectedDay, v.id)} key={`${v.id}-day-${selectedDay}`}
                onBlur={e => upsertGoal('day', selectedDay, v.id, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Meta do mês ─────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionH}>📅 Meta do Mês — {selectedMonth}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 10, color: '#4a2d6b', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>Geral (R$)</label>
              {getGoal('month', selectedMonth, null) !== '' && (
                <button onClick={() => deleteGoal('month', selectedMonth, null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>remover</button>
              )}
            </div>
            <input style={inp} type="number" min="0" defaultValue={getGoal('month', selectedMonth, null)} key={`geral-month-${selectedMonth}`}
              onBlur={e => upsertGoal('month', selectedMonth, null, e.target.value)} />
          </div>
          {VERTICAL_LIST.map(v => (
            <div key={v.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 10, color: v.accent, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>{v.short}</label>
                {getGoal('month', selectedMonth, v.id) !== '' && (
                  <button onClick={() => deleteGoal('month', selectedMonth, v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>remover</button>
                )}
              </div>
              <input style={inp} type="number" min="0" defaultValue={getGoal('month', selectedMonth, v.id)} key={`${v.id}-month-${selectedMonth}`}
                onBlur={e => upsertGoal('month', selectedMonth, v.id, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Closers ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ ...sectionH, margin: 0 }}>👤 Closers</p>
          <button onClick={() => setClosers(prev => [...prev, { id: null, name: '', color: GOLD, aliases: [], badge: '★' }])}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${GOLD}44`, background: GOLD+'11', color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={13}/> Novo closer
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {closers.map((c, i) => (
            <div key={c.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px 14px', background: 'rgba(139,92,246,.04)', border: '1px solid rgba(139,92,246,.12)', borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {c.name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: '#4a2d6b', display: 'block', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>Nome</label>
                <input style={inp} value={c.name} onChange={e => setClosers(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))} />
              </div>
              <div style={{ width: 90 }}>
                <label style={{ fontSize: 9, color: '#4a2d6b', display: 'block', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>Cor</label>
                <input type="color" value={c.color} onChange={e => setClosers(prev => prev.map((x,j) => j===i?{...x,color:e.target.value}:x))}
                  style={{ width: '100%', height: 38, borderRadius: 9, border: '1px solid rgba(139,92,246,.2)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => saveCloser(c)} disabled={saving} style={{ width: 34, height: 38, borderRadius: 8, border: 'none', background: 'rgba(34,197,94,.1)', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Save size={14}/>
                </button>
                {c.id && <button onClick={() => deleteCloser(c.id)} style={{ width: 34, height: 38, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={14}/>
                </button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoint info */}
      <div style={{ ...card, borderColor: 'rgba(99,102,241,.2)' }}>
        <p style={{ ...sectionH, color: '#6366f1' }}>🔗 Endpoint de ingestão</p>
        <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: '10px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#6366f1', marginBottom: 10 }}>
          POST /api/public/events
        </div>
        <p style={{ fontSize: 11, color: '#4a2d6b', margin: 0, fontFamily: "'JetBrains Mono',monospace" }}>
          Configure no n8n ou HubSpot. Use <code style={{ color: '#a855f7' }}>closer_hubspot_id</code> para vincular vendas automaticamente.
        </p>
      </div>
    </div>
  )
}
