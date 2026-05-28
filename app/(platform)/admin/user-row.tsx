'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pencil } from 'lucide-react'
import { toggleUserActive } from './actions'
import type { Profile } from '@/types/database'

interface UserRowProps {
  user: Profile
  currentUserId: string
}

export function UserRow({ user, currentUserId }: UserRowProps) {
  const [loading, setLoading] = useState(false)
  const isSelf = user.id === currentUserId

  async function handleToggle() {
    if (isSelf) return
    setLoading(true)
    await toggleUserActive(user.id, !user.is_active)
    setLoading(false)
  }

  return (
    <div className="grid grid-cols-[1fr_140px_100px_80px] items-center px-4 py-3.5 hover:bg-secondary/30 transition-colors">
      {/* Usuário */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-medium shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>

      {/* Role */}
      <div>
        <span className={`
          inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium
          ${user.role === 'superadmin'
            ? 'bg-primary/10 text-primary'
            : 'bg-secondary text-muted-foreground'
          }
        `}>
          {user.role === 'superadmin' ? 'Superadmin' : 'Consultor'}
        </span>
      </div>

      {/* Status */}
      <div>
        <button
          onClick={handleToggle}
          disabled={isSelf || loading}
          className={`
            inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors
            ${user.is_active
              ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
              : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
            }
            ${isSelf ? 'cursor-default opacity-60' : 'cursor-pointer'}
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-destructive'}`} />
          {loading ? '...' : user.is_active ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end">
        <Link
          href={`/admin/users/${user.id}`}
          className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil size={13} />
        </Link>
      </div>
    </div>
  )
}
