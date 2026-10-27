// ── Prompt do Sales Ops AI ─────────────────────────────────────────────────────────────────────
// O prompt final = REGRAS FIXAS (como responder: passo a passo, links exatos, não inventar) + PROMPT GERAL (o que o time escreve em Configuração) + BASE DE PROCESSOS
// (um item por processo: o time atualiza só o que mudou). A base vai num bloco com cache de prompt (barato/rápido nas perguntas seguintes); data e nome vão num bloco
// separado, que muda sem invalidar o cache.
import { plainText } from '@/lib/salesops/markdown'

export type Tone = 'didatico' | 'objetivo' | 'descontraido' | 'formal'
export const TONE_LABEL: Record<Tone, string> = { didatico: 'Didático', objetivo: 'Objetivo', descontraido: 'Descontraído', formal: 'Formal' }
export const TONE_RULE: Record<Tone, string> = {
  didatico: 'Tom: didático e paciente. Explique o porquê de cada etapa quando isso evitar erro.',
  objetivo: 'Tom: objetivo e direto. Sem introdução; vá direto aos passos.',
  descontraido: 'Tom: descontraído e próximo, sem perder a precisão técnica.',
  formal: 'Tom: formal e profissional.',
}
export const DEFAULT_MODEL = 'claude-sonnet-4-5'
export const GAP_PHRASE = 'Ainda não tenho esse processo documentado'
export const MAX_MESSAGE_CHARS = 8000

export interface KnowledgeLink { label: string; url: string }
export interface KnowledgeEntry { id: string; title: string; category?: string; content: string; links: KnowledgeLink[]; is_active: boolean; updated_at?: string | null }
export interface SalesOpsSettings { general_prompt: string; tone: Tone; model: string | null; max_tokens: number; suggested_prompts: string[] }
export const DEFAULT_SETTINGS: SalesOpsSettings = { general_prompt: '', tone: 'didatico', model: null, max_tokens: 3500, suggested_prompts: [] }

export const RULES = `Você é o **Sales Ops AI**, o assistente interno do time de Sales Ops da MedReview.
Seu trabalho é documentar e orientar a operação e as partes técnicas do Sales Ops: por exemplo configurar a roleta comercial, alterar fluxos e automações no CRM, criar ofertas, cadastrar e ajustar closers e usuários, entre outros processos.

COMO RESPONDER
- Responda SEMPRE em português brasileiro.
- Baseie-se SOMENTE na BASE DE CONHECIMENTO e nas INSTRUÇÕES DO TIME abaixo. Nunca invente passos, nomes de menus, campos, botões, valores, regras ou URLs.
- Para "como faço X?": entregue um PASSO A PASSO numerado, completo e detalhado: pré-requisitos (acessos, permissões, dados que precisa ter em mãos); cada ação na ordem (onde ir, o que clicar, o que preencher, o que escolher); o resultado esperado quando houver; como VALIDAR que deu certo no final; e os erros comuns e cuidados.
- LINKS: sempre que o processo tiver link na base, coloque-o no passo exato em que ele é usado, em markdown [texto](url), copiando a URL EXATAMENTE como está na base. Nunca crie, complete ou "adivinhe" uma URL.
- Se houver mais de um processo relacionado, cite todos e diga qual usar em cada situação. Se dois trechos da base se contradisserem, aponte a contradição e peça ao time para confirmar e atualizar a base.
- Se a pergunta for ambígua (servir para mais de um processo), faça UMA pergunta curta de esclarecimento, oferecendo as opções.
- Se a base NÃO cobrir a pergunta, escreva exatamente "${GAP_PHRASE}" e não complete com suposições; sugira registrar o processo em Configuração > Processos. Se cobrir só em parte, entregue o que a base tem e deixe claro o que falta.
- Formatação em markdown: títulos curtos, listas numeradas para passos, **negrito** para nomes de menus, botões e campos, e bloco de código apenas para valores ou comandos literais. Seja direto: sem enrolação e sem repetir a pergunta.
- Dados sensíveis: nunca peça nem repita senhas, tokens ou chaves. Se alguém colar uma, avise que ela deve ser trocada.`

const fmtDay = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) }

/** Só os processos ATIVOS, em ordem alfabética de título. */
export function buildKnowledgeText(entries: KnowledgeEntry[]): string {
  const active = entries.filter(e => e.is_active && (e.title?.trim() || e.content?.trim()))
  if (active.length === 0) return 'BASE DE CONHECIMENTO\n(A base ainda está vazia. Diga que ainda não há processos cadastrados e oriente o time a registrá-los em Configuração > Processos.)'
  const parts = [`BASE DE CONHECIMENTO (${active.length} ${active.length === 1 ? 'processo ativo' : 'processos ativos'})`]
  for (const e of [...active].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))) {
    parts.push(`\n## Processo: ${e.title.trim()}${fmtDay(e.updated_at) ? ` (atualizado em ${fmtDay(e.updated_at)})` : ''}\n${(e.content ?? '').trim()}`)
    if (e.links?.length) parts.push(`\nLinks oficiais deste processo:\n${e.links.map(l => `- [${l.label}](${l.url})`).join('\n')}`)
  }
  return parts.join('\n')
}

