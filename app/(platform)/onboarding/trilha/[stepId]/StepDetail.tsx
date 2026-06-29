'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, HelpCircle, CheckSquare, ChevronDown, ChevronUp,
  Trophy, X, Pencil, Trash2, CheckCircle2, ExternalLink, Play,
} from 'lucide-react'
import { MaterialsManager, FaqManager, QuizManager } from './MaterialsManager'
import {
  submitQuiz, startStep, markMaterialViewed,
  deleteMaterial, deleteFaq, deleteQuestion,
  updateFaq, updateQuestion,
} from '../../actions'

// ── Embed URL helper ────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1).split('?')[0]
        : (u.searchParams.get('v') ?? u.pathname.split('/shorts/')[1]?.split('?')[0] ?? '')
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null
    }
    // Loom
    if (u.hostname.includes('loom.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.loom.com/embed/${id}` : null
    }
    // Google Drive
    if (u.hostname.includes('drive.google.com')) {
      const id = u.pathname.match(/\/d\/([^/]+)/)?.[1]
      return id ? `https://drive.google.com/file/d/${id}/preview` : null
    }
    // Panda Video
    if (u.hostname.includes('pandavideo.com') || u.hostname.includes('player.pandavideo')) {
      return url.includes('embed') ? url : null
    }
    // PDF direto
    if (u.pathname.toLowerCase().endsWith('.pdf')) return url
    // MP4/vídeo direto — player nativo
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return 'native:' + url
    return null
  } catch { return null }
}

// Detectar thumbnail de vídeo automaticamente pela URL
function getAutoThumbnail(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1).split('?')[0]
        : (u.searchParams.get('v') ?? '')
      return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
    }
    return null
  } catch { return null }
}

// ── Modal de visualização de material ──────────────────────
function MaterialViewer({ material, viewed, onClose, onViewed }: {
  material: any; viewed: boolean; onClose: () => void; onViewed: () => void
}) {
  const embedUrl = getEmbedUrl(material.url)
  const [marking, setMarking] = useState(false)
  const [done, setDone] = useState(viewed)

  async function handleViewed() {
    setMarking(true)
    await markMaterialViewed(material.id)
    setDone(true)
    setMarking(false)
    onViewed()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:900, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:'rgba(59,130,246,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <FileText size={15} style={{ color:'#3b82f6' }}/>
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ margin:0, fontSize:14, fontWeight:700, color:'var(--foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{material.title}</p>
              {material.description && <p style={{ margin:0, fontSize:11, color:'var(--muted-foreground)' }}>{material.description}</p>}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <a href={material.url} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:5, height:32, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:12, fontWeight:600, textDecoration:'none' }}>
              <ExternalLink size={12}/> Abrir fora
            </a>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflow:'hidden', position:'relative', minHeight:300 }}>
          {embedUrl?.startsWith('native:') ? (
            <video src={embedUrl.slice(7)} controls autoPlay style={{ width:'100%', height:'100%', background:'#000' }}/>
          ) : embedUrl ? (
            <iframe src={embedUrl} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
              allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, gap:16, padding:24 }}>
              <ExternalLink size={40} style={{ color:'var(--muted-foreground)', opacity:.4 }}/>
              <p style={{ fontSize:14, color:'var(--muted-foreground)', textAlign:'center' }}>Este material não pode ser exibido aqui.</p>
              <a href={material.url} target="_blank" rel="noopener noreferrer"
                style={{ height:40, padding:'0 20px', borderRadius:10, background:'var(--foreground)', color:'var(--card)', fontSize:14, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
                <ExternalLink size={14}/> Abrir material
              </a>
            </div>
          )}
        </div>

        {/* Footer com botão Concluído */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:12, color:'var(--muted-foreground)' }}>
            {done ? '✅ Você concluiu este material' : 'Marque como concluído após visualizar'}
          </span>
          <button onClick={done ? undefined : handleViewed} disabled={done || marking}
            style={{ height:38, padding:'0 20px', borderRadius:10, background:done?'rgba(34,197,94,.1)':'var(--foreground)', color:done?'#22c55e':'var(--card)', fontSize:13, fontWeight:700, border:done?'1.5px solid rgba(34,197,94,.3)':'none', cursor:done?'default':'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:7 }}>
            <CheckCircle2 size={15}/> {marking?'Salvando...':done?'Concluído':'Marcar como concluído'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirmação de exclusão inline ─────────────────────────
function DeleteBtn({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:11, color:'#ef4444', fontWeight:600 }}>Excluir?</span>
      <button onClick={onConfirm} style={{ height:26, padding:'0 10px', borderRadius:6, background:'#ef4444', color:'#fff', fontSize:11, fontWeight:700, border:'none', cursor:'pointer' }}>
        {loading ? '...' : 'Sim'}
      </button>
      <button onClick={() => setConfirm(false)} style={{ height:26, padding:'0 10px', borderRadius:6, background:'transparent', border:'1px solid var(--border)', fontSize:11, fontWeight:600, cursor:'pointer', color:'var(--muted-foreground)' }}>
        Não
      </button>
    </div>
  )
  return (
    <button onClick={() => setConfirm(true)}
      style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)', transition:'all .15s' }}
      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,.1)'; (e.currentTarget as HTMLElement).style.color='#ef4444' }}
      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
      <Trash2 size={13}/>
    </button>
  )
}

