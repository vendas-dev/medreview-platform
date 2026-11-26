// Som de GOL para a animação de venda (Telão e Telão Completo).
// Dois caminhos:
//  1) se existir o arquivo public/sons/gol.mp3 (ou .wav/.ogg), toca ELE (um "GOOOL" de verdade, que você escolher/licenciar);
//  2) senão, gera na hora um som de estádio com a Web Audio API: batida na rede + corneta (2 buzinadas) + rugido da torcida que
//     cresce e some em ~3,4 s. Não usa nenhum áudio protegido.
// A função pura `sintetizarGol` recebe qualquer BaseAudioContext (também o OfflineAudioContext, usado nos testes).

export const DURACAO_GOL = 3.4

/** Ruído rosa (mais "encorpado" que o branco): base do rugido da torcida. */
function ruidoRosa(ctx: BaseAudioContext, segundos: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * segundos))
  const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852
    b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926
  }
  return buf
}

/** Monta o som de gol a partir de `quando` segundos (relativo ao relógio do contexto). Devolve a duração. */
export function sintetizarGol(ctx: BaseAudioContext, quando = 0, volume = 1): number {
  const t0 = ctx.currentTime + quando, dur = DURACAO_GOL
  const saida = ctx.createGain(); saida.gain.value = Math.max(0, Math.min(1, volume)) * .9
  const comp = ctx.createDynamicsCompressor()   // segura os picos (várias camadas somadas) sem estourar o alto-falante
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .25
  saida.connect(comp); comp.connect(ctx.destination)

  // 1) bola na rede: pancada grave curta
  { const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + .16)
    g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(.7, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + .22)
    o.connect(g); g.connect(saida); o.start(t0); o.stop(t0 + .25) }

  // 2) torcida: ruído rosa que "abre" (filtro sobe), segura e vai sumindo
  { const s = ctx.createBufferSource(); s.buffer = ruidoRosa(ctx, dur + .3)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .7
    bp.frequency.setValueAtTime(380, t0); bp.frequency.linearRampToValueAtTime(1150, t0 + .6); bp.frequency.linearRampToValueAtTime(720, t0 + dur)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170
    const g = ctx.createGain()
    g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(.95, t0 + .45); g.gain.setValueAtTime(.95, t0 + 1.7)
    g.gain.linearRampToValueAtTime(.4, t0 + 2.6); g.gain.linearRampToValueAtTime(.0001, t0 + dur)   // vai morrendo aos poucos
    s.connect(bp); bp.connect(hp); hp.connect(g); g.connect(saida); s.start(t0); s.stop(t0 + dur + .1) }

  // 3) gritaria aguda da torcida ("ê-ê-ê"): ruído mais agudo com a altura modulada (~7 vezes por segundo)
  { const s = ctx.createBufferSource(); s.buffer = ruidoRosa(ctx, dur + .3)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 1.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(.0001, t0 + .2); g.gain.linearRampToValueAtTime(.32, t0 + .8); g.gain.setValueAtTime(.32, t0 + 1.7)
    g.gain.linearRampToValueAtTime(.14, t0 + 2.6); g.gain.linearRampToValueAtTime(.0001, t0 + dur - .1)
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = 350
    lfo.connect(lg); lg.connect(bp.frequency)
    s.connect(bp); bp.connect(g); g.connect(saida); s.start(t0); s.stop(t0 + dur + .1); lfo.start(t0); lfo.stop(t0 + dur + .1) }

  // 4) corneta de estádio: acorde de 3 notas (serra) em duas buzinadas — curta e longa
  { const buzina = (ini: number, fim: number, pico: number) => {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = 2
      g.gain.setValueAtTime(.0001, t0 + ini); g.gain.linearRampToValueAtTime(pico, t0 + ini + .025)
      g.gain.setValueAtTime(pico, t0 + fim - .05); g.gain.exponentialRampToValueAtTime(.0001, t0 + fim + .22)
      lp.connect(g); g.connect(saida)
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.value = 3.2; vib.connect(vg)
      vib.start(t0 + ini); vib.stop(t0 + fim + .3)
      ;[349.23, 440, 523.25].forEach(f => [-7, 7].forEach(cents => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents
        vg.connect(o.frequency); o.connect(lp); o.start(t0 + ini); o.stop(t0 + fim + .3)
      }))
    }
    buzina(.06, .42, .06); buzina(.56, 1.85, .075) }

  return dur
}

// ── arquivo opcional (public/sons/gol.*) ──────────────────────────────────────────────────────────────────────────────
let arquivo: string | null | undefined   // undefined = ainda não verificou; null = não existe
let ultimo = 0
let atual: HTMLAudioElement | null = null
const MAX_ARQUIVO_S = 8   // trava de segurança: um arquivo mais longo que a animação (7 s) é cortado aqui

/** Chame uma vez quando o som for ligado: descobre se há um arquivo de gol em public/sons. */
export function prepararSomGol() {
  if (arquivo !== undefined || typeof fetch === 'undefined') return
  arquivo = null
  ;(async () => {
    for (const ext of ['mp3', 'wav', 'ogg']) {
      try {
        const r = await fetch(`/sons/gol.${ext}`, { method: 'HEAD', cache: 'no-store' })
        if (r.ok && (r.headers.get('content-type') ?? '').toLowerCase().includes('audio')) { arquivo = `/sons/gol.${ext}`; const pre = new Audio(arquivo); pre.preload = 'auto'; return }   // pré-carrega: toca sem atraso
      } catch {}
    }
  })()
}

/** Toca o som de gol (arquivo, se houver; senão o sintetizado). Ignora pedidos colados (<0,9 s) para não empilhar. */
export function tocarSomGol(ctx: AudioContext | null, volume = 1) {
  const agora = Date.now()
  if (agora - ultimo < 900) return
  ultimo = agora
  if (arquivo) {
    try {
      if (atual) { atual.pause(); atual = null }   // uma venda nova corta a anterior (nunca dois sons por cima)
      const a = new Audio(arquivo); a.volume = Math.max(0, Math.min(1, volume)); atual = a
      void a.play().catch(() => { if (atual === a) atual = null; if (ctx) sintetizarGol(ctx, 0, volume) })
      setTimeout(() => { if (atual === a) { a.pause(); atual = null } }, MAX_ARQUIVO_S * 1000)
      return
    } catch {}
  }
  if (ctx) { try { void ctx.resume?.(); sintetizarGol(ctx, 0, volume) } catch {} }
}
