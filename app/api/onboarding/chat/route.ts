import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { ensureCloserStyleProfile } from '@/lib/ai/closerStyleProfile'

// ── Acervo (Labs) — ferramentas que a Medy pode acionar sozinha ────────
// Credencial de SERVIDOR (nunca no navegador) — lida de MRV_TOKEN, uma
// variável de ambiente cadastrada no Vercel. Nunca logamos nem devolvemos
// esse valor em nenhuma resposta.
const MRV_BASE = 'https://api.grupomedreview.com.br'
const ALLOWED_VERTICALS = ['oft_review', 'anestreview', 'ortopreview', 'medreview'] as const

// ── Verticais permitidas por time — regra dura, não sugestão de prompt.
// Time OAO vende Anest/Oft/Ortop-Review; time R1 vende só Med-Review R1.
// Sem time definido (ou superadmin conversando) não trava nada, tem acesso
// a todas — só closer com time certo entra na restrição.
function allowedVerticalsForTeam(team: string | null | undefined): string[] {
  if (team === 'R1')  return ['medreview']
  if (team === 'OAO') return ['oft_review', 'anestreview', 'ortopreview']
  return [...ALLOWED_VERTICALS]
}

// Só os endpoints úteis pra responder pergunta de closer/lead sobre o
// conteúdo dos cursos. Deixados de fora, de propósito:
// - /aulas/rascunhos — conteúdo não publicado, só pra quem cataloga
// - /me e /health — diagnóstico da credencial, não é conteúdo do acervo
//
// Recebe as verticais permitidas do closer e já restringe o ENUM do
// schema — o Claude nem consegue tentar pedir uma vertical fora do time
// dele, porque ela não existe como opção válida na ferramenta.
function buildLabsTools(allowedVerticals: string[]) {
  const vEnum = allowedVerticals.length > 0 ? allowedVerticals : [...ALLOWED_VERTICALS]
  const verticalProp = { type: 'array', items: { type: 'string', enum: vEnum }, description: 'Uma ou mais verticais — sempre obrigatório. Só as do seu próprio time estão disponíveis aqui.' }

  return [
    {
      name: 'labs_buscar_cursos',
      description: 'Lista o catálogo de cursos publicados no acervo da Med-Review, filtrado por vertical.',
      input_schema: { type: 'object', properties: { vertical: verticalProp }, required: ['vertical'] },
    },
    {
      name: 'labs_buscar_modulos',
      description: 'Lista os módulos de curso(s) publicado(s). Use curso_id pra restringir a um curso específico (pegue o id em labs_buscar_cursos).',
      input_schema: { type: 'object', properties: { vertical: verticalProp, curso_id: { type: 'string', description: 'Opcional — id do curso pra filtrar os módulos.' } }, required: ['vertical'] },
    },
    {
      name: 'labs_buscar_aulas',
      description: 'Lista aulas PUBLICADAS do acervo — vertical, curso, módulo, ordem, duração, id do vídeo e data de publicação. Use curso_id e/ou modulo_id pra restringir a busca.',
      input_schema: { type: 'object', properties: { vertical: verticalProp, curso_id: { type: 'string' }, modulo_id: { type: 'string' } }, required: ['vertical'] },
    },
    {
      name: 'labs_detalhe_aula',
      description: 'Detalhe completo de UMA aula publicada específica, pelo id (pegue o id em labs_buscar_aulas).',
      input_schema: { type: 'object', properties: { vertical: verticalProp, aula_id: { type: 'string' } }, required: ['vertical', 'aula_id'] },
    },
    {
      name: 'labs_transcricao_aula',
      description: 'Texto integral (transcrição) de uma aula publicada, em trechos com marcação de tempo — use quando precisar saber se um assunto específico é falado dentro da aula.',
      input_schema: { type: 'object', properties: { vertical: verticalProp, aula_id: { type: 'string' } }, required: ['vertical', 'aula_id'] },
    },
    {
      name: 'labs_buscar_materiais',
      description: 'Apostilas e PDFs anexados a aulas publicadas, com link de download.',
      input_schema: { type: 'object', properties: { vertical: verticalProp, aula_id: { type: 'string', description: 'Opcional — filtra materiais de uma aula específica.' } }, required: ['vertical'] },
    },
    {
      name: 'labs_buscar_filtros',
      description: 'Lista os filtros disponíveis (tema, subtema, prova, tipo) pra montar uma busca refinada em labs_buscar_questoes. Use antes de buscar questões se não souber os valores válidos.',
      input_schema: { type: 'object', properties: { vertical: verticalProp }, required: ['vertical'] },
    },
    {
      name: 'labs_buscar_questoes',
      description: 'Banco de questões comentadas — enunciado, alternativas, gabarito e comentário do professor, com tema, subtema, prova e tipo.',
      input_schema: { type: 'object', properties: { vertical: verticalProp, tema: { type: 'string' }, subtema: { type: 'string' }, prova: { type: 'string' }, tipo: { type: 'string' } }, required: ['vertical'] },
    },
    {
      name: 'labs_detalhe_questao',
      description: 'Detalhe completo de UMA questão específica do banco, pelo id (pegue o id em labs_buscar_questoes).',
      input_schema: { type: 'object', properties: { vertical: verticalProp, questao_id: { type: 'string' } }, required: ['vertical', 'questao_id'] },
    },
  ]
}

