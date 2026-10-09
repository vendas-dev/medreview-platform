import { runExamCheck, CollectDeps } from './collect'
import { extractWithClaude } from './extract'
import { pdfToText } from './pdf'
import { todaySP } from './alerts'
import { addDays } from './dates'
import type { ExamMilestoneRow } from './types'

export function makeDeps(): CollectDeps {
  return { fetchImpl: fetch, extract: (i) => extractWithClaude(i), pdfToText, today: todaySP() }
}

export const runChecks = (admin: any, opts: { sourceId?: string } = {}) => runExamCheck(admin, makeDeps(), opts)

/** Tudo que a tela precisa: datas verificadas, fontes e a última verificação de cada uma. */
export async function loadExamData(admin: any, isSuper: boolean) {
  const today = todaySP()
  const [{ data: sources }, { data: items }, { data: runs }] = await Promise.all([
    admin.from('exam_sources').select('id, vertical, society, exam_labels, name, url, active, priority').eq('active', true).order('priority', { ascending: true }),
    admin.from('exam_milestones').select('*').eq('status', 'active').gte('starts_on', addDays(today, -60)),
    admin.from('exam_check_runs').select('source_id, ran_at, status, items_found, message').order('ran_at', { ascending: false }).limit(300),
  ])

  const lastBySource = new Map<string, any>()
  for (const r of (runs ?? []) as any[]) if (!lastBySource.has(r.source_id)) lastBySource.set(r.source_id, r)

  const rows = (items ?? []) as ExamMilestoneRow[]
  const creatorIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (creatorIds.length) {
    const { data: ps } = await admin.from('profiles').select('id, name').in('id', creatorIds)
    for (const p of (ps ?? []) as any[]) names.set(p.id, p.name)
  }

  return {
    today,
    items: rows.map(r => ({ ...r, created_by_name: r.created_by ? names.get(r.created_by) ?? null : null })),
    sources: ((sources ?? []) as any[]).map(s => {
      const r = lastBySource.get(s.id)
      return {
        id: s.id, vertical: s.vertical, society: s.society, exam_labels: s.exam_labels, name: s.name, url: s.url,
        // closers veem só "ok / sem dados / indisponível"; o detalhe técnico é do superadmin
        last_run: r ? { ran_at: r.ran_at, status: r.status, items_found: r.items_found, message: isSuper ? r.message : undefined } : null,
      }
    }),
  }
}
