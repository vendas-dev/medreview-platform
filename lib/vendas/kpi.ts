// ══ Vendas Gerais → visão KPI (estilo planilha): contas PURAS, usadas pelo servidor e pela tela ══════════════════════════════════
// Colunas: Realizado · Meta · Gap · % da meta · Ticket médio · Projeção · % da meta pela projeção · Vendas.
//  • Gap        = Meta − Realizado (positivo: falta; negativo: já passou da meta).
//  • % da meta  = Realizado ÷ Meta.
//  • Projeção   = a MESMA do Forecast (lib/dashboard/forecastClosing.ts) quando o período é o mês corrente até hoje: o TOTAL mostra o número do Forecast e cada vertical/closer recebe o
//                 mesmo fator (projeção ÷ realizado do Forecast) aplicado ao que vendeu. Nos outros períodos: Realizado ÷ dias ÚTEIS (seg-sex) decorridos × dias ÚTEIS do mês (critério da planilha).
//  • Meta, gap e projeção só existem quando o período COMEÇA no dia 1 e fica dentro de UM mês (as metas são mensais); fora disso mostram "—".
const ymd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1) }
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const DIA = 86400000
/** Dias úteis (segunda a sexta) entre duas datas AAAA-MM-DD, as duas incluídas. */
export function diasUteis(de: string, ate: string): number {
  const a = ymd(de), b = ymd(ate); if (!(a <= b)) return 0
  let n = 0; for (let t = a; t <= b; t += DIA) { const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) n++ }
  return n
}
export const ultimoDiaDoMes = (mes: string): string => { const [y, m] = mes.split('-').map(Number); return iso(Date.UTC(y, m, 0)) }

export interface KpiPeriodo { de: string; ate: string; mes: string | null; diasUteisTotal: number; diasUteisDecorridos: number; comMeta: boolean }
export function periodoKpi(de: string, ate: string, hoje: string): KpiPeriodo {
  const mes = de.slice(8, 10) === '01' && ate.slice(0, 7) === de.slice(0, 7) ? de.slice(0, 7) : null
  if (!mes) return { de, ate, mes: null, diasUteisTotal: 0, diasUteisDecorridos: 0, comMeta: false }
  const fim = ultimoDiaDoMes(mes), total = diasUteis(de, fim), ate2 = hoje < ate ? hoje : ate
  return { de, ate, mes, diasUteisTotal: total, diasUteisDecorridos: ate2 < de ? 0 : Math.min(diasUteis(de, ate2), total), comMeta: true }
}
export interface KpiBruto { realizado: number; vendas: number; meta: number | null }
export interface KpiLinha extends KpiBruto { gap: number | null; pctMeta: number | null; ticket: number | null; projecao: number | null; pctProjecao: number | null }
/** A projeção de fechamento do Forecast: `projecao` é o total; `realizado` é o "já realizado" que o Forecast usou (todas as vendas do mês). */
export interface KpiForecast { projecao: number; realizado: number }
/** `ehTotal`: a linha do total geral mostra a projeção do Forecast exatamente; as demais usam o mesmo fator (projeção ÷ realizado) sobre o próprio realizado. */
export function kpiLinha(b: KpiBruto, p: KpiPeriodo, f?: KpiForecast | null, ehTotal = false): KpiLinha {
  const meta = p.comMeta && b.meta !== null && b.meta > 0 ? b.meta : null
  const doForecast = p.comMeta && f ? (ehTotal ? f.projecao : f.realizado > 0 ? b.realizado * (f.projecao / f.realizado) : null) : undefined
  const projecao = doForecast !== undefined ? doForecast : p.comMeta && p.diasUteisDecorridos > 0 ? (p.diasUteisDecorridos >= p.diasUteisTotal ? b.realizado : b.realizado / p.diasUteisDecorridos * p.diasUteisTotal) : null
  return {
    realizado: b.realizado, vendas: b.vendas, meta,
    gap: meta !== null ? meta - b.realizado : null, pctMeta: meta !== null ? b.realizado / meta * 100 : null,
    ticket: b.vendas > 0 ? b.realizado / b.vendas : null,
    projecao, pctProjecao: projecao !== null && meta !== null ? projecao / meta * 100 : null,
  }
}
/** Soma de linhas (para o total de um time): a meta só existe se alguma linha tiver meta. */
export function somar(linhas: KpiBruto[]): KpiBruto {
  const metas = linhas.map(l => l.meta).filter((m): m is number => m !== null && m > 0)
  return { realizado: Math.round(linhas.reduce((s, l) => s + l.realizado, 0) * 100) / 100, vendas: linhas.reduce((s, l) => s + l.vendas, 0), meta: metas.length ? metas.reduce((a, b) => a + b, 0) : null }
}
export type KpiTom = 'bom' | 'atencao' | 'ruim' | 'neutro'
/** A cor da linha vem da PROJEÇÃO: bate a meta (≥100%) = bom; 80 a 99% = atenção; abaixo de 80% = ruim. Sem projeção, usa o % já realizado. */
export function kpiTom(l: Pick<KpiLinha, 'pctMeta' | 'pctProjecao'>): KpiTom {
  const v = l.pctProjecao ?? l.pctMeta; if (v === null) return 'neutro'
  return v >= 100 ? 'bom' : v >= 80 ? 'atencao' : 'ruim'
}

// ── o que o servidor devolve ──
export interface KpiCloser extends KpiBruto { id: string; nome: string; avatar_url: string | null }
export interface KpiResposta {
  periodo: KpiPeriodo
  total: KpiBruto
  verticais: (KpiBruto & { id: string; label: string })[]
  times: { team: 'OAO' | 'R1'; label: string; total: KpiBruto; closers: KpiCloser[] }[]
  outros: { id: string; label: string; realizado: number; vendas: number }[]      // Self-Checkout, Embaixadores e closers sem time: entram no total, não têm meta
  forecast: KpiForecast | null                                                       // projeção do Forecast (só quando o período é o mês corrente até hoje); null = usa o ritmo por dias úteis
  truncated: boolean
}
