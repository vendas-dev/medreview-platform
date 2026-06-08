'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createMaterial, createFaq, createQuestion } from '../../actions'

// ── Helpers ────────────────────────────────────────────────────────────────
function extractThumbnail(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return `https://img.youtube.com/vi/${u.pathname.slice(1)}/hqdefault.jpg`
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v')
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
    }
    if (u.hostname.includes('vimeo.com')) return `https://vumbnail.com/${u.pathname.split('/').pop()}.jpg`
    if (u.hostname.includes('loom.com')) return `https://cdn.loom.com/sessions/thumbnails/${u.pathname.split('/').pop()}-with-play.gif`
  } catch {}
  return ''
}

function isVideoUrl(url: string): boolean {
  return !!(url && (url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || url.includes('loom')))
}

// ── Styles ─────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width:'100%', height:42, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
  transition:'border-color 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:'var(--muted-foreground)',
  display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em',
}

// ── Select estilizado ──────────────────────────────────────────────────────
function StyledSelect({ name, defaultValue, children, value, onChange }: {
  name?: string; defaultValue?: string; children: React.ReactNode
  value?: string; onChange?: (v: string) => void
}) {
  return (
    <div style={{ position:'relative' }}>
      <select name={name} defaultValue={defaultValue} value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        style={{
          ...inp, paddingRight:36, appearance:'none', cursor:'pointer',
          WebkitAppearance:'none', background:'var(--background)',
        }}
        onFocus={e => e.target.style.borderColor='#6366f1'}
        onBlur={e => e.target.style.borderColor='var(--border)'}>
        {children}
      </select>
      <svg style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--muted-foreground)' }}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  )
}

// ── Botões ─────────────────────────────────────────────────────────────────
function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 10px rgba(79,70,229,0.3)', transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 16px rgba(79,70,229,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 3px 10px rgba(79,70,229,0.3)' }}>
      <Plus size={12}/> {label}
    </button>
  )
}

