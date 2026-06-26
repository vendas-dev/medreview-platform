'use client'
import { useState } from 'react'
import {
  Brain, Sparkles, Loader2,
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Users, BarChart2, Lightbulb, AlertCircle, Star,
  Target, Activity,
} from 'lucide-react'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 })

function riskInfo(pctGoal: number, bizPassed: number, bizTotal: number) {
  const exp = bizTotal > 0 ? (bizPassed / bizTotal) * 100 : 50
  if (pctGoal >= exp + 10) return { bg:'rgba(34,197,94,.06)',  border:'rgba(34,197,94,.2)',  text:'#16a34a', label:'No caminho', Icon:CheckCircle2 }
  if (pctGoal >= exp - 15) return { bg:'rgba(234,179,8,.06)',  border:'rgba(234,179,8,.2)',  text:'#b45309', label:'Atenção',    Icon:AlertTriangle }
  return                          { bg:'rgba(239,68,68,.06)',  border:'rgba(239,68,68,.2)',  text:'#dc2626', label:'Em risco',   Icon:AlertTriangle }
}

// ── Insight Panel ──────────────────────────────────────────
function InsightPanel({ data: initData, date, isAdmin, isCloserType }: {
  data: any; date: string; isAdmin: boolean; isCloserType?: boolean
}) {
  const [data,    setData]    = useState<any>(initData)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function generate() {
    setLoading(true); setError('')
    try {
      // Admin gera insight global do time; closer gera só o próprio
      const url  = isAdmin ? '/api/intel/generate' : '/api/intel/generate-personal'
      const res  = await fetch(url, { method:'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error ?? 'Erro ao gerar'); return }
      setData(isAdmin ? (json.global ?? json.content) : json.content)
    } catch { setError('Erro de conexão') }
    finally  { setLoading(false) }
  }

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#6366f1,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Brain size={15} color="#fff"/>
          </div>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:800, color:'var(--foreground)' }}>
              {isCloserType ? 'Sua análise' : 'Análise do time'}
            </p>
            <p style={{ margin:0, fontSize:11, color:'var(--muted-foreground)' }}>{new Date(date+'T12:00:00').toLocaleDateString('pt-BR', { day:'numeric', month:'long' })}</p>
          </div>
        </div>
        {/* Botão disponível para admin E para o próprio closer */}
        <button onClick={generate} disabled={loading}
          style={{ display:'inline-flex', alignItems:'center', gap:6, height:32, padding:'0 14px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--secondary)', color:'var(--foreground)', fontSize:12, fontWeight:600, cursor:loading?'not-allowed':'pointer', opacity:loading?.6:1 }}>
          {loading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> : <Sparkles size={12} style={{ color:'#6366f1' }}/>}
          {loading ? 'Gerando...' : data ? 'Atualizar' : isCloserType ? 'Gerar minha análise' : 'Gerar análise'}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
        {error && <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', fontSize:12, color:'#dc2626' }}>{error}</div>}

        {!data && (
          <div style={{ padding:'24px 0', textAlign:'center', color:'var(--muted-foreground)' }}>
            <p style={{ margin:0, fontSize:13 }}>
              {isCloserType ? 'Clique em "Gerar minha análise" para criar seu insight personalizado.' : 'Clique em "Gerar análise" para criar o insight do time.'}
            </p>
          </div>
        )}

        {data && isCloserType && (
          // Layout para o closer — 4 cards menores
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {data.situacao && (
              <div style={{ gridColumn:'1/-1', padding:'14px 16px', borderRadius:11, background:'rgba(99,102,241,.04)', border:'1px solid rgba(99,102,241,.15)' }}>
                <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.08em' }}>Situação atual</p>
                <p style={{ margin:0, fontSize:13, color:'var(--foreground)', lineHeight:1.6 }}>{data.situacao}</p>
              </div>
            )}
            {data.destaque && (
              <div style={{ padding:'12px 14px', borderRadius:11, background:'rgba(34,197,94,.04)', border:'1px solid rgba(34,197,94,.2)' }}>
                <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.08em' }}>Destaque</p>
                <p style={{ margin:0, fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{data.destaque}</p>
              </div>
            )}
            {data.alerta && (
              <div style={{ padding:'12px 14px', borderRadius:11, background:'rgba(234,179,8,.04)', border:'1px solid rgba(234,179,8,.2)' }}>
                <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700, color:'#b45309', textTransform:'uppercase', letterSpacing:'.08em' }}>Atenção</p>
                <p style={{ margin:0, fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{data.alerta}</p>
              </div>
            )}
            {data.acao && (
              <div style={{ gridColumn:'1/-1', padding:'12px 16px', borderRadius:11, background:'rgba(168,85,247,.04)', border:'1px solid rgba(168,85,247,.2)', display:'flex', gap:10, alignItems:'flex-start' }}>
                <Lightbulb size={14} style={{ color:'#a855f7', flexShrink:0, marginTop:2 }}/>
                <div>
                  <p style={{ margin:'0 0 2px', fontSize:10, fontWeight:700, color:'#a855f7', textTransform:'uppercase', letterSpacing:'.08em' }}>Próximo passo</p>
                  <p style={{ margin:0, fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{data.acao}</p>
                </div>
              </div>
            )}
            {/* Fallback: resumo_time quando vier do formato global */}
            {data.resumo_time && !data.situacao && (
              <div style={{ gridColumn:'1/-1', padding:'14px 16px', borderRadius:11, background:'rgba(99,102,241,.04)', border:'1px solid rgba(99,102,241,.15)' }}>
                <p style={{ margin:0, fontSize:13, color:'var(--foreground)', lineHeight:1.6 }}>{data.resumo_time}</p>
              </div>
            )}
          </div>
        )}

        {data && !isCloserType && (
          // Layout admin — seções por tipo
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {data.alertas_criticos?.length > 0 && (
              <div style={{ padding:'12px 16px', borderRadius:11, background:'rgba(239,68,68,.04)', border:'1px solid rgba(239,68,68,.18)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <AlertCircle size={13} style={{ color:'#dc2626' }}/>
                  <span style={{ fontSize:10, fontWeight:800, color:'#dc2626', textTransform:'uppercase', letterSpacing:'.08em' }}>Alertas críticos</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {data.alertas_criticos.map((a: any, i: number) => (
                    <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'rgba(239,68,68,.1)', padding:'2px 8px', borderRadius:5, whiteSpace:'nowrap', flexShrink:0 }}>{a.closer}</span>
                      <span style={{ fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{a.texto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.atencao?.length > 0 && (
              <div style={{ padding:'12px 16px', borderRadius:11, background:'rgba(234,179,8,.04)', border:'1px solid rgba(234,179,8,.18)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <AlertTriangle size={13} style={{ color:'#b45309' }}/>
                  <span style={{ fontSize:10, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.08em' }}>Atenção</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {data.atencao.map((a: any, i: number) => (
                    <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#b45309', background:'rgba(234,179,8,.1)', padding:'2px 8px', borderRadius:5, whiteSpace:'nowrap', flexShrink:0 }}>{a.closer}</span>
                      <span style={{ fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{a.texto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.destaques?.length > 0 && (
              <div style={{ padding:'12px 16px', borderRadius:11, background:'rgba(34,197,94,.04)', border:'1px solid rgba(34,197,94,.18)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <Star size={13} style={{ color:'#16a34a' }}/>
                  <span style={{ fontSize:10, fontWeight:800, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.08em' }}>Destaques</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {data.destaques.map((a: any, i: number) => (
                    <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#16a34a', background:'rgba(34,197,94,.1)', padding:'2px 8px', borderRadius:5, whiteSpace:'nowrap', flexShrink:0 }}>{a.closer}</span>
                      <span style={{ fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{a.texto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.resumo_time && (
              <div style={{ padding:'12px 16px', borderRadius:11, background:'rgba(99,102,241,.04)', border:'1px solid rgba(99,102,241,.15)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <Activity size={13} style={{ color:'#6366f1' }}/>
                  <span style={{ fontSize:10, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.08em' }}>Visão geral</span>
                </div>
                <p style={{ margin:0, fontSize:12, color:'var(--foreground)', lineHeight:1.6 }}>{data.resumo_time}</p>
              </div>
            )}
            {data.recomendacao && (
              <div style={{ padding:'12px 16px', borderRadius:11, background:'rgba(168,85,247,.04)', border:'1px solid rgba(168,85,247,.18)', display:'flex', gap:10, alignItems:'flex-start' }}>
                <Lightbulb size={14} style={{ color:'#a855f7', flexShrink:0, marginTop:1 }}/>
                <div>
                  <p style={{ margin:'0 0 2px', fontSize:10, fontWeight:800, color:'#a855f7', textTransform:'uppercase', letterSpacing:'.08em' }}>Recomendação</p>
                  <p style={{ margin:0, fontSize:12, color:'var(--foreground)', lineHeight:1.5 }}>{data.recomendacao}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, sub, accent='#6366f1', Icon, borderColor }: any) {
  return (
    <div style={{ background:'var(--card)', border:`1px solid ${borderColor ?? 'var(--border)'}`, borderRadius:14, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</span>
        <div style={{ width:28, height:28, borderRadius:8, background:`${accent}12`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={13} style={{ color:accent }}/>
        </div>
      </div>
      <p style={{ margin:0, fontSize:22, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>{value}</p>
      {sub && <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--muted-foreground)' }}>{sub}</p>}
    </div>
  )
}

// ── Admin View ─────────────────────────────────────────────
function AdminView({ closerStats, insightData, insightDate }: any) {
  const stats: any[] = closerStats ?? []
  const sorted     = [...stats].sort((a, b) => b.revenue_month - a.revenue_month)
  const totalRev   = stats.reduce((s: number, x: any) => s + x.revenue_month, 0)
  const totalLeads  = stats.reduce((s: number, x: any) => s + x.leads_month, 0)
  const withGoal    = stats.filter((s: any) => s.goal_sales > 0)
  const atRisk      = withGoal.filter((s: any) => riskInfo(s.pct_goal, s.biz_passed, s.biz_total).label === 'Em risco').length
  const withLeads   = stats.filter((s: any) => s.leads_month > 0)
  const avgConv     = withLeads.length > 0 ? withLeads.reduce((s: number, x: any) => s + x.conversion_rate, 0) / withLeads.length : 0

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(79,70,229,.25)' }}>
          <Brain size={16} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em' }}>Inteligência Comercial</h1>
          <p style={{ margin:0, fontSize:12, color:'var(--muted-foreground)' }}>
            {new Date(insightDate+'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        <StatCard label="Receita do mês" value={fmtBRL(totalRev)} sub={`${stats.length} closers`} Icon={TrendingUp} accent="#6366f1"/>
        <StatCard label="Leads HubSpot" value={String(totalLeads)} sub="registrados este mês" Icon={Users} accent="#8b5cf6"/>
        <StatCard label="Conversão média" value={`${avgConv.toFixed(1)}%`} sub={`${withLeads.length} closers com leads`} Icon={BarChart2} accent="#a855f7"/>
        <StatCard label="Em risco de meta" value={String(atRisk)} sub={`de ${withGoal.length} com meta definida`} Icon={AlertTriangle} accent={atRisk > 0 ? '#dc2626' : '#16a34a'} borderColor={atRisk > 0 ? 'rgba(239,68,68,.2)' : undefined}/>
      </div>

      {/* Insight */}
      <InsightPanel data={insightData} date={insightDate} isAdmin={true} isCloserType={false}/>

      {/* Tabela */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <Users size={14} style={{ color:'var(--muted-foreground)' }}/>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--foreground)' }}>Performance individual — {new Date().toLocaleDateString('pt-BR', { month:'long', year:'numeric' })}</span>
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted-foreground)' }}>{sorted.length} closers</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--secondary)' }}>
                {['Closer','Time','Receita','Meta','Projeção','Leads','Conversão','Status'].map(h => (
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={8} style={{ padding:'32px', textAlign:'center', color:'var(--muted-foreground)', fontSize:13 }}>Nenhum dado disponível ainda.</td></tr>
              )}
              {sorted.map((s: any, i: number) => {
                const risk = riskInfo(s.pct_goal, s.biz_passed, s.biz_total)
                const { Icon: RI } = risk
                const tc = s.team === 'R1' ? { bg:'rgba(124,58,237,.08)', color:'#7c3aed' } : { bg:'rgba(37,99,235,.08)', color:'#2563eb' }
                return (
                  <tr key={s.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'11px 14px', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900, color:'#fff', flexShrink:0 }}>
                          {s.name.split(' ').slice(0,2).map((n: string) => n[0]).join('')}
                        </div>
                        <span style={{ fontWeight:600, color:'var(--foreground)' }}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:tc.bg, color:tc.color, fontWeight:700 }}>{s.team ?? '—'}</span>
                    </td>
                    <td style={{ padding:'11px 14px', fontVariantNumeric:'tabular-nums', fontWeight:700, color:'var(--foreground)' }}>{fmtBRL(s.revenue_month)}</td>
                    <td style={{ padding:'11px 14px' }}>
                      {s.goal_sales > 0 ? (
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:52, height:4, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${Math.min(s.pct_goal, 100)}%`, background:risk.text === '#16a34a' ? '#22c55e' : risk.text === '#b45309' ? '#f59e0b' : '#ef4444', borderRadius:999 }}/>
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:risk.text }}>{s.pct_goal.toFixed(0)}%</span>
                        </div>
                      ) : <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>—</span>}
                    </td>
                    <td style={{ padding:'11px 14px', fontVariantNumeric:'tabular-nums', color:'var(--muted-foreground)' }}>{fmtBRL(s.revenue_projected)}</td>
                    <td style={{ padding:'11px 14px', color:'var(--muted-foreground)' }}>{s.leads_month > 0 ? s.leads_month : '—'}</td>
                    <td style={{ padding:'11px 14px', color:'var(--muted-foreground)' }}>{s.leads_month > 0 ? `${s.conversion_rate.toFixed(1)}%` : '—'}</td>
                    <td style={{ padding:'11px 14px' }}>
                      {s.goal_sales > 0 ? (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, background:risk.bg, border:`1px solid ${risk.border}` }}>
                          <RI size={10} style={{ color:risk.text }}/>
                          <span style={{ fontSize:10, fontWeight:700, color:risk.text }}>{risk.label}</span>
                        </div>
                      ) : <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Closer View ────────────────────────────────────────────
function CloserView({ profile, snapshot, insightData, insightDate }: any) {
  const s      = snapshot ?? {}
  const gS     = Number(s.goal_sales ?? 0)
  const pct    = gS > 0 ? Math.min((s.revenue_month / gS) * 100, 100) : 0
  const risk   = riskInfo(pct, s.business_days_passed ?? 0, s.business_days_total ?? 22)
  const { Icon: RI } = risk
  const last7: any[] = s.last7 ?? []
  const dW = s.delta_week_pct ?? 0
  const dM = s.delta_month_pct ?? 0

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(79,70,229,.25)' }}>
          <Brain size={16} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.02em' }}>Olá, {profile?.name?.split(' ')[0]}</h1>
          <p style={{ margin:0, fontSize:12, color:'var(--muted-foreground)' }}>
            {new Date(insightDate+'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
      </div>

      {/* Insight pessoal */}
      <InsightPanel data={insightData} date={insightDate} isAdmin={false} isCloserType={true}/>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
        {/* Meta */}
        <div style={{ background:'var(--card)', border:`1px solid ${gS > 0 ? risk.border : 'var(--border)'}`, borderRadius:14, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.07em' }}>Meta mensal</span>
            {gS > 0 && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, background:risk.bg, border:`1px solid ${risk.border}` }}>
                <RI size={10} style={{ color:risk.text }}/>
                <span style={{ fontSize:10, fontWeight:700, color:risk.text }}>{risk.label}</span>
              </div>
            )}
          </div>
          <div>
            <p style={{ margin:0, fontSize:26, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(s.revenue_month ?? 0)}</p>
            <p style={{ margin:'3px 0 0', fontSize:11, color:'var(--muted-foreground)' }}>de {gS > 0 ? fmtBRL(gS) : 'meta não definida'}</p>
          </div>
          {gS > 0 && (
            <>
              <div style={{ height:5, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:risk.text === '#16a34a' ? '#22c55e' : risk.text === '#b45309' ? '#f59e0b' : '#ef4444', borderRadius:999, transition:'width .8s ease' }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted-foreground)' }}>
                <span>{pct.toFixed(0)}% concluído</span>
                <span>{s.business_days_remaining ?? '?'} dias úteis restantes</span>
              </div>
            </>
          )}
        </div>

        {/* Projeção + comparativos */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.07em' }}>Projeção de fechamento</span>
          <p style={{ margin:0, fontSize:26, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(s.revenue_projected ?? 0)}</p>
          <div style={{ display:'flex', gap:18, paddingTop:2, borderTop:'1px solid var(--border)' }}>
            {[{ label:'Vs semana anterior', v:dW }, { label:'Vs mês anterior', v:dM }].map(({ label, v }) => (
              <div key={label}>
                <p style={{ margin:'0 0 2px', fontSize:10, color:'var(--muted-foreground)' }}>{label}</p>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  {v >= 0 ? <TrendingUp size={11} style={{ color:'#16a34a' }}/> : <TrendingDown size={11} style={{ color:'#dc2626' }}/>}
                  <span style={{ fontSize:12, fontWeight:700, color:v >= 0 ? '#16a34a' : '#dc2626' }}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vendas */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.07em' }}>Vendas este mês</span>
          <p style={{ margin:'8px 0 3px', fontSize:26, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em' }}>{s.sales_month ?? 0}</p>
          <p style={{ margin:0, fontSize:11, color:(s.days_since_last_sale ?? 999) > 3 ? '#dc2626' : 'var(--muted-foreground)' }}>
            {(s.days_since_last_sale ?? 999) === 999 ? 'Nenhuma venda registrada'
              : (s.days_since_last_sale ?? 999) === 0 ? 'Última venda hoje'
              : `Última venda há ${s.days_since_last_sale} dias`}
          </p>
        </div>

        {/* Leads */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.07em' }}>Leads este mês</span>
          <p style={{ margin:'8px 0 3px', fontSize:26, fontWeight:900, color:'var(--foreground)', letterSpacing:'-.03em' }}>{(s.leads_month ?? 0) > 0 ? s.leads_month : '—'}</p>
          <p style={{ margin:0, fontSize:11, color:'var(--muted-foreground)' }}>
            {(s.leads_month ?? 0) > 0
              ? `${s.leads_open} em aberto · ${(s.conversion_rate ?? 0).toFixed(1)}% conversão`
              : 'Sem leads HubSpot registrados'}
          </p>
        </div>
      </div>

      {/* Gráfico 7 dias */}
      {last7.some((d: any) => d.rev > 0) && (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
          <p style={{ margin:'0 0 14px', fontSize:12, fontWeight:700, color:'var(--foreground)', textTransform:'uppercase', letterSpacing:'.06em' }}>Últimos 7 dias</p>
          <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:90 }}>
            {last7.map((d: any, i: number) => {
              const maxR = Math.max(...last7.map((x: any) => x.rev), 1)
              const p    = (d.rev / maxR) * 100
              const isT  = i === 6
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ height:18, display:'flex', alignItems:'flex-end', justifyContent:'center', marginBottom:3 }}>
                    {d.rev > 0 && <span style={{ fontSize:d.rev >= 1000 ? 7 : 8, fontWeight:isT ? 700 : 500, color:isT ? '#6366f1' : 'var(--muted-foreground)', whiteSpace:'nowrap' }}>
                      {d.rev >= 1000 ? `R$${(d.rev/1000).toFixed(0)}k` : `R$${d.rev.toFixed(0)}`}
                    </span>}
                  </div>
                  <div style={{ width:'100%', height:56, display:'flex', alignItems:'flex-end' }}>
                    <div style={{ width:'100%', height:`${Math.max(p, d.rev > 0 ? 8 : 2)}%`, borderRadius:'4px 4px 0 0', background:isT ? '#6366f1' : 'rgba(99,102,241,.25)', minHeight:d.rev > 0 ? 4 : 1 }}/>
                  </div>
                  <span style={{ fontSize:8, marginTop:4, color:isT ? '#6366f1' : 'var(--muted-foreground)', fontWeight:isT ? 700 : 400 }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Receita por vertical */}
      {Object.keys(s.revenue_by_vertical ?? {}).length > 0 && (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
          <p style={{ margin:'0 0 14px', fontSize:12, fontWeight:700, color:'var(--foreground)', textTransform:'uppercase', letterSpacing:'.06em' }}>Receita por vertical</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(s.revenue_by_vertical as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .map(([vert, rev]) => {
                const maxR = Math.max(...Object.values(s.revenue_by_vertical as Record<string, number>))
                const p    = maxR > 0 ? ((rev as number) / maxR) * 100 : 0
                return (
                  <div key={vert}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, color:'var(--foreground)', fontWeight:500 }}>{vert}</span>
                      <span style={{ fontSize:12, fontVariantNumeric:'tabular-nums', color:'var(--muted-foreground)', fontWeight:600 }}>{fmtBRL(rev as number)}</span>
                    </div>
                    <div style={{ height:4, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${p}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:999 }}/>
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

export function IntelView({ isAdmin, profile, closerStats, insightData, insightDate, snapshot }: any) {
  if (isAdmin) return <AdminView closerStats={closerStats} insightData={insightData} insightDate={insightDate}/>
  return <CloserView profile={profile} snapshot={snapshot} insightData={insightData} insightDate={insightDate}/>
}
