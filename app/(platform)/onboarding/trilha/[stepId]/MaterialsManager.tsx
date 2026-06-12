'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

const inp: React.CSSProperties = {
  width:'100%', height:42, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
  transition:'border-color 0.15s, box-shadow 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:'var(--muted-foreground)',
  display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }

function SS({ value, onChange, children, def }: { value?: string; onChange?: (v:string)=>void; children: React.ReactNode; def?: string }) {
  return (
    <div style={{ position:'relative' }}>
      <select value={value} defaultValue={def} onChange={onChange ? e=>onChange(e.target.value) : undefined}
        style={{ ...inp, paddingRight:32, appearance:'none', WebkitAppearance:'none', cursor:'pointer' }}
        onFocus={foc} onBlur={blr}>
        {children}
      </select>
      <svg style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--muted-foreground)' }}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  )
}

function getThumb(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be'))    return `https://img.youtube.com/vi/${u.pathname.slice(1)}/hqdefault.jpg`
    if (u.hostname.includes('youtube.com')) { const id=u.searchParams.get('v'); if(id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg` }
    if (u.hostname.includes('vimeo.com'))   return `https://vumbnail.com/${u.pathname.split('/').pop()}.jpg`
    if (u.hostname.includes('loom.com'))    return `https://cdn.loom.com/sessions/thumbnails/${u.pathname.split('/').pop()}-with-play.gif`
  } catch {}
  return ''
}

interface Step { id: string; title: string; day_number: number | null }

export function MaterialsManager({ stepId, allSteps=[], onCreated }: {
  stepId: string; allSteps?: Step[]; onCreated?: (m:any)=>void
}) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [url,     setUrl]     = useState('')
  const [thumbPv, setThumbPv] = useState('')
  const [selStep, setSelStep] = useState(stepId)
  const [matType, setMatType] = useState('video')

  const sorted = [...allSteps].sort((a,b) => {
    if (a.day_number===b.day_number) return a.title.localeCompare(b.title)
    if (a.day_number===null) return 1
    if (b.day_number===null) return -1
    return a.day_number - b.day_number
  })

  function handleUrl(v: string) { setUrl(v); const t=getThumb(v); if(t) setThumbPv(t) }
  function close() { setOpen(false); setUrl(''); setThumbPv(''); setSelStep(stepId); setError('') }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd     = new FormData(e.currentTarget)
    const chosen = allSteps.find(s => s.id===selStep)
    const body = {
      step_id:     selStep,
      title:       fd.get('title'),
      description: (fd.get('description') as string) || null,
      url,
      type:        matType,
      // thumbnail_url e day_number não existem em onboarding_materials
    }
    const res  = await fetch('/api/admin/materials', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }
    onCreated?.({ ...data.material, checked:false })
    close(); setLoading(false)
  }

  const curStep = allSteps.find(s => s.id===selStep)

  return (
    <>
      <button onClick={()=>setOpen(true)}
        style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 10px rgba(79,70,229,0.3)', transition:'all 0.15s' }}
        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 5px 16px rgba(79,70,229,0.4)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 3px 10px rgba(79,70,229,0.3)'}}>
        <Plus size={12}/> Adicionar material
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget&&close()}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 28px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius:'22px 22px 0 0', padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h2 style={{ fontSize:16, fontWeight:900, color:'#fff', margin:0 }}>Adicionar material</h2>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.65)', margin:'3px 0 0' }}>Dia preenchido automaticamente pela etapa</p>
              </div>
              <button onClick={close} style={{ width:30, height:30, borderRadius:8, border:'none', background:'rgba(255,255,255,0.12)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><X size={14}/></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:13 }}>
              {error && <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize:12, color:'#ef4444', margin:0 }}>⚠ {error}</p></div>}

              <div>
                <label style={lbl}>Etapa da trilha</label>
                <SS value={selStep} onChange={setSelStep}>
                  {sorted.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.day_number!==null ? `Dia ${s.day_number} - ${s.title}` : s.title}
                    </option>
                  ))}
                </SS>
                {curStep?.day_number && <p style={{ fontSize:11, color:'#6366f1', marginTop:4, fontWeight:600 }}>📅 Dia {curStep.day_number} será preenchido automaticamente</p>}
              </div>

              <div><label style={lbl}>Título *</label><input name="title" required placeholder="Nome do material" style={inp} onFocus={foc} onBlur={blr}/></div>
              <div><label style={lbl}>Descrição</label><textarea name="description" rows={2} placeholder="Descreva brevemente..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }} onFocus={foc} onBlur={blr}/></div>

              <div>
                <label style={lbl}>URL *</label>
                <input name="url" required type="url" value={url} onChange={e=>handleUrl(e.target.value)}
                  placeholder="YouTube, Vimeo, Loom, Drive, PDF..." style={inp} onFocus={foc} onBlur={blr}/>
                {thumbPv && <img src={thumbPv} alt="thumb" style={{ width:'100%', maxHeight:110, objectFit:'cover', borderRadius:9, marginTop:8, border:'1px solid var(--border)' }}/>}
              </div>

              <div>
                <label style={lbl}>Tipo</label>
                <SS value={matType} onChange={setMatType}>
                  <option value="video">🎬 Vídeo</option>
                  <option value="documento">📄 Documento</option>
                  <option value="pdf">📑 PDF</option>
                  <option value="apresentacao">📊 Apresentação</option>
                  <option value="site">🌐 Site / Link</option>
                  <option value="outro">📎 Outro</option>
                </SS>
              </div>

              <div style={{ display:'flex', gap:10, paddingTop:4 }}>
                <button type="button" onClick={close} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex:2, height:42, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:800, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', opacity:loading?0.7:1, boxShadow:'0 4px 14px rgba(79,70,229,0.3)' }}>{loading?'Salvando...':'+ Adicionar material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function FaqManager({ stepId, onCreated }: { stepId:string; onCreated?:(f:any)=>void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd  = new FormData(e.currentTarget)
    const res = await fetch('/api/admin/faqs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ step_id:stepId, question:fd.get('question'), answer:fd.get('answer') }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro'); setLoading(false); return }
    onCreated?.(data.faq); setOpen(false); setLoading(false)
  }

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 10px rgba(79,70,229,0.3)' }}><Plus size={12}/> Adicionar FAQ</button>
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e=>e.target===e.currentTarget&&setOpen(false)}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, width:'100%', maxWidth:520, boxShadow:'0 28px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius:'22px 22px 0 0', padding:'18px 22px' }}><h2 style={{ fontSize:16, fontWeight:900, color:'#fff', margin:0 }}>Adicionar FAQ</h2></div>
            <form onSubmit={handleSubmit} style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:13 }}>
              {error && <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize:12, color:'#ef4444', margin:0 }}>⚠ {error}</p></div>}
              <div><label style={lbl}>Pergunta *</label><input name="question" required placeholder="Ex: O que é a MedReview?" style={inp} onFocus={foc} onBlur={blr}/></div>
              <div><label style={lbl}>Resposta *</label><textarea name="answer" required rows={5} placeholder="Resposta detalhada..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.65 }} onFocus={foc} onBlur={blr}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setOpen(false)} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex:2, height:42, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:800, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', opacity:loading?0.7:1 }}>{loading?'Salvando...':'+ Adicionar FAQ'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function QuizManager({ stepId, onCreated }: { stepId:string; onCreated?:(q:any)=>void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const blank = () => [{text:'',is_correct:false},{text:'',is_correct:false},{text:'',is_correct:false},{text:'',is_correct:false}]
  const [answers, setAnswers] = useState(blank())

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd  = new FormData(e.currentTarget)
    const res = await fetch('/api/admin/questions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ step_id:stepId, question:fd.get('question'), explanation:(fd.get('explanation') as string)||null, answers }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro'); setLoading(false); return }
    onCreated?.(data.question); setOpen(false); setLoading(false); setAnswers(blank())
  }

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 10px rgba(79,70,229,0.3)' }}><Plus size={12}/> Adicionar questão</button>
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e=>e.target===e.currentTarget&&setOpen(false)}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 28px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius:'22px 22px 0 0', padding:'18px 22px' }}><h2 style={{ fontSize:16, fontWeight:900, color:'#fff', margin:0 }}>Adicionar questão ao quiz</h2></div>
            <form onSubmit={handleSubmit} style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:13 }}>
              {error && <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize:12, color:'#ef4444', margin:0 }}>⚠ {error}</p></div>}
              <div><label style={lbl}>Pergunta *</label><textarea name="question" required rows={3} placeholder="Escreva a pergunta..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }} onFocus={foc} onBlur={blr}/></div>
              <div>
                <label style={lbl}>Alternativas <span style={{ color:'var(--muted-foreground)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(marque a correta)</span></label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {answers.map((a,i) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'9px 13px', borderRadius:10, border:`1.5px solid ${a.is_correct?'#22c55e':'var(--border)'}`, background:a.is_correct?'rgba(34,197,94,0.06)':'var(--background)', transition:'all 0.15s' }}>
                      <button type="button" onClick={()=>setAnswers(p=>p.map((x,j)=>({...x,is_correct:j===i})))}
                        style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${a.is_correct?'#22c55e':'var(--border)'}`, background:a.is_correct?'#22c55e':'transparent', cursor:'pointer', flexShrink:0, transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {a.is_correct && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                      <span style={{ fontSize:11, fontWeight:700, color:'var(--muted-foreground)', width:16, flexShrink:0 }}>{String.fromCharCode(65+i)}</span>
                      <input value={a.text} onChange={e=>setAnswers(p=>p.map((x,j)=>j===i?{...x,text:e.target.value}:x))}
                        placeholder={`Alternativa ${String.fromCharCode(65+i)}`}
                        style={{ flex:1, height:32, padding:'0 10px', borderRadius:7, border:'none', background:'transparent', color:'var(--foreground)', fontSize:13, fontFamily:'inherit', outline:'none' }}/>
                    </div>
                  ))}
                </div>
              </div>
              <div><label style={lbl}>Explicação (após responder)</label><textarea name="explanation" rows={3} placeholder="Por que a resposta está correta..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }} onFocus={foc} onBlur={blr}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setOpen(false)} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex:2, height:42, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:800, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', opacity:loading?0.7:1 }}>{loading?'Salvando...':'+ Adicionar questão'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
