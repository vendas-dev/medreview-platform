import { extractDates, diffDays, addDays } from './dates'
import { PHASES, PHASE_KIND, ExamPhase, RawItem, VerifiedItem, ExamSource } from './types'

// ══ O "fiscal" ═════════════════════════════════════════════════════════
// Tudo que a IA devolve passa por aqui. Uma data só vira dado se:
//   1. o trecho que ela cita (evidência) EXISTE de fato no documento lido;
//   2. esse trecho escreve a data COMPLETA (dia, mês e ano) — o ano nunca é presumido;
//   3. a data que a IA informou é exatamente uma das que o trecho escreve;
//   4. o trecho fala de uma data/intervalo só (senão a IA poderia trocar a etapa);
//   5. a prova e a etapa são das que o sistema conhece, e a data é coerente.
// Falhou em qualquer uma → descartada, com o motivo registrado.

export type RejectReason =
  | 'formato_invalido' | 'prova_fora_da_lista' | 'etapa_desconhecida' | 'evidencia_nao_encontrada'
  | 'data_sem_ano' | 'data_nao_consta_na_evidencia' | 'evidencia_com_varias_etapas'
  | 'datas_incoerentes' | 'ja_passou' | 'muito_distante'

export const REASON_LABEL: Record<RejectReason, string> = {
  formato_invalido: 'resposta fora do formato', prova_fora_da_lista: 'prova que não é desta fonte',
  etapa_desconhecida: 'etapa desconhecida', evidencia_nao_encontrada: 'trecho citado não existe no documento',
  data_sem_ano: 'data sem ano no texto', data_nao_consta_na_evidencia: 'data diferente da escrita no trecho',
  evidencia_com_varias_etapas: 'trecho mistura várias datas', datas_incoerentes: 'datas incoerentes',
  ja_passou: 'data já passou', muito_distante: 'data muito distante',
}

export const normText = (s: string): string =>
  s.normalize('NFKC').toLowerCase()
    .replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/[‘’´`]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ').trim()

const ISO = /^\d{4}-\d{2}-\d{2}$/

export interface VerifyContext {
  docNorm: string                       // texto do documento, já normalizado com normText
  source: Pick<ExamSource, 'id' | 'vertical' | 'society' | 'exam_labels'>
  sourceUrl: string                     // o documento exato lido
  today: string                         // YYYY-MM-DD (São Paulo)
}

export type VerifyOne = { ok: true; item: Omit<VerifiedItem, 'dedupe_key'> } | { ok: false; reason: RejectReason }

export function verifyItem(raw: RawItem, ctx: VerifyContext): VerifyOne {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'formato_invalido' }
  const { exam_label, phase, title, starts_on, ends_on, evidence } = raw
  if (typeof exam_label !== 'string' || typeof phase !== 'string' || typeof evidence !== 'string' || typeof starts_on !== 'string')
    return { ok: false, reason: 'formato_invalido' }
  if (!ISO.test(starts_on) || (ends_on != null && !ISO.test(String(ends_on)))) return { ok: false, reason: 'formato_invalido' }

  const label = ctx.source.exam_labels.find(l => l.toLowerCase() === exam_label.trim().toLowerCase())
  if (!label) return { ok: false, reason: 'prova_fora_da_lista' }
  if (!(PHASES as readonly string[]).includes(phase)) return { ok: false, reason: 'etapa_desconhecida' }

  const ev = evidence.trim()
  if (ev.length < 6 || ev.length > 400) return { ok: false, reason: 'formato_invalido' }
  if (!ctx.docNorm.includes(normText(ev))) return { ok: false, reason: 'evidencia_nao_encontrada' }

  const written = extractDates(ev)
  if (written.length === 0) return { ok: false, reason: 'data_sem_ano' }
  if (written.length > 2) return { ok: false, reason: 'evidencia_com_varias_etapas' }
  const end = ends_on ?? null
  if (!written.includes(starts_on) || (end && !written.includes(end))) return { ok: false, reason: 'data_nao_consta_na_evidencia' }
  if (end && (end < starts_on || diffDays(starts_on, end) > 370)) return { ok: false, reason: 'datas_incoerentes' }

  if ((end ?? starts_on) < addDays(ctx.today, -45)) return { ok: false, reason: 'ja_passou' }
  if (starts_on > addDays(ctx.today, 800)) return { ok: false, reason: 'muito_distante' }

  return {
    ok: true,
    item: {
      vertical: ctx.source.vertical, society: ctx.source.society, exam_label: label, phase: phase as ExamPhase,
      kind: PHASE_KIND[phase as ExamPhase], title: (title || '').toString().trim().slice(0, 120) || phase,
      starts_on, ends_on: end && end !== starts_on ? end : null, evidence: ev, source_url: ctx.sourceUrl, source_id: ctx.source.id,
    },
  }
}

/** Chave estável da data: mesma prova + etapa + ordem dentro do ano → mesma linha. Se a data MUDA (errata), a linha é a mesma. */
export function assignKeys(items: Omit<VerifiedItem, 'dedupe_key'>[]): VerifiedItem[] {
  const groups = new Map<string, Omit<VerifiedItem, 'dedupe_key'>[]>()
  for (const it of items) {
    const g = `${it.vertical}|${it.exam_label}|${it.phase}|${it.starts_on.slice(0, 4)}`
    ;(groups.get(g) ?? groups.set(g, []).get(g)!).push(it)
  }
  const out: VerifiedItem[] = []
  for (const [g, arr] of groups) {
    arr.sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    arr.forEach((it, i) => out.push({ ...it, dedupe_key: `${g}|${i + 1}` }))
  }
  return out
}

export interface BatchResult { verified: VerifiedItem[]; rejected: { reason: RejectReason; raw: RawItem }[] }

export function verifyBatch(rawItems: RawItem[], ctx: VerifyContext): BatchResult {
  const rejected: BatchResult['rejected'] = []
  const ok: Omit<VerifiedItem, 'dedupe_key'>[] = []
  const seen = new Set<string>()
  for (const raw of rawItems ?? []) {
    const r = verifyItem(raw, ctx)
    if (!r.ok) { rejected.push({ reason: r.reason, raw }); continue }
    const sig = `${r.item.exam_label}|${r.item.phase}|${r.item.starts_on}|${r.item.ends_on}`
    if (seen.has(sig)) continue                      // a IA repetiu a mesma data
    seen.add(sig); ok.push(r.item)
  }
  return { verified: assignKeys(ok), rejected }
}
