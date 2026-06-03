'use client'
import { forwardRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export function Field({ label, hint, error, required, children }: {
  label?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
          {label}{required && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{hint}</p>}
      {error && <p style={{ fontSize: '12px', color: 'var(--destructive)' }}>{error}</p>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ style, ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      style={{
        width: '100%', height: '44px', padding: '0 16px',
        borderRadius: '10px', border: '1.5px solid var(--border)',
        background: 'var(--card)', color: 'var(--foreground)',
        fontSize: '14px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
        fontFamily: 'inherit',
        ...style
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
    />
  )
)
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ style, children, ...props }, ref) => (
    <div style={{ position: 'relative' }}>
      <select
        ref={ref}
        {...props}
        style={{
          width: '100%', height: '44px', padding: '0 40px 0 16px',
          borderRadius: '10px', border: '1.5px solid var(--border)',
          background: 'var(--card)', color: 'var(--foreground)',
          fontSize: '14px', outline: 'none', appearance: 'none',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s',
          ...style
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
      >
        {children}
      </select>
      <ChevronDown size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
    </div>
  )
)
Select.displayName = 'Select'

export function Checkbox({ label, description, name, value, defaultChecked }: {
  label: string; description?: string; name?: string; value?: string; defaultChecked?: boolean
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px',
      borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--card)',
      cursor: 'pointer', transition: 'all 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--primary) 40%, transparent)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--primary) 4%, var(--card))' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card)' }}
    >
      <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
        <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          onChange={e => {
            const box = e.target.nextElementSibling as HTMLElement
            if (e.target.checked) {
              box.style.background = 'var(--primary)'
              box.style.borderColor = 'var(--primary)'
              box.querySelector('svg')!.setAttribute('style', 'opacity:1;transform:scale(1)')
            } else {
              box.style.background = 'var(--card)'
              box.style.borderColor = 'var(--border)'
              box.querySelector('svg')!.setAttribute('style', 'opacity:0;transform:scale(0.5)')
            }
          }}
        />
        <div style={{
          width: 18, height: 18, borderRadius: 5, border: '2px solid var(--border)',
          background: defaultChecked ? 'var(--primary)' : 'var(--card)',
          borderColor: defaultChecked ? 'var(--primary)' : 'var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: defaultChecked ? 1 : 0, transform: defaultChecked ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.15s' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{label}</p>
        {description && <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{description}</p>}
      </div>
    </label>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'

const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  primary:     { background: 'var(--primary)', color: '#fff', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  secondary:   { background: 'var(--secondary)', color: 'var(--secondary-foreground)', border: 'none' },
  ghost:       { background: 'transparent', color: 'var(--muted-foreground)', border: 'none' },
  destructive: { background: 'var(--destructive)', color: '#fff', border: 'none' },
  outline:     { background: 'transparent', color: 'var(--muted-foreground)', border: '1.5px solid var(--border)' },
}

export function Button({ variant = 'primary', size = 'md', loading = false, children, style, ...props }: 
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm'|'md'|'lg'; loading?: boolean }
) {
  const h = { sm: '32px', md: '42px', lg: '48px' }[size ?? 'md']
  const px = { sm: '12px', md: '18px', lg: '24px' }[size ?? 'md']
  const fs = { sm: '12px', md: '14px', lg: '15px' }[size ?? 'md']

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      style={{
        height: h, padding: `0 ${px}`, borderRadius: '10px',
        fontSize: fs, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: 'all 0.15s', fontFamily: 'inherit',
        opacity: (props.disabled || loading) ? 0.55 : 1,
        ...btnStyles[variant], ...style
      }}
      onMouseEnter={e => { if (!props.disabled && !loading) (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {loading ? (
        <svg style={{ animation: 'spin 0.8s linear infinite', width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : children}
    </button>
  )
}

export function Badge({ variant = 'default', dot = false, children }: {
  variant?: 'default'|'primary'|'success'|'destructive'|'outline'; dot?: boolean; children: React.ReactNode
}) {
  const styles: Record<string, React.CSSProperties> = {
    default:     { background: 'var(--secondary)', color: 'var(--secondary-foreground)' },
    primary:     { background: 'rgba(37,99,235,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' },
    success:     { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' },
    destructive: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
    outline:     { background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border)' },
  }
  const dotColors: Record<string, string> = { default: '#94a3b8', primary: '#3b82f6', success: '#10b981', destructive: '#ef4444', outline: '#94a3b8' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, ...styles[variant] }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColors[variant], animation: 'pulseSlow 2s ease-in-out infinite' }} />}
      {children}
    </span>
  )
}
