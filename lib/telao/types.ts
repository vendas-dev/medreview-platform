export type VerticalId = 'medreview' | 'anestreview' | 'oftreview' | 'ortopreview'
export type EventKind  = 'sale' | 'ambassador_certified'
export type SellerKind = 'closer' | 'ambassador' | 'self_checkout'

export interface VerticalConfig {
  id:      VerticalId
  label:   string
  short:   string
  accent:  string
  mascot:  string   // path para a imagem
  glow:    string   // cor do glow
}

const VERTICAIS_ATIVAS: Record<VerticalId, VerticalConfig> = {
  medreview:   { id: 'medreview',   label: 'Med-Review R1',  short: 'R1',    accent: '#a855f7', glow: 'rgba(168,85,247,0.4)',  mascot: '/telao/mascots/r1.png'    },
  anestreview: { id: 'anestreview', label: 'Anest-Review',   short: 'ANEST', accent: '#38bdf8', glow: 'rgba(56,189,248,0.4)',  mascot: '/telao/mascots/anest.png' },
  oftreview:   { id: 'oftreview',   label: 'Oft-Review',     short: 'OFT',   accent: '#fbbf24', glow: 'rgba(251,191,36,0.4)',  mascot: '/telao/mascots/oft.png'   },
  ortopreview: { id: 'ortopreview', label: 'Ortop-Review',   short: 'ORTOP', accent: '#fb923c', glow: 'rgba(251,146,60,0.4)',  mascot: '/telao/mascots/ortop.png' },
}

// Verticais APOSENTADAS (ex.: vascreview): existem no banco só como histórico de vendas. NÃO ganham painel, aba nem cartão: VERTICAL_LIST e Object.keys/values só enxergam as 4 ativas.
// Mas se uma venda dessas aparecer num período (feed, ticker, análises), VERTICALS[ev.vertical] devolve um visual neutro em vez de undefined (que derrubaria a tela).
const VERTICAL_APOSENTADA: VerticalConfig = { id: 'vascreview' as VerticalId, label: 'Vasc-Review', short: 'VASC', accent: '#94a3b8', glow: 'rgba(148,163,184,0.4)', mascot: '' }
export const VERTICALS: Record<VerticalId, VerticalConfig> = new Proxy(VERTICAIS_ATIVAS, {
  get: (t, k) => (k === 'vascreview' ? VERTICAL_APOSENTADA : (t as any)[k]),
})

export const VERTICAL_LIST = Object.values(VERTICALS)
export const GOLD = '#f59e0b'

export interface Closer {
  id:              string
  name:            string
  normalized_name: string
  aliases:         string[]
  color:           string
  badge:           string
  level:           number
  avatar_url:      string | null
  hubspot_id:      string | null
}

export interface TelaoEvent {
  id:                string
  event_type:        EventKind
  vertical:          VerticalId
  lead_name:         string | null
  product:           string | null
  value:             number | null
  ambassador_name:   string | null
  college:           string | null
  class:             string | null
  closer_name:       string | null
  closer_id:         string | null
  closer_hubspot_id?:string | null
  is_self_checkout:  boolean
  seller_type:       SellerKind
  sold_by_ambassador:boolean
  occurred_at:       string
  created_at:        string
  // Recorrência / cupom — opcionais pra não quebrar nada que já lia esse tipo
  is_recurring?:       boolean
  installment_number?: number | null
  total_installments?: number | null
  sale_type?:          'nova' | 'recorrente'
  coupon_code?:        string | null
  // Transferência/co-atribuição de venda
  deal_id?:             string | null
  co_closer_id?:         string | null
  co_closer_hubspot_id?: string | null
  transferred_at?:       string | null
  transfer_reason?:      string | null
}

export interface Goal {
  id:           string
  period:       'day' | 'month'
  period_key:   string
  vertical:     string | null
  target_value: number
}

export interface CloserStats {
  closer:   Closer | null
  name:     string
  isSelf:   boolean
  isAmbassador: boolean
  revenue:  number
  sales:    number
  certs:    number
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
  overall:    number
  byVertical: Record<VerticalId, number>
}

export interface FilterState {
  start:      string | null
  end:        string | null
  closerKeys: string[]
}

export const EMPTY_FILTER: FilterState = { start: null, end: null, closerKeys: [] }
