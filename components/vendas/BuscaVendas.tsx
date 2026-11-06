'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BarChart3, CreditCard, Loader2, Megaphone, Repeat2, Search, ShoppingCart, Sparkles, X, Zap } from 'lucide-react'
import { CANAL_COR, CANAL_ROTULO, entenderToken, textoCor, tokensDaBusca } from '@/lib/vendas/gerais'
import { formaPagamento, verticalCor, verticalLabel } from '@/lib/vendas/format'

const SUGESTOES = ['anest pix', 'embaixador', 'self-checkout', 'recorrente', 'ortop cartao']
const ehCampo = (e: EventTarget | null) => { const t = e as HTMLElement | null; return !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) }

/** O que a palavra "significa": vertical, canal, forma de pagamento, recorrência — ou só texto (nome, e-mail, telefone, HP, produto…). */
function significado(token: string): { cor: string; icone: ReactNode; rotulo: string; dica: string } {
  const e = entenderToken(token)
  if (e.verticais.length) return { cor: verticalCor(e.verticais[0]), icone: <BarChart3 size={13} />, rotulo: verticalLabel(e.verticais[0]), dica: 'Vertical (e também procura o texto em nomes, produtos…)' }
  if (e.canais.length) { const c = e.canais[0] === 'self' ? 'self' : e.canais[0] === 'embaixador' ? 'embaixador' : 'closer'; return { cor: CANAL_COR[c], icone: c === 'self' ? <ShoppingCart size={13} /> : c === 'embaixador' ? <Megaphone size={13} /> : <Zap size={13} />, rotulo: CANAL_ROTULO[c], dica: 'Canal (e também procura o texto)' } }
  if (e.formas.length) return { cor: '#6366f1', icone: <CreditCard size={13} />, rotulo: formaPagamento(e.formas[0]), dica: 'Forma de pagamento (e também procura o texto)' }
  if (e.recorrente) return { cor: '#8b5cf6', icone: <Repeat2 size={13} />, rotulo: 'Recorrente', dica: 'Parcela recorrente (e também procura o texto)' }
  return { cor: 'var(--muted-foreground)', icone: <Search size={12} />, rotulo: token, dica: 'Procura em nome, e-mail, telefone, HP, produto, closer, embaixador e cupom' }
}

export function BuscaVendas({ value, onChange, carregando, resultado }: { value: string; onChange: (v: string) => void; carregando: boolean; resultado?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const tokens = tokensDaBusca(value)
  const [estreito, setEstreito] = useState(false)      // celular: o texto de ajuda do campo é mais curto (o longo ficaria cortado)
  useEffect(() => { const m = window.matchMedia('(max-width: 640px)'); const f = () => setEstreito(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !ehCampo(e.target)) { e.preventDefault(); ref.current?.focus(); ref.current?.select() } }
    document.addEventListener('keydown', tecla); return () => document.removeEventListener('keydown', tecla)
  }, [])
  const remover = (tk: string) => { onChange(value.split(/\s+/).filter(w => w && tokensDaBusca(w)[0] !== tk).join(' ')); ref.current?.focus() }
  return (
    <section data-v="busca-geral" role="search" aria-label="Buscar vendas" className="vd-card vd-up" style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="vd-field" style={{ display: 'flex', alignItems: 'center', gap: 12, height: 58, padding: '0 14px 0 18px', border: '1.5px solid var(--border)', borderRadius: 18, background: 'var(--background)', cursor: 'text' }}>
        <Search size={21} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <input ref={ref} data-v="gerais-busca" type="text" inputMode="search" autoComplete="off" spellCheck={false} aria-label="Buscar vendas por nome, e-mail, telefone, HP, produto, vertical, canal ou closer" maxLength={120}
          value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { if (value) onChange(''); else (e.target as HTMLInputElement).blur() } }}
          placeholder={estreito ? 'Nome, e-mail, HP…' : 'Buscar por nome, e-mail, telefone, HP, produto, closer, embaixador, cupom…'}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 16, fontWeight: 500, fontFamily: 'inherit' }} />
        {carregando && <Loader2 data-v="busca-carregando" size={18} className="vd-spin" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} aria-label="Buscando" />}
        {value ? <button type="button" data-v="busca-limpar" aria-label="Limpar busca" onClick={() => { onChange(''); ref.current?.focus() }} className="vd-icon vd-btn" style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--secondary)', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
          : <kbd data-v="busca-atalho" title="Aperte / para buscar" style={{ minWidth: 26, height: 26, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', borderBottomWidth: 2, background: 'var(--card)', color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>/</kbd>}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 30 }}>
        {tokens.length > 0 ? <>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Buscando</span>
          {tokens.map(tk => { const s = significado(tk); return (
            <span key={tk} data-v="busca-chip" data-token={tk} title={s.dica} className="vd-chip" style={{ padding: '4px 4px 4px 10px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, color: textoCor(s.cor), background: `color-mix(in srgb, ${s.cor} 12%, var(--card))`, border: `1px solid color-mix(in srgb, ${s.cor} 30%, transparent)` }}>
              {s.icone}{s.rotulo}
              <button type="button" data-v="busca-chip-remover" aria-label={`Remover ${tk} da busca`} onClick={() => remover(tk)} className="vd-icon" style={{ width: 20, height: 20, borderRadius: 99, border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={12} /></button>
            </span>) })}
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>cada palavra precisa aparecer na venda</span>
        </> : <>
          <Sparkles size={14} style={{ color: 'var(--muted-foreground)' }} /><span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>Combine palavras. Experimente:</span>
          {SUGESTOES.map(s => <button key={s} type="button" data-v="busca-sugestao" onClick={() => { onChange(s); ref.current?.focus() }} className="vd-btn" style={{ padding: '4px 11px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>)}
        </>}
        {resultado && <span data-v="busca-resultado" aria-live="polite" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--muted-foreground)' }}>{resultado}</span>}
      </div>
    </section>
  )
}
