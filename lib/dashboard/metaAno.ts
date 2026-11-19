// ══ Meta do ANO: cálculo PURO (sem banco, sem tela) — a mesma conta no Forecast e no Telão Completo ═══════════════════════════
//  • Duas metas: ESSENCIAL (R$ 60 mi) e DESAFIO (R$ 72 mi). A barra é uma régua só, de 0 até o desafio; a essencial fica marcada no meio do caminho (83,3%).
//  • Realizado = receita de todas as vendas (novas e recorrentes) das 4 verticais ativas, de 1º de janeiro até hoje (horário de Brasília).
//  • "Por dia" = quanto falta ÷ dias que ainda restam depois de hoje (o mesmo critério da rota do mês).
export const META_ANO_ESSENCIAL = 60_000_000
export const META_ANO_DESAFIO = 72_000_000
export type FaseAno = 'caminho' | 'essencial' | 'desafio'       // caminho: ainda abaixo da essencial · essencial: já bateu a essencial · desafio: bateu o desafio

export interface MetaAno {
  ano: number; realizado: number; essencial: number; desafio: number
  pctEssencial: number; pctDesafio: number        // não travam em 100: passam disso quando supera
  fase: FaseAno
  faltaEssencial: number; faltaDesafio: number    // nunca negativos
  diasRestantes: number; porDiaEssencial: number | null; porDiaDesafio: number | null     // null: não há mais dias (ou já bateu)
  fillPct: number; markPct: number                // posição na régua (0 a 100): fim do preenchimento e marca da essencial
}
const diasNoAno = (y: number) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365)
/** Quantos dias faltam DEPOIS de hoje até 31/12. `today` = AAAA-MM-DD (Brasília). */
export function diasRestantesAno(today: string): number {
  const [y, m, d] = today.split('-').map(Number); if (!y || !m || !d) return 0
  const doAno = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
  return Math.max(diasNoAno(y) - doAno, 0)
}
export function buildMetaAno(realizado: number, today: string, essencial = META_ANO_ESSENCIAL, desafio = META_ANO_DESAFIO): MetaAno {
  const r = Math.max(Number.isFinite(realizado) ? realizado : 0, 0), dias = diasRestantesAno(today)
  const faltaE = Math.max(essencial - r, 0), faltaD = Math.max(desafio - r, 0)
  return {
    ano: +today.slice(0, 4), realizado: r, essencial, desafio,
    pctEssencial: essencial > 0 ? r / essencial * 100 : 0, pctDesafio: desafio > 0 ? r / desafio * 100 : 0,
    fase: r >= desafio ? 'desafio' : r >= essencial ? 'essencial' : 'caminho',
    faltaEssencial: faltaE, faltaDesafio: faltaD, diasRestantes: dias,
    porDiaEssencial: dias > 0 && faltaE > 0 ? faltaE / dias : null, porDiaDesafio: dias > 0 && faltaD > 0 ? faltaD / dias : null,
    fillPct: desafio > 0 ? Math.min(r / desafio * 100, 100) : 0, markPct: desafio > 0 ? essencial / desafio * 100 : 100,
  }
}
/** Soma o ano (1º de janeiro até hoje) de uma lista de vendas já em horário de Brasília (`day` = AAAA-MM-DD). Só as verticais pedidas. */
export function realizadoDoAno(sales: { day: string; value: number; vertical: string }[], ano: number, verticais: readonly string[]): number {
  const pre = `${ano}-`; let s = 0
  for (const v of sales) if (v.day.startsWith(pre) && verticais.includes(v.vertical) && Number.isFinite(v.value)) s += v.value
  return Math.round(s * 100) / 100
}
