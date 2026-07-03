'use client'
import { useState, useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Pencil, Trash2, Copy, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import {
  createStep, updateStep, deleteStep, reorderSteps, duplicateStep,
} from '../actions'

const INP: React.CSSProperties = {
  width:'100%', height:42, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
}
const LBL: React.CSSProperties = {
  fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6,
}

// ── Formulário de criar/editar etapa ──────────────────────────
function StepForm({ mode, step, onClose }: { mode:'create'|'edit'; step?:any; onClose:()=>void }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const fd = new FormData(e.currentTarget)
      if (mode === 'create') await createStep(fd)
      else await updateStep(fd)
      onClose()
      startTrans(() => router.refresh())
    } catch (err:any) { setError(err?.message ?? 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--foreground)' }}>{mode==='create'?'Nova etapa':'Editar etapa'}</h2>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', color:'var(--muted-foreground)', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {mode==='edit' && <input type="hidden" name="id" value={step?.id}/>}
          <div><label style={LBL}>Título *</label><input name="title" required defaultValue={step?.title} placeholder="Ex: Boas-vindas ao time" style={INP}/></div>
          <div><label style={LBL}>Descrição</label><textarea name="description" rows={2} defaultValue={step?.description ?? ''} placeholder="Opcional..." style={{ ...INP, height:'auto', padding:'10px 14px', resize:'vertical' }}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={LBL}>Time</label>
              <select name="team" defaultValue={step?.team ?? 'ambos'} style={{ ...INP, appearance:'none', cursor:'pointer' }}>
                <option value="ambos">Ambos os times</option>
                <option value="R1">Time R1</option>
                <option value="OAO">Time OAO</option>
              </select>
            </div>
            <div>
              <label style={LBL}>Dia da trilha</label>
              <input type="number" name="day_number" min={1} defaultValue={step?.day_number ?? ''} placeholder="Ex: 1" style={INP}/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={LBL}>Duração estimada (min)</label>
              <input type="number" name="estimated_minutes" min={1} defaultValue={step?.estimated_minutes ?? ''} placeholder="Ex: 30" style={INP}/>
            </div>
            <div>
              <label style={LBL}>Nota mínima no quiz (%)</label>
              <input type="number" name="min_quiz_score" min={0} max={100} defaultValue={step?.min_quiz_score ?? 70} style={INP}/>
            </div>
          </div>
          <div>
            <label style={LBL}>Critério de conclusão</label>
            <select name="completion_criteria" defaultValue={step?.completion_criteria ?? 'visualizar'} style={{ ...INP, appearance:'none', cursor:'pointer' }}>
              <option value="visualizar">Visualizar material</option>
              <option value="quiz">Passar no quiz</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          {error && <p style={{ fontSize:12, color:'#ef4444', padding:'8px 12px', background:'rgba(239,68,68,.06)', borderRadius:8, margin:0 }}>{error}</p>}
          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="button" onClick={onClose} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex:1, height:42, borderRadius:10, background:loading?'var(--secondary)':'var(--foreground)', color:loading?'var(--muted-foreground)':'var(--card)', fontSize:14, fontWeight:700, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {loading?'Salvando...':mode==='create'?'Criar etapa':'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Botão de Nova etapa (modo create) ─────────────────────────
export function CreateStepButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display:'inline-flex', alignItems:'center', gap:8, height:40, padding:'0 18px', borderRadius:10, background:'var(--foreground)', color:'var(--card)', fontSize:14, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        <Plus size={15}/> Nova etapa
      </button>
      {open && <StepForm mode="create" onClose={() => setOpen(false)}/>}
    </>
  )
}

// ── Filtro de time para admin ─────────────────────────────────
export function TeamFilter({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const opts = [
    { value:'ambos', label:'Todos os times' },
    { value:'R1',   label:'Time R1' },
    { value:'OAO',  label:'Time OAO' },
  ]
  return (
    <div style={{ display:'flex', gap:4, padding:4, background:'var(--secondary)', borderRadius:10, border:'1px solid var(--border)' }}>
      {opts.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ height:30, padding:'0 14px', borderRadius:7, border:'none', background:value===o.value?'var(--card)':'transparent', color:value===o.value?'var(--foreground)':'var(--muted-foreground)', fontSize:12, fontWeight:value===o.value?700:400, cursor:'pointer', fontFamily:'inherit', boxShadow:value===o.value?'0 1px 4px rgba(0,0,0,.08)':'none', transition:'all .15s', whiteSpace:'nowrap' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Controles de admin por etapa ─────────────────────────────
export function StepAdminControls({ step, steps, isFirst, isLast }: { step:any; steps:any[]; isFirst:boolean; isLast:boolean }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [editOpen,    setEditOpen]    = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [moving,      setMoving]      = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteStep(step.id)
      startTrans(() => router.refresh())
    } finally { setDeleting(false); setConfirmDel(false) }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      await duplicateStep(step.id)
      startTrans(() => router.refresh())
    } finally { setDuplicating(false) }
  }

  async function handleMove(direction: 'up'|'down') {
    setMoving(true)
    try {
      const ids = steps.map(s => s.id)
      const idx = ids.indexOf(step.id)
      const newIdx = direction==='up' ? idx-1 : idx+1
      if (newIdx < 0 || newIdx >= ids.length) return
      const reordered = [...ids]
      reordered.splice(idx, 1)
      reordered.splice(newIdx, 0, step.id)
      await reorderSteps(reordered)
      startTrans(() => router.refresh())
    } finally { setMoving(false) }
  }

  const iconBtn: React.CSSProperties = { width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)', transition:'all .15s', flexShrink:0 }

  return (
    <>
      {editOpen && <StepForm mode="edit" step={step} onClose={() => setEditOpen(false)}/>}
      <div style={{ display:'flex', gap:4, alignItems:'center' }} onClick={e => e.preventDefault()}>
        {/* Mover */}
        <button onClick={() => handleMove('up')} disabled={isFirst||moving} title="Mover para cima" style={{ ...iconBtn, opacity:isFirst?.3:1 }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='var(--secondary)' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent' }}>
          <ChevronUp size={13}/>
        </button>
        <button onClick={() => handleMove('down')} disabled={isLast||moving} title="Mover para baixo" style={{ ...iconBtn, opacity:isLast?.3:1 }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='var(--secondary)' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent' }}>
          <ChevronDown size={13}/>
        </button>
        {/* Duplicar */}
        <button onClick={handleDuplicate} disabled={duplicating} title="Duplicar etapa" style={iconBtn}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.1)'; (e.currentTarget as HTMLElement).style.color='#6366f1' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
          <Copy size={13}/>
        </button>
        {/* Editar */}
        <button onClick={() => setEditOpen(true)} title="Editar etapa" style={iconBtn}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.1)'; (e.currentTarget as HTMLElement).style.color='#6366f1' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
          <Pencil size={13}/>
        </button>
        {/* Excluir */}
        {confirmDel ? (
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'#ef4444', fontWeight:600 }}>Excluir?</span>
            <button onClick={handleDelete} disabled={deleting} style={{ height:26, padding:'0 10px', borderRadius:6, background:'#ef4444', color:'#fff', border:'none', cursor:'pointer', fontSize:11, fontWeight:700 }}>
              {deleting?'...':'Sim'}
            </button>
            <button onClick={() => setConfirmDel(false)} style={{ height:26, padding:'0 10px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:11, color:'var(--muted-foreground)' }}>Não</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} title="Excluir etapa" style={iconBtn}
            onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,.1)'; (e.currentTarget as HTMLElement).style.color='#ef4444' }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--muted-foreground)' }}>
            <Trash2 size={13}/>
          </button>
        )}
      </div>
    </>
  )
}
