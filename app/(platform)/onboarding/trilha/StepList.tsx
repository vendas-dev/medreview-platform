'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown, Clock, Lock, CheckCircle2, Circle, BookOpen, HelpCircle, PenSquare, Pencil, Trash2, X, Check } from 'lucide-react'
import { deleteStep, updateStep } from '../actions'

interface Step {
  id: string; title: string; description: string | null
  estimated_minutes: number | null; team: string; day_number?: number | null
  onboarding_materials?: any[]; onboarding_faqs?: any[]; onboarding_questions?: any[]
  completion_criteria?: string; min_quiz_score?: number
}
interface Progress { step_id: string; status: string; quiz_score?: number }

const teamMeta: Record<string, { bg: string; text: string; grad: string; dot: string }> = {
  OAO:   { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6', grad: 'linear-gradient(135deg,#3b82f6,#4f46e5)', dot: '#3b82f6' },
  R1:    { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6', grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)', dot: '#8b5cf6' },
  ambos: { bg: 'rgba(99,102,241,0.1)',  text: '#6366f1', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', dot: '#6366f1' },
}

const inp: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}

function StyledSelect({ value, onChange, children, name }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <select name={name} value={value} onChange={e => onChange?.(e.target.value)}
        style={{ ...inp, paddingRight: 32, appearance: 'none', cursor: 'pointer', WebkitAppearance: 'none' }}
        onFocus={e => e.target.style.borderColor = '#6366f1'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}>
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

export function StepList({ steps: init, isAdmin, userProgress = [], trailMode = 'livre' }: {
  steps: Step[]; isAdmin: boolean; userProgress?: Progress[]; trailMode?: string
}) {
  const [steps, setSteps] = useState(init)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ef, setEf] = useState({ title: '', desc: '', team: 'ambos', min: '', day: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(['none', '1']))

  // Agrupa por dia
  const byDay: Record<string, Step[]> = {}
  steps.forEach(s => {
    const key = s.day_number ? String(s.day_number) : 'none'
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(s)
  })

  const dayKeys = Object.keys(byDay).sort((a, b) => {
    if (a === 'none') return 1
    if (b === 'none') return -1
    return Number(a) - Number(b)
  })

  const progressMap = new Map(userProgress.map(p => [p.step_id, p]))
  const isSequential = trailMode === 'sequencial'

  // Para modo sequencial: determina quais etapas estão desbloqueadas
  function isStepUnlocked(stepId: string, dayKey: string): boolean {
    if (!isSequential || isAdmin) return true
    const orderedSteps = dayKeys.flatMap(dk => byDay[dk])
    const idx = orderedSteps.findIndex(s => s.id === stepId)
    if (idx === 0) return true
    const prev = orderedSteps[idx - 1]
    const prevProg = progressMap.get(prev.id)
    return prevProg?.status === 'concluido'
  }

  function isDayUnlocked(dayKey: string): boolean {
    if (!isSequential || isAdmin) return true
    const dayIdx = dayKeys.indexOf(dayKey)
    if (dayIdx === 0) return true
    const prevDay = dayKeys[dayIdx - 1]
    return byDay[prevDay].every(s => progressMap.get(s.id)?.status === 'concluido')
  }

  function getDayProgress(dayKey: string): { done: number; total: number } {
    const daySteps = byDay[dayKey]
    const done = daySteps.filter(s => progressMap.get(s.id)?.status === 'concluido').length
    return { done, total: daySteps.length }
  }

  function toggleDay(key: string) {
    setExpandedDays(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  function startEdit(s: Step) {
    setEditingId(s.id)
    setEf({ title: s.title, desc: s.description ?? '', team: s.team, min: s.estimated_minutes?.toString() ?? '', day: s.day_number?.toString() ?? '' })
  }

  async function saveEdit(s: Step) {
    setSaving(true)
    const fd = new FormData()
    fd.append('id', s.id); fd.append('title', ef.title); fd.append('description', ef.desc)
    fd.append('team', ef.team); fd.append('estimated_minutes', ef.min); fd.append('day_number', ef.day)
    fd.append('completion_criteria', s.completion_criteria ?? 'visualizar')
    fd.append('min_quiz_score', s.min_quiz_score?.toString() ?? '70')
    await updateStep(fd)
    setSteps(prev => prev.map(x => x.id === s.id
      ? { ...x, title: ef.title, description: ef.desc || null, team: ef.team, estimated_minutes: ef.min ? Number(ef.min) : null, day_number: ef.day ? Number(ef.day) : null }
      : x))
    setEditingId(null); setSaving(false)
  }

  async function confirmDelete(id: string) {
    setSaving(true)
    await deleteStep(id)
    setSteps(prev => prev.filter(x => x.id !== id))
    setDeletingId(null); setSaving(false)
  }

  if (steps.length === 0) return (
    <div style={{ textAlign: 'center', padding: '56px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}>
        <BookOpen size={28} style={{ color: '#fff' }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
        {isAdmin ? 'Nenhuma etapa cadastrada ainda' : 'Sua trilha está sendo preparada'}
      </p>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
        {isAdmin ? 'Clique em "Nova etapa" para começar a montar a trilha.' : 'Em breve você terá acesso ao conteúdo completo!'}
      </p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dayKeys.map(dayKey => {
        const daySteps = byDay[dayKey]
        const expanded = expandedDays.has(dayKey)
        const { done, total } = getDayProgress(dayKey)
        const dayPct = total > 0 ? Math.round((done / total) * 100) : 0
        const dayDone = done === total && total > 0
        const dayLocked = !isDayUnlocked(dayKey)

        return (
          <div key={dayKey}>
            {/* Cabeçalho do dia */}
            <button onClick={() => !dayLocked && toggleDay(dayKey)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${dayDone ? 'rgba(34,197,94,0.3)' : dayLocked ? 'var(--border)' : 'rgba(99,102,241,0.2)'}`, background: dayDone ? 'rgba(34,197,94,0.05)' : dayLocked ? 'color-mix(in srgb,var(--secondary) 50%,transparent)' : 'var(--card)', cursor: dayLocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textAlign: 'left', opacity: dayLocked ? 0.6 : 1 }}
              onMouseEnter={e => { if (!dayLocked) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(79,70,229,0.1)' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'}>

              {/* Ícone de dia */}
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, background: dayDone ? 'linear-gradient(135deg,#22c55e,#16a34a)' : dayLocked ? 'var(--border)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', boxShadow: dayDone ? '0 4px 12px rgba(34,197,94,0.3)' : dayLocked ? 'none' : '0 4px 12px rgba(79,70,229,0.3)' }}>
                {dayLocked ? <Lock size={16} /> : dayDone ? <CheckCircle2 size={18} /> : dayKey === 'none' ? '∞' : dayKey}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                    {dayKey === 'none' ? 'Sem dia definido' : `Dia ${dayKey}`}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{total} {total === 1 ? 'etapa' : 'etapas'}</span>
                  {dayDone && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>✓ Concluído</span>}
                  {dayLocked && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.08)', color: 'var(--muted-foreground)' }}>🔒 Bloqueado</span>}
                </div>
                {!isAdmin && !dayLocked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: dayDone ? '#22c55e' : 'linear-gradient(90deg,#4f46e5,#7c3aed)', width: `${dayPct}%`, transition: 'width 0.6s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{done}/{total}</span>
                  </div>
                )}
              </div>

              <div style={{ flexShrink: 0, color: 'var(--muted-foreground)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
                <ChevronDown size={16} />
              </div>
            </button>

            {/* Etapas do dia */}
            {expanded && !dayLocked && (
              <div style={{ paddingLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '2px solid var(--border)', marginLeft: 20 }}>
                {daySteps.map((step, sidx) => {
                  const prog = progressMap.get(step.id)
                  const status = prog?.status ?? 'nao_iniciado'
                  const unlocked = isStepUnlocked(step.id, dayKey)
                  const tm = teamMeta[step.team] ?? teamMeta.ambos
                  const matCount = (step.onboarding_materials?.[0] as any)?.count ?? 0
                  const faqCount = (step.onboarding_faqs?.[0] as any)?.count ?? 0
                  const quizCount = (step.onboarding_questions?.[0] as any)?.count ?? 0
                  const isEditing = editingId === step.id
                  const isDeleting = deletingId === step.id

                  return (
                    <div key={step.id} style={{ paddingLeft: 16 }}>
                      {isEditing ? (
                        <div style={{ background: 'var(--card)', border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 4px 16px rgba(79,70,229,0.08)' }}>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>✏️ Editando</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Título</label>
                              <input value={ef.title} onChange={e => setEf(f => ({ ...f, title: e.target.value }))} style={inp} autoFocus onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                            </div>
                            <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</label>
                              <textarea value={ef.desc} onChange={e => setEf(f => ({ ...f, desc: e.target.value }))} rows={2} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical', lineHeight: 1.5 }} onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dia</label>
                                <StyledSelect value={ef.day} onChange={(v: string) => setEf(f => ({ ...f, day: v }))}>
                                  <option value="">Sem dia</option>
                                  {Array.from({ length: 15 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}
                                </StyledSelect>
                              </div>
                              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</label>
                                <StyledSelect value={ef.team} onChange={(v: string) => setEf(f => ({ ...f, team: v }))}>
                                  <option value="ambos">Ambos</option><option value="OAO">OAO</option><option value="R1">R1</option>
                                </StyledSelect>
                              </div>
                              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Min</label>
                                <input type="number" value={ef.min} onChange={e => setEf(f => ({ ...f, min: e.target.value }))} placeholder="30" style={inp} onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => setEditingId(null)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><X size={11} /> Cancelar</button>
                              <button onClick={() => saveEdit(step)} disabled={saving || !ef.title.trim()} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1, boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}><Check size={11} /> {saving ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                          </div>
                        </div>
                      ) : isDeleting ? (
                        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{step.title}"</strong>?</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setDeletingId(null)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={() => confirmDelete(step.id)} disabled={saving} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '...' : 'Excluir'}</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'var(--card)', border: `1px solid ${status === 'concluido' ? 'rgba(34,197,94,0.25)' : unlocked ? 'var(--border)' : 'var(--border)'}`, borderRadius: 13, overflow: 'hidden', transition: 'all 0.15s', opacity: !unlocked && !isAdmin ? 0.55 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
                          onMouseEnter={e => { if (unlocked || isAdmin) { const el = e.currentTarget as HTMLElement; el.style.borderColor = tm.dot + '40'; el.style.boxShadow = `0 4px 16px ${tm.dot}10` } }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = status === 'concluido' ? 'rgba(34,197,94,0.25)' : 'var(--border)'; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.03)' }}>
                          <div style={{ display: 'flex' }}>
                            <div style={{ width: 3, background: status === 'concluido' ? '#22c55e' : !unlocked ? 'var(--border)' : tm.grad, flexShrink: 0 }} />
                            <div style={{ flex: 1, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
                              {/* Status icon */}
                              <div style={{ flexShrink: 0 }}>
                                {status === 'concluido'
                                  ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                                  : !unlocked ? <Lock size={15} style={{ color: 'var(--muted-foreground)' }} />
                                  : <Circle size={18} style={{ color: 'var(--border)' }} />}
                              </div>

                              {/* Conteúdo clicável */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {(unlocked || isAdmin) ? (
                                  <Link href={`/onboarding/trilha/${step.id}`} style={{ textDecoration: 'none' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: status === 'concluido' ? '#22c55e' : 'var(--foreground)' }}>{step.title}</span>
                                        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: tm.bg, color: tm.text }}>{step.team}</span>
                                        {prog?.quiz_score && <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>Quiz: {prog.quiz_score}%</span>}
                                      </div>
                                      {step.description && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 6px', lineHeight: 1.4 }}>{step.description}</p>}
                                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {step.estimated_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--secondary)', padding: '1px 7px', borderRadius: 5 }}><Clock size={9} /> {step.estimated_minutes} min</span>}
                                        {matCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--secondary)', padding: '1px 7px', borderRadius: 5 }}><BookOpen size={9} /> {matCount}</span>}
                                        {faqCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--secondary)', padding: '1px 7px', borderRadius: 5 }}><HelpCircle size={9} /> {faqCount}</span>}
                                        {quizCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--secondary)', padding: '1px 7px', borderRadius: 5 }}><PenSquare size={9} /> {quizCount}</span>}
                                      </div>
                                    </div>
                                  </Link>
                                ) : (
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)' }}>{step.title}</span>
                                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>🔒 Conclua a etapa anterior para desbloquear</p>
                                  </div>
                                )}
                              </div>

                              {/* Ações */}
                              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                {isAdmin && (
                                  <>
                                    <button onClick={() => startEdit(step)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={() => setDeletingId(step.id)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                                {(unlocked || isAdmin) && (
                                  <Link href={`/onboarding/trilha/${step.id}`} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', textDecoration: 'none', borderRadius: 7, transition: 'all 0.12s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary)' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                    <ChevronRight size={13} />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
