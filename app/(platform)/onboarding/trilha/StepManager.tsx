'use client'
import { useState, useEffect } from 'react'
import { createPortal }        from 'react-dom'
import { Plus, X, Sparkles }   from 'lucide-react'
import { CustomSelect }        from '@/components/ui/CustomSelect'
import { createStep, updateStep } from '../actions'

const inp: React.CSSProperties = {
  width:'100%', height:42, padding:'0 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
  transition:'border-color 0.15s, box-shadow 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:'var(--muted-foreground)',
  display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }

const DAY_OPTIONS      = [{ value:'', label:'— Sem dia' }, ...Array.from({length:15},(_,i)=>({ value:String(i+1), label:`Dia ${i+1}` }))]
const TEAM_OPTIONS     = [{ value:'ambos', label:'👥 Ambos os times' }, { value:'OAO', label:'🔵 Time OAO' }, { value:'R1', label:'🟣 Time R1' }]
const CRITERIA_OPTIONS = [
  { value:'visualizar',       label:'👁 Apenas visualizar'  },
  { value:'materiais',        label:'📚 Concluir materiais' },
  { value:'quiz',             label:'✅ Passar no quiz'      },
  { value:'materiais_e_quiz', label:'📚✅ Materiais + Quiz'  },
]

const motivationalPhrases = [
  'Mais uma etapa, mais um passo rumo ao time perfeito! 🚀',
  'O conhecimento certo na hora certa faz toda diferença. 💡',
  'Monte a trilha ideal e veja seu time decolar! 🎯',
  'Cada etapa bem construída é um vendedor mais preparado. 💪',
]

interface Props { mode: 'create' | 'edit'; step?: any }

export function StepManager({ mode, step }: Props) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [day,      setDay]      = useState(step?.day_number != null ? String(step.day_number) : '')
  const [team,     setTeam]     = useState(step?.team ?? 'ambos')
  const [criteria, setCriteria] = useState(step?.completion_criteria ?? 'visualizar')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      setDay(step?.day_number != null ? String(step.day_number) : '')
      setTeam(step?.team ?? 'ambos')
      setCriteria(step?.completion_criteria ?? 'visualizar')
    }
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  const phrase = motivationalPhrases[Math.floor(Math.random() * motivationalPhrases.length)]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('day_number',          day === '' ? '' : day)
    fd.set('team',                team)
    fd.set('completion_criteria', criteria)
    if (mode === 'create') await createStep(fd)
    else await updateStep(fd)
    setLoading(false)
    setOpen(false)
  }

  const modal = open && mounted ? createPortal(
    <>
      <div onClick={()=>setOpen(false)}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)', zIndex:9998 }}/>
      <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div onClick={e=>e.stopPropagation()}
          style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>

          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius:'22px 22px 0 0', padding:'22px 26px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
            <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <Sparkles size={13} style={{ color:'#fbbf24' }}/>
                  <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {mode==='create' ? 'Nova etapa' : 'Editando etapa'}
                  </span>
                </div>
                <h2 style={{ fontSize:18, fontWeight:900, color:'#fff', margin:'0 0 4px', letterSpacing:'-0.02em' }}>
                  {mode==='create' ? 'Monte mais um passo da jornada! 🗺️' : 'Atualize e deixe ainda mais top! ✨'}
                </h2>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.65)', margin:0 }}>{phrase}</p>
              </div>
              <button onClick={()=>setOpen(false)}
                style={{ width:32, height:32, borderRadius:9, border:'none', background:'rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flexShrink:0 }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.25)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
                <X size={14}/>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding:'24px 26px', display:'flex', flexDirection:'column', gap:16 }}>
            {mode==='edit' && <input type="hidden" name="id" value={step?.id}/>}

            <div>
              <label style={lbl}>Título da etapa *</label>
              <input name="title" required defaultValue={step?.title} placeholder="Ex: Conhecendo a MedReview"
                style={inp} onFocus={foc} onBlur={blr}/>
            </div>

            <div>
              <label style={lbl}>Descrição</label>
              <textarea name="description" defaultValue={step?.description ?? ''} rows={3}
                placeholder="O que o colaborador vai aprender nessa etapa?"
                style={{ ...inp, height:'auto', padding:'10px 14px', resize:'vertical', lineHeight:1.55 }}
                onFocus={foc} onBlur={blr}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>📅 Dia</label>
                <CustomSelect value={day} onChange={setDay} options={DAY_OPTIONS} placeholder="— Sem dia"/>
              </div>
              <div>
                <label style={lbl}>⏱ Tempo (min)</label>
                <input name="estimated_minutes" type="number" defaultValue={step?.estimated_minutes ?? ''}
                  placeholder="30" style={inp} onFocus={foc} onBlur={blr}/>
              </div>
              <div>
                <label style={lbl}>👥 Time</label>
                <CustomSelect value={team} onChange={setTeam} options={TEAM_OPTIONS} placeholder="Selecione"/>
              </div>
            </div>

            <div>
              <label style={lbl}>🎯 Critério de conclusão</label>
              <CustomSelect value={criteria} onChange={setCriteria} options={CRITERIA_OPTIONS} placeholder="Selecione"/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>🏆 Nota mínima no quiz (%)</label>
                <input name="min_quiz_score" type="number" min={0} max={100}
                  defaultValue={step?.min_quiz_score ?? 70} style={inp} onFocus={foc} onBlur={blr}/>
              </div>
              <div>
                <label style={lbl}>🔄 Máx. de tentativas</label>
                <input name="max_attempts" type="number" defaultValue={step?.max_attempts ?? ''}
                  placeholder="Ilimitadas" style={inp} onFocus={foc} onBlur={blr}/>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <button type="button" onClick={()=>setOpen(false)}
                style={{ flex:1, height:46, borderRadius:12, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .12s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--secondary)';e.currentTarget.style.color='var(--foreground)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--muted-foreground)'}}>
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                style={{ flex:2, height:46, borderRadius:12, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:14, fontWeight:800, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', opacity:loading?.7:1, boxShadow:'0 4px 16px rgba(79,70,229,0.35)' }}>
                {loading ? 'Salvando...' : mode==='create' ? '🚀 Criar etapa' : '✓ Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      <button onClick={()=>setOpen(true)}
        style={{ display:'inline-flex', alignItems:'center', gap:7, height:40, padding:'0 18px', borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', boxShadow:'0 4px 14px rgba(79,70,229,0.35)', transition:'all 0.15s' }}
        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(79,70,229,0.45)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 14px rgba(79,70,229,0.35)'}}>
        {mode==='create' ? <><Plus size={14}/> Nova etapa</> : 'Editar etapa'}
      </button>
      {modal}
    </>
  )
}
