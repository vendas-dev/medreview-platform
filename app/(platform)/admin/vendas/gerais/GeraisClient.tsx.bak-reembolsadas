'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, BarChart3, Layers, SearchX, ShoppingBag, Store, Table2, TrendingUp, UsersRound, Wallet } from 'lucide-react'
import { PeriodoFilter } from '@/components/vendas/PeriodoFilter'
import { BuscaVendas } from '@/components/vendas/BuscaVendas'
import { CanalTag, GeraisTable } from '@/components/vendas/GeraisTable'
import { Banner, Btn, FilterBar, Kpi, Legenda, PageHeader, Select, Skeleton, VendasStyle } from '@/components/vendas/ui'
import { api, qs } from '@/lib/vendas/client'
import { VERTICAIS_ATIVAS, fmtBRL, teamCor, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { ABAS, CANAIS, textoCor, tokensDaBusca, type AbaId, type VendaGeral } from '@/lib/vendas/gerais'
import { ORDENS } from '@/lib/vendas/ordem'
import { periodoPadrao, periodoRotulo, periodoToRange, type Periodo } from '@/lib/vendas/periodo'

type Resumo = { abas: Record<string, { vendas: number; valor: number }>; truncated: boolean }
type Pagina = { vendas: VendaGeral[]; total: number; page: number; pages: number; pageSize: number; busca: 'regex' | 'simples' }
const useDebounced = <T,>(v: T, ms: number) => { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms]); return d }
const rotuloAba = (a: AbaId) => (a === 'geral' ? 'Todas as verticais' : verticalLabel(a))
const corAba = (a: AbaId) => (a === 'geral' ? 'var(--primary)' : verticalCor(a))

