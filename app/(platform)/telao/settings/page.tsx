'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { VERTICAL_LIST } from '@/lib/telao/types'

function pad(n: number) { return String(n).padStart(2,'0') }
function localToday() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function localMonth() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}` }

const MONTHS = [
  {value:'01',label:'Janeiro'},{value:'02',label:'Fevereiro'},{value:'03',label:'Março'},
  {value:'04',label:'Abril'},{value:'05',label:'Maio'},{value:'06',label:'Junho'},
  {value:'07',label:'Julho'},{value:'08',label:'Agosto'},{value:'09',label:'Setembro'},
  {value:'10',label:'Outubro'},{value:'11',label:'Novembro'},{value:'12',label:'Dezembro'},
]

function MonthPicker({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const parts = value.split('-')
  const y = parts[0] ?? String(new Date().getFullYear())
  const m = parts[1] ?? pad(new Date().getMonth()+1)
  const now   = new Date().getFullYear()
  const years = [-2,-1,0,1,2].map(d => ({ value:String(now+d), label:String(now+d) }))
  return (
    <div style={{display:'grid',gridTemplateColumns:'1.8fr 1fr',gap:10}}>
      <CustomSelect value={m} onChange={v=>onChange(`${y}-${v}`)} options={MONTHS} placeholder="Mês"/>
      <CustomSelect value={y} onChange={v=>onChange(`${v}-${m}`)} options={years} placeholder="Ano"/>
    </div>
  )
}

// ── Máscara de moeda ──────────────────────────────────────────
function CurrencyInput({ saved, onSave, accent, disabled }: {
  saved:    string    // valor salvo no banco como string numérica
  onSave:   (v:string)=>Promise<void>
  accent:   string
  disabled: boolean
}) {
  // Estado local independente — não reseta quando goals é recarregado
  const [raw,      setRaw]      = useState(saved)   // dígitos puros
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [focused,  setFocused]  = useState(false)

  // Sincronizar apenas quando o valor salvo externo muda (primeira carga)
  useEffect(() => { setRaw(saved) }, [saved])

  // Formatar: 50000 → "50.000"
  function fmt(digits: string) {
    const n = parseInt(digits || '0')
    if (isNaN(n)) return ''
    return n.toLocaleString('pt-BR')
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Remover tudo que não é dígito
    const digits = e.target.value.replace(/\D/g,'')
    setRaw(digits)
    setDone(false)
  }

  async function handleSave() {
    if (!raw || parseInt(raw) <= 0) return
    setSaving(true)
    await onSave(raw)
    setSaving(false)
    setDone(true)
    setTimeout(()=>setDone(false), 2500)
  }

  async function handleRemove() {
    setSaving(true)
    await onSave('')
    setRaw('')
    setSaving(false)
    setDone(false)
  }

  const hasSaved = !!saved
  const hasValue = !!raw && parseInt(raw) > 0

  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {/* Input com máscara */}
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--muted-foreground)',fontWeight:600,pointerEvents:'none'}}>R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={focused ? raw : fmt(raw)}
          onChange={handleChange}
          onFocus={()=>setFocused(true)}
          onBlur={()=>setFocused(false)}
          onKeyDown={e=>{if(e.key==='Enter') handleSave()}}
          placeholder="0"
          style={{
            width:'100%',height:42,padding:'0 12px 0 36px',borderRadius:10,
            border:`1.5px solid ${hasValue?accent+'66':'var(--border)'}`,
            background:'var(--background)',color:'var(--foreground)',
            fontSize:14,fontFamily:'inherit',outline:'none',
            transition:'border-color .15s,box-shadow .15s',
            fontVariantNumeric:'tabular-nums',
          }}
          onFocusCapture={e=>{e.target.style.borderColor=accent;e.target.style.boxShadow=`0 0 0 3px ${accent}22`}}
          onBlurCapture={e=>{e.target.style.borderColor=hasValue?accent+'66':'var(--border)';e.target.style.boxShadow='none'}}
        />
      </div>

      {/* Botões */}
      <div style={{display:'flex',gap:6}}>
        <button onClick={handleSave} disabled={saving||!hasValue}
          style={{
            flex:1,height:34,borderRadius:9,border:'none',cursor:saving||!hasValue?'not-allowed':'pointer',
            fontFamily:'inherit',fontSize:12,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
            background:done?'rgba(34,197,94,.1)':saving?'rgba(99,102,241,.08)':`linear-gradient(135deg,${accent}cc,${accent})`,
            color:done?'#16a34a':saving?'#6366f1':'#fff',
            opacity:!hasValue?0.4:1,
            boxShadow:done||saving||!hasValue?'none':`0 2px 10px ${accent}44`,
            transition:'all .2s',
          }}>
          {saving ? <><Loader2 size={11} style={{animation:'spin .6s linear infinite'}}/> Salvando...</>
           :done   ? <><CheckCircle2 size={11}/> Salvo!</>
           :         <><Save size={11}/> Salvar</>}
        </button>
        {hasSaved&&(
          <button onClick={handleRemove} disabled={saving} title="Remover meta"
            style={{width:34,height:34,borderRadius:9,border:'1px solid rgba(239,68,68,.25)',background:'rgba(239,68,68,.06)',color:'#ef4444',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Trash2 size={12}/>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function TelaoSettings() {
  const supabase = createClient()
  const [goals,        setGoals]        = useState<any[]>([])
  const [closers,      setClosers]      = useState<any[]>([])
  const [periodType,   setPeriodType]   = useState<'day'|'month'>('day')
  const [selectedDay,  setSelectedDay]  = useState(localToday())
  const [selectedMonth,setSelectedMonth]= useState(localMonth())
  const [closerSaving, setCS]           = useState(false)
  const [msg,          setMsg]          = useState('')

  const periodKey = periodType==='day' ? selectedDay : selectedMonth

  const loadGoals = useCallback(async()=>{
    const {data} = await supabase.from('telao_goals').select('*')
    setGoals(data??[])
  },[])

  useEffect(()=>{
    loadGoals()
    supabase.from('closers').select('*').order('name').then(({data})=>setClosers(data??[]))
  },[])

  function getSaved(vertical: string|null): string {
    const row = goals.find(g=>g.period===periodType&&g.period_key===periodKey&&g.vertical===vertical)
    return row?.target_value?.toString() ?? ''
  }

  // DELETE + INSERT (upsert com null falha no Postgres por NULL != NULL em unique constraint)
  async function saveGoalFn(vertical: string|null, raw: string) {
    if (raw === '') {
      // Remover
      const q = supabase.from('telao_goals').delete().eq('period',periodType).eq('period_key',periodKey)
      vertical === null ? await q.is('vertical',null) : await q.eq('vertical',vertical)
    } else {
      const num = parseInt(raw)
      if (isNaN(num)||num<=0) return
      // Remover existente
      const q = supabase.from('telao_goals').delete().eq('period',periodType).eq('period_key',periodKey)
      vertical===null ? await q.is('vertical',null) : await q.eq('vertical',vertical)
      // Inserir novo
      await supabase.from('telao_goals').insert({period:periodType,period_key:periodKey,vertical,target_value:num})
    }
    await loadGoals()
    if (raw!=='') flash('Meta salva!')
  }

  async function saveCloser(c:any){
    setCS(true)
    if(c.id){ await supabase.from('closers').update({name:c.name,color:c.color,aliases:c.aliases,badge:c.badge}).eq('id',c.id) }
    else{ const norm=c.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9 ]/g,'').trim(); await supabase.from('closers').insert({name:c.name,normalized_name:norm,color:c.color,aliases:c.aliases,badge:c.badge}) }
    const {data}=await supabase.from('closers').select('*').order('name')
    setClosers(data??[]); setCS(false); flash('Closer salvo!')
  }

  async function deleteCloser(id:string){
    await supabase.from('closers').delete().eq('id',id)
    setClosers(p=>p.filter(c=>c.id!==id))
  }

  function flash(t:string){ setMsg(t); setTimeout(()=>setMsg(''),2500) }

  const card: React.CSSProperties = {background:'var(--card)',border:'1px solid var(--border)',borderRadius:18,padding:'20px 22px',marginBottom:20,boxShadow:'0 2px 12px rgba(0,0,0,.05)'}
  const lbl:  React.CSSProperties = {fontSize:10,fontWeight:800,color:'var(--muted-foreground)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.07em'}
  const inp:  React.CSSProperties = {height:42,padding:'0 14px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--background)',color:'var(--foreground)',fontSize:14,fontFamily:'inherit',outline:'none',width:'100%',transition:'border-color .15s'}
  const focusFn=(e:any)=>{e.target.style.borderColor='#6366f1';e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.1)'}
  const blurFn=(e:any)=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none'}

  const allKeys = [
    {k:'geral',label:'Geral',accent:'#6366f1',vertical:null},
    ...VERTICAL_LIST.map(v=>({k:v.id,label:v.short,accent:v.accent,vertical:v.id})),
  ]

  const periodLabel = periodType==='day'
    ? selectedDay.split('-').reverse().join('/')
    : `${MONTHS.find(m=>m.value===selectedMonth.split('-')[1])?.label} de ${selectedMonth.split('-')[0]}`

  return (
    <div style={{padding:'clamp(20px,4vw,40px)',maxWidth:820,margin:'0 auto',minHeight:'100vh'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:28,flexWrap:'wrap'}}>
        <Link href="/telao" style={{display:'flex',alignItems:'center',gap:6,color:'var(--muted-foreground)',textDecoration:'none',fontSize:13}}
          onMouseEnter={e=>e.currentTarget.style.color='var(--foreground)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--muted-foreground)'}>
          <ChevronLeft size={16}/> Voltar ao Telão
        </Link>
        <div style={{flex:1}}/>
        {msg&&<span style={{fontSize:12,color:'#22c55e',fontWeight:700,background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.2)',padding:'4px 12px',borderRadius:999}}>✓ {msg}</span>}
      </div>

      <h1 style={{fontSize:26,fontWeight:900,color:'var(--foreground)',margin:'0 0 24px',letterSpacing:'-.02em'}}>Configurações do Telão</h1>

      {/* ── Toggle Dia / Mês ─────────────────────────────────── */}
      <div style={card}>
        <p style={{fontSize:13,fontWeight:800,color:'#6366f1',textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 16px',display:'flex',alignItems:'center',gap:8}}>
          🎯 Definir meta de:
        </p>
        <div style={{display:'inline-flex',background:'var(--secondary)',borderRadius:12,padding:4,gap:4,marginBottom:20}}>
          {(['day','month'] as const).map(type=>(
            <button key={type} onClick={()=>setPeriodType(type)}
              style={{height:38,padding:'0 24px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'inherit',
                background:periodType===type?'linear-gradient(135deg,#4f46e5,#7c3aed)':'transparent',
                color:periodType===type?'#fff':'var(--muted-foreground)',
                fontSize:13,fontWeight:800,transition:'all .2s',
                boxShadow:periodType===type?'0 2px 10px rgba(79,70,229,.35)':'none'}}>
              {type==='day'?'📅 Dia específico':'📆 Mês inteiro'}
            </button>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            {periodType==='day'
              ?(<><label style={lbl}>Selecione o dia</label><input type="date" value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} style={inp} onFocus={focusFn} onBlur={blurFn}/></>)
              :(<><label style={lbl}>Selecione o mês e ano</label><MonthPicker value={selectedMonth} onChange={setSelectedMonth}/></>)
            }
          </div>
          <div style={{display:'flex',alignItems:'flex-end'}}>
            <div style={{padding:'12px 16px',borderRadius:10,background:'rgba(99,102,241,.06)',border:'1px solid rgba(99,102,241,.15)',width:'100%'}}>
              <p style={{fontSize:11,color:'var(--muted-foreground)',margin:'0 0 4px'}}>Meta para:</p>
              <p style={{fontSize:16,fontWeight:900,color:'#6366f1',margin:0}}>{periodLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Campos de meta ─────────────────────────────────────── */}
      <div style={card}>
        <p style={{fontSize:13,fontWeight:800,color:'var(--foreground)',textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 4px'}}>
          {periodType==='day'?`📅 Meta do Dia — ${periodLabel}`:`📆 Meta do Mês — ${periodLabel}`}
        </p>
        <p style={{fontSize:12,color:'var(--muted-foreground)',margin:'0 0 20px'}}>
          Digite o valor e clique em <strong>Salvar</strong> (ou pressione Enter) para confirmar.
        </p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
          {allKeys.map(({k,label,accent,vertical})=>(
            <div key={k}>
              <label style={{...lbl,color:accent,marginBottom:8}}>{label}</label>
              <CurrencyInput
                key={`${k}-${periodType}-${periodKey}`}
                saved={getSaved(vertical)}
                onSave={(raw)=>saveGoalFn(vertical,raw)}
                accent={accent}
                disabled={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Closers ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <p style={{fontSize:13,fontWeight:800,color:'var(--foreground)',textTransform:'uppercase',letterSpacing:'.08em',margin:0}}>👤 Closers</p>
          <button onClick={()=>setClosers(p=>[...p,{id:null,name:'',color:'#7c3aed',aliases:[],badge:'★'}])}
            style={{display:'flex',alignItems:'center',gap:6,height:34,padding:'0 14px',borderRadius:9,border:'1.5px solid rgba(99,102,241,.3)',background:'rgba(99,102,241,.06)',color:'#6366f1',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            <Plus size={13}/> Novo closer
          </button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {closers.map((c,i)=>(
            <div key={c.id??i} style={{display:'flex',gap:10,alignItems:'flex-end',padding:'12px 14px',background:'var(--secondary)',border:'1px solid var(--border)',borderRadius:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:c.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900,color:'#fff',flexShrink:0}}>
                {c.name.split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase()||'?'}
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Nome</label>
                <input style={inp} value={c.name} onFocus={focusFn} onBlur={blurFn}
                  onChange={e=>setClosers(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/>
              </div>
              <div style={{width:90}}>
                <label style={lbl}>Cor</label>
                <input type="color" value={c.color} onChange={e=>setClosers(p=>p.map((x,j)=>j===i?{...x,color:e.target.value}:x))}
                  style={{width:'100%',height:42,borderRadius:10,border:'1.5px solid var(--border)',background:'transparent',cursor:'pointer',padding:3}}/>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>saveCloser(c)} disabled={closerSaving} style={{width:36,height:42,borderRadius:9,border:'none',background:'rgba(34,197,94,.1)',color:'#16a34a',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Save size={14}/></button>
                {c.id&&<button onClick={()=>deleteCloser(c.id)} style={{width:36,height:42,borderRadius:9,border:'none',background:'rgba(239,68,68,.08)',color:'#ef4444',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={14}/></button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoint */}
      <div style={{...card,borderColor:'rgba(99,102,241,.2)'}}>
        <p style={{fontSize:13,fontWeight:800,color:'#6366f1',textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 10px'}}>🔗 Endpoint de ingestão</p>
        <div style={{background:'var(--secondary)',borderRadius:10,padding:'10px 14px',fontFamily:'monospace',fontSize:13,color:'#6366f1',marginBottom:10}}>POST /api/public/events</div>
        <p style={{fontSize:12,color:'var(--muted-foreground)',margin:0}}>Use <code style={{color:'#6366f1',background:'rgba(99,102,241,.08)',padding:'1px 5px',borderRadius:4}}>closer_hubspot_id</code> para vincular vendas automaticamente.</p>
      </div>
    </div>
  )
}
