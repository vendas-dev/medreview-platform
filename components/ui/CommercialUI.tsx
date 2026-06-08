'use client'
import React from 'react'

interface Props {
  title: string
  subtitle?: string
  badge?: string
  actions?: React.ReactNode
  gradient?: boolean
}

export function PageHeader({ title, subtitle, badge, actions, gradient = false }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 14, marginBottom: 28,
      padding: gradient ? 'clamp(20px,3vw,32px)' : '0',
      ...(gradient ? {
        background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.05) 50%, rgba(236,72,153,0.04) 100%)',
        borderRadius: 18,
        border: '1px solid rgba(99,102,241,0.12)',
        boxShadow: '0 2px 16px rgba(79,70,229,0.06)',
      } : {}),
    }}>
      <div>
        {badge && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 8,
            padding: '3px 10px', borderRadius: 999,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: '#fff',
          }}>
            {badge}
          </span>
        )}
        <h1 style={{
          fontSize: 'clamp(18px,3vw,24px)', fontWeight: 800,
          color: 'var(--foreground)', margin: '0 0 5px',
          letterSpacing: '-0.025em',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}

// Botão primário com gradiente
export function BtnPrimary({ children, onClick, type = 'button', disabled, style }: {
  children: React.ReactNode; onClick?: () => void; type?: 'button'|'submit'
  disabled?: boolean; style?: React.CSSProperties
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 40, padding: '0 18px', borderRadius: 10,
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        color: '#fff', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
        transition: 'all 0.18s', opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.45)' } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.35)' }}>
      {children}
    </button>
  )
}

// Card com design comercial
export function CommercialCard({ children, style, hoverable = true }: {
  children: React.ReactNode; style?: React.CSSProperties; hoverable?: boolean
}) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: hoverable ? 'all 0.18s' : 'none',
      ...style,
    }}
    onMouseEnter={hoverable ? e => {
      const el = e.currentTarget as HTMLElement
      el.style.boxShadow = '0 6px 24px rgba(79,70,229,0.1)'
      el.style.borderColor = 'rgba(99,102,241,0.25)'
      el.style.transform = 'translateY(-1px)'
    } : undefined}
    onMouseLeave={hoverable ? e => {
      const el = e.currentTarget as HTMLElement
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
      el.style.borderColor = 'var(--border)'
      el.style.transform = 'none'
    } : undefined}>
      {children}
    </div>
  )
}

// Stat card
export function StatCard({ icon, label, value, color, gradient, sub }: {
  icon: React.ReactNode; label: string; value: string|number
  color: string; gradient: string; sub?: string
}) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'all 0.18s',
      position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.08)` }}
    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: gradient }} />
      <div style={{ width: 40, height: 40, borderRadius: 11, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: `0 4px 12px ${color}40` }}>
        {icon}
      </div>
      <p style={{ fontSize: 30, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 3px', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color, marginTop: 5, fontWeight: 600 }}>{sub}</p>}
    </div>
  )
}
