'use server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getDb() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((p as any)?.role !== 'superadmin') throw new Error('Sem permissão')
  return createAdminClient()
}

export async function updateMaterial(payload: {
  id: string; title: string; description: string | null
  url: string; type: string; step_id: string
}): Promise<{ ok: boolean; material: any }> {
  const db = await getDb()
  const { data, error } = await db
    .from('onboarding_materials')
    .update({
      title:       payload.title.trim(),
      description: payload.description,
      url:         payload.url.trim(),
      type:        payload.type,
      step_id:     payload.step_id,
    })
    .eq('id', payload.id)
    .select('*')
    .single()

  if (error) throw new Error('Erro ao salvar material: ' + error.message)
  if (!data)  throw new Error('Material não encontrado')
  return { ok: true, material: data }
}
