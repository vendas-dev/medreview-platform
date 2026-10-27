// ── Leitor do stream da API da Anthropic (SSE) ───────────────────────────────────────────────
// Eventos: message_start (tokens de entrada) · content_block_delta (pedaços de texto) · message_delta (motivo de parada, tokens de saída) · message_stop · error · ping.
// Os pedaços chegam em qualquer corte (no meio de uma linha, de um JSON ou de um caractere UTF-8): tudo é acumulado até fechar um evento (linha em branco).
export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; stopReason: string | null; tokensIn: number; tokensOut: number }
  | { type: 'error'; message: string }

export async function* parseAnthropicStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader(), dec = new TextDecoder('utf-8')
  let buf = '', stopReason: string | null = null, tokensIn = 0, tokensOut = 0, finished = false
  const handle = (block: string): StreamEvent[] => {
    const out: StreamEvent[] = []
    const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).replace(/^ /, '')).join('\n')
    if (!data || data === '[DONE]') return out
    let ev: any; try { ev = JSON.parse(data) } catch { return out }
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && typeof ev.delta.text === 'string' && ev.delta.text) out.push({ type: 'text', text: ev.delta.text })
    else if (ev.type === 'message_start') tokensIn = Number(ev.message?.usage?.input_tokens ?? 0) + Number(ev.message?.usage?.cache_read_input_tokens ?? 0) + Number(ev.message?.usage?.cache_creation_input_tokens ?? 0)
    else if (ev.type === 'message_delta') { if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason; if (ev.usage?.output_tokens != null) tokensOut = Number(ev.usage.output_tokens) }
    else if (ev.type === 'message_stop') { finished = true; out.push({ type: 'done', stopReason, tokensIn, tokensOut }) }
    else if (ev.type === 'error') out.push({ type: 'error', message: String(ev.error?.message ?? 'Erro na API da IA') })
    return out
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
        const m = /\r?\n\r?\n/.exec(buf)!, block = buf.slice(0, idx); buf = buf.slice(idx + m[0].length)
        for (const e of handle(block)) { yield e; if (e.type === 'error') return }          // a API mandou um erro: ele é o motivo real, nada de segundo erro por cima
      }
    }
    buf += dec.decode()
    if (buf.trim()) for (const e of handle(buf)) yield e
    if (!finished) yield { type: 'error', message: 'A conexão com a IA foi interrompida antes do fim da resposta.' }
  } finally { try { reader.releaseLock() } catch { /* já liberado */ } }
}
