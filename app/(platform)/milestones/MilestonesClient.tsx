'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient }  from '@/lib/supabase/client'
import { CustomSelect }  from '@/components/ui/CustomSelect'
import {
  ChevronLeft, ChevronRight, Plus, X, ExternalLink,
  Calendar, Edit2, Trash2, Save, Loader2
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────
interface Milestone {
  id: string; title: string; category: string; vertical: string
  start_at: string; end_at?: string | null
  description?: string | null; responsible?: string | null
  link?: string | null; priority?: string | null
  audience?: string | null; color: string
  created_at: string
}

// ── Constantes ────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'comunicacao',     label: '📢 Comunicação',       color: '#6366f1' },
  { value: 'lancamento',      label: '🚀 Lançamento',         color: '#f97316' },
  { value: 'treinamento',     label: '🎓 Treinamento',        color: '#22c55e' },
  { value: 'campanha',        label: '🎯 Campanha',           color: '#ec4899' },
  { value: 'evento_pres',     label: '🤝 Evento Presencial',  color: '#f59e0b' },
  { value: 'evento_online',   label: '💻 Evento Online',      color: '#14b8a6' },
  { value: 'marco_comercial', label: '📈 Marco Comercial',    color: '#8b5cf6' },
  { value: 'premiacao',       label: '🏆 Premiação',          color: '#eab308' },
  { value: 'reuniao',         label: '📅 Reunião',            color: '#64748b' },
  { value: 'outro',           label: '⭐ Outro',              color: '#a855f7' },
]
const VERTICALS = [
  { value: 'all',         label: '🌐 Todas as Verticais' },
  { value: 'medreview',   label: '🟣 Med-Review R1' },
  { value: 'anestreview', label: '🔵 Anest-Review' },
  { value: 'oftreview',   label: '🟡 Oft-Review' },
  { value: 'ortopreview', label: '🟠 Ortop-Review' },
]
const PRIORITIES = [
  { value: '',       label: 'Sem prioridade' },
  { value: 'low',    label: '🟢 Baixa' },
  { value: 'medium', label: '🟡 Média' },
  { value: 'high',   label: '🔴 Alta' },
]
const AUDIENCES = [
  { value: '',            label: 'Todos' },
  { value: 'closers',     label: '💼 Closers' },
  { value: 'ambassadors', label: '🌟 Embaixadores' },
  { value: 'leadership',  label: '👑 Liderança' },
  { value: 'sales_ops',   label: '⚙️ Sales Ops' },
]

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function getCat(cat: string) { return CATEGORIES.find(c => c.value === cat) ?? { label: cat, color: '#7c3aed', value: cat } }
function getPriorityColor(p?: string | null) {
  return p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : p === 'low' ? '#22c55e' : 'transparent'
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateFull(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Helpers do calendário ─────────────────────────────────────
function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= days; d++) grid.push(d)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function spansMilestone(m: Milestone, year: number, month: number, day: number) {
  const cell  = new Date(year, month, day)
  const start = new Date(m.start_at); start.setHours(0,0,0,0)
  const end   = m.end_at ? new Date(m.end_at) : new Date(m.start_at); end.setHours(23,59,59,999)
  return cell >= start && cell <= end
}

function isToday(year: number, month: number, day: number) {
  const t = new Date()
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
}

// ── Formulário ────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', category: 'comunicacao', vertical: 'all',
  start_at: '', end_at: '', description: '', responsible: '',
  link: '', priority: '', audience: '', color: '#7c3aed',
}

