'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Link as LinkIcon, Loader2 } from 'lucide-react'
import { createMaterial, createFaq, createQuestion, updateMaterial } from '../../actions'

const inputStyle: React.CSSProperties = {
  width:'100%', height:42, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
}
const labelStyle: React.CSSProperties = {
  fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6,
}

// Extrai thumbnail do YouTube automaticamente
function getYouTubeThumbnail(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`
  }
  return null
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:'var(--foreground)', margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}>
            <X size={16}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:8, background:'transparent', border:'1.5px solid var(--border)', color:'var(--muted-foreground)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='var(--secondary)'; (e.currentTarget as HTMLElement).style.color='var(--foreground)' }}
      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
      <Plus size={13}/> {label}
    </button>
  )
}

function SubmitRow({ loading, onCancel, label='Adicionar' }: { loading: boolean; onCancel: () => void; label?: string }) {
  return (
    <div style={{ display:'flex', gap:10, paddingTop:8 }}>
      <button type="button" onClick={onCancel}
        style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        Cancelar
      </button>
      <button type="submit" disabled={loading}
        style={{ flex:1, height:42, borderRadius:10, background:loading?'var(--secondary)':'var(--foreground)', color:loading?'var(--muted-foreground)':'var(--card)', fontSize:14, fontWeight:700, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        {loading && <Loader2 size={14} style={{ animation:'spin .8s linear infinite' }}/>}
        {loading ? 'Salvando...' : label}
      </button>
    </div>
  )
}


// ── Edit Material Modal ────────────────────────────────────
function getYTThumb(url: string): string | null {
  const ps = [/youtube\.com\/watch\?v=([^&\s]+)/, /youtu\.be\/([^?\s]+)/, /youtube\.com\/embed\/([^?\s]+)/, /youtube\.com\/shorts\/([^?\s]+)/]
  for (const p of ps) { const m = url.match(p); if (m?.[1]) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` }
  return null
}

