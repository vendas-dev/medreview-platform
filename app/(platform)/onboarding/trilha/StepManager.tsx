'use client'
import { useState, useEffect, useRef, useTransition, useOptimistic } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, X, Pencil, Trash2, Copy, GripVertical, ChevronUp, ChevronDown, Check } from 'lucide-react'
import {
  createStep, updateStep, deleteStep, reorderSteps, swapStepOrder, duplicateStep,
} from '../actions'

const INP: React.CSSProperties = {
  width:'100%', height:42, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
}
const LBL: React.CSSProperties = {
  fontSize:13, fontWeight:600, color:'var(--foreground)', display:'block', marginBottom:6,
}

// ── Dropdown custom (substitui <select> nativo, que não dá pra estilizar) ──
function CustomSelect({ name, defaultValue, options }: { name:string; defaultValue:string; options:{value:string;label:string}[] }) {
  const [open, setOpen]   = useState(false)
  const [value, setValue] = useState(defaultValue)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input type="hidden" name={name} value={value}/>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...INP, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', textAlign:'left',
          borderColor: open ? 'var(--primary)' : 'var(--border)', boxShadow: open ? '0 0 0 3px rgba(79,70,229,.15)' : 'none', transition:'border-color .15s, box-shadow .15s' }}>
        <span>{selected?.label}</span>
        <ChevronDown size={16} style={{ color:'var(--muted-foreground)', flexShrink:0, transition:'transform .18s', transform: open ? 'rotate(180deg)' : 'none' }}/>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:20, background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'var(--shadow-lg,0 12px 32px rgba(0,0,0,.25))', padding:5, animation:'dropIn .15s cubic-bezier(.22,1,.36,1)' }}>
          {options.map(o => {
            const active = o.value === value
            return (
              <div key={o.value} onClick={() => { setValue(o.value); setOpen(false) }}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:8, cursor:'pointer', fontSize:13.5, fontWeight: active?700:500, color: active?'var(--primary)':'var(--foreground)', background: active?'var(--secondary)':'transparent', transition:'background .12s' }}
                onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='var(--secondary)' }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background = active?'var(--secondary)':'transparent' }}>
                {o.label}
                {active && <Check size={14}/>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Formulário de criar/editar etapa ──────────────────────────
function StepForm({ mode, step, onClose }: { mode:'create'|'edit'; step?:any; onClose:()=>void }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    const fd = new FormData(e.currentTarget)
    if (!String(fd.get('title') ?? '').trim()) { setError('Preencha o título da etapa.'); return }
    setLoading(true)
    try {
      if (mode === 'create') await createStep(fd)
      else await updateStep(fd)
      onClose()
      startTrans(() => router.refresh())
    } catch (err:any) { setError(err?.message ?? 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <style>{`@keyframes dropIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--foreground)' }}>{mode==='create'?'Nova etapa':'Editar etapa'}</h2>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', color:'var(--muted-foreground)', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {mode==='edit' && <input type="hidden" name="id" value={step?.id}/>}
          <div><label style={LBL}>Título *</label><input name="title" defaultValue={step?.title} placeholder="Ex: Boas-vindas ao time" style={INP}/></div>
          <div><label style={LBL}>Descrição</label><textarea name="description" rows={2} defaultValue={step?.description ?? ''} placeholder="Opcional..." style={{ ...INP, height:'auto', padding:'10px 14px', resize:'vertical' }}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={LBL}>Time</label>
              <CustomSelect name="team" defaultValue={step?.team ?? 'ambos'} options={[
                { value:'ambos', label:'Ambos os times' },
                { value:'R1',    label:'Time R1' },
                { value:'OAO',   label:'Time OAO' },
              ]}/>
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
            <CustomSelect name="completion_criteria" defaultValue={step?.completion_criteria ?? 'visualizar'} options={[
              { value:'apenas_visualizar', label:'Apenas visualizar (sem conteúdo)' },
              { value:'visualizar', label:'Visualizar material' },
              { value:'quiz',       label:'Passar no quiz' },
              { value:'ambos',      label:'Ambos' },
            ]}/>
          </div>
          {error && <p style={{ fontSize:12, color:'#ef4444', padding:'8px 12px', background:'rgba(239,68,68,.06)', borderRadius:8, margin:0 }}>{error}</p>}
          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="button" onClick={onClose} style={{ flex:1, height:42, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex:1, height:42, borderRadius:10, background:loading?'var(--secondary)':'var(--primary)', color:loading?'var(--muted-foreground)':'var(--primary-fg)', fontSize:14, fontWeight:700, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {loading?'Salvando...':mode==='create'?'Criar etapa':'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ── Botão de Nova etapa (modo create) ─────────────────────────
export function CreateStepButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display:'inline-flex', alignItems:'center', gap:8, height:40, padding:'0 18px', borderRadius:10, background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit', boxShadow:'var(--shadow-purple, 0 4px 14px rgba(79,70,229,.3))' }}>
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
      // `steps` já vem escopado ao dia da etapa (ver TrilhaViewClient),
      // então mover aqui nunca invade outro dia.
      const ids = steps.map(s => s.id)
      const idx = ids.indexOf(step.id)
      const newIdx = direction==='up' ? idx-1 : idx+1
      if (newIdx < 0 || newIdx >= ids.length) return
      await swapStepOrder(step.id, ids[newIdx])
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
        <button onClick={handleDuplicate} disabled={duplicating} title="Duplicar etapa"
          style={{ ...iconBtn, background:'rgba(13,148,136,.07)', borderColor:'rgba(13,148,136,.18)', color:'#0d9488' }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(13,148,136,.16)' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(13,148,136,.07)' }}>
          <Copy size={13}/>
        </button>
        {/* Editar */}
        <button onClick={() => setEditOpen(true)} title="Editar etapa"
          style={{ ...iconBtn, background:'rgba(99,102,241,.07)', borderColor:'rgba(99,102,241,.18)', color:'#6366f1' }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.16)' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(99,102,241,.07)' }}>
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
          <button onClick={() => setConfirmDel(true)} title="Excluir etapa"
            style={{ ...iconBtn, background:'rgba(239,68,68,.07)', borderColor:'rgba(239,68,68,.18)', color:'#ef4444' }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,.16)' }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,.07)' }}>
            <Trash2 size={13}/>
          </button>
        )}
      </div>
    </>
  )
}
