'use client'
import { useState, useRef } from 'react'
import { Camera, Sparkles, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { CustomSelect } from '@/components/ui/CustomSelect'
import type { Profile, Module } from '@/types/database'

interface Props {
  modules: Module[]
  mode: 'create' | 'edit'
  user?: Profile & { job_role?: string; team?: string; hubspot_id?: string }
  grantedModuleIds?: string[]
  isSelf?: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 16px', borderRadius: 11,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16,
  display: 'flex', alignItems: 'center', gap: 6,
}

const JOB_OPTIONS = [
  { value: '',           label: 'Selecione o cargo...' },
  { value: 'closer',     label: 'Closer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'gerente',    label: 'Gerente' },
  { value: 'outro',      label: 'Outro' },
]
const TEAM_OPTIONS = [
  { value: '',    label: 'Selecione o time...' },
  { value: 'OAO', label: '🔵 Time OAO' },
  { value: 'R1',  label: '🟣 Time R1' },
]
const ROLE_OPTIONS = [
  { value: 'consultor',   label: 'Consultor' },
  { value: 'superadmin',  label: 'Superadmin' },
]

export function UserForm({ modules, mode, user, grantedModuleIds = [], isSelf = false }: Props) {
  const [preview,        setPreview]    = useState<string | null>(user?.avatar_url ?? null)
  const [avatarFile,     setAvatarFile] = useState<File | null>(null)
  const [loading,        setLoading]    = useState(false)
  const [error,          setError]      = useState('')
  const [name,           setName]       = useState(user?.name ?? '')
  const [email,          setEmail]      = useState(user?.email ?? '')
  const [password,       setPassword]   = useState('')
  const [jobRole,        setJobRole]    = useState(user?.job_role ?? '')
  const [team,           setTeam]       = useState(user?.team ?? '')
  const [hubspotId,      setHubspotId]  = useState(user?.hubspot_id ?? '')
  const [role,           setRole]       = useState(user?.role ?? 'consultor')
  // Checklist só existe na criação de um closer novo — pra edição de um closer
  // já existente não faz sentido reexigir isso toda vez que alguém só quer
  // corrigir um dado.
  const [checklist, setChecklist] = useState({ avatar: false, hubspot: false, botmaker: false })
  const [checkedModules, setChecked]    = useState<string[]>(
    mode === 'edit'
      ? grantedModuleIds
      : modules.filter(m => m.key === 'telao' || m.key === 'calculadora').map(m => m.id)
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() ?? ''

  const isNewCloser = mode === 'create' && jobRole === 'closer'
  // Só quando TODAS as exigências do closer novo estiverem batidas (time,
  // hubspot id e as 3 caixas do checklist) o botão libera — além dos campos
  // básicos (nome/email/senha) já preenchidos.
  const closerRequirementsMet = !isNewCloser || (
    !!team && hubspotId.trim() !== '' && checklist.avatar && checklist.hubspot && checklist.botmaker
  )
  const baseFieldsFilled = name.trim() !== '' && email.trim() !== '' && (mode === 'edit' || password.trim() !== '')
  const canSubmit = baseFieldsFilled && closerRequirementsMet && !loading

  function toggleChecklist(k: keyof typeof checklist) {
    setChecklist(prev => ({ ...prev, [k]: !prev[k] }))
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function toggleModule(id: string) {
    setChecked(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true); setError('')
    const formData = new FormData()
    formData.append('mode',       mode)
    formData.append('name',       name)
    formData.append('email',      email)
    formData.append('password',   password)
    formData.append('role',       role)
    formData.append('job_role',   jobRole)
    formData.append('team',       team)
    formData.append('hubspot_id', hubspotId)
    formData.append('modules',    JSON.stringify(checkedModules))
    if (mode === 'edit' && user) formData.append('userId', user.id)
    if (avatarFile) formData.append('avatar', avatarFile)
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) window.location.href = '/admin'
      else { setError(data.error ?? 'Erro ao salvar.'); setLoading(false) }
    } catch { setError('Erro de conexão.'); setLoading(false) }
  }

  const focusFn = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
  const blurFn  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

      {/* Banner */}
      <div style={{ background: mode === 'create' ? 'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)' : 'linear-gradient(135deg,#1e3a5f,#1e40af,#3b82f6)', padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={16} style={{ color: '#fbbf24' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {mode === 'create' ? 'Novo membro' : 'Editar perfil'}
            </span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {mode === 'create' ? 'Boas-vindas ao time! 🎉' : `Editando: ${user?.name ?? 'usuário'}`}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            {mode === 'create' ? 'Cadastre o novo membro e ele já recebe acesso na hora.' : 'Mantenha os dados atualizados.'}
          </p>
        </div>
      </div>

      {/* Avatar */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16, background: 'color-mix(in srgb, var(--secondary) 50%, var(--card))' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 24, fontWeight: 900, color: '#fff', boxShadow: '0 6px 20px rgba(79,70,229,0.3)' }}>
            {preview ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (initials || <UserPlus size={28} style={{ color: '#fff' }} />)}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(79,70,229,0.4)' }}>
            <Camera size={13} />
          </button>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 3px' }}>{mode === 'create' ? 'Foto do novo membro' : user?.name}</p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{avatarFile ? `✓ ${avatarFile.name}` : 'JPG, PNG ou WebP · máx. 2MB'}</p>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ display: 'none' }} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: '26px 28px' }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 11, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 22 }}>
            <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Dados pessoais */}
        <p style={sectionTitle}>👤 Dados pessoais</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 26 }}>
          <div>
            <label style={labelStyle}>Nome completo *</label>
            <input name="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria Silva"
              style={inputStyle} onFocus={focusFn} onBlur={blurFn} />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@medreview.com"
              style={inputStyle} onFocus={focusFn} onBlur={blurFn} />
          </div>

          {/* Cargo — CustomSelect */}
          <div>
            <label style={labelStyle}>Cargo</label>
            <CustomSelect
              value={jobRole}
              onChange={setJobRole}
              options={JOB_OPTIONS}
              placeholder="Selecione o cargo..."
            />
          </div>

          {jobRole === 'closer' && (
            <>
              {/* Time — CustomSelect */}
              <div>
                <label style={labelStyle}>Time *</label>
                <CustomSelect
                  value={team}
                  onChange={setTeam}
                  options={TEAM_OPTIONS}
                  placeholder="Selecione o time..."
                />
              </div>

              {/* Checklist de setup — só obrigatório na criação de um closer novo */}
              {isNewCloser && (
                <div>
                  <label style={labelStyle}>Checklist de setup *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      ['avatar',   'Avatar criado'],
                      ['hubspot',  'Acesso ao HubSpot'],
                      ['botmaker', 'Acesso à Botmaker'],
                    ] as const).map(([k, label]) => {
                      const checked = checklist[k]
                      return (
                        <label key={k} onClick={() => toggleChecklist(k)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 11, border: `1.5px solid ${checked ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, background: checked ? 'rgba(34,197,94,0.06)' : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? '#22c55e' : 'var(--border)'}`, background: checked ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                            {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8, lineHeight: 1.5 }}>
                    Confirme os 3 itens (junto com o time e o ID do HubSpot) pra liberar a criação.
                  </p>
                </div>
              )}

              {/* HubSpot ID */}
              <div>
                <label style={labelStyle}>ID no HubSpot{isNewCloser ? ' *' : ''}</label>
                <input name="hubspot_id" type="text" value={hubspotId} onChange={e => setHubspotId(e.target.value)}
                  placeholder="Ex: 123456789" style={inputStyle} onFocus={focusFn} onBlur={blurFn} />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6, lineHeight: 1.5 }}>
                  💡 Vincula automaticamente este usuário às vendas no telão.
                  Encontre em <strong>HubSpot → Usuários → URL da página</strong>.
                </p>
              </div>
            </>
          )}

          {/* Campo oculto se não for closer */}
          {jobRole !== 'closer' && <input name="hubspot_id" type="hidden" value={hubspotId} readOnly />}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 26px' }} />

        {/* Acesso */}
        <p style={sectionTitle}>🔐 Acesso e segurança</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 26 }}>
          <div>
            <label style={labelStyle}>{mode === 'create' ? 'Senha inicial *' : 'Nova senha'}</label>
            <input name="password" type="text" required={mode === 'create'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'edit' ? 'Deixe em branco para manter' : 'Senha de acesso'}
              style={inputStyle} onFocus={focusFn} onBlur={blurFn} />
            {mode === 'edit' && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>Em branco = mantém a senha atual.</p>}
          </div>

          {/* Nível de acesso — CustomSelect */}
          <div>
            <label style={labelStyle}>Nível de acesso</label>
            <CustomSelect
              value={role}
              onChange={setRole}
              options={ROLE_OPTIONS}
              disabled={isSelf}
            />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 26px' }} />

        {/* Módulos */}
        <p style={sectionTitle}>🧩 Módulos liberados</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 28 }}>
          {modules.map(mod => {
            const checked = checkedModules.includes(mod.id)
            return (
              <label key={mod.id} onClick={() => toggleModule(mod.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 15px', borderRadius: 12, border: `1.5px solid ${checked ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, background: checked ? 'rgba(99,102,241,0.05)' : 'var(--card)', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? '#6366f1' : 'var(--border)'}`, background: checked ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.15s', boxShadow: checked ? '0 2px 8px rgba(79,70,229,0.3)' : 'none' }}>
                  {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{mod.label}</p>
                  {mod.description && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{mod.description}</p>}
                </div>
              </label>
            )
          })}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/admin" style={{ flex: 1, textDecoration: 'none' }}>
            <button type="button" style={{ width: '100%', height: 46, borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--foreground)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
              Cancelar
            </button>
          </Link>
          <button type="submit" disabled={!canSubmit}
            title={!canSubmit && isNewCloser ? 'Preencha o time, o ID do HubSpot e marque as 3 caixas do checklist' : undefined}
            style={{ flex: 2, height: 46, borderRadius: 11, background: canSubmit ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--secondary)', color: canSubmit ? '#fff' : 'var(--muted-foreground)', fontSize: 14, fontWeight: 800, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: canSubmit ? '0 4px 16px rgba(79,70,229,0.35)' : 'none' }}>
            {loading ? 'Salvando...' : mode === 'create' ? '🚀 Adicionar ao time' : '✓ Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
