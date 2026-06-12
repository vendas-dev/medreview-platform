'use client'
import { useState } from 'react'
import { Save, Bot, MessageSquare, Sliders, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react'

interface Settings {
  welcome_message?: string; tone?: string; trail_mode?: string
  extra_instructions?: string; is_active?: boolean
}

const inp: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 16px', borderRadius: 11,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxShadow: 'var(--shadow-xs)',
}
const focusH = (e: React.FocusEvent<any>) => {
  e.target.style.borderColor = '#6366f1'
  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
}
const blurH = (e: React.FocusEvent<any>) => {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'var(--shadow-xs, none)'
}

const tones = [
  { value: 'didatico',     label: 'Didático e acolhedor',    desc: 'Paciente, com exemplos práticos', icon: '📚' },
  { value: 'objetivo',     label: 'Objetivo e direto',        desc: 'Respostas concisas e rápidas',    icon: '⚡' },
  { value: 'descontraido', label: 'Descontraído e motivador', desc: 'Tom informal e amigável',         icon: '😄' },
  { value: 'formal',       label: 'Formal e profissional',    desc: 'Linguagem técnica e precisa',     icon: '💼' },
]

const modes = [
  { value: 'livre',      label: 'Modo Livre',      desc: 'Usuário acessa qualquer etapa na ordem que quiser', icon: '🎯' },
  { value: 'sequencial', label: 'Modo Sequencial', desc: 'Precisa concluir a anterior para avançar',          icon: '📋' },
]

function Section({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle: string; icon: any; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--secondary) 60%, var(--card))', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(79,70,229,0.3)', flexShrink: 0 }}>
          <Icon size={16} style={{ color: '#fff' }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ padding: '18px 22px' }}>{children}</div>
    </div>
  )
}

function OptionCard({ value, selected, onClick, label, desc, icon, color = '#6366f1' }: any) {
  return (
    <div onClick={onClick}
      style={{ padding: '13px 15px', borderRadius: 12, border: `1.5px solid ${selected ? color + '55' : 'var(--border)'}`, background: selected ? `${color}0a` : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 11, boxShadow: selected ? `0 2px 8px ${color}20` : 'var(--shadow-xs)' }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = color + '35' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: selected ? `${color}15` : 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 0.15s' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 2px' }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{desc}</p>
      </div>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? color : 'var(--border)'}`, background: selected ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
        {selected && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </div>
    </div>
  )
}

export function ConfigForm({ settings }: { settings: Settings | null }) {
  const s = settings ?? {}
  const [welcome,   setWelcome]   = useState(s.welcome_message ?? 'Olá! Seja bem-vindo ao onboarding da MedReview. Estou aqui para te ajudar!')
  const [tone,      setTone]      = useState(s.tone ?? 'didatico')
  const [trailMode, setTrailMode] = useState(s.trail_mode ?? 'livre')
  const [extra,     setExtra]     = useState(s.extra_instructions ?? '')
  const [isActive,  setIsActive]  = useState(s.is_active !== false)
  const [saving,    setSaving]    = useState(false)
  const [status,    setStatus]    = useState<'idle'|'saved'|'error'>('idle')
  const [errMsg,    setErrMsg]    = useState('')

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/onboarding/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          welcome_message:    welcome,
          tone,
          trail_mode:         trailMode,
          extra_instructions: extra,
          is_active:          isActive,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (err: any) {
      setStatus('error')
      setErrMsg(err.message ?? 'Erro ao salvar')
      setTimeout(() => setStatus('idle'), 6000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 35%,#4f46e5 70%,#7c3aed 100%)', borderRadius: 20, padding: '22px 28px', marginBottom: 22, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
            <Bot size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Configuração do Med.AI</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0 }}>Personalize o assistente de onboarding do seu time</p>
          </div>
        </div>
      </div>

      {/* Feedback de status */}
      {status === 'saved' && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: 0 }}>Configurações salvas com sucesso! O Med.AI já está atualizado.</p>
        </div>
      )}
      {status === 'error' && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', margin: 0 }}>Erro ao salvar: {errMsg}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Section title="Mensagem de boas-vindas" subtitle="Exibida na primeira conversa com o Med.AI" icon={MessageSquare}>
          <textarea value={welcome} onChange={e => setWelcome(e.target.value)} rows={4}
            placeholder="Ex: Olá! Bem-vindo ao onboarding da MedReview..."
            style={{ ...inp, height: 'auto', padding: '12px 16px', resize: 'vertical', lineHeight: 1.65 }}
            onFocus={focusH} onBlur={blurH} />
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>
            Aparece quando o usuário abre o Med.AI pela primeira vez.
          </p>
        </Section>

        <Section title="Tom do Med.AI" subtitle="Define o estilo de comunicação da IA" icon={Sliders}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {tones.map(t => (
              <OptionCard key={t.value} value={t.value} selected={tone === t.value}
                onClick={() => setTone(t.value)} label={t.label} desc={t.desc} icon={t.icon} />
            ))}
          </div>
        </Section>

        <Section title="Modo da Trilha" subtitle="Define como o usuário navega pelas etapas" icon={BookOpen}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {modes.map(m => (
              <OptionCard key={m.value} value={m.value} selected={trailMode === m.value}
                onClick={() => setTrailMode(m.value)} label={m.label} desc={m.desc} icon={m.icon} color="#7c3aed" />
            ))}
          </div>
        </Section>

        <Section title="Instruções adicionais" subtitle="Contexto extra para personalizar as respostas" icon={Bot}>
          <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={5}
            placeholder="Ex: Sempre enfatize os diferenciais da MedReview. Mencione que somos referência em Residência Médica..."
            style={{ ...inp, height: 'auto', padding: '12px 16px', resize: 'vertical', lineHeight: 1.65 }}
            onFocus={focusH} onBlur={blurH} />
        </Section>

        <button onClick={handleSave} disabled={saving}
          style={{
            height: 50, borderRadius: 13, fontSize: 15, fontWeight: 800, border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1, transition: 'all 0.25s',
            background: status === 'saved'
              ? 'linear-gradient(135deg,#22c55e,#16a34a)'
              : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            color: '#fff',
            boxShadow: status === 'saved'
              ? '0 6px 20px rgba(34,197,94,0.35)'
              : '0 6px 20px rgba(79,70,229,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            letterSpacing: '-0.01em',
          }}>
          {status === 'saved'
            ? <><CheckCircle2 size={18} /> Tudo salvo!</>
            : saving
              ? 'Salvando...'
              : <><Save size={16} /> Salvar configurações</>
          }
        </button>
      </div>
    </div>
  )
}
