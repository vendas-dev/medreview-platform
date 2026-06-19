'use client'
import { useState, useMemo, useRef } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  Plus, X, Copy, Check, Pencil, Trash2, Filter,
  Upload, Download, Search, ChevronDown, Sparkles, FileText
} from 'lucide-react'

// ── Configuração de verticais ─────────────────────────────────
const VERTICAL_CONFIG: Record<string, { color: string; bg: string; border: string; emoji: string }> = {
  'Med-Review R1':  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  emoji: '💜' },
  'Anest-Review':   { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  emoji: '💙' },
  'Oft-Review':     { color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   emoji: '💛' },
  'Ortop-Review':   { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',  emoji: '🧡' },
  'Geral':          { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', emoji: '🌐' },
}

const VERTICALS_OAO   = ['Anest-Review', 'Oft-Review', 'Ortop-Review']
const VERTICALS_R1    = ['Med-Review R1']
const VERTICALS_AMBOS = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

// ── Helpers ───────────────────────────────────────────────────
function extractVars(content: string): string[] {
  return [...new Set((content.match(/\$\{([^}]+)\}/g) ?? []).map(m => m.slice(2, -1)))]
}

function renderContent(content: string) {
  const parts = content.split(/(\$\{[^}]+\})/g)
  return parts.map((p, i) =>
    p.startsWith('${') && p.endsWith('}')
      ? <span key={i} className="var-badge">{p}</span>
      : <span key={i}>{p}</span>
  )
}

function VerticalTag({ vertical }: { vertical: string }) {
  const c = VERTICAL_CONFIG[vertical] ?? VERTICAL_CONFIG['Geral']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {c.emoji} {vertical}
    </span>
  )
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

