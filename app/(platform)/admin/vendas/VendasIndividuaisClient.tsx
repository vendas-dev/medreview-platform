'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, ChevronDown, ChevronsDownUp, ChevronsUpDown, Info, ShoppingBag, Target, UserCheck, Users, Wallet, UsersRound } from 'lucide-react'
import { PeriodoFilter } from '@/components/vendas/PeriodoFilter'
import { VendasTable } from '@/components/vendas/VendasTable'
import { EditarVendaModal } from '@/components/vendas/EditarVendaModal'
import { Avatar, Banner, Btn, Chip, EmptyState, FilterBar, Kpi, Legenda, PageHeader, Select, Skeleton, Switch, TeamBadge, VendasStyle } from '@/components/vendas/ui'
import { api, qs } from '@/lib/vendas/client'
import { VERTICAIS_ATIVAS, fmtBRL, fmtBRLInt, teamCor, verticaisDoTime, verticalCor, verticalCurto, verticalLabel } from '@/lib/vendas/format'
import { periodoPadrao, periodoToRange, type Periodo } from '@/lib/vendas/periodo'
import type { CloserResumo, VendaRow } from '@/lib/vendas/types'

type Bloco = { rows: VendaRow[]; carregando: boolean; erro?: string }
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`
const VERDE = '#16a34a'

/** Barra de progresso da meta: "78% da meta · falta R$ 20.278" (ou "batida ✓ +R$ 1.200"). dv = prefixo dos data-v. */
function Meta({ valor, meta, cor, dv, grande }: { valor: number; meta: number; cor: string; dv: string; grande?: boolean }) {
  const pct = meta > 0 ? (valor / meta) * 100 : 0; const batida = valor >= meta; const falta = Math.max(0, meta - valor); const c = batida ? VERDE : cor
  return (
    <span data-v={`${dv}-meta`} data-batida={batida ? 'sim' : 'nao'} style={{ display: 'block' }}>
      <span style={{ display: 'block', height: grande ? 6 : 4, borderRadius: 99, background: `color-mix(in srgb, ${c} 17%, transparent)`, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${Math.min(100, Math.max(valor > 0 ? 3 : 0, pct))}%`, height: '100%', borderRadius: 99, background: c, transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }} />
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4, fontSize: grande ? 12 : 11, lineHeight: '14px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
        <strong data-v={`${dv}-pct`} style={{ color: batida ? VERDE : 'var(--foreground)', fontWeight: 800 }}>{Math.round(pct)}%</strong>{grande && <span>da meta</span>}<span>·</span>
        {batida ? <span data-v={`${dv}-falta`} style={{ color: VERDE, fontWeight: 700 }}>batida ✓ +{fmtBRLInt(valor - meta)}</span> : <span data-v={`${dv}-falta`}>falta <strong style={{ color: 'var(--foreground)', fontWeight: 800 }}>{fmtBRLInt(falta)}</strong></span>}
      </span>
    </span>
  )
}

/** Verticais mostradas na legenda de cada closer: R1 só a de R1; OAO as 3; sem time conhecido, as que têm venda. */
function verticaisDoCloser(c: CloserResumo): string[] {
  if (c.team === 'R1' || c.team === 'OAO') return verticaisDoTime(c.team)
  return Object.keys(c.por_vertical)
}

