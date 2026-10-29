'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Receipt, Repeat2, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { PeriodoFilter } from '@/components/vendas/PeriodoFilter'
import { VendasTable } from '@/components/vendas/VendasTable'
import { TrocaModal } from '@/components/vendas/TrocaModal'
import { Avatar, Banner, Btn, EmptyState, FilterBar, Kpi, PageHeader, SearchBox, Select, Skeleton, Switch, VendasStyle, VerticalChip } from '@/components/vendas/ui'
import { api, qs } from '@/lib/vendas/client'
import { fmtBRL, teamCor, verticaisDoTime, verticalCor, verticalLabel } from '@/lib/vendas/format'
import { periodoPadrao, periodoToRange, type Periodo } from '@/lib/vendas/periodo'
import type { VendaRow } from '@/lib/vendas/types'

export function MinhasVendasClient({ team }: { team: string | null }) {
  const [periodo, setPeriodo] = useState<Periodo | null>(() => periodoPadrao()); const [vertical, setVertical] = useState('todas'); const [recorrentes, setRecorrentes] = useState(false); const [busca, setBusca] = useState('')
  const [rows, setRows] = useState<VendaRow[]>([]); const [vinculado, setVinculado] = useState(true); const [truncado, setTruncado] = useState(false); const [closer, setCloser] = useState<{ name: string; avatar_url: string | null } | null>(null)
  const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState<{ msg: string; migracao: boolean } | null>(null); const [modal, setModal] = useState(false)
  const opcoes = verticaisDoTime(team)
  const filtroAtivo = periodo?.key !== 'mes' || vertical !== 'todas' || recorrentes || !!busca
  const limpar = () => { setPeriodo(periodoPadrao()); setVertical('todas'); setRecorrentes(false); setBusca('') }

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    const range = periodo ? periodoToRange(periodo) : {}
    const r = await api<{ vinculado: boolean; vendas: VendaRow[]; truncated: boolean; closer?: { name: string; avatar_url: string | null } }>('/api/vendas/minhas' + qs({ ...range, vertical: vertical === 'todas' ? '' : vertical, recorrentes }))
    setCarregando(false)
    if (!r.ok) { setErro({ msg: r.error ?? 'Erro ao carregar.', migracao: !!r.migracao }); setRows([]); return }
    setRows(r.data!.vendas); setVinculado(r.data!.vinculado); setTruncado(r.data!.truncated); if (r.data!.closer) setCloser(r.data!.closer)
  }, [periodo, vertical, recorrentes])
  useEffect(() => { carregar() }, [carregar])

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase(); if (!t) return rows
    return rows.filter(v => [v.lead_name, v.email, v.transaction_id, v.coupon_code, v.product].some(x => (x ?? '').toLowerCase().includes(t)))
  }, [rows, busca])
  const total = useMemo(() => Math.round(filtradas.reduce((s, v) => s + (v.value ?? 0), 0) * 100) / 100, [filtradas])
  const porVertical = useMemo(() => opcoes.map(v => { const l = filtradas.filter(x => x.vertical === v); return { v, vendas: l.length, valor: Math.round(l.reduce((s, x) => s + (x.value ?? 0), 0) * 100) / 100 } }), [filtradas, opcoes])

  async function salvarObs(row: VendaRow, texto: string | null) {
    const r = await api<{ venda: { obs: string | null; obs_updated_at: string } }>(`/api/vendas/${row.id}/obs`, { method: 'PATCH', body: { obs: texto } })
    if (!r.ok) return { ok: false, error: r.error }
    setRows(rs => rs.map(x => (x.id === row.id ? { ...x, obs: r.data!.venda.obs, obs_updated_at: r.data!.venda.obs_updated_at } : x))); return { ok: true }
  }
  const nome = closer?.name?.split(' ')[0]
  return (
    <div className="vd" style={{ padding: '36px clamp(16px, 3vw, 40px) 64px', maxWidth: 1640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <VendasStyle />
      <PageHeader
        left={closer ? <Avatar name={closer.name} src={closer.avatar_url} size={68} ring={teamCor(team)} /> : <div style={{ width: 56, height: 56, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg,var(--primary),#8b5cf6)' }}><Receipt size={26} /></div>}
        title="Minhas Vendas" subtitle={<>{nome ? <>Olá, <strong style={{ color: 'var(--foreground)' }}>{nome}</strong>. </> : null}Aqui está o histórico das suas vendas. Você pode escrever uma observação em cada uma; os demais dados só o time de gestão altera.</>}
        right={<>
          <Link href="/vendas/trocas" data-v="ver-trocas" className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 20px', borderRadius: 14, textDecoration: 'none', fontSize: 14, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb,var(--primary) 10%,transparent)' }}>Minhas solicitações</Link>
          <Btn data-v="abrir-troca" variant="primary" size="lg" icon={<Repeat2 size={17} />} onClick={() => setModal(true)}>Solicitar troca de venda</Btn>
        </>} />
      <FilterBar ativo={filtroAtivo} onClear={limpar}>
        <PeriodoFilter value={periodo} onChange={p => setPeriodo(p ?? periodoPadrao())} padrao={periodoPadrao()} />
        {opcoes.length > 1 && <Select name="vertical" caption="Vertical" icon={<BarChart3 size={18} />} value={vertical} onChange={setVertical} defaultValue="todas" options={[{ value: 'todas', label: 'Todas as verticais' }, ...opcoes.map(v => ({ value: v, label: verticalLabel(v), cor: verticalCor(v) }))]} />}
        <Switch dataV="filtro-recorrentes" checked={recorrentes} onChange={setRecorrentes} label="Parcelas recorrentes" />
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar nome, e-mail, ID, cupom…" />
      </FilterBar>
      {erro && <Banner tipo={erro.migracao ? 'aviso' : 'erro'}>{erro.msg}</Banner>}
      {truncado && <Banner tipo="aviso">Há mais vendas do que o limite exibido. Reduza o período para ver todas.</Banner>}
      {!vinculado && !erro ? (
        <EmptyState dataV="nao-vinculado" icon={<ShoppingBag size={30} />} title="Seu usuário ainda não está vinculado a um closer" text="Seu usuário ainda não está vinculado a um closer. Fale com o time de gestão para liberar o seu histórico." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <Kpi dataV="kpi-vendas" label="Vendas" value={filtradas.length} icon={<ShoppingBag size={22} />} cor="#6366f1" />
            <Kpi dataV="kpi-valor" label="Valor total" value={fmtBRL(total)} icon={<Wallet size={22} />} cor="#16a34a" />
            <Kpi dataV="kpi-ticket" label="Ticket médio" value={filtradas.length ? fmtBRL(Math.round((total / filtradas.length) * 100) / 100) : '—'} icon={<TrendingUp size={22} />} cor="#f59e0b" />
          </div>
          <div data-v="por-vertical" className="vd-card vd-up" style={{ padding: '22px 26px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 16 }}>Vendido por vertical</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 24 }}>
              {porVertical.map(p => (
                <div key={p.v} data-v="pv-item" data-vertical={p.v} style={{ minWidth: 0, opacity: p.vendas ? 1 : 0.55 }}>
                  <VerticalChip v={p.v} />
                  <div className="vd-title" style={{ marginTop: 10, fontSize: 24, fontWeight: 800, color: 'var(--foreground)' }}>{fmtBRL(p.valor)}</div>
                  <div style={{ marginTop: 2, fontSize: 13, color: 'var(--muted-foreground)' }}>{p.vendas} venda{p.vendas === 1 ? '' : 's'}</div>
                  <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: 'var(--secondary)', overflow: 'hidden' }}><div style={{ width: `${total ? Math.max(p.valor ? 4 : 0, (p.valor / total) * 100) : 0}%`, height: '100%', borderRadius: 99, background: verticalCor(p.v), transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="vd-card vd-up" style={{ overflow: 'hidden' }}>
            {carregando ? <div style={{ padding: 20 }}><Skeleton linhas={6} /></div>
              : <VendasTable rows={filtradas} mode="closer" onSaveObs={salvarObs} empty={busca ? 'Nenhuma venda encontrada para esta busca.' : 'Você não tem vendas neste período.'} />}
          </div>
        </>
      )}
      <TrocaModal open={modal} onClose={() => setModal(false)} team={team} onCreated={() => { /* o histórico fica em Trocas de Venda */ }} />
    </div>
  )
}
