'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { toggleUserActive, deleteUser } from './actions'
import type { Profile } from '@/types/database'

export function UserRow({ user, currentUserId }: { user: Profile; currentUserId: string }) {
  const [active, setActive]         = useState(user.is_active)
  const [loadingToggle, setLoadingToggle] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const isSelf = user.id === currentUserId
  const initials = user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  async function handleToggle() {
    if (isSelf || loadingToggle) return
    setLoadingToggle(true)
    await toggleUserActive(user.id, !active)
    setActive(a => !a)
    setLoadingToggle(false)
  }

  async function handleDelete() {
    setLoadingDelete(true)
    await deleteUser(user.id)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 20px', borderBottom: '1px solid var(--border)',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--secondary) 50%, transparent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        background: 'color-mix(in srgb, var(--foreground) 10%, var(--card))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--foreground)',
        border: '1px solid var(--border)',
      }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </span>
          {user.role === 'superadmin' && <ShieldCheck size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />}
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </span>
      </div>

      {/* Status toggle */}
      <button
        onClick={handleToggle}
        disabled={isSelf || loadingToggle}
        style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 999, border: 'none', fontFamily: 'inherit',
          fontSize: 11, fontWeight: 700, cursor: isSelf ? 'default' : 'pointer',
          transition: 'all 0.15s', opacity: isSelf ? 0.5 : 1,
          background: active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
          color: active ? '#10b981' : '#ef4444',
          outline: `1px solid ${active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#10b981' : '#ef4444' }} />
        {loadingToggle ? '...' : active ? 'Ativo' : 'Inativo'}
      </button>

      {/* Editar */}
      <Link
        href={`/admin/users/edit?id=${user.id}`}
        style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted-foreground)', textDecoration: 'none',
          border: '1px solid var(--border)', background: 'transparent',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
        }}
      >
        <Pencil size={13} />
      </Link>

      {/* Deletar — só aparece se não for o próprio usuário */}
      {!isSelf && (
        confirming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleDelete}
              disabled={loadingDelete}
              style={{
                height: 30, padding: '0 10px', borderRadius: 7, border: 'none',
                background: '#ef4444', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: loadingDelete ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loadingDelete ? '...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                height: 30, padding: '0 8px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted-foreground)', border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted-foreground)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            title="Excluir usuário"
          >
            <Trash2 size={13} />
          </button>
        )
      )}
    </div>
  )
}
