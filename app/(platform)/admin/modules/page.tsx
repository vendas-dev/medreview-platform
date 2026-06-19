'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Monitor, Calculator, Zap, Package, FileText,
  Eye, EyeOff, Loader2
} from 'lucide-react'

// "admin" é fixo — superadmin sempre tem acesso, não pode desativar
const LOCKED_KEYS = ['admin']

const ICON_MAP: Record<string, any> = {
  monitor:    Monitor,
  calculator: Calculator,
  zap:        Zap,
  package:    Package,
  filetext:   FileText,
  settings:   Package,
}

interface Module {
  id:         string
  key:        string
  label:      string
  icon:       string
  is_active:  boolean
  sort_order: number
}

export default function ModulosPage() {
  const [modules,   setModules]   = useState<Module[]>([])
  const [loading,   setLoading]   = useState(true)
  const [toggling,  setToggling]  = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('modules').select('*').order('sort_order')
      .then(({ data }) => {
        // Filtra "Administração" — é módulo fixo, não pode ser desativado aqui
        setModules((data ?? []).filter((m: Module) => !LOCKED_KEYS.includes(m.key)))
        setLoading(false)
      })
  }, [])

  async function toggleModule(mod: Module) {
    setToggling(mod.id)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('modules')
      .update({ is_active: !mod.is_active })
      .eq('id', mod.id)

    if (err) {
      setError(`Erro ao atualizar "${mod.label}": ${err.message}`)
      setToggling(null)
      return
    }

    // Atualizar estado local imediatamente
    setModules(prev => prev.map(m =>
      m.id === mod.id ? { ...m, is_active: !m.is_active } : m
    ))

    // Disparar evento para o Sidebar atualizar NA HORA (mesma sessão)
    window.dispatchEvent(new CustomEvent('module-toggled'))

    setToggling(null)
  }

  const IconComponent = (iconName: string) => {
    const Comp = ICON_MAP[iconName?.toLowerCase()] ?? Package
    return <Comp size={20} />
  }

  return (
    <div style={{ padding: 'clamp(20px,4vw,40px)', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Módulos
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0 }}>
          Gerencie os módulos disponíveis na plataforma. O módulo <strong>Administração</strong> é fixo e não pode ser desativado.
        </p>
      </div>

      {/* Aviso do módulo Administração (fixo) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1.5px solid rgba(99,102,241,0.2)', marginBottom: 24 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>
          <Package size={18} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', margin: '0 0 2px' }}>Administração</p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>key: admin — módulo fixo, sempre ativo</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Fixo</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px', justifyContent: 'center' }}>
          <Loader2 size={20} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Carregando módulos...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modules.map(mod => {
            const isToggling = toggling === mod.id

            return (
              <div key={mod.id}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--card)', border: `1.5px solid ${mod.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`, borderRadius: 16, transition: 'all 0.2s', boxShadow: mod.is_active ? '0 2px 12px rgba(34,197,94,0.08)' : 'none' }}>

                {/* Ícone */}
                <div style={{ width: 44, height: 44, borderRadius: 13, background: mod.is_active ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.1))' : 'var(--secondary)', border: `1px solid ${mod.is_active ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: mod.is_active ? '#16a34a' : 'var(--muted-foreground)', transition: 'all 0.2s' }}>
                  {IconComponent(mod.icon)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 3px' }}>{mod.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, fontFamily: 'monospace' }}>key: {mod.key}</p>
                </div>

                {/* Badge status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: mod.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${mod.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`, flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: mod.is_active ? '#22c55e' : '#ef4444', animation: mod.is_active ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: mod.is_active ? '#16a34a' : '#ef4444' }}>
                    {mod.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Botão toggle */}
                <button
                  onClick={() => toggleModule(mod)}
                  disabled={isToggling}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 10, border: `1.5px solid ${mod.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, background: mod.is_active ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)', color: mod.is_active ? '#ef4444' : '#16a34a', fontSize: 13, fontWeight: 700, cursor: isToggling ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0, opacity: isToggling ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!isToggling) e.currentTarget.style.opacity = '0.75' }}
                  onMouseLeave={e => { if (!isToggling) e.currentTarget.style.opacity = '1' }}>
                  {isToggling
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.6s linear infinite' }} /> Salvando...</>
                    : mod.is_active
                      ? <><EyeOff size={14} /> Desativar</>
                      : <><Eye    size={14} /> Ativar</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
