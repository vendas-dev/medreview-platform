'use client'
import { useState } from 'react'
import { StepList } from './StepList'
import { StepManager } from './StepManager'

interface Step {
  id: string; title: string; description: string | null
  estimated_minutes: number | null; team: string; day_number: number | null
  completion_criteria: string; min_quiz_score: number
  onboarding_materials: any[]; onboarding_faqs: any[]; onboarding_questions: any[]
}

export function TrilhaClient({ steps: initialSteps, isAdmin }: { steps: Step[]; isAdmin: boolean }) {
  const [steps, setSteps] = useState<Step[]>(initialSteps)

  function handleCreated(newStep: Step) {
    // Adiciona imediatamente ao estado local — sem F5
    setSteps(prev => {
      const list = [...prev, newStep]
      return list.sort((a, b) => {
        if (a.day_number === b.day_number) return 0
        if (a.day_number === null) return 1
        if (b.day_number === null) return -1
        return a.day_number - b.day_number
      })
    })
  }

  function handleUpdated(updated: Partial<Step> & { id: string }) {
    setSteps(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
  }

  function handleDeleted(id: string) {
    setSteps(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Trilha de Onboarding
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
            {steps.length} etapa{steps.length !== 1 ? 's' : ''} cadastrada{steps.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <StepManager mode="create" onCreated={handleCreated} />
        )}
      </div>

      <StepList steps={steps} isAdmin={isAdmin} onUpdated={handleUpdated} onDeleted={handleDeleted} />
    </div>
  )
}