/** Superadmin: a tabela geral de TODAS as vendas (Self-Checkout, Imparáveis e Embaixadores), mais uma tabela por vertical. Filtros: período, vertical, time, canal e ordem; busca em qualquer dado. */
export function GeraisClient() {
  const [periodo, setPeriodo] = useState<Periodo | null>(() => periodoPadrao()); const [vertical, setVertical] = useState('todas'); const [team, setTeam] = useState('todos'); const [canal, setCanal] = useState('todos'); const [ordem, setOrdem] = useState('recentes')
  const [busca, setBusca] = useState(''); const buscaDeb = useDebounced(busca, 300)
  const [aba, setAba] = useState<AbaId>('geral'); const [pageSize, setPageSize] = useState(25); const [pg, setPg] = useState<{ chave: string; n: number }>({ chave: '', n: 1 })
  const [dados, setDados] = useState<Pagina | null>(null); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState<string | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null); const [carregandoResumo, setCarregandoResumo] = useState(true)
  const reqLinhas = useRef(0), reqResumo = useRef(0), tabelaRef = useRef<HTMLDivElement>(null)

  const range = useMemo(() => (periodo ? periodoToRange(periodo) : {}), [periodo])
  const base = useMemo(() => ({ ...range, vertical: vertical === 'todas' ? '' : vertical, team: team === 'todos' ? '' : team, canal: canal === 'todos' ? '' : canal, q: buscaDeb.trim() }), [range, vertical, team, canal, buscaDeb])
  const chave = `${JSON.stringify(base)}|${aba}|${ordem}|${pageSize}`
  const pagina = pg.chave === chave ? pg.n : 1                                      // qualquer filtro novo volta para a página 1 sem uma segunda consulta
  const tokens = useMemo(() => tokensDaBusca(buscaDeb), [buscaDeb])
  const filtroAtivo = periodo?.key !== 'mes' || vertical !== 'todas' || team !== 'todos' || canal !== 'todos' || ordem !== 'recentes' || !!busca || aba !== 'geral'
  const limpar = () => { setPeriodo(periodoPadrao()); setVertical('todas'); setTeam('todos'); setCanal('todos'); setOrdem('recentes'); setBusca(''); setAba('geral') }

  useEffect(() => {                                                                  // totais das abas: não dependem da aba, da ordem nem da página
    const my = ++reqResumo.current; setCarregandoResumo(true)
    api<Resumo>('/api/admin/vendas/gerais/resumo' + qs(base)).then(r => { if (my !== reqResumo.current) return; setCarregandoResumo(false); if (r.ok) setResumo(r.data) })
  }, [base])
  const carregar = useCallback(async () => {
    const my = ++reqLinhas.current; setCarregando(true); setErro(null)
    const r = await api<Pagina>('/api/admin/vendas/gerais' + qs({ ...base, aba: aba === 'geral' ? '' : aba, ordem: ordem === 'recentes' ? '' : ordem, page: pagina > 1 ? pagina : '', pageSize: pageSize === 25 ? '' : pageSize }))
    if (my !== reqLinhas.current) return                                              // chegou depois de uma consulta mais nova: descarta
    setCarregando(false)
    if (!r.ok) { setErro(r.error ?? 'Erro ao carregar as vendas.'); return }
    setDados(r.data)
  }, [base, aba, ordem, pagina, pageSize])
  useEffect(() => { carregar() }, [carregar])

  const mudarVertical = (v: string) => { setVertical(v); if (v !== 'todas' && aba !== 'geral' && aba !== v) setAba('geral') }
  const irParaPagina = (n: number) => { setPg({ chave, n }); tabelaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
  const atual = resumo?.abas[aba]; const ticket = atual && atual.vendas ? Math.round((atual.valor / atual.vendas) * 100) / 100 : null
  const busy = carregando || busca !== buscaDeb

  return (
    <div className="vd" style={{ padding: '36px clamp(16px, 3vw, 40px) 64px', maxWidth: 1640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <VendasStyle />
      <PageHeader icon={<Table2 size={26} />} title="Vendas Gerais" subtitle="Todas as vendas da operação numa tabela só — Self-Checkout, Imparáveis (closers) e Embaixadores — e uma tabela para cada vertical. Pesquise por qualquer dado." />
      <BuscaVendas value={busca} onChange={setBusca} carregando={busy}
        resultado={busca.trim() && atual ? <><strong data-v="busca-resultado-n" style={{ color: 'var(--foreground)' }}>{atual.vendas}</strong> venda{atual.vendas === 1 ? '' : 's'} · <strong style={{ color: 'var(--foreground)' }}>{fmtBRL(atual.valor)}</strong></> : null} />
      <FilterBar ativo={filtroAtivo} onClear={limpar}>
        <PeriodoFilter value={periodo} onChange={p => setPeriodo(p ?? periodoPadrao())} padrao={periodoPadrao()} />
        <Select name="vertical" caption="Vertical" icon={<BarChart3 size={18} />} value={vertical} onChange={mudarVertical} defaultValue="todas" options={[{ value: 'todas', label: 'Todas as verticais' }, ...VERTICAIS_ATIVAS.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))]} />
        <Select name="time" caption="Time" icon={<UsersRound size={18} />} value={team} onChange={setTeam} defaultValue="todos" options={[{ value: 'todos', label: 'Todos os times' }, { value: 'R1', label: 'Time R1', cor: teamCor('R1') }, { value: 'OAO', label: 'Time OAO', cor: teamCor('OAO') }]} />
        <Select name="canal" caption="Canal" icon={<Store size={18} />} value={canal} onChange={setCanal} defaultValue="todos" minWidth={230} options={CANAIS.map(c => ({ value: c.value, label: c.label }))} />
        <Select name="ordem" caption="Ordenar por" icon={<ArrowDownUp size={18} />} value={ordem} onChange={setOrdem} defaultValue="recentes" options={ORDENS.map(o => ({ value: o.value, label: o.label }))} />
      </FilterBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        <Kpi dataV="kpi-total" label="Total vendido" value={<span data-v="total-geral">{atual ? fmtBRL(atual.valor) : '…'}</span>} icon={<Wallet size={22} />} cor="#16a34a" hint={`${rotuloAba(aba)} · ${periodo ? periodoRotulo(periodo) : 'todo o período'}`} />
        <Kpi dataV="kpi-vendas" label="Vendas" value={<span data-v="total-vendas">{atual ? `${atual.vendas} venda${atual.vendas === 1 ? '' : 's'}` : '…'}</span>} icon={<ShoppingBag size={22} />} cor="#6366f1" />
        <Kpi dataV="kpi-ticket" label="Ticket médio" value={<span data-v="ticket-medio">{atual ? (ticket != null ? fmtBRL(ticket) : '—') : '…'}</span>} icon={<TrendingUp size={22} />} cor="#f59e0b" />
      </div>
      <div role="tablist" aria-label="Tabelas de vendas" data-v="abas" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {ABAS.map(a => {
          const ativa = a === aba, cor = corAba(a), r = resumo?.abas[a]
          return (
            <button key={a} type="button" role="tab" aria-selected={ativa} data-v="aba" data-aba={a} data-ativa={ativa ? 'sim' : 'nao'} onClick={() => setAba(a)} className="vd-btn vd-lift"
              style={{ position: 'relative', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0, padding: '14px 16px 13px 20px', borderRadius: 16, overflow: 'hidden', border: `1.5px solid ${ativa ? cor : 'var(--border)'}`, background: ativa ? `color-mix(in srgb, ${cor} 9%, var(--card))` : 'var(--card)', boxShadow: ativa ? `0 10px 26px -16px ${cor}` : 'none', opacity: r && r.vendas === 0 && !ativa ? 0.62 : 1, color: 'var(--foreground)' }}>
              <span style={{ position: 'absolute', inset: '0 auto 0 0', width: 5, background: cor }} />
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span data-v="aba-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: ativa ? textoCor(cor) : 'var(--muted-foreground)' }}>{a === 'geral' ? <Layers size={14} /> : <i style={{ width: 8, height: 8, borderRadius: 99, background: cor, flexShrink: 0 }} />}{a === 'geral' ? 'Geral' : verticalLabel(a)}</span>
                <span data-v="aba-vendas" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{r ? `${r.vendas} venda${r.vendas === 1 ? '' : 's'}` : ''}</span>
              </span>
              <span data-v="aba-valor" className="vd-title" style={{ display: 'block', marginTop: 8, fontSize: 22, fontWeight: 800, whiteSpace: 'nowrap' }}>{r ? fmtBRL(r.valor) : carregandoResumo ? '…' : '—'}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <Legenda />
        <div data-v="legenda-canais" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Canais<CanalTag canal="closer" /><CanalTag canal="embaixador" /><CanalTag canal="self" /></div>
      </div>
      {erro && <Banner tipo="erro">{erro}</Banner>}
      {resumo?.truncated && <Banner tipo="aviso">O período tem muitas vendas e os totais das abas podem estar incompletos. Reduza o período.</Banner>}
      {dados?.busca === 'simples' && tokens.length > 0 && <Banner tipo="aviso">A busca avançada não está disponível neste banco: usando a busca simples (diferencia acentos).</Banner>}
      {!dados && carregando ? <Skeleton linhas={7} /> : (
        <div ref={tabelaRef} data-v="gerais-card" data-aba={aba} className="vd-card vd-up" style={{ overflow: 'hidden', scrollMarginTop: 16, borderTop: `3px solid ${corAba(aba)}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border)', background: `color-mix(in srgb, ${corAba(aba)} 5%, transparent)` }}>
            {aba === 'geral' ? <Layers size={18} style={{ color: 'var(--primary)' }} /> : <i style={{ width: 10, height: 10, borderRadius: 99, background: corAba(aba) }} />}
            <h2 data-v="tabela-titulo" className="vd-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{rotuloAba(aba)}</h2>
            <span data-v="tabela-subtitulo" style={{ fontSize: 13.5, color: 'var(--muted-foreground)' }}>{dados ? `${dados.total} venda${dados.total === 1 ? '' : 's'}` : ''}{canal !== 'todos' ? ` · ${CANAIS.find(c => c.value === canal)?.label}` : ''}{team !== 'todos' ? ` · Time ${team}` : ''}{buscaDeb.trim() ? ` · busca “${buscaDeb.trim()}”` : ''}</span>
          </div>
          <GeraisTable rows={dados?.vendas ?? []} tokens={tokens} carregando={busy} total={dados?.total ?? 0} page={dados?.page ?? 1} pages={dados?.pages ?? 1} pageSize={pageSize} onPage={irParaPagina} onPageSize={n => setPageSize(n)} cor={aba === 'geral' ? undefined : corAba(aba)}
            vazio={<div data-v="tabela-vazia" style={{ padding: '56px 20px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', background: 'color-mix(in srgb,var(--primary) 11%,transparent)' }}><SearchX size={28} /></div>
              <p className="vd-title" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Nenhuma venda encontrada</p>
              <p style={{ margin: '6px auto 16px', maxWidth: 440, fontSize: 14, lineHeight: 1.55, color: 'var(--muted-foreground)' }}>{buscaDeb.trim() ? 'Nenhuma venda tem todas as palavras da busca neste período e com estes filtros. Tente menos palavras ou outro período.' : 'Não há vendas neste período com estes filtros. Ajuste ou limpe os filtros.'}</p>
              {filtroAtivo && <Btn data-v="limpar-tudo" variant="soft" onClick={limpar}>Limpar busca e filtros</Btn>}
            </div>} />
        </div>
      )}
    </div>
  )
}
