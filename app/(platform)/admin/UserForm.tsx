'use client'
import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import Link from 'next/link'
import type { Profile, Module } from '@/types/database'

interface Props {
  modules: Module[]
  mode: 'create' | 'edit'
  user?: Profile & { job_role?: string; team?: string }
  grantedModuleIds?: string[]
  isSelf?: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 16px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
}
const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 8,
}
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16,
}

export function UserForm({ modules, mode, user, grantedModuleIds = [], isSelf = false }: Props) {
  const [preview, setPreview]       = useState<string | null>(user?.avatar_url ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [jobRole, setJobRole]       = useState(user?.job_role ?? '')
  const [checkedModules, setCheckedModules] = useState<string[]>(
    mode === 'edit'
      ? grantedModuleIds
      : modules.filter(m => m.key === 'telao' || m.key === 'calculadora').map(m => m.id)
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() ?? ''

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function toggleModule(id: string) {
    setCheckedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget

    // Monta FormData para suportar envio de arquivo
    const formData = new FormData()
    formData.append('mode',     mode)
    formData.append('name',     (form.elements.namedItem('name') as HTMLInputElement)?.value ?? '')
    formData.append('email',    (form.elements.namedItem('email') as HTMLInputElement)?.value ?? '')
    formData.append('password', (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '')
    formData.append('role',     (form.elements.namedItem('role') as HTMLSelectElement)?.value ?? 'consultor')
    formData.append('job_role', (form.elements.namedItem('job_role') as HTMLSelectElement)?.value ?? '')
    formData.append('team',     (form.elements.namedItem('team') as HTMLSelectElement)?.value ?? '')
    formData.append('modules',  JSON.stringify(checkedModules))
    if (mode === 'edit' && user) formData.append('userId', user.id)
    if (avatarFile) formData.append('avatar', avatarFile)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        body: formData, // sem Content-Type — deixa o browser definir multipart
      })
      const data = await res.json()
      if (res.ok) {
        window.location.href = '/admin'
      } else {
        setError(data.error ?? 'Erro ao salvar. Tente novamente.')
        setLoading(false)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--primary)'
    e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)'
  }
  function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  const selectArrow = (
    <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Avatar */}
      <div style={{ background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', borderBottom: '1px solid var(--border)', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 88, height: 88, borderRadius: 20, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>
            {preview
              ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (initials || (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ))
            }
          </div>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: -6, right: -6, width: 30, height: 30, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <Camera size={14} />
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          {user && <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{user.name}</p>}
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
            {avatarFile ? `✓ ${avatarFile.name}` : 'Foto do usuário · JPG, PNG · máx. 2MB'}
          </p>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ display: 'none' }} />
      </div>

      {/* Form */}
      <form ref={formRef} onSubmit={handleSubmit} style={{ padding: '28px' }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        <p style={sectionTitle}>Dados pessoais</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>Nome completo *</label>
            <input name="name" type="text" required defaultValue={user?.name} placeholder="Ex: João Silva" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input name="email" type="email" required defaultValue={user?.email} placeholder="joao@medreview.com" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
          </div>
          <div>
            <label style={labelStyle}>Cargo</label>
            <div style={{ position: 'relative' }}>
              <select name="job_role" value={jobRole} onChange={e => setJobRole(e.target.value)} style={{ ...inputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }} onFocus={focusInput} onBlur={blurInput}>
                <option value="">Selecione o cargo...</option>
                <option value="closer">Closer</option>
                <option value="supervisor">Supervisor</option>
                <option value="gerente">Gerente</option>
                <option value="outro">Outro</option>
              </select>
              {selectArrow}
            </div>
          </div>
          {jobRole === 'closer' && (
            <div>
              <label style={labelStyle}>Time *</label>
              <div style={{ position: 'relative' }}>
                <select name="team" defaultValue={user?.team ?? ''} style={{ ...inputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }} onFocus={focusInput} onBlur={blurInput}>
                  <option value="">Selecione o time...</option>
                  <option value="OAO">Time OAO</option>
                  <option value="R1">Time R1</option>
                </select>
                {selectArrow}
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 28px' }} />

        <p style={sectionTitle}>Acesso e segurança</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>{mode === 'create' ? 'Senha inicial *' : 'Nova senha'}</label>
            <input name="password" type="text" required={mode === 'create'} placeholder={mode === 'edit' ? 'Deixe em branco para manter' : 'Senha provisória'} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            {mode === 'edit' && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>Deixe em branco para manter.</p>}
          </div>
          <div>
            <label style={labelStyle}>Função</label>
            <div style={{ position: 'relative' }}>
              <select name="role" defaultValue={user?.role ?? 'consultor'} disabled={isSelf} style={{ ...inputStyle, paddingRight: 36, appearance: 'none', cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.5 : 1 }} onFocus={focusInput} onBlur={blurInput}>
                <option value="consultor">Consultor</option>
                <option value="superadmin">Superadmin</option>
              </select>
              {selectArrow}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 28px' }} />

        <p style={sectionTitle}>Módulos liberados</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 28 }}>
          {modules.map(mod => {
            const checked = checkedModules.includes(mod.id)
            return (
              <label key={mod.id} onClick={() => toggleModule(mod.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${checked ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--border)'}`, background: checked ? 'color-mix(in srgb, var(--primary) 5%, var(--card))' : 'var(--card)', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, background: checked ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.15s' }}>
                  {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{mod.label}</p>
                  {mod.description && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{mod.description}</p>}
                </div>
              </label>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/admin" style={{ flex: 1, textDecoration: 'none' }}>
            <button type="button" style={{ width: '100%', height: 44, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--foreground)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
              Cancelar
            </button>
          </Link>
          <button type="submit" disabled={loading}
            style={{ flex: 1, height: 44, borderRadius: 10, background: 'var(--foreground)', color: 'var(--card)', fontSize: 14, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = loading ? '0.6' : '1' }}>
            {loading ? 'Salvando...' : mode === 'create' ? 'Criar usuário' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
