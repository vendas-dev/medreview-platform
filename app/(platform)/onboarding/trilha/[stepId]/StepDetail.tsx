'use client'
import { FileText, HelpCircle, CheckSquare } from 'lucide-react'
import { MaterialsManager, FaqManager, QuizManager } from './MaterialsManager'

export function StepDetail({ step, materials, faqs, questions, isAdmin, stepId }: any) {
  const s = step
  return (
    <div>
      {/* Header da etapa */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{s.title}</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: s.team === 'OAO' ? 'rgba(59,130,246,0.12)' : s.team === 'R1' ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)',
                color: s.team === 'OAO' ? '#3b82f6' : s.team === 'R1' ? '#8b5cf6' : '#10b981',
              }}>{s.team}</span>
            </div>
            {s.description && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>{s.description}</p>}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {s.estimated_minutes && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>⏱ {s.estimated_minutes} min</span>}
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Nota mínima: {s.min_quiz_score}%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Materiais */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: 'var(--muted-foreground)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                Materiais <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)' }}>({materials.length})</span>
              </h2>
            </div>
            {isAdmin && <MaterialsManager stepId={stepId} mode="create" />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {materials.map((m: any) => (
              <div key={m.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>{m.title}</p>
                  {m.description && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{m.description}</p>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'var(--secondary)', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                  {m.type}
                </span>
                <a href={m.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', flexShrink: 0 }}>
                  Abrir →
                </a>
              </div>
            ))}
            {materials.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '12px 0' }}>Nenhum material adicionado.</p>}
          </div>
        </section>

        {/* FAQs */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={16} style={{ color: 'var(--muted-foreground)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                FAQs <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)' }}>({faqs.length})</span>
              </h2>
            </div>
            {isAdmin && <FaqManager stepId={stepId} mode="create" />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {faqs.map((f: any) => (
              <details key={f.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <summary style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {f.question}
                  <span style={{ fontSize: 18, color: 'var(--muted-foreground)', lineHeight: 1 }}>+</span>
                </summary>
                <div style={{ padding: '12px 18px 16px', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, borderTop: '1px solid var(--border)' }}>
                  {f.answer}
                </div>
              </details>
            ))}
            {faqs.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '12px 0' }}>Nenhuma FAQ adicionada.</p>}
          </div>
        </section>

        {/* Quiz */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={16} style={{ color: 'var(--muted-foreground)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                Quiz <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)' }}>({questions.length} questões)</span>
              </h2>
            </div>
            {isAdmin && <QuizManager stepId={stepId} mode="create" />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q: any, qi: number) => (
              <div key={q.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 10px' }}>
                  {qi + 1}. {q.question}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {q.onboarding_answers?.map((a: any) => (
                    <div key={a.id} style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 13,
                      background: a.is_correct ? 'rgba(16,185,129,0.1)' : 'var(--secondary)',
                      color: a.is_correct ? '#10b981' : 'var(--muted-foreground)',
                      border: `1px solid ${a.is_correct ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    }}>
                      {a.is_correct ? '✓ ' : ''}{a.answer_text}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '10px 0 0', padding: '8px 12px', background: 'var(--secondary)', borderRadius: 8 }}>
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            ))}
            {questions.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '12px 0' }}>Nenhuma questão adicionada.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
