'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createStep, updateStep } from '../actions'

interface Props { mode: 'create' | 'edit'; step?: any }

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
}

export function StepManager({ mode, step }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    if (mode === 'create') await createStep(formData)
    else await updateStep(formData)
    setLoading(false)
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-brand"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        {mode === 'create' ? <><Plus size={14} /> Nova etapa</> : 'Editar'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                {mode === 'create' ? 'Nova etapa' : 'Editar etapa'}
              </h2>
              <button onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mode === 'edit' && <input type="hidden" name="id" value={step?.id} />}

              <div>
                <label style={labelStyle}>Título *</label>
                <input name="title" required defaultValue={step?.title} placeholder="Ex: Conhecer a empresa" style={inputStyle} autoFocus />
              </div>

              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea name="description" defaultValue={step?.description ?? ''} rows={3}
                  placeholder="Descreva o conteúdo desta etapa..."
                  style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Dia</label>
                  <select name="day_number" defaultValue={step?.day_number ?? ''} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Sem dia</option>
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tempo (min)</label>
                  <input name="estimated_minutes" type="number" defaultValue={step?.estimated_minutes ?? ''} placeholder="30" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  <select name="team" defaultValue={step?.team ?? 'ambos'} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    <option value="ambos">Ambos</option>
                    <option value="OAO">OAO</option>
                    <option value="R1">R1</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Critério de conclusão</label>
                <select name="completion_criteria" defaultValue={step?.completion_criteria ?? 'visualizar'} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                  <option value="visualizar">Apenas visualizar etapa</option>
                  <option value="materiais">Assistir materiais</option>
                  <option value="quiz">Concluir quiz</option>
                  <option value="materiais_e_quiz">Materiais + Quiz</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nota mínima quiz (%)</label>
                  <input name="min_quiz_score" type="number" min={0} max={100} defaultValue={step?.min_quiz_score ?? 70} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tentativas</label>
                  <input name="max_attempts" type="number" defaultValue={step?.max_attempts ?? ''} placeholder="Ilimitadas" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn-brand"
                  style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Salvando...' : mode === 'create' ? 'Criar etapa' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
