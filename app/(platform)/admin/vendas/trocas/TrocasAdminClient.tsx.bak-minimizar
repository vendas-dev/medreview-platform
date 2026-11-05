'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Inbox, Repeat2, Users, UsersRound } from 'lucide-react'
import { PeriodoFilter } from '@/components/vendas/PeriodoFilter'
import { TrocaCard } from '@/components/vendas/TrocaCard'
import { TrocaModal } from '@/components/vendas/TrocaModal'
import { Banner, EmptyState, FilterBar, PageHeader, Segmented, Select, Skeleton, VendasStyle } from '@/components/vendas/ui'
import { api, qs } from '@/lib/vendas/client'
import { VERTICAIS_ATIVAS, teamCor, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { periodoToRange, type Periodo } from '@/lib/vendas/periodo'
import type { CloserResumo, Decisao, TrocaRow } from '@/lib/vendas/types'

/** Superadmin: a fila de pedidos. CONCEDER ou NEGAR (a justificativa é obrigatória nos dois); o closer é avisado. Resolvidos ficam esmaecidos. */
export function TrocasAdminClient() {
  const [status, setStatus] = useState('pendente'); const [periodo, setPeriodo] = useState<Periodo | null>(null); const [vertical, setVertical] = useState('todas'); const [team, setTeam] = useState('todos'); const [closerId, setCloserId] = useState('todos')
  const [fixas, setFixas] = useState<Set<string>>(new Set()); const [trocas, setTrocas] = useState<TrocaRow[]>([]); const [pendTotal, setPendTotal] = useState(0); const [closers, setClosers] = useState<CloserResumo[]>([]); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState<{ msg: string; migracao: boolean } | null>(null); const [editando, setEditando] = useState<TrocaRow | null>(null)
  const filtroAtivo = status !== 'pendente' || periodo !== null || vertical !== 'todas' || team !== 'todos' || closerId !== 'todos'
  const limpar = () => { setStatus('pendente'); setPeriodo(null); setVertical('todas'); setTeam('todos'); setCloserId('todos') }
  useEffect(() => { api<{ closers: CloserResumo[] }>('/api/admin/vendas/resumo').then(r => { if (r.ok) setClosers(r.data!.closers) }) }, [])
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setFixas(new Set())
    const r = await api<{ trocas: TrocaRow[]; pendentes_total: number }>('/api/admin/trocas' + qs({ ...(periodo ? periodoToRange(periodo) : {}), vertical: vertical === 'todas' ? '' : vertical, team: team === 'todos' ? '' : team, closerId: closerId === 'todos' ? '' : closerId }))
    setCarregando(false)
    if (!r.ok) { setErro({ msg: r.error ?? 'Erro ao carregar.', migracao: !!r.migracao }); setTrocas([]); return }
    setTrocas(r.data!.trocas); setPendTotal(r.data!.pendentes_total)
  }, [periodo, vertical, team, closerId])
  useEffect(() => { carregar() }, [carregar])
  const n = useMemo(() => ({ pendente: trocas.filter(t => t.status === 'pendente').length, concedida: trocas.filter(t => t.decision === 'concedida').length, negada: trocas.filter(t => t.decision === 'negada').length }), [trocas])
  // O filtro de status é aplicado na hora, sem recarregar. O que você acabou de resolver ou de editar NESTA tela continua visível (colorido) para você ver o resultado, mas isso é solto assim que você troca de aba: aí cada pedido aparece só onde pertence.
  const lista = useMemo(() => trocas.filter(t => status === 'todas' || fixas.has(t.id) || (status === 'pendente' ? t.status === 'pendente' : t.decision === status)), [trocas, status, fixas])
  const mudarStatus = (v: string) => { setStatus(v); setFixas(new Set()) }

  async function decidir(id: string, decision: Decisao, texto: string) {
    const r = await api<{ troca: TrocaRow }>(`/api/admin/trocas/${id}/resolver`, { method: 'POST', body: { decision, response: texto } })
    if (!r.ok) { if (r.status === 409) carregar(); return { ok: false, error: r.error } }
    setTrocas(ts => ts.map(t => (t.id === id ? r.data!.troca : t))); setFixas(f => new Set(f).add(id)); setPendTotal(p => Math.max(0, p - 1)); window.dispatchEvent(new Event('trocas:atualizou')); return { ok: true }
  }
  async function editarResposta(id: string, decision: Decisao, texto: string) {
    const r = await api<{ troca: TrocaRow }>(`/api/admin/trocas/${id}/resposta`, { method: 'PATCH', body: { decision, response: texto } })
    if (!r.ok) { if (r.status === 409) carregar(); return { ok: false, error: r.error } }
    setTrocas(ts => ts.map(t => (t.id === id ? r.data!.troca : t))); setFixas(f => new Set(f).add(id)); return { ok: true }
  }
  const closerOpts = [{ value: 'todos', label: 'Todos os closers' }, ...closers.filter(c => c.ativo !== false && (team === 'todos' || c.team === team)).map(c => ({ value: c.id, label: c.name, avatar: { name: c.name, src: c.avatar_url }, sub: c.team ? `Time ${c.team}` : undefined }))]
  return (
    <div className="vd" style={{ padding: '36px clamp(16px, 3vw, 40px) 64px', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <VendasStyle />
      <PageHeader icon={<Repeat2 size={26} />} title="Trocas de Venda" subtitle="Solicitações dos closers. Conceda ou negue — nos dois casos a justificativa é obrigatória e o closer recebe a resposta."
        right={<div data-v="pendentes-total" className="vd-chip" style={{ padding: '10px 18px', borderRadius: 99, fontSize: 14, fontWeight: 800, color: pendTotal ? '#b45309' : 'var(--muted-foreground)', background: pendTotal ? 'color-mix(in srgb,#f59e0b 16%,transparent)' : 'var(--secondary)' }}>{pendTotal} pendente{pendTotal === 1 ? '' : 's'}</div>} />
      <FilterBar ativo={filtroAtivo} onClear={limpar} topo={
        <Segmented name="status" value={status} onChange={mudarStatus} items={[{ value: 'pendente', label: 'Pendentes', count: n.pendente, cor: '#f59e0b' }, { value: 'concedida', label: 'Concedidas', count: n.concedida, cor: '#16a34a' }, { value: 'negada', label: 'Negadas', count: n.negada, cor: '#dc2626' }, { value: 'todas', label: 'Todas', count: trocas.length }]} />
      }>
        <PeriodoFilter value={periodo} onChange={setPeriodo} allowAll padrao={null} />
        <Select name="vertical" caption="Vertical" icon={<BarChart3 size={18} />} value={vertical} onChange={setVertical} defaultValue="todas" options={[{ value: 'todas', label: 'Todas as verticais' }, ...VERTICAIS_ATIVAS.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))]} />
        <Select name="time" caption="Time" icon={<UsersRound size={18} />} value={team} onChange={v => { setTeam(v); setCloserId('todos') }} defaultValue="todos" options={[{ value: 'todos', label: 'Todos os times' }, { value: 'R1', label: 'Time R1', cor: teamCor('R1') }, { value: 'OAO', label: 'Time OAO', cor: teamCor('OAO') }]} />
        <Select name="closer" caption="Closer" icon={<Users size={18} />} value={closerId} onChange={setCloserId} defaultValue="todos" searchable minWidth={240} options={closerOpts} />
      </FilterBar>
      {erro && <Banner tipo={erro.migracao ? 'aviso' : 'erro'}>{erro.msg}</Banner>}
      {carregando ? <Skeleton linhas={5} />
        : lista.length === 0 ? <EmptyState icon={<Inbox size={30} />} title={status === 'pendente' ? 'Tudo em dia!' : 'Nenhuma solicitação encontrada'} text={status === 'pendente' ? 'Não há solicitações pendentes no momento.' : 'Ajuste ou limpe os filtros para ver outras solicitações.'} />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>{lista.map(t => <TrocaCard key={t.id} t={t} admin onDecide={decidir} onEdit={setEditando} onEditResposta={editarResposta} />)}</div>}
      <TrocaModal open={!!editando} troca={editando} admin team={null} onClose={() => setEditando(null)} onSaved={t => { setTrocas(ts => ts.map(x => (x.id === t.id ? t : x))); setFixas(f => new Set(f).add(t.id)) }} />
    </div>
  )
}