export interface SystemBlock { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
export function buildSystemBlocks(p: { userName: string; settings: SalesOpsSettings; knowledge: KnowledgeEntry[]; now: Date }): SystemBlock[] {
  const s = p.settings
  const stable = [RULES, TONE_RULE[s.tone] ?? TONE_RULE.didatico, s.general_prompt.trim() ? `INSTRUÇÕES DO TIME (prompt geral)\n${s.general_prompt.trim()}` : '', buildKnowledgeText(p.knowledge)].filter(Boolean).join('\n\n')
  const day = p.now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  return [
    { type: 'text', text: stable, ...(stable.length > 4000 ? { cache_control: { type: 'ephemeral' as const } } : {}) },
    { type: 'text', text: `Hoje é ${day}. Quem está conversando: ${p.userName || 'um superadmin'} (time de Sales Ops).` },
  ]
}

/** Estimativa de tokens (português ≈ 3,4 caracteres por token). */
export const estimateTokens = (text: string) => Math.ceil((text ?? '').length / 3.4)
export function promptStats(settings: SalesOpsSettings, knowledge: KnowledgeEntry[]) {
  const blocks = buildSystemBlocks({ userName: 'x', settings, knowledge, now: new Date(0) })
  const tokens = blocks.reduce((s, b) => s + estimateTokens(b.text), 0)
  return { tokens, chars: blocks.reduce((s, b) => s + b.text.length, 0), activeEntries: knowledge.filter(e => e.is_active).length, totalEntries: knowledge.length, level: tokens > 150_000 ? 'critico' as const : tokens > 60_000 ? 'alto' as const : 'ok' as const }
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** A IA disse que não tem o processo? (a frase vem das regras fixas) */
export const isGapAnswer = (text: string) => norm(text).includes(norm(GAP_PHRASE))

/** Título curto da conversa a partir da 1ª pergunta. */
export function deriveTitle(message: string, max = 60): string {
  const first = plainText(String(message ?? '').trim().split(/\n/)[0] ?? '') || plainText(String(message ?? ''))
  const s = first.replace(/\s+/g, ' ').trim()
  if (!s) return 'Nova conversa'
  if (s.length <= max) return s
  const cut = s.slice(0, max), sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).trim()}…`
}

/** Histórico que vai pra IA: as ÚLTIMAS mensagens (não as primeiras), começando por uma do usuário, sem mensagens vazias e dentro de um limite de tamanho. */
export function sliceHistory(rows: { role: string; content: string }[], maxMessages = 30, maxChars = 60_000): { role: 'user' | 'assistant'; content: string }[] {
  let h = rows.filter(r => (r.role === 'user' || r.role === 'assistant') && String(r.content ?? '').trim() !== '').map(r => ({ role: r.role as 'user' | 'assistant', content: String(r.content) }))
  h = h.slice(-maxMessages)
  let total = h.reduce((s, m) => s + m.content.length, 0)
  while (h.length > 1 && total > maxChars) { total -= h[0].content.length; h.shift() }
  while (h.length > 0 && h[0].role === 'assistant') h.shift()
  return h
}

/** Agrupa as conversas pra lista: Fixadas, Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Mais antigas (dia de São Paulo). */
export function groupConversations<T extends { pinned: boolean; updated_at: string }>(rows: T[], now = new Date()): { label: string; items: T[] }[] {
  const sp = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10)
  const today = sp(now), day = (n: number) => sp(new Date(now.getTime() - n * 86400e3))
  const order = ['Fixadas', 'Hoje', 'Ontem', 'Últimos 7 dias', 'Últimos 30 dias', 'Mais antigas']
  const g: Record<string, T[]> = Object.fromEntries(order.map(o => [o, []]))
  for (const r of rows) {
    const d = sp(new Date(r.updated_at))
    const k = r.pinned ? 'Fixadas' : d === today ? 'Hoje' : d === day(1) ? 'Ontem' : d >= day(7) ? 'Últimos 7 dias' : d >= day(30) ? 'Últimos 30 dias' : 'Mais antigas'
    g[k].push(r)
  }
  return order.filter(o => g[o].length).map(o => ({ label: o, items: g[o] }))
}
