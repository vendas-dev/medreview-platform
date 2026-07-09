import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CopilotChat } from './CopilotChat'

export default async function CopilotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, avatar_url').eq('id', user.id).single()

  const userName    = (profile as any)?.name ?? 'usuário'
  const userAvatarUrl = (profile as any)?.avatar_url ?? null

  const { data: settings } = await supabase
    .from('onboarding_settings')
    .select('welcome_message')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  const welcomeMessage = (settings as any)?.welcome_message
    ?? `Olá, ${userName}! 👋 Sou a Medy, sua assistente de onboarding da MedReview. Como posso te ajudar hoje?`

  const { data: conversations } = await supabase
    .from('onboarding_conversations')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30)

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      <CopilotChat
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        welcomeMessage={welcomeMessage}
        conversations={conversations ?? []}
      />
    </div>
  )
}
