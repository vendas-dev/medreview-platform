'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, X, Copy, Check, Pencil, Trash2, Filter,
  Upload, Download, Search, ChevronDown, Sparkles, FileText,
  LayoutGrid, List as ListIcon, ArrowUpDown
} from 'lucide-react'
import { MedyTemplateCoach } from './MedyTemplateCoach'

// ── Configuração de verticais — paleta suave e padronizada ─────
// Tons pastéis de baixa saturação, consistentes entre si — nada de cores
// "gritantes" competindo entre time / vertical / validade.
const VERTICAL_CONFIG: Record<string, { color: string; bg: string }> = {
  'Med-Review R1':  { color: '#7c6ae0', bg: 'rgba(124,106,224,0.09)' },
  'Anest-Review':   { color: '#4d8fd6', bg: 'rgba(77,143,214,0.09)' },
  'Oft-Review':     { color: '#c99a3e', bg: 'rgba(201,154,62,0.09)' },
  'Ortop-Review':   { color: '#d97a4d', bg: 'rgba(217,122,77,0.09)' },
  'Geral':          { color: '#6b7280', bg: 'rgba(107,114,128,0.09)' },
}
// Time — neutro, discreto, não compete com a vertical
const TEAM_BADGE = { color: '#5b6472', bg: 'rgba(91,100,114,0.08)' }
// Validade — uma única cor, consistente pra qualquer valor (2026, Atemporal...)
const VALIDADE_BADGE = { color: '#3f9178', bg: 'rgba(63,145,120,0.09)' }

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 7, background: bg, color, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
      {label}
    </span>
  )
}

const VERTICALS_OAO   = ['Anest-Review', 'Oft-Review', 'Ortop-Review']
const VERTICALS_R1    = ['Med-Review R1']
const VERTICALS_AMBOS = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

const TEMPLATE_CATEGORIES = [
  'Abordagem', 'Tentativa de contato', 'Retomada', 'Follow-up', 'Diagnóstico',
  'Apresentação', 'Objeção', 'Aguardando decisão', 'Aguardando pagamento',
  'Recuperação de pagamento', 'Urgência', 'Nutrição', 'Evento', 'Reativação',
  'Renovação', 'Indicação', 'Encerramento', 'Resgate',
]
const CATEGORY_EMOJI: Record<string,string> = {
  'Abordagem':'👋', 'Tentativa de contato':'📞', 'Retomada':'🔁', 'Follow-up':'📌', 'Diagnóstico':'🩺',
  'Apresentação':'📋', 'Objeção':'🧩', 'Aguardando decisão':'🤔', 'Aguardando pagamento':'⏳',
  'Recuperação de pagamento':'💰', 'Urgência':'🚨', 'Nutrição':'🌱', 'Evento':'🎉', 'Reativação':'🔄',
  'Renovação':'♻️', 'Indicação':'🗣️', 'Encerramento':'🏁', 'Resgate':'🎣',
}

// ── Helpers ───────────────────────────────────────────────────
function extractVars(content: string): string[] {
  return [...new Set((content.match(/\$\{([^}]+)\}/g) ?? []).map(m => m.slice(2, -1)))]
}

function renderContent(content: string) {
  const parts = content.split(/(\$\{[^}]+\})/g)
  return parts.map((p, i) =>
    p.startsWith('${') && p.endsWith('}')
      ? <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 5px', borderRadius: 5, background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontSize: '0.86em', fontWeight: 600, fontFamily: 'ui-monospace, "SF Mono", monospace', border: '1px solid rgba(99,102,241,0.15)' }}>{p}</span>
      : <span key={i}>{p}</span>
  )
}

function VerticalTag({ vertical }: { vertical: string }) {
  const c = VERTICAL_CONFIG[vertical] ?? VERTICAL_CONFIG['Geral']
  return <Badge label={vertical} color={c.color} bg={c.bg} />
}

const inp: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
  display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const foc = (e: React.FocusEvent<any>) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
const blr = (e: React.FocusEvent<any>) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

