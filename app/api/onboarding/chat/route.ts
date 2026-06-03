import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message, conversationId } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    // Perfil do usuário
    const { data: profile } = await supabase
      .from('profiles').select('name, team').eq('id', user.id).single()
    const userTeam = (profile as any)?.team
    const userName = (profile as any)?.name ?? 'colaborador'

    // Configurações do Copilot
    const { data: settings } = await supabase
      .from('onboarding_settings').select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001').single()

    // Conteúdo da trilha filtrado pelo time
    const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']
    const { data: steps } = await supabase
      .from('onboarding_steps')
      .select(`id, title, description, team,
        onboarding_faqs(question, answer),
        onboarding_materials(title, description, url, type)`)
      .eq('is_active', true)
      .in('team', teamFilter)
      .order('order_index')

    // Histórico da conversa
    let convId = conversationId
    if (!convId) {
      const { data: conv } = await supabase
        .from('onboarding_conversations').insert({
          user_id: user.id,
          title: message.substring(0, 50),
        }).select().single()
      convId = (conv as any)?.id
    }

    const { data: history } = await supabase
      .from('onboarding_messages').select('role, content')
      .eq('conversation_id', convId)
      .order('created_at').limit(20)

    // Monta base de conhecimento
    const toneMap: Record<string, string> = {
      didatico:     'Seja didático, acolhedor e paciente. Explique com exemplos.',
      objetivo:     'Seja objetivo e direto ao ponto.',
      descontraido: 'Seja descontraído, amigável e motivador.',
      formal:       'Seja formal e profissional.',
    }
    const tone = toneMap[(settings as any)?.tone ?? 'didatico']
    const extra = (settings as any)?.extra_instructions ?? ''

    const hasContent = steps && steps.length > 0
    const knowledgeBase = hasContent
      ? steps.map((s: any) => `
## ${s.title}
${s.description ?? ''}
FAQs: ${s.onboarding_faqs?.map((f: any) => `\nP: ${f.question}\nR: ${f.answer}`).join('') ?? 'Nenhuma'}
Materiais: ${s.onboarding_materials?.map((m: any) => `\n- ${m.title}: ${m.url}`).join('') ?? 'Nenhum'}
`).join('\n---\n')
      : 'Ainda não há conteúdo cadastrado na trilha de onboarding.'

    const systemPrompt = `Você é o Copilot de Onboarding da MedReview.
Você está conversando com ${userName}${userTeam ? ` do time ${userTeam}` : ''}.
${tone}
${extra ? `\nInstruções da empresa:\n${extra}` : ''}

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Use apenas o conteúdo abaixo como base de conhecimento
- Se não tiver a informação, diga "Ainda não tenho essa informação cadastrada. Sugiro perguntar ao seu supervisor."
- Nunca invente informações
- Seja sempre útil e encorajador

BASE DE CONHECIMENTO:
${knowledgeBase}`

    // Salva mensagem do usuário
    await supabase.from('onboarding_messages').insert({
      conversation_id: convId, role: 'user', content: message,
    })

    // Monta histórico para a API
    const messages = [
      ...(history?.map((h: any) => ({ role: h.role, content: h.content })) ?? []),
      { role: 'user' as const, content: message },
    ]

    // Chama Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic error:', errText)
      throw new Error('Anthropic API error')
    }

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text ?? 'Desculpe, não consegui processar sua pergunta. Tente novamente.'

    // Salva resposta
    await supabase.from('onboarding_messages').insert({
      conversation_id: convId, role: 'assistant', content: assistantMessage,
    })

    return NextResponse.json({ message: assistantMessage, conversationId: convId })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({
      message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.',
      conversationId: null,
    })
  }
}
