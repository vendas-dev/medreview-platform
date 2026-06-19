'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { VERTICAL_LIST, GOLD } from '@/lib/telao/types'
import { todayKey, monthKey } from '@/lib/telao/format'

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 9,
  border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.06)',
  color: '#c4b5fd', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: 'none',
}

export default function TelaoSettings() {
  const supabase = createClient()
  const [goals,   setGoals]   = useState<any[]>([])
  const [closers, setClosers] = useState<any[]>([])
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    supabase.from('telao_goals').select('*').then(({ data }) => setGoals(data ?? []))
    supabase.from('closers').select('*').order('name').then(({ data }) => setClosers(data ?? []))
  }, [])

  // ── Metas ──────────────────────────────────────────────────
  async function upsertGoal(period: 'day'|'month', periodKey: string, vertical: string|null, value: string) {
    const v = parseFloat(value)
    if (isNaN(v)) return
    await supabase.from('telao_goals').upsert(
      { period, period_key: periodKey, vertical, target_value: v, updated_at: new Date().toISOString() },
      { onConflict: 'period,period_key,vertical' }
    )
    const { data } = await supabase.from('telao_goals').select('*')
    setGoals(data ?? [])
    setMsg('Meta salva!')
    setTimeout(() => setMsg(''), 2000)
  }

  function getGoal(period: 'day'|'month', periodKey: string, vertical: string|null) {
    return goals.find(g => g.period === period && g.period_key === periodKey && g.vertical === vertical)?.target_value ?? ''
  }

  // ── Closers ────────────────────────────────────────────────
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
    setMsg('Closer salvo!')
    setTimeout(() => setMsg(''), 2000)
  }

  async function deleteCloser(id: string) {
    await supabase.from('closers').delete().eq('id', id)
    setClosers(prev => prev.filter(c => c.id !== id))
  }

  function addCloser() {
    setClosers(prev => [...prev, { id: null, name: '', color: GOLD, aliases: [], badge: '★' }])
  }

  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '20px 24px', marginBottom: 20,
  }

  return (
    <div style={{ background: '#0d0015', minHeight: '100vh', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", padding: 'clamp(20px,4vw,40px)', maxWidth: 800, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=JetBrains+Mono&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/telao" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b21a8', textDecoration: 'none', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
          <ChevronLeft size={16} /> Voltar ao Telão
        </Link>
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 12, color: '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>✓ {msg}</span>}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 24px', letterSpacing: '-0.02em' }}>Configurações</h1>

      {/* ── Metas do dia ─────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: GOLD, margin: '0 0 16px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>🎯 Meta do Dia — {todayKey()}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6b21a8', display: 'block', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Geral (R$)</label>
            <input style={inp} type="number" defaultValue={getGoal('day', todayKey(), null)}
              onBlur={e => upsertGoal('day', todayKey(), null, e.target.value)} />
          </div>
          {VERTICAL_LIST.map(v => (
            <div key={v.id}>
              <label style={{ fontSize: 10, color: v.accent, display: 'block', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>{v.short} (R$)</label>
              <input style={inp} type="number" defaultValue={getGoal('day', todayKey(), v.id)}
                onBlur={e => upsertGoal('day', todayKey(), v.id, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Metas do mês ─────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: GOLD, margin: '0 0 16px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>📅 Meta do Mês — {monthKey()}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6b21a8', display: 'block', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Geral (R$)</label>
            <input style={inp} type="number" defaultValue={getGoal('month', monthKey(), null)}
              onBlur={e => upsertGoal('month', monthKey(), null, e.target.value)} />
          </div>
          {VERTICAL_LIST.map(v => (
            <div key={v.id}>
              <label style={{ fontSize: 10, color: v.accent, display: 'block', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>{v.short} (R$)</label>
              <input style={inp} type="number" defaultValue={getGoal('month', monthKey(), v.id)}
                onBlur={e => upsertGoal('month', monthKey(), v.id, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Closers ──────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: GOLD, margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>👤 Closers</h2>
          <button onClick={addCloser} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${GOLD}44`, background: GOLD + '11', color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
            <Plus size={13} /> Novo closer
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {closers.map((c, i) => (
            <div key={c.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              {/* Preview avatar */}
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#000', flexShrink: 0 }}>
                {c.name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase() || '?'}
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#6b21a8', display: 'block', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Nome</label>
                <input style={inp} value={c.name} onChange={e => setClosers(prev => prev.map((x, j) => j===i ? {...x, name: e.target.value} : x))} />
              </div>

              <div style={{ width: 100 }}>
                <label style={{ fontSize: 10, color: '#6b21a8', display: 'block', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Cor</label>
                <input type="color" value={c.color} onChange={e => setClosers(prev => prev.map((x, j) => j===i ? {...x, color: e.target.value} : x))}
                  style={{ width: '100%', height: 38, borderRadius: 9, border: '1px solid rgba(139,92,246,0.2)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
              </div>

              <div style={{ width: 80 }}>
                <label style={{ fontSize: 10, color: '#6b21a8', display: 'block', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Badge</label>
                <input style={inp} value={c.badge} maxLength={4} onChange={e => setClosers(prev => prev.map((x, j) => j===i ? {...x, badge: e.target.value} : x))} />
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => saveCloser(c)} disabled={saving}
                  style={{ width: 34, height: 38, borderRadius: 8, border: 'none', background: '#22c55e22', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Save size={14} />
                </button>
                {c.id && (
                  <button onClick={() => deleteCloser(c.id)}
                    style={{ width: 34, height: 38, borderRadius: 8, border: 'none', background: '#ef444422', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook info */}
      <div style={{ ...sectionStyle, borderColor: 'rgba(99,102,241,0.2)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#6366f1', margin: '0 0 12px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>🔗 Endpoint de ingestão</h2>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '12px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#6366f1', overflowX: 'auto' }}>
          POST /api/public/events
        </div>
        <p style={{ fontSize: 12, color: '#6b21a8', margin: '10px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
          Endpoint público — configure no n8n ou HubSpot para disparar ao fechar uma venda.
        </p>
      </div>
    </div>
  )
}
