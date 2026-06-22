'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Pencil, Trash2, X, Check, BookOpen, HelpCircle, MessageSquare, Lock, CheckCircle2 } from 'lucide-react'

interface Step {
  id: string; title: string; description: string | null
  estimated_minutes: number | null; team: string; day_number?: number | null
  completion_criteria?: string; min_quiz_score?: number; max_attempts?: number | null
  onboarding_materials?: any[]; onboarding_faqs?: any[]; onboarding_questions?: any[]
}

interface Props {
  steps:        Step[]
  isAdmin:      boolean
  userProgress: any[]      // [{ step_id, status ('concluido'|'em_andamento'), completed_at, ... }]
  trailMode:    string     // 'livre' | 'sequencial'
  onUpdated?:   (step: Step) => void
  onDeleted?:   (id: string) => void
}

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 9,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

function SS({ value, onChange, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inp, paddingRight: 28, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
        onFocus={foc} onBlur={blr}>
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

export function StepList({ steps, isAdmin, userProgress, trailMode, onUpdated, onDeleted }: Props) {
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [ef, setEf] = useState({ title: '', desc: '', team: 'ambos', min: '', day: '' })

  // ── Helpers de progresso ──────────────────────────────────
  const completedIds = useMemo(
    () => new Set(userProgress.filter((p: any) => p.status === 'concluido' || p.completed === true).map((p: any) => p.step_id)),
    [userProgress]
  )

  // Lista plana ordenada (para calcular bloqueio sequencial)
  const orderedSteps = useMemo(() =>
    [...steps].sort((a, b) => {
      if (a.day_number == null) return 1
      if (b.day_number == null) return -1
      return (a.day_number - b.day_number)
    }), [steps]
  )

  function isCompleted(id: string) { return completedIds.has(id) }

  function isLocked(id: string): boolean {
    if (isAdmin) return false
    if (trailMode !== 'sequencial') return false
    const idx = orderedSteps.findIndex(s => s.id === id)
    if (idx <= 0) return false
    // Bloqueado se qualquer etapa anterior não foi concluída
    for (let i = 0; i < idx; i++) {
      if (!isCompleted(orderedSteps[i].id)) return true
    }
    return false
  }

  // Índice da próxima etapa a fazer (para destacar)
  const nextStepId = useMemo(() => {
    if (isAdmin) return null
    return orderedSteps.find(s => !isCompleted(s.id))?.id ?? null
  }, [orderedSteps, completedIds, isAdmin])

  // ── Edição inline ─────────────────────────────────────────
  function startEdit(s: Step) {
    setEditingId(s.id)
    setEf({ title: s.title, desc: s.description ?? '', team: s.team, min: s.estimated_minutes?.toString() ?? '', day: s.day_number?.toString() ?? '' })
  }

  async function saveEdit(s: Step) {
    setSaving(true)
    const res = await fetch('/api/onboarding/steps', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, title: ef.title, description: ef.desc || null, team: ef.team, estimated_minutes: ef.min || null, day_number: ef.day || null, completion_criteria: s.completion_criteria ?? 'visualizar', min_quiz_score: s.min_quiz_score ?? 70, max_attempts: s.max_attempts ?? null }),
    })
    const data = await res.json()
    if (res.ok) onUpdated?.({ ...s, ...data.step })
    setEditingId(null); setSaving(false)
  }

  async function confirmDelete(id: string) {
    setSaving(true)
    await fetch('/api/onboarding/steps', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    onDeleted?.(id); setDeletingId(null); setSaving(false)
  }

  // ── Agrupamento por dia ───────────────────────────────────
  const groups: { day: number | null; steps: Step[] }[] = []
  const seen = new Map<string, number>()
  steps.forEach(s => {
    const key = s.day_number != null ? `dia-${s.day_number}` : 'sem-dia'
    if (!seen.has(key)) { seen.set(key, groups.length); groups.push({ day: s.day_number ?? null, steps: [] }) }
    groups[seen.get(key)!].steps.push(s)
  })

  if (steps.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Nenhuma etapa cadastrada</p>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
        {isAdmin ? 'Clique em "Nova etapa" para começar.' : 'A trilha ainda está sendo preparada para você.'}
      </p>
    </div>
  )

  // Progresso geral (para usuário)
  const totalDone  = steps.filter(s => isCompleted(s.id)).length
  const totalSteps = steps.length
  const pct        = totalSteps > 0 ? Math.round((totalDone / totalSteps) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Barra de progresso geral (só para usuário) */}
      {!isAdmin && totalSteps > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
              Progresso da trilha
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? '#22c55e' : '#6366f1' }}>
              {totalDone}/{totalSteps} etapas {pct === 100 ? '🎉' : ''}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--secondary)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct === 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#4f46e5,#7c3aed)', transition: 'width 0.6s ease', boxShadow: `0 0 8px ${pct === 100 ? '#22c55e55' : '#6366f155'}` }} />
          </div>
          {trailMode === 'sequencial' && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              🔒 Modo sequencial — conclua cada etapa para desbloquear a próxima
            </p>
          )}
        </div>
      )}

      {groups.map(group => (
        <div key={group.day ?? 'sem-dia'}>
          {/* Cabeçalho do dia */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.3)', flexShrink: 0 }}>
                {group.day !== null ? (
                  <>
                    <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>DIA</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{group.day}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>—</span>
                )}
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
                  {group.day !== null ? `Dia ${group.day}` : 'Sem dia definido'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
                  {group.steps.length} etapa{group.steps.length !== 1 ? 's' : ''}
                  {!isAdmin && ` · ${group.steps.filter(s => isCompleted(s.id)).length} concluída${group.steps.filter(s => isCompleted(s.id)).length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border),transparent)' }} />
          </div>

          {/* Etapas do dia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16, borderLeft: '2px solid rgba(99,102,241,0.2)' }}>
            {group.steps.map((step, idx) => {
              const matCount  = (step.onboarding_materials?.[0] as any)?.count ?? step.onboarding_materials?.length ?? 0
              const faqCount  = (step.onboarding_faqs?.[0] as any)?.count ?? step.onboarding_faqs?.length ?? 0
              const qCount    = (step.onboarding_questions?.[0] as any)?.count ?? step.onboarding_questions?.length ?? 0
              const done      = isCompleted(step.id)
              const locked    = isLocked(step.id)
              const isNext    = step.id === nextStepId
              const tc = step.team === 'OAO' ? { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' }
                       : step.team === 'R1'  ? { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6' }
                       : { bg: 'rgba(34,197,94,0.10)', text: '#22c55e' }

              // Cores conforme estado
              const stateBg    = done   ? 'rgba(34,197,94,0.06)'  : locked ? 'rgba(0,0,0,0.03)'    : 'var(--card)'
              const stateBorder= done   ? 'rgba(34,197,94,0.3)'   : locked ? 'var(--border)'        : isNext ? 'rgba(99,102,241,0.35)' : 'var(--border)'
              const stateLeft  = done   ? '#22c55e'                : locked ? 'var(--border)'        : isNext ? '#6366f1'              : tc.text

              if (editingId === step.id) return (
                <div key={step.id} style={{ background: 'var(--card)', border: '1.5px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 4px 16px rgba(79,70,229,0.1)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div><label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Título</label><input value={ef.title} onChange={e => setEf(p => ({ ...p, title: e.target.value }))} style={inp} onFocus={foc} onBlur={blr} autoFocus /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</label><textarea value={ef.desc} onChange={e => setEf(p => ({ ...p, desc: e.target.value }))} rows={2} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical', lineHeight: 1.5 }} onFocus={foc} onBlur={blr} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      <div><label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dia</label><SS value={ef.day} onChange={(v: string) => setEf(p => ({ ...p, day: v }))}><option value="">Sem dia</option>{Array.from({ length: 15 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}</SS></div>
                      <div><label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tempo (min)</label><input type="number" value={ef.min} onChange={e => setEf(p => ({ ...p, min: e.target.value }))} placeholder="30" style={inp} onFocus={foc} onBlur={blr} /></div>
                      <div><label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</label><SS value={ef.team} onChange={(v: string) => setEf(p => ({ ...p, team: v }))}><option value="ambos">Ambos</option><option value="OAO">OAO</option><option value="R1">R1</option></SS></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><X size={13} /> Cancelar</button>
                      <button onClick={() => saveEdit(step)} disabled={saving || !ef.title.trim()} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}><Check size={13} /> {saving ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                  </div>
                </div>
              )

              if (deletingId === step.id) return (
                <div key={step.id} style={{ background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', flex: 1, margin: 0 }}>Excluir <strong>"{step.title}"</strong>?</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setDeletingId(null)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    <button onClick={() => confirmDelete(step.id)} disabled={saving} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? '...' : 'Excluir'}</button>
                  </div>
                </div>
              )

              // ── Card da etapa ─────────────────────────────
              const CardContent = (
                <div style={{ background: stateBg, border: `1px solid ${stateBorder}`, borderRadius: 14, overflow: 'hidden', transition: 'all 0.15s', opacity: locked ? 0.6 : 1, position: 'relative' }}>
                  {/* Barra superior */}
                  <div style={{ height: 3, background: done ? '#22c55e' : locked ? 'var(--border)' : `linear-gradient(90deg,${stateLeft},${stateLeft}66)` }} />

                  {/* Overlay sutil para concluído */}
                  {done && !isAdmin && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.03)', pointerEvents: 'none', zIndex: 0 }} />
                  )}

                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
                    {/* Badge de status (número ou ícone) */}
                    <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done ? 'rgba(34,197,94,0.15)' : locked ? 'rgba(0,0,0,0.06)' : tc.bg, border: `1.5px solid ${done ? 'rgba(34,197,94,0.4)' : locked ? 'rgba(0,0,0,0.1)' : tc.text + '30'}` }}>
                      {done
                        ? <CheckCircle2 size={17} style={{ color: '#22c55e' }} />
                        : locked
                          ? <Lock size={14} style={{ color: 'var(--muted-foreground)' }} />
                          : <span style={{ fontSize: 13, fontWeight: 800, color: tc.text }}>{idx + 1}</span>
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: done ? 'var(--muted-foreground)' : 'var(--foreground)', textDecoration: done ? 'line-through' : 'none', textDecorationColor: 'rgba(0,0,0,0.25)' }}>
                          {step.title}
                        </span>

                        {/* Badges de estado */}
                        {done && !isAdmin && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <Check size={9} /> Concluído
                          </span>
                        )}
                        {locked && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(0,0,0,0.06)', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                            🔒 Bloqueado
                          </span>
                        )}
                        {isNext && !done && !locked && !isAdmin && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', flexShrink: 0 }}>
                            ▶ Próxima
                          </span>
                        )}
                        {/* Time badge */}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: tc.bg, color: tc.text, flexShrink: 0 }}>
                          {step.team === 'ambos' ? 'Ambos' : step.team}
                        </span>
                      </div>

                      {step.description && (
                        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 8px', lineHeight: 1.5, opacity: done ? 0.7 : 1 }}>{step.description}</p>
                      )}

                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {step.estimated_minutes && (
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={11} /> {step.estimated_minutes} min
                          </span>
                        )}
                        {matCount > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <BookOpen size={11} /> {matCount} {matCount === 1 ? 'material' : 'materiais'}
                          </span>
                        )}
                        {faqCount > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <HelpCircle size={11} /> {faqCount} FAQs
                          </span>
                        )}
                        {qCount > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MessageSquare size={11} /> {qCount} questões
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {isAdmin && (
                        <>
                          <button onClick={() => startEdit(step)} title="Editar"
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeletingId(step.id)} title="Excluir"
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                      {!locked && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, color: done ? '#22c55e' : 'var(--muted-foreground)' }}>
                          <ChevronRight size={15} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )

              return (
                <div key={step.id} style={{ position: 'relative' }}>
                  {/* Bolinha da timeline */}
                  <div style={{ position: 'absolute', left: -22, top: 18, width: 10, height: 10, borderRadius: '50%', background: done ? '#22c55e' : locked ? 'var(--border)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: '2px solid var(--card)', zIndex: 1 }} />

                  {/* Etapa bloqueada = div, livre/concluída = Link */}
                  {locked
                    ? <div title="Complete as etapas anteriores para desbloquear">{CardContent}</div>
                    : <Link href={`/onboarding/trilha/${step.id}`} style={{ textDecoration: 'none', display: 'block' }}
                        onMouseEnter={e => { const el = (e.currentTarget as HTMLElement).querySelector('div[style]') as HTMLElement; if(el&&!done&&!locked){el.style.borderColor=done?'rgba(34,197,94,0.45)':'rgba(99,102,241,0.3)';el.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'} }}
                        onMouseLeave={e => { const el = (e.currentTarget as HTMLElement).querySelector('div[style]') as HTMLElement; if(el){el.style.borderColor=stateBorder;el.style.boxShadow='none'} }}>
                        {CardContent}
                      </Link>
                  }
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
