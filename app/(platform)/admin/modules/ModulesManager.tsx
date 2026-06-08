'use client'
import { useState } from 'react'
import { Package, Eye, EyeOff } from 'lucide-react'

export function ModulesManager({ modules }: { modules: any[] }) {
  const [list, setList] = useState(modules)

  async function toggleModule(id: string, isActive: boolean) {
    const res = await fetch('/api/admin/modules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    })
    if (res.ok) setList(prev => prev.map(m => m.id === id ? { ...m, is_active: !isActive } : m))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map(mod => (
        <div key={mod.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: mod.is_active ? 'rgba(34,197,94,0.1)' : 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={18} style={{ color: mod.is_active ? '#22c55e' : 'var(--muted-foreground)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>{mod.label}</p>
            {mod.description && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{mod.description}</p>}
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0', fontFamily: 'monospace' }}>key: {mod.key}</p>
          </div>
          <button onClick={() => toggleModule(mod.id, mod.is_active)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: mod.is_active ? '#22c55e' : 'var(--muted-foreground)', fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0 }}>
            {mod.is_active ? <><Eye size={13} /> Ativo</> : <><EyeOff size={13} /> Inativo</>}
          </button>
        </div>
      ))}
      {list.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: 32 }}>Nenhum módulo cadastrado.</p>}
    </div>
  )
}
