'use client'
import { useState } from 'react'
import { StepList } from './StepList'
import { StepManager } from './StepManager'

interface Step {
  id: string; title: string; description: string | null
  estimated_minutes: number | null; team: string; day_number: number | null
  completion_criteria?: string; min_quiz_score?: number
  onboarding_materials: any[]; onboarding_faqs: any[]; onboarding_questions: any[]
}

interface Props {
  initialSteps: Step[]
  isAdmin: boolean
  userProgress: any[]
  trailMode: string
}

export function TrilhaClient({ initialSteps, isAdmin, userProgress, trailMode }: Props) {
  const [steps, setSteps] = useState<Step[]>(initialSteps)

  function handleCreated(newStep: Step) {
    setSteps(prev => {
      const updated = [...prev, newStep]
      // Ordena: primeiro por day_number (null por último), depois pela ordem
      return updated.sort((a, b) => {
        if (a.day_number === null && b.day_number === null) return 0
        if (a.day_number === null) return 1
        if (b.day_number === null) return -1
        return a.day_number - b.day_number
      })
    })
  }

  function handleUpdated(updated: Partial<Step> & { id: string }) {
    setSteps(prev => {
      const newSteps = prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)
      return newSteps.sort((a, b) => {
        if (a.day_number === null && b.day_number === null) return 0
        if (a.day_number === null) return 1
        if (b.day_number === null) return -1
        return a.day_number - b.day_number
      })
    })
  }

  function handleDeleted(id: string) {
    setSteps(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 35%,#4f46e5 70%,#7c3aed 100%)', borderRadius: 20, padding: 'clamp(18px,3vw,28px)', marginBottom: 24, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'inline-block', marginBottom: 10 }}>
              {isAdmin ? '⚙️ Gestão da Trilha' : '🎯 Minha Trilha'}
            </span>
            <h1 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.025em' }}>
              {isAdmin ? 'Trilha de Aprendizado' : 'Sua jornada começa aqui! 🚀'}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0, maxWidth: 440, lineHeight: 1.6 }}>
              {isAdmin
                ? `${steps.length} etapa${steps.length !== 1 ? 's' : ''} cadastrada${steps.length !== 1 ? 's' : ''}. Organize a melhor jornada de aprendizado do seu time.`
                : 'Cada etapa concluída é um passo a mais rumo a ser o melhor. Vamos aprender e fazer você se destacar!'
              }
            </p>
          </div>
          {isAdmin && (
            <StepManager mode="create" onCreated={handleCreated} />
          )}
        </div>
      </div>

      <StepList
        steps={steps}
        isAdmin={isAdmin}
        userProgress={userProgress}
        trailMode={trailMode}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
