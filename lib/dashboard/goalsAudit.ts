// ── Auditoria de metas ─────────────────────────────────────────────────────────────────────────
// Responde "de onde está puxando esse número?" com os DADOS REAIS: lê o que foi cadastrado em /intel/goals e, pra cada seção do painel, calcula o % de meta
// do jeito que o código DAQUELA seção calcula. Se duas seções divergem, aparece aqui com o motivo.
//
// As três "metas" que existem (e que NÃO são a mesma coisa):
//   1. Meta Geral da EMPRESA   → company_goals, escopo 'geral'                (aba "🏢 Meta Geral")
//   2. Meta por VERTICAL da empresa → company_goals, escopo = nome da vertical (aba "Por vertical")
//   3. Meta de cada CLOSER     → closer_goals.goal_sales (+ goals_by_vertical, goal_ambassador)   (aba "Closers")
// A soma das metas dos closers (3) NÃO é a meta da empresa (1). O anel do topo, o forecast e os telões usam a (1); a IA do mural antiga dividia por (3).

import { VKEYS, GOAL_SCOPE, verticalKey } from '@/lib/dashboard/forecastAnalysis'
import { fmtMoney, fmtPct } from '@/lib/dashboard/companyFacts'

export interface AuditData {
  month: string; dayOfMonth: number; daysInMonth: number
  companyGoals: Record<string, number>                                                                       // scope → valor ('geral', 'Anest-Review', …)
  closerGoals: { user_id: string; goal_sales: number | null; goals_by_vertical: Record<string, number> | null; goal_ambassador?: number | null }[]
  sales: { value: number | null; vertical: string | null }[]                                                 // TODAS as vendas do mês (lidas em páginas)
  dashboardSales?: { rows: number; sum: number } | null                                                      // o que a consulta do dashboard (limit 999999) devolveu
}

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null)
const cap100 = (p: number | null) => (p === null ? null : Math.min(p, 100))

