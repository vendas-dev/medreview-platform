// Auxiliares PUROS da tela de negócios (sem React): link do HubSpot, tag de expiração, textos e a URL da consulta.
import type { DealsQuery, DealStatus } from '@/lib/dashboard/forecastDeals'

export const HUBSPOT_PORTAL = '48628516'
/** Link do negócio no HubSpot: só o id muda no final. Sem id (link sem negócio) não há link. */
export const hubspotDealUrl = (dealId: string | null | undefined): string | null => {
  const id = String(dealId ?? '').trim()
  return /^[A-Za-z0-9_-]+$/.test(id) ? `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/record/0-3/${encodeURIComponent(id)}/` : null
}

export type ExpiryKind = 'expired' | 'urgent' | 'soon' | 'ok' | 'none'
/** Tag de vencimento do link: vermelha "Expirado", ou "Expira em X min / Xh / Xd". */
export function expiryTag(expiresAt: string | null | undefined, nowMs: number): { kind: ExpiryKind; label: string } {
  if (!expiresAt) return { kind: 'none', label: 'Sem prazo' }
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return { kind: 'none', label: 'Sem prazo' }
  const ms = t - nowMs
  if (ms <= 0) return { kind: 'expired', label: 'Expirado' }
  const min = Math.floor(ms / 60000)
  if (min < 1) return { kind: 'urgent', label: 'Expira em 1 min' }
  if (min < 60) return { kind: 'urgent', label: `Expira em ${min} min` }
  const h = Math.floor(min / 60), m = min % 60
  if (h < 24) return { kind: 'soon', label: `Expira em ${h}h${m ? ` ${m}min` : ''}` }
  const d = Math.floor(h / 24), hh = h % 24
  return { kind: 'ok', label: `Expira em ${d}d${hh ? ` ${hh}h` : ''}` }
}

export const dealsQueryString = (q: DealsQuery) => {
  const p = new URLSearchParams({ scope: q.scope, status: q.status })
  if (q.vertical) p.set('vertical', q.vertical)
  if (q.hour !== undefined) p.set('hour', String(q.hour))
  if (q.day) p.set('day', q.day)
  return p.toString()
}

const STATUS_TITLE: Record<'all' | DealStatus, { today: string; history: string }> = {
  all: { today: 'Links gerados hoje', history: 'Links gerados' },
  paid: { today: 'Pagos', history: 'Pagos' },
  unpaid: { today: 'Ainda não pagos', history: 'Ainda não pagos' },
  lost: { today: 'Perdidos', history: 'Perdidos (fora da conta)' },
}
/** Título e subtítulo do popup a partir do que foi clicado. */
export function dealsTitle(q: DealsQuery, verticalLabel?: string): { title: string; subtitle: string } {
  const parts: string[] = []
  if (verticalLabel) parts.push(verticalLabel)
  if (q.hour !== undefined) parts.push(`gerados às ${String(q.hour).padStart(2, '0')}h`)
  if (q.day) parts.push(`gerados em ${q.day.slice(8, 10)}/${q.day.slice(5, 7)}`)
  parts.push(q.scope === 'today' ? 'hoje' : 'últimos 15 dias')
  const hint: Record<'all' | DealStatus, string> = {
    all: q.scope === 'today' ? 'Todos os negócios com link gerado hoje (pagos, aguardando e perdidos)' : 'Todos os negócios com link gerado no período, pagos ou não',
    paid: 'Negócios cujo link já foi pago', unpaid: 'Negócios com link ainda não pago — do que vence primeiro ao que já expirou',
    lost: 'Negócios que o HubSpot marcou como Perdido e não pagaram — não entram na conta',
  }
  return { title: `${STATUS_TITLE[q.status][q.scope]} · ${parts.join(' · ')}`, subtitle: hint[q.status] }
}
