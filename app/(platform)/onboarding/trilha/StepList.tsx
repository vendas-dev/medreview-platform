'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Pencil, Trash2, X, Check, BookOpen, HelpCircle, PenSquare } from 'lucide-react'
import { deleteStep, updateStep } from '../actions'

interface Step {
  id: string; title: string; description: string | null
  estimated_minutes: number | null; team: string; day_number?: number | null
  onboarding_materials?: any[]; onboarding_faqs?: any[]; onboarding_questions?: any[]
}

// Select estilizado reutilizável
function StyledSelect({ name, value, onChange, children }: {
  name?: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select name={name} value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', height: 40, padding: '0 36px 0 14px', borderRadius: 10,
          border: '1.5px solid var(--border)', background: 'var(--background)',
          color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          appearance: 'none', cursor: 'pointer', transition: 'border-color 0.15s',
          WebkitAppearance: 'none',
        }}
        onFocus={e => e.target.style.borderColor = '#6366f1'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}>
        {children}
      </select>
      <svg style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--muted-foreground)' }}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  )
}

const inp: React.CSSProperties = {
  width:'100%', height:40, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:13, fontFamily:'inherit', outline:'none',
  transition: 'border-color 0.15s',
}

const teamMeta: Record<string, { bg: string; text: string; grad: string; dot: string }> = {
  OAO:   { bg:'rgba(59,130,246,0.1)',  text:'#3b82f6', grad:'linear-gradient(135deg,#3b82f6,#4f46e5)', dot:'#3b82f6' },
  R1:    { bg:'rgba(139,92,246,0.1)',  text:'#8b5cf6', grad:'linear-gradient(135deg,#8b5cf6,#a855f7)', dot:'#8b5cf6' },
  ambos: { bg:'rgba(34,197,94,0.1)',   text:'#22c55e', grad:'linear-gradient(135deg,#22c55e,#16a34a)', dot:'#22c55e' },
}

