'use client'
import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

export interface SelectOption { value: string; label: string }

interface Props {
  label:        string
  value:        string
  onChange:     (v: string) => void
  options:      SelectOption[]
  disabled?:    boolean
  placeholder?: string
}

// Até esta largura de tela o menu abre como PAINEL INFERIOR (celular): opções
// grandes, fácil de tocar, nunca fica escondido atrás do teclado nem corta nas bordas.
const SHEET_MAX_W = 640

export function CustomSelect({ label, value, onChange, options, disabled, placeholder }: Props) {
  const [open,          setOpen]          = useState(false)
  const [sheet,         setSheet]         = useState(false)
  const [active,        setActive]        = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)
  const id     = useId()
  const listId = `${id}-lista`
  const selected = options.find(o => o.value === value)

  // Posiciona o menu comum (computador/tablet largo) SEMPRE dentro da tela:
  // abre para baixo ou para cima conforme o espaço e limita a altura ao espaço livre.
  const place = useCallback(() => {
    if (!triggerRef.current) return
    const rect  = triggerRef.current.getBoundingClientRect()
    const vw    = window.innerWidth, vh = window.innerHeight
    const dropH = Math.min(options.length * 44 + 16, 280)
    const below = vh - rect.bottom - 8
    const above = rect.top - 8
    const emCima = below < dropH && above > below
    const width  = Math.min(rect.width, vw - 16)
    setDropdownStyle({
      position: 'fixed' as const,
      left:  Math.max(8, Math.min(rect.left, vw - width - 8)),
      width,
      zIndex: 9999,
      maxHeight: Math.max(120, Math.min(280, (emCima ? above : below) - 6)),
      ...(emCima ? { bottom: vh - rect.top + 6 } : { top: rect.bottom + 6 }),
    })
  }, [options.length])

  const openDropdown = useCallback(() => {
    if (!triggerRef.current || disabled) return
    const comoPainel = window.innerWidth <= SHEET_MAX_W
    setSheet(comoPainel)
    if (!comoPainel) place()
    const i = options.findIndex(o => o.value === value)
    setActive(i >= 0 ? i : 0)
    setOpen(true)
  }, [disabled, options, value, place])

  const close = useCallback((devolverFoco = false) => {
    setOpen(false)
    if (devolverFoco) triggerRef.current?.focus()
  }, [])

  const pick = useCallback((v: string) => { onChange(v); close(true) }, [onChange, close])

  // Clique/toque fora (menu comum). No painel inferior quem fecha é o fundo escurecido.
  useEffect(() => {
    if (!open || sheet) return
    const fn = (e: PointerEvent) => {
      if (dropRef.current?.contains(e.target as Node))    return
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', fn)
    return () => document.removeEventListener('pointerdown', fn)
  }, [open, sheet])

  // Rolar a página: o menu comum ("fixo") acompanha o campo e só fecha se o campo sair da tela.
  // (Antes qualquer rolagem fechava o menu — inclusive uma que chegava no mesmo instante em que ele abria.)
  // Redimensionar (girar o aparelho, barra de endereço) também reposiciona em vez de fechar.
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event) => {
      if (sheet || dropRef.current?.contains(e.target as Node)) return          // rolar a própria lista não mexe no menu
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return }   // o campo saiu da tela: fecha
      place()                                                                   // senão o menu acompanha o campo
    }
    const onResize = () => {
      if (sheet) { if (window.innerWidth > SHEET_MAX_W) setOpen(false); return }
      if (window.innerWidth <= SHEET_MAX_W) { setOpen(false); return }
      place()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize) }
  }, [open, sheet, place])

  // Painel inferior: trava a rolagem da página de trás enquanto está aberto.
  useEffect(() => {
    if (!open || !sheet) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = anterior }
  }, [open, sheet])

  // Teclado: Esc fecha; ↑ ↓ Home End navegam; Enter/Espaço escolhem; Tab fecha.
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { e.preventDefault(); close(true); return }
      if (e.key === 'Tab')       { setOpen(false); return }
      if (!options.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(options.length - 1, a + 1)) }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
      else if (e.key === 'End')  { e.preventDefault(); setActive(options.length - 1) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) pick(options[active].value) }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, options, active, close, pick])

  // Mantém a opção ativa à vista (teclado) e a selecionada ao abrir.
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const isActive = !!value

  const lista = (
    <div ref={listRef} id={listId} role="listbox" aria-label={label} style={{ overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }}>
      {options.length === 0 ? (
        <div style={{ padding: '16px', fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center' }}>
          Nenhuma opção disponível
        </div>
      ) : options.map((opt, idx) => {
        const sel = opt.value === value
        const foco = idx === active
        return (
          <button key={opt.value} type="button" role="option" aria-selected={sel} data-idx={idx} id={`${id}-o${idx}`} tabIndex={-1}
            onClick={() => pick(opt.value)}
            onMouseMove={() => { if (active !== idx) setActive(idx) }}
            style={{
              width: '100%', padding: '10px 14px', minHeight: sheet ? 52 : 44,
              display: 'flex', alignItems: 'center', gap: 10,
              background: sel
                ? 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(124,58,237,0.08))'
                : foco ? 'color-mix(in srgb,rgba(99,102,241,0.07) 100%,transparent)' : 'transparent',
              border: 'none',
              borderBottom: idx < options.length - 1 ? '1px solid color-mix(in srgb,var(--border) 50%,transparent)' : 'none',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              fontSize: sheet ? 15 : 13.5, fontWeight: sel ? 700 : 400,
              color: sel ? '#6366f1' : 'var(--foreground)',
              transition: 'background 0.1s',
            }}>
            <span style={{ flex: 1, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>{opt.label}</span>
            {sel && <Check size={sheet ? 17 : 14} strokeWidth={2.5} style={{ color: '#6366f1', flexShrink: 0 }} />}
          </button>
        )
      })}
    </div>
  )

  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={{
        fontSize: 9.5, fontWeight: 800, color: 'var(--muted-foreground)',
        display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        {label}
      </label>

      <button ref={triggerRef} id={id} type="button" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => open ? close() : openDropdown()}
        onKeyDown={e => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openDropdown() } }}
        style={{
          width: '100%', height: 44, padding: '0 40px 0 14px', borderRadius: 10,
          border: `1.5px solid ${open ? '#6366f1' : isActive ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
          background: open
            ? 'color-mix(in srgb,rgba(99,102,241,0.08) 100%,var(--background))'
            : isActive
              ? 'color-mix(in srgb,rgba(99,102,241,0.05) 100%,var(--background))'
              : 'var(--background)',
          color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 13.5, fontWeight: isActive ? 600 : 400, fontFamily: 'inherit',
          textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          display: 'flex', alignItems: 'center', position: 'relative',
        }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? (placeholder ?? 'Selecionar...')}
        </span>
        <span style={{
          position: 'absolute', right: 13, top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: open || isActive ? '#6366f1' : 'var(--muted-foreground)',
          transition: 'transform 0.2s, color 0.15s', display: 'flex', alignItems: 'center',
        }}>
          <ChevronDown size={15} strokeWidth={2.5} />
        </span>
      </button>

      {open && !sheet && (
        <div ref={dropRef} style={{
          ...dropdownStyle,
          display: 'flex', flexDirection: 'column',
          background: 'var(--card)',
          border: '1.5px solid rgba(99,102,241,0.25)',
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.22), 0 4px 12px rgba(99,102,241,0.15)',
          overflow: 'hidden',
          animation: 'csDropIn 0.15s ease',
        }}>
          {lista}
        </div>
      )}

      {open && sheet && (
        <>
          <div data-cs="fundo" onClick={() => close(true)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(8,6,24,0.52)', animation: 'csFade 0.15s ease' }} />
          <div ref={dropRef} data-cs="painel" className="cs-sheet" role="dialog" aria-label={label} style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            background: 'var(--card)', borderTop: '1.5px solid rgba(99,102,241,0.25)',
            borderRadius: '18px 18px 0 0', boxShadow: '0 -16px 48px rgba(0,0,0,0.3)',
            paddingBottom: 'env(safe-area-inset-bottom)', animation: 'csSheetUp 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 8px 4px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
              <button type="button" aria-label="Fechar" onClick={() => close(true)}
                style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', borderRadius: 10 }}>
                <X size={18} />
              </button>
            </div>
            {lista}
          </div>
        </>
      )}

      <style>{`
        @keyframes csDropIn  { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes csSheetUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes csFade    { from { opacity: 0; } to { opacity: 1; } }
        .cs-sheet { max-height: 72vh; max-height: min(72dvh, 520px); }
      `}</style>
    </div>
  )
}