/** Superadmin: as vendas de cada closer, em lista expansível, com filtros de período, vertical, time e closer (valem para tudo). */
export function VendasIndividuaisClient() {
  const [periodo, setPeriodo] = useState<Periodo | null>(() => periodoPadrao()); const [vertical, setVertical] = useState('todas'); const [team, setTeam] = useState('todos'); const [closerId, setCloserId] = useState('todos'); const [recorrentes, setRecorrentes] = useState(false); const [inativos, setInativos] = useState(false)
  const [resumo, setResumo] = useState<{ closers: CloserResumo[]; truncated: boolean; meta_mes: string | null; total: { vendas: number; valor: number }; ocultos: { closers: number; vendas: number; valor: number } } | null>(null); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState<{ msg: string; migracao: boolean } | null>(null)
  const [aberto, setAberto] = useState<Set<string>>(new Set()); const [blocos, setBlocos] = useState<Record<string, Bloco>>({}); const [editando, setEditando] = useState<{ venda: VendaRow; closer: CloserResumo } | null>(null); const [aviso, setAviso] = useState<string | null>(null)
  const range = useMemo(() => (periodo ? periodoToRange(periodo) : {}), [periodo])
  const filtrosRows = useMemo(() => qs({ ...range, vertical: vertical === 'todas' ? '' : vertical, recorrentes }), [range, vertical, recorrentes])
  const abertoRef = useRef(aberto); abertoRef.current = aberto
  const filtroAtivo = periodo?.key !== 'mes' || vertical !== 'todas' || team !== 'todos' || closerId !== 'todos' || recorrentes || inativos
  const limpar = () => { setPeriodo(periodoPadrao()); setVertical('todas'); setTeam('todos'); setCloserId('todos'); setRecorrentes(false); setInativos(false) }

  const carregarResumo = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true); setErro(null)
    const r = await api<{ closers: CloserResumo[]; truncated: boolean; meta_mes: string | null; total: { vendas: number; valor: number }; ocultos: { closers: number; vendas: number; valor: number } }>('/api/admin/vendas/resumo' + qs({ ...range, vertical: vertical === 'todas' ? '' : vertical, team: team === 'todos' ? '' : team, recorrentes, inativos }))
    setCarregando(false)
    if (!r.ok) { setErro({ msg: r.error ?? 'Erro ao carregar.', migracao: !!r.migracao }); if (!silencioso) setResumo(null); return }
    setResumo(r.data)
  }, [range, vertical, team, recorrentes, inativos])
  useEffect(() => { carregarResumo() }, [carregarResumo])

  const carregarLinhas = useCallback(async (id: string) => {
    setBlocos(b => ({ ...b, [id]: { rows: b[id]?.rows ?? [], carregando: true } }))
    const r = await api<{ vendas: VendaRow[] }>(`/api/admin/vendas/closer/${id}` + filtrosRows)
    setBlocos(b => ({ ...b, [id]: r.ok ? { rows: r.data!.vendas, carregando: false } : { rows: [], carregando: false, erro: r.error ?? 'Erro ao carregar as vendas.' } }))
  }, [filtrosRows])
  useEffect(() => { setBlocos({}); abertoRef.current.forEach(id => { carregarLinhas(id) }) }, [filtrosRows, carregarLinhas])

  const visiveis = useMemo(() => (resumo?.closers ?? []).filter(c => closerId === 'todos' || c.id === closerId), [resumo, closerId])
  // O total do topo vem do SERVIDOR e soma TODOS os closers (inclusive inativos ocultos). Só quando um closer específico é escolhido o total é o dele.
  const total = useMemo(() => closerId === 'todos' && resumo ? { vendas: resumo.total.vendas, valor: resumo.total.valor, ativos: visiveis.filter(c => c.vendas > 0).length } : { vendas: visiveis.reduce((s, c) => s + c.vendas, 0), valor: Math.round(visiveis.reduce((s, c) => s + c.valor, 0) * 100) / 100, ativos: visiveis.filter(c => c.vendas > 0).length }, [visiveis, resumo, closerId])
  function alternar(id: string) { setAberto(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else { n.add(id); if (!blocos[id]) carregarLinhas(id) } return n }) }
  function expandirTodos() { const ids = visiveis.filter(c => c.vendas > 0).map(c => c.id); setAberto(new Set(ids)); ids.forEach(id => { if (!blocos[id]) carregarLinhas(id) }) }
  async function salvarObs(row: VendaRow, texto: string | null) {
    const r = await api<{ venda: { obs: string | null; obs_updated_at: string } }>(`/api/vendas/${row.id}/obs`, { method: 'PATCH', body: { obs: texto } })
    if (!r.ok) return { ok: false, error: r.error }
    const id = row.closer_id ?? ''; setBlocos(b => b[id] ? { ...b, [id]: { ...b[id], rows: b[id].rows.map(x => (x.id === row.id ? { ...x, obs: r.data!.venda.obs } : x)) } } : b); return { ok: true }
  }
  function aoSalvar(v: VendaRow, auditoria: boolean) {
    const id = v.closer_id ?? ''; setBlocos(b => b[id] ? { ...b, [id]: { ...b[id], rows: b[id].rows.map(x => (x.id === v.id ? v : x)) } } : b)
    setEditando(null); setAviso(auditoria ? 'Venda atualizada. A alteração foi registrada.' : 'Venda atualizada, mas o registro de auditoria falhou — avise o suporte.'); setTimeout(() => setAviso(null), 4500); carregarResumo(true)
  }
  const closerOpts = [{ value: 'todos', label: 'Todos os closers' }, ...(resumo?.closers ?? []).filter(c => c.ativo).map(c => ({ value: c.id, label: c.name, avatar: { name: c.name, src: c.avatar_url }, sub: c.team ? `Time ${c.team}` : undefined }))]

  return (
    <div className="vd" style={{ padding: '36px clamp(16px, 3vw, 40px) 64px', maxWidth: 1640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <VendasStyle />
      <PageHeader icon={<Users size={26} />} title="Vendas Individuais" subtitle="O desempenho de cada closer. Expanda um closer para ver a tabela de vendas dele e editar qualquer campo."
        right={resumo?.meta_mes ? <span data-v="meta-mes" className="vd-chip" style={{ padding: '9px 15px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb,var(--primary) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--primary) 22%,transparent)' }}><Target size={16} />Metas de {rotuloMes(resumo.meta_mes)}</span> : undefined} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        <Kpi dataV="kpi-total" label="Total vendido" value={<span data-v="total-geral">{fmtBRL(total.valor)}</span>} icon={<Wallet size={22} />} cor="#16a34a" />
        <Kpi dataV="kpi-vendas" label="Vendas" value={<span data-v="total-vendas">{total.vendas} venda{total.vendas === 1 ? '' : 's'}</span>} icon={<ShoppingBag size={22} />} cor="#6366f1" />
        <Kpi dataV="kpi-closers" label="Closers com vendas" value={`${total.ativos} de ${visiveis.length}`} icon={<UserCheck size={22} />} cor="#0ea5e9" />
      </div>
      <FilterBar ativo={filtroAtivo} onClear={limpar}>
        <PeriodoFilter value={periodo} onChange={p => setPeriodo(p ?? periodoPadrao())} padrao={periodoPadrao()} />
        <Select name="vertical" caption="Vertical" icon={<BarChart3 size={18} />} value={vertical} onChange={setVertical} defaultValue="todas" options={[{ value: 'todas', label: 'Todas as verticais' }, ...VERTICAIS_ATIVAS.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))]} />
        <Select name="time" caption="Time" icon={<UsersRound size={18} />} value={team} onChange={v => { setTeam(v); setCloserId('todos') }} defaultValue="todos" options={[{ value: 'todos', label: 'Todos os times' }, { value: 'R1', label: 'Time R1', cor: teamCor('R1') }, { value: 'OAO', label: 'Time OAO', cor: teamCor('OAO') }]} />
        <Select name="closer" caption="Closer" icon={<Users size={18} />} value={closerId} onChange={setCloserId} defaultValue="todos" searchable minWidth={240} options={closerOpts} />
        <Switch dataV="filtro-recorrentes" checked={recorrentes} onChange={setRecorrentes} label="Parcelas recorrentes" />
        <Switch dataV="filtro-inativos" checked={inativos} onChange={setInativos} label="Mostrar inativos" />
      </FilterBar>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <Legenda />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn data-v="expandir-todos" size="sm" icon={<ChevronsUpDown size={15} />} onClick={expandirTodos}>Expandir todos</Btn>
          <Btn data-v="recolher-todos" size="sm" icon={<ChevronsDownUp size={15} />} onClick={() => setAberto(new Set())}>Recolher todos</Btn>
        </div>
      </div>
      {resumo && !inativos && closerId === 'todos' && resumo.ocultos.vendas > 0 && <div data-v="inativos-ocultos" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -14, fontSize: 12.5, color: 'var(--muted-foreground)' }}><Info size={14} />O total acima inclui {fmtBRL(resumo.ocultos.valor)} ({resumo.ocultos.vendas} venda{resumo.ocultos.vendas === 1 ? '' : 's'}) de {resumo.ocultos.closers} closer{resumo.ocultos.closers === 1 ? '' : 's'} inativo{resumo.ocultos.closers === 1 ? '' : 's'}, que não aparece{resumo.ocultos.closers === 1 ? '' : 'm'} na lista. <button type="button" data-v="mostrar-inativos" onClick={() => setInativos(true)} className="vd-btn" style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>Mostrar</button></div>}
      {resumo && !resumo.meta_mes && <div data-v="meta-aviso" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -14, fontSize: 12.5, color: 'var(--muted-foreground)' }}><Info size={14} />As metas são mensais: escolha “Este mês”, “Mês passado” ou um mês inteiro no período para ver o % atingido e quanto falta.</div>}
      {erro && <Banner tipo={erro.migracao ? 'aviso' : 'erro'}>{erro.msg}</Banner>}
      {aviso && <Banner tipo={aviso.includes('falhou') ? 'aviso' : 'ok'}>{aviso}</Banner>}
      {resumo?.truncated && <Banner tipo="aviso">O período tem muitas vendas e os totais podem estar incompletos. Reduza o período.</Banner>}
      {carregando ? <Skeleton linhas={5} />
        : visiveis.length === 0 ? <EmptyState icon={<Users size={30} />} title="Nenhum closer encontrado" text="Ajuste ou limpe os filtros para ver os closers." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {visiveis.map(c => {
              const open = aberto.has(c.id); const b = blocos[c.id]; const vs = verticaisDoCloser(c)
              const metaTotal = c.meta ? (c.meta.total > 0 ? c.meta.total : Object.values(c.meta.por_vertical).reduce((x, y) => x + y, 0)) : 0
              return (
                <section key={c.id} data-v="closer" data-id={c.id} data-team={c.team ?? ''} data-open={open ? 'true' : 'false'} className="vd-card vd-lift vd-up" style={{ overflow: 'hidden', opacity: c.vendas === 0 ? 0.7 : 1 }}>
                  <button type="button" data-v="closer-header" onClick={() => alternar(c.id)} aria-expanded={open} className="vd-btn" style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%', padding: '12px 22px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', flexWrap: 'wrap' }}>
                    <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', color: 'var(--muted-foreground)' }}><ChevronDown size={18} /></motion.span>
                    <Avatar name={c.name} src={c.avatar_url} size={46} ring={teamCor(c.team)} />
                    <span style={{ flex: '0 1 210px', minWidth: 170 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span data-v="closer-nome" className="vd-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{c.name}</span><TeamBadge team={c.team} />{!c.ativo && <span data-v="closer-inativo" title="Usuário inativo (aparece porque Mostrar inativos está ligado)" style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 800, color: '#64748b', background: 'color-mix(in srgb,#64748b 14%,transparent)', border: '1px solid color-mix(in srgb,#64748b 30%,transparent)' }}>Inativo</span>}</span>
                      <span data-v="closer-vendas" style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--muted-foreground)' }}>{c.vendas} venda{c.vendas === 1 ? '' : 's'}</span>
                    </span>
                    <span data-v="closer-legenda" style={{ display: 'grid', gridTemplateColumns: `repeat(${vs.length}, minmax(0, 1fr))`, gap: 10, flex: '1 1 440px', minWidth: 0, maxWidth: vs.length * 250 }}>
                      {vs.map(v => { const pv = c.por_vertical[v]; const cor = verticalCor(v); const mv = c.meta?.por_vertical[v]; return (
                        <span key={v} data-v="closer-vert" data-vertical={v} title={`${verticalLabel(v)}: ${pv?.vendas ?? 0} venda(s)`} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '7px 11px 6px', borderRadius: 12, minHeight: 36, background: `color-mix(in srgb, ${cor} ${pv ? 11 : 5}%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} ${pv ? 26 : 13}%, transparent)`, opacity: pv ? 1 : 0.62 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <i style={{ width: 8, height: 8, borderRadius: 99, background: cor, flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', color: cor, textTransform: 'uppercase' }}>{verticalCurto(v)}</span>
                            <span data-v="closer-vert-valor" style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{fmtBRL(pv?.valor ?? 0)}</span>
                          </span>
                          {mv ? <Meta dv="closer-vert" valor={pv?.valor ?? 0} meta={mv} cor={cor} /> : null}
                        </span>) })}
                    </span>
                    <span style={{ flex: '0 0 262px', marginLeft: 'auto', paddingLeft: 18, borderLeft: '1px solid var(--border)' }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Total</span>
                        <span data-v="closer-valor" className="vd-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{fmtBRL(c.valor)}</span>
                      </span>
                      {metaTotal > 0 ? <span style={{ display: 'block', marginTop: 5 }}><Meta dv="closer-total" valor={c.valor} meta={metaTotal} cor="var(--primary)" grande /></span>
                        : resumo?.meta_mes ? <span data-v="closer-sem-meta" style={{ display: 'block', marginTop: 5, fontSize: 11.5, color: 'var(--muted-foreground)' }}>Sem meta definida</span> : null}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div key="corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                        <div data-v="closer-corpo" style={{ borderTop: '1px solid var(--border)' }}>
                          {!b || b.carregando ? <div style={{ padding: 22 }}><Skeleton linhas={3} /></div>
                            : b.erro ? <div style={{ padding: 20 }}><Banner tipo="erro">{b.erro}</Banner></div>
                            : <VendasTable rows={b.rows} mode="admin" onSaveObs={salvarObs} onEdit={v => setEditando({ venda: v, closer: c })} pageSize={25} empty="Sem vendas deste closer neste período." />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              )
            })}
          </div>
        )}
      <EditarVendaModal venda={editando?.venda ?? null} closerNome={editando?.closer.name} closerFoto={editando?.closer.avatar_url} onClose={() => setEditando(null)} onSaved={aoSalvar} />
    </div>
  )
}