export function StepList({ steps: init, isAdmin }: { steps: Step[]; isAdmin: boolean }) {
  const [steps, setSteps] = useState(init)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ef, setEf] = useState({ title:'', desc:'', team:'ambos', min:'', day:'' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEdit(s: Step) {
    setEditingId(s.id)
    setEf({ title:s.title, desc:s.description??'', team:s.team, min:s.estimated_minutes?.toString()??'', day:s.day_number?.toString()??'' })
  }

  async function saveEdit(s: Step) {
    setSaving(true)
    const fd = new FormData()
    fd.append('id', s.id); fd.append('title', ef.title); fd.append('description', ef.desc)
    fd.append('team', ef.team); fd.append('estimated_minutes', ef.min); fd.append('day_number', ef.day)
    fd.append('completion_criteria', (s as any).completion_criteria ?? 'visualizar')
    fd.append('min_quiz_score', (s as any).min_quiz_score?.toString() ?? '70')
    await updateStep(fd)
    setSteps(prev => prev.map(x => x.id === s.id
      ? { ...x, title:ef.title, description:ef.desc||null, team:ef.team, estimated_minutes:ef.min?Number(ef.min):null, day_number:ef.day?Number(ef.day):null }
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
    <div style={{ textAlign:'center', padding:'56px 24px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(79,70,229,0.3)' }}>
        <BookOpen size={28} style={{ color:'#fff' }} />
      </div>
      <p style={{ fontSize:15, fontWeight:700, color:'var(--foreground)', marginBottom:6 }}>Nenhuma etapa cadastrada</p>
      <p style={{ fontSize:13, color:'var(--muted-foreground)' }}>{isAdmin ? 'Clique em "Nova etapa" para começar.' : 'A trilha ainda não foi configurada.'}</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {steps.map((step, idx) => {
        const tm = teamMeta[step.team] ?? teamMeta.ambos
        const matCount = (step.onboarding_materials?.[0] as any)?.count ?? 0
        const faqCount = (step.onboarding_faqs?.[0] as any)?.count ?? 0
        const quizCount = (step.onboarding_questions?.[0] as any)?.count ?? 0
        const isEditing = editingId === step.id
        const isDeleting = deletingId === step.id

        return (
          <div key={step.id} style={{ display:'flex', gap:0 }}>
            {/* Timeline */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:52, flexShrink:0 }}>
              <div style={{
                width:38, height:38, borderRadius:'50%', marginTop:14, zIndex:1, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:800,
                background: step.day_number ? tm.grad : 'var(--card)',
                border: step.day_number ? 'none' : '2px solid var(--border)',
                color: step.day_number ? '#fff' : 'var(--muted-foreground)',
                boxShadow: step.day_number ? `0 4px 14px ${tm.dot}40` : '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                {step.day_number ? `D${step.day_number}` : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div style={{ width:2, flex:1, minHeight:12, background:'linear-gradient(180deg, var(--border), transparent)', margin:'2px 0' }} />
              )}
            </div>

            {/* Card */}
            <div style={{ flex:1, paddingTop:10, paddingLeft:8, paddingBottom:4 }}>
              {isEditing ? (
                /* Edição inline */
                <div style={{ background:'var(--card)', border:'1.5px solid rgba(99,102,241,0.35)', borderRadius:16, padding:'18px 20px', marginBottom:8, boxShadow:'0 8px 24px rgba(79,70,229,0.1)' }}>
                  <p style={{ fontSize:11, fontWeight:800, color:'#6366f1', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.07em' }}>✏️ Editando etapa</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div>
                      <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Título</label>
                      <input value={ef.title} onChange={e => setEf(f=>({...f,title:e.target.value}))} style={inp} autoFocus
                        onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                    </div>
                    <div>
                      <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Descrição</label>
                      <textarea value={ef.desc} onChange={e => setEf(f=>({...f,desc:e.target.value}))} rows={2}
                        style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }}
                        onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                      <div>
                        <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Dia</label>
                        <StyledSelect value={ef.day} onChange={v => setEf(f=>({...f,day:v}))}>
                          <option value="">Sem dia</option>
                          {Array.from({length:15},(_,i)=>i+1).map(d=><option key={d} value={d}>Dia {d}</option>)}
                        </StyledSelect>
                      </div>
                      <div>
                        <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Time</label>
                        <StyledSelect value={ef.team} onChange={v => setEf(f=>({...f,team:v}))}>
                          <option value="ambos">Ambos</option>
                          <option value="OAO">OAO</option>
                          <option value="R1">R1</option>
                        </StyledSelect>
                      </div>
                      <div>
                        <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tempo (min)</label>
                        <input type="number" value={ef.min} onChange={e => setEf(f=>({...f,min:e.target.value}))} placeholder="30" style={inp}
                          onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:4 }}>
                      <button onClick={() => setEditingId(null)} style={{ display:'flex', alignItems:'center', gap:5, height:36, padding:'0 14px', borderRadius:9, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--secondary)'; e.currentTarget.style.color='var(--foreground)' }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted-foreground)' }}>
                        <X size={12} /> Cancelar
                      </button>
                      <button onClick={() => saveEdit(step)} disabled={saving || !ef.title.trim()}
                        style={{ display:'flex', alignItems:'center', gap:5, height:36, padding:'0 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:saving?0.6:1, boxShadow:'0 4px 12px rgba(79,70,229,0.3)' }}>
                        <Check size={12} /> {saving ? 'Salvando...' : 'Salvar alterações'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : isDeleting ? (
                <div style={{ background:'rgba(239,68,68,0.06)', border:'1.5px solid rgba(239,68,68,0.25)', borderRadius:14, padding:'14px 18px', marginBottom:8, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <p style={{ flex:1, fontSize:13, color:'var(--foreground)', margin:0 }}>Excluir <strong>"{step.title}"</strong>? Não pode ser desfeito.</p>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setDeletingId(null)} style={{ height:32, padding:'0 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                    <button onClick={() => confirmDelete(step.id)} disabled={saving} style={{ height:32, padding:'0 14px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:saving?0.6:1 }}>{saving?'...':'Excluir'}</button>
                  </div>
                </div>
              ) : (
                /* Card normal */
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:15, marginBottom:8, overflow:'hidden', transition:'all 0.18s', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor=tm.dot+'50'; el.style.boxShadow=`0 6px 20px ${tm.dot}12`; el.style.transform='translateX(2px)' }}
                  onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor='var(--border)'; el.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; el.style.transform='none' }}>

                  {/* Borda esquerda colorida */}
                  <div style={{ display:'flex' }}>
                    <div style={{ width:4, background:tm.grad, flexShrink:0 }} />
                    <div style={{ flex:1, padding:'14px 16px 13px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                        <Link href={`/onboarding/trilha/${step.id}`} style={{ textDecoration:'none', flex:1, minWidth:0 }}>
                          {/* Título e badges */}
                          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:4 }}>
                            <span style={{ fontSize:14, fontWeight:700, color:'var(--foreground)' }}>{step.title}</span>
                            <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:999, background:tm.bg, color:tm.text, border:`1px solid ${tm.dot}25` }}>{step.team}</span>
                            {step.day_number && (
                              <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:999, background:tm.grad, color:'#fff', letterSpacing:'0.02em' }}>📅 Dia {step.day_number}</span>
                            )}
                          </div>
                          {step.description && (
                            <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:'0 0 8px', lineHeight:1.5 }}>{step.description}</p>
                          )}
                          {/* Meta info */}
                          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                            {step.estimated_minutes && (
                              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:6 }}>
                                <Clock size={10}/> {step.estimated_minutes} min
                              </span>
                            )}
                            {matCount > 0 && (
                              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:6 }}>
                                <BookOpen size={10}/> {matCount} {matCount===1?'material':'materiais'}
                              </span>
                            )}
                            {faqCount > 0 && (
                              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:6 }}>
                                <HelpCircle size={10}/> {faqCount} FAQ{faqCount>1?'s':''}
                              </span>
                            )}
                            {quizCount > 0 && (
                              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--muted-foreground)', background:'var(--secondary)', padding:'2px 8px', borderRadius:6 }}>
                                <PenSquare size={10}/> {quizCount} {quizCount===1?'questão':'questões'}
                              </span>
                            )}
                          </div>
                        </Link>

                        {/* Ações */}
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                          {isAdmin && (
                            <>
                              <button onClick={() => startEdit(step)} title="Editar"
                                style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)', transition:'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.1)'; e.currentTarget.style.color='#6366f1'; e.currentTarget.style.borderColor='rgba(99,102,241,0.3)' }}
                                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted-foreground)'; e.currentTarget.style.borderColor='var(--border)' }}>
                                <Pencil size={12}/>
                              </button>
                              <button onClick={() => setDeletingId(step.id)} title="Excluir"
                                style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)', transition:'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='rgba(239,68,68,0.3)' }}
                                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted-foreground)'; e.currentTarget.style.borderColor='var(--border)' }}>
                                <Trash2 size={12}/>
                              </button>
                            </>
                          )}
                          <Link href={`/onboarding/trilha/${step.id}`} style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)', textDecoration:'none', borderRadius:8, transition:'all 0.12s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='var(--secondary)'; (e.currentTarget as HTMLElement).style.color='var(--foreground)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
                            <ChevronRight size={14}/>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
