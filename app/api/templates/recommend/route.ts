import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Contexto fixo sobre as verticais — a Medy precisa saber quem é o público
// de cada uma pra interpretar a situação que o closer descrever (ex: "lead
// disse que já é R2" só faz sentido pra quem entende o que isso significa
// em cada prova/vertical).
const VERTICAL_CONTEXT = [
  '- Med-Review R1: preparação para RESIDÊNCIA MÉDICA e ENAMED. Público: estudantes de medicina formandos/recém-formados se preparando pra provas de residência médica.',
  '- Anest-Review: preparação para TEA e TSA (provas da SBA — Sociedade Brasileira de Anestesiologia). Público: médicos residentes/especializandos em anestesiologia.',
  '- Oft-Review: preparação para CBO (prova de título de oftalmologia). Público: médicos residentes/especializandos em oftalmologia.',
  '- Ortop-Review: preparação para TEOT (prova de título de ortopedia). Público: médicos residentes/especializandos em ortopedia.',
].join('\n')

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history, templates } = await req.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 })
  }
  if (!Array.isArray(templates)) {
    return NextResponse.json({ error: 'templates é obrigatório' }, { status: 400 })
  }

  // Catálogo compacto (sem o conteúdo completo, só o essencial pra decidir)
  // — mantém o prompt leve mesmo com centenas de templates.
  const catalog = templates.map((t: any) =>
    `[${t.id}] "${t.name}" — categoria: ${t.categoria ?? '—'} · vertical: ${(t.vertical ?? []).join(', ') || '—'} · time: ${t.team === 'ambos' ? 'Ambos' : t.team} · validade: ${t.validade ?? '—'}${t.utilidade ? ` · quando usar: ${t.utilidade}` : ''}`
  ).join('\n')

  const systemPrompt = [
    'Você é a Medy, assistente de IA da MedReview (plataforma de preparação para médicos: residência médica e provas de título/certificação).',
    'Aqui, seu papel é ser uma COACH DE VENDAS experiente para o time comercial: o closer descreve uma situação com um lead ou cliente, e você recomenda',
    'qual copy (template) da biblioteca abaixo faz mais sentido enviar — e explica o porquê em poucas frases, como alguém que realmente entende de vendas',
    'consultivas para médicos.',
    '',
    'Contexto sobre o público-alvo de cada vertical (use isso pra interpretar a situação descrita):',
    VERTICAL_CONTEXT,
    '',
    'Regras importantes:',
    '- Recomende SOMENTE templates que estão na lista abaixo, usando o ID exato entre colchetes. Nunca invente um template que não existe na lista.',
    '- Escolha entre 1 e 3 templates que melhor encaixam na situação. Se só um encaixar bem, recomende só esse.',
    '- Seja específico no motivo: cite o que na situação descrita conecta com aquele template (categoria, momento do funil, objeção, etc), não uma justificativa genérica.',
    '- Se a conversa já tiver mensagens anteriores, mantenha contexto (o closer pode estar refinando o pedido, ex: "mas ele já é ex-aluno").',
    '- Se nada da lista encaixar bem, devolva templateIds vazio e explique isso no reply, sugerindo o que descrever melhor pra você achar algo.',
    '- reply deve ser curto (até ~60 palavras), natural, em português, tom de coach — não de robô listando regras.',
    '',
    'Responda APENAS com um JSON puro (sem markdown, sem texto fora do JSON), neste formato exato:',
    '{"reply": "sua explicação aqui", "templateIds": ["id1", "id2"]}',
    '',
    `Templates disponíveis (${templates.length} no total):`,
    catalog,
  ].join('\n')

  const conversationMessages = [
    ...(Array.isArray(history) ? history.slice(-8).map((h: any) => ({ role: h.role, content: h.content })) : []),
    { role: 'user', content: message },
  ]

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: conversationMessages,
      }),
    })
    const data = await res.json()
    let raw = data.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? ''
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) raw = match[0]
    const parsed = JSON.parse(raw)

    // Filtra IDs que a IA "alucinou" e não existem de verdade na lista —
    // proteção extra além do prompt já pedir pra não inventar.
    const validIds = new Set(templates.map((t: any) => t.id))
    const templateIds = (Array.isArray(parsed.templateIds) ? parsed.templateIds : []).filter((id: string) => validIds.has(id))

    return NextResponse.json({
      reply: parsed.reply ?? 'Não consegui pensar em uma recomendação agora. Tenta descrever de outro jeito?',
      templateIds,
    })
  } catch (err) {
    return NextResponse.json({
      reply: 'Tive um problema pra pensar nisso agora. Tenta de novo em instantes.',
      templateIds: [],
    })
  }
}
