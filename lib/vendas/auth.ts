// ══ Vendas — contexto do usuário logado (servidor) ══════════════════════════════════════════
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Ctx } from './handlers'

/** Devolve null quando não há sessão (a rota responde 401). Os dados saem pelo cliente admin; quem pode ver o quê é decidido nos handlers. */
export async function getVendasCtx(): Promise<Ctx | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role, name, team, hubspot_id').eq('id', user.id).maybeSingle()
  return { admin, userId: user.id, role: (p as any)?.role ?? null, name: (p as any)?.name ?? null, team: (p as any)?.team ?? null, hubspotId: (p as any)?.hubspot_id ?? null }
}
