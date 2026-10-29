'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Clock, Inbox, Plus, Repeat2, XCircle } from 'lucide-react'
import { PeriodoFilter } from '@/components/vendas/PeriodoFilter'
import { TrocaCard } from '@/components/vendas/TrocaCard'
import { TrocaModal } from '@/components/vendas/TrocaModal'
import { Banner, Btn, EmptyState, FilterBar, Kpi, PageHeader, Segmented, Select, Skeleton, VendasStyle } from '@/components/vendas/ui'
import { api, qs } from '@/lib/vendas/client'
import { verticaisDoTime, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { periodoToRange, type Periodo } from '@/lib/vendas/periodo'
import type { TrocaRow } from '@/lib/vendas/types'

/** As solicitações de troca do PRÓPRIO closer: filtra por data, vertical e status; concedidas em verde, negadas em vermelho. */
export function TrocasCloserClient({ team }: { team: string | null }) {
  const [periodo, setPeriodo] = useState<Periodo | null>(null); const [vertical, setVertical] = useState('todas'); const [status, setStatus] = useState('todas')
  const [trocas, setTrocas] = useState<TrocaRow[]>([]); const [pendTotal, setPendTotal] = useState(0); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState<{ msg: string; migracao: boolean } | null>(null); const [modal, setModal] = useState(false); const [editando, setEditando] = useState<TrocaRow | null>(null)
  const opcoes = verticaisDoTime(team)
  const filtroAtivo = periodo !== null || vertical !== 'todas' || status !== 'todas'
  const limpar = () => { setPeriodo(null); setVertical('todas'); setStatus('todas') }
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    const r = await api<{ trocas: TrocaRow[]; pendentes_total: number }>('/api/trocas' + qs({ ...(periodo ? periodoToRange(periodo) : {}), vertical: vertical === 'todas' ? '' : vertical }))
    setCarregando(false)
    if (!r.ok) { setErro({ msg: r.error ?? 'Erro ao carregar.', migracao: !!r.migracao }); setTrocas([]); return }
    setTrocas(r.data!.trocas); setPendTotal(r.data!.pendentes_total)
  }, [periodo, vertical])
  useEffect(() => { carregar() }, [carregar])
  const n = useMemo(() => ({ pendente: trocas.filter(t => t.status === 'pendente').length, concedida: trocas.filter(t => t.decision === 'concedida').length, negada: trocas.filter(t => t.decision === 'negada').length }), [trocas])
  const lista = useMemo(() => trocas.filter(t => status === 'todas' || (status === 'pendente' ? t.status === 'pendente' : t.decision === status)), [trocas, status])

  return (
    <div className="vd" style={{ padding: '36px clamp(16px, 3vw, 40px) 64px', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <VendasStyle />
      <PageHeader icon={<Repeat2 size={26} />} title="Trocas de Venda" subtitle="Acompanhe as suas solicitações e as respostas do time de gestão. Concedidas aparecem em verde e negadas em vermelho, sempre com a justificativa."
        right={<Btn data-v="nova-troca" variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => setModal(true)}>Nova solicitação</Btn>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
        <Kpi dataV="kpi-pendentes" label="Pendentes" value={n.pendente} icon={<Clock size={22} />} cor="#f59e0b" />
        <Kpi dataV="kpi-concedidas" label="Concedidas" value={n.concedida} icon={<CheckCircle2 size={22} />} cor="#16a34a" />
        <Kpi dataV="kpi-negadas" label="Negadas" value={n.negada} icon={<XCircle size={22} />} cor="#dc2626" />
      </div>
      <FilterBar ativo={filtroAtivo} onClear={limpar} topo={
        <Segmented name="status" value={status} onChange={setStatus} items={[{ value: 'todas', label: 'Todas', count: trocas.length }, { value: 'pendente', label: 'Pendentes', count: n.pendente, cor: '#f59e0b' }, { value: 'concedida', label: 'Concedidas', count: n.concedida, cor: '#16a34a' }, { value: 'negada', label: 'Negadas', count: n.negada, cor: '#dc2626' }]} />
      }>
        <PeriodoFilter value={periodo} onChange={setPeriodo} allowAll padrao={null} />
        {opcoes.length > 1 && <Select name="vertical" caption="Vertical" icon={<BarChart3 size={18} />} value={vertical} onChange={setVertical} defaultValue="todas" options={[{ value: 'todas', label: 'Todas as verticais' }, ...opcoes.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))]} />}
      </FilterBar>
      {erro && <Banner tipo={erro.migracao ? 'aviso' : 'erro'}>{erro.msg}</Banner>}
      {pendTotal > n.pendente && !erro && <Banner tipo="aviso">Você tem {pendTotal} solicitaç{pendTotal === 1 ? 'ão pendente' : 'ões pendentes'} no total — algumas estão fora dos filtros atuais.</Banner>}
      {carregando ? <Skeleton linhas={5} />
        : lista.length === 0 ? <EmptyState icon={<Inbox size={30} />} title="Nenhuma solicitação por aqui" text="Use “Nova solicitação” para pedir a troca de uma venda. Quando a gestão responder, você vê o resultado e a justificativa neste lugar." />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>{lista.map(t => <TrocaCard key={t.id} t={t} onEdit={setEditando} />)}</div>}
      <TrocaModal open={!!editando} troca={editando} team={team} onClose={() => setEditando(null)} onSaved={t => setTrocas(ts => ts.map(x => (x.id === t.id ? t : x)))} />
      <TrocaModal open={modal} onClose={() => setModal(false)} team={team} onCreated={() => { carregar() }} />
    </div>
  )
}