function SS({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inp, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
        onFocus={foc} onBlur={blr}>
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
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
    setLoading(true); setError('')
    const body = { id: template?.id, name, hubspot_name: hubspot, content, team, vertical: verticals }
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
        <div style={{ background: 'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius: '22px 22px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Sparkles size={13} style={{ color: '#fbbf24' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {mode === 'create' ? 'Novo template' : 'Editando template'}
              </span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>
              {mode === 'create' ? 'Criar template de disparo' : name}
            </h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
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
            <CustomSelect value={team} onChange={handleTeamChange}
              options={[
                { value:'ambos', label:'Ambos (todos os times)' },
                { value:'OAO',   label:'Time OAO' },
                { value:'R1',    label:'Time R1' },
              ]} />
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
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 11, border: `1.5px solid ${checked ? c.border : 'var(--border)'}`, background: checked ? c.bg : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? c.color : 'var(--border)'}`, background: checked ? c.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? c.color : 'var(--foreground)' }}>{c.emoji} {v}</span>
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

  const teamColor = t.team === 'OAO' ? '#3b82f6' : t.team === 'R1' ? '#8b5cf6' : '#6366f1'
  const teamBg    = t.team === 'OAO' ? 'rgba(59,130,246,0.1)' : t.team === 'R1' ? 'rgba(139,92,246,0.1)' : 'rgba(99,102,241,0.1)'

  if (deleting) return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: 'var(--shadow-xs)' }}>
      <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{t.name}"</strong>?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setDeleting(false)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={handleDelete} disabled={saving} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'var(--shadow-md)'; el.style.borderColor = teamColor + '35' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'var(--shadow-sm)'; el.style.borderColor = 'var(--border)' }}>

      {/* Linha de cor */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${teamColor},${teamColor}88)` }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
            {t.hubspot_name && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>HubSpot: <em>{t.hubspot_name}</em></p>}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={onEdit} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                <Pencil size={11} />
              </button>
              <button onClick={() => setDeleting(true)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: teamBg, color: teamColor, border: `1px solid ${teamColor}30` }}>
            {t.team === 'ambos' ? 'Ambos' : `Time ${t.team}`}
          </span>
          {(t.vertical ?? []).map((v: string) => <VerticalTag key={v} vertical={v} />)}
          {(t.variables ?? []).length > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
              {t.variables.length} variável{t.variables.length !== 1 ? 'is' : ''}
            </span>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ background: 'var(--secondary)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: expanded ? 'none' : 80, overflow: 'hidden' }}>
            {renderContent(t.content)}
          </p>
          {t.content.length > 200 && (
            <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit' }}>
              {expanded ? 'Ver menos ↑' : 'Ver mais ↓'}
            </button>
          )}
        </div>

        {/* Ações */}
        <button onClick={handleCopy}
          style={{ width: '100%', height: 34, borderRadius: 9, border: 'none', background: copied ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s', boxShadow: copied ? '0 3px 10px rgba(34,197,94,0.3)' : '0 3px 10px rgba(79,70,229,0.25)' }}>
          {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar template</>}
        </button>
      </div>
    </div>
  )
}

// ── Modal de importação CSV ───────────────────────────────────
function CsvImportModal({ onClose, onImported }: { onClose: () => void; onImported: (templates: any[]) => void }) {
  const [preview,  setPreview]  = useState<any[]>([])
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const CSV_TEMPLATE = `Nome do Template,Nome HubSpot,Time,Verticais,Conteúdo
Boas-vindas R1,welcome_r1,R1,Med-Review R1,Olá \${nome}! Seja bem-vindo ao time R1.
Boas-vindas OAO,welcome_oao_anest,OAO,Anest-Review,Olá \${nome}! Bem-vindo à Anest-Review.
Template Geral,template_geral,ambos,,Olá \${nome}! Mensagem para todos os times.`

  function parseCSV(text: string) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) { setError('CSV deve ter cabeçalho e pelo menos uma linha de dados'); return }

    // Ignora a linha de cabeçalho
    const rows = lines.slice(1).map(line => {
      // Parser simples que respeita aspas
      const cols: string[] = []
      let cur = ''; let inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
        else cur += ch
      }
      cols.push(cur.trim())

      const [name, hubspot_name, team, verticaisRaw, ...contentParts] = cols
      const content = contentParts.join(',').replace(/^"|"$/g, '')
      const teamNorm = (team ?? 'ambos').trim()

      let vertical: string[]
      if (teamNorm === 'R1')    vertical = ['Med-Review R1']
      else if (teamNorm === 'ambos') vertical = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
      else vertical = (verticaisRaw ?? '').split(';').map((v: string) => v.trim()).filter(Boolean)

      return { name: name?.trim(), hubspot_name: hubspot_name?.trim(), team: teamNorm, vertical, content: content?.trim() }
    }).filter(r => r.name && r.content)

    if (rows.length === 0) { setError('Nenhuma linha válida encontrada no CSV'); return }
    setPreview(rows); setError('')
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

        <div style={{ background: 'linear-gradient(135deg,#2e1065,#3730a3,#4f46e5)', borderRadius: '22px 22px 0 0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>Importar templates via CSV</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '3px 0 0' }}>Importe várias copys de uma vez</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><X size={14} /></button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Formato */}
          <div style={{ background: 'var(--secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>📋 Formato do CSV</p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '0 0 6px', lineHeight: 1.6 }}>
              Colunas: <strong>Nome do Template, Nome HubSpot, Time, Verticais, Conteúdo</strong><br />
              • <strong>Time:</strong> OAO, R1 ou ambos<br />
              • <strong>Verticais:</strong> separadas por <code style={{ background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>;</code> — ex: <em>Anest-Review;Oft-Review</em><br />
              • R1 e ambos preenchem vertical automaticamente
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
  const [filterVert, setFilterVert] = useState('todos')
  const [modal,      setModal]      = useState<null | 'create' | 'edit' | 'csv'>(null)
  const [editTarget, setEditTarget] = useState<any>(null)

  // Verticais disponíveis para filtro (baseadas no time do usuário)
  const availableVerticalsForFilter = isAdmin
    ? ['todos', 'Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
    : userTeam === 'R1'
      ? ['todos', 'Med-Review R1']
      : userTeam === 'OAO'
        ? ['todos', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
        : ['todos', 'Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

  const filtered = useMemo(() => templates.filter(t => {
    if (search     && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.content.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTeam !== 'todos' && t.team !== filterTeam) return false
    if (filterVert !== 'todos' && !(t.vertical ?? []).includes(filterVert)) return false
    return true
  }), [templates, search, filterTeam, filterVert])

  function handleCreated(t: any)  { setTemplates(prev => [t, ...prev]) }
  function handleUpdated(t: any)  { setTemplates(prev => prev.map(x => x.id === t.id ? t : x)) }
  function handleDeleted(id: string) { setTemplates(prev => prev.filter(x => x.id !== id)) }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 68%,#7c3aed 100%)', borderRadius: 20, padding: 'clamp(18px,3vw,28px)', marginBottom: 22, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'inline-block', marginBottom: 10 }}>
              📋 Biblioteca de Templates
            </span>
            <h1 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.025em' }}>
              Templates de Disparo
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
              {filtered.length} template{filtered.length !== 1 ? 's' : ''} disponíveis
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal('csv')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', backdropFilter: 'blur(8px)', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                <Upload size={14} /> Importar CSV
              </button>
              <button onClick={() => setModal('create')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 18px', borderRadius: 10, background: '#fff', color: '#4f46e5', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,0,0,0.15)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)' }}>
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
          <CustomSelect value={filterTeam} onChange={setFilterTeam} minWidth={155}
            options={[
              { value:'todos', label:'Todos os times' },
              { value:'OAO',   label:'Time OAO' },
              { value:'R1',    label:'Time R1' },
              { value:'ambos', label:'Ambos' },
            ]} />
        )}

        {/* Filtro vertical */}
        <CustomSelect value={filterVert} onChange={setFilterVert} minWidth={180}
          options={availableVerticalsForFilter.map(v => ({ value:v, label: v==='todos'?'Todas as verticais':v }))} />

        {(search || filterTeam !== 'todos' || filterVert !== 'todos') && (
          <button onClick={() => { setSearch(''); setFilterTeam('todos'); setFilterVert('todos') }}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(320px,100%),1fr))', gap: 16 }}>
          {filtered.map(t => (
            <TemplateCard key={t.id} t={t} isAdmin={isAdmin}
              onEdit={() => { setEditTarget(t); setModal('edit') }}
              onDelete={() => handleDeleted(t.id)}
            />
          ))}
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
    </div>
  )
}
