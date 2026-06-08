'use client'
import { useState } from 'react'
import { FileText, HelpCircle, CheckSquare, ChevronDown, ChevronUp, Tag } from 'lucide-react'
import { MaterialCard } from '@/components/ui/MaterialCard'
import { MaterialsManager, FaqManager, QuizManager } from './MaterialsManager'
import { submitQuiz, startStep } from '../../actions'

export function StepDetail({ step, materials, faqs, questions, isAdmin, stepId, userProgress }: any) {
  const s = step
  const [activeTab, setActiveTab] = useState<'materiais'|'faqs'|'quiz'>('materiais')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const [quizStarted, setQuizStarted] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string,string>>({})
  const [quizFinished, setQuizFinished] = useState(false)
  const [quizScore, setQuizScore] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set())

  const teamColor = s.team === 'OAO' ? '#3b82f6' : s.team === 'R1' ? '#8b5cf6' : '#22c55e'
  const teamGrad  = s.team === 'OAO' ? 'linear-gradient(135deg,#3b82f6,#4f46e5)' : s.team === 'R1' ? 'linear-gradient(135deg,#8b5cf6,#a855f7)' : 'linear-gradient(135deg,#22c55e,#16a34a)'

  async function handleCheck(materialId: string, checked: boolean) {
    setCheckedMaterials(prev => { const s = new Set(prev); checked ? s.add(materialId) : s.delete(materialId); return s })
    await fetch('/api/onboarding/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'material', id: materialId, completed: checked }),
    })
  }

  function selectAnswer(qId: string, aId: string) {
    setSelectedAnswers(prev => ({ ...prev, [qId]: aId }))
    setShowExplanation(true)
  }

  function nextQuestion() {
    setShowExplanation(false)
    if (currentQ < questions.length - 1) setCurrentQ(q => q + 1)
    else finishQuiz()
  }

  async function finishQuiz() {
    setSubmitting(true)
    const correct = questions.filter((q: any) => {
      const sel = selectedAnswers[q.id]
      return q.onboarding_answers?.find((a: any) => a.id === sel)?.is_correct
    }).length
    const score = Math.round((correct / questions.length) * 100)
    const passed = score >= s.min_quiz_score
    setQuizScore(score); setQuizFinished(true)
    await submitQuiz(stepId, selectedAnswers, score, passed)
    setSubmitting(false)
  }

  const currentQuestion = questions[currentQ]
  const selectedAnswer = currentQuestion ? selectedAnswers[currentQuestion.id] : null
  const isCorrect = selectedAnswer && currentQuestion?.onboarding_answers?.find((a: any) => a.id === selectedAnswer)?.is_correct

  const tabs = [
    { id: 'materiais', label: 'Materiais', icon: FileText, count: materials.length },
    { id: 'faqs',      label: 'FAQs',      icon: HelpCircle, count: faqs.length },
    { id: 'quiz',      label: 'Quiz',      icon: CheckSquare, count: questions.length },
  ]

  return (
    <div>
      {/* Header da etapa */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 24px', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: teamGrad }} />
        <div style={{ paddingTop: 8, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>{s.title}</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${teamColor}15`, color: teamColor, border: `1px solid ${teamColor}30` }}>{s.team}</span>
              {s.day_number && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: teamGrad, color: '#fff' }}>Dia {s.day_number}</span>}
            </div>
            {s.description && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 10px' }}>{s.description}</p>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {s.estimated_minutes && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>⏱ {s.estimated_minutes} min</span>}
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>🎯 Nota mínima: {s.min_quiz_score}%</span>
            </div>
          </div>
          {isAdmin && <MaterialsManager stepId={stepId} mode="create" />}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: 4 }}>
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: 10, border: 'none', background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent', color: active ? '#fff' : 'var(--muted-foreground)', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: active ? '0 4px 12px rgba(79,70,229,0.3)' : 'none' }}>
              <Icon size={13} />
              {tab.label}
              {tab.count > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: active ? 'rgba(255,255,255,0.25)' : 'var(--secondary)', color: active ? '#fff' : 'var(--muted-foreground)' }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Materiais */}
      {activeTab === 'materiais' && (
        <div>
          {isAdmin && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><MaterialsManager stepId={stepId} mode="create" /></div>}
          {materials.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}><p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Nenhum material adicionado.</p></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%),1fr))', gap: 14 }}>
                {materials.map((m: any) => (
                  <MaterialCard
                    key={m.id}
                    title={m.title}
                    url={m.url}
                    description={m.description}
                    type={m.type}
                    checked={checkedMaterials.has(m.id)}
                    onCheck={checked => handleCheck(m.id, checked)}
                  />
                ))}
              </div>
          }
        </div>
      )}

      {/* FAQs */}
      {activeTab === 'faqs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isAdmin && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}><FaqManager stepId={stepId} mode="create" /></div>}
          {faqs.map((f: any) => (
            <div key={f.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, overflow: 'hidden', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.25)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
              <button onClick={() => setExpandedFaq(expandedFaq === f.id ? null : f.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{f.question}</span>
                {expandedFaq === f.id ? <ChevronUp size={15} style={{ color: '#6366f1', flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />}
              </button>
              {expandedFaq === f.id && (
                <div style={{ padding: '0 18px 16px', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.65, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {f.answer}
                </div>
              )}
            </div>
          ))}
          {faqs.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '24px', textAlign: 'center' }}>Nenhuma FAQ adicionada.</p>}
        </div>
      )}

      {/* Quiz */}
      {activeTab === 'quiz' && (
        <div>
          {isAdmin && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><QuizManager stepId={stepId} mode="create" /></div>}
          {questions.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '24px', textAlign: 'center' }}>Nenhuma questão adicionada.</p>
            : !isAdmin && !quizStarted ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '40px 32px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}>
                  <CheckSquare size={30} style={{ color: '#fff' }} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', marginBottom: 8 }}>Quiz — {s.title}</h2>
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 28 }}>
                  {questions.length} questões · Nota mínima: {s.min_quiz_score}%
                </p>
                <button onClick={() => setQuizStarted(true)}
                  style={{ height: 48, padding: '0 36px', borderRadius: 13, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 20px rgba(79,70,229,0.4)', transition: 'all 0.15s' }}>
                  Iniciar Quiz 🚀
                </button>
              </div>
            ) : !isAdmin && quizStarted && !quizFinished ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Questão {currentQ+1} de {questions.length}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{Math.round((currentQ/questions.length)*100)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', width: `${(currentQ/questions.length)*100}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 20, lineHeight: 1.5 }}>{currentQuestion?.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {currentQuestion?.onboarding_answers?.map((a: any) => {
                    const isSel = selectedAnswer === a.id
                    const isCorr = a.is_correct
                    let bg = 'var(--secondary)', border = 'var(--border)', color = 'var(--foreground)'
                    if (showExplanation && isSel && isCorr)  { bg='rgba(34,197,94,0.12)';  border='#22c55e'; color='#22c55e' }
                    if (showExplanation && isSel && !isCorr) { bg='rgba(239,68,68,0.1)';   border='#ef4444'; color='#ef4444' }
                    if (showExplanation && !isSel && isCorr) { bg='rgba(34,197,94,0.08)';  border='rgba(34,197,94,0.4)'; color='#22c55e' }
                    return (
                      <button key={a.id} onClick={() => !selectedAnswer && selectAnswer(currentQuestion.id, a.id)} disabled={!!selectedAnswer}
                        style={{ width:'100%', padding:'12px 16px', borderRadius:11, border:`1.5px solid ${border}`, background:bg, color, fontSize:14, fontWeight:isSel?700:500, cursor:selectedAnswer?'default':'pointer', fontFamily:'inherit', textAlign:'left', transition:'all 0.2s', display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0, background:isSel?border:'transparent', color:isSel?'white':border }}>
                          {showExplanation && isCorr ? '✓' : showExplanation && isSel ? '✗' : ''}
                        </span>
                        {a.answer_text}
                      </button>
                    )
                  })}
                </div>
                {showExplanation && currentQuestion?.explanation && (
                  <div style={{ padding:'12px 16px', borderRadius:11, background:isCorrect?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${isCorrect?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`, marginBottom:14 }}>
                    <p style={{ fontSize:13, color:isCorrect?'#22c55e':'#ef4444', margin:'0 0 4px', fontWeight:700 }}>{isCorrect?'✓ Correto!':'✗ Resposta incorreta'}</p>
                    <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:0 }}>💡 {currentQuestion.explanation}</p>
                  </div>
                )}
                {showExplanation && (
                  <button onClick={nextQuestion} disabled={submitting}
                    style={{ width:'100%', height:44, borderRadius:11, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(79,70,229,0.3)' }}>
                    {currentQ < questions.length-1 ? 'Próxima questão →' : submitting ? 'Calculando...' : 'Ver resultado 🏆'}
                  </button>
                )}
              </div>
            ) : !isAdmin && quizFinished ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'40px 32px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize:52, marginBottom:16 }}>{quizScore >= s.min_quiz_score ? '🏆' : '💪'}</div>
                <h2 style={{ fontSize:28, fontWeight:900, letterSpacing:'-0.03em', color:quizScore>=s.min_quiz_score?'#22c55e':'#f59e0b', marginBottom:8 }}>{quizScore}%</h2>
                <p style={{ fontSize:16, fontWeight:700, color:'var(--foreground)', marginBottom:6 }}>{quizScore>=s.min_quiz_score?'Parabéns! Você passou! 🎉':'Continue tentando!'}</p>
                <p style={{ fontSize:13, color:'var(--muted-foreground)', marginBottom:28 }}>Nota mínima: {s.min_quiz_score}%</p>
                <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={() => { setQuizStarted(false); setQuizFinished(false); setCurrentQ(0); setSelectedAnswers({}); setShowExplanation(false) }}
                    style={{ height:40, padding:'0 24px', borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    Tentar novamente
                  </button>
                  {quizScore >= s.min_quiz_score && (
                    <a href="/onboarding/trilha" style={{ height:40, padding:'0 24px', borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center', boxShadow:'0 4px 14px rgba(79,70,229,0.3)' }}>
                      Próxima etapa →
                    </a>
                  )}
                </div>
              </div>
            ) : isAdmin ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {questions.map((q: any, qi: number) => (
                  <div key={q.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:13, padding:'16px 18px' }}>
                    <p style={{ fontSize:14, fontWeight:700, color:'var(--foreground)', margin:'0 0 10px' }}>{qi+1}. {q.question}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {q.onboarding_answers?.map((a: any) => (
                        <div key={a.id} style={{ padding:'8px 12px', borderRadius:8, fontSize:13, background:a.is_correct?'rgba(34,197,94,0.1)':'var(--secondary)', color:a.is_correct?'#22c55e':'var(--muted-foreground)', border:`1px solid ${a.is_correct?'rgba(34,197,94,0.3)':'var(--border)'}` }}>
                          {a.is_correct ? '✓ ' : ''}{a.answer_text}
                        </div>
                      ))}
                    </div>
                    {q.explanation && <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:'10px 0 0', padding:'8px 12px', background:'var(--secondary)', borderRadius:8 }}>💡 {q.explanation}</p>}
                  </div>
                ))}
              </div>
            ) : null}
        </div>
      )}
    </div>
  )
}
