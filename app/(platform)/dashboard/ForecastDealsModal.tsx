'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, RefreshCw, CheckCircle2, Clock, Ban, Layers } from 'lucide-react'
import type { DealsQuery, DealRow, DealsResult } from '@/lib/dashboard/forecastDeals'
import { hubspotDealUrl, expiryTag, dealsQueryString, dealsTitle, type ExpiryKind } from '@/lib/dashboard/forecastDealsUi'

// Popup com a lista de negócios por trás de um número do forecast. Abre ao clicar em "gerados hoje" / "últimos 15 dias".
// A lista vem de /api/dashboard/forecast/deals e usa as MESMAS regras do número clicado (mesmo nº de linhas, mesma soma).
export interface DealsTheme {
  vert: Record<string, { label: string; short: string; color: string; ink: string }>
  good: string; warn: string; accent: string
}

const BAD = '#dc2626'
const PAGE = 150
const COLS = 'minmax(108px,.9fr) minmax(118px,1fr) minmax(130px,1.2fr) minmax(170px,1.8fr) minmax(98px,.9fr) minmax(120px,1.1fr) minmax(158px,1.3fr) 96px'
const fmtBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtWhen = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—'
const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const MODAL_CSS = `
.fcd-row{display:grid;grid-template-columns:${COLS};align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);position:relative;transition:background-color .16s ease,transform .16s ease,box-shadow .16s ease;animation:fcdRowIn .34s ease backwards;animation-delay:var(--d,0ms)}   /* backwards (não both): depois de terminar a entrada, o hover volta a poder mexer no transform */
.fcd-row:hover{background:color-mix(in srgb,var(--row-c) 9%,var(--card));transform:translateX(3px);box-shadow:inset 3px 0 0 var(--row-c)}
@keyframes fcdRowIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.fcd-link{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;color:var(--fcd-a);text-decoration:none;padding:5px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--fcd-a) 32%,transparent);background:color-mix(in srgb,var(--fcd-a) 8%,transparent);transition:transform .16s ease,background-color .16s ease,box-shadow .16s ease}
.fcd-link:hover,.fcd-link:focus-visible{transform:translateY(-1px);background:color-mix(in srgb,var(--fcd-a) 16%,transparent);box-shadow:0 4px 12px color-mix(in srgb,var(--fcd-a) 24%,transparent)}
.fcd-link svg{transition:transform .16s ease}.fcd-link:hover svg{transform:translate(2px,-2px)}
.fcd-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--card);color:var(--foreground);border-radius:10px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.fcd-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(15,23,42,.1);border-color:var(--fcd-a)}
.fcd-x{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:11px;border:1px solid var(--border);background:var(--card);color:var(--muted-foreground);cursor:pointer;transition:transform .18s ease,color .18s ease,background-color .18s ease}
.fcd-x:hover{transform:rotate(90deg);color:var(--foreground);background:color-mix(in srgb,var(--foreground) 7%,var(--card))}
.fcd-sk{height:44px;border-radius:12px;margin:8px 16px;background:linear-gradient(90deg,color-mix(in srgb,var(--foreground) 6%,transparent),color-mix(in srgb,var(--foreground) 12%,transparent),color-mix(in srgb,var(--foreground) 6%,transparent));background-size:200% 100%;animation:fcdSk 1.2s linear infinite}
@keyframes fcdSk{from{background-position:200% 0}to{background-position:-200% 0}}
.fcd-spin{animation:fcdSpin .9s linear infinite}@keyframes fcdSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.fcd-row,.fcd-sk,.fcd-spin{animation:none}.fcd-row,.fcd-link,.fcd-btn,.fcd-x{transition:none}.fcd-row:hover,.fcd-x:hover,.fcd-link:hover{transform:none}}
`

function Tag({ kind, children, theme }: { kind: ExpiryKind | 'paid' | 'lost'; children: React.ReactNode; theme: DealsTheme }) {
  const c = kind === 'expired' || kind === 'lost' ? BAD : kind === 'paid' ? theme.good : kind === 'urgent' ? '#ea580c' : kind === 'soon' ? theme.warn : 'var(--muted-foreground)'
  const strong = kind === 'expired' || kind === 'lost'
  return (
    <span data-tag={kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 999, color: strong ? '#fff' : c, background: strong ? c : `color-mix(in srgb, ${c} 13%, transparent)`, border: `1px solid ${strong ? c : `color-mix(in srgb, ${c} 35%, transparent)`}` }}>
      {children}
    </span>
  )
}

