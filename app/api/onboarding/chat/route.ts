import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message, conversationId } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: 'O Copilot ainda não foi configurado. O administrador precisa adicionar a chave ANTHROPIC_API_KEY.', conversationId: null })
    }

    const { data: profile } = await supabase.from('profiles').select('name, team').eq('id', user.id).single()
    const userTeam = (profile as any)?.team
    const userName = (profile as any)?.name ?? 'colaborador'

    const { data: settings } = await supabase
      .from('onboarding_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single()

    const teamFilter = userTeam ? [userTeam, 'ambos'] : ['ambos']

    // Busca etapas com materiais, FAQs e vídeos
    const { data: steps } = await supabase
      .from('onboarding_steps')
      .select(`id, title, description, day_number, team,
        onboarding_faqs(question, answer),
        onboarding_materials(id, title, description, url, type)`)
      .eq('is_active', true).in('team', teamFilter).order('order_index')

    // Busca vídeos avulsos
    const { data: avulsos } = await supabase
      .from('onboarding_videos')
      .select('id, title, description, url, team')
      .eq('is_active', true).in('team', teamFilter)

    // Histórico
    let convId = conversationId
    if (!convId) {
      const { data: conv } = await supabase
        .from('onboarding_conversations').insert({ user_id: user.id, title: message.substring(0, 50) }).select().single()
      convId = (conv as any)?.id
    }
    const { data: history } = await supabase
      .from('onboarding_messages').select('role, content').eq('conversation_id', convId).order('created_at').limit(20)

    const toneMap: Record<string, string> = {
      didatico:     'Seja didático, acolhedor e paciente. Explique com exemplos práticos.',
      objetivo:     'Seja objetivo e direto ao ponto. Respostas concisas.',
      descontraido: 'Seja descontraído, amigável e motivador. Use linguagem informal.',
      formal:       'Seja formal e profissional.',
    }
    const tone = toneMap[(settings as any)?.tone ?? 'didatico']
    const extra = (settings as any)?.extra_instructions ?? ''

    // Monta base de conhecimento COMPLETA com materiais e vídeos
    const knowledgeBase = steps?.map((s: any) => {
      const materials = s.onboarding_materials ?? []
      const videos = materials.filter((m: any) => m.type === 'video')
      const docs = materials.filter((m: any) => m.type !== 'video')
      const faqs = s.onboarding_faqs ?? []

      return `
## ${s.day_number ? `[Dia ${s.day_number}] ` : ''}Etapa: ${s.title}
${s.description ?? ''}

${faqs.length > 0 ? `### Perguntas frequentes desta etapa:
${faqs.map((f: any) => `❓ ${f.question}\n✅ ${f.answer}`).join('\n\n')}` : ''}

${videos.length > 0 ? `### Vídeos disponíveis nesta etapa:
${videos.map((v: any) => `🎬 **${v.title}**${v.description ? ` — ${v.description}` : ''}\n   Acesse em: Trilha > ${s.title} (ou na Biblioteca de Videoaulas)`).join('\n')}` : ''}

${docs.length > 0 ? `### Materiais e documentos desta etapa:
${docs.map((d: any) => `📎 **${d.title}** (${d.type})${d.description ? ` — ${d.description}` : ''}`).join('\n')}` : ''}
`}).join('\n---\n') ?? ''

    // Vídeos avulsos na base
    const avulsosText = avulsos && avulsos.length > 0
      ? `\n## Videoaulas extras disponíveis:\n${avulsos.map((v: any) => `🎬 **${v.title}**${v.description ? ` — ${v.description}` : ''}\n   Acesse em: Onboarding > Videoaulas`).join('\n')}`
      : ''

    const systemPrompt = `Você é o Copilot de Onboarding da MedReview.
Está conversando com ${userName}${userTeam ? ` do time ${userTeam}` : ''}.
${tone}
${extra ? `\nInstruções da empresa:\n${extra}` : ''}

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Use apenas o conteúdo abaixo como base
- Quando houver um vídeo ou material RELACIONADO à pergunta, SEMPRE cite-o e indique onde acessar
- Formato para citar material: "📎 Para saber mais, temos o material **[Nome]** na Trilha > [Etapa]"
- Formato para citar vídeo: "🎬 Temos o vídeo **[Nome]** disponível na Biblioteca de Videoaulas — vale a pena assistir!"
- Se não souber, diga: "Ainda não tenho essa informação. Recomendo perguntar ao seu supervisor."
- Nunca invente informações
- Seja sempre útil e encorajador

BASE DE CONHECIMENTO COMPLETA:
${knowledgeBase}
${avulsosText}`

    await supabase.from('onboarding_messages').insert({ conversation_id: convId, role: 'user', content: message })

    const messages = [
      ...(history?.map((h: any) => ({ role: h.role, content: h.content })) ?? []),
      { role: 'user' as const, content: message },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1500, system: systemPrompt, messages }),
    })

    if (!response.ok) throw new Error(`Anthropic ${response.status}`)

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text ?? 'Não consegui processar sua pergunta.'

    await supabase.from('onboarding_messages').insert({ conversation_id: convId, role: 'assistant', content: assistantMessage })

    return NextResponse.json({ message: assistantMessage, conversationId: convId })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ message: 'Erro ao processar sua mensagem. Tente novamente.', conversationId: null })
  }
}
