// HTML → texto limpo + lista de links. Sem dependências (roda no servidor da Vercel).

const ENT: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', ccedil: 'ç', Ccedil: 'Ç',
  atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à',
  acirc: 'â', ecirc: 'ê', ocirc: 'ô', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ndash: '–', mdash: '—',
}
const decode = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
   .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)

export function htmlToText(html: string, maxLen = 250_000): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|ul|ol|table|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  h = decode(h).replace(/[ \t\f\v\u00a0]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return h.length > maxLen ? h.slice(0, maxLen) : h
}

export interface PageLink { href: string; text: string }

export function extractLinks(html: string, baseUrl: string): PageLink[] {
  const out: PageLink[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\s[^>]*?href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = (m[2] ?? m[3] ?? '').trim()
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(raw)) continue
    let abs: string
    try { abs = new URL(decode(raw), baseUrl).toString() } catch { continue }
    const text = decode(m[4].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    const k = `${abs}|${text}`
    if (seen.has(k)) continue
    seen.add(k); out.push({ href: abs, text })
  }
  return out
}
