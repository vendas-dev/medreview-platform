import type { CampaignDraft } from './types'

// ══ Campanha de EVENTO — só os closers escolhidos concorrem (e só eles são avisados) ═══════════════════════
// É a MESMA campanha de sempre (qualquer critério), só que a lista de participantes deixa de ser "o time inteiro" e passa a ser
// "as pessoas que vão ao evento". Guardado em campaigns.event (jsonb): { name, closers: [profile_id…] }.

export const EVENT_MAX_CLOSERS = 60
export const EVENT_NAME_MAX = 60
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface EventCfg { name: string; closers: string[] }

/** Lê o que vier (banco ou tela) e devolve só o que vale. null = campanha normal (o time todo). */
export function cleanEvent(raw: unknown): EventCfg | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as any
  const ids = Array.isArray(r.closers) ? r.closers.filter((x: unknown): x is string => typeof x === 'string' && ID_RE.test(x)) : []
  return { name: String(r.name ?? '').trim().slice(0, EVENT_NAME_MAX), closers: [...new Set<string>(ids.map((x: string) => x.toLowerCase()))].slice(0, EVENT_MAX_CLOSERS) }
}
// ══ Quem fica DE FORA de uma campanha normal ═══════════════════════════════════════════════════════════════════
// Qualquer campanha de times pode ter closers que NÃO participam (ex.: a campanha "de casa" para quem não foi ao evento).
// Guardado em campaigns.exclude (jsonb): [profile_id…]. Vazio = o time todo participa (como sempre foi). Campanha de EVENTO não usa isto.
export const EXCLUDE_MAX = 300
export function cleanExclude(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set<string>(raw.filter((x: unknown): x is string => typeof x === 'string' && ID_RE.test(x)).map((x: string) => x.toLowerCase()))].slice(0, EXCLUDE_MAX)
}
/** Quem entra na campanha: `only` (evento: só estes) ou `skip` (campanha normal: todo o time, menos estes). */
export const scopeOf = (d: Pick<CampaignDraft, 'event' | 'exclude'>): { only?: string[] | null; skip?: string[] | null } => (d.event ? { only: d.event.closers } : { skip: d.exclude ?? [] })
/** Entra na "assinatura da regra": mudar quem fica de fora muda quem pode ganhar. (vazio nas campanhas antigas: a assinatura de antes não muda) */
export const excludeConfigKey = (d: Pick<CampaignDraft, 'event' | 'exclude'>): string[] | null => (!d.event && d.exclude?.length ? [...d.exclude].sort() : null)
export function validateExclude(d: Pick<CampaignDraft, 'exclude'>): string[] {
  return (d.exclude?.length ?? 0) > EXCLUDE_MAX ? [`Muitos closers de fora (máximo ${EXCLUDE_MAX}).`] : []
}

export const isEventDraft = (d: Pick<CampaignDraft, 'event'>): boolean => !!d.event

/** Erros de validação do bloco de evento (campanha normal não tem nenhum). strict=false (rascunho): aceita lista vazia. */
export function validateEvent(d: Pick<CampaignDraft, 'event'>, strict: boolean): string[] {
  if (!d.event) return []
  const e: string[] = []
  if (d.event.name.length > EVENT_NAME_MAX) e.push(`O nome do evento pode ter até ${EVENT_NAME_MAX} caracteres.`)
  if (strict && d.event.closers.length === 0) e.push('Escolha pelo menos um closer que vai ao evento (ou volte para "Times").')
  if (d.event.closers.length > EVENT_MAX_CLOSERS) e.push(`Escolha no máximo ${EVENT_MAX_CLOSERS} closers.`)
  return e
}

/** Frase para a regra/aviso: " Campanha exclusiva dos closers do evento X." (vazio se não for de evento) */
export const eventText = (d: Pick<CampaignDraft, 'event'>): string => {
  if (!d.event) return ''
  const n = d.event.closers.length, who = n === 1 ? 'do closer que vai ao evento' : n > 1 ? `dos ${n} closers que vão ao evento` : 'dos closers do evento'
  return ` 🎪 Campanha exclusiva ${who}${d.event.name ? ` ${d.event.name}` : ''}.`
}
/** Entra na "assinatura da regra": trocar quem participa muda quem pode ganhar. (só devolve algo para campanha de evento: as antigas mantêm a assinatura de antes) */
export const eventConfigKey = (d: Pick<CampaignDraft, 'event'>): string[] | null => (d.event ? [...d.event.closers].sort() : null)
