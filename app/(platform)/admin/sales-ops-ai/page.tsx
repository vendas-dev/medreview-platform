import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hListConversations, hGetSettings, hGaps } from '@/lib/salesops/handlers'
import { SalesOpsAI } from './SalesOpsAI'

export const dynamic = 'force-dynamic'

// /admin/sales-ops-ai — só superadmin. Carrega as conversas DO PRÓPRIO usuário, os ajustes (perguntas sugeridas) e a contagem de lacunas.
export default async function SalesOpsAIPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'superadmin') redirect('/dashboard')

  const admin = createAdminClient()
  const [convs, settings, gaps] = await Promise.all([hListConversations(admin, user.id, { limit: 40 }), hGetSettings(admin), hGaps(admin)])
  if (convs.status !== 200) {
    return (
      <div style={{ padding: 32, maxWidth: 640, margin: '40px auto', border: '1px solid var(--border)', borderRadius: 18, background: 'var(--card)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: 'var(--foreground)' }}>Sales Ops AI: falta preparar o banco</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--muted-foreground)' }}>As tabelas ainda não existem. Rode o arquivo <code>migration-sales-ops-ai.sql</code> no SQL Editor do Supabase e recarregue esta página.</p>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Detalhe técnico: {String(convs.json?.error ?? '')}</p>
      </div>
    )
  }
  return <SalesOpsAI initialConversations={convs.json.conversations} suggested={settings.json?.settings?.suggested_prompts ?? []} initialGapCount={gaps.json?.gaps?.length ?? 0} />
}
