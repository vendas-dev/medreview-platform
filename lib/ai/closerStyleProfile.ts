// ── Perfil de estilo por closer ──────────────────────────────────
// Em vez de guardar (ou reenviar) a conversa inteira de meses atrás, isso
// mantém um RESUMO curto e sempre atualizado — o mesmo padrão de cache já
// usado pelos insights diários do Dashboard (ensureDailyInsights): busca o
// que já existe, e só gera de novo se estiver "velho" (mais de 24h) e
// tiver mensagem nova o suficiente pra valer a pena.

const STALE_AFTER_MS = 24 * 60 * 60 * 1000 // 24h
const MIN_MESSAGES_TO_GENERATE = 5
const MAX_MESSAGES_SAMPLE = 40

export async function ensureCloserStyleProfile(supabase: any, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('closer_ai_profile').select('style_summary, updated_at').eq('user_id', userId).maybeSingle()

  const isStale = !existing || (Date.now() - new Date(existing.updated_at).getTime() > STALE_AFTER_MS)
  if (existing?.style_summary && !isStale) return existing.style_summary

  // Mensagens do PRÓPRIO closer (não da Medy), das conversas dele com o
  // chat geral — é a fonte mais rica de "como essa pessoa se comunica"
  // que já temos persistida hoje.
  const { data: convs } = await supabase
    .from('onboarding_conversations').select('id').eq('user_id', userId)
  const convIds = (convs ?? []).map((c: any) => c.id)
  if (convIds.length === 0) return existing?.style_summary ?? ''

  const { data: msgs } = await supabase
    .from('onboarding_messages')
    .select('content, created_at')
    .in('conversation_id', convIds)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(MAX_MESSAGES_SAMPLE)

  const userMessages = (msgs ?? []).map((m: any) => m.content).filter(Boolean)
  if (userMessages.length < MIN_MESSAGES_TO_GENERATE) return existing?.style_summary ?? ''

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return existing?.style_summary ?? ''

  const prompt = `Analise essas mensagens de um closer de vendas conversando com uma assistente de IA (Medy), e escreva um resumo curto (3 a 5 frases, direto, sem listar regras) sobre:
- Tom de comunicação dele (formal/informal, direto/detalhista, usa emoji ou não)
- Que tipo de situação ele mais traz (objeções comuns, dúvidas recorrentes, tipo de lead que mais atende)
- Qualquer padrão de preferência perceptível (ex: prefere respostas curtas, gosta de exemplos prontos, etc)

Não cite trechos literais das mensagens — é um resumo de padrão, não uma transcrição.

Mensagens do closer (mais recentes primeiro):
${userMessages.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 350, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return existing?.style_summary ?? ''
    const data = await res.json()
    const summary = data.content?.find((b: any) => b.type === 'text')?.text?.trim()
    if (!summary) return existing?.style_summary ?? ''

    await supabase.from('closer_ai_profile')
      .upsert({ user_id: userId, style_summary: summary, updated_at: new Date().toISOString() })

    return summary
  } catch {
    return existing?.style_summary ?? ''
  }
}
