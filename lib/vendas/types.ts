// ══ Vendas — tipos compartilhados (servidor e telas) ═══════════════════════════
export interface VendaRow {
  id: string
  occurred_at: string                 // data da VENDA (nunca a data de uma transferência entre closers)
  transaction_id: string | null       // ID da transação na Hotmart
  vertical: string
  product: string | null
  value: number | null
  coupon_code: string | null
  lead_name: string | null
  email: string | null
  phone: string | null
  payment_type: string | null
  payment_installments: number | null // parcelas do cartão
  total_installments: number | null   // total de parcelas da assinatura (recorrência)
  is_recurring: boolean | null
  installment_number: number | null
  ambassador_name: string | null      // afiliado
  seller_type: string | null
  closer_id: string | null
  closer_name: string | null
  obs: string | null
  obs_updated_at: string | null
}

export type StatusTroca = 'pendente' | 'resolvida'
export type Decisao = 'concedida' | 'negada'

export interface TrocaRow {
  id: string
  created_at: string
  requester_id: string
  requester_name: string
  requester_team: string | null
  closer_id: string | null
  vertical: string
  product: string
  transaction_id: string
  lead_name: string
  hubspot_url: string
  botmaker_url: string
  reason: string
  status: StatusTroca
  decision: Decisao | null            // concedida | negada (vazio só nos pedidos antigos, anteriores a esta função)
  response: string | null
  resolved_by: string | null
  resolved_by_name: string | null
  resolved_at: string | null
  edited_at?: string | null               // a solicitação foi editada (por closer ou superadmin)
  edited_by_name?: string | null
  response_edited_at?: string | null      // a resposta já enviada foi editada pelo superadmin
  response_edited_by_name?: string | null
  requester_avatar?: string | null    // foto do closer que pediu
  resolved_by_avatar?: string | null  // foto de quem respondeu
}

export interface CloserResumo {
  id: string                           // uuid do closer, ou 'sem-closer' (vendas sem closer atribuído)
  name: string
  team: string | null                  // 'R1' | 'OAO' | null
  avatar_url: string | null
  ativo: boolean                       // false = usuário INATIVO (some dos filtros; só aparece na lista se tiver venda no período)
  vendas: number
  valor: number
  por_vertical: Record<string, { vendas: number; valor: number }>   // somatório por vertical (a tela só mostra as do time do closer)
  meta: { total: number; por_vertical: Record<string, number> } | null  // meta do MÊS em R$ (null: sem meta, ou período que não é um mês)
}