export function EditMaterialModal({ material, stepId, onClose }: { material:any; stepId:string; onClose:()=>void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [url,   setUrl]   = useState(material.url ?? '')
  const [thumb, setThumb] = useState(material.thumbnail_url ?? '')
  const [error, setError] = useState('')

  function handleUrlChange(val: string) {
    setUrl(val)
    const yt = getYTThumb(val)
    if (yt && !thumb) setThumb(yt)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!url.trim()) { setError('URL é obrigatória.'); return }
    setLoading(true); setError('')
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('id', material.id); fd.set('step_id', stepId)
      fd.set('url', url); fd.set('thumbnail_url', thumb)
      await updateMaterial(fd)
      onClose(); startTransition(() => router.refresh())
    } catch (err:any) { setError(err?.message ?? 'Erro ao salvar.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--foreground)' }}>Editar material</h2>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, border:'none', background:'transparent', cursor:'pointer', color:'var(--muted-foreground)', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div><label style={labelStyle}>Título *</label><input name="title" required defaultValue={material.title} style={inputStyle}/></div>
          <div><label style={labelStyle}>Descrição</label><textarea name="description" rows={2} defaultValue={material.description ?? ''} style={{ ...inputStyle, height:'auto', padding:'10px 14px', resize:'vertical' }}/></div>
          <div>
            <label style={labelStyle}>URL *</label>
            <input value={url} onChange={e => handleUrlChange(e.target.value)} required placeholder="https://..." style={inputStyle}/>
            {thumb && (
              <div style={{ marginTop:8, borderRadius:10, overflow:'hidden', position:'relative', height:100 }}>
                <img src={thumb} alt="Thumb" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                <button type="button" onClick={() => setThumb('')} style={{ position:'absolute', top:6, right:6, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,.5)', border:'none', color:'#fff', cursor:'pointer', fontSize:12 }}>×</button>
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select name="type" defaultValue={material.type ?? 'video'} style={{ ...inputStyle, appearance:'none' }}>
              <option value="video">Vídeo</option>
              <option value="documento">Documento</option>
              <option value="pdf">PDF</option>
              <option value="site">Site</option>
              <option value="apresentacao">Apresentação</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {!thumb && <div><label style={labelStyle}>Thumbnail</label><input value={thumb} onChange={e => setThumb(e.target.value)} placeholder="https://..." style={inputStyle}/></div>}
          {error && <p style={{ fontSize:12, color:'#ef4444', margin:0, padding:'8px 12px', background:'rgba(239,68,68,.06)', borderRadius:8 }}>{error}</p>}
          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="button" onClick={onClose} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex:1, height:42, borderRadius:10, background:loading?'var(--secondary)':'var(--foreground)', color:loading?'var(--muted-foreground)':'var(--card)', fontSize:14, fontWeight:700, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {loading?'Salvando...':'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Materials Manager ──────────────────────────────────────
export function MaterialsManager({ stepId }: { stepId: string; mode?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [url,     setUrl]     = useState('')
  const [thumb,   setThumb]   = useState('')
  const [type,    setType]    = useState('video')

  function handleClose() { setOpen(false); setUrl(''); setThumb(''); setError('') }

  function handleUrlChange(val: string) {
    setUrl(val)
    // Auto-detectar YouTube e puxar thumbnail
    const yt = getYouTubeThumbnail(val)
    if (yt) { setThumb(yt); setType('video') }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!url.trim()) { setError('URL é obrigatória.'); return }
    setLoading(true); setError('')
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('url', url)
      formData.set('thumbnail_url', thumb)
      formData.append('step_id', stepId)
      await createMaterial(formData)
      handleClose()
      startTransition(() => router.refresh())
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AddBtn label="Adicionar material" onClick={() => { setOpen(true); setError(''); setUrl(''); setThumb('') }}/>
      {open && (
        <Modal title="Adicionar material" onClose={handleClose}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div><label style={labelStyle}>Título *</label><input name="title" required placeholder="Nome do material" style={inputStyle}/></div>
            <div><label style={labelStyle}>Descrição</label><textarea name="description" rows={2} placeholder="Opcional..." style={{ ...inputStyle, height:'auto', padding:'10px 14px', resize:'vertical' }}/></div>
            <div>
              <label style={labelStyle}>URL *</label>
              <div style={{ position:'relative' }}>
                <input value={url} onChange={e => handleUrlChange(e.target.value)} required placeholder="https://..." style={{ ...inputStyle, paddingRight:44 }}/>
                <LinkIcon size={14} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted-foreground)', pointerEvents:'none' }}/>
              </div>
              {thumb && (
                <div style={{ marginTop:8, borderRadius:10, overflow:'hidden', position:'relative', height:120 }}>
                  <img src={thumb} alt="Thumbnail" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.3),transparent)' }}/>
                  <span style={{ position:'absolute', bottom:8, left:10, fontSize:10, color:'#fff', fontWeight:700, background:'rgba(0,0,0,.4)', padding:'2px 8px', borderRadius:4 }}>Thumbnail detectada automaticamente ✓</span>
                  <button type="button" onClick={() => setThumb('')}
                    style={{ position:'absolute', top:8, right:8, width:24, height:24, borderRadius:'50%', background:'rgba(0,0,0,.5)', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>×</button>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select name="type" value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, appearance:'none', cursor:'pointer' }}>
                <option value="video">Vídeo</option>
                <option value="documento">Documento</option>
                <option value="pdf">PDF</option>
                <option value="site">Site</option>
                <option value="apresentacao">Apresentação</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            {!thumb && (
              <div><label style={labelStyle}>Thumbnail (opcional)</label><input value={thumb} onChange={e => setThumb(e.target.value)} placeholder="https://... (YouTube: detectada automático)" style={inputStyle}/></div>
            )}
            {error && <p style={{ fontSize:12, color:'#ef4444', margin:0, padding:'8px 12px', background:'rgba(239,68,68,.06)', borderRadius:8 }}>{error}</p>}
            <SubmitRow loading={loading} onCancel={handleClose}/>
          </form>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </Modal>
      )}
    </>
  )
}

// ── FAQ Manager ────────────────────────────────────────────
export function FaqManager({ stepId }: { stepId: string; mode?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function handleClose() { setOpen(false); setError('') }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const formData = new FormData(e.currentTarget)
      formData.append('step_id', stepId)
      await createFaq(formData)
      handleClose()
      startTransition(() => router.refresh())
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AddBtn label="Adicionar FAQ" onClick={() => { setOpen(true); setError('') }}/>
      {open && (
        <Modal title="Adicionar FAQ" onClose={handleClose}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div><label style={labelStyle}>Pergunta *</label><input name="question" required placeholder="Ex: O que é a MedReview?" style={inputStyle}/></div>
            <div><label style={labelStyle}>Resposta *</label><textarea name="answer" required rows={5} placeholder="Resposta completa..." style={{ ...inputStyle, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.6 }}/></div>
            {error && <p style={{ fontSize:12, color:'#ef4444', margin:0, padding:'8px 12px', background:'rgba(239,68,68,.06)', borderRadius:8 }}>{error}</p>}
            <SubmitRow loading={loading} onCancel={handleClose}/>
          </form>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </Modal>
      )}
    </>
  )
}

// ── Quiz Manager ───────────────────────────────────────────
export function QuizManager({ stepId }: { stepId: string; mode?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const blank = () => [
    { text:'', is_correct:false },
    { text:'', is_correct:false },
    { text:'', is_correct:false },
    { text:'', is_correct:false },
  ]
  const [answers, setAnswers] = useState(blank())

  function handleClose() { setOpen(false); setError(''); setAnswers(blank()) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!answers.some(a => a.is_correct && a.text.trim())) {
      setError('Marque pelo menos uma alternativa correta com texto.'); return
    }
    setLoading(true); setError('')
    try {
      const form = new FormData(e.currentTarget)
      form.append('step_id', stepId)
      form.append('answers', JSON.stringify(answers))
      await createQuestion(form)
      handleClose()
      startTransition(() => router.refresh())
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AddBtn label="Adicionar questão" onClick={() => { setOpen(true); setError(''); setAnswers(blank()) }}/>
      {open && (
        <Modal title="Adicionar questão" onClose={handleClose}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div><label style={labelStyle}>Pergunta *</label><textarea name="question" required rows={3} placeholder="Digite a pergunta..." style={{ ...inputStyle, height:'auto', padding:'10px 14px', resize:'vertical' }}/></div>
            <div>
              <label style={labelStyle}>Alternativas *</label>
              <p style={{ fontSize:11, color:'var(--muted-foreground)', marginBottom:10 }}>Clique no círculo para marcar a correta.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button type="button" onClick={() => setAnswers(answers.map((ans, idx) => ({ ...ans, is_correct: idx === i })))}
                      style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${a.is_correct?'#10b981':'var(--border)'}`, background:a.is_correct?'#10b981':'transparent', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}/>
                    <input value={a.text} onChange={e => setAnswers(answers.map((ans, idx) => idx===i?{...ans,text:e.target.value}:ans))}
                      placeholder={`Alternativa ${String.fromCharCode(65+i)}`} style={{ ...inputStyle, flex:1 }}/>
                  </div>
                ))}
              </div>
            </div>
            <div><label style={labelStyle}>Explicação (exibida após responder)</label><textarea name="explanation" rows={3} placeholder="Explique o motivo da resposta correta..." style={{ ...inputStyle, height:'auto', padding:'10px 14px', resize:'vertical' }}/></div>
            {error && <p style={{ fontSize:12, color:'#ef4444', margin:0, padding:'8px 12px', background:'rgba(239,68,68,.06)', borderRadius:8 }}>{error}</p>}
            <SubmitRow loading={loading} onCancel={handleClose}/>
          </form>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </Modal>
      )}
    </>
  )
}