const MODES: Record<DealsQuery['status'], { icon: any; color: (t: DealsTheme) => string; col: string }> = {
  paid: { icon: CheckCircle2, color: t => t.good, col: 'Pagamento' },
  unpaid: { icon: Clock, color: t => t.warn, col: 'Expiração do link' },
  lost: { icon: Ban, color: () => BAD, col: 'Perdido em' },
  all: { icon: Layers, color: t => t.accent, col: 'Situação' },
}

function Row({ r, i, now, theme }: { r: DealRow; i: number; now: number; theme: DealsTheme }) {
  const v = theme.vert[r.vertical] ?? theme.vert.outros
  const url = hubspotDealUrl(r.deal_id)
  const cell: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, color: 'var(--foreground)' }
  return (
    <div role="row" data-deals-row data-deal-id={r.deal_id ?? ''} data-status={r.status} className="fcd-row" style={{ '--row-c': v.color, '--d': `${Math.min(i, 14) * 22}ms` } as React.CSSProperties}>
      <span role="cell" style={{ ...cell, fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 12, fontWeight: 700 }} title={r.deal_id ?? 'link sem negócio'}>{r.deal_id ?? '—'}</span>
      <span role="cell" style={cell}>
        <span data-vertical={r.vertical} title={r.vertical_raw ?? v.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: v.ink, background: `${v.color}1c`, border: `1px solid ${v.color}38`, borderRadius: 8, padding: '3px 9px' }}>
          <span style={{ width: 7, height: 7, borderRadius: 2.5, background: v.color }} />{v.short}
        </span>
      </span>
      <span role="cell" style={cell} title={r.product ?? ''}>{r.product ?? '—'}</span>
      <span role="cell" style={{ ...cell, fontWeight: 700 }} title={r.deal_name ?? ''}>{r.deal_name ?? '—'}</span>
      <span role="cell" data-value={r.value} style={{ ...cell, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.value)}</span>
      <span role="cell" style={cell} title={r.owner ?? ''}>{r.owner ?? '—'}</span>
      <span role="cell" style={{ ...cell, overflow: 'visible', display: 'flex', alignItems: 'center', gap: 8 }}>
        {r.status === 'paid' && <><Tag kind="paid" theme={theme}>✓ Pago</Tag><span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{fmtWhen(r.converted_at)}</span></>}
        {r.status === 'lost' && <><Tag kind="lost" theme={theme}>Perdido</Tag><span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{fmtWhen(r.lost_at)}</span></>}
        {r.status === 'unpaid' && (() => { const e = expiryTag(r.expires_at, now); return <Tag kind={e.kind} theme={theme}>{e.label}</Tag> })()}
      </span>
      <span role="cell">
        {url
          ? <a data-hubspot href={url} target="_blank" rel="noopener noreferrer" className="fcd-link" style={{ '--fcd-a': '#ff7a59' } as React.CSSProperties} title={`Abrir o negócio ${r.deal_id} no HubSpot`}>Abrir <ExternalLink size={12} /></a>
          : <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }} title="Este link foi gerado sem negócio (sem deal_id)">sem negócio</span>}
      </span>
    </div>
  )
}