export function computeGoalAudit(d: AuditData) {
  const geral = num(d.companyGoals['geral'])
  const verticais = Object.fromEntries(VKEYS.map(k => [GOAL_SCOPE[k], num(d.companyGoals[GOAL_SCOPE[k]])])) as Record<string, number>
  const somaVerticais = Object.values(verticais).reduce((s, v) => s + v, 0)

  // metas dos closers
  const comMeta = d.closerGoals.filter(g => num(g.goal_sales) > 0)
  const somaGoalSales = comMeta.reduce((s, g) => s + num(g.goal_sales), 0)
  const gbvSum = (g: AuditData['closerGoals'][number]) => Object.values(g.goals_by_vertical ?? {}).reduce((s, v) => s + num(v), 0)
  const soPorVertical = d.closerGoals.filter(g => num(g.goal_sales) <= 0 && gbvSum(g) > 0)
  const somaPorVerticalDosClosers = Object.fromEntries(VKEYS.map(k => [GOAL_SCOPE[k], d.closerGoals.reduce((s, g) => s + num((g.goals_by_vertical ?? {})[GOAL_SCOPE[k]]), 0)])) as Record<string, number>

  // receita
  const porVertical: Record<string, number> = { anest: 0, oft: 0, ortop: 0, r1: 0, outros: 0 }
  let receita = 0, semVertical = { n: 0, valor: 0 }
  for (const e of d.sales) {
    const v = num(e.value); receita += v
    const k = verticalKey(e.vertical) ?? 'outros'; porVertical[k] += v
    if (k === 'outros') { semVertical.n++; semVertical.valor += v }
  }

  const pctMes = (d.dayOfMonth / d.daysInMonth) * 100
  // a regra do anel do topo, do forecast e do page.tsx: meta da empresa; só se ela estiver vazia cai pra soma dos closers
  const metaPainel = geral > 0 ? geral : somaGoalSales
  const fontePainel = geral > 0 ? 'Meta Geral da empresa (company_goals.geral)' : somaGoalSales > 0 ? 'soma das metas dos closers (a Meta Geral NÃO está cadastrada)' : 'nenhuma meta cadastrada'
  const pctPainel = pct(receita, metaPainel)
  const pctIaAntiga = cap100(pct(receita, somaGoalSales))

  const secoes: { secao: string; meta: number; fonte: string; receita: number; pct: number | null; pct_exibido: number | null; observacao?: string }[] = [
    { secao: 'Anel do topo do dashboard ("dados gerais")', meta: metaPainel, fonte: fontePainel, receita, pct: pctPainel, pct_exibido: cap100(pctPainel), observacao: 'o anel corta em 100%' },
    { secao: 'Forecast — "Meta do mês" e "Evolução no mês"', meta: metaPainel, fonte: fontePainel, receita, pct: pctPainel, pct_exibido: pctPainel },
    { secao: 'Telão e Telão Completo — meta geral', meta: geral, fonte: 'Meta Geral da empresa (sem reserva: se estiver vazia, o telão mostra "meta não cadastrada")', receita, pct: pct(receita, geral), pct_exibido: pct(receita, geral) },
    { secao: 'IA do mural — código ANTIGO (o 73%/74%)', meta: somaGoalSales, fonte: 'SOMA das metas dos closers (closer_goals.goal_sales)', receita, pct: pct(receita, somaGoalSales), pct_exibido: pctIaAntiga, observacao: 'dividia a receita da EMPRESA inteira pela soma das metas individuais dos closers' },
    { secao: 'IA do mural — código NOVO', meta: metaPainel, fonte: fontePainel, receita, pct: pctPainel, pct_exibido: pctPainel },
  ]
  const porVerticalSecoes = VKEYS.map(k => {
    const meta = verticais[GOAL_SCOPE[k]], rec = porVertical[k]
    return { vertical: GOAL_SCOPE[k], meta_da_empresa: meta, receita: rec, pct: pct(rec, meta), referencia_soma_metas_dos_closers_nessa_vertical: somaPorVerticalDosClosers[GOAL_SCOPE[k]] }
  })

  // alertas
  const alertas: string[] = []
  if (!(geral > 0)) alertas.push(somaGoalSales > 0
    ? `A Meta Geral deste mês NÃO está cadastrada (aba "🏢 Meta Geral" em /intel/goals). O painel, o forecast e a IA estão usando a soma das metas dos closers (${fmtMoney(somaGoalSales)}) no lugar.`
    : 'Nenhuma meta cadastrada neste mês (nem Meta Geral nem metas de closers): nenhuma seção consegue mostrar % de meta.')
  if (geral > 0 && somaGoalSales > 0 && Math.abs(somaGoalSales - geral) / geral > 0.05)
    alertas.push(`A soma das metas dos closers (${fmtMoney(somaGoalSales)}) equivale a ${fmtPct((somaGoalSales / geral) * 100)} da Meta Geral (${fmtMoney(geral)}). São metas diferentes e isso é normal; o erro era a IA ANTIGA dividir a receita pela soma dos closers: mostrava ${fmtPct(pctIaAntiga ?? 0)} quando a meta da empresa dá ${fmtPct(pctPainel ?? 0)}.`)
  if (geral > 0 && somaVerticais > 0 && Math.abs(somaVerticais - geral) / geral > 0.01)
    alertas.push(`A soma das metas por vertical (${fmtMoney(somaVerticais)}) é diferente da Meta Geral (${fmtMoney(geral)}), diferença de ${fmtMoney(Math.abs(somaVerticais - geral))}. Cada seção usa a sua: o anel e o forecast usam a Meta Geral; os cards por vertical usam a meta de cada vertical.`)
  if (soPorVertical.length > 0)
    alertas.push(`${soPorVertical.length} closer(s) têm meta só por vertical (sem "Meta geral de vendas"): eles NÃO entram na soma das metas dos closers e aparecem como "sem meta" nos cards do dashboard e do Intel (mas têm meta na própria tela do closer).`)
  if (d.dashboardSales && (d.dashboardSales.rows < d.sales.length || Math.abs(d.dashboardSales.sum - receita) > 1))
    alertas.push(`A consulta de vendas do dashboard (limit 999999) devolveu só ${d.dashboardSales.rows} das ${d.sales.length} vendas do mês (o Supabase corta em 1.000 linhas): a receita que o dashboard mostra (${fmtMoney(d.dashboardSales.sum)}) é MENOR que a real (${fmtMoney(receita)}). Isso derruba todos os % de meta.`)
  if (semVertical.n > 0)
    alertas.push(`${semVertical.n} venda(s) sem vertical identificada (${fmtMoney(semVertical.valor)}): entram no total, mas em nenhuma vertical.`)
  for (const v of porVerticalSecoes) if (v.meta_da_empresa === 0 && v.receita > 0) alertas.push(`${v.vertical} tem receita (${fmtMoney(v.receita)}) mas nenhuma meta cadastrada na aba "Por vertical".`)
  const diagnosticoIa = somaGoalSales > 0 && pctPainel !== null && pctIaAntiga !== null && Math.abs(pctIaAntiga - Math.min(pctPainel, 100)) > 1
    ? `A IA ANTIGA mostrava ${fmtPct(pctIaAntiga)} porque dividia a receita (${fmtMoney(receita)}) pela soma das metas dos closers (${fmtMoney(somaGoalSales)}). A meta da empresa (${fmtMoney(metaPainel)}) dá ${fmtPct(pctPainel)}.`
    : 'A IA antiga e o painel dariam o mesmo percentual neste mês.'

  const resumo = [
    `Mês ${d.month}: dia ${d.dayOfMonth} de ${d.daysInMonth} (${fmtPct(pctMes)} do mês).`,
    `Receita do mês: ${fmtMoney(receita)} (${d.sales.length} vendas).`,
    `Meta Geral da empresa: ${geral > 0 ? fmtMoney(geral) : 'NÃO cadastrada'} → ${pctPainel === null ? 'sem %' : fmtPct(pctPainel)} da meta (é o que o anel do topo, o forecast e a IA nova mostram).`,
    `Soma das metas dos ${comMeta.length} closers com meta: ${fmtMoney(somaGoalSales)} → ${pct(receita, somaGoalSales) === null ? 'sem %' : fmtPct(pct(receita, somaGoalSales) as number)} (era o que a IA antiga mostrava).`,
    diagnosticoIa,
  ]

  return {
    mes: d.month, calendario: { dia: d.dayOfMonth, dias_no_mes: d.daysInMonth, pct_do_mes: r2(pctMes) },
    resumo,
    metas_cadastradas: {
      empresa: { geral, por_vertical: verticais, soma_das_verticais: somaVerticais },
      closers: { com_meta_geral_de_vendas: comMeta.length, so_com_meta_por_vertical: soPorVertical.length, soma_goal_sales: somaGoalSales, soma_por_vertical: somaPorVerticalDosClosers,
        soma_meta_embaixadores_qtd: d.closerGoals.reduce((s, g) => s + num(g.goal_ambassador), 0) },
    },
    receita: { total: r2(receita), por_vertical: Object.fromEntries(Object.entries(porVertical).map(([k, v]) => [k, r2(v)])), vendas: d.sales.length,
      dashboard_enxerga: d.dashboardSales ? { vendas: d.dashboardSales.rows, receita: r2(d.dashboardSales.sum) } : null },
    percentuais_por_secao: secoes.map(s => ({ ...s, pct: s.pct === null ? null : r2(s.pct), pct_exibido: s.pct_exibido === null ? null : r2(s.pct_exibido) })),
    por_vertical: porVerticalSecoes.map(v => ({ ...v, pct: v.pct === null ? null : r2(v.pct) })),
    alertas,
  }
}
