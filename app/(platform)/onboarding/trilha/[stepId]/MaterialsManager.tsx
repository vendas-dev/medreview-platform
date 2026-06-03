'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createMaterial, createFaq, createQuestion } from '../../actions'

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6,
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)' }}>
      <Plus size={13} /> {label}
    </button>
  )
}

// ── Materials Manager ────────────────────────────────────────
export function MaterialsManager({ stepId, mode }: { stepId: string; mode: 'create' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    formData.append('step_id', stepId)
    await createMaterial(formData)
    setLoading(false)
    setOpen(false)
  }

  return (
    <>
      <AddBtn label="Adicionar material" onClick={() => setOpen(true)} />
      {open && (
        <Modal title="Adicionar material" onClose={() => setOpen(false)}>
          <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={labelStyle}>Título *</label><input className="input" name="title" required placeholder="Nome do material" style={inputStyle} /></div>
            <div><label style={labelStyle}>Descrição</label><textarea name="description" rows={2} placeholder="Opcional..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>URL *</label><input name="url" required type="url" placeholder="https://..." style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select name="type" style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                <option value="video">Vídeo</option>
                <option value="documento">Documento</option>
                <option value="pdf">PDF</option>
                <option value="site">Site</option>
                <option value="apresentacao">Apresentação</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 1, height: 42, borderRadius: 10, background: 'var(--foreground)', color: 'var(--card)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

// ── FAQ Manager ──────────────────────────────────────────────
export function FaqManager({ stepId, mode }: { stepId: string; mode: 'create' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    formData.append('step_id', stepId)
    await createFaq(formData)
    setLoading(false)
    setOpen(false)
  }

  return (
    <>
      <AddBtn label="Adicionar FAQ" onClick={() => setOpen(true)} />
      {open && (
        <Modal title="Adicionar FAQ" onClose={() => setOpen(false)}>
          <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={labelStyle}>Pergunta *</label><input name="question" required placeholder="Ex: O que é a MedReview?" style={inputStyle} /></div>
            <div><label style={labelStyle}>Resposta *</label><textarea name="answer" required rows={5} placeholder="Resposta completa..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.6 }} /></div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 1, height: 42, borderRadius: 10, background: 'var(--foreground)', color: 'var(--card)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

// ── Quiz Manager ─────────────────────────────────────────────
export function QuizManager({ stepId, mode }: { stepId: string; mode: 'create' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState([
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    form.append('step_id', stepId)
    form.append('answers', JSON.stringify(answers))
    await createQuestion(form)
    setLoading(false)
    setOpen(false)
  }

  return (
    <>
      <AddBtn label="Adicionar questão" onClick={() => setOpen(true)} />
      {open && (
        <Modal title="Adicionar questão" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={labelStyle}>Pergunta *</label><textarea name="question" required rows={3} placeholder="Digite a pergunta..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }} /></div>

            <div>
              <label style={labelStyle}>Alternativas *</label>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10 }}>Marque a alternativa correta clicando no círculo.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" onClick={() => setAnswers(answers.map((ans, idx) => ({ ...ans, is_correct: idx === i })))}
                      style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${a.is_correct ? '#10b981' : 'var(--border)'}`, background: a.is_correct ? '#10b981' : 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }} />
                    <input value={a.text} onChange={e => setAnswers(answers.map((ans, idx) => idx === i ? { ...ans, text: e.target.value } : ans))}
                      placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                      style={{ ...inputStyle, flex: 1 }} />
                  </div>
                ))}
              </div>
            </div>

            <div><label style={labelStyle}>Explicação (exibida após responder)</label><textarea name="explanation" rows={3} placeholder="Explique o motivo da resposta correta..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }} /></div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 1, height: 42, borderRadius: 10, background: 'var(--foreground)', color: 'var(--card)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
