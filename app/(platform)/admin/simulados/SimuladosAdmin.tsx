'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend,
} from 'recharts'
import { Plus, Trash2, Check, X, BarChart2, BookOpen, MessageSquare, Save } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────
interface SAnswer   { id:string; answer:string; is_correct:boolean; order_index:number }
interface SQuestion { id:string; question:string; order_index:number; simulado_answers:SAnswer[] }
interface Simulado  { id:string; numero:number; titulo:string; descricao:string|null; nota_minima:number; team:string; simulado_questions:SQuestion[] }
interface Attempt   { id:string; user_id:string; simulado_numero:number; score:number; correct_answers:number; wrong_answers:number; total_questions:number; passed:boolean; completed_at:string; profiles:{name:string;email:string} }
interface Insight   { id:string; user_id:string; day_number:number|null; insight_type:string; content:string; created_at:string; profiles:{name:string}; onboarding_steps:{title:string;day_number:number}|null }

const COLORS = ['#818cf8','#f87171','#34d399','#fbbf24','#a78bfa','#60a5fa']
const TOOLTIP_STYLE = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, fontSize:12, color:'var(--foreground)' }
const TEAMS = ['ambos','R1','OAO'] as const
type TeamKey = typeof TEAMS[number]
type TabId = 'questions'|'analytics'|'insights'

