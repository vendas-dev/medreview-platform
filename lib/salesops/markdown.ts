// ── Markdown → AST (sem HTML, sem dependência) ────────────────────────────────────────────────
// A IA responde em markdown (passo a passo numerado, links, código, tabelas). Este parser gera uma ÁRVORE, nunca HTML: o React monta os elementos, então nada vindo da
// IA ou do que o time digita na base consegue injetar HTML/script. Links só passam se forem http(s), mailto, caminho interno (/…) ou âncora (#…).
// Tolerante a texto INCOMPLETO (a resposta chega aos poucos): cerca de código sem fechar vira código até o fim, etc.

export type Inline =
  | { t: 'text'; v: string } | { t: 'strong'; c: Inline[] } | { t: 'em'; c: Inline[] } | { t: 'del'; c: Inline[] }
  | { t: 'code'; v: string } | { t: 'link'; href: string; c: Inline[] } | { t: 'br' }
export type Align = 'left' | 'center' | 'right' | null
export type Block =
  | { t: 'p'; c: Inline[] } | { t: 'h'; level: 1 | 2 | 3 | 4; c: Inline[] } | { t: 'code'; lang: string; v: string }
  | { t: 'quote'; c: Block[] } | { t: 'hr' }
  | { t: 'list'; ordered: boolean; start: number; items: { checked: boolean | null; c: Block[] }[] }
  | { t: 'table'; head: Inline[][]; align: Align[]; rows: Inline[][][] }

