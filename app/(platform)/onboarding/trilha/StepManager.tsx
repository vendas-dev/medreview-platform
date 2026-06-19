'use client'
import { useState } from 'react'
import { Plus, X, Sparkles } from 'lucide-react'

const inp: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

function SS({ name, value, defaultValue, onChange, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <select name={name} value={value} defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        style={{ ...inp, paddingRight: 34, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
        onFocus={foc} onBlur={blr}>
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

interface Step {
  id: string; title: string; description: string | null
  estimated_minutes: number | null; team: string; day_number: number | null
  completion_criteria: string; min_quiz_score: number
  onboarding_materials: any[]; onboarding_faqs: any[]; onboarding_questions: any[]
}

interface Props {
  mode: 'create' | 'edit'
  step?: any
  onCreated?: (step: Step) => void
  onUpdated?: (step: Partial<Step> & { id: string }) => void
}

export function StepManager({ mode, step, onCreated, onUpdated }: Props) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')

    const fd   = new FormData(e.currentTarget)
    const body = {
      id:                  step?.id,
      title:               fd.get('title'),
      description:         (fd.get('description') as string) || null,
      team:                fd.get('team') || 'ambos',
      day_number:          fd.get('day_number') || null,
      estimated_minutes:   fd.get('estimated_minutes') || null,
      completion_criteria: fd.get('completion_criteria') || 'visualizar',
      min_quiz_score:      fd.get('min_quiz_score') || 70,
      max_attempts:        fd.get('max_attempts') || null,
    }

    const res  = await fetch('/api/onboarding/steps', {
      method:  mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }

    // data.step tem o ID real do banco — atualiza a lista sem F5
    const saved: Step = {
      ...data.step,
      onboarding_materials: step?.onboarding_materials ?? [],
      onboarding_faqs:      step?.onboarding_faqs      ?? [],
      onboarding_questions: step?.onboarding_questions ?? [],
    }

    if (mode === 'create') onCreated?.(saved)
    else                   onUpdated?.(saved)

    setLoading(false)
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(79,70,229,0.35)', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.45)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.35)' }}>
        {mode === 'create' ? <><Plus size={14} /> Nova etapa</> : 'Editar etapa'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 64px rgba(0,0,0,0.25)' }}>

            <div style={{ background: 'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius: '22px 22px 0 0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} style={{ color: '#fbbf24' }} />
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>
                  {mode === 'create' ? 'Nova etapa da trilha' : 'Editar etapa'}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {error}</p>
                </div>
              )}

              <div>
                <label style={lbl}>Título *</label>
                <input name="title" required defaultValue={step?.title} placeholder="Ex: Conhecendo a MedReview"
                  style={inp} onFocus={foc} onBlur={blr} autoFocus />
              </div>

              <div>
                <label style={lbl}>Descrição</label>
                <textarea name="description" defaultValue={step?.description ?? ''} rows={3}
                  placeholder="O que o colaborador vai aprender nessa etapa?"
                  style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.55 }}
                  onFocus={foc} onBlur={blr} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>📅 Dia</label>
                  <SS name="day_number" defaultValue={step?.day_number ?? ''}>
                    <option value="">Sem dia</option>
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                  </SS>
                </div>
                <div>
                  <label style={lbl}>⏱ Tempo (min)</label>
                  <input name="estimated_minutes" type="number" defaultValue={step?.estimated_minutes ?? ''}
                    placeholder="30" style={inp} onFocus={foc} onBlur={blr} />
                </div>
                <div>
                  <label style={lbl}>👥 Time</label>
                  <SS name="team" defaultValue={step?.team ?? 'ambos'}>
                    <option value="ambos">Ambos</option>
                    <option value="OAO">Time OAO</option>
                    <option value="R1">Time R1</option>
                  </SS>
                </div>
              </div>

              <div>
                <label style={lbl}>🎯 Critério de conclusão</label>
                <SS name="completion_criteria" defaultValue={step?.completion_criteria ?? 'visualizar'}>
                  <option value="visualizar">Apenas visualizar</option>
                  <option value="materiais">Concluir materiais</option>
                  <option value="quiz">Passar no quiz</option>
                  <option value="materiais_e_quiz">Materiais + Quiz</option>
                </SS>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>🏆 Nota mínima (%)</label>
                  <input name="min_quiz_score" type="number" min={0} max={100}
                    defaultValue={step?.min_quiz_score ?? 70} style={inp} onFocus={foc} onBlur={blr} />
                </div>
                <div>
                  <label style={lbl}>🔄 Máx. tentativas</label>
                  <input name="max_attempts" type="number" defaultValue={step?.max_attempts ?? ''}
                    placeholder="Ilimitadas" style={inp} onFocus={foc} onBlur={blr} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                <button type="button" onClick={() => setOpen(false)}
                  style={{ flex: 1, height: 44, borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(79,70,229,0.35)' }}>
                  {loading ? 'Salvando...' : mode === 'create' ? '🚀 Criar etapa' : '✓ Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