interface DropOpt { value: string; label: string }
function FilterDropdown({ value, onChange, options, placeholder, minW = 160 }: {
  value: string; onChange:(v:string)=>void; options:DropOpt[]; placeholder?:string; minW?:number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})
  const sel = options.find(o=>o.value===value)

  useEffect(()=>{
    if(!open) return
    const handler = (e:MouseEvent)=>{
      if(ref.current?.contains(e.target as Node)) return
      if(btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return ()=>document.removeEventListener('mousedown', handler)
  },[open])

  function handleOpen(){
    if(!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const dropH = Math.min(options.length*44+8, 300)
    const below = window.innerHeight - r.bottom - 8
    setPos({
      position:'fixed', left:r.left, width:Math.max(r.width,minW), zIndex:9999,
      ...(below < dropH && r.top > dropH ? {bottom:window.innerHeight-r.top+4} : {top:r.bottom+4}),
    })
    setOpen(o=>!o)
  }

  const active = !!value && value !== 'todos' && value !== ''
  return (
    <div style={{position:'relative'}}>
      <button ref={btnRef} type="button" onClick={handleOpen}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          height:38, padding:'0 12px 0 14px', borderRadius:10, cursor:'pointer',
          border:`1.5px solid ${open?'#6366f1':active?'rgba(99,102,241,.4)':'var(--border)'}`,
          background: open?'color-mix(in srgb,rgba(99,102,241,.07),var(--background))':
                      active?'color-mix(in srgb,rgba(99,102,241,.04),var(--background))':'var(--background)',
          color: active?'var(--foreground)':'var(--muted-foreground)',
          fontSize:13, fontWeight:active?600:400, fontFamily:'inherit',
          minWidth:minW, whiteSpace:'nowrap',
          boxShadow: open?'0 0 0 3px rgba(99,102,241,.1)':'none',
          transition:'all .15s',
        }}>
        <span style={{flex:1,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis'}}>
          {sel?.label ?? placeholder ?? 'Selecionar...'}
        </span>
        <svg style={{flexShrink:0,color:open||active?'#6366f1':'var(--muted-foreground)',
          transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && typeof document!=='undefined' && (
        <div ref={ref} style={{...pos, background:'var(--card)', border:'1.5px solid rgba(99,102,241,.2)',
          borderRadius:13, boxShadow:'0 16px 48px rgba(0,0,0,.15),0 4px 12px rgba(99,102,241,.1)',
          overflow:'hidden', maxHeight:300, overflowY:'auto'}}>
          <style>{`@keyframes fdDrop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div style={{animation:'fdDrop .15s ease'}}>
          {options.map((opt,i)=>{
            const isS = opt.value===value
            return (
              <button key={opt.value} type="button"
                onClick={()=>{onChange(opt.value);setOpen(false)}}
                style={{
                  width:'100%', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                  background:isS?'linear-gradient(135deg,rgba(99,102,241,.1),rgba(124,58,237,.07))':'transparent',
                  border:'none', borderBottom:i<options.length-1?'1px solid color-mix(in srgb,var(--border) 50%,transparent)':'none',
                  cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                  fontSize:13, fontWeight:isS?700:400, color:isS?'#6366f1':'var(--foreground)',
                  transition:'background .1s',
                }}
                onMouseEnter={e=>{if(!isS)(e.currentTarget as HTMLElement).style.background='color-mix(in srgb,rgba(99,102,241,.07),transparent)'}}
                onMouseLeave={e=>{if(!isS)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                <span>{opt.label}</span>
                {isS && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de criação/edição ───────────────────────────────────
function TemplateModal({ mode, template, onClose, onSaved }: {
  mode: 'create' | 'edit'; template?: any
  onClose: () => void; onSaved: (t: any) => void
}) {
  const [name,       setName]       = useState(template?.name ?? '')
  const [hubspot,    setHubspot]    = useState(template?.hubspot_name ?? '')
  const [content,    setContent]    = useState(template?.content ?? '')
  const [team,       setTeam]       = useState(template?.team ?? 'ambos')
  const [categoria,  setCategoria]  = useState(template?.categoria ?? '')
  const [validade,   setValidade]   = useState(template?.validade ?? '')
  const [utilidade,  setUtilidade]  = useState(template?.utilidade ?? '')
  const [verticals,  setVerticals]  = useState<string[]>(template?.vertical ?? [])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  // Verticais disponíveis baseadas no time
  const availableVerticals = team === 'R1' ? VERTICALS_R1 : team === 'OAO' ? VERTICALS_OAO : VERTICALS_AMBOS

  function handleTeamChange(t: string) {
    setTeam(t)
    if (t === 'R1')    setVerticals(['Med-Review R1'])
    if (t === 'ambos') setVerticals([...VERTICALS_AMBOS])
    if (t === 'OAO')   setVerticals([])
  }

  function toggleVertical(v: string) {
    setVerticals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  const vars = extractVars(content)

  async function handleSave() {
    if (!name.trim() || !content.trim()) { setError('Nome e conteúdo são obrigatórios'); return }
    if (!categoria) { setError('Selecione uma categoria'); return }
    setLoading(true); setError('')
    const body = { id: template?.id, name, hubspot_name: hubspot, content, team, vertical: verticals, categoria, validade, utilidade }
    const res  = await fetch('/api/templates', {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }
    onSaved(data.template)
    onClose()
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div className="tpl-modal-hdr" style={{ borderRadius: '22px 22px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Sparkles size={13} style={{ color: '#d97706' }} className="tpl-modal-hdr-sparkle" />
              <span className="tpl-modal-hdr-eyebrow" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {mode === 'create' ? 'Novo template' : 'Editando template'}
              </span>
            </div>
            <h2 className="tpl-modal-hdr-title" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {mode === 'create' ? 'Criar template de disparo' : name}
            </h2>
          </div>
          <button onClick={onClose} className="tpl-modal-hdr-close" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {error}</p></div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Nome do template *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boas-vindas R1" style={inp} onFocus={foc} onBlur={blr} />
            </div>
            <div>
              <label style={lbl}>Nome no HubSpot</label>
              <input value={hubspot} onChange={e => setHubspot(e.target.value)} placeholder="Nome exato no HubSpot" style={inp} onFocus={foc} onBlur={blr} />
            </div>
          </div>

          {/* Time */}
          <div>
            <label style={lbl}>Time *</label>
            <FilterDropdown value={team} onChange={handleTeamChange}
              options={[
                {value:'ambos',label:'✨ Ambos os times'},
                {value:'OAO', label:'🔵 Time OAO'},
                {value:'R1',  label:'🟣 Time R1'},
              ]}/>
          </div>

          {/* Categoria */}
          <div>
            <label style={lbl}>Categoria * {!categoria && <span style={{color:'#ef4444',fontWeight:800}}>— obrigatório</span>}</label>
            <FilterDropdown value={categoria} onChange={setCategoria} placeholder="Selecione a categoria..."
              options={[{value:'',label:'— Selecione a categoria...'},...TEMPLATE_CATEGORIES.map(cat=>({value:cat,label:`${CATEGORY_EMOJI[cat]} ${cat}`}))]}/>
          </div>

          {/* Validade */}
          <div>
            <label style={lbl}>Validade</label>
            <input value={validade} onChange={e => setValidade(e.target.value)} placeholder="Ex: Atemporal, 2026, Março 2027..." style={inp} onFocus={foc} onBlur={blr} />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '5px 0 0' }}>Texto livre — vira uma opção de filtro automaticamente quando salvo.</p>
          </div>

          {/* Utilidade — quando usar essa copy */}
          <div>
            <label style={lbl}>Utilidade (quando usar)</label>
            <textarea value={utilidade} onChange={e => setUtilidade(e.target.value)} rows={3}
              placeholder="Ex: Use quando o cliente já demonstrou interesse mas está indeciso sobre o pagamento..."
              style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit' }}
              onFocus={foc} onBlur={blr} />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '5px 0 0' }}>Aparece como um texto expansível no card, pra quem quiser entender o contexto de uso.</p>
          </div>
          {/* Verticais */}
          <div>
            <label style={lbl}>Vertical *</label>
            {team === 'R1' ? (
              <div style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--secondary)', fontSize: 13, color: 'var(--muted-foreground)' }}>
                💜 <strong>Med-Review R1</strong> — selecionada automaticamente
              </div>
            ) : team === 'ambos' ? (
              <div style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--secondary)', fontSize: 13, color: 'var(--muted-foreground)' }}>
                🌐 <strong>Todas as verticais</strong> — selecionadas automaticamente
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {VERTICALS_OAO.map(v => {
                  const c = VERTICAL_CONFIG[v]
                  const checked = verticals.includes(v)
                  return (
                    <label key={v} onClick={() => toggleVertical(v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 11, border: `1.5px solid ${checked ? c.color + '50' : 'var(--border)'}`, background: checked ? c.bg : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? c.color : 'var(--border)'}`, background: checked ? c.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? c.color : 'var(--foreground)' }}>{v}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Conteúdo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Conteúdo *</label>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Use <code style={{ background: 'var(--secondary)', padding: '1px 5px', borderRadius: 4 }}>${'{variavel}'}</code> para variáveis</span>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={8}
              placeholder={'Olá, ${nome}!\n\nSua mensagem aqui...'}
              style={{ ...inp, height: 'auto', padding: '12px 14px', resize: 'vertical', lineHeight: 1.65, fontFamily: 'inherit' }}
              onFocus={foc} onBlur={blr} />
            {vars.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Variáveis:</span>
                {vars.map(v => <span key={v} className="var-badge">${'{' + v + '}'}</span>)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={loading}
              style={{ flex: 2, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
              {loading ? 'Salvando...' : mode === 'create' ? '+ Criar template' : '✓ Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de template ──────────────────────────────────────────
function TemplateCard({ t, isAdmin, onEdit, onDelete }: { t: any; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const [copied,   setCopied]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showUtilidade, setShowUtilidade] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(t.content)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    setSaving(true)
    await fetch('/api/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
    onDelete()
    setSaving(false)
  }

  if (deleting) return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: 'var(--shadow-xs)' }}>
      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{t.name}"</strong>?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setDeleting(false)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={handleDelete} disabled={saving} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
      </div>
    </div>
  )

  const CARD_HEIGHT = 296 // altura fixa no estado padrão — grid sempre simétrico

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, transition: 'border-color 0.15s', padding: '16px 18px', display: 'flex', flexDirection: 'column', height: expanded || showUtilidade ? 'auto' : CARD_HEIGHT }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>

      {/* Badges — verticais e validade */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {(t.vertical ?? []).slice(0, 3).map((v: string) => <VerticalTag key={v} vertical={v} />)}
        {(t.vertical ?? []).length > 3 && <Badge label={`+${t.vertical.length - 3}`} color={TEAM_BADGE.color} bg={TEAM_BADGE.bg} />}
        {t.validade && <Badge label={t.validade} color={VALIDADE_BADGE.color} bg={VALIDADE_BADGE.bg} />}
      </div>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <p style={{ flex: 1, fontSize: 15, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{t.name}</p>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button onClick={onEdit} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--foreground)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
              <Pencil size={11} />
            </button>
            <button onClick={() => setDeleting(true)} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Quando utilizar — expansível, opcional */}
      {t.utilidade && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => setShowUtilidade(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>Quando utilizar</span>
            <ChevronDown size={10} style={{ color: '#6366f1', transform: showUtilidade ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {showUtilidade && (
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', margin: '6px 0 0', lineHeight: 1.55 }}>{t.utilidade}</p>
          )}
        </div>
      )}

      {/* Conteúdo — altura mínima garantida, nunca encolhe abaixo do necessário */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 10, flexShrink: 0, minHeight: expanded ? 'auto' : 92 }}>
        <p style={{
          fontSize: 12.5, color: 'var(--foreground)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          maxHeight: expanded ? 'none' : 60, overflow: 'hidden',
        }}>
          {renderContent(t.content)}
        </p>
        {t.content.length > 180 && (
          <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0', fontFamily: 'inherit' }}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>

      {/* Ação — mais discreta, sem gradiente chamativo */}
      <button onClick={handleCopy}
        style={{ width: '100%', height: 34, borderRadius: 10, border: `1.5px solid ${copied ? '#22c55e' : 'var(--border)'}`, background: copied ? 'rgba(34,197,94,0.08)' : 'transparent', color: copied ? '#16a34a' : 'var(--foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s', flexShrink: 0 }}
        onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = '#6366f1' }}
        onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
        {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
      </button>
    </div>
  )
}

// ── Modal de importação CSV ───────────────────────────────────
// ── Linha de template — visualização em lista, compacta pra escanear ──
function TemplateRow({ t, isAdmin, onEdit, onDelete }: { t: any; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const [copied,   setCopied]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [expanded,   setExpanded]   = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(t.content)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    await fetch('/api/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
    onDelete()
  }

  if (confirming) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(239,68,68,0.04)' }}>
      <p style={{ flex: 1, fontSize: 12.5, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{t.name}"</strong>?</p>
      <button onClick={() => setConfirming(false)} style={{ height: 26, padding: '0 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
      <button onClick={handleDelete} style={{ height: 26, padding: '0 10px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
    </div>
  )

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
        <ChevronDown size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        <p style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: '1 1 260px' }}>
          {(t.vertical ?? []).slice(0, 4).map((v: string) => <VerticalTag key={v} vertical={v} />)}
          {t.validade && <Badge label={t.validade} color={VALIDADE_BADGE.color} bg={VALIDADE_BADGE.bg} />}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={handleCopy}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${copied ? '#22c55e' : 'var(--border)'}`, background: copied ? 'rgba(34,197,94,0.08)' : 'transparent', color: copied ? '#16a34a' : 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
            title="Copiar">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          {isAdmin && (
            <>
              <button onClick={onEdit} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
                <Pencil size={13} />
              </button>
              <button onClick={() => setConfirming(true)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo — aparece abaixo da linha quando expandida */}
      {expanded && (
        <div style={{ padding: '16px 20px 22px 39px', background: 'var(--secondary)', borderTop: '1px solid var(--border)' }}>
          {t.utilidade && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>Quando utilizar</p>
              <p style={{ fontSize: 12.5, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{t.utilidade}</p>
            </div>
          )}
          <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>Conteúdo</p>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {renderContent(t.content)}
          </p>
        </div>
      )}
    </div>
  )
}

function CsvImportModal({ onClose, onImported }: { onClose: () => void; onImported: (templates: any[]) => void }) {
  const [preview,  setPreview]  = useState<any[]>([])
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const CSV_TEMPLATE = `Nome da Copy,Conteúdo,Time,Vertical,Categoria,Utilidade,Validade
Boas-vindas R1,"Olá \${nome}! Seja bem-vindo ao time R1.",R1,,Abordagem,Use no primeiro contato com um novo lead do R1.,Atemporal
Desconto ex-aluno,"Oi \${nome}! Como você já é ex-aluno, consigo um desconto especial de \${desconto}.",OAO,Anest-Review;Oft-Review,Objeção,Use quando o cliente já é ex-aluno e menciona o preço como barreira.,2026
Template Geral,"Olá \${nome}! Mensagem para todos os times.",Ambos,,Follow-up,Use como retomada padrão após 3 dias sem resposta.,Março 2027`

  // Parser de CSV que lê o arquivo INTEIRO caractere por caractere, em vez
  // de quebrar em linhas primeiro. Isso é essencial: se uma copy tem quebra
  // de linha de verdade dentro do texto (comum em mensagens com parágrafos),
  // ela fica entre aspas no CSV — e só pode ser tratada como "fim de linha"
  // quando está FORA de aspas. Quebrar em '\n' antes de saber isso corta o
  // conteúdo no meio e desalinha todas as colunas das linhas seguintes.
  function parseCSVFull(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let cur = ''
    let inQ = false
    // Remove BOM se existir (comum em CSV exportado do Excel/Sheets)
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++ } // aspas duplas escapadas dentro do campo
          else inQ = false
        } else cur += ch
      } else {
        if (ch === '"') inQ = true
        else if (ch === ',') { row.push(cur); cur = '' }
        else if (ch === '\r') { /* ignora, o \n cuida da quebra */ }
        else if (ch === '\n') {
          row.push(cur); cur = ''
          if (row.some(c => c.trim())) rows.push(row)
          row = []
        } else cur += ch
      }
    }
    // Última linha, se o arquivo não terminar com quebra de linha
    if (cur || row.length) { row.push(cur); if (row.some(c => c.trim())) rows.push(row) }
    return rows
  }

  function parseCSV(text: string) {
    const allRows = parseCSVFull(text)
    if (allRows.length < 2) { setError('CSV deve ter cabeçalho e pelo menos uma linha de dados'); return }

    // Ignora a linha de cabeçalho. Colunas na ordem: Nome da Copy, Conteúdo,
    // Time, Vertical, Categoria, Utilidade, Validade.
    const rows = allRows.slice(1).map(cols => {
      const [name, content, teamRaw, verticaisRaw, categoria, utilidade, validade] = cols.map(c => (c ?? '').trim())
      const teamNorm = normalizeTeam(teamRaw)

      // Vertical: usa a coluna informada quando existir. R1 e "ambos" são
      // preenchidos automaticamente pela API de qualquer forma (mesmo
      // comportamento de sempre), então só importa de verdade pro time OAO.
      const vertical = (verticaisRaw ?? '').split(';').map((v: string) => v.trim()).filter(Boolean)

      return {
        name: name || undefined,
        hubspot_name: name || undefined, // mesmo nome da copy, como você descreveu
        team: teamNorm,
        vertical,
        categoria: categoria || null,
        utilidade: utilidade || null,
        validade: validade || null,
        content: content || undefined,
      }
    }).filter(r => r.name && r.content)

    if (rows.length === 0) { setError('Nenhuma linha válida encontrada no CSV — confira se as colunas estão na ordem certa'); return }
    setPreview(rows); setError('')
  }

  function normalizeTeam(raw?: string): string {
    const t = (raw ?? '').trim().toLowerCase()
    if (t === 'ambos') return 'ambos'
    if (t === 'oao')   return 'OAO'
    if (t === 'r1')    return 'R1'
    return 'ambos' // padrão seguro se vier vazio ou com valor inesperado
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => parseCSV(ev.target?.result as string)
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    setLoading(true)
    const res  = await fetch('/api/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: true, templates: preview }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao importar'); setLoading(false); return }
    onImported(data.templates ?? [])
    onClose()
    setLoading(false)
  }

  function downloadExample() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'templates_exemplo.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 64px rgba(0,0,0,0.25)' }}>

        <div className="tpl-modal-hdr" style={{ borderRadius: '22px 22px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="tpl-modal-hdr-title" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Importar templates via CSV</h2>
            <p className="tpl-modal-hdr-eyebrow" style={{ fontSize: 12, margin: '3px 0 0' }}>Importe várias copys de uma vez</p>
          </div>
          <button onClick={onClose} className="tpl-modal-hdr-close" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Formato */}
          <div style={{ background: 'var(--secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>📋 Formato do CSV</p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 6px', lineHeight: 1.6 }}>
              Colunas, nessa ordem: <strong>Nome da Copy, Conteúdo, Time, Vertical, Categoria, Utilidade, Validade</strong><br />
              • <strong>Nome da Copy:</strong> usado como nome na plataforma e nome no HubSpot (mesmo valor)<br />
              • <strong>Time:</strong> Ambos, OAO ou R1<br />
              • <strong>Vertical:</strong> separadas por <code style={{ background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>;</code> — ex: <em>Anest-Review;Oft-Review</em>. Só importa de verdade pro time OAO — R1 e Ambos são preenchidos automaticamente<br />
              • <strong>Categoria:</strong> use exatamente um dos nomes já existentes na plataforma (ex: Abordagem, Objeção, Follow-up...)<br />
              • <strong>Utilidade:</strong> texto livre, explica quando usar essa copy — aparece expansível no card<br />
              • <strong>Validade:</strong> texto livre (ex: Atemporal, 2026, Março 2027) — vira filtro automaticamente
            </p>
            <button onClick={downloadExample}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={13} /> Baixar exemplo CSV
            </button>
          </div>

          {/* Upload */}
          <div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ width: '100%', height: 56, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'inherit', transition: 'all 0.15s', color: 'var(--muted-foreground)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; e.currentTarget.style.color = '#6366f1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
              <Upload size={18} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{preview.length > 0 ? `${preview.length} templates prontos para importar` : 'Clique para selecionar o arquivo CSV'}</span>
            </button>
          </div>

          {error && <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {error}</p></div>}

          {/* Preview */}
          {preview.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--secondary)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preview — {preview.length} templates
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {preview.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: i < preview.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <FileText size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{t.team}</span>
                        {t.vertical.map((v: string) => <VerticalTag key={v} vertical={v} />)}
                        {t.categoria && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>{t.categoria}</span>}
                        {t.validade && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}>🗓️ {t.validade}</span>}
                        {!t.categoria && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>⚠ sem categoria</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={handleImport} disabled={preview.length === 0 || loading}
              style={{ flex: 2, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: preview.length === 0 || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: preview.length === 0 ? 0.4 : loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
              {loading ? 'Importando...' : `Importar ${preview.length} template${preview.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TemplatesView principal ───────────────────────────────────
interface Props {
  templates: any[]; isAdmin: boolean; userTeam?: string
}

export function TemplatesView({ templates: initial, isAdmin, userTeam }: Props) {
  const [templates,  setTemplates]  = useState(initial)
  const [search,     setSearch]     = useState('')
  const [filterTeam, setFilterTeam] = useState('todos')
  const [filterVert,      setFilterVert]      = useState('todos')
  const [filterCategoria, setFilterCategoria] = useState('todos')
  const [filterValidade,  setFilterValidade]  = useState('todos')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy,   setSortBy]   = useState<'recentes' | 'nome'>('recentes')
  const [modal,      setModal]      = useState<null | 'create' | 'edit' | 'csv'>(null)
  const [editTarget, setEditTarget] = useState<any>(null)

  // Opções de Validade — só as que realmente existem nos templates carregados,
  // nunca uma lista fixa. "Atemporal" sempre primeiro quando presente, resto
  // em ordem alfabética.
  const availableValidades = useMemo(() => {
    const set = new Set<string>()
    templates.forEach(t => { if (t.validade) set.add(t.validade) })
    const arr = [...set]
    arr.sort((a, b) => {
      if (a === 'Atemporal') return -1
      if (b === 'Atemporal') return 1
      return a.localeCompare(b, 'pt-BR')
    })
    return arr
  }, [templates])

  // Verticais disponíveis para filtro (baseadas no time do usuário)
  const availableVerticalsForFilter = isAdmin
    ? ['todos', 'Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
    : userTeam === 'R1'
      ? ['todos', 'Med-Review R1']
      : userTeam === 'OAO'
        ? ['todos', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
        : ['todos', 'Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

  const filtered = useMemo(() => {
    const result = templates.filter(t => {
      if (search     && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.content.toLowerCase().includes(search.toLowerCase())) return false
      if (filterTeam !== 'todos' && t.team !== filterTeam) return false
      if (filterVert     !== 'todos' && !(t.vertical ?? []).includes(filterVert)) return false
      if (filterCategoria !== 'todos' && t.categoria !== filterCategoria) return false
      if (filterValidade  !== 'todos' && t.validade  !== filterValidade)  return false
      return true
    })
    if (sortBy === 'nome') {
      return [...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    }
    // 'recentes' — created_at mais novo primeiro
    return [...result].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
  }, [templates, search, filterTeam, filterVert, filterCategoria, filterValidade, sortBy])

  function handleCreated(t: any)  { setTemplates(prev => [t, ...prev]) }
  function handleUpdated(t: any)  { setTemplates(prev => prev.map(x => x.id === t.id ? t : x)) }
  function handleDeleted(id: string) { setTemplates(prev => prev.filter(x => x.id !== id)) }

  // Agrupamento por categoria — na ordem fixa das categorias, com um grupo
  // "Sem categoria" no fim pra não esconder nada. Só entram grupos com pelo
  // menos 1 resultado após os filtros.
  const groups = useMemo(() => {
    const byCategoria = new Map<string, any[]>()
    filtered.forEach(t => {
      const key = t.categoria ?? '__sem_categoria__'
      if (!byCategoria.has(key)) byCategoria.set(key, [])
      byCategoria.get(key)!.push(t)
    })
    const ordered = [...TEMPLATE_CATEGORIES, '__sem_categoria__']
      .filter(cat => byCategoria.has(cat))
      .map(cat => ({ categoria: cat, items: byCategoria.get(cat)! }))
    return ordered
  }, [filtered])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  function toggleGroup(cat: string) { setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] })) }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: 'clamp(18px,2.4vw,24px) clamp(20px,2.8vw,28px)', marginBottom: 22, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 16px rgba(79,70,229,0.28)' }}>
              <FileText size={21} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 3px', letterSpacing: '-0.02em' }}>
                Templates de Disparo
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', margin: 0 }}>
                {filtered.length} template{filtered.length !== 1 ? 's' : ''} disponíveis · biblioteca de copys para o time comercial
              </p>
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal('csv')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 10, background: 'transparent', color: 'var(--muted-foreground)', border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
                <Upload size={14} /> Importar CSV
              </button>
              <button onClick={() => setModal('create')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(79,70,229,0.3)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(79,70,229,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.3)' }}>
                <Plus size={14} /> Novo template
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', boxShadow: 'var(--shadow-xs)' }}>
        {/* Busca */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar templates..."
            style={{ ...inp, height: 36, paddingLeft: 32, fontSize: 13 }}
            onFocus={foc} onBlur={blr} />
        </div>

        {/* Filtro time (só admin) */}
        {isAdmin && (
          <FilterDropdown value={filterTeam} onChange={setFilterTeam} placeholder="Todos os times"
            options={[
              {value:'todos',label:'👥 Todos os times'},
              {value:'OAO', label:'🔵 Time OAO'},
              {value:'R1',  label:'🟣 Time R1'},
              {value:'ambos',label:'✨ Ambos os times'},
            ]} minW={160}/>
        )}

        {/* Filtro vertical */}
        <FilterDropdown value={filterVert} onChange={setFilterVert} placeholder="Todas as verticais"
          options={availableVerticalsForFilter.map(v=>({
            value:v, label:v==='todos'?'🌐 Todas as verticais':v
          }))} minW={175}/>

        {/* Filtro de categoria */}
        <FilterDropdown value={filterCategoria} onChange={setFilterCategoria} placeholder="📋 Todas as categorias"
          options={[{value:'todos',label:'📋 Todas as categorias'},...TEMPLATE_CATEGORIES.map(cat=>({value:cat,label:`${CATEGORY_EMOJI[cat]} ${cat}`}))]}
          minW={185}/>

        {/* Filtro de validade — só existe se algum template já tiver validade preenchida */}
        {availableValidades.length > 0 && (
          <FilterDropdown value={filterValidade} onChange={setFilterValidade} placeholder="🗓️ Todas as validades"
            options={[{value:'todos',label:'🗓️ Todas as validades'},...availableValidades.map(v=>({value:v,label:v}))]}
            minW={170}/>
        )}

        {/* Ordenação */}
        <FilterDropdown value={sortBy} onChange={v => setSortBy(v as 'recentes' | 'nome')}
          options={[
            {value:'recentes', label:'🕐 Mais recentes'},
            {value:'nome',     label:'🔤 Nome (A-Z)'},
          ]} minW={155}/>

        {/* Alternador Grid / Lista */}
        <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <button onClick={() => setViewMode('grid')}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? 'var(--secondary)' : 'transparent', color: viewMode === 'grid' ? '#6366f1' : 'var(--muted-foreground)' }}
            title="Visualização em grade">
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setViewMode('list')}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderLeft: '1.5px solid var(--border)', cursor: 'pointer', background: viewMode === 'list' ? 'var(--secondary)' : 'transparent', color: viewMode === 'list' ? '#6366f1' : 'var(--muted-foreground)' }}
            title="Visualização em lista">
            <ListIcon size={15} />
          </button>
        </div>

        {(search || filterTeam !== 'todos' || filterVert !== 'todos' || filterCategoria !== 'todos' || filterValidade !== 'todos') && (
          <button onClick={() => { setSearch(''); setFilterTeam('todos'); setFilterVert('todos'); setFilterCategoria('todos'); setFilterValidade('todos') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow-xs)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>Nenhum template encontrado</p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {isAdmin ? 'Crie o primeiro template ou importe via CSV.' : 'Nenhum template disponível para o seu time ainda.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groups.map(({ categoria, items }) => {
            const isSemCategoria = categoria === '__sem_categoria__'
            const isCollapsed = !!collapsed[categoria]
            return (
              <div key={categoria}>
                <button onClick={() => toggleGroup(categoria)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 4px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <ChevronDown size={15} style={{ color: 'var(--muted-foreground)', transform: isCollapsed ? '' : 'rotate(180deg)', transition: 'transform .15s', flexShrink: 0 }} />
                  <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                    {isSemCategoria ? 'Sem categoria' : `${CATEGORY_EMOJI[categoria] ?? ''} ${categoria}`}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500 }}>{items.length}</span>
                </button>
                {!isCollapsed && (
                  viewMode === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(320px,100%),1fr))', gap: 14, padding: '18px 0 8px' }}>
                      {items.map(t => (
                        <TemplateCard key={t.id} t={t} isAdmin={isAdmin}
                          onEdit={() => { setEditTarget(t); setModal('edit') }}
                          onDelete={() => handleDeleted(t.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', margin: '10px 0 8px' }}>
                      {items.map(t => (
                        <TemplateRow key={t.id} t={t} isAdmin={isAdmin}
                          onEdit={() => { setEditTarget(t); setModal('edit') }}
                          onDelete={() => handleDeleted(t.id)}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modais */}
      {modal === 'create' && (
        <TemplateModal mode="create" onClose={() => setModal(null)} onSaved={handleCreated} />
      )}
      {modal === 'edit' && editTarget && (
        <TemplateModal mode="edit" template={editTarget} onClose={() => { setModal(null); setEditTarget(null) }} onSaved={handleUpdated} />
      )}
      {modal === 'csv' && (
        <CsvImportModal onClose={() => setModal(null)} onImported={ts => { ts.forEach(handleCreated) }} />
      )}

      {/* Coach de templates — usa o mesmo array de templates já carregado
          na tela, sem precisar buscar de novo do banco */}
      <MedyTemplateCoach templates={templates} />

      <style>{`
        /* Headers dos modais (criar/editar template, importar CSV) — claro
           por padrão (fundo neutro, texto escuro). .dark restaura o
           gradiente escuro original, ponto a ponto. */
        .tpl-modal-hdr { background: var(--secondary); border-bottom: 1px solid var(--border); }
        .tpl-modal-hdr-title { color: var(--foreground); }
        .tpl-modal-hdr-eyebrow { color: var(--muted-foreground); }
        .tpl-modal-hdr-sparkle { color: #d97706; }
        .tpl-modal-hdr-close { background: var(--card); color: var(--muted-foreground); border: 1px solid var(--border) !important; }
        .tpl-modal-hdr-close:hover { background: var(--border); color: var(--foreground); }

        .dark .tpl-modal-hdr { background: linear-gradient(135deg,#2e1065,#3730a3,#4f46e5); border-bottom: none; }
        .dark .tpl-modal-hdr-title { color: #fff; }
        .dark .tpl-modal-hdr-eyebrow { color: rgba(255,255,255,0.7); }
        .dark .tpl-modal-hdr-sparkle { color: #fbbf24; }
        .dark .tpl-modal-hdr-close { background: rgba(255,255,255,0.12); color: #fff; border: none !important; }
        .dark .tpl-modal-hdr-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
      `}</style>
    </div>
  )
}
