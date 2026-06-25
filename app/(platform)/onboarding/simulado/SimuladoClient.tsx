'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, ChevronRight, ChevronLeft, Trophy, AlertCircle, BookOpen, Send } from 'lucide-react'

interface Answer  { id:string; answer:string; is_correct:boolean; order_index:number }
interface Question{ id:string; question:string; order_index:number; simulado_answers:Answer[] }
interface Simulado{ id:string; numero:number; titulo:string; descricao:string|null; nota_minima:number; simulado_questions:Question[] }
interface Attempt { id:string; simulado_numero:number; score:number; correct_answers:number; wrong_answers:number; total_questions:number; passed:boolean }

interface Props {
  simuladoNumero: number   // 1 = fazer sim1, 2 = fazer sim2, 0 = já terminou
  simulados:      Simulado[]
  attempt1:       Attempt | null
  attempt2:       Attempt | null
  userName:       string
  hasFinalInsight:boolean
  isAdmin:        boolean
}

export function SimuladoClient({ simuladoNumero, simulados, attempt1, attempt2, userName, hasFinalInsight, isAdmin }: Props) {
  const router = useRouter()
  const [phase,      setPhase]    = useState<'intro'|'test'|'result'|'insight'|'done'>('intro')
  // Estado local para attempt2 (props podem estar desatualizados após submit)
  const [localAttempt2, setLocalAttempt2] = useState<Attempt|null>(attempt2 ?? null)
  // Controla se o insight já foi salvo nesta sessão
  const [insightDone,   setInsightDone]   = useState(hasFinalInsight)
  const [current,    setCurrent]  = useState(0)
  const [answers,    setAnswers]  = useState<Record<string,string>>({})
  const [result,     setResult]   = useState<{score:number;correct:number;wrong:number;total:number;passed:boolean}|null>(null)
  const [insight,    setInsight]  = useState('')
  const [submitting, setSubmitting]= useState(false)
  const [saving,     setSaving]  = useState(false)

  const simulado = useMemo(() =>
    simulados.find(s => s.numero === simuladoNumero), [simulados, simuladoNumero])
  const questions = useMemo(() =>
    (simulado?.simulado_questions ?? []).slice().sort((a,b)=>a.order_index-b.order_index), [simulado])
  const q = questions[current]
  const progress = questions.length > 0 ? ((current) / questions.length) * 100 : 0
  const answered = Object.keys(answers).length

  async function submitSimulado() {
    if (!simulado) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/simulado/attempt', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ simulado_id: simulado.id, simulado_numero: simulado.numero, answers_log: answers }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      const newResult = { score:data.score, correct:data.correct, wrong:data.wrong, total:data.total, passed:data.passed }
      setResult(newResult)
      // Se era simulado 2, salvar localmente para o result final não depender de refresh
      if (simulado?.numero === 2) {
        setLocalAttempt2({
          id: data.attempt_id ?? 'local',
          simulado_numero: 2,
          score: data.score,
          correct_answers: data.correct,
          wrong_answers: data.wrong,
          total_questions: data.total,
          passed: data.passed,
        })
      }
      setPhase('result')
    } finally { setSubmitting(false) }
  }

  async function saveInsight() {
    if (!insight.trim()) return
    setSaving(true)
    try {
      await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ insight_type:'final', content: insight }),
      })
      setInsightDone(true)   // esconde o form de insight imediatamente
      setPhase('done')
    } finally { setSaving(false) }
  }

  function selectAnswer(qId: string, aId: string) {
    setAnswers(prev => ({ ...prev, [qId]: aId }))
    // Avança automaticamente após 400ms
    setTimeout(() => {
      if (current < questions.length - 1) setCurrent(c => c+1)
    }, 380)
  }

  // ── Já terminou tudo ──────────────────────────────────────────
  if (simuladoNumero === 0 || phase === 'done') {
    const finalAttempt = localAttempt2 ?? attempt2 ?? attempt1
    const passed = attempt1?.passed || attempt2?.passed
    return (
      <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:640, margin:'0 auto' }}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:40, textAlign:'center', boxShadow:'0 4px 20px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:64, marginBottom:12 }}>{passed ? '🏆' : '📋'}</div>
          <h2 style={{ fontSize:22, fontWeight:900, color:'var(--foreground)', margin:'0 0 8px' }}>
            {passed ? 'Parabéns! Você foi aprovado!' : 'Simulado Concluído'}
          </h2>
          <p style={{ fontSize:14, color:'var(--muted-foreground)', margin:'0 0 28px' }}>
            {passed
              ? `Você completou toda a trilha de onboarding com sucesso, ${userName.split(' ')[0]}!`
              : 'Você realizou os dois simulados. Fale com seu gestor sobre os próximos passos.'}
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
            {attempt1 && <ResultCard label="Simulado 1" attempt={attempt1}/>}
            {(localAttempt2 ?? attempt2) && <ResultCard label="Simulado 2" attempt={(localAttempt2 ?? attempt2)!}/>}
          </div>
          {!insightDone && !isAdmin && (
            <div style={{ background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.2)', borderRadius:14, padding:20, textAlign:'left', marginBottom:20 }}>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', margin:'0 0 10px' }}>💡 Qual seu insight geral sobre o treinamento?</p>
              <textarea value={insight} onChange={e=>setInsight(e.target.value)} placeholder="Escreva aqui seu aprendizado mais importante de todo o onboarding..."
                style={{ width:'100%', minHeight:80, padding:12, borderRadius:10, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:13, resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
              <button onClick={saveInsight} disabled={!insight.trim()||saving}
                style={{ marginTop:10, height:38, padding:'0 20px', borderRadius:9, border:'none', background:insight.trim()?'#6366f1':'var(--secondary)', color:insight.trim()?'#fff':'var(--muted-foreground)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                {saving ? 'Salvando...' : 'Salvar Insight'}
              </button>
            </div>
          )}
          <button onClick={()=>router.push('/onboarding/trilha')}
            style={{ height:42, padding:'0 28px', borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'var(--foreground)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Voltar para a Trilha
          </button>
        </div>
      </div>
    )
  }

  // ── Intro ─────────────────────────────────────────────────────
  if (phase === 'intro') {
    if (!simulado) return <div style={{ padding:40, textAlign:'center', color:'var(--muted-foreground)' }}>Simulado não configurado. Fale com o administrador.</div>
    return (
      <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:580, margin:'0 auto' }}>
        <div style={{ background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4f46e5 100%)', borderRadius:20, padding:'clamp(24px,4vw,40px)', textAlign:'center', color:'#fff', marginBottom:20 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>{simuladoNumero === 2 ? '🔄' : '📝'}</div>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', padding:'3px 12px', borderRadius:999, background:'rgba(255,255,255,.15)', marginBottom:12, display:'inline-block' }}>
            {simuladoNumero === 2 ? '2ª Tentativa' : '1ª Tentativa'}
          </span>
          <h1 style={{ fontSize:'clamp(20px,3vw,26px)', fontWeight:900, margin:'10px 0 8px', letterSpacing:'-.02em' }}>{simulado.titulo}</h1>
          {simulado.descricao && <p style={{ fontSize:13, color:'rgba(255,255,255,.7)', margin:'0 0 20px' }}>{simulado.descricao}</p>}
          <div style={{ display:'flex', justifyContent:'center', gap:20, flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:28, fontWeight:900, margin:0 }}>{questions.length}</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,.6)', margin:0 }}>perguntas</p>
            </div>
            <div style={{ width:1, background:'rgba(255,255,255,.15)' }}/>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:28, fontWeight:900, margin:0 }}>{simulado.nota_minima}%</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,.6)', margin:0 }}>nota mínima</p>
            </div>
            <div style={{ width:1, background:'rgba(255,255,255,.15)' }}/>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:28, fontWeight:900, margin:0 }}>1x</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,.6)', margin:0 }}>sem refazer</p>
            </div>
          </div>
        </div>
        {simuladoNumero === 2 && attempt1 && (
          <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:14, padding:'14px 18px', marginBottom:16, display:'flex', gap:12, alignItems:'center' }}>
            <AlertCircle size={18} style={{ color:'#ef4444', flexShrink:0 }}/>
            <p style={{ fontSize:13, color:'var(--foreground)', margin:0 }}>
              Você obteve <strong>{attempt1.score}%</strong> no 1º simulado (mínimo: {simulado.nota_minima}%). Esta é sua última tentativa.
            </p>
          </div>
        )}
        {questions.length === 0 ? (
          <p style={{ textAlign:'center', color:'var(--muted-foreground)', padding:20 }}>Este simulado ainda não tem perguntas cadastradas.</p>
        ) : (
          <button onClick={()=>setPhase('test')}
            style={{ width:'100%', height:52, borderRadius:14, border:'none', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            Iniciar Simulado <ChevronRight size={18}/>
          </button>
        )}
      </div>
    )
  }

  // ── Test ──────────────────────────────────────────────────────
  if (phase === 'test' && q) {
    const shuffled = [...(q.simulado_answers ?? [])].sort((a,b)=>a.order_index-b.order_index)
    const chosen   = answers[q.id]
    return (
      <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:640, margin:'0 auto' }}>
        {/* Progresso */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:12, color:'var(--muted-foreground)', fontWeight:600 }}>Pergunta {current+1} de {questions.length}</span>
            <span style={{ fontSize:12, color:'#6366f1', fontWeight:700 }}>{answered} respondidas</span>
          </div>
          <div style={{ height:6, borderRadius:999, background:'var(--secondary)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${((current+1)/questions.length)*100}%`, background:'linear-gradient(90deg,#6366f1,#7c3aed)', borderRadius:999, transition:'width .3s' }}/>
          </div>
        </div>

        {/* Card da pergunta */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 24px', marginBottom:16, boxShadow:'0 2px 16px rgba(0,0,0,.07)' }}>
          <p style={{ fontSize:16, fontWeight:700, color:'var(--foreground)', margin:'0 0 24px', lineHeight:1.6 }}>{q.question}</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {shuffled.map(a => {
              const sel = chosen === a.id
              return (
                <button key={a.id} onClick={()=>selectAnswer(q.id, a.id)}
                  style={{ width:'100%', textAlign:'left', padding:'14px 18px', borderRadius:12, border:`2px solid ${sel?'#6366f1':'var(--border)'}`, background:sel?'rgba(99,102,241,.1)':'transparent', color:'var(--foreground)', fontSize:14, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', fontWeight:sel?700:400 }}>
                  {a.answer}
                </button>
              )
            })}
          </div>
        </div>

        {/* Navegação */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>setCurrent(c=>Math.max(0,c-1))} disabled={current===0}
            style={{ height:44, padding:'0 18px', borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'var(--foreground)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, opacity:current===0?.4:1 }}>
            <ChevronLeft size={16}/> Anterior
          </button>
          {current < questions.length - 1 ? (
            <button onClick={()=>setCurrent(c=>c+1)}
              style={{ flex:1, height:44, borderRadius:11, border:'none', background:'#6366f1', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              Próxima <ChevronRight size={16}/>
            </button>
          ) : (
            <button onClick={submitSimulado} disabled={submitting || answered < questions.length}
              style={{ flex:1, height:44, borderRadius:11, border:'none', background: answered===questions.length?'linear-gradient(135deg,#4f46e5,#7c3aed)':'var(--secondary)', color: answered===questions.length?'#fff':'var(--muted-foreground)', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
              {submitting ? 'Enviando...' : `Finalizar (${answered}/${questions.length})`}
            </button>
          )}
        </div>

        {/* Mapa de progresso */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:16, justifyContent:'center' }}>
          {questions.map((q2,i) => (
            <button key={q2.id} onClick={()=>setCurrent(i)}
              style={{ width:32, height:32, borderRadius:8, border:`2px solid ${i===current?'#6366f1':'var(--border)'}`, background:answers[q2.id]?'rgba(99,102,241,.15)':i===current?'var(--card)':'transparent', color:i===current?'#6366f1':'var(--muted-foreground)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {i+1}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Result ────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const pct = result.score
    const nota_min = simulado?.nota_minima ?? 70
    const isLastChance = simuladoNumero === 2
    return (
      <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:580, margin:'0 auto' }}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,.1)' }}>
          {/* Header resultado */}
          <div style={{ background: result.passed ? 'linear-gradient(135deg,#065f46,#059669)' : 'linear-gradient(135deg,#7f1d1d,#dc2626)', padding:'32px 28px', textAlign:'center', color:'#fff' }}>
            <div style={{ fontSize:52, marginBottom:8 }}>{result.passed ? '🎉' : (isLastChance ? '😔' : '💪')}</div>
            <h2 style={{ fontSize:24, fontWeight:900, margin:'0 0 4px' }}>{result.passed ? 'Aprovado!' : (isLastChance ? 'Não aprovado' : 'Vamos tentar novamente')}</h2>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.75)', margin:0 }}>
              {result.passed ? 'Você atingiu a nota mínima!' : `Nota mínima: ${nota_min}%`}
            </p>
          </div>

          <div style={{ padding:'28px 24px' }}>
            {/* Score circular */}
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:120, height:120, borderRadius:'50%', border:`6px solid ${result.passed?'#059669':'#dc2626'}`, marginBottom:8 }}>
                <span style={{ fontSize:32, fontWeight:900, color: result.passed?'#059669':'#dc2626', lineHeight:1 }}>{pct}%</span>
                <span style={{ fontSize:10, color:'var(--muted-foreground)', fontWeight:600 }}>nota</span>
              </div>
            </div>

            {/* Acertos / erros */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:24 }}>
              {[
                { label:'Acertos', val:result.correct, color:'#059669', icon:'✅' },
                { label:'Erros',   val:result.wrong,   color:'#dc2626', icon:'❌' },
                { label:'Total',   val:result.total,   color:'#6366f1', icon:'📝' },
              ].map(x => (
                <div key={x.label} style={{ background:'var(--secondary)', borderRadius:12, padding:'14px 10px', textAlign:'center' }}>
                  <p style={{ fontSize:20, margin:'0 0 2px' }}>{x.icon}</p>
                  <p style={{ fontSize:22, fontWeight:900, color:x.color, margin:'0 0 2px' }}>{x.val}</p>
                  <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{x.label}</p>
                </div>
              ))}
            </div>

            {/* Mensagem e CTA */}
            {result.passed || isLastChance ? (
              <button onClick={()=>setPhase(hasFinalInsight?'done':'insight')} style={{ width:'100%', height:48, borderRadius:13, border:'none', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
                {result.passed ? '🏆 Ver meu resultado completo' : 'Finalizar →'}
              </button>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <p style={{ fontSize:13, color:'var(--muted-foreground)', textAlign:'center', margin:0 }}>
                  Você tem mais uma tentativa. Revise o material e tente o Simulado 2.
                </p>
                <button onClick={()=>router.refresh()} style={{ width:'100%', height:48, borderRadius:13, border:'none', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
                  Ir para o Simulado 2 →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Insight final ─────────────────────────────────────────────
  if (phase === 'insight') {
    return (
      <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:560, margin:'0 auto' }}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:'32px 28px', boxShadow:'0 4px 20px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:48, textAlign:'center', marginBottom:12 }}>💡</div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'var(--foreground)', textAlign:'center', margin:'0 0 6px' }}>Insight Final</h2>
          <p style={{ fontSize:13, color:'var(--muted-foreground)', textAlign:'center', margin:'0 0 24px', lineHeight:1.6 }}>
            Você concluiu toda a trilha e os simulados! Qual foi o aprendizado mais importante de todo esse processo?
          </p>
          <textarea value={insight} onChange={e=>setInsight(e.target.value)}
            placeholder="Escreva aqui seu principal aprendizado, reflexão ou insight sobre o treinamento completo..."
            style={{ width:'100%', minHeight:120, padding:14, borderRadius:12, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:14, resize:'vertical', outline:'none', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}
            onFocus={e=>{e.target.style.borderColor='#6366f1';e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.12)'}}
            onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}}/>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button onClick={()=>setPhase('done')} style={{ flex:1, height:44, borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Pular
            </button>
            <button onClick={saveInsight} disabled={!insight.trim()||saving}
              style={{ flex:2, height:44, borderRadius:11, border:'none', background:insight.trim()?'linear-gradient(135deg,#4f46e5,#7c3aed)':'var(--secondary)', color:insight.trim()?'#fff':'var(--muted-foreground)', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .15s' }}>
              <Send size={14}/> {saving ? 'Salvando...' : 'Salvar e Finalizar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function ResultCard({ label, attempt }: { label:string; attempt:Attempt }) {
  return (
    <div style={{ background:'var(--secondary)', borderRadius:12, padding:'14px 16px', textAlign:'left' }}>
      <p style={{ fontSize:10, fontWeight:800, color:'var(--muted-foreground)', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</p>
      <p style={{ fontSize:22, fontWeight:900, color: attempt.passed?'#059669':'#dc2626', margin:'0 0 2px' }}>{attempt.score}%</p>
      <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{attempt.correct_answers}/{attempt.total_questions} acertos · {attempt.passed?'✅ Aprovado':'❌ Reprovado'}</p>
    </div>
  )
}