/** Só deixa passar link seguro. Qualquer outra coisa (javascript:, data:, vbscript:, //host…) vira null. */
export function safeHref(raw: string): string | null {
  const u = String(raw ?? '').trim().replace(/[\u0000-\u001f\u007f\s]+/g, m => (m.includes(' ') ? ' ' : ''))
  if (!u || /\s/.test(u)) return null
  if (/^https?:\/\/[^\s]+$/i.test(u)) return u
  if (/^mailto:[^\s]+$/i.test(u)) return u
  if (/^\/(?!\/)[^\s]*$/.test(u)) return u
  if (/^#[^\s]*$/.test(u)) return u
  return null
}

// ── inline ────────────────────────────────────────────────────────────────────────────────────
const PUNCT_END = /[.,;:!?)\]}'"»]+$/
// inLink: estamos DENTRO do texto de um link. Link dentro de link é HTML inválido (<a> em <a>) e quebra a hidratação do React: lá dentro nada vira link (nem URL solta, nem [x](y)).
export function parseInline(src: string, inLink = false): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = '' } }
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    // escape
    if (ch === '\\' && i + 1 < n && /[\\`*_{}\[\]()#+\-.!~|>]/.test(src[i + 1])) { buf += src[i + 1]; i += 2; continue }
    // quebra de linha
    if (ch === '\n') { flush(); out.push({ t: 'br' }); i++; continue }
    // `código`
    if (ch === '`') {
      let k = 1; while (src[i + k] === '`') k++
      const fence = '`'.repeat(k), end = src.indexOf(fence, i + k)
      if (end > i + k) { flush(); out.push({ t: 'code', v: src.slice(i + k, end).replace(/^ (.*) $/s, '$1') }); i = end + k; continue }
      buf += fence; i += k; continue
    }
    // [texto](url)
    if (ch === '[' && !inLink) {
      let depth = 0, j = i
      for (; j < n; j++) { if (src[j] === '\\') { j++; continue } if (src[j] === '[') depth++; else if (src[j] === ']') { depth--; if (depth === 0) break } }
      if (j < n && src[j + 1] === '(') {
        let d2 = 0, k = j + 1
        for (; k < n; k++) { if (src[k] === '(') d2++; else if (src[k] === ')') { d2--; if (d2 === 0) break } }
        if (k < n) {
          const label = src.slice(i + 1, j), target = src.slice(j + 2, k).trim().replace(/\s+"[^"]*"$/, '').replace(/^<(.*)>$/, '$1')
          const href = safeHref(target)
          if (buf.endsWith('!')) buf = buf.slice(0, -1)                              // ![alt](url): nunca carrega imagem remota — vira link de texto
          flush()
          if (href) out.push({ t: 'link', href, c: parseInline(label, true) })
          else out.push(...parseInline(label, inLink))                              // link inseguro: fica só o texto
          i = k + 1; continue
        }
      }
      buf += ch; i++; continue
    }
    // <https://…>
    if (ch === '<' && !inLink) {
      const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(src.slice(i))
      if (m) { flush(); const h = safeHref(m[1]); if (h) out.push({ t: 'link', href: h, c: [{ t: 'text', v: m[1] }] }); else out.push({ t: 'text', v: m[0] }); i += m[0].length; continue }
    }
    // URL solta
    if (!inLink && (ch === 'h' || ch === 'H') && /^https?:\/\//i.test(src.slice(i, i + 8)) && (i === 0 || /[\s(\[>*_~]/.test(src[i - 1]))) {
      const m = /^https?:\/\/[^\s<>]+/i.exec(src.slice(i))                      // pode ser null: a resposta chegou cortada em "https://"
      if (m) {
        let url = m[0]; const tail = PUNCT_END.exec(url)
        if (tail) { let t = tail[0]; if (t.includes(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) t = t.replace(')', ''); url = url.slice(0, url.length - t.length) }
        const h = safeHref(url)
        if (h && url.length > 8) { flush(); out.push({ t: 'link', href: h, c: [{ t: 'text', v: url }] }); i += url.length; continue }
      }
    }
    // **negrito** / __negrito__
    if ((ch === '*' || ch === '_') && src[i + 1] === ch) {
      const mk = ch + ch, end = findClose(src, mk, i + 2)
      if (end > 0) { flush(); out.push({ t: 'strong', c: parseInline(src.slice(i + 2, end), inLink) }); i = end + 2; continue }
    }
    // ~~riscado~~
    if (ch === '~' && src[i + 1] === '~') {
      const end = findClose(src, '~~', i + 2)
      if (end > 0) { flush(); out.push({ t: 'del', c: parseInline(src.slice(i + 2, end), inLink) }); i = end + 2; continue }
    }
    // *itálico* / _itálico_  (não dentro de palavra pro "_")
    if (ch === '*' || ch === '_') {
      const prev = src[i - 1]
      if (!(ch === '_' && prev && /[A-Za-z0-9À-ÿ]/.test(prev))) {
        const end = findClose(src, ch, i + 1)
        if (end > 0 && !(ch === '_' && /[A-Za-z0-9À-ÿ]/.test(src[end + 1] ?? ''))) { flush(); out.push({ t: 'em', c: parseInline(src.slice(i + 1, end), inLink) }); i = end + 1; continue }
      }
    }
    buf += ch; i++
  }
  flush()
  return out
}
/** Acha o fechamento de ênfase: conteúdo não vazio, sem espaço colado na abertura/fechamento. */
function findClose(src: string, mk: string, from: number): number {
  if (!src[from] || /\s/.test(src[from])) return -1
  let k = from
  while (true) {
    k = src.indexOf(mk, k)
    if (k < 0) return -1
    if (src[k - 1] === '\\') { k += mk.length; continue }
    if (k > from && !/\s/.test(src[k - 1]) && (mk.length > 1 || src[k + 1] !== mk)) return k
    k += mk.length
  }
}

// ── blocos ────────────────────────────────────────────────────────────────────────────────────
const RE_FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/
const RE_HEAD = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const RE_HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const RE_QUOTE = /^\s{0,3}>\s?(.*)$/
const RE_LI = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const RE_TSEP_RAW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const RE_TSEP = { test: (l: string) => RE_TSEP_RAW.test(l) && (l.includes('|') || l.includes(':')) }   // um "-" sozinho é lista/linha, não separador de tabela

const splitRow = (line: string): string[] => {
  let s = line.trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []; let cur = ''
  for (let i = 0; i < s.length; i++) { if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++ } else if (s[i] === '|') { cells.push(cur.trim()); cur = '' } else cur += s[i] }
  cells.push(cur.trim()); return cells
}
const startsBlock = (l: string) => RE_FENCE.test(l) || RE_HEAD.test(l) || RE_HR.test(l) || RE_QUOTE.test(l) || RE_LI.test(l)
const indentOf = (l: string) => { let n = 0; for (const c of l) { if (c === ' ') n++; else if (c === '\t') n += 4; else break } return n }

