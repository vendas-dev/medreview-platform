import { SimResult, fmt } from './pricing'

interface NegParams {
  produtoLabel:    string
  precoCheio:      number
  precoBase:       number
  result:          SimResult
  upsellLabel?:    string
  upsellPrice?:    number
  cashDiscountPct: number
}

// ── Helpers de canvas ─────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function strikeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const w = ctx.measureText(text).width
  ctx.fillText(text, x, y)
  ctx.beginPath()
  ctx.moveTo(x, y - 4)
  ctx.lineTo(x + w, y - 4)
  ctx.lineWidth = 2
  ctx.stroke()
}

// ── Gerador principal ─────────────────────────────────────────
export async function generateNegotiationImage(p: NegParams): Promise<Blob | null> {
  const DPR = 2
  const W   = 800

  // Calcular altura necessária
  const lineCount = p.result.parcelas?.length ?? 0
  const H = 320 + lineCount * 44 + (p.result.aVista !== undefined ? 80 : 0)

  const canvas = document.createElement('canvas')
  canvas.width  = W  * DPR
  canvas.height = H  * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  // ── Background gradient ───────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0,    '#0f0320')
  bg.addColorStop(0.35, '#1e0b45')
  bg.addColorStop(0.7,  '#2e1b7a')
  bg.addColorStop(1,    '#3730a3')
  roundRect(ctx, 0, 0, W, H, 20)
  ctx.fillStyle = bg
  ctx.fill()

  // Círculo decorativo top-right
  ctx.beginPath()
  ctx.arc(W - 60, 80, 110, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(W - 60, 80, 70, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fill()

  // Círculo decorativo bottom-left
  ctx.beginPath()
  ctx.arc(80, H - 60, 90, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(99,102,241,0.12)'
  ctx.fill()

  // ── Header ────────────────────────────────────────────────
  const headerH = 72
  const headerGrad = ctx.createLinearGradient(0, 0, W, headerH)
  headerGrad.addColorStop(0, 'rgba(255,255,255,0.08)')
  headerGrad.addColorStop(1, 'rgba(255,255,255,0.03)')
  roundRect(ctx, 0, 0, W, headerH, 0)
  ctx.fillStyle = headerGrad
  ctx.fill()

  // Linha separadora header
  ctx.beginPath()
  ctx.moveTo(0, headerH)
  ctx.lineTo(W, headerH)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Logo text
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.letterSpacing = '3px'
  ctx.fillText('MEDREVIEW', 32, 32)
  ctx.letterSpacing = '0px'

  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('Proposta Comercial', 32, 56)

  // Data no canto
  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  ctx.font = '13px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'right'
  ctx.fillText(now, W - 32, 44)
  ctx.textAlign = 'left'

  let y = headerH + 36

  // ── Produto ───────────────────────────────────────────────
  ctx.font = '15px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = 'rgba(167,139,250,0.9)'
  ctx.fillText('PRODUTO', 40, y)
  y += 26

  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(p.produtoLabel, 40, y)
  y += p.upsellLabel ? 24 : 36

  if (p.upsellLabel && p.upsellPrice) {
    ctx.font = '14px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
    ctx.fillStyle = 'rgba(167,139,250,0.8)'
    ctx.fillText(`+ ${p.upsellLabel}`, 40, y)
    y += 30
  }

  // ── Preços De / Por ───────────────────────────────────────
  const totalCheio = p.precoCheio + (p.upsellPrice ?? 0)
  const totalBase  = p.precoBase  + (p.upsellPrice ?? 0)
  const economia   = totalCheio - totalBase
  const pctOff     = Math.round((1 - totalBase / totalCheio) * 100)

  // Card de preço
  roundRect(ctx, 32, y, W - 64, 100, 16)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fill()
  roundRect(ctx, 32, y, W - 64, 100, 16)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  const cardMid = y + 50
  // De (riscado)
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = '#f87171'
  ctx.strokeStyle = '#f87171'
  strikeText(ctx, `De: ${fmt(totalCheio)}`, 60, cardMid + 6)

  // Arrow
  ctx.font = '28px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('→', 280, cardMid + 10)

  // Por (verde, grande)
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = '#4ade80'
  ctx.fillText(fmt(totalBase), 330, cardMid + 12)
  y += 116

  // ── Badge economia ────────────────────────────────────────
  const econText = `✅  Economia de ${fmt(economia)}  (${pctOff}% off)`
  const econW    = ctx.measureText(econText).width + 44

  roundRect(ctx, 32, y, econW, 36, 999)
  ctx.fillStyle = 'rgba(74,222,128,0.15)'
  ctx.fill()
  roundRect(ctx, 32, y, econW, 36, 999)
  ctx.strokeStyle = 'rgba(74,222,128,0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = '#4ade80'
  ctx.fillText(econText, 54, y + 23)
  y += 58

  // ── Separador ─────────────────────────────────────────────
  ctx.beginPath()
  ctx.moveTo(32, y)
  ctx.lineTo(W - 32, y)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  ctx.stroke()
  y += 28

  // ── Forma de pagamento ────────────────────────────────────
  const modeLabel =
    p.result.mode === 'avista'    ? '💵  Pagamento à Vista' :
    p.result.mode === 'parcelado' ? (p.result.rate === 0 ? '📅  Parcelamento Sem Juros' : '📅  Parcelamento') :
    p.result.mode === '3x'        ? '3️⃣  3x Sem Juros' :
    p.result.mode === 'manual'    ? '⚙️  Parcelamento' :
    '🎯  Condição Especial'

  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = '#a78bfa'
  ctx.fillText(modeLabel.toUpperCase(), 40, y)
  y += 30

  // À vista
  if (p.result.aVista !== undefined) {
    const avista = p.result.aVista
    const econ2  = totalBase - avista

    roundRect(ctx, 32, y, W - 64, 72, 14)
    ctx.fillStyle = 'rgba(74,222,128,0.08)'
    ctx.fill()
    roundRect(ctx, 32, y, W - 64, 72, 14)
    ctx.strokeStyle = 'rgba(74,222,128,0.25)'
    ctx.stroke()

    // Badge desconto
    roundRect(ctx, 52, y + 10, 180, 24, 999)
    ctx.fillStyle = 'rgba(74,222,128,0.2)'
    ctx.fill()
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
    ctx.fillStyle = '#4ade80'
    ctx.fillText(`✨  ${p.cashDiscountPct}% de desconto`, 64, y + 26)

    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
    ctx.fillStyle = '#4ade80'
    ctx.fillText(fmt(avista), 52, y + 60)

    ctx.font = '13px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
    ctx.fillStyle = 'rgba(74,222,128,0.7)'
    ctx.textAlign = 'right'
    ctx.fillText(`💚 Economize mais ${fmt(econ2)} hoje!`, W - 52, y + 50)
    ctx.textAlign = 'left'
    y += 88
  }

  // Parcelas
  if (p.result.parcelas?.length) {
    const total = p.result.parcelas.length
    p.result.parcelas.forEach(({ n, valor }, idx) => {
      const isLast = idx === total - 1
      const rowH   = 42

      // Fundo alternado
      roundRect(ctx, 32, y, W - 64, rowH, 10)
      ctx.fillStyle = isLast
        ? 'rgba(99,102,241,0.15)'
        : idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)'
      ctx.fill()

      if (isLast) {
        roundRect(ctx, 32, y, W - 64, rowH, 10)
        ctx.strokeStyle = 'rgba(99,102,241,0.35)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Badge Nx
      const bW = 38; const bH = 26
      roundRect(ctx, 48, y + (rowH - bH) / 2, bW, bH, 7)
      ctx.fillStyle = isLast ? '#4f46e5' : 'rgba(255,255,255,0.08)'
      ctx.fill()

      ctx.font = `bold 13px -apple-system, BlinkMacSystemFont, Inter, sans-serif`
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText(`${n}x`, 48 + bW / 2, y + rowH / 2 + 5)
      ctx.textAlign = 'left'

      // Valor
      ctx.font = `${isLast ? 'bold' : ''} ${isLast ? 17 : 16}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`
      ctx.fillStyle = isLast ? '#a78bfa' : '#fff'
      ctx.fillText(`${n}x de`, 100, y + rowH / 2 + 5)

      ctx.font = `bold ${isLast ? 20 : 17}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`
      ctx.fillStyle = isLast ? '#4ade80' : '#4ade80'
      const xPos = 100 + ctx.measureText(`${n}x de `).width + (isLast ? 2 : 0)
      ctx.fillText(fmt(valor), xPos, y + rowH / 2 + 5)

      if (isLast && total > 3) {
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
        ctx.fillStyle = 'rgba(167,139,250,0.8)'
        ctx.textAlign = 'right'
        ctx.fillText('⭐ Maior parcelamento', W - 52, y + rowH / 2 + 5)
        ctx.textAlign = 'left'
      }

      if (p.result.rate === 0) {
        ctx.font = '11px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
        ctx.fillStyle = 'rgba(74,222,128,0.6)'
        ctx.textAlign = 'right'
        ctx.fillText('sem juros', W - 52, y + rowH / 2 + 5)
        ctx.textAlign = 'left'
      }

      y += rowH + 4
    })
  }

  y += 16

  // ── Footer ────────────────────────────────────────────────
  ctx.beginPath()
  ctx.moveTo(32, y)
  ctx.lineTo(W - 32, y)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()
  y += 16

  ctx.font = '12px -apple-system, BlinkMacSystemFont, Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.textAlign = 'center'
  ctx.fillText('Simulação comercial · Valores sujeitos a confirmação · MedReview', W / 2, y + 12)
  ctx.textAlign = 'left'

  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png', 1))
}

// ── Copiar imagem para clipboard ──────────────────────────────
export async function copyNegotiationToClipboard(params: NegParams): Promise<'image' | 'text' | 'error'> {
  try {
    const blob = await generateNegotiationImage(params)
    if (!blob) throw new Error('canvas failed')

    // Tentar copiar como imagem
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'image'
    }
    throw new Error('ClipboardItem not supported')
  } catch {
    // Fallback: texto
    try {
      const { buildFullNegotiationText } = await import('./pricing')
      const text = buildFullNegotiationText({
        produtoLabel:  params.produtoLabel,
        precoCheio:    params.precoCheio,
        precoBase:     params.precoBase,
        result:        params.result,
        upsellLabel:   params.upsellLabel,
        upsellPrice:   params.upsellPrice,
      })
      await navigator.clipboard.writeText(text)
      return 'text'
    } catch {
      return 'error'
    }
  }
}
