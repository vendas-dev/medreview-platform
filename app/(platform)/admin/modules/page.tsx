'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Pencil, Trash2, Check, X, Package } from 'lucide-react'

const LOCKED_KEYS = ['admin'] // Administração é fixo

interface Module {
  id: string; key: string; label: string
  icon: string; is_active: boolean; sort_order: number
}

export default function ModulosPage() {
  const [modules,  setModules]  = useState<Module[]>([])
  const [loading,  setLoading]  = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing,  setEditing]  = useState<string | null>(null)  // id do módulo em edição
  const [editVal,  setEditVal]  = useState('')
  const [confirm,  setConfirm]  = useState<string | null>(null)  // id para confirmar exclusão
  const [msg,      setMsg]      = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('modules').select('*').order('sort_order')
      .then(({ data }) => { setModules((data ?? []).filter((m: Module) => !LOCKED_KEYS.includes(m.key))); setLoading(false) })
  }, [])

  // Ativar / desativar
  async function toggleModule(mod: Module) {
    setToggling(mod.id)
    await supabase.from('modules').update({ is_active: !mod.is_active }).eq('id', mod.id)
    setModules(prev => prev.map(m => m.id === mod.id ? { ...m, is_active: !m.is_active } : m))
    window.dispatchEvent(new CustomEvent('module-toggled'))
    setToggling(null)
    flash(!mod.is_active ? 'Módulo ativado!' : 'Módulo desativado!')
  }

  // Salvar novo rótulo
  async function saveLabel(mod: Module) {
    if (!editVal.trim() || editVal === mod.label) { setEditing(null); return }
    await supabase.from('modules').update({ label: editVal.trim() }).eq('id', mod.id)
    setModules(prev => prev.map(m => m.id === mod.id ? { ...m, label: editVal.trim() } : m))
    window.dispatchEvent(new CustomEvent('module-toggled')) // recarrega sidebar
    setEditing(null)
    flash('Rótulo atualizado!')
  }

  // Excluir permanentemente
  async function deleteModule(id: string) {
    setDeleting(id); setConfirm(null)
    await supabase.from('modules').delete().eq('id', id)
    setModules(prev => prev.filter(m => m.id !== id))
    window.dispatchEvent(new CustomEvent('module-toggled'))
    setDeleting(null)
    flash('Módulo excluído permanentemente.')
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  const inp: React.CSSProperties = {
    height: 36, padding: '0 12px', borderRadius: 9, border: '1.5px solid #6366f1',
    background: 'var(--background)', color: 'var(--foreground)', fontSize: 14,
    fontFamily: 'inherit', outline: 'none', flex: 1,
  }

  return (
    <div style={{ padding: 'clamp(20px,4vw,40px)', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.025em' }}>Módulos</h1>
          {msg && <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '4px 12px', borderRadius: 999 }}>✓ {msg}</span>}
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0 }}>
          Gerencie os módulos da plataforma. Você pode editar o rótulo, ativar/desativar ou excluir permanentemente.
        </p>
      </div>

      {/* Módulo fixo: Administração */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 14, background: 'rgba(99,102,241,0.05)', border: '1.5px solid rgba(99,102,241,0.18)', marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Package size={18} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#6366f1', margin: '0 0 2px' }}>Administração</p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, fontFamily: 'monospace' }}>key: admin — módulo fixo, sempre ativo</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Fixo</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px', justifyContent: 'center' }}>
          <Loader2 size={20} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Carregando...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modules.map(mod => {
            const isToggling = toggling === mod.id
            const isDeleting = deleting === mod.id
            const isEditing  = editing  === mod.id
            const isConfirm  = confirm  === mod.id

            return (
              <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--card)', border: `1.5px solid ${mod.is_active ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, borderRadius: 16, transition: 'all 0.2s', boxShadow: mod.is_active ? '0 2px 12px rgba(34,197,94,0.06)' : 'none' }}>

                {/* Ícone */}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: mod.is_active ? 'rgba(34,197,94,0.1)' : 'var(--secondary)', border: `1px solid ${mod.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={18} style={{ color: mod.is_active ? '#16a34a' : 'var(--muted-foreground)' }} />
                </div>

                {/* Label + key */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveLabel(mod); if (e.key === 'Escape') setEditing(null) }}
                        style={inp} />
                      <button onClick={() => saveLabel(mod)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.1)', color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditing(null)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 3px' }}>{mod.label}</p>
                  )}
                  {!isEditing && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, fontFamily: 'monospace' }}>key: {mod.key}</p>}
                </div>

                {/* Badge status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: mod.is_active ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${mod.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.15)'}`, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: mod.is_active ? '#22c55e' : '#ef4444', animation: mod.is_active ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: mod.is_active ? '#16a34a' : '#ef4444' }}>{mod.is_active ? 'Ativo' : 'Inativo'}</span>
                </div>

                {/* Botão editar rótulo */}
                {!isEditing && !isConfirm && (
                  <button onClick={() => { setEditing(mod.id); setEditVal(mod.label) }} title="Editar rótulo"
                    style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'transparent' }}>
                    <Pencil size={14} />
                  </button>
                )}

                {/* Botão toggle ativo/inativo */}
                {!isConfirm && (
                  <button onClick={() => toggleModule(mod)} disabled={isToggling || isDeleting} title={mod.is_active ? 'Desativar' : 'Ativar'}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 9, border: `1.5px solid ${mod.is_active ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`, background: mod.is_active ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)', color: mod.is_active ? '#ef4444' : '#16a34a', fontSize: 12, fontWeight: 700, cursor: (isToggling || isDeleting) ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: (isToggling || isDeleting) ? 0.6 : 1, flexShrink: 0 }}>
                    {isToggling ? <Loader2 size={13} style={{ animation: 'spin 0.6s linear infinite' }} /> : mod.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                    {isToggling ? '...' : mod.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                )}

                {/* Botão excluir / confirmação */}
                {!isConfirm ? (
                  <button onClick={() => setConfirm(mod.id)} disabled={isToggling || isDeleting} title="Excluir permanentemente"
                    style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 size={14} />
                  </button>
                ) : (
                  /* Confirmação de exclusão inline */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.2)' }}>
                    <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>Excluir permanentemente?</span>
                    <button onClick={() => deleteModule(mod.id)} disabled={!!isDeleting}
                      style={{ height: 28, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                      {isDeleting ? '...' : 'Sim, excluir'}
                    </button>
                    <button onClick={() => setConfirm(null)}
                      style={{ height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
