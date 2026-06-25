'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, ChevronLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { VERTICAL_LIST } from '@/lib/telao/types'

// ── Utilitários de data ────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0') }
function localToday()   { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function localMonth()   { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}` }

export default function TelaoSettings() {
  const supabase = createClient()
  const [goals,       setGoals]       = useState<any[]>([])
  const [closers,     setClosers]     = useState<any[]>([])
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState('')
  // Novo UX: escolher tipo de período primeiro
  const [periodType,    setPeriodType]    = useState<'day' | 'month'>('day')
  const [selectedDay,   setSelectedDay]   = useState(localToday())
  const [selectedMonth, setSelectedMonth] = useState(localMonth())

  const periodKey = periodType === 'day' ? selectedDay : selectedMonth

  useEffect(() => {
    supabase.from('telao_goals').select('*').then(({ data }) => setGoals(data ?? []))
    supabase.from('closers').select('*').order('name').then(({ data }) => setClosers(data ?? []))
  }, [])

  async function upsertGoal(vertical: string | null, value: string) {
    const v = parseFloat(value)
    if (isNaN(v) || v < 0) return
    setSaving(true)
    await supabase.from('telao_goals').upsert(
      { period: periodType, period_key: periodKey, vertical, target_value: v, updated_at: new Date().toISOString() },
      { onConflict: 'period,period_key,vertical' }
    )
    const { data } = await supabase.from('telao_goals').select('*')
    setGoals(data ?? [])
    setSaving(false)
    flash('Meta salva!')
  }

  function getGoal(vertical: string | null) {
    return goals.find(g =>
      g.period === periodType &&
      g.period_key === periodKey &&
      g.vertical === vertical
    )?.target_value ?? ''
  }

  async function removeGoal(vertical: string | null) {
    await supabase.from('telao_goals').delete().match({ period: periodType, period_key: periodKey, vertical })
    const { data } = await supabase.from('telao_goals').select('*')
    setGoals(data ?? [])
    flash('Meta removida.')
  }

  async function saveCloser(closer: any) {
    setSaving(true)
    if (closer.id) {
      await supabase.from('closers').update({ name: closer.name, color: closer.color, aliases: closer.aliases, badge: closer.badge }).eq('id', closer.id)
    } else {
      const norm = closer.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim()
      await supabase.from('closers').insert({ name: closer.name, normalized_name: norm, color: closer.color, aliases: closer.aliases, badge: closer.badge })
    }
    const { data } = await supabase.from('closers').select('*').order('name')
    setClosers(data ?? [])
    setSaving(false)
    flash('Closer salvo!')
  }

  async function deleteCloser(id: string) {
    await supabase.from('closers').delete().eq('id', id)
    setClosers(prev => prev.filter(c => c.id !== id))
    flash('Closer removido.')
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  // ── Estilos adaptados ao tema da plataforma ────────────────
  const inp: React.CSSProperties = {
    height: 42, padding: '0 14px', borderRadius: 10,
    border: '1.5px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', width: '100%',
    transition: 'border-color .15s, box-shadow .15s',
  }
  const card: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 18, padding: '20px 22px', marginBottom: 20,
    boxShadow: '0 2px 12px rgba(0,0,0,.06)',
  }
  const sectionH = (color = '#7c3aed'): React.CSSProperties => ({
    fontSize: 13, fontWeight: 800, color,
    textTransform: 'uppercase', letterSpacing: '.08em',
    margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
  })
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)',
    display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '.07em',
  }
  const focus = (e: any) => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.1)' }
  const blur  = (e: any) => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }

  const periodLabel = periodType === 'day'
    ? `Dia ${selectedDay.split('-').reverse().join('/')}`
    : `Mês ${selectedMonth}`

  return (
    <div style={{ padding: 'clamp(20px,4vw,40px)', maxWidth: 800, margin: '0 auto', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Link href="/telao" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-foreground)', textDecoration: 'none', fontSize: 13, transition: 'color .15s' }}
          onMouseEnter={e=>e.currentTarget.style.color='var(--foreground)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--muted-foreground)'}>
          <ChevronLeft size={16}/> Voltar ao Telão
        </Link>
        <div style={{ flex: 1 }}/>
        {saving && <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Salvando...</span>}
        {msg && (
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', padding: '4px 12px', borderRadius: 999 }}>
            ✓ {msg}
          </span>
        )}
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 24px', letterSpacing: '-.02em' }}>
        Configurações do Telão
      </h1>

      {/* ── SELEÇÃO DO TIPO DE PERÍODO ──────────────────────── */}
      <div style={card}>
        <p style={sectionH()}>
          <Calendar size={15}/> Definir meta de:
        </p>

        {/* Toggle Dia / Mês */}
        <div style={{ display: 'inline-flex', background: 'var(--secondary)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 20 }}>
          {(['day', 'month'] as const).map(type => (
            <button key={type} onClick={() => setPeriodType(type)}
              style={{
                height: 38, padding: '0 24px', borderRadius: 9, border: 'none',
                background: periodType === type ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent',
                color: periodType === type ? '#fff' : 'var(--muted-foreground)',
                fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .2s', boxShadow: periodType === type ? '0 2px 10px rgba(79,70,229,.35)' : 'none',
              }}>
              {type === 'day' ? '📅 Dia específico' : '📆 Mês inteiro'}
            </button>
          ))}
        </div>

        {/* Input de data/mês */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            {periodType === 'day' ? (
              <>
                <label style={lbl}>Selecione o dia</label>
                <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}
                  style={inp} onFocus={focus} onBlur={blur}/>
              </>
            ) : (
              <>
                <label style={lbl}>Selecione o mês</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  style={inp} onFocus={focus} onBlur={blur}/>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }}>
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', width: '100%' }}>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 4px' }}>Definindo meta para:</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', margin: 0 }}>{periodLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CAMPOS DE META ───────────────────────────────────── */}
      <div style={card}>
        <p style={sectionH('#6366f1')}>
          🎯 Meta {periodType === 'day' ? `do Dia — ${selectedDay}` : `do Mês — ${selectedMonth}`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>

          {/* Geral */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={lbl}>Geral (R$)</label>
              {getGoal(null) !== '' && (
                <button onClick={() => removeGoal(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0, fontWeight: 700 }}>× remover</button>
              )}
            </div>
            <input style={inp} type="number" min="0" step="100"
              defaultValue={getGoal(null)}
              key={`geral-${periodType}-${periodKey}`}
              placeholder="R$ 0"
              onFocus={focus} onBlur={e => { blur(e); upsertGoal(null, e.target.value) }}/>
          </div>

          {/* Por vertical */}
          {VERTICAL_LIST.map(v => (
            <div key={v.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...lbl, color: v.accent }}>{v.short} (R$)</label>
                {getGoal(v.id) !== '' && (
                  <button onClick={() => removeGoal(v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0, fontWeight: 700 }}>× remover</button>
                )}
              </div>
              <input style={{ ...inp, borderColor: getGoal(v.id) !== '' ? v.accent + '44' : 'var(--border)' }}
                type="number" min="0" step="100"
                defaultValue={getGoal(v.id)}
                key={`${v.id}-${periodType}-${periodKey}`}
                placeholder="R$ 0"
                onFocus={e => { e.target.style.borderColor=v.accent; e.target.style.boxShadow=`0 0 0 3px ${v.accent}22` }}
                onBlur={e => { e.target.style.borderColor=getGoal(v.id)!==''?v.accent+'44':'var(--border)'; e.target.style.boxShadow='none'; upsertGoal(v.id, e.target.value) }}/>
            </div>
          ))}
        </div>
      </div>

      {/* ── CLOSERS ──────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ ...sectionH(), margin: 0 }}>👤 Closers</p>
          <button onClick={() => setClosers(prev => [...prev, { id: null, name: '', color: '#7c3aed', aliases: [], badge: '★' }])}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 9, border: '1.5px solid rgba(99,102,241,.3)', background: 'rgba(99,102,241,.06)', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={13}/> Novo closer
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {closers.map((closer, i) => (
            <div key={closer.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px 14px', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {/* Avatar preview */}
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: closer.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {closer.name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Nome</label>
                <input style={inp} value={closer.name} onFocus={focus} onBlur={blur}
                  onChange={e => setClosers(prev => prev.map((x,j) => j===i ? {...x,name:e.target.value} : x))}/>
              </div>
              <div style={{ width: 90 }}>
                <label style={lbl}>Cor</label>
                <input type="color" value={closer.color}
                  onChange={e => setClosers(prev => prev.map((x,j) => j===i ? {...x,color:e.target.value} : x))}
                  style={{ width: '100%', height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', padding: 3 }}/>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => saveCloser(closer)} disabled={saving}
                  style={{ width: 36, height: 42, borderRadius: 9, border: 'none', background: 'rgba(34,197,94,.1)', color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Save size={14}/>
                </button>
                {closer.id && (
                  <button onClick={() => deleteCloser(closer.id)}
                    style={{ width: 36, height: 42, borderRadius: 9, border: 'none', background: 'rgba(239,68,68,.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>
          ))}
          {closers.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, padding: '20px 0' }}>
              Nenhum closer cadastrado ainda.
            </p>
          )}
        </div>
      </div>

      {/* Endpoint info */}
      <div style={{ ...card, borderColor: 'rgba(99,102,241,.2)' }}>
        <p style={sectionH('#6366f1')}>🔗 Endpoint de ingestão</p>
        <div style={{ background: 'var(--secondary)', borderRadius: 10, padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: '#6366f1', marginBottom: 10 }}>
          POST /api/public/events
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
          Configure no n8n ou HubSpot. Use <code style={{ color: '#6366f1', background: 'rgba(99,102,241,.08)', padding: '1px 5px', borderRadius: 4 }}>closer_hubspot_id</code> para vincular vendas automaticamente.
        </p>
      </div>
    </div>
  )
}
