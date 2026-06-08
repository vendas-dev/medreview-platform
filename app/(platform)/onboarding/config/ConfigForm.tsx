'use client'
import { useState } from 'react'
import { Save, Bot, MessageSquare, Sliders, BookOpen, CheckCircle2 } from 'lucide-react'

interface Settings {
  welcome_message?: string; tone?: string; trail_mode?: string
  extra_instructions?: string; is_active?: boolean
}

const inp: React.CSSProperties = {
  width:'100%', height:44, padding:'0 16px', borderRadius:11,
  border:'1.5px solid var(--border)', background:'var(--background)',
  color:'var(--foreground)', fontSize:14, fontFamily:'inherit', outline:'none',
  transition:'border-color 0.15s, box-shadow 0.15s',
}
const focusHandler = (e: React.FocusEvent<any>) => {
  e.target.style.borderColor = '#6366f1'
  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
}
const blurHandler = (e: React.FocusEvent<any>) => {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}

const tones = [
  { value:'didatico',     label:'Didático e acolhedor',   desc:'Paciente, com exemplos práticos', icon:'📚' },
  { value:'objetivo',     label:'Objetivo e direto',       desc:'Respostas concisas e rápidas',    icon:'⚡' },
  { value:'descontraido', label:'Descontraído e motivador',desc:'Tom informal e amigável',         icon:'😄' },
  { value:'formal',       label:'Formal e profissional',   desc:'Linguagem técnica e precisa',     icon:'💼' },
]

const modes = [
  { value:'livre',      label:'Modo Livre',      desc:'Usuário acessa qualquer etapa na ordem que quiser', icon:'🎯' },
  { value:'sequencial', label:'Modo Sequencial', desc:'Precisa concluir a anterior para avançar',          icon:'📋' },
]

function Section({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: any; children: React.ReactNode }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg,rgba(99,102,241,0.04) 0%,transparent 100%)', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(79,70,229,0.3)' }}>
          <Icon size={17} style={{ color:'#fff' }} />
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:800, color:'var(--foreground)', margin:0 }}>{title}</p>
          <p style={{ fontSize:12, color:'var(--muted-foreground)', margin:0 }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ padding:'20px 24px' }}>{children}</div>
    </div>
  )
}

function OptionCard({ value, selected, onClick, label, desc, icon, color = '#6366f1' }: {
  value: string; selected: boolean; onClick: () => void
  label: string; desc: string; icon: string; color?: string
}) {
  return (
    <div onClick={onClick}
      style={{ padding:'14px 16px', borderRadius:13, border:`1.5px solid ${selected?color+'60':'var(--border)'}`, background:selected?`${color}08`:'transparent', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:12 }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor=color+'30' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor='var(--border)' }}>
      <div style={{ width:38, height:38, borderRadius:10, background:selected?`${color}15`:'var(--secondary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, transition:'all 0.15s' }}>
        {icon}
      </div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13, fontWeight:700, color:selected?'var(--foreground)':'var(--foreground)', margin:'0 0 2px' }}>{label}</p>
        <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:0 }}>{desc}</p>
      </div>
      <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${selected?color:'var(--border)'}`, background:selected?color:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
        {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
    </div>
  )
}

export function ConfigForm({ settings }: { settings: Settings | null }) {
  const s = settings ?? {}
  const [welcome, setWelcome] = useState(s.welcome_message ?? 'Olá! Seja bem-vindo ao onboarding da MedReview. Estou aqui para te ajudar!')
  const [tone, setTone] = useState(s.tone ?? 'didatico')
  const [trailMode, setTrailMode] = useState(s.trail_mode ?? 'livre')
  const [extra, setExtra] = useState(s.extra_instructions ?? '')
  const [isActive, setIsActive] = useState(s.is_active !== false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/onboarding/settings', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ welcome_message:welcome, tone, trail_mode:trailMode, extra_instructions:extra, is_active:isActive }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#3730a3 0%,#4f46e5 50%,#7c3aed 100%)', borderRadius:20, padding:'24px 28px', marginBottom:24, position:'relative', overflow:'hidden', boxShadow:'0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:15, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.2)' }}>
            <Bot size={24} style={{ color:'#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, color:'#fff', margin:'0 0 4px', letterSpacing:'-0.02em' }}>Configuração do Copilot</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.72)', margin:0 }}>Configure o comportamento da IA de onboarding</p>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* Mensagem de boas-vindas */}
        <Section title="Mensagem de boas-vindas" subtitle="Enviada automaticamente no primeiro acesso" icon={MessageSquare}>
          <textarea value={welcome} onChange={e => setWelcome(e.target.value)} rows={4}
            placeholder="Ex: Olá! Bem-vindo ao onboarding da MedReview..."
            style={{ ...inp, height:'auto', padding:'12px 16px', resize:'vertical', lineHeight:1.65 }}
            onFocus={focusHandler} onBlur={blurHandler} />
          <p style={{ fontSize:11, color:'var(--muted-foreground)', marginTop:6 }}>Esta mensagem aparece quando o usuário abre o Copilot pela primeira vez.</p>
        </Section>

        {/* Tom */}
        <Section title="Tom do Copilot" subtitle="Define o estilo de comunicação da IA" icon={Sliders}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {tones.map(t => (
              <OptionCard key={t.value} value={t.value} selected={tone===t.value} onClick={() => setTone(t.value)}
                label={t.label} desc={t.desc} icon={t.icon} />
            ))}
          </div>
        </Section>

        {/* Modo da trilha */}
        <Section title="Modo da Trilha" subtitle="Define como o usuário acessa as etapas" icon={BookOpen}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {modes.map(m => (
              <OptionCard key={m.value} value={m.value} selected={trailMode===m.value} onClick={() => setTrailMode(m.value)}
                label={m.label} desc={m.desc} icon={m.icon} color="#7c3aed" />
            ))}
          </div>
        </Section>

        {/* Instruções extras */}
        <Section title="Instruções adicionais" subtitle="Contexto extra para personalizar as respostas da IA" icon={Bot}>
          <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={5}
            placeholder="Ex: Sempre mencione que somos referência em Residência Médica. Priorize falar sobre diferenciais..."
            style={{ ...inp, height:'auto', padding:'12px 16px', resize:'vertical', lineHeight:1.65 }}
            onFocus={focusHandler} onBlur={blurHandler} />
        </Section>

        {/* Salvar */}
        <button onClick={handleSave} disabled={saving}
          style={{ height:50, borderRadius:13, background:saved?'linear-gradient(135deg,#22c55e,#16a34a)':'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:15, fontWeight:800, border:'none', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', opacity:saving?0.7:1, transition:'all 0.25s', boxShadow:saved?'0 6px 20px rgba(34,197,94,0.35)':'0 6px 20px rgba(79,70,229,0.35)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, letterSpacing:'-0.01em' }}>
          {saved ? <><CheckCircle2 size={18}/> Configurações salvas!</> : saving ? 'Salvando...' : <><Save size={16}/> Salvar configurações</>}
        </button>
      </div>
    </div>
  )
}
