'use client'
import { useState } from 'react'
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Users, Target, Zap, BarChart2 } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function riskColor(pctGoal: number, daysRemaining: number, daysTotal: number) {
  const expectedPct = daysTotal > 0 ? ((daysTotal - daysRemaining) / daysTotal) * 100 : 50
  if (pctGoal >= expectedPct + 10) return { bg: 'rgba(34,197,94,.08)',  border: 'rgba(34,197,94,.25)',  text: '#16a34a', label: 'No caminho',  icon: CheckCircle2 }
  if (pctGoal >= expectedPct - 15) return { bg: 'rgba(234,179,8,.08)',  border: 'rgba(234,179,8,.25)',  text: '#ca8a04', label: 'Atenção',     icon: AlertTriangle }
  return                                  { bg: 'rgba(239,68,68,.08)',  border: 'rgba(239,68,68,.25)',  text: '#dc2626', label: 'Em risco',    icon: AlertTriangle }
}

function KpiCard({ label, value, sub, accent = '#6366f1', icon: Icon }: any) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        {Icon && <div style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} style={{ color: accent }}/></div>}
      </div>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>{sub}</p>}
    </div>
  )
}

// ── Painel Admin ────────────────────────────────────────────
function AdminView({ snapshots, insightText, insightDate }: any) {
  const [filterTeam, setFilterTeam] = useState<'todos'|'R1'|'OAO'>('todos')

  const filtered = (snapshots as any[]).filter((s: any) =>
    filterTeam === 'todos' || s.profiles?.team === filterTeam
  )

  const totalRevenue    = filtered.reduce((s: number, x: any) => s + (x.revenue_month ?? 0), 0)
  const totalLeads      = filtered.reduce((s: number, x: any) => s + (x.leads_month   ?? 0), 0)
  const atRisk          = filtered.filter((s: any) => {
    const risk = riskColor(s.pct_goal ?? 0, s.business_days_remaining ?? 5, s.business_days_total ?? 22)
    return risk.label === 'Em risco'
  }).length
  const avgConversion   = filtered.length > 0
    ? filtered.reduce((s: number, x: any) => s + (x.conversion_rate ?? 0), 0) / filtered.length
    : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,.3)' }}>
              <Brain size={18} color="#fff"/>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.03em' }}>Inteligência Comercial</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Visão de gestão · {new Date(insightDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {/* Filtro de time */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['todos','R1','OAO'] as const).map(t => (
            <button key={t} onClick={() => setFilterTeam(t)}
              style={{ height: 34, padding: '0 16px', borderRadius: 9, border: `1.5px solid ${filterTeam === t ? '#6366f1' : 'var(--border)'}`, background: filterTeam === t ? 'rgba(99,102,241,.1)' : 'var(--background)', color: filterTeam === t ? '#6366f1' : 'var(--muted-foreground)', fontSize: 12, fontWeight: filterTeam === t ? 700 : 500, cursor: 'pointer', transition: 'all .15s' }}>
              {t === 'todos' ? '👥 Todos' : `🔵 ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Insight da IA */}
      {insightText ? (
        <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.06),rgba(124,58,237,.04))', border: '1.5px solid rgba(99,102,241,.18)', borderRadius: 18, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={14} style={{ color: '#6366f1' }}/>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.08em' }}>Análise da IA · {insightDate}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--foreground)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{insightText}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '32px 24px', textAlign: 'center' }}>
          <Brain size={32} style={{ color: 'var(--muted-foreground)', margin: '0 auto 12px' }}/>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>Insight de hoje ainda não foi gerado.</p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>O cron job roda todos os dias às 6h e gera a análise automaticamente.</p>
        </div>
      )}

      {/* KPIs globais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Receita total do mês" value={fmtBRL(totalRevenue)} sub={`${filtered.length} closers`} icon={TrendingUp} accent="#6366f1"/>
        <KpiCard label="Leads recebidos" value={totalLeads.toString()} sub="mês atual" icon={Users} accent="#8b5cf6"/>
        <KpiCard label="Conv. média" value={`${avgConversion.toFixed(1)}%`} sub="leads → vendas" icon={BarChart2} accent="#a855f7"/>
        <KpiCard label="Em risco de meta" value={`${atRisk}`} sub={`de ${filtered.length} closers`} icon={AlertTriangle} accent={atRisk > 0 ? '#ef4444' : '#22c55e'}/>
      </div>

      {/* Tabela de closers */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} style={{ color: '#6366f1' }}/>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>Closers — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-foreground)' }}>{filtered.length} registros</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
            Nenhum snapshot disponível. O cron gera os dados às 6h diariamente.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--secondary)' }}>
                  {['Closer','Time','Receita mês','% Meta','Projeção','Leads','Conversão','Dias s/ venda','Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any, i: number) => {
                  const risk = riskColor(s.pct_goal ?? 0, s.business_days_remaining ?? 5, s.business_days_total ?? 22)
                  const RiskIcon = risk.icon
                  const deltaWeek = s.delta_week_pct ?? 0
                  return (
                    <tr key={s.user_id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.01)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                            {(s.profiles?.name ?? '?').split(' ').slice(0,2).map((n: string) => n[0]).join('')}
                          </div>
                          {s.profiles?.name ?? '—'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted-foreground)' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: s.profiles?.team === 'R1' ? 'rgba(99,102,241,.1)' : 'rgba(168,85,247,.1)', color: s.profiles?.team === 'R1' ? '#6366f1' : '#a855f7', fontWeight: 700 }}>{s.profiles?.team ?? '—'}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--foreground)' }}>{fmtBRL(s.revenue_month ?? 0)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(s.pct_goal ?? 0, 100)}%`, background: risk.text === '#16a34a' ? '#22c55e' : risk.text === '#ca8a04' ? '#f59e0b' : '#ef4444', borderRadius: 999 }}/>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: risk.text }}>{(s.pct_goal ?? 0).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground)' }}>{fmtBRL(s.revenue_projected ?? 0)}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted-foreground)' }}>{s.leads_month ?? '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted-foreground)' }}>
                        {s.leads_month > 0 ? `${(s.conversion_rate ?? 0).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: (s.days_since_last_sale ?? 0) > 3 ? 700 : 400, color: (s.days_since_last_sale ?? 0) > 3 ? '#ef4444' : 'var(--muted-foreground)' }}>
                          {s.days_since_last_sale === 999 ? 'sem vendas' : s.days_since_last_sale === 0 ? 'hoje' : `${s.days_since_last_sale}d atrás`}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8, background: risk.bg, border: `1px solid ${risk.border}` }}>
                          <RiskIcon size={11} style={{ color: risk.text }}/>
                          <span style={{ fontSize: 10, fontWeight: 700, color: risk.text }}>{risk.label}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Painel Closer ────────────────────────────────────────────
function CloserView({ profile, snapshot, insightText, insightDate, goal }: any) {
  const s = snapshot ?? {}
  const goalSales = goal?.goal_sales ?? 0
  const pctGoal   = goalSales > 0 ? Math.min(((s.revenue_month ?? 0) / goalSales) * 100, 100) : 0
  const risk = riskColor(pctGoal, s.business_days_remaining ?? 5, s.business_days_total ?? 22)
  const RiskIcon = risk.icon

  // Mini gráfico semanal (últimos 7 dias a partir do delta)
  const revenueMonth = s.revenue_month ?? 0
  const revenueWeek  = s.revenue_week  ?? 0
  const revenuePrevWeek = s.revenue_prev_week ?? 0
  const deltaWeekPct    = s.delta_week_pct ?? 0
  const deltaMonthPct   = s.delta_month_pct ?? 0
  const weekUp = deltaWeekPct >= 0

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,.3)' }}>
          <Brain size={18} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.02em' }}>Olá, {profile?.name?.split(' ')[0]} 👋</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Seu painel comercial · {new Date(insightDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* Insight pessoal da IA */}
      {insightText ? (
        <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.06),rgba(124,58,237,.04))', border: '1.5px solid rgba(99,102,241,.18)', borderRadius: 18, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={14} style={{ color: '#6366f1' }}/>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.08em' }}>Sua análise de hoje</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--foreground)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{insightText}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 24px', textAlign: 'center' }}>
          <Brain size={28} style={{ color: 'var(--muted-foreground)', margin: '0 auto 10px' }}/>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Seu insight de hoje ainda não foi gerado.</p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        {/* Meta do mês */}
        <div style={{ background: 'var(--card)', border: `1.5px solid ${risk.border}`, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Meta do mês</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8, background: risk.bg, border: `1px solid ${risk.border}` }}>
              <RiskIcon size={11} style={{ color: risk.text }}/>
              <span style={{ fontSize: 10, fontWeight: 700, color: risk.text }}>{risk.label}</span>
            </div>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(revenueMonth)}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>de {goalSales > 0 ? fmtBRL(goalSales) : 'meta não definida'}</p>
          </div>
          {goalSales > 0 && (
            <>
              <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctGoal}%`, background: risk.text === '#16a34a' ? '#22c55e' : risk.text === '#ca8a04' ? '#f59e0b' : '#ef4444', borderRadius: 999, transition: 'width .8s ease' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{pctGoal.toFixed(0)}% atingido</span>
                <span style={{ color: 'var(--muted-foreground)' }}>{s.business_days_remaining ?? '?'} dias úteis restantes</span>
              </div>
            </>
          )}
        </div>

        {/* Projeção */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Projeção de fechamento</span>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(s.revenue_projected ?? 0)}</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Esta semana</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {weekUp ? <TrendingUp size={12} style={{ color: '#22c55e' }}/> : <TrendingDown size={12} style={{ color: '#ef4444' }}/>}
                <span style={{ fontSize: 13, fontWeight: 700, color: weekUp ? '#22c55e' : '#ef4444' }}>{weekUp ? '+' : ''}{deltaWeekPct.toFixed(1)}%</span>
              </div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>vs mês anterior</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {deltaMonthPct >= 0 ? <TrendingUp size={12} style={{ color: '#22c55e' }}/> : <TrendingDown size={12} style={{ color: '#ef4444' }}/>}
                <span style={{ fontSize: 13, fontWeight: 700, color: deltaMonthPct >= 0 ? '#22c55e' : '#ef4444' }}>{deltaMonthPct >= 0 ? '+' : ''}{deltaMonthPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leads */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Leads este mês</span>
          <p style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.03em' }}>{s.leads_month ?? '—'}</p>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
            <span>{s.leads_open ?? 0} em aberto</span>
            <span>{s.leads_lost ?? 0} perdidos</span>
          </div>
        </div>

        {/* Conversão */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Taxa de conversão</span>
          <p style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-.03em' }}>
            {(s.leads_month ?? 0) > 0 ? `${(s.conversion_rate ?? 0).toFixed(1)}%` : '—'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{s.sales_month ?? 0} vendas / {s.leads_month ?? 0} leads</p>
        </div>
      </div>

      {/* Por vertical */}
      {s.revenue_by_vertical && Object.keys(s.revenue_by_vertical).length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>Receita por vertical</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(s.revenue_by_vertical as Record<string,number>)
              .sort(([,a],[,b]) => b - a)
              .map(([vert, rev]) => {
                const maxRev = Math.max(...Object.values(s.revenue_by_vertical as Record<string,number>))
                const pct    = maxRev > 0 ? (rev / maxRev) * 100 : 0
                return (
                  <div key={vert}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600 }}>{vert}</span>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground)', fontWeight: 600 }}>{fmtBRL(rev)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius: 999 }}/>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────
interface Props {
  isAdmin:      boolean
  profile:      any
  snapshots:    any[]
  insightText:  string | null
  insightDate:  string
  closers:      any[]
  goal:         any
}

export function IntelView({ isAdmin, profile, snapshots, insightText, insightDate, closers, goal }: Props) {
  if (isAdmin) return <AdminView snapshots={snapshots} insightText={insightText} insightDate={insightDate}/>
  return <CloserView profile={profile} snapshot={snapshots[0] ?? null} insightText={insightText} insightDate={insightDate} goal={goal}/>
}