// Traduz o nome da ferramenta + input pro path/params reais da API
function labsToolRequest(name: string, input: any): { path: string; params: Record<string, any> } | null {
  const vertical = Array.isArray(input?.vertical) ? input.vertical : []
  switch (name) {
    case 'labs_buscar_cursos':    return { path: '/api/labs/cursos',    params: { vertical } }
    case 'labs_buscar_modulos':   return { path: '/api/labs/modulos',   params: { vertical, curso: input.curso_id } }
    case 'labs_buscar_aulas':     return { path: '/api/labs/aulas',     params: { vertical, curso: input.curso_id, modulo: input.modulo_id } }
    case 'labs_detalhe_aula':     return { path: `/api/labs/aulas/${encodeURIComponent(input.aula_id ?? '')}`, params: { vertical } }
    case 'labs_transcricao_aula': return { path: `/api/labs/aulas/${encodeURIComponent(input.aula_id ?? '')}/transcricao`, params: { vertical } }
    case 'labs_buscar_materiais': return { path: '/api/labs/materiais', params: { vertical, aula: input.aula_id } }
    case 'labs_buscar_filtros':   return { path: '/api/labs/filtros',   params: { vertical } }
    case 'labs_buscar_questoes':  return { path: '/api/labs/questoes',  params: { vertical, tema: input.tema, subtema: input.subtema, prova: input.prova, tipo: input.tipo } }
    case 'labs_detalhe_questao':  return { path: `/api/labs/questoes/${encodeURIComponent(input.questao_id ?? '')}`, params: { vertical } }
    default: return null
  }
}

