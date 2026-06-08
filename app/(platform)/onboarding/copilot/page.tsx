import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CopilotChat } from './CopilotChat'

export default async function CopilotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, team').eq('id', user.id).single()

  // Histórico de conversas
  const { data: conversations } = await supabase
    .from('onboarding_conversations')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  // Boas-vindas
  const { data: settings } = await supabase
    .from('onboarding_settings').select('welcome_message')
    .eq('id', '00000000-0000-0000-0000-000000000001').single()

  return (
    <CopilotChat
      userName={(profile as any)?.name ?? 'usuário'}
      welcomeMessage={(settings as any)?.welcome_message ?? 'Olá! Bem-vindo ao Copilot de Onboarding!'}
      conversations={conversations ?? []}
    />
  )
}
