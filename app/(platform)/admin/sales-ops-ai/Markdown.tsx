'use client'
import * as React from 'react'
import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { parseMarkdown, type Block, type Inline } from '@/lib/salesops/markdown'

// Renderiza o markdown da IA / da base como elementos React (a árvore vem de lib/salesops/markdown: nunca HTML cru, links só se forem seguros).
const LINK = { color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationThickness: 1, fontWeight: 600, wordBreak: 'break-word' as const }

function CodeBlock({ lang, value }: { lang: string; value: string }) {
  const [done, setDone] = useState(false)
  return (
    <div data-md="code" style={{ margin: '10px 0', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--secondary)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px 5px 12px', borderBottom: '1px solid var(--border)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        <span>{lang || 'código'}</span>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }).catch(() => {}) }} aria-label="Copiar código"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: done ? 'var(--success)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit', padding: '3px 6px', borderRadius: 6 }}>
          {done ? <Check size={12} /> : <Copy size={12} />}{done ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '10px 12px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.6, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--foreground)' }}><code>{value}</code></pre>
    </div>
  )
}

function Inl({ nodes, inLink = false }: { nodes: Inline[]; inLink?: boolean }): React.ReactElement {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text': return <React.Fragment key={i}>{n.v}</React.Fragment>
          case 'br': return <br key={i} />
          case 'strong': return <strong key={i} style={{ fontWeight: 800 }}><Inl nodes={n.c} inLink={inLink} /></strong>
          case 'em': return <em key={i}><Inl nodes={n.c} inLink={inLink} /></em>
          case 'del': return <del key={i} style={{ opacity: .7 }}><Inl nodes={n.c} inLink={inLink} /></del>
          case 'code': return <code key={i} style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.88em', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', wordBreak: 'break-word' }}>{n.v}</code>
          case 'link': return inLink
            ? <span key={i}><Inl nodes={n.c} inLink /></span>                                       // cinto de segurança: <a> dentro de <a> nunca é emitido, mesmo que a árvore traga um
            : <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" style={LINK}><Inl nodes={n.c} inLink /></a>
        }
      })}
    </>
  )
}

function Blk({ b, tight }: { b: Block; tight?: boolean }): React.ReactElement | null {
  switch (b.t) {
    case 'p': return <p style={{ margin: tight ? '0 0 4px' : '0 0 10px', lineHeight: 1.7 }}><Inl nodes={b.c} /></p>
    case 'h': { const sz = [0, 18, 16, 14.5, 13.5][b.level]; return <p role="heading" aria-level={b.level + 1} style={{ margin: '16px 0 6px', fontSize: sz, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.35 }}><Inl nodes={b.c} /></p> }
    case 'code': return <CodeBlock lang={b.lang} value={b.v} />
    case 'hr': return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
    case 'quote': return <blockquote style={{ margin: '10px 0', padding: '8px 14px', borderLeft: '3px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 7%, transparent)', borderRadius: '0 10px 10px 0' }}>{b.c.map((x, i) => <Blk key={i} b={x} tight />)}</blockquote>
    case 'list': {
      const Tag = (b.ordered ? 'ol' : 'ul') as 'ol' | 'ul'
      return (
        <Tag start={b.ordered ? b.start : undefined} style={{ margin: '4px 0 10px', paddingLeft: b.items.some(i => i.checked !== null) ? 4 : 22, listStyle: b.items.some(i => i.checked !== null) ? 'none' : undefined, lineHeight: 1.7 }}>
          {b.items.map((it, i) => (
            <li key={i} style={{ margin: '5px 0', paddingLeft: 2 }}>
              {it.checked !== null && <span aria-hidden style={{ marginRight: 8, color: it.checked ? 'var(--success)' : 'var(--muted-foreground)', fontWeight: 800 }}>{it.checked ? '☑' : '☐'}</span>}
              {it.c.map((x, k) => (x.t === 'p' && it.c.length === 1 ? <span key={k}><Inl nodes={x.c} /></span> : <Blk key={k} b={x} tight />))}
            </li>
          ))}
        </Tag>
      )
    }
    case 'table': return (
      <div style={{ overflowX: 'auto', margin: '10px 0', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead><tr>{b.head.map((h, i) => <th key={i} style={{ textAlign: b.align[i] ?? 'left', padding: '8px 12px', background: 'var(--secondary)', borderBottom: '1px solid var(--border)', fontWeight: 800, whiteSpace: 'nowrap' }}><Inl nodes={h} /></th>)}</tr></thead>
          <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ textAlign: b.align[ci] ?? 'left', padding: '8px 12px', borderTop: ri ? '1px solid var(--border)' : undefined, verticalAlign: 'top' }}><Inl nodes={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
}

export function Markdown({ text, style }: { text: string; style?: React.CSSProperties }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return <div data-md="root" style={{ fontSize: 14, color: 'var(--foreground)', wordBreak: 'break-word', ...style }}>{blocks.map((b, i) => <Blk key={i} b={b} />)}</div>
}