function Dialog({ query, onClose, theme }: { query: DealsQuery; onClose: () => void; theme: DealsTheme }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [data, setData] = useState<DealsResult | null>(null)
  const [err, setErr] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const ref = useRef<HTMLDivElement>(null), closeRef = useRef<HTMLButtonElement>(null)
  const mode = MODES[query.status], Icon = mode.icon, accent = mode.color(theme)
  const vLabel = query.vertical ? theme.vert[query.vertical]?.label : undefined
  const { title, subtitle } = dealsTitle(query, vLabel)

  useEffect(() => {
    const ac = new AbortController()
    setState('loading'); setShown(PAGE)
    fetch(`/api/dashboard/forecast/deals?${dealsQueryString(query)}`, { cache: 'no-store', signal: ac.signal })
      .then(async res => { if (!res.ok) throw new Error(res.status === 403 || res.status === 401 ? 'Sem permissão para ver esta lista.' : 'Não consegui carregar a lista agora.'); return res.json() })
      .then((d: DealsResult) => { setData(d); setNow(Date.now()); setState('ready') })
      .catch((e: any) => { if (e?.name === 'AbortError') return; setErr(e?.message || 'Não consegui carregar a lista agora.'); setState('error') })
    return () => ac.abort()
  }, [query, tick])

  // a contagem regressiva das tags acompanha o relógio enquanto o popup está aberto
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id) }, [])

  // Esc fecha · Tab fica dentro do popup · a tela de trás não rola · o foco volta pra onde estava
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement)
      if (f.length === 0) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; prev?.focus?.() }
  }, [onClose])

  const rows = data?.rows ?? []
  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }
  return (
    <motion.div data-deals-overlay initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(8px,2vw,28px)' }}>
      <motion.div ref={ref} data-deals-modal data-status={query.status} role="dialog" aria-modal="true" aria-labelledby="fcd-title"
        initial={{ opacity: 0, y: 18, scale: 0.965 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{ '--fcd-a': accent, width: 'min(1120px,100%)', maxHeight: 'min(88vh,860px)', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(15,23,42,.4)', overflow: 'hidden' } as React.CSSProperties}>
        <div style={{ height: 4, background: `linear-gradient(90deg,${accent},color-mix(in srgb,${accent} 40%,#fff))` }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, background: `color-mix(in srgb,${accent} 14%,transparent)`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={20} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="fcd-title" data-deals-title style={{ fontSize: 'clamp(15px,1.7vw,18px)', fontWeight: 900, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{title}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{subtitle}</p>
          </div>
          {state === 'ready' && data && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p data-deals-count={data.total.count} style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{data.total.count.toLocaleString('pt-BR')} {data.total.count === 1 ? 'negócio' : 'negócios'}</p>
              <p data-deals-total={data.total.value} style={{ fontSize: 'clamp(17px,2vw,22px)', fontWeight: 900, color: accent, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{fmtBRL(data.total.value)}</p>
            </div>
          )}
          <button ref={closeRef} type="button" className="fcd-x" onClick={onClose} aria-label="Fechar"><X size={17} /></button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, minHeight: 160 }}>
          <div role="table" aria-label={title} style={{ minWidth: 1010 }}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '10px 16px', position: 'sticky', top: 0, zIndex: 2, background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
              {['ID do negócio', 'Vertical', 'Produto', 'Negócio', 'Valor', 'Proprietário', mode.col, 'HubSpot'].map(h => <span key={h} role="columnheader" style={head}>{h}</span>)}
            </div>
            {state === 'loading' && <div data-deals-loading aria-busy="true" style={{ padding: '6px 0' }}>{Array.from({ length: 7 }, (_, i) => <div key={i} className="fcd-sk" style={{ opacity: 1 - i * 0.1 }} />)}</div>}
            {state === 'error' && (
              <div data-deals-error style={{ padding: '38px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: BAD, margin: '0 0 12px' }}>{err}</p>
                <button type="button" className="fcd-btn" onClick={() => setTick(t => t + 1)}><RefreshCw size={13} /> Tentar de novo</button>
              </div>
            )}
            {state === 'ready' && rows.length === 0 && (
              <div data-deals-empty style={{ padding: '44px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>Nenhum negócio nesta área</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Os números mudam ao vivo — pode ser que o último tenha acabado de sair daqui.</p>
              </div>
            )}
            {state === 'ready' && rows.slice(0, shown).map((r, i) => <Row key={`${r.key}-${r.link_id}`} r={r} i={i} now={now} theme={theme} />)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '11px 20px', borderTop: '1px solid var(--border)', background: 'color-mix(in srgb,var(--foreground) 3%,var(--card))' }}>
          <span data-deals-shown style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
            {state === 'ready' && data ? <>Mostrando <strong style={{ color: 'var(--foreground)' }}>{Math.min(shown, rows.length)}</strong> de {rows.length.toLocaleString('pt-BR')}{data.truncated ? ` (lista cortada nos ${data.cap.toLocaleString('pt-BR')} primeiros de ${data.total.count.toLocaleString('pt-BR')})` : ''} · atualizado às {fmtClock(now)}</> : ' '}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {state === 'ready' && shown < rows.length && <button type="button" data-deals-more className="fcd-btn" onClick={() => setShown(s => s + PAGE)}>Mostrar mais {Math.min(PAGE, rows.length - shown)}</button>}
            {state === 'ready' && <button type="button" className="fcd-btn" onClick={() => setTick(t => t + 1)} aria-label="Atualizar a lista"><RefreshCw size={13} /> Atualizar</button>}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function DealsModal({ query, onClose, theme }: { query: DealsQuery | null; onClose: () => void; theme: DealsTheme }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const close = useCallback(() => onClose(), [onClose])
  if (!mounted) return null
  return createPortal(
    <>
      <style>{MODAL_CSS}</style>
      <AnimatePresence>{query && <Dialog key={dealsQueryString(query)} query={query} onClose={close} theme={theme} />}</AnimatePresence>
    </>,
    document.body,
  )
}
