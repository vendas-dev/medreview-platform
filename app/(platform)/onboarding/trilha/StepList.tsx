'use client'
import Link from 'next/link'
import { ChevronRight, Clock } from 'lucide-react'

interface Step {
  id: string
  title: string
  description: string | null
  estimated_minutes: number | null
  team: string
  onboarding_materials?: { count: number }[]
  onboarding_faqs?: { count: number }[]
  onboarding_questions?: { count: number }[]
}

export function StepList({ steps, isAdmin }: { steps: Step[]; isAdmin: boolean }) {
  if (steps.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Nenhuma etapa cadastrada ainda.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, idx) => (
        <div key={step.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Indicador timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
              {idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div style={{ width: 2, height: 24, background: 'var(--border)', margin: '4px 0' }} />
            )}
          </div>

          {/* Card */}
          <div style={{ flex: 1, marginBottom: 0 }}>
            <Link href={`/onboarding/trilha/${step.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 8, transition: 'all 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'color-mix(in srgb, var(--foreground) 20%, transparent)'
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--border)'
                  el.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{step.title}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: step.team === 'OAO' ? 'rgba(59,130,246,0.12)' : step.team === 'R1' ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)',
                        color: step.team === 'OAO' ? '#3b82f6' : step.team === 'R1' ? '#8b5cf6' : '#10b981',
                      }}>
                        {step.team}
                      </span>
                    </div>
                    {step.description && (
                      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5 }}>
                        {step.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {step.estimated_minutes && (
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {step.estimated_minutes} min
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {(step.onboarding_materials?.[0] as any)?.count ?? 0} materiais
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {(step.onboarding_faqs?.[0] as any)?.count ?? 0} FAQs
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {(step.onboarding_questions?.[0] as any)?.count ?? 0} questões
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0, marginTop: 2 }} />
                </div>
              </div>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
