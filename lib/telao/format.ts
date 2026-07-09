import { TelaoEvent, Closer, CloserStats, HourBucket, VerticalId } from './types'
import { todayInSaoPaulo, dayBoundsSaoPaulo, monthBoundsSaoPaulo } from '@/lib/timezone'

// ── Formatação ────────────────────────────────────────────────
export function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function fmtBRLFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return 'agora'
  if (min < 60) return `há ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ── Normalização de nomes ─────────────────────────────────────
export function normalizeName(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// ── Matching de closer ────────────────────────────────────────
export function matchCloser(rawName: string | null | undefined, closers: Closer[]): Closer | null {
  if (!rawName) return null
  const n = normalizeName(rawName)
  if (!n) return null

  // 1. Match exato
  const exact = closers.find(c => c.normalized_name === n)
  if (exact) return exact

  // 2. Alias
  const byAlias = closers.find(c => c.aliases.some(a => normalizeName(a) === n))
  if (byAlias) return byAlias

  // 3. Primeiro nome
  const firstName = n.split(' ')[0]
  const byFirst   = closers.find(c => c.normalized_name.startsWith(firstName))
  if (byFirst) return byFirst

  return null
}

// ── Cálculo de stats por closer ───────────────────────────────
export function computeCloserStats(
  events: TelaoEvent[],
  closers: Closer[],
): CloserStats[] {
  const closersById = Object.fromEntries(closers.map(c => [c.id, c]))
  const map = new Map<string, CloserStats>()

  for (const ev of events) {
    const key  = ev.is_self_checkout ? 'self' : (ev.closer_id ?? ev.closer_name ?? 'unknown')
    const isSelf = ev.is_self_checkout
    const closer = ev.closer_id ? closersById[ev.closer_id] ?? null : null
    const name   = closer?.name ?? (isSelf ? 'Self Checkout' : ev.closer_name ?? '?')

    if (!map.has(key)) {
      map.set(key, { closer, name, isSelf, revenue: 0, sales: 0, certs: 0 })
    }
    const s = map.get(key)!
    if (ev.event_type === 'sale') {
      s.revenue += ev.value ?? 0
      s.sales++
    } else {
      s.certs++
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

// ── HourlyChart — hora LOCAL, nunca UTC ───────────────────────
export function computeHourBuckets(
  events: TelaoEvent[],
  closersById: Record<string, Closer>,
  hours = 12,
): HourBucket[] {
  const now    = new Date()
  const result: HourBucket[] = []

  for (let i = hours - 1; i >= 0; i--) {
    const d    = new Date(now)
    d.setHours(now.getHours() - i, 0, 0, 0)

    // Formato local YYYY-MM-DDTHH:00
    const pad  = (n: number) => String(n).padStart(2, '0')
    const hourIso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
    const label   = `${pad(d.getHours())}h`

    const nextH = new Date(d); nextH.setHours(d.getHours() + 1)
    const hourEvents = events.filter(ev => {
      const t = new Date(ev.occurred_at)
      return t >= d && t < nextH
    })

    const statsMap = new Map<string, CloserStats>()
    for (const ev of hourEvents) {
      if (ev.event_type !== 'sale') continue
      const key    = ev.is_self_checkout ? 'self' : (ev.closer_id ?? ev.closer_name ?? 'unknown')
      const isSelf = ev.is_self_checkout
      const closer = ev.closer_id ? closersById[ev.closer_id] ?? null : null
      const name   = closer?.name ?? (isSelf ? 'Self Checkout' : ev.closer_name ?? '?')
      if (!statsMap.has(key)) statsMap.set(key, { closer, name, isSelf, revenue: 0, sales: 0, certs: 0 })
      const s = statsMap.get(key)!
      s.revenue += ev.value ?? 0
      s.sales++
    }

    const top3 = Array.from(statsMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 3)
    const topCloser  = top3[0]?.closer   ?? null
    const topName    = top3[0]?.name     ?? ''
    const topRevenue = top3[0]?.revenue  ?? 0
    const topSales   = top3[0]?.sales    ?? 0
    const total      = hourEvents.filter(e => e.event_type === 'sale').length

    result.push({ hourIso, label, top3, topCloser, topName, topRevenue, topSales, total })
  }

  return result
}

// ── Chaves de datas ───────────────────────────────────────────
export function todayKey()  { return todayInSaoPaulo() }
export function monthKey()  { return todayInSaoPaulo().slice(0, 7) }
export function todayStart(){ return dayBoundsSaoPaulo(todayInSaoPaulo()).start }
export function monthStart(){ return monthBoundsSaoPaulo(todayInSaoPaulo().slice(0, 7)).start }