// ── Question Editor ───────────────────────────────────────────
function QuestionEditor({ simulado, onRefresh }: { simulado:Simulado; onRefresh:()=>void }) {
  const supabase  = createClient()
  const router    = useRouter()
  const [newQ,       setNewQ]        = useState('')
  const [newAnswers, setNewAnswers]   = useState(['','','',''])
  const [correctIdx, setCorrectIdx]   = useState(0)
  const [adding,     setAdding]       = useState(false)
  const [saving,     setSaving]       = useState(false)
  const [editNota,   setEditNota]     = useState(simulado.nota_minima)
  const [editTitulo, setEditTitulo]   = useState(simulado.titulo)
  const [savingMeta, setSavingMeta]   = useState(false)
  const [metaSaved,  setMetaSaved]    = useState(false)

  const questions = [...(simulado.simulado_questions ?? [])].sort((a,b)=>a.order_index-b.order_index)

  // Salvar nota mínima e título via API route (usa admin client no servidor)
  async function saveMeta() {
    setSavingMeta(true)
    const res = await fetch('/api/simulado/update', {
      method:  'PATCH',
      headers: { 'Content-Type':'application/json' },
      body:    JSON.stringify({ id: simulado.id, nota_minima: editNota, titulo: editTitulo }),
    })
    setSavingMeta(false)
    if (res.ok) {
      setMetaSaved(true)
      setTimeout(() => setMetaSaved(false), 2000)
      router.refresh()  // re-fetcha server component com dados atualizados
    }
  }

  async function addQuestion() {
    if (!newQ.trim()) return
    // Validar correta obrigatória
    if (!newCorrect && newCorrect !== 0) { alert('Selecione qual alternativa é a correta.'); return }
    if (newAnswers.filter((a: string)=>a.trim()).length < 2) { alert('Preencha pelo menos 2 alternativas.'); return }
    setSaving(true)
    const { data: q } = await supabase.from('simulado_questions').insert({
      simulado_id: simulado.id, question: newQ.trim(), order_index: questions.length,
    }).select().single()
    if (q) {
      await supabase.from('simulado_answers').insert(
        newAnswers.map((a,i) => ({ question_id: q.id, answer: a.trim(), is_correct: i===correctIdx, order_index: i }))
      )
    }
    setNewQ(''); setNewAnswers(['','','','']); setCorrectIdx(0); setAdding(false); setSaving(false)
    router.refresh()
  }

  async function deleteQuestion(qId: string) {
    if (!confirm('Excluir esta pergunta?')) return
    await supabase.from('simulado_questions').delete().eq('id', qId)
    router.refresh()
  }

  const INP: React.CSSProperties = { width:'100%', height:40, padding:'0 12px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  return (
    <div>
      {/* Meta: nota mínima + título */}
      <div style={{ background:'var(--secondary)', borderRadius:14, padding:'16px 18px', marginBottom:20, display:'flex', flexDirection:'column', gap:10 }}>
        <p style={{ fontSize:12, fontWeight:800, color:'var(--muted-foreground)', margin:0, textTransform:'uppercase', letterSpacing:'.07em' }}>Configurações do simulado</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5 }}>TÍTULO</label>
            <input value={editTitulo} onChange={e=>setEditTitulo(e.target.value)} style={INP}/>
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)', display:'block', marginBottom:5 }}>NOTA MÍNIMA (%)</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="number" min={0} max={100} value={editNota}
                onChange={e=>setEditNota(Number(e.target.value))}
                style={{ ...INP, width:80, textAlign:'center' }}/>
              <button onClick={saveMeta} disabled={savingMeta}
                style={{ height:40, padding:'0 14px', borderRadius:9, border:'none', background: metaSaved?'#059669':'#6366f1', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, transition:'background .2s', whiteSpace:'nowrap' }}>
                <Save size={13}/> {savingMeta?'Salvando...':metaSaved?'✓ Salvo!':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Perguntas */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
        {questions.map((q,qi) => (
          <div key={q.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', boxShadow:'0 1px 6px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <span style={{ fontSize:11, fontWeight:800, color:'#6366f1', background:'rgba(99,102,241,.1)', borderRadius:7, padding:'2px 8px', flexShrink:0, marginTop:2 }}>#{qi+1}</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:600, color:'var(--foreground)', margin:'0 0 10px', lineHeight:1.5 }}>{q.question}</p>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[...(q.simulado_answers??[])].sort((a,b)=>a.order_index-b.order_index).map(a => (
                    <div key={a.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 10px', borderRadius:8, background:a.is_correct?'rgba(52,211,153,.08)':'var(--secondary)', border:`1px solid ${a.is_correct?'rgba(52,211,153,.3)':'transparent'}` }}>
                      {a.is_correct ? <Check size={13} style={{ color:'#059669', flexShrink:0 }}/> : <div style={{ width:13 }}/>}
                      <span style={{ fontSize:13, color:'var(--foreground)' }}>{a.answer}</span>
                      {a.is_correct && <span style={{ fontSize:10, fontWeight:700, color:'#059669', marginLeft:'auto' }}>CORRETA</span>}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={()=>deleteQuestion(q.id)} style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.06)', cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        ))}
        {questions.length === 0 && <p style={{ textAlign:'center', padding:32, color:'var(--muted-foreground)', fontSize:13 }}>Nenhuma pergunta cadastrada ainda.</p>}
      </div>

      {/* Adicionar pergunta */}
      {!adding ? (
        <button onClick={()=>setAdding(true)} style={{ width:'100%', height:44, borderRadius:12, border:'2px dashed var(--border)', background:'transparent', color:'#6366f1', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <Plus size={16}/> Adicionar Pergunta
        </button>
      ) : (
        <div style={{ background:'var(--card)', border:'1.5px solid #6366f1', borderRadius:16, padding:20, boxShadow:'0 4px 20px rgba(99,102,241,.15)' }}>
          <p style={{ fontSize:13, fontWeight:800, color:'var(--foreground)', margin:'0 0 12px' }}>Nova Pergunta</p>
          <textarea value={newQ} onChange={e=>setNewQ(e.target.value)} placeholder="Digite a pergunta..."
            style={{ width:'100%', minHeight:80, padding:12, borderRadius:10, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:13, resize:'vertical', outline:'none', fontFamily:'inherit', marginBottom:14, boxSizing:'border-box' }}/>
          <p style={{ fontSize:11, fontWeight:800, color:'#6366f1', margin:'0 0 8px', textTransform:'uppercase', letterSpacing:'.07em' }}>Alternativas (marque a correta)</p>
          {newAnswers.map((a,i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
              <button onClick={()=>setCorrectIdx(i)} style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${correctIdx===i?'#059669':'var(--border)'}`, background:correctIdx===i?'#059669':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {correctIdx===i && <Check size={12} style={{ color:'#fff' }}/>}
              </button>
              <input value={a} onChange={e=>{ const n=[...newAnswers];n[i]=e.target.value;setNewAnswers(n) }}
                placeholder={`Alternativa ${String.fromCharCode(65+i)}`} style={INP}/>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button onClick={()=>setAdding(false)} style={{ height:40, padding:'0 16px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button onClick={addQuestion} disabled={saving||!newQ.trim()||newAnswers.some(a=>!a.trim())} style={{ flex:1, height:40, borderRadius:9, border:'none', background:newQ.trim()?'#6366f1':'var(--secondary)', color:newQ.trim()?'#fff':'var(--muted-foreground)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving?'Salvando...':'Salvar Pergunta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export function SimuladosAdmin({ simulados, attempts, insights }: { simulados:Simulado[]; attempts:Attempt[]; insights:Insight[] }) {
  const [activeTeam, setActiveTeam] = useState<TeamKey>('ambos')
  const [tab,        setTab]        = useState<TabId>('questions')

  // Filtrar simulados pelo time ativo
  const teamSimulados = simulados.filter(s => s.team === activeTeam)
  const sim1 = teamSimulados.find(s => s.numero === 1)
  const sim2 = teamSimulados.find(s => s.numero === 2)
  const [simTab, setSimTab] = useState<1|2>(1)

  // Analytics
  const analytics = useMemo(() => {
    const userMap: Record<string,{name:string;sim1?:Attempt;sim2?:Attempt}> = {}
    attempts.forEach(a => {
      if (!userMap[a.user_id]) userMap[a.user_id] = { name: a.profiles?.name ?? a.user_id }
      if (a.simulado_numero===1) userMap[a.user_id].sim1 = a
      if (a.simulado_numero===2) userMap[a.user_id].sim2 = a
    })
    const users   = Object.values(userMap)
    const pass1   = users.filter(u=>u.sim1?.passed).length
    const pass2   = users.filter(u=>!u.sim1?.passed&&u.sim2?.passed).length
    const nopass  = users.filter(u=>!u.sim1?.passed&&!u.sim2?.passed&&(u.sim1||u.sim2)).length
    const pieData = [
      { name:'Passou na 1ª', value:pass1,  color:'#34d399' },
      { name:'Passou na 2ª', value:pass2,  color:'#fbbf24' },
      { name:'Não passou',   value:nopass, color:'#f87171' },
    ].filter(d=>d.value>0)
    const notaChart = users.map(u=>({ name:(u.name??'').split(' ')[0], Simulado1:u.sim1?.score??null, Simulado2:u.sim2?.score??null })).filter(u=>u.Simulado1!==null||u.Simulado2!==null)
    return { users, pieData, notaChart, pass1, pass2, nopass }
  }, [attempts])

  const CARD: React.CSSProperties = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'20px 22px', boxShadow:'0 1px 8px rgba(0,0,0,.06)' }

  const TEAM_LABEL: Record<TeamKey,string> = { ambos:'🌐 Ambos os Times', R1:'🟣 Time R1', OAO:'🔵 Time OAO' }

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:1100, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4f46e5 100%)', borderRadius:20, padding:'clamp(18px,3vw,28px)', marginBottom:22, color:'#fff' }}>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', padding:'3px 12px', borderRadius:999, background:'rgba(255,255,255,.15)', display:'inline-block', marginBottom:10 }}>⚙️ Admin</span>
        <h1 style={{ fontSize:22, fontWeight:900, margin:'0 0 6px', letterSpacing:'-.02em' }}>Gestão dos Simulados Finais</h1>
        <p style={{ fontSize:13, color:'rgba(255,255,255,.65)', margin:0 }}>Configure perguntas por time, nota mínima e acompanhe o desempenho.</p>
      </div>

      {/* Tabs principais */}
      <div style={{ display:'flex', gap:4, marginBottom:20, padding:4, background:'var(--secondary)', borderRadius:12, border:'1px solid var(--border)', width:'fit-content' }}>
        {([['questions','📝 Perguntas'],['analytics','📊 Analytics'],['insights','💡 Insights']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ height:34, padding:'0 16px', borderRadius:9, border:'none', background:tab===id?'#6366f1':'transparent', color:tab===id?'#fff':'var(--muted-foreground)', fontSize:12, fontWeight:tab===id?800:500, cursor:'pointer', fontFamily:'inherit', transition:'all .2s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Perguntas ─────────────────────────────────────── */}
      {tab==='questions'&&(
        <>
          {/* Seletor de time */}
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {TEAMS.map(t=>(
              <button key={t} onClick={()=>setActiveTeam(t)}
                style={{ height:36, padding:'0 16px', borderRadius:10, border:`2px solid ${activeTeam===t?'#6366f1':'var(--border)'}`, background:activeTeam===t?'rgba(99,102,241,.1)':'transparent', color:activeTeam===t?'#6366f1':'var(--muted-foreground)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                {TEAM_LABEL[t]}
              </button>
            ))}
          </div>

          {/* Seletor Simulado 1 / 2 */}
          <div style={{ display:'flex', gap:4, marginBottom:20, padding:4, background:'var(--secondary)', borderRadius:10, border:'1px solid var(--border)', width:'fit-content' }}>
            {([1,2] as const).map(n=>(
              <button key={n} onClick={()=>setSimTab(n)} style={{ height:30, padding:'0 14px', borderRadius:8, border:'none', background:simTab===n?'var(--card)':'transparent', color:simTab===n?'var(--foreground)':'var(--muted-foreground)', fontSize:12, fontWeight:simTab===n?700:400, cursor:'pointer', fontFamily:'inherit', boxShadow:simTab===n?'0 1px 4px rgba(0,0,0,.1)':'none', transition:'all .15s' }}>
                Simulado {n}
              </button>
            ))}
          </div>

          {simTab===1 && sim1 && <QuestionEditor key={`${activeTeam}-1`} simulado={sim1} onRefresh={()=>{}}/>}
          {simTab===2 && sim2 && <QuestionEditor key={`${activeTeam}-2`} simulado={sim2} onRefresh={()=>{}}/>}
          {(!sim1 && simTab===1) || (!sim2 && simTab===2) ? (
            <p style={{ textAlign:'center', padding:40, color:'var(--muted-foreground)' }}>Simulado não encontrado para este time. Rode o SQL de fix.</p>
          ) : null}
        </>
      )}

      {/* ── Tab Analytics ─────────────────────────────────────── */}
      {tab==='analytics'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
            {[
              { label:'Realizaram',  val:new Set(attempts.map(a=>a.user_id)).size, color:'#818cf8' },
              { label:'Passou 1ª',   val:analytics.pass1,  color:'#34d399' },
              { label:'Passou 2ª',   val:analytics.pass2,  color:'#fbbf24' },
              { label:'Não passou',  val:analytics.nopass, color:'#f87171' },
            ].map(k=>(
              <div key={k.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:13, padding:'14px 16px', boxShadow:'0 1px 6px rgba(0,0,0,.05)' }}>
                <p style={{ fontSize:9, fontWeight:800, color:k.color, margin:'0 0 5px', textTransform:'uppercase', letterSpacing:'.08em' }}>{k.label}</p>
                <p style={{ fontSize:28, fontWeight:900, color:'var(--foreground)', margin:0 }}>{k.val}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
            <div style={CARD}>
              <h3 style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:'0 0 4px' }}>Notas por Pessoa</h3>
              <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'0 0 16px' }}>Simulado 1 vs 2</p>
              {analytics.notaChart.length>0?(
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.notaChart} margin={{top:15,right:20,bottom:0,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="name" tick={{fontSize:10,fill:'var(--muted-foreground)'}}/>
                    <YAxis domain={[0,100]} tick={{fontSize:10,fill:'var(--muted-foreground)'}}/>
                    <Tooltip contentStyle={TOOLTIP_STYLE}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="Simulado1" fill="#818cf8" radius={[4,4,0,0]} name="Simulado 1">
                      <LabelList dataKey="Simulado1" position="top" style={{fontSize:9,fill:'var(--muted-foreground)',fontWeight:700}} formatter={(v:any)=>v!==null?`${v}%`:''}/>
                    </Bar>
                    <Bar dataKey="Simulado2" fill="#60a5fa" radius={[4,4,0,0]} name="Simulado 2">
                      <LabelList dataKey="Simulado2" position="top" style={{fontSize:9,fill:'var(--muted-foreground)',fontWeight:700}} formatter={(v:any)=>v!==null?`${v}%`:''}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ):<p style={{textAlign:'center',padding:40,color:'var(--muted-foreground)'}}>Sem dados ainda.</p>}
            </div>
            <div style={CARD}>
              <h3 style={{fontSize:14,fontWeight:800,color:'var(--foreground)',margin:'0 0 4px'}}>Aprovações</h3>
              <p style={{fontSize:11,color:'var(--muted-foreground)',margin:'0 0 12px'}}>1ª vs 2ª tentativa</p>
              {analytics.pieData.length>0?(
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,percent})=>`${((percent as number)*100).toFixed(0)}%`} labelLine={false}>
                      {analytics.pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              ):<p style={{textAlign:'center',padding:40,color:'var(--muted-foreground)'}}>Sem dados.</p>}
            </div>
          </div>
          {/* Tabela */}
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,.06)'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
              <h3 style={{fontSize:13,fontWeight:800,color:'var(--foreground)',margin:0}}>Detalhamento por Pessoa</h3>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--secondary)'}}>
                  {['Pessoa','Sim 1 — Nota','Acertos (S1)','Erros (S1)','Resultado','Sim 2 — Nota','Acertos (S2)','Status Final'].map((h,i)=>(
                    <th key={i} style={{padding:'9px 14px',textAlign:'left',fontWeight:700,color:'var(--muted-foreground)',fontSize:10,textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {analytics.users.map((u,i)=>{
                    const passed=u.sim1?.passed||u.sim2?.passed
                    return(
                      <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'transparent':'var(--secondary)'}}>
                        <td style={{padding:'9px 14px',fontWeight:600,color:'var(--foreground)',whiteSpace:'nowrap'}}>{u.name}</td>
                        <td style={{padding:'9px 14px',fontWeight:700,color:u.sim1?.passed?'#059669':'#dc2626'}}>{u.sim1?`${u.sim1.score}%`:'—'}</td>
                        <td style={{padding:'9px 14px',color:'#059669',fontWeight:600}}>{u.sim1?.correct_answers??'—'}</td>
                        <td style={{padding:'9px 14px',color:'#dc2626',fontWeight:600}}>{u.sim1?.wrong_answers??'—'}</td>
                        <td style={{padding:'9px 14px'}}>{u.sim1?<span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:u.sim1.passed?'rgba(52,211,153,.15)':'rgba(239,68,68,.1)',color:u.sim1.passed?'#059669':'#dc2626',fontWeight:700}}>{u.sim1.passed?'✅ Passou':'❌ Reprovado'}</span>:'—'}</td>
                        <td style={{padding:'9px 14px',fontWeight:700,color:u.sim2?.passed?'#059669':'#dc2626'}}>{u.sim2?`${u.sim2.score}%`:'—'}</td>
                        <td style={{padding:'9px 14px',color:'#059669',fontWeight:600}}>{u.sim2?.correct_answers??'—'}</td>
                        <td style={{padding:'9px 14px'}}><span style={{fontSize:10,padding:'2px 8px',borderRadius:5,background:passed?'rgba(52,211,153,.15)':'rgba(239,68,68,.1)',color:passed?'#059669':'#dc2626',fontWeight:700}}>{passed?'✅ Aprovado':'⏳ Pendente'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {analytics.users.length===0&&<p style={{textAlign:'center',padding:40,color:'var(--muted-foreground)'}}>Nenhuma tentativa ainda.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Insights ──────────────────────────────────────── */}
      {tab==='insights'&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {[...new Set(insights.map(i=>i.day_number))].sort((a,b)=>(a??999)-(b??999)).map(day=>{
            const dayInsights=insights.filter(i=>i.day_number===day)
            return(
              <div key={day??'final'} style={CARD}>
                <h3 style={{fontSize:14,fontWeight:800,color:'var(--foreground)',margin:'0 0 4px'}}>{day?`📅 Dia ${day} da Trilha`:'🏁 Insight Final (pós-simulados)'}</h3>
                <p style={{fontSize:11,color:'var(--muted-foreground)',margin:'0 0 14px'}}>{dayInsights.length} insight{dayInsights.length!==1?'s':''}</p>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {dayInsights.map(ins=>(
                    <div key={ins.id} style={{background:'var(--secondary)',borderRadius:12,padding:'12px 16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,flexWrap:'wrap',gap:6}}>
                        <span style={{fontSize:12,fontWeight:700,color:'var(--foreground)'}}>{ins.profiles?.name??'Usuário'}</span>
                        <span style={{fontSize:10,color:'var(--muted-foreground)'}}>{new Date(ins.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p style={{fontSize:13,color:'var(--foreground)',margin:0,lineHeight:1.6}}>"{ins.content}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {insights.length===0&&<p style={{textAlign:'center',padding:48,color:'var(--muted-foreground)'}}>Nenhum insight registrado ainda.</p>}
        </div>
      )}
    </div>
  )
}
