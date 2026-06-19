import { AppSettings, PaymentMode } from './types'

export function parseBRL(s: string | number): number {
  if (typeof s === 'number') return s
  if (!s) return 0
  return parseFloat(String(s).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0
}

export const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

export function rateForVertical(vertical: string, settings: AppSettings): number {
  return settings.verticalRates[vertical] ?? settings.defaultMonthlyRate
}

// 1x = sempre preço cheio (sem juros, sem desconto)
export function pmt(PV: number, monthlyRatePct: number, n: number): number {
  if (n <= 0 || PV <= 0) return 0
  if (n === 1) return PV
  const i = monthlyRatePct / 100
  if (i === 0) return PV / n
  const f = Math.pow(1 + i, n)
  return PV * (i * f) / (f - 1)
}

export interface SimResult {
  mode:        PaymentMode
  rate:        number
  aVista?:     number
  cashDisc?:   number       // % desconto aplicado
  parcelas?:   { n: number; valor: number }[]
  eventoBase?: number
  eventoSub?:  'avista' | 'parcelado'
}

export function simulate(
  PV:          number,
  mode:        PaymentMode,
  settings:    AppSettings,
  vertical:    string,
  manualN?:    number,
  manualRate?: number,
  eventoSub?:  'avista' | 'parcelado',
): SimResult {
  const rate     = rateForVertical(vertical, settings)
  const cashDisc = settings.cashDiscountPercent

  switch (mode) {
    case 'avista':
      return { mode, rate, cashDisc, aVista: PV * (1 - cashDisc / 100) }

    case 'parcelado':
      return {
        mode, rate,
        parcelas: Array.from({ length: 12 }, (_, i) => ({
          n: i + 1, valor: pmt(PV, rate, i + 1),
        })),
      }

    case '3x':
      // Mostra 1x, 2x e 3x — sem juros
      return {
        mode, rate: 0,
        parcelas: [1, 2, 3].map(n => ({ n, valor: PV / n })),
      }

    case 'manual': {
      const n = manualN  ?? 12
      const r = manualRate ?? rate
      // Mostra TODAS as opções de 1x até nx
      return {
        mode, rate: r,
        parcelas: Array.from({ length: n }, (_, i) => ({
          n: i + 1, valor: pmt(PV, r, i + 1),
        })),
      }
    }

    case 'evento': {
      const disc       = settings.eventDiscounts[vertical] ?? 0
      const eventoBase = PV * (1 - disc / 100)
      const sub        = eventoSub ?? 'parcelado'
      if (sub === 'avista') {
        return { mode, rate, cashDisc, eventoBase, eventoSub: sub, aVista: eventoBase * (1 - cashDisc / 100) }
      }
      return {
        mode, rate, eventoBase, eventoSub: sub,
        parcelas: Array.from({ length: 12 }, (_, i) => ({
          n: i + 1, valor: pmt(eventoBase, rate, i + 1),
        })),
      }
    }
  }
}

// ── Texto resumo para copiar ──────────────────────────────────
export function buildCopyText(result: SimResult, label: string): string {
  const lines = [`*${label}*`, '']
  if (result.aVista !== undefined) {
    lines.push(`💵 À vista: ${fmt(result.aVista)}${result.cashDisc ? ` (${result.cashDisc}% off)` : ''}`)
  } else if (result.parcelas?.length) {
    const sem = result.rate === 0
    lines.push(sem ? 'Parcelamento sem juros:' : `Parcelamento (${result.rate}% a.m.):`)
    result.parcelas.forEach(p => lines.push(`  ${p.n}x de ${fmt(p.valor)}`))
  }
  return lines.join('\n')
}

// ── Texto completo da negociação (apelativo pro lead) ─────────
export function buildFullNegotiationText(params: {
  produtoLabel: string
  precoCheio:   number
  precoBase:    number
  result:       SimResult
  upsellLabel?: string
  upsellPrice?: number
}): string {
  const { produtoLabel, precoCheio, precoBase, result, upsellLabel, upsellPrice = 0 } = params
  const totalCheio = precoCheio + upsellPrice
  const totalBase  = precoBase  + upsellPrice
  const economia   = totalCheio - totalBase
  const pctOff     = Math.round((1 - totalBase / totalCheio) * 100)
  const sem        = result.rate === 0

  const lines: string[] = []

  lines.push('🔥 *PROPOSTA EXCLUSIVA MEDREVIEW* 🔥')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(`📦 *${produtoLabel}*`)
  if (upsellLabel && upsellPrice > 0) lines.push(`   ➕ ${upsellLabel}`)
  lines.push('')
  lines.push('💰 *SEU INVESTIMENTO ESPECIAL:*')
  lines.push(`   ~~${fmt(totalCheio)}~~ ← valor normal`)
  lines.push(`   *${fmt(totalBase)}* ← seu preço especial`)
  lines.push('')
  lines.push(`🎯 *Você economiza ${fmt(economia)} — ${pctOff}% OFF!*`)
  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('💳 *FORMAS DE PAGAMENTO:*')

  if (result.aVista !== undefined) {
    const disc  = result.cashDisc ?? 5
    const econ2 = totalBase - result.aVista
    lines.push('')
    lines.push(`💵 *À Vista — ${disc}% de desconto adicional*`)
    lines.push(`   👉 *${fmt(result.aVista)}*`)
    if (econ2 > 0) lines.push(`   💚 Economize mais ${fmt(econ2)} pagando hoje!`)
  }

  if (result.parcelas?.length) {
    const header = result.mode === '3x'    ? '3️⃣  *3x Sem Juros*'
                 : result.mode === 'manual' ? '⚙️  *Parcelamento*'
                 : result.mode === 'evento' ? '🎯  *Condição Evento*'
                 : sem ? '📅  *Parcelamento Sem Juros*'
                 : `📅  *Parcelamento*`
    lines.push('')
    lines.push(header)
    result.parcelas.forEach((p, i) => {
      const isLast = i === result.parcelas!.length - 1
      const star   = isLast && result.parcelas!.length > 3 ? '⭐ ' : '   '
      lines.push(`${star}${p.n}x de *${fmt(p.valor)}*${sem && p.n > 1 ? ' (sem juros)' : ''}`)
    })
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('✨ *Condição exclusiva e por tempo limitado!*')
  lines.push('💬 Me fala qual opção faz mais sentido pra você!')

  return lines.join('\n')
}
