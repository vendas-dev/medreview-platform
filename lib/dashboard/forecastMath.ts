// ── Forecast de fechamento do mês ─────────────────────────────────────
// Quatro camadas, somadas:
//   1. Já realizado            — vendas do mês até agora (fixo, ao vivo)
//   2. Recorrência a receber   — o que ainda deve cair de assinaturas até o fim do mês
//   3. Links em aberto         — links não pagos, não substituídos, não excluídos
//                                e NÃO VENCIDOS (qualquer dia de geração)
//   4. Ritmo de vendas         — média diária de vendas novas do mês × dias que faltam
//
// Peso dos links: 1 = entram pelo valor cheio (como pedido). Os links em aberto
// e o ritmo se sobrepõem em parte — as vendas que formam o ritmo também
// nascem de links —, e nem todo link é pago. Se quiser uma projeção mais
// conservadora, baixe esse número (ex: 0.6 = conta 60% do valor dos links).
export const LINKS_WEIGHT = 1

export interface ClosingInput {
  realizado: number                 // vendas do mês até agora (ao vivo)
  recorrenciaPrevista: number       // recorrência que ainda falta cair no mês, na hora em que a página carregou
  recorrenciaPagaDesdeCarga: number // recorrência que JÁ foi paga depois disso (pra não contar duas vezes)
  linksValidos: number              // soma dos links em aberto e não vencidos (um por negócio)
  ritmoRestante: number             // ritmo diário de vendas novas × dias restantes
  meta: number
  diasRestantes: number
}

export function composeClosingForecast(i: ClosingInput) {
  // Se uma parcela de recorrência foi paga depois da página carregar, ela já
  // virou "realizado" — então sai da recorrência prevista, senão contaria 2x.
  const recorrencia = Math.max(i.recorrenciaPrevista - i.recorrenciaPagaDesdeCarga, 0)
  const links = Math.max(i.linksValidos, 0) * LINKS_WEIGHT
  const ritmo = Math.max(i.ritmoRestante, 0)
  const projecao = i.realizado + recorrencia + links + ritmo
  const pctVsMeta = i.meta > 0 ? ((projecao - i.meta) / i.meta) * 100 : 0
  return {
    realizado: i.realizado, recorrencia, links, ritmo, projecao,
    pctVsMeta,
    faltaPraMeta: Math.max(i.meta - projecao, 0),
    ritmoDia: i.diasRestantes > 0 ? ritmo / i.diasRestantes : 0,
  }
}
