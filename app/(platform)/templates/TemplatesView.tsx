'use client'
import { useState } from 'react'
import { Plus, X, Copy, Check, Pencil, Trash2, Search, ChevronDown } from 'lucide-react'

interface Template {
  id: string
  name: string
  hubspot_name: string | null
  content: string
  team: string
  variables: string[]
  is_active: boolean
  created_at: string
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\$\{([^}]+)\}/g) ?? []
  return [...new Set(matches.map(m => m.slice(2, -1)))]
}

function renderContent(content: string) {
  const parts = content.split(/(\$\{[^}]+\})/g)
  return parts.map((part, i) => {
    if (part.startsWith('${') && part.endsWith('}')) {
      return <span key={i} className="var-badge">{part}</span>
    }
    return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
  })
}

const teamColors: Record<string, { bg: string; text: string; border: string }> = {
  OAO:   { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  R1:    { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
  ambos: { bg: 'rgba(34,197,94,0.08)',  text: '#22c55e', border: 'rgba(34,197,94,0.2)' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}

export function TemplatesView({ templates: initial, isAdmin, userTeam }: {
  templates: Template[]; isAdmin: boolean; userTeam?: string
}) {
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({ name: '', hubspot_name: '', content: '', team: 'ambos' })

  const filtered = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
    const matchTeam = filterTeam === 'todos' || t.team === filterTeam
    return matchSearch && matchTeam
  })

  function openCreate() {
    setEditingTemplate(null)
    setForm({ name: '', hubspot_name: '', content: '', team: 'ambos' })
    setModalOpen(true)
  }

  function openEdit(t: Template) {
    setEditingTemplate(t)
    setForm({ name: t.name, hubspot_name: t.hubspot_name ?? '', content: t.content, team: t.team })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.content.trim()) return
    setSaving(true)
    const vars = extractVariables(form.content)
    const payload = { ...form, variables: vars, id: editingTemplate?.id }

    const res = await fetch('/api/templates', {
      method: editingTemplate ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      if (editingTemplate) {
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...form, variables: vars } : t))
      } else {
        setTemplates(prev => [{ ...data.template }, ...prev])
      }
      setModalOpen(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await fetch('/api/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setTemplates(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
    setSaving(false)
  }

  function copyContent(t: Template) {
    navigator.clipboard.writeText(t.content)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="page-wrap" style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Templates de Disparo
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-brand"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={15} /> Novo template
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar template..."
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['todos', 'OAO', 'R1', 'ambos'].map(t => (
            <button key={t} onClick={() => setFilterTeam(t)}
              style={{ height: 42, padding: '0 16px', borderRadius: 10, border: '1.5px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                background: filterTeam === t ? 'var(--foreground)' : 'transparent',
                color: filterTeam === t ? 'var(--card)' : 'var(--muted-foreground)',
                borderColor: filterTeam === t ? 'var(--foreground)' : 'var(--border)',
              }}>
              {t === 'todos' ? 'Todos' : t === 'ambos' ? 'Ambos' : `Time ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de templates */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>Nenhum template encontrado</p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{isAdmin ? 'Crie o primeiro template clicando no botão acima.' : 'Nenhum template disponível para o seu time.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(t => {
            const tc = teamColors[t.team] ?? teamColors.ambos
            const isDeleting = deletingId === t.id
            return (
              <div key={t.id} className="card-glow" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Barra de cor */}
                <div style={{ height: 3, background: t.team === 'OAO' ? 'linear-gradient(90deg,#3b82f6,#4f46e5)' : t.team === 'R1' ? 'linear-gradient(90deg,#8b5cf6,#a855f7)' : 'linear-gradient(90deg,#22c55e,#16a34a)' }} />

                {isDeleting ? (
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <p style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', margin: 0 }}>
                      Excluir <strong>"{t.name}"</strong>? Não pode ser desfeito.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setDeletingId(null)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                      <button onClick={() => handleDelete(t.id)} disabled={saving} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {saving ? '...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '16px 20px' }}>
                    {/* Header do card */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{t.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                            {t.team === 'ambos' ? 'Ambos' : `Time ${t.team}`}
                          </span>
                          {!t.is_active && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>Inativo</span>
                          )}
                        </div>
                        {t.hubspot_name && (
                          <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>HubSpot: <code style={{ background: 'var(--secondary)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{t.hubspot_name}</code></p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => copyContent(t)} title="Copiar conteúdo"
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: copiedId === t.id ? 'rgba(34,197,94,0.1)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copiedId === t.id ? '#22c55e' : 'var(--muted-foreground)', transition: 'all 0.15s' }}>
                          {copiedId === t.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(t)} title="Editar"
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = 'var(--foreground)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}>
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeletingId(t.id)} title="Excluir"
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Variáveis */}
                    {t.variables?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {t.variables.map(v => (
                          <span key={v} className="var-badge">${`{${v}}`}</span>
                        ))}
                      </div>
                    )}

                    {/* Conteúdo */}
                    <div style={{ background: 'var(--secondary)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--foreground)', lineHeight: 1.65, maxHeight: 160, overflowY: 'auto' }}>
                      {renderContent(t.content)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 28, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                {editingTemplate ? 'Editar template' : 'Novo template'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome do template *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Boas-vindas Lead Quente" style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome no HubSpot</label>
                <input value={form.hubspot_name} onChange={e => setForm(f => ({ ...f, hubspot_name: e.target.value }))} placeholder="Ex: template_boas_vindas_lead" style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>Nome exato do template no HubSpot para referência.</p>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['OAO', 'R1', 'ambos'].map(team => (
                    <button key={team} type="button" onClick={() => setForm(f => ({ ...f, team }))}
                      style={{ flex: 1, height: 40, borderRadius: 9, border: '1.5px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        background: form.team === team ? 'var(--foreground)' : 'transparent',
                        color: form.team === team ? 'var(--card)' : 'var(--muted-foreground)',
                        borderColor: form.team === team ? 'var(--foreground)' : 'var(--border)',
                      }}>
                      {team === 'ambos' ? 'Ambos' : `Time ${team}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Conteúdo da mensagem *
                </label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={8}
                  placeholder={`Ex: Olá, \${nome}! Tudo bem?\n\nAqui é o \${consultor} da MedReview. Vi que você tem interesse em \${produto}...`}
                  style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.65, fontFamily: 'inherit' }} />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                  Use <code style={{ background: 'var(--secondary)', padding: '1px 5px', borderRadius: 4 }}>{'${variavel}'}</code> para inserir variáveis dinâmicas.
                </p>

                {/* Preview de variáveis detectadas */}
                {form.content && extractVariables(form.content).length > 0 && (
                  <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>Variáveis detectadas:</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {extractVariables(form.content).map(v => (
                        <span key={v} className="var-badge">${`{${v}}`}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button onClick={() => setModalOpen(false)} style={{ flex: 1, height: 44, borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.content.trim()} className="btn-brand"
                  style={{ flex: 1, height: 44, borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !form.name.trim() || !form.content.trim() ? 0.6 : 1 }}>
                  {saving ? 'Salvando...' : editingTemplate ? 'Salvar alterações' : 'Criar template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