// Executa a chamada de verdade ao Acervo — trata 401/403/429 exatamente
// como o guia do TI orienta: 401 e 403 nunca se resolvem tentando de novo
// (avisa e para); 429 espera uma vez, sem laço apertado, e desiste com
// uma mensagem clara se persistir.
async function callLabsApi(path: string, params: Record<string, any>, allowedVerticals: string[]): Promise<any> {
  const token = process.env.MRV_TOKEN
  if (!token) return { erro: 'A integração com o Acervo ainda não foi configurada neste servidor (falta a credencial). Avise o administrador do sistema.' }

  let vertical: string[] = Array.isArray(params.vertical) ? params.vertical.filter(Boolean) : []
  if (vertical.length === 0) return { erro: 'Não foi informada nenhuma vertical válida — é obrigatório pra consultar o Acervo. Pergunte ao usuário qual vertical antes de tentar de novo.' }

  // Trava de verdade — mesmo que o schema já restrinja o enum, confere de
  // novo aqui antes de sair pro Acervo. Fora do escopo do time do closer
  // nunca sai daqui, não é um erro de tentar de outro jeito.
  const foraDoEscopo = vertical.filter(v => !allowedVerticals.includes(v))
  vertical = vertical.filter(v => allowedVerticals.includes(v))
  if (vertical.length === 0) {
    return { erro: `A vertical pedida (${foraDoEscopo.join(', ')}) não faz parte do time deste closer. Ele só tem acesso a: ${allowedVerticals.join(', ')}. Explique isso e não tente de novo com essa vertical.` }
  }
  params = { ...params, vertical }

  const url = new URL(`${MRV_BASE}${path}`)
  vertical.forEach(v => url.searchParams.append('vertical[]', v))
  Object.entries(params).forEach(([k, v]) => {
    if (k === 'vertical' || v === undefined || v === null || v === '') return
    url.searchParams.set(k, String(v))
  })

  const doFetch = () => fetch(url.toString(), { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })

  let res: Response
  try {
    res = await doFetch()
  } catch {
    return { erro: 'Não consegui conectar ao Acervo agora. Tente de novo em instantes.' }
  }

  if (res.status === 401) return { erro: 'A credencial de acesso ao Acervo expirou ou é inválida. Isso não se resolve tentando de novo — avise o administrador pra renovar a credencial.' }
  if (res.status === 403) return { erro: 'Esse recurso do Acervo não está liberado pro escopo aprovado desta integração. Não é um erro pra tentar de outro jeito — avise o administrador pra pedir ampliação de acesso à TI.' }

  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2500)) // uma única espera, sem laço apertado
    try { res = await doFetch() } catch { return { erro: 'O Acervo está sem resposta no momento. Tente de novo em instantes.' } }
    if (res.status === 429) return { erro: 'O Acervo está recebendo muitas consultas agora (limite de 30 por minuto). Avise o usuário que a informação pode demorar um pouco mais — não insista chamando de novo imediatamente.' }
  }

  if (!res.ok) return { erro: `O Acervo respondeu com um erro inesperado (${res.status}). Tente novamente em instantes.` }

  try { return await res.json() } catch { return { erro: 'A resposta do Acervo veio num formato inesperado.' } }
}

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
    const allowedVerticals = allowedVerticalsForTeam(userTeam)
    const styleSummary = await ensureCloserStyleProfile(supabase, user.id)

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
${styleSummary ? `\nCOMO ESSE CLOSER SE COMUNICA (aprendido de conversas anteriores dele — adapte seu tom e nível de detalhe a isso, sem mencionar explicitamente que está seguindo esse perfil):\n${styleSummary}` : ''}

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Use apenas o conteúdo abaixo como base
- Quando houver um vídeo ou material RELACIONADO à pergunta, SEMPRE cite-o e indique onde acessar
- Formato para citar material: "📎 Para saber mais, temos o material **[Nome]** na Trilha > [Etapa]"
- Formato para citar vídeo: "🎬 Temos o vídeo **[Nome]** disponível na Biblioteca de Videoaulas — vale a pena assistir!"
- Se não souber, diga: "Ainda não tenho essa informação. Recomendo perguntar ao seu supervisor."
- Nunca invente informações
- Seja sempre útil e encorajador
- Ao consultar o Acervo (ferramentas labs_*), esse closer só tem acesso às verticais: ${allowedVerticals.join(', ')} — nunca tente outra, e se ele pedir algo de uma vertical fora dessa lista, explique que não está no escopo do time dele
- Ao buscar se um ASSUNTO existe no acervo (ex: "tem aula sobre X?"), comece pelo caminho mais barato: confira primeiro os NOMES de curso/módulo/aula (labs_buscar_cursos, labs_buscar_modulos, labs_buscar_aulas) — muitas vezes o nome já responde. Só abra labs_transcricao_aula quando o nome não for suficiente pra confirmar (ex: assunto que pode estar mencionado dentro de uma aula com outro título). Isso evita gastar muitas rodadas de busca numa pergunta simples.
- MAS depois de confirmar que existe, NUNCA pare numa resposta vaga tipo "sim, tem aula sobre isso, quer saber mais?" — isso obriga o closer a fazer mais uma pergunta à toa. Assim que achar o item certo, busque o detalhe dele (labs_detalhe_aula, labs_transcricao_aula quando ajudar, labs_buscar_materiais, labs_detalhe_questao) e já entregue uma resposta rica na mesma mensagem: do que trata a aula/questão, pontos principais, duração, curso/módulo onde está, gabarito e comentário (se for questão), link de material se houver. O closer precisa da informação pronta pra repassar ao lead, não de uma confirmação que só adia a resposta de verdade.