function ModalWrap({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 28px 64px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--foreground)', margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, border:'none', background:'var(--secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--foreground)', transition:'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background='var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.background='var(--secondary)')}>
            <X size={14}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalBtns({ loading, label, onCancel }: { loading: boolean; label: string; onCancel: () => void }) {
  return (
    <div style={{ display:'flex', gap:10, paddingTop:8 }}>
      <button type="button" onClick={onCancel} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.12s' }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--secondary)'; e.currentTarget.style.color='var(--foreground)' }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted-foreground)' }}>
        Cancelar
      </button>
      <button type="submit" disabled={loading}
        style={{ flex:1, height:42, borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', opacity:loading?0.6:1, boxShadow:'0 4px 14px rgba(79,70,229,0.3)' }}>
        {loading ? 'Salvando...' : label}
      </button>
    </div>
  )
}

// ── MaterialsManager ───────────────────────────────────────────────────────
export function MaterialsManager({ stepId, mode }: { stepId: string; mode: 'create' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [type, setType] = useState('video')
  const [thumbPreview, setThumbPreview] = useState('')

  function handleUrl(v: string) {
    setUrl(v)
    if (isVideoUrl(v)) {
      setType('video')
      const t = extractThumbnail(v)
      if (t) setThumbPreview(t)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('step_id', stepId)
    // injeta thumbnail automática se for vídeo e não tiver personalizada
    if (!fd.get('thumbnail_url') && thumbPreview) fd.set('thumbnail_url', thumbPreview)
    if (!fd.get('thumbnail_url') && isVideoUrl(url)) fd.set('thumbnail_url', extractThumbnail(url))
    await createMaterial(fd)
    setLoading(false); setOpen(false); setUrl(''); setThumbPreview('')
  }

  return (
    <>
      <AddBtn label="Adicionar material" onClick={() => setOpen(true)} />
      {open && (
        <ModalWrap title="Adicionar material" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl}>Título *</label>
              <input name="title" required placeholder="Nome do material" style={inp}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
            <div>
              <label style={lbl}>Descrição</label>
              <textarea name="description" rows={2} placeholder="Descreva brevemente..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
            <div>
              <label style={lbl}>URL *</label>
              <input name="url" required type="url" value={url} onChange={e => handleUrl(e.target.value)}
                placeholder="YouTube, Vimeo, Loom, Drive, PDF..." style={inp}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
              <p style={{ fontSize:11, color:'var(--muted-foreground)', marginTop:4 }}>Thumbnail extraída automaticamente para YouTube, Vimeo e Loom.</p>
            </div>

            {/* Thumbnail preview automática */}
            {thumbPreview && (
              <div>
                <label style={lbl}>Thumbnail detectada ✓</label>
                <img src={thumbPreview} alt="thumb" style={{ width:'100%', maxHeight:130, objectFit:'cover', borderRadius:10, border:'1px solid var(--border)' }} />
              </div>
            )}

            <div>
              <label style={lbl}>Tipo</label>
              <StyledSelect name="type" value={type} onChange={setType}>
                <option value="video">🎬 Vídeo</option>
                <option value="documento">📄 Documento</option>
                <option value="pdf">📑 PDF</option>
                <option value="apresentacao">📊 Apresentação</option>
                <option value="site">🌐 Site / Link</option>
                <option value="outro">📎 Outro</option>
              </StyledSelect>
            </div>

            <div>
              <label style={lbl}>Dia da sequência</label>
              <StyledSelect name="day_number" defaultValue="">
                <option value="">Sem dia específico</option>
                {Array.from({length:15},(_,i)=>i+1).map(d=>(
                  <option key={d} value={d}>📅 Dia {d}</option>
                ))}
              </StyledSelect>
            </div>

            <ModalBtns loading={loading} label="Adicionar material" onCancel={() => setOpen(false)} />
          </form>
        </ModalWrap>
      )}
    </>
  )
}

// ── FaqManager ─────────────────────────────────────────────────────────────
export function FaqManager({ stepId, mode }: { stepId: string; mode: 'create' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('step_id', stepId)
    await createFaq(fd)
    setLoading(false); setOpen(false)
  }

  return (
    <>
      <AddBtn label="Adicionar FAQ" onClick={() => setOpen(true)} />
      {open && (
        <ModalWrap title="Adicionar FAQ" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl}>Pergunta *</label>
              <input name="question" required placeholder="Ex: O que é a MedReview?" style={inp}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
            <div>
              <label style={lbl}>Resposta *</label>
              <textarea name="answer" required rows={6} placeholder="Resposta detalhada..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.65 }}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
            <ModalBtns loading={loading} label="Adicionar FAQ" onCancel={() => setOpen(false)} />
          </form>
        </ModalWrap>
      )}
    </>
  )
}

// ── QuizManager ────────────────────────────────────────────────────────────
export function QuizManager({ stepId, mode }: { stepId: string; mode: 'create' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState([
    { text:'', is_correct:false }, { text:'', is_correct:false },
    { text:'', is_correct:false }, { text:'', is_correct:false },
  ])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('step_id', stepId)
    fd.set('answers', JSON.stringify(answers))
    await createQuestion(fd)
    setLoading(false); setOpen(false)
    setAnswers([{text:'',is_correct:false},{text:'',is_correct:false},{text:'',is_correct:false},{text:'',is_correct:false}])
  }

  return (
    <>
      <AddBtn label="Adicionar questão" onClick={() => setOpen(true)} />
      {open && (
        <ModalWrap title="Adicionar questão ao quiz" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl}>Pergunta *</label>
              <textarea name="question" required rows={3} placeholder="Escreva a pergunta aqui..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
            <div>
              <label style={lbl}>Alternativas * <span style={{ color:'var(--muted-foreground)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(clique no círculo para marcar a correta)</span></label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 14px', borderRadius:10, border:`1.5px solid ${a.is_correct ? '#22c55e' : 'var(--border)'}`, background:a.is_correct?'rgba(34,197,94,0.06)':'var(--background)', transition:'all 0.15s' }}>
                    <button type="button" onClick={() => setAnswers(prev => prev.map((x, j) => ({ ...x, is_correct: j===i })))}
                      style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${a.is_correct?'#22c55e':'var(--border)'}`, background:a.is_correct?'#22c55e':'transparent', cursor:'pointer', flexShrink:0, transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {a.is_correct && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--muted-foreground)', width:18, flexShrink:0 }}>{String.fromCharCode(65+i)}</span>
                    <input value={a.text} onChange={e => setAnswers(prev => prev.map((x,j) => j===i?{...x,text:e.target.value}:x))}
                      placeholder={`Alternativa ${String.fromCharCode(65+i)}`}
                      style={{ flex:1, height:32, padding:'0 10px', borderRadius:7, border:'none', background:'transparent', color:'var(--foreground)', fontSize:13, fontFamily:'inherit', outline:'none' }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Explicação (exibida após responder)</label>
              <textarea name="explanation" rows={3} placeholder="Explique por que a resposta está correta..." style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }}
                onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='var(--border)'} />
            </div>
            <ModalBtns loading={loading} label="Adicionar questão" onCancel={() => setOpen(false)} />
          </form>
        </ModalWrap>
      )}
    </>
  )
}
