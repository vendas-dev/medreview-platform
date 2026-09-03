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
  parcelas?:   { n: number; valor: number }[]
  eventoBase?: number
  eventoSub?:  'avista' | 'parcelado'
}

// IMPORTANTE: PV que chega aqui já é o valor NEGOCIADO (depois do desconto
// manual da barra/campo de valor desejado, aplicado lá em CalculadoraView).
// Por isso 'avista' não aplica nenhum desconto de novo — só devolve o PV
// como o valor a pagar. O desconto de à vista deixou de ser um número fixo
// travado nas configurações; agora é a própria barra de negociação, que só
// usa a configuração como ponto de partida sugerido ao escolher "à vista".
export function simulate(
  PV:          number,
  mode:        PaymentMode,
  settings:    AppSettings,
  vertical:    string,
  manualN?:    number,
  manualRate?: number,
  eventoSub?:  'avista' | 'parcelado',
): SimResult {
  const rate = rateForVertical(vertical, settings)

  switch (mode) {
    case 'avista':
      return { mode, rate, aVista: PV }

    case 'parcelado':
      return {
        mode, rate,
        parcelas: Array.from({ length: 12 }, (_, i) => ({
          n: i + 1, valor: pmt(PV, rate, i + 1),
        })),
      }

    case '3x':
      return {
        mode, rate: 0,
        parcelas: [1, 2, 3].map(n => ({ n, valor: PV / n })),
      }

    case 'manual': {
      const n = manualN  ?? 12
      const r = manualRate ?? rate
      return {
        mode, rate: r,
        parcelas: Array.from({ length: n }, (_, i) => ({
          n: i + 1, valor: pmt(PV, r, i + 1),
        })),
      }
    }

    case 'evento': {
      // Desconto de evento continua sendo a regra própria dele (configurado
      // por vertical) — soma em cima do PV que já vem negociado pela barra.
      const disc       = settings.eventDiscounts[vertical] ?? 0
      const eventoBase = PV * (1 - disc / 100)
      const sub        = eventoSub ?? 'parcelado'
      if (sub === 'avista') {
        return { mode, rate, eventoBase, eventoSub: sub, aVista: eventoBase }
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

// ── Texto resumo para copiar (formato antigo, mantido por compatibilidade) ──
export function buildCopyText(result: SimResult, label: string): string {
  const lines = [`*${label}*`, '']
  if (result.aVista !== undefined) {
    lines.push(`💵 À vista: ${fmt(result.aVista)}`)
  } else if (result.parcelas?.length) {
    const sem = result.rate === 0
    lines.push(sem ? 'Parcelamento sem juros:' : `Parcelamento (${result.rate}% a.m.):`)
    result.parcelas.forEach(p => lines.push(`  ${p.n}x de ${fmt(p.valor)}`))
  }
  return lines.join('\n')
}

// ── Mensagem padrão pro WhatsApp — usada tanto pelos botões de copiar
// quanto pela prévia ao vivo, garantindo que o que se vê é exatamente o
// que se copia (nunca diverge).
//
// Formato simplificado: mostra só o valor final de cada condição (sem o
// "De X por Y" do preço cheio) — "Parcelado" mostra só "Nx de R$X", "À
// vista" mostra só o valor final. totalCheio continua no parâmetro por
// compatibilidade com quem já chama essa função, mas não é mais usado
// aqui dentro. ──────────────────────────────────────────────────────
export function buildWhatsAppMessage(params: {
  cursoLabel:   string
  tempoAcesso?: string
  entregaveis?: string
  totalCheio:   number
  totalBase:    number
  result:       SimResult
  parcela?:     { n: number; valor: number } | null
}): string {
  const { cursoLabel, tempoAcesso, entregaveis, totalBase, result, parcela } = params
  const lines: (string | null)[] = [
    `*Curso:* ${cursoLabel}`,
    tempoAcesso ? `*Tempo de Acesso:* ${tempoAcesso}` : null,
    entregaveis ? `*Entregáveis:* ${entregaveis}` : null,
  ]
  if (parcela && parcela.n >= 2) {
    lines.push(`*Parcelado:* ${parcela.n}x de ${fmt(parcela.valor)}`)
  }
  lines.push(`*À vista:* ${fmt(totalBase)}`)
  return lines.filter(Boolean).join('\n')
}

// ── Texto completo da negociação (usado pelo lib/canvas.ts) ───────────
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
    lines.push('')
    lines.push(`💵 *À Vista*`)
    lines.push(`   👉 *${fmt(result.aVista)}*`)
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
