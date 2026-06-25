'use client'
import { useState } from 'react'
import { X, Send, Lightbulb } from 'lucide-react'

interface Props {
  stepId:    string
  dayNumber: number | null
  stepTitle: string
  onClose:   () => void
  onSaved:   () => void
}

export function InsightModal({ stepId, dayNumber, stepTitle, onClose, onSaved }: Props) {
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)

  async function save() {
    if (!content.trim()) return
    setSaving(true)
    try {
      await fetch('/api/insights', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ step_id: stepId, day_number: dayNumber, insight_type: 'step', content }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:480, boxShadow:'0 24px 60px rgba(0,0,0,.3)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#312e81,#4f46e5)', padding:'20px 24px', color:'#fff', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Lightbulb size={18}/>
            </div>
            <div>
              <p style={{ fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.65)', margin:'0 0 2px' }}>
                {dayNumber ? `Dia ${dayNumber} — Concluído!` : 'Etapa Concluída!'}
              </p>
              <p style={{ fontSize:15, fontWeight:800, margin:0 }}>Qual foi sua sugestão?</p>
            </div>
          </div>
          <button onClick={onClose} style={{ position:'absolute', top:16, right:16, width:30, height:30, borderRadius:8, border:'1px solid rgba(255,255,255,.2)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
            <X size={14}/>
          </button>
        </div>

        <div style={{ padding:'20px 24px' }}>
          <p style={{ fontSize:13, color:'var(--muted-foreground)', margin:'0 0 14px', lineHeight:1.6 }}>
            Você acabou de concluir <strong style={{ color:'var(--foreground)' }}>{stepTitle}</strong>. 
            Compartilhe seu principal aprendizado ou reflexão deste dia.
          </p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            autoFocus
            placeholder="Ex: Aprendi que é fundamental entender a dor do cliente antes de apresentar a solução..."
            style={{ width:'100%', minHeight:100, padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', fontSize:13, resize:'vertical', outline:'none', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box', transition:'border-color .15s' }}
            onFocus={e => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.12)' }}
            onBlur={e  => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }}
          />
          <p style={{ fontSize:11, color:'var(--muted-foreground)', margin:'6px 0 16px', textAlign:'right' }}>{content.length} caracteres</p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose}
              style={{ flex:1, height:44, borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'var(--muted-foreground)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Pular
            </button>
            <button onClick={save} disabled={!content.trim() || saving}
              style={{ flex:2, height:44, borderRadius:11, border:'none', background: content.trim() ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--secondary)', color: content.trim() ? '#fff' : 'var(--muted-foreground)', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .15s' }}>
              <Send size={14}/> {saving ? 'Salvando...' : 'Salvar Sugestão'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
