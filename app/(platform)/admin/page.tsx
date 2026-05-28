import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { UserRow } from './user-row'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Administração</h1>
            <p className="text-xs text-muted-foreground">{users?.length ?? 0} usuários cadastrados</p>
          </div>
        </div>

        <Link
          href="/admin/users/new"
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          Novo usuário
        </Link>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_100px_80px] text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border bg-secondary/50">
          <span>Usuário</span>
          <span>Role</span>
          <span>Status</span>
          <span></span>
        </div>

        <div className="divide-y divide-border">
          {users?.map(u => (
            <UserRow key={u.id} user={u} currentUserId={user.id} />
          ))}
          {(!users || users.length === 0) && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
