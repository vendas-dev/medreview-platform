// ── Verticais ─────────────────────────────────────────────────
export type VerticalId = 'medreview' | 'anestreview' | 'oftreview' | 'ortopreview'
export type EventKind  = 'sale' | 'ambassador_certified'

export interface VerticalConfig {
  id:     VerticalId
  label:  string
  short:  string
  accent: string
}

export const VERTICALS: Record<VerticalId, VerticalConfig> = {
  medreview:   { id: 'medreview',   label: 'R1-Review',    short: 'R1',    accent: '#a855f7' },
  anestreview: { id: 'anestreview', label: 'Anest-Review', short: 'ANEST', accent: '#4ea3e6' },
  oftreview:   { id: 'oftreview',   label: 'Oft-Review',   short: 'OFT',   accent: '#facc15' },
  ortopreview: { id: 'ortopreview', label: 'Ortop-Review', short: 'ORTOP', accent: '#e66a4e' },
}

export const VERTICAL_LIST = Object.values(VERTICALS)
export const GOLD = '#c9a84c'

// ── Modelos ───────────────────────────────────────────────────
export interface Closer {
  id:              string
  name:            string
  normalized_name: string
  aliases:         string[]
  color:           string
  badge:           string
  level:           number
  avatar_url:      string | null
}

export interface TelaoEvent {
  id:               string
  event_type:       EventKind
  vertical:         VerticalId
  lead_name:        string | null
  product:          string | null
  value:            number | null
  ambassador_name:  string | null
  college:          string | null
  class:            string | null
  closer_name:      string | null
  closer_id:        string | null
  is_self_checkout: boolean
  occurred_at:      string
  created_at:       string
}

export interface Goal {
  id:           string
  period:       'day' | 'month'
  period_key:   string
  vertical:     string | null
  target_value: number
}

// ── Stats calculadas ──────────────────────────────────────────
export interface CloserStats {
  closer:    Closer | null
  name:      string
  isSelf:    boolean
  revenue:   number
  sales:     number
  certs:     number
}

export interface HourBucket {
  hourIso:    string
  label:      string
  top3:       CloserStats[]
  topCloser:  Closer | null
  topName:    string
  topRevenue: number
  topSales:   number
  total:      number
}

export interface MonthRevenue {
  overall:     number
  byVertical:  Record<VerticalId, number>
}

// ── Filtro ───────────────────────────────────────────────────
export interface FilterState {
  start:      string | null
  end:        string | null
  closerKeys: string[]   // closer.id | 'self'
}

export const EMPTY_FILTER: FilterState = { start: null, end: null, closerKeys: [] }