function MilestoneForm({ initial, onSave, onClose }: {
  initial?: Partial<Milestone>
  onSave: (data: typeof EMPTY_FORM) => Promise<void>
  onClose: () => void
}) {
  const [form,    setForm]    = useState({ ...EMPTY_FORM, ...initial })
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.start_at) { setErr('Título e Data de início são obrigatórios.'); return }
    setSaving(true); setErr('')
    try { await onSave(form) } catch { setErr('Erro ao salvar. Tente novamente.') }
    setSaving(false)
  }

  const cat = getCat(form.category)

  const inpS: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
    border: '1.5px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
  }
  const focusFn = (e: any) => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.1)' }
  const blurFn  = (e: any) => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }
  const lblS: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.07em' }
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <motion.div initial={{ scale:.92, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:.94, opacity:0 }}
        transition={{ type:'spring', stiffness:280, damping:22 }}
        style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:24, width:'100%', maxWidth:640, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.35)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:cat.color+'22', border:`1.5px solid ${cat.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
            {cat.label.split(' ')[0]}
          </div>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:16, fontWeight:800, color:'var(--foreground)', margin:0 }}>
              {initial?.id ? 'Editar Marco' : 'Novo Marco'}
            </h3>
            <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>Preencha os detalhes do evento</p>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={14}/>
          </button>
        </div>

        {/* Body com scroll */}
        <form onSubmit={submit} style={{ overflowY:'auto', padding:'22px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          {err && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', fontSize:12, color:'#ef4444' }}>⚠ {err}</div>}

          <div>
            <label style={lblS}>Título *</label>
            <input style={inpS} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Ex: Lançamento do Anest-Review Pro" onFocus={focusFn} onBlur={blurFn}/>
          </div>

          <div style={row2}>
            <div>
              <label style={lblS}>Categoria *</label>
              <CustomSelect value={form.category} onChange={v=>set('category',v)} options={CATEGORIES.map(c=>({ value:c.value, label:c.label }))}/>
            </div>
            <div>
              <label style={lblS}>Vertical *</label>
              <CustomSelect value={form.vertical} onChange={v=>set('vertical',v)} options={VERTICALS.map(v=>({ value:v.value, label:v.label }))}/>
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lblS}>Data Início *</label>
              <input type="datetime-local" style={inpS} value={form.start_at} onChange={e=>set('start_at',e.target.value)} onFocus={focusFn} onBlur={blurFn}/>
            </div>
            <div>
              <label style={lblS}>Data Fim</label>
              <input type="datetime-local" style={inpS} value={form.end_at} onChange={e=>set('end_at',e.target.value)} onFocus={focusFn} onBlur={blurFn}/>
            </div>
          </div>

          <div>
            <label style={lblS}>Descrição</label>
            <textarea style={{ ...inpS, height:80, padding:'10px 14px', resize:'vertical' } as React.CSSProperties} value={form.description??''} onChange={e=>set('description',e.target.value)} placeholder="Resumo rápido do marco..." onFocus={focusFn} onBlur={blurFn}/>
          </div>

          <div style={row2}>
            <div>
              <label style={lblS}>Responsável</label>
              <input style={inpS} value={form.responsible??''} onChange={e=>set('responsible',e.target.value)} placeholder="Nome do organizador" onFocus={focusFn} onBlur={blurFn}/>
            </div>
            <div>
              <label style={lblS}>Prioridade</label>
              <CustomSelect value={form.priority??''} onChange={v=>set('priority',v)} options={PRIORITIES.map(p=>({ value:p.value, label:p.label }))}/>
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lblS}>Público</label>
              <CustomSelect value={form.audience??''} onChange={v=>set('audience',v)} options={AUDIENCES.map(a=>({ value:a.value, label:a.label }))}/>
            </div>
            <div>
              <label style={lblS}>Cor / Etiqueta</label>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="color" value={form.color} onChange={e=>set('color',e.target.value)}
                  style={{ height:42, width:60, borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', padding:3 }}/>
                <div style={{ flex:1, height:42, borderRadius:10, background:form.color+'22', border:`1.5px solid ${form.color}55`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:12, color:form.color, fontWeight:700 }}>{getCat(form.category).label}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style={lblS}>Link (Meet, Drive, Notion...)</label>
            <input style={inpS} value={form.link??''} onChange={e=>set('link',e.target.value)} placeholder="https://..." onFocus={focusFn} onBlur={blurFn}/>
          </div>

          {/* Ações */}
          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="button" onClick={onClose} style={{ flex:1, height:44, borderRadius:11, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ flex:2, height:44, borderRadius:11, border:'none', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:13, fontWeight:800, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', opacity:saving?.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><Loader2 size={14} style={{ animation:'spin .6s linear infinite' }}/> Salvando...</> : <><Save size={14}/> Salvar Marco</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Detalhe do marco ──────────────────────────────────────────
function MilestoneDetail({ m, onClose, onEdit, onDelete, isAdmin }: {
  m: Milestone; onClose:()=>void; onEdit:()=>void; onDelete:()=>void; isAdmin:boolean
}) {
  const cat  = getCat(m.category)
  const vert = VERTICALS.find(v => v.value === m.vertical)
  const pCol = getPriorityColor(m.priority)
  const pri  = PRIORITIES.find(p => p.value === (m.priority??''))

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <motion.div initial={{ scale:.93, y:16 }} animate={{ scale:1, y:0 }} exit={{ scale:.95, opacity:0 }}
        transition={{ type:'spring', stiffness:300, damping:24 }}
        style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, width:'100%', maxWidth:500, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Header colorido */}
        <div style={{ background:`linear-gradient(135deg,${m.color}22,${m.color}08)`, borderBottom:`3px solid ${m.color}`, padding:'20px 22px', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:13, background:m.color+'22', border:`2px solid ${m.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
              {cat.label.split(' ')[0]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:6, background:cat.color+'22', color:cat.color }}>
                  {cat.label.replace(/^\S+\s/,'')}
                </span>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--muted-foreground)' }}>
                  {vert?.label ?? m.vertical}
                </span>
                {m.priority && (
                  <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:pCol }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:pCol, display:'inline-block' }}/>
                    {pri?.label?.replace(/^\S+\s/,'')}
                  </span>
                )}
              </div>
              <h3 style={{ fontSize:17, fontWeight:900, color:'var(--foreground)', margin:0, lineHeight:1.3 }}>{m.title}</h3>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <X size={13}/>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:12 }}>
          {/* Datas */}
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1, background:'var(--secondary)', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontSize:10, color:'var(--muted-foreground)', margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'.07em', fontWeight:700 }}>Início</p>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', margin:0 }}>
                {fmtDate(m.start_at)} <span style={{ color:'var(--muted-foreground)', fontWeight:400 }}>{fmtTime(m.start_at)}</span>
              </p>
            </div>
            {m.end_at && (
              <div style={{ flex:1, background:'var(--secondary)', borderRadius:10, padding:'10px 12px' }}>
                <p style={{ fontSize:10, color:'var(--muted-foreground)', margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'.07em', fontWeight:700 }}>Fim</p>
                <p style={{ fontSize:13, fontWeight:700, color:'var(--foreground)', margin:0 }}>
                  {fmtDate(m.end_at)} <span style={{ color:'var(--muted-foreground)', fontWeight:400 }}>{fmtTime(m.end_at)}</span>
                </p>
              </div>
            )}
          </div>

          {m.description && <p style={{ fontSize:13, color:'var(--foreground)', lineHeight:1.6, background:'var(--secondary)', borderRadius:10, padding:'10px 12px', margin:0 }}>{m.description}</p>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
            {m.responsible && <div style={{ display:'flex', gap:6, alignItems:'center' }}><span style={{ color:'var(--muted-foreground)' }}>👤</span><span style={{ color:'var(--foreground)', fontWeight:600 }}>{m.responsible}</span></div>}
            {m.audience    && <div style={{ display:'flex', gap:6, alignItems:'center' }}><span style={{ color:'var(--muted-foreground)' }}>👥</span><span style={{ color:'var(--foreground)', fontWeight:600 }}>{AUDIENCES.find(a=>a.value===m.audience)?.label ?? m.audience}</span></div>}
          </div>

          {m.link && (
            <a href={m.link} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.2)', color:'#6366f1', textDecoration:'none', fontSize:13, fontWeight:600 }}>
              <ExternalLink size={14}/> Abrir link
            </a>
          )}

          {isAdmin && (
            <div style={{ display:'flex', gap:8, paddingTop:4 }}>
              <button onClick={onEdit} style={{ flex:2, height:38, borderRadius:10, border:'1.5px solid rgba(99,102,241,.3)', background:'rgba(99,102,241,.06)', color:'#6366f1', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Edit2 size={13}/> Editar
              </button>
              <button onClick={onDelete} style={{ flex:1, height:38, borderRadius:10, border:'1.5px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.06)', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Trash2 size={13}/>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Componente principal ──────────────────────────────────────
interface Props { isAdmin: boolean; userTeam: string | null }

export function MilestonesClient({ isAdmin, userTeam }: Props) {
  const supabase = createClient()
  function pad2(n: number) { return String(n).padStart(2,'0') }
  const today    = new Date()
  const [year,      setYear]      = useState(today.getFullYear())
  const [month,     setMonth]     = useState(today.getMonth())
  const [milestones,setMilestones]= useState<Milestone[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selDay,    setSelDay]    = useState<number | null>(today.getDate())
  const [selMile,   setSelMile]   = useState<Milestone | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editMile,  setEditMile]  = useState<Milestone | null>(null)
  const [filterCat,     setFilterCat]     = useState('')
  const [filterVert,    setFilterVert]    = useState('')

  // Verticais disponíveis no filtro dependem do time do usuário
  const availableVerticals = useMemo(() => {
    if (isAdmin) return VERTICALS  // superadmin vê tudo
    if (userTeam === 'R1')  return VERTICALS.filter(v => v.value === 'all' || v.value === 'medreview')
    if (userTeam === 'OAO') return VERTICALS.filter(v => v.value === 'all' || ['anestreview','oftreview','ortopreview'].includes(v.value))
    return VERTICALS.filter(v => v.value === 'all')
  }, [isAdmin, userTeam])
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null)

  // Buscar milestones
  async function fetchMilestones() {
    const { data } = await supabase.from('milestones').select('*').order('start_at')
    setMilestones((data ?? []) as Milestone[])
    setLoading(false)
  }
  useEffect(() => { fetchMilestones() }, [])

  // Filtro de visibilidade por time
  const visible = useMemo(() => {
    return milestones.filter(m => {
      // Visibilidade por time
      if (!isAdmin) {
        const oaoVerts = ['anestreview','oftreview','ortopreview']
        if (userTeam === 'R1' && m.vertical !== 'all' && m.vertical !== 'medreview')   return false
        if (userTeam === 'OAO' && m.vertical !== 'all' && !oaoVerts.includes(m.vertical)) return false
      }
      // Filtros do usuário
      if (filterCat  && m.category !== filterCat)   return false
      if (filterVert && filterVert !== 'all' && m.vertical !== filterVert) return false
      return true
    })
  }, [milestones, isAdmin, userTeam, filterCat, filterVert])

  // Grid do calendário
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

  // Eventos do dia selecionado
  const dayEvents = useMemo(() =>
    selDay ? visible.filter(m => spansMilestone(m, year, month, selDay)).sort((a,b) => a.start_at.localeCompare(b.start_at)) : []
  , [visible, selDay, year, month])

  // Próximos eventos (sem dia selecionado)
  const upcoming = useMemo(() => {
    const now = new Date()
    return visible.filter(m => new Date(m.end_at ?? m.start_at) >= now).slice(0, 8)
  }, [visible])

  // CRUD
  async function handleSave(form: typeof EMPTY_FORM) {
    const payload = { ...form, end_at: form.end_at || null, description: form.description || null, responsible: form.responsible || null, link: form.link || null, priority: form.priority || null, audience: form.audience || null }
    if (editMile?.id) {
      await supabase.from('milestones').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editMile.id)
    } else {
      await supabase.from('milestones').insert(payload)
    }
    await fetchMilestones()
    setShowForm(false); setEditMile(null); setSelMile(null)
  }

  async function handleDelete(id: string) {
    await supabase.from('milestones').delete().eq('id', id)
    await fetchMilestones()
    setSelMile(null)
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y=>y-1) } else setMonth(m=>m-1); setSelDay(null) }
  function nextMonth() { if (month === 11) { setMonth(0);  setYear(y=>y+1) } else setMonth(m=>m+1); setSelDay(null) }

  return (
    <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:900, color:'var(--foreground)', margin:'0 0 4px', letterSpacing:'-.02em', display:'flex', alignItems:'center', gap:10 }}>
            <Calendar size={24} style={{ color:'#6366f1' }}/>
            Milestones
          </h1>
          <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:0 }}>Calendário de marcos, eventos e campanhas</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Filtro categoria */}
          <div style={{ minWidth:180 }}>
            <CustomSelect value={filterCat} onChange={setFilterCat} placeholder="Todas categorias"
              options={[{ value:'', label:'Todas categorias' }, ...CATEGORIES.map(c=>({ value:c.value, label:c.label }))]}/>
          </div>
          {/* Filtro vertical */}
          <div style={{ minWidth:160 }}>
            <CustomSelect value={filterVert} onChange={setFilterVert} placeholder="Todas verticais"
              options={[{ value:'', label:'Todas verticais' }, ...availableVerticals.map(v=>({ value:v.value, label:v.label }))]}/>
          </div>
          {isAdmin && (
            <button onClick={()=>{ setEditMile(null); setShowForm(true) }}
              style={{ display:'flex', alignItems:'center', gap:7, height:42, padding:'0 18px', borderRadius:11, border:'none', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 16px rgba(79,70,229,.3)', whiteSpace:'nowrap' }}>
              <Plus size={15}/> Novo Marco
            </button>
          )}
        </div>
      </div>

      {/* Grid principal */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:16, alignItems:'start' }}>

        {/* Calendário */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 20px rgba(0,0,0,.06)' }}>

          {/* Navegação */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg,rgba(99,102,241,.06),rgba(124,58,237,.04))' }}>
            <button onClick={prevMonth} style={{ width:36, height:36, borderRadius:9, border:'1px solid var(--border)', background:'var(--background)', color:'var(--muted-foreground)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#6366f1' }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted-foreground)' }}>
              <ChevronLeft size={16}/>
            </button>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ fontSize:20, fontWeight:900, color:'var(--foreground)', margin:0, letterSpacing:'-.02em' }}>
                {MONTHS_PT[month]}
              </h2>
              <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>{year}</p>
            </div>
            <button onClick={nextMonth} style={{ width:36, height:36, borderRadius:9, border:'1px solid var(--border)', background:'var(--background)', color:'var(--muted-foreground)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#6366f1' }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted-foreground)' }}>
              <ChevronRight size={16}/>
            </button>
          </div>

          {/* Dias da semana */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)' }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{ padding:'10px 4px', textAlign:'center', fontSize:10, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.08em' }}>{d}</div>
            ))}
          </div>

          {/* Células */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {grid.map((day, i) => {
              if (!day) return <div key={`e-${i}`} style={{ minHeight:100, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', background:'color-mix(in srgb,var(--secondary) 40%,transparent)' }}/>
              const dayEvs = visible.filter(m => spansMilestone(m, year, month, day))
              const today_ = isToday(year, month, day)
              const sel    = selDay === day
              const col    = i % 7

              return (
                <div key={day}
                  onClick={() => {
                    if (isAdmin) {
                      // Admin: clicar no dia abre o formulário com data pré-preenchida
                      const dateStr = `${year}-${pad2(month+1)}-${pad2(day)}T09:00`
                      setPrefilledDate(dateStr)
                      setEditMile(null)
                      setShowForm(true)
                    } else {
                      // Usuário: selecionar dia para ver eventos
                      setSelDay(sel ? null : day)
                    }
                  }}
                  style={{
                    minHeight:100, padding:'8px 6px',
                    borderRight: col < 6 ? '1px solid var(--border)' : 'none',
                    borderBottom:'1px solid var(--border)',
                    cursor:'pointer',
                    background: sel
                      ? 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(124,58,237,.06))'
                      : today_
                        ? 'rgba(99,102,241,.04)'
                        : 'transparent',
                    transition:'background .15s',
                    position:'relative',
                  }}
                  onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background='color-mix(in srgb,var(--secondary) 60%,transparent)' }}
                  onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background=today_?'rgba(99,102,241,.04)':'transparent' }}>

                  {/* Número do dia */}
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
                    <span style={{
                      width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight: today_ || sel ? 900 : 500,
                      background: today_ ? '#6366f1' : sel ? 'rgba(99,102,241,.15)' : 'transparent',
                      color: today_ ? '#fff' : sel ? '#6366f1' : 'var(--foreground)',
                      flexShrink:0,
                    }}>{day}</span>
                  </div>

                  {/* Chips de eventos */}
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {dayEvs.slice(0, 3).map(m => {
                      const cat = getCat(m.category)
                      const color = m.color ?? cat.color
                      return (
                        <div key={m.id}
                          onClick={e=>{ e.stopPropagation(); setSelMile(m) }}
                          style={{ padding:'2px 6px', borderRadius:5, background:color+'22', borderLeft:`3px solid ${color}`, fontSize:9, fontWeight:700, color:color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', transition:'opacity .15s' }}
                          title={m.title}
                          onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
                          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                          {cat.label.split(' ')[0]} {m.title}
                        </div>
                      )
                    })}
                    {dayEvs.length > 3 && (
                      <span style={{ fontSize:9, color:'var(--muted-foreground)', padding:'0 4px' }}>+{dayEvs.length-3} mais</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel lateral */}
        <div style={{ display:'flex', flexDirection:'column', gap:12, position:'sticky', top:80 }}>

          {/* Legenda de categorias */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'14px 16px' }}>
            <p style={{ fontSize:10, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.1em', margin:'0 0 10px' }}>Categorias</p>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {CATEGORIES.map(cat => {
                const count = visible.filter(m => m.category === cat.value && spansMilestone(m, year, month, ...(selDay ? [selDay] : [today.getDate()]) as [number])).length
                return (
                  <div key={cat.value} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:cat.color, flexShrink:0 }}/>
                    <span style={{ fontSize:11, color:'var(--foreground)', flex:1 }}>{cat.label}</span>
                    {count > 0 && <span style={{ fontSize:10, fontWeight:700, color:cat.color, background:cat.color+'22', padding:'1px 6px', borderRadius:999 }}>{count}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Eventos do dia / próximos */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg,rgba(99,102,241,.06),transparent)' }}>
              <p style={{ fontSize:10, fontWeight:800, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'.1em', margin:'0 0 2px' }}>
                {selDay ? `${selDay} de ${MONTHS_PT[month]}` : 'Próximos eventos'}
              </p>
              <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>
                {selDay ? `${dayEvents.length} evento${dayEvents.length!==1?'s':''}` : `${upcoming.length} próximos`}
              </p>
            </div>

            <div style={{ maxHeight:400, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
              {(selDay ? dayEvents : upcoming).map(m => {
                const cat   = getCat(m.category)
                const color = m.color ?? cat.color
                return (
                  <motion.div key={m.id}
                    initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
                    whileHover={{ scale:1.01 }}
                    onClick={()=>setSelMile(m)}
                    style={{ background:color+'0e', border:`1px solid ${color}33`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:'10px 12px', cursor:'pointer', transition:'all .15s' }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:14 }}>{cat.label.split(' ')[0]}</span>
                      <span style={{ fontSize:9, fontWeight:800, color:color, textTransform:'uppercase', letterSpacing:'.06em' }}>{cat.label.replace(/^\S+\s/,'')}</span>
                      {m.priority === 'high' && <span style={{ fontSize:9, color:'#ef4444', fontWeight:700 }}>🔴 Alta</span>}
                    </div>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--foreground)', margin:'0 0 4px', lineHeight:1.3 }}>{m.title}</p>
                    <p style={{ fontSize:10, color:'var(--muted-foreground)', margin:0 }}>
                      {fmtDate(m.start_at)}{m.end_at && m.end_at !== m.start_at ? ` → ${fmtDate(m.end_at)}` : ''}
                    </p>
                  </motion.div>
                )
              })}
              {(selDay ? dayEvents : upcoming).length === 0 && (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted-foreground)' }}>
                  <Calendar size={24} style={{ margin:'0 auto 8px', opacity:.3 }}/>
                  <p style={{ fontSize:12, margin:0 }}>{selDay ? 'Nenhum evento neste dia' : 'Sem eventos próximos'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      <AnimatePresence>
        {selMile && (
          <MilestoneDetail key="detail" m={selMile} onClose={()=>setSelMile(null)} isAdmin={isAdmin}
            onEdit={()=>{ setEditMile(selMile); setSelMile(null); setShowForm(true) }}
            onDelete={()=>{ if(confirm(`Excluir "${selMile.title}"?`)) handleDelete(selMile.id) }}
          />
        )}
        {showForm && (
          <MilestoneForm key="form"
            initial={
              editMile
                ? { ...editMile, start_at: editMile.start_at.slice(0,16), end_at: editMile.end_at?.slice(0,16)??'' }
                : prefilledDate
                  ? { start_at: prefilledDate }
                  : undefined
            }
            onSave={handleSave}
            onClose={()=>{ setShowForm(false); setEditMile(null); setPrefilledDate(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
