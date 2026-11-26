import assert from 'node:assert/strict'
import { sintetizarGol, tocarSomGol, DURACAO_GOL } from '../../lib/telao/somGol'
const ok = (n: string, f: () => void) => { f(); console.log('ok  ' + n) }
// contexto de áudio falso: só conta o que foi criado
function falso() {
  const c = { osc: 0, src: 0, filtros: 0, destino: 0 }
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
  const no = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} })
  const ctx: any = {
    currentTime: 0, sampleRate: 8000, destination: { id: 'dest' },
    createGain: () => ({ ...no(), gain: param() }),
    createOscillator: () => { c.osc++; return { ...no(), frequency: param(), detune: param(), type: 'sine' } },
    createBufferSource: () => { c.src++; return { ...no(), buffer: null } },
    createBiquadFilter: () => { c.filtros++; return { ...no(), frequency: param(), Q: param(), type: 'lowpass' } },
    createDynamicsCompressor: () => ({ ...no(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBuffer: (_ch: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  }
  return { ctx, c }
}
ok('sintetizarGol monta pancada + torcida (2 camadas) + corneta (2 buzinadas × 3 notas × 2) e devolve a duração', () => {
  const { ctx, c } = falso(); assert.equal(sintetizarGol(ctx), DURACAO_GOL)
  assert.equal(c.src, 2); assert.equal(c.osc, 1 + 1 + 2 * (1 + 6))   // pancada + LFO da gritaria + (vibrato + 6 serras) × 2 buzinadas
})
ok('duração do som de gol é curta o bastante para vendas seguidas (≤ 4 s)', () => { assert.ok(DURACAO_GOL > 2 && DURACAO_GOL <= 4) })
ok('tocarSomGol sem contexto de áudio não quebra; pedidos colados (<0,9 s) são ignorados e depois de 0,9 s toca de novo', () => {
  const realNow = Date.now; let t = 1_000_000; Date.now = () => t
  try {
    tocarSomGol(null)
    t += 2000; const { ctx, c } = falso(); tocarSomGol(ctx); assert.equal(c.src, 2)     // tocou
    t += 300;  tocarSomGol(ctx); assert.equal(c.src, 2)                                  // colado: ignorado
    t += 1000; tocarSomGol(ctx); assert.equal(c.src, 4)                                  // passou de 0,9 s: toca
  } finally { Date.now = realNow }
})
