import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createUser } from '@/app/(platform)/admin/actions'

export default async function NewUserPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'superadmin') redirect('/dashboard')

  const { data: modules } = await supabase
    .from('modules').select('*').eq('is_active', true).order('sort_order')

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Novo usuário</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Crie um acesso para a plataforma</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <form action={createUser} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome completo</label>
            <input
              name="name"
              type="text"
              required
              placeholder="João Silva"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="joao@medreview.com"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Senha inicial</label>
            <input
              name="password"
              type="text"
              required
              placeholder="Senha provisória"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            <p className="text-xs text-muted-foreground">O usuário poderá trocar depois.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Função</label>
            <select
              name="role"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="consultor">Consultor</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>

          {/* Módulos */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Módulos liberados</label>
            <div className="space-y-2">
              {modules?.map(mod => (
                <label
                  key={mod.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    name="modules"
                    value={mod.id}
                    defaultChecked={mod.key === 'telao' || mod.key === 'calculadora'}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{mod.label}</p>
                    {mod.description && (
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/admin"
              className="flex-1 h-10 rounded-lg border border-border flex items-center justify-center text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Criar usuário
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
