'use client'
import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption { value: string; label: string }

interface Props {
  value:        string
  onChange:     (v: string) => void
  options:      SelectOption[]
  label?:       string        // opcional — sem label fica só o select
  disabled?:    boolean
  placeholder?: string
  minWidth?:    number
}

export function CustomSelect({ label, value, onChange, options, disabled, placeholder, minWidth }: Props) {
  const [open,          setOpen]          = useState(false)
  const [dropStyle,     setDropStyle]     = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const id = useId()
  const selected = options.find(o => o.value === value)

  const openDrop = useCallback(() => {
    if (!triggerRef.current || disabled) return
    const rect  = triggerRef.current.getBoundingClientRect()
    const dropH = Math.min(options.length * 44 + 8, 280)
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    setDropStyle({
      position: 'fixed',
      left:  rect.left,
      width: Math.max(rect.width, minWidth ?? 0),
      zIndex: 9999,
      ...(below < dropH && above > below
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top:    rect.bottom + 6 }),
    })
    setOpen(true)
  }, [disabled, options.length, minWidth])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (dropRef.current?.contains(e.target as Node))    return
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('scroll',    onScroll, true)
    window.addEventListener('resize',    () => setOpen(false))
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll',    onScroll, true)
      window.removeEventListener('resize',    () => setOpen(false))
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isActive = !!value

  return (
    <div>
      {label && (
        <label htmlFor={id} style={{
          fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)',
          display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {label}
        </label>
      )}

      <button ref={triggerRef} id={label ? id : undefined} type="button" disabled={disabled}
        onClick={() => open ? setOpen(false) : openDrop()}
        style={{
          width: '100%', height: 42, padding: '0 38px 0 14px', borderRadius: 10,
          border: `1.5px solid ${open ? '#6366f1' : isActive ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
          background: open
            ? 'color-mix(in srgb,rgba(99,102,241,0.08) 100%,var(--background))'
            : isActive ? 'color-mix(in srgb,rgba(99,102,241,0.04) 100%,var(--background))' : 'var(--background)',
          color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: 'inherit',
          textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          display: 'flex', alignItems: 'center', position: 'relative',
          whiteSpace: 'nowrap', minWidth: minWidth,
        }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected?.label ?? (placeholder ?? 'Selecionar...')}
        </span>
        <span style={{
          position: 'absolute', right: 12, top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: open || isActive ? '#6366f1' : 'var(--muted-foreground)',
          transition: 'transform 0.2s, color 0.15s',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <ChevronDown size={15} strokeWidth={2.5} />
        </span>
      </button>

      {open && (
        <div ref={dropRef} style={{
          ...dropStyle,
          background: 'var(--card)',
          border: '1.5px solid rgba(99,102,241,0.2)',
          borderRadius: 13,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2), 0 4px 12px rgba(99,102,241,0.12)',
          overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
          animation: 'csDrop 0.15s ease',
        }}>
          {options.length === 0
            ? <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center' }}>Nenhuma opção</div>
            : options.map((opt, idx) => {
                const sel = opt.value === value
                return (
                  <button key={opt.value} type="button"
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    style={{
                      width: '100%', padding: '11px 16px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: sel ? 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(124,58,237,0.08))' : 'transparent',
                      border: 'none',
                      borderBottom: idx < options.length - 1 ? '1px solid color-mix(in srgb,var(--border) 50%,transparent)' : 'none',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      fontSize: 14, fontWeight: sel ? 700 : 400,
                      color: sel ? '#6366f1' : 'var(--foreground)', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb,rgba(99,102,241,0.07) 100%,transparent)' }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <span style={{ flex: 1, lineHeight: 1.4 }}>{opt.label}</span>
                    {sel && <Check size={14} strokeWidth={2.5} style={{ color: '#6366f1', flexShrink: 0 }} />}
                  </button>
                )
              })}
        </div>
      )}

      <style>{`
        @keyframes csDrop {
          from { opacity:0; transform: translateY(-6px) scale(0.97); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
