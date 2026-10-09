import { PHASES, RawItem } from './types'
import { extractDates } from './dates'

export interface ExtractInput { society: string; labels: string[]; docUrl: string; docText: string; today: string }
export interface ExtractOutput { items: RawItem[]; notes: string | null }

// Documentos longos: manda o começo + as linhas que têm data (com a linha de contexto antes).
// A VERIFICAÇÃO depois roda contra o texto COMPLETO, então nada se perde.
export function compressForLLM(text: string, maxChars = 45_000): string {
  if (text.length <= maxChars) return text
  const lines = text.split('\n')
  const keep = new Set<number>()
  const looksLikeDate = /\d{1,2}\s*\/\s*\d{1,2}|\d{1,2} de (janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i
  lines.forEach((l, i) => { if (extractDates(l).length > 0 || looksLikeDate.test(l)) { keep.add(i); if (i > 0) keep.add(i - 1) } })
  let out = text.slice(0, 4000), used = out.length
  for (const i of [...keep].sort((a, b) => a - b)) {
    const l = lines[i].trim(); if (!l) continue
    if (used + l.length + 1 > maxChars) break
    out += '\n' + l; used += l.length + 1
  }
  return out
}

export function buildPrompt(i: ExtractInput): { system: string; user: string } {
  const system = `Você extrai datas de provas de título de especialista médico (${i.labels.join(', ')}) de documentos oficiais de sociedades médicas brasileiras.

REGRAS ABSOLUTAS — o resultado vai direto para uma tela usada por vendedores, então erro de data é grave:
1. Extraia SOMENTE datas escritas explicitamente no documento. Nunca deduza, calcule, estime, complete nem use conhecimento externo.
2. Cada item exige "evidence": o trecho LITERAL, copiado caractere por caractere do documento, o MENOR possível, contendo a data (ou o intervalo) DAQUELE item e de mais nenhum outro. Não resuma, não reescreva, não junte linhas, não traduza.
3. A data só vale se o próprio trecho citado escreve DIA, MÊS e ANO (ex.: "13 a 30/10/2026"). Se o ano não está no trecho, NÃO inclua o item.
4. Inclua apenas as provas da lista: ${i.labels.join(', ')}. Ignore congressos, webinars, cursos, aulas e qualquer outro evento.
5. Se o documento traz errata ou comunicado que ALTERA datas, use as datas mais recentes e registre isso em "notes".
6. Se não houver nenhuma data dessas provas, devolva {"items": []}.

Responda SOMENTE com JSON válido, sem texto fora dele:
{"items":[{"exam_label":"<uma da lista>","phase":"<etapa>","title":"<nome curto da etapa>","starts_on":"AAAA-MM-DD","ends_on":"AAAA-MM-DD ou null","evidence":"<trecho literal>"}],"notes":"<observação ou null>"}

"phase" deve ser exatamente uma de: ${PHASES.join(' | ')}.
Intervalo ("13 a 30/10/2026"): starts_on = primeiro dia, ends_on = último dia. Data única: ends_on = null.`
  const user = `Hoje é ${i.today}. Sociedade: ${i.society}. Documento lido: ${i.docUrl}\n\n<documento>\n${compressForLLM(i.docText)}\n</documento>`
  return { system, user }
}

export function parseExtraction(content: string): ExtractOutput {
  const cleaned = content.replace(/```json|```/gi, '').trim()
  const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('resposta da IA sem JSON')
  const j = JSON.parse(cleaned.slice(a, b + 1))
  const items: RawItem[] = Array.isArray(j?.items) ? j.items.map((x: any) => ({
    exam_label: String(x?.exam_label ?? ''), phase: String(x?.phase ?? ''), title: String(x?.title ?? ''),
    starts_on: String(x?.starts_on ?? ''), ends_on: x?.ends_on == null || x.ends_on === 'null' ? null : String(x.ends_on),
    evidence: String(x?.evidence ?? ''),
  })) : []
  return { items, notes: typeof j?.notes === 'string' && j.notes.trim() ? j.notes.trim() : null }
}

export interface ClaudeDeps { fetchImpl?: typeof fetch; apiKey?: string; model?: string }

export async function extractWithClaude(input: ExtractInput, deps: ClaudeDeps = {}): Promise<ExtractOutput> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')
  const { system, user } = buildPrompt(input)
  const res = await (deps.fetchImpl ?? fetch)('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: deps.model ?? process.env.EXAMS_AI_MODEL ?? 'claude-sonnet-4-5', max_tokens: 3000, temperature: 0, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(55_000),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const text = (data?.content ?? []).filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('\n')
  return parseExtraction(text)
}