export function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }
    let m = RE_FENCE.exec(line)
    if (m) {
      const fence = m[1], lang = m[2] ?? '', body: string[] = []; i++
      while (i < lines.length && !(new RegExp(`^\\s{0,3}${fence[0]}{${fence.length},}\\s*$`)).test(lines[i])) body.push(lines[i++])
      i++                                                                               // fechamento (ou fim do texto, se ainda estiver chegando)
      blocks.push({ t: 'code', lang, v: body.join('\n') }); continue
    }
    if ((m = RE_HEAD.exec(line))) { blocks.push({ t: 'h', level: Math.min(m[1].length, 4) as 1 | 2 | 3 | 4, c: parseInline(m[2]) }); i++; continue }
    if (RE_HR.test(line)) { blocks.push({ t: 'hr' }); i++; continue }
    if (RE_QUOTE.test(line)) {
      const q: string[] = []
      while (i < lines.length && RE_QUOTE.test(lines[i])) q.push(RE_QUOTE.exec(lines[i++])![1])
      blocks.push({ t: 'quote', c: parseBlocks(q) }); continue
    }
    if (line.includes('|') && i + 1 < lines.length && RE_TSEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line), sep = splitRow(lines[i + 1])
      if (head.length === sep.length || head.length > 1) {
        const align: Align[] = sep.map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null))
        const rows: Inline[][][] = []; i += 2
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) { const r = splitRow(lines[i++]); rows.push(head.map((_, k) => parseInline(r[k] ?? ''))) }
        blocks.push({ t: 'table', head: head.map(c => parseInline(c)), align: head.map((_, k) => align[k] ?? null), rows }); continue
      }
    }
    if ((m = RE_LI.exec(line))) {
      const baseIndent = indentOf(line), ordered = /\d/.test(m[2]), start = ordered ? parseInt(m[2], 10) : 1
      const items: { checked: boolean | null; c: Block[] }[] = []
      while (i < lines.length) {
        const lm = RE_LI.exec(lines[i])
        if (!lm || indentOf(lines[i]) !== baseIndent || /\d/.test(lm[2]) !== ordered) break
        const markerW = lm[1].length + lm[2].length + 1
        let first = lm[3], checked: boolean | null = null
        const ck = /^\[( |x|X)\]\s+(.*)$/.exec(first); if (ck) { checked = ck[1] !== ' '; first = ck[2] }
        const body = [first]; i++
        while (i < lines.length) {
          const l = lines[i]
          if (l.trim() === '') {                                                         // linha em branco: só continua o item se a próxima for indentada mais fundo
            let j = i + 1; while (j < lines.length && lines[j].trim() === '') j++
            if (j < lines.length && indentOf(lines[j]) > baseIndent) { body.push(''); i++; continue }
            break
          }
          if (indentOf(l) > baseIndent) { body.push(l.slice(Math.min(markerW, indentOf(l)))); i++; continue }
          if (!startsBlock(l) && body[body.length - 1] !== '') { body.push(l.trim()); i++; continue }      // continuação "preguiçosa" do parágrafo
          break
        }
        items.push({ checked, c: parseBlocks(body) })
        while (i < lines.length && lines[i].trim() === '' && i + 1 < lines.length && RE_LI.test(lines[i + 1]) && indentOf(lines[i + 1]) === baseIndent) i++   // lista "solta": linha em branco entre itens
      }
      blocks.push({ t: 'list', ordered, start, items }); continue
    }
    // parágrafo
    const p: string[] = [line]; i++
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && RE_TSEP.test(lines[i + 1]))) p.push(lines[i++])
    blocks.push({ t: 'p', c: parseInline(p.map(s => s.trim()).join('\n')) })
  }
  return blocks
}

export function parseMarkdown(src: string): Block[] {
  return parseBlocks(String(src ?? '').replace(/\r\n?/g, '\n').split('\n'))
}

/** Texto puro (pra copiar/exportar e pro título): tira a marcação, mantém o conteúdo. */
export function plainText(src: string): string {
  const inl = (xs: Inline[]): string => xs.map(x => x.t === 'text' ? x.v : x.t === 'code' ? x.v : x.t === 'br' ? ' ' : x.t === 'link' ? inl(x.c) : inl(x.c)).join('')
  const blk = (bs: Block[]): string => bs.map(b => b.t === 'p' || b.t === 'h' ? inl(b.c) : b.t === 'code' ? b.v : b.t === 'quote' ? blk(b.c) : b.t === 'list' ? b.items.map(it => blk(it.c)).join(' ') : b.t === 'table' ? [b.head, ...b.rows].map(r => r.map(inl).join(' ')).join(' ') : '').join(' ')
  return blk(parseMarkdown(src)).replace(/\s+/g, ' ').trim()
}