// ── Modal de edição de FAQ ─────────────────────────────────
function EditFaqModal({ faq, stepId, onClose }: { faq: any; stepId: string; onClose: () => void }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [loading, setLoading] = useState(false)
  const inp: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none' }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.append('id', faq.id); fd.append('step_id', stepId)
      await updateFaq(fd); onClose()
      startTrans(() => router.refresh())
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:520 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--foreground)' }}>Editar FAQ</h2>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6 }}>Pergunta *</label><input name="question" required defaultValue={faq.question} style={inp}/></div>
          <div><label style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6 }}>Resposta *</label><textarea name="answer" required rows={5} defaultValue={faq.answer} style={{ ...inp, height:'auto', resize:'vertical', lineHeight:1.6 }}/></div>
          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="button" onClick={onClose} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex:1, height:42, borderRadius:10, background:'var(--foreground)', color:'var(--card)', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit', opacity:loading?.6:1 }}>
              {loading?'Salvando...':'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de edição de questão ─────────────────────────────
function EditQuizModal({ question, stepId, onClose }: { question: any; stepId: string; onClose: () => void }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<{text:string;is_correct:boolean}[]>(
    question.onboarding_answers?.map((a: any) => ({ text: a.answer_text, is_correct: a.is_correct })) ?? []
  )
  const inp: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none' }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!answers.some(a => a.is_correct && a.text.trim())) {
      alert('Marque pelo menos uma alternativa correta com texto.'); return
    }
    setLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.append('id', question.id); fd.append('step_id', stepId)
      fd.append('answers', JSON.stringify(answers))
      await updateQuestion(fd); onClose()
      startTrans(() => router.refresh())
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:560, maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--foreground)' }}>Editar questão</h2>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6 }}>Pergunta *</label>
            <textarea name="question" required rows={3} defaultValue={question.question} style={{ ...inp, height:'auto', resize:'vertical' }}/>
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6 }}>Alternativas *</label>
            <p style={{ fontSize:11, color:'var(--muted-foreground)', marginBottom:10 }}>Clique no círculo para marcar a correta.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {answers.map((a, i) => (
                <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button type="button" onClick={() => setAnswers(answers.map((ans,idx) => ({ ...ans, is_correct: idx===i })))}
                    style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${a.is_correct?'#10b981':'var(--border)'}`, background:a.is_correct?'#10b981':'transparent', cursor:'pointer', flexShrink:0, transition:'all .15s' }}/>
                  <input value={a.text} onChange={e => setAnswers(answers.map((ans,idx) => idx===i?{...ans,text:e.target.value}:ans))}
                    placeholder={`Alternativa ${String.fromCharCode(65+i)}`} style={{ ...inp, flex:1 }}/>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6 }}>Explicação</label>
            <textarea name="explanation" rows={3} defaultValue={question.explanation ?? ''} placeholder="Opcional..." style={{ ...inp, height:'auto', resize:'vertical' }}/>
          </div>
          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="button" onClick={onClose} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex:1, height:42, borderRadius:10, background:'var(--foreground)', color:'var(--card)', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit', opacity:loading?.6:1 }}>
              {loading?'Salvando...':'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── StepDetail principal ───────────────────────────────────
export function StepDetail({ step, materials, faqs, questions, isAdmin, stepId, userProgress, viewedMaterialIds = [] }: any) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const s = step
  const [activeTab,       setActiveTab]       = useState<'materiais'|'faqs'|'quiz'>('materiais')
  const [expandedFaq,     setExpandedFaq]     = useState<string|null>(null)
  const [openMaterial,    setOpenMaterial]     = useState<any|null>(null)
  const [viewedIds,       setViewedIds]       = useState<Set<string>>(new Set(viewedMaterialIds))
  const [editFaq,         setEditFaq]         = useState<any|null>(null)
  const [editQuestion,    setEditQuestion]    = useState<any|null>(null)
  const [deletingId,      setDeletingId]      = useState<string|null>(null)

  // Quiz state
  const [quizStarted,     setQuizStarted]     = useState(false)
  const [currentQ,        setCurrentQ]        = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string,string>>({})
  const [quizFinished,    setQuizFinished]    = useState(false)
  const [quizScore,       setQuizScore]       = useState(0)
  const [submitting,      setSubmitting]      = useState(false)
  const [showExpl,        setShowExpl]        = useState(false)

  const teamColor = s.team==='OAO'?'#3b82f6':s.team==='R1'?'#8b5cf6':'#22c55e'

  async function handleDelete(type: 'material'|'faq'|'question', id: string) {
    setDeletingId(id)
    try {
      if (type==='material')  await deleteMaterial(id, stepId)
      if (type==='faq')       await deleteFaq(id, stepId)
      if (type==='question')  await deleteQuestion(id, stepId)
      startTrans(() => router.refresh())
    } finally { setDeletingId(null) }
  }

  function selectAnswer(qId: string, aId: string) {
    setSelectedAnswers(p => ({...p,[qId]:aId})); setShowExpl(true)
  }

  function nextQuestion() {
    setShowExpl(false)
    if (currentQ < questions.length-1) setCurrentQ(q=>q+1)
    else finishQuiz()
  }

  async function finishQuiz() {
    setSubmitting(true)
    const correct = questions.filter((q: any) => {
      const sel = selectedAnswers[q.id]
      return q.onboarding_answers?.find((a: any) => a.id===sel)?.is_correct
    }).length
    const score = Math.round((correct/questions.length)*100)
    const passed = score >= s.min_quiz_score
    setQuizScore(score); setQuizFinished(true)
    await submitQuiz(stepId, selectedAnswers, score, passed)
    setSubmitting(false)
    startTrans(() => router.refresh())
  }

  const curQ = questions[currentQ]
  const selA = curQ ? selectedAnswers[curQ.id] : null
  const isCorr = selA && curQ?.onboarding_answers?.find((a: any)=>a.id===selA)?.is_correct

  const tabs = [
    { id:'materiais', label:'Materiais',  icon:FileText,    count:materials.length },
    { id:'faqs',      label:'FAQs',       icon:HelpCircle,  count:faqs.length },
    { id:'quiz',      label:'Quiz',       icon:CheckSquare, count:questions.length },
  ]

  const adminBtn: React.CSSProperties = { width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)', transition:'all .15s' }

  return (
    <div>
      {/* Viewer modal */}
      {openMaterial && (
        <MaterialViewer
          material={openMaterial}
          viewed={viewedIds.has(openMaterial.id)}
          onClose={() => setOpenMaterial(null)}
          onViewed={() => setViewedIds(s => new Set([...s, openMaterial.id]))}
        />
      )}

      {/* Edit FAQ modal */}
      {editFaq && <EditFaqModal faq={editFaq} stepId={stepId} onClose={() => setEditFaq(null)}/>}
      {/* Edit Quiz modal */}
      {editQuestion && <EditQuizModal question={editQuestion} stepId={stepId} onClose={() => setEditQuestion(null)}/>}

      {/* Header */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px 24px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <h1 style={{ fontSize:20, fontWeight:700, color:'var(--foreground)', margin:0 }}>{s.title}</h1>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, background:`${teamColor}15`, color:teamColor }}>{s.team}</span>
            </div>
            {s.description && <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:'0 0 12px' }}>{s.description}</p>}
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              {s.estimated_minutes && <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>⏱ {s.estimated_minutes} min</span>}
              <span style={{ fontSize:11, color:'var(--muted-foreground)' }}>🎯 Nota mínima: {s.min_quiz_score}%</span>
            </div>
          </div>
          {!isAdmin && !userProgress && (
            <button onClick={() => startStep(stepId).then(() => startTrans(() => router.refresh()))}
              style={{ height:36, padding:'0 16px', borderRadius:10, background:'var(--foreground)', color:'var(--card)', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              Iniciar etapa
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:4 }}>
        {tabs.map(tab => {
          const Icon = tab.icon; const active = activeTab===tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, height:36, borderRadius:9, border:'none', background:active?'var(--background)':'transparent', color:active?'var(--foreground)':'var(--muted-foreground)', fontSize:13, fontWeight:active?600:500, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', boxShadow:active?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
              <Icon size={14}/>
              {tab.label}
              {tab.count>0&&<span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:999, background:active?'var(--foreground)':'var(--secondary)', color:active?'var(--card)':'var(--muted-foreground)' }}>{tab.count}</span>}
            </button>
          )
        })}
      </div>

      {/* ABA: Materiais */}
      {activeTab==='materiais' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {isAdmin && <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}><MaterialsManager stepId={stepId}/></div>}
          {materials.map((m: any) => {
            const isDone = viewedIds.has(m.id)
            return (
              <div key={m.id} style={{ background:'var(--card)', border:`1px solid ${isDone?'rgba(34,197,94,.3)':'var(--border)'}`, borderRadius:12, overflow:'hidden', transition:'all .15s' }}>
                {(m.thumbnail_url || (m.type==='video' && getAutoThumbnail(m.url))) && (
                  <div style={{ height:110, position:'relative', overflow:'hidden', cursor:'pointer' }} onClick={() => setOpenMaterial(m)}>
                    <img src={m.thumbnail_url || getAutoThumbnail(m.url) || ''} alt={m.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(255,255,255,.9)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Play size={18} style={{ color:'#000', marginLeft:2 }}/>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:isDone?'rgba(34,197,94,.1)':m.type==='video'?'rgba(239,68,68,.1)':'rgba(59,130,246,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {isDone
                      ? <CheckCircle2 size={16} style={{ color:'#22c55e' }}/>
                      : m.type==='video'
                        ? <Play size={16} style={{ color:'#ef4444', marginLeft:1 }}/>
                        : <FileText size={16} style={{ color:'#3b82f6' }}/>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:'var(--foreground)', margin:'0 0 2px' }}>{m.title}</p>
                    {m.description && <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>{m.description}</p>}
                    {isDone && <p style={{ fontSize:11, color:'#22c55e', margin:'2px 0 0', fontWeight:600 }}>✓ Concluído</p>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'var(--secondary)', color:'var(--muted-foreground)' }}>{m.type}</span>
                    <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setOpenMaterial(m)}
                      style={{ height:34, padding:'0 14px', borderRadius:9, background:isAdmin?'transparent':'var(--foreground)', color:isAdmin?'var(--muted-foreground)':'var(--card)', fontSize:12, fontWeight:700, border:isAdmin?'1px solid var(--border)':'none', cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6, transition:'all .15s' }}
                      onMouseEnter={e=>{ if(isAdmin){ (e.currentTarget as HTMLElement).style.background='var(--secondary)'; (e.currentTarget as HTMLElement).style.color='var(--foreground)' }}}
                      onMouseLeave={e=>{ if(isAdmin){ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}}>
                      <Play size={12}/> {isAdmin?'Preview':'Abrir'}
                    </button>
                    {isAdmin && <DeleteBtn onConfirm={() => handleDelete('material', m.id)} loading={deletingId===m.id}/>}
                  </div>
                  </div>
                </div>
              </div>
            )
          })}
          {materials.length===0 && <p style={{ fontSize:13, color:'var(--muted-foreground)', padding:'24px', textAlign:'center' }}>Nenhum material adicionado.</p>}
        </div>
      )}

      {/* ABA: FAQs */}
      {activeTab==='faqs' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {isAdmin && <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}><FaqManager stepId={stepId}/></div>}
          {faqs.map((f: any) => (
            <div key={f.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:isAdmin?'10px 14px':'0' }}>
                <button onClick={() => setExpandedFaq(expandedFaq===f.id?null:f.id)}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between', padding:isAdmin?'4px 4px':'14px 18px', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left', gap:12 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--foreground)' }}>{f.question}</span>
                  {expandedFaq===f.id?<ChevronUp size={16} style={{ color:'var(--muted-foreground)', flexShrink:0 }}/>:<ChevronDown size={16} style={{ color:'var(--muted-foreground)', flexShrink:0 }}/>}
                </button>
                {isAdmin && (
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button onClick={() => setEditFaq(f)} style={{ ...adminBtn }}
                      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.1)'; (e.currentTarget as HTMLElement).style.color='#6366f1' }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
                      <Pencil size={13}/>
                    </button>
                    <DeleteBtn onConfirm={() => handleDelete('faq', f.id)} loading={deletingId===f.id}/>
                  </div>
                )}
              </div>
              {expandedFaq===f.id && (
                <div style={{ padding:'14px 18px 16px', fontSize:14, color:'var(--muted-foreground)', lineHeight:1.65, borderTop:'1px solid var(--border)' }}>
                  {f.answer}
                </div>
              )}
            </div>
          ))}
          {faqs.length===0 && <p style={{ fontSize:13, color:'var(--muted-foreground)', padding:'24px', textAlign:'center' }}>Nenhuma FAQ adicionada.</p>}
        </div>
      )}

      {/* ABA: Quiz */}
      {activeTab==='quiz' && (
        <div>
          {isAdmin && <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}><QuizManager stepId={stepId}/></div>}

          {questions.length===0 ? (
            <p style={{ fontSize:13, color:'var(--muted-foreground)', padding:'24px', textAlign:'center' }}>Nenhuma questão adicionada.</p>

          ) : isAdmin ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {questions.map((q: any, qi: number) => (
                <div key={q.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:10 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:'var(--foreground)', margin:0 }}>{qi+1}. {q.question}</p>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={() => setEditQuestion(q)} style={{ ...adminBtn }}
                        onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.1)'; (e.currentTarget as HTMLElement).style.color='#6366f1' }}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
                        <Pencil size={13}/>
                      </button>
                      <DeleteBtn onConfirm={() => handleDelete('question', q.id)} loading={deletingId===q.id}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {q.onboarding_answers?.map((a: any) => (
                      <div key={a.id} style={{ padding:'8px 12px', borderRadius:8, fontSize:13, background:a.is_correct?'rgba(34,197,94,.1)':'var(--secondary)', color:a.is_correct?'#22c55e':'var(--muted-foreground)', border:`1px solid ${a.is_correct?'rgba(34,197,94,.3)':'var(--border)'}` }}>
                        {a.is_correct?'✓ ':''}{a.answer_text}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:'10px 0 0', padding:'8px 12px', background:'var(--secondary)', borderRadius:8 }}>💡 {q.explanation}</p>}
                </div>
              ))}
            </div>

          ) : !quizStarted ? (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'40px 32px', textAlign:'center' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(139,92,246,.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                <Trophy size={32} style={{ color:'#8b5cf6' }}/>
              </div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--foreground)', marginBottom:8 }}>Quiz — {s.title}</h2>
              <p style={{ fontSize:14, color:'var(--muted-foreground)', marginBottom:24 }}>
                {questions.length} questões · Nota mínima: {s.min_quiz_score}%
                {s.max_attempts?` · ${s.max_attempts} tentativas`:''}
              </p>
              <button onClick={() => setQuizStarted(true)}
                style={{ height:44, padding:'0 32px', borderRadius:12, background:'var(--foreground)', color:'var(--card)', fontSize:15, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                Iniciar Quiz 🚀
              </button>
            </div>

          ) : !quizFinished ? (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 24px' }}>
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--muted-foreground)' }}>Questão {currentQ+1} de {questions.length}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--muted-foreground)' }}>{Math.round((currentQ/questions.length)*100)}% completo</span>
                </div>
                <div style={{ height:6, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:999, background:'linear-gradient(90deg,#8b5cf6,#3b82f6)', width:`${(currentQ/questions.length)*100}%`, transition:'width .3s' }}/>
                </div>
              </div>
              <p style={{ fontSize:16, fontWeight:700, color:'var(--foreground)', marginBottom:20, lineHeight:1.5 }}>{curQ?.question}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {curQ?.onboarding_answers?.map((a: any) => {
                  const isSel=selA===a.id, isCA=a.is_correct
                  let bg='var(--secondary)', bd='var(--border)', col='var(--foreground)'
                  if (showExpl&&isSel&&isCA)  { bg='rgba(34,197,94,.12)'; bd='#22c55e'; col='#22c55e' }
                  else if (showExpl&&isSel)   { bg='rgba(239,68,68,.1)';  bd='#ef4444'; col='#ef4444' }
                  else if (showExpl&&isCA)    { bg='rgba(34,197,94,.08)'; bd='rgba(34,197,94,.4)'; col='#22c55e' }
                  return (
                    <button key={a.id} onClick={() => !selA&&selectAnswer(curQ.id,a.id)} disabled={!!selA}
                      style={{ width:'100%', padding:'13px 16px', borderRadius:11, border:`1.5px solid ${bd}`, background:bg, color:col, fontSize:14, fontWeight:isSel?600:500, cursor:selA?'default':'pointer', fontFamily:'inherit', textAlign:'left', transition:'all .2s', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${bd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0, background:isSel?bd:'transparent', color:isSel?'white':bd }}>
                        {showExpl&&isCA?'✓':showExpl&&isSel?'✗':''}
                      </span>
                      {a.answer_text}
                    </button>
                  )
                })}
              </div>
              {showExpl&&curQ?.explanation&&(
                <div style={{ padding:'12px 16px', borderRadius:10, background:isCorr?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)', border:`1px solid ${isCorr?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)'}`, marginBottom:16 }}>
                  <p style={{ fontSize:13, color:isCorr?'#22c55e':'#ef4444', margin:'0 0 4px', fontWeight:700 }}>{isCorr?'✓ Correto!':'✗ Resposta incorreta'}</p>
                  <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:0 }}>💡 {curQ.explanation}</p>
                </div>
              )}
              {showExpl&&(
                <button onClick={nextQuestion} disabled={submitting}
                  style={{ width:'100%', height:44, borderRadius:11, background:'var(--foreground)', color:'var(--card)', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  {currentQ<questions.length-1?'Próxima questão →':submitting?'Calculando...':'Ver resultado 🏆'}
                </button>
              )}
            </div>

          ) : (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'40px 32px', textAlign:'center' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>{quizScore>=s.min_quiz_score?'🏆':'💪'}</div>
              <h2 style={{ fontSize:24, fontWeight:800, color:quizScore>=s.min_quiz_score?'#22c55e':'#f59e0b', marginBottom:8 }}>{quizScore}%</h2>
              <p style={{ fontSize:16, fontWeight:600, color:'var(--foreground)', marginBottom:8 }}>
                {quizScore>=s.min_quiz_score?'Parabéns! Você passou! 🎉':'Continue tentando! Você consegue!'}
              </p>
              <p style={{ fontSize:13, color:'var(--muted-foreground)', marginBottom:28 }}>
                Nota mínima: {s.min_quiz_score}% · Sua nota: {quizScore}%
              </p>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={() => { setQuizStarted(false); setQuizFinished(false); setCurrentQ(0); setSelectedAnswers({}); setShowExpl(false) }}
                  style={{ height:40, padding:'0 24px', borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Tentar novamente
                </button>
                {quizScore>=s.min_quiz_score&&(
                  <a href="/onboarding/trilha"
                    style={{ height:40, padding:'0 24px', borderRadius:10, background:'var(--foreground)', color:'var(--card)', fontSize:14, fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                    Próxima etapa →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