BASE DE CONHECIMENTO COMPLETA:
${knowledgeBase}
${avulsosText}`

    await supabase.from('onboarding_messages').insert({ conversation_id: convId, role: 'user', content: message })

    const messages: any[] = [
      ...(history?.map((h: any) => ({ role: h.role, content: h.content })) ?? []),
      { role: 'user' as const, content: message },
    ]

    // ── Loop de tool use — o Claude pode pedir pra consultar o Acervo
    // (uma ou várias vezes seguidas, ex: achar o curso → achar a aula
    // dentro dele) antes de dar a resposta final em texto. Um teto de
    // rodadas evita loop infinito se algo sair muito fora do esperado.
    // Perguntas tipo "tem X em algum curso da vertical Y" podem precisar
    // checar vários cursos/módulos em sequência — por isso o teto é
    // generoso (10), e mesmo assim, se estourar, a última rodada força uma
    // resposta de texto (sem tools) em vez de simplesmente desistir com
    // uma mensagem genérica — o Claude sempre tem ALGO útil já apurado
    // até ali, mesmo que não tenha varrido 100% dos cursos.
    let assistantMessage = 'Não consegui processar sua pergunta.'
    const MAX_TOOL_ROUNDS = 10

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS - 1
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5', max_tokens: 1800, system: systemPrompt, messages,
          // Na última rodada permitida, tira as ferramentas de propósito —
          // isso força o Claude a responder em texto com o que já tem,
          // em vez de pedir mais uma consulta e nunca fechar a resposta.
          ...(isLastRound ? {} : { tools: buildLabsTools(allowedVerticals) }),
        }),
      })

      if (!response.ok) throw new Error(`Anthropic ${response.status}`)
      const data = await response.json()

      const toolUseBlocks = (data.content ?? []).filter((b: any) => b.type === 'tool_use')

      // Sem pedido de ferramenta — essa é a resposta final
      if (toolUseBlocks.length === 0) {
        const textBlock = (data.content ?? []).find((b: any) => b.type === 'text')
        assistantMessage = textBlock?.text ?? assistantMessage
        break
      }

      if (isLastRound) break // não deveria ter tool_use aqui (sem tools disponíveis), mas por segurança

      // Executa cada ferramenta pedida (em paralelo, já que são só leituras)
      const toolResults = await Promise.all(toolUseBlocks.map(async (block: any) => {
        const req = labsToolRequest(block.name, block.input)
        const result = req ? await callLabsApi(req.path, req.params, allowedVerticals) : { erro: `Ferramenta desconhecida: ${block.name}` }
        return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) }
      }))

      // Adiciona a resposta do Claude (com o pedido de ferramenta) e os
      // resultados, e faz mais uma rodada
      messages.push({ role: 'assistant', content: data.content })
      messages.push({ role: 'user', content: toolResults })
    }

    await supabase.from('onboarding_messages').insert({ conversation_id: convId, role: 'assistant', content: assistantMessage })

    return NextResponse.json({ message: assistantMessage, conversationId: convId })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ message: 'Erro ao processar sua mensagem. Tente novamente.', conversationId: null })
  }
}
