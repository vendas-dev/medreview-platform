'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Pencil, Trash2, Upload, FileText, Image as ImageIcon, Video,
  Download, ExternalLink, Play, ChevronDown, LayoutGrid, List as ListIcon,
} from 'lucide-react'

// ── Cada vertical com cor própria — igual pedido: Anest azul, Oft
// amarelo, Ortop laranja, R1 roxo. "Ambos" não é mais uma tag de time,
// vira as 4 tags de vertical juntas (o item vale pra todo mundo).
const VERTICAL_CONFIG: Record<string, { color: string; bg: string }> = {
  'Med-Review R1': { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  'Anest-Review':  { color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  'Oft-Review':    { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
  'Ortop-Review':  { color: '#ea580c', bg: 'rgba(234,88,12,0.1)' },
}
const VERTICALS_OAO   = ['Anest-Review', 'Oft-Review', 'Ortop-Review']
const VERTICALS_AMBOS = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']

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

function VerticalTag({ vertical }: { vertical: string }) {
  const c = VERTICAL_CONFIG[vertical] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.09)' }
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {vertical}
    </span>
  )
}

// ── Dropdown customizado — mesmo padrão elegante já usado em Templates:
// botão com estado visual + painel flutuante animado + hover suave.
interface DropOpt { value: string; label: string }
function FilterDropdown({ value, onChange, options, placeholder, minW = 160 }: {
  value: string; onChange: (v: string) => void; options: DropOpt[]; placeholder: string; minW?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})
  const sel = options.find(o => o.value === value)
  const ACCENT = '#6366f1'

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const dropH = Math.min(options.length * 42 + 8, 300)
    const below = window.innerHeight - r.bottom - 8
    setPos({
      position: 'fixed', left: r.left, width: Math.max(r.width, minW), zIndex: 9999,
      ...(below < dropH && r.top > dropH ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    })
    setOpen(o => !o)
  }

  const active = !!value
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} type="button" onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          height: 38, padding: '0 12px 0 14px', borderRadius: 10, cursor: 'pointer',
          border: `1.5px solid ${open ? ACCENT : active ? ACCENT + '55' : 'var(--border)'}`,
          background: open ? `color-mix(in srgb, ${ACCENT} 7%, var(--background))` : active ? `color-mix(in srgb, ${ACCENT} 4%, var(--background))` : 'var(--background)',
          color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
          minWidth: minW, whiteSpace: 'nowrap',
          boxShadow: open ? `0 0 0 3px ${ACCENT}1a` : 'none',
          transition: 'all .15s',
        }}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel?.label ?? placeholder}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, color: open || active ? ACCENT : 'var(--muted-foreground)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div ref={ref} style={{
          ...pos, background: 'var(--card)', border: `1.5px solid ${ACCENT}33`, borderRadius: 13,
          boxShadow: `0 16px 44px rgba(0,0,0,.16), 0 4px 14px ${ACCENT}22`, overflow: 'hidden', maxHeight: 300, overflowY: 'auto',
        }}>
          <style>{`@keyframes mmDrop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div style={{ animation: 'mmDrop .15s ease' }}>
            {options.map((opt, i) => {
              const isS = opt.value === value
              return (
                <button key={`${i}-${opt.value}`} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
                  style={{
                    width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: isS ? `linear-gradient(135deg, ${ACCENT}1a, #8b5cf61a)` : 'transparent',
                    border: 'none', borderBottom: i < options.length - 1 ? '1px solid color-mix(in srgb, var(--border) 60%, transparent)' : 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: isS ? 700 : 400, color: isS ? ACCENT : 'var(--foreground)', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isS) (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${ACCENT} 6%, transparent)` }}
                  onMouseLeave={e => { if (!isS) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                  {isS && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Extrai o ID de um link do YouTube, pra montar thumbnail e embed ────
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function ItemThumb({ item }: { item: any }) {
  if (item.tipo === 'imagem') {
    return <img src={item.file_url} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  if (item.tipo === 'video' && item.video_source === 'youtube') {
    const yid = youtubeId(item.file_url)
    if (yid) return <img src={`https://img.youtube.com/vi/${yid}/hqdefault.jpg`} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  const Icon = item.tipo === 'pdf' ? FileText : Video
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--secondary)' }}>
      <Icon size={32} style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )
}

function PlayOverlay({ size = 44 }: { size?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Play size={size * 0.4} style={{ color: '#111', marginLeft: 2 }} />
      </div>
    </div>
  )
}

function DeleteConfirm({ nome, onCancel, onConfirm }: { nome: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0 }}>Excluir <strong>"{nome}"</strong>?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={onConfirm} style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
      </div>
    </div>
  )
}

// ── Card (grade) — descrição agora expansível de verdade (medição real
// do DOM, mesmo padrão já corrigido em Templates — nunca corta sem
// mostrar "Ver mais", nunca mostra "Ver mais" à toa).
function MediaCard({ item, isAdmin, onEdit, onDelete }: { item: any; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)
  const [needsExpand, setNeedsExpand] = useState(false)

  useEffect(() => {
    if (descRef.current) setNeedsExpand(descRef.current.scrollHeight > descRef.current.clientHeight + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.descricao])

  async function handleDelete() {
    await fetch('/api/medmidia', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
    onDelete()
  }
  function handleOpen() { window.open(item.file_url, '_blank', 'noopener,noreferrer') }

  if (confirming) return <DeleteConfirm nome={item.nome} onCancel={() => setConfirming(false)} onConfirm={handleDelete} />

  return (
    <div className="mm-card" style={{ background: 'var(--card)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div onClick={handleOpen} style={{ aspectRatio: '16/10', position: 'relative', cursor: 'pointer', overflow: 'hidden' }}>
        <div className="mm-thumb-inner" style={{ width: '100%', height: '100%' }}>
          <ItemThumb item={item} />
        </div>
        {item.tipo === 'video' && <PlayOverlay />}
        <div style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 7, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ExternalLink size={12} style={{ color: '#fff' }} />
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(item.vertical ?? []).map((v: string) => <VerticalTag key={v} vertical={v} />)}
        </div>
        <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.3 }}>{item.nome}</p>
        {item.descricao && (
          <div>
            <p ref={descRef} style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5, maxHeight: expanded ? 'none' : 32, overflow: 'hidden' }}>
              {item.descricao}
            </p>
            {needsExpand && (
              <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 10.5, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit' }}>
                {expanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8 }}>
          <button onClick={handleOpen} style={{ flex: 1, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {item.tipo === 'pdf' ? <Download size={12} /> : <ExternalLink size={12} />} Abrir
          </button>
          {isAdmin && (
            <>
              <button onClick={onEdit} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={12} /></button>
              <button onClick={() => setConfirming(true)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Linha (lista) — imagem bem maior que no card, expande/minimiza pra
// mostrar a descrição completa, mesmo padrão de interação do TemplateRow.
function MediaRow({ item, isAdmin, onEdit, onDelete }: { item: any; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleDelete() {
    await fetch('/api/medmidia', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
    onDelete()
  }
  function handleOpen(e: React.MouseEvent) { e.stopPropagation(); window.open(item.file_url, '_blank', 'noopener,noreferrer') }

  if (confirming) return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 14px' }}>
      <DeleteConfirm nome={item.nome} onCancel={() => setConfirming(false)} onConfirm={handleDelete} />
    </div>
  )

  return (
    <div className="mm-row" style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px', cursor: 'pointer', transition: 'background .12s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

        {/* Imagem bem maior que no card — é o pedido específico da lista */}
        <div onClick={handleOpen} style={{ width: 140, height: 90, borderRadius: 11, overflow: 'hidden', position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
          <div className="mm-thumb-inner" style={{ width: '100%', height: '100%' }}>
            <ItemThumb item={item} />
          </div>
          {item.tipo === 'video' && <PlayOverlay size={34} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
            {(item.vertical ?? []).map((v: string) => <VerticalTag key={v} vertical={v} />)}
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</p>
          {!expanded && item.descricao && (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</p>
          )}
        </div>

        <ChevronDown size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={handleOpen} style={{ height: 34, padding: '0 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            {item.tipo === 'pdf' ? <Download size={13} /> : <ExternalLink size={13} />} Abrir
          </button>
          {isAdmin && (
            <>
              <button onClick={onEdit} style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={13} /></button>
              <button onClick={() => setConfirming(true)} style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
            </>
          )}
        </div>
      </div>

      {expanded && item.descricao && (
        <div style={{ padding: '0 14px 18px 170px' }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>Descrição</p>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{item.descricao}</p>
        </div>
      )}
    </div>
  )
}

// ── Modal de criação/edição ────────────────────────────────────
function MediaModal({ mode, item, onClose, onSaved }: {
  mode: 'create' | 'edit'; item?: any; onClose: () => void; onSaved: (it: any) => void
}) {
  const [nome,        setNome]        = useState(item?.nome ?? '')
  const [descricao,   setDescricao]   = useState(item?.descricao ?? '')
  const [tipo,        setTipo]        = useState<'pdf' | 'imagem' | 'video'>(item?.tipo ?? 'pdf')
  const [videoSource, setVideoSource] = useState<'drive' | 'youtube'>(item?.video_source ?? 'youtube')
  const [videoUrl,    setVideoUrl]    = useState(item?.tipo === 'video' ? item?.file_url ?? '' : '')
  const [team,        setTeam]        = useState(item?.team ?? 'ambos')
  const [verticals,   setVerticals]   = useState<string[]>(item?.vertical ?? (item ? [] : [...VERTICALS_AMBOS]))
  const [file,        setFile]        = useState<File | null>(null)
  const [fileName,    setFileName]    = useState<string>(item?.tipo !== 'video' ? (item?.file_url?.split('/').pop() ?? '') : '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Mesma lógica de Templates: time define a vertical automaticamente,
  // exceto OAO (que vende em 3 verticais e precisa escolher quais).
  function handleTeamChange(t: string) {
    setTeam(t)
    if (t === 'R1')    setVerticals(['Med-Review R1'])
    if (t === 'ambos') setVerticals([...VERTICALS_AMBOS])
    if (t === 'OAO')   setVerticals([])
  }
  function toggleVertical(v: string) {
    setVerticals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setFileName(f.name)
  }

  const needsNewUpload = mode === 'create' && tipo !== 'video'
  const teamOk = team !== 'OAO' || verticals.length > 0
  const fileOk = tipo === 'video' ? videoUrl.trim() !== '' : (!needsNewUpload || !!file || !!item?.file_url)
  const canSubmit = nome.trim() !== '' && teamOk && fileOk && !loading

  async function handleSave() {
    if (!canSubmit) return
    setLoading(true); setError('')

    const formData = new FormData()
    formData.append('mode', mode)
    if (mode === 'edit' && item) formData.append('id', item.id)
    formData.append('nome', nome)
    formData.append('descricao', descricao)
    formData.append('tipo', tipo)
    formData.append('team', team)
    formData.append('vertical', JSON.stringify(verticals))
    if (tipo === 'video') {
      formData.append('video_source', videoSource)
      formData.append('video_url', videoUrl)
    } else if (file) {
      formData.append('file', file)
    }

    const res = await fetch('/api/medmidia', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); setLoading(false); return }
    onSaved(data.item)
    onClose()
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 64px rgba(0,0,0,0.25)' }}>

        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', margin: 0 }}>
            {mode === 'create' ? '📁 Novo material' : `Editando: ${item?.nome}`}
          </h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={14} /></button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}><p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>⚠ {error}</p></div>}

          <div>
            <label style={lbl}>Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Folder Extensive R1 2026" style={inp} onFocus={foc} onBlur={blr} />
          </div>

          <div>
            <label style={lbl}>Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder="Pra que serve esse material, quando usar..."
              style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              onFocus={foc} onBlur={blr} />
          </div>

          <div>
            <label style={lbl}>Tipo de material *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'pdf', label: '📄 PDF' },
                { value: 'imagem', label: '🖼️ Imagem' },
                { value: 'video', label: '🎬 Vídeo' },
              ] as const).map(opt => {
                const active = tipo === opt.value
                return (
                  <button key={opt.value} type="button" onClick={() => { setTipo(opt.value); setFile(null); setFileName('') }}
                    style={{ flex: 1, height: 42, borderRadius: 10, border: `1.5px solid ${active ? '#6366f1' : 'var(--border)'}`, background: active ? 'rgba(99,102,241,0.08)' : 'var(--background)', color: active ? '#6366f1' : 'var(--muted-foreground)', fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {(tipo === 'pdf' || tipo === 'imagem') && (
            <div>
              <label style={lbl}>Arquivo {mode === 'create' ? '*' : '(deixe em branco pra manter o atual)'}</label>
              <input ref={fileRef} type="file" accept={tipo === 'pdf' ? '.pdf' : 'image/*'} onChange={handleFile} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ width: '100%', height: 48, borderRadius: 11, border: '2px dashed var(--border)', background: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted-foreground)', fontFamily: 'inherit' }}>
                <Upload size={15} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fileName || 'Clique para selecionar o arquivo'}</span>
              </button>
            </div>
          )}

          {tipo === 'video' && (
            <>
              <div>
                <label style={lbl}>Origem do vídeo *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['youtube', 'drive'] as const).map(src => {
                    const active = videoSource === src
                    return (
                      <button key={src} type="button" onClick={() => setVideoSource(src)}
                        style={{ flex: 1, height: 38, borderRadius: 9, border: `1.5px solid ${active ? '#6366f1' : 'var(--border)'}`, background: active ? 'rgba(99,102,241,0.08)' : 'var(--background)', color: active ? '#6366f1' : 'var(--muted-foreground)', fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {src === 'youtube' ? '▶️ YouTube' : '📁 Google Drive'}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={lbl}>Link do vídeo *</label>
                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                  placeholder={videoSource === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://drive.google.com/file/d/.../view'}
                  style={inp} onFocus={foc} onBlur={blr} />
              </div>
            </>
          )}

          <div>
            <label style={lbl}>Time *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'ambos', label: '✨ Ambos os times' },
                { value: 'OAO', label: '🔵 Time OAO' },
                { value: 'R1', label: '🟣 Time R1' },
              ] as const).map(opt => {
                const active = team === opt.value
                return (
                  <button key={opt.value} type="button" onClick={() => handleTeamChange(opt.value)}
                    style={{ flex: 1, height: 42, borderRadius: 10, border: `1.5px solid ${active ? '#6366f1' : 'var(--border)'}`, background: active ? 'rgba(99,102,241,0.08)' : 'var(--background)', color: active ? '#6366f1' : 'var(--muted-foreground)', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {team === 'R1' && (
            <div style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--secondary)', fontSize: 13, color: 'var(--muted-foreground)' }}>
              💜 <strong>Med-Review R1</strong> — selecionada automaticamente
            </div>
          )}
          {team === 'ambos' && (
            <div style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--secondary)', fontSize: 13, color: 'var(--muted-foreground)' }}>
              🌐 <strong>Todas as verticais</strong> — selecionadas automaticamente
            </div>
          )}
          {team === 'OAO' && (
            <div>
              <label style={lbl}>Vertical(is) * <span style={{ color: '#ef4444', fontWeight: 800 }}>{verticals.length === 0 ? '— selecione ao menos uma' : ''}</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {VERTICALS_OAO.map(v => {
                  const c = VERTICAL_CONFIG[v]
                  const checked = verticals.includes(v)
                  return (
                    <label key={v} onClick={() => toggleVertical(v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 11, border: `1.5px solid ${checked ? c.color + '50' : 'var(--border)'}`, background: checked ? c.bg : 'var(--background)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? c.color : 'var(--border)'}`, background: checked ? c.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? c.color : 'var(--foreground)' }}>{v}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSubmit}
              style={{ flex: 2, height: 42, borderRadius: 10, background: canSubmit ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--secondary)', color: canSubmit ? '#fff' : 'var(--muted-foreground)', fontSize: 14, fontWeight: 800, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: canSubmit ? '0 4px 14px rgba(79,70,229,0.3)' : 'none' }}>
              {loading ? 'Salvando...' : mode === 'create' ? '+ Adicionar material' : '✓ Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tela principal ──────────────────────────────────────────────
interface Props {
  itens: any[]; isAdmin: boolean; userTeam?: string
}

export function MedMidiaView({ itens: initial, isAdmin, userTeam }: Props) {
  const [itens,      setItens]      = useState(initial)
  const [filterTeam, setFilterTeam] = useState('')
  const [filterVert, setFilterVert] = useState('')
  const [viewMode,   setViewMode]   = useState<'grid' | 'list'>('grid')
  const [modal,      setModal]      = useState<null | 'create' | 'edit'>(null)
  const [editTarget, setEditTarget] = useState<any>(null)

  // Verticais disponíveis pro filtro — nunca uma lista fixa. Calculada a
  // partir do que REALMENTE existe nos itens, considerando o time já
  // selecionado (mas ignorando o próprio filtro de vertical, senão ele
  // nunca mostraria mais de uma opção depois de escolhida). Exemplo do
  // pedido: filtrar OAO só mostra Anest/Oft/Ortop; filtrar R1 só mostra
  // Med-Review R1 — sempre batendo com o que tem cadastrado de verdade.
  const VERTICAL_ORDER = ['Med-Review R1', 'Anest-Review', 'Oft-Review', 'Ortop-Review']
  const availableVerticals = (() => {
    const relevant = itens.filter(it => !filterTeam || it.team === filterTeam)
    const set = new Set<string>()
    relevant.forEach(it => (it.vertical ?? []).forEach((v: string) => set.add(v)))
    return [...set].sort((a, b) => VERTICAL_ORDER.indexOf(a) - VERTICAL_ORDER.indexOf(b))
  })()

  // Se o time mudar e a vertical selecionada não existir mais nessa
  // combinação, limpa sozinho — evita ficar com um filtro "fantasma"
  // aplicado que não bate com nenhuma opção visível no dropdown.
  useEffect(() => {
    if (filterVert && !availableVerticals.includes(filterVert)) setFilterVert('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTeam])

  const filtered = itens.filter(it => {
    if (filterTeam && it.team !== filterTeam) return false
    if (filterVert && !(it.vertical ?? []).includes(filterVert)) return false
    return true
  })

  function handleCreated(it: any) { setItens(prev => [it, ...prev]) }
  function handleUpdated(it: any) { setItens(prev => prev.map(x => x.id === it.id ? it : x)) }
  function handleDeleted() { window.location.reload() }

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: 'clamp(18px,2.4vw,24px) clamp(20px,2.8vw,28px)', marginBottom: 22, boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 16px rgba(79,70,229,0.28)' }}>
            <ImageIcon size={21} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 3px', letterSpacing: '-0.02em' }}>MedMídia</h1>
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', margin: 0 }}>
              {filtered.length} material{filtered.length !== 1 ? 'is' : ''} disponíve{filtered.length !== 1 ? 'is' : 'l'} · folders, catálogos e vídeos pra usar nos atendimentos
            </p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setModal('create')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
            <Plus size={14} /> Novo material
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', boxShadow: 'var(--shadow-xs)' }}>
        {isAdmin && (
          <FilterDropdown value={filterTeam} onChange={setFilterTeam} placeholder="👥 Todos os times"
            options={[
              { value: 'OAO', label: '🔵 Time OAO' },
              { value: 'R1', label: '🟣 Time R1' },
              { value: 'ambos', label: '✨ Ambos os times' },
            ]} minW={160} />
        )}
        {availableVerticals.length > 0 && (
          <FilterDropdown value={filterVert} onChange={setFilterVert} placeholder="🌐 Todas as verticais"
            options={availableVerticals.map(v => ({ value: v, label: v }))} minW={175} />
        )}

        {(filterTeam || filterVert) && (
          <button onClick={() => { setFilterTeam(''); setFilterVert('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38, padding: '0 13px', borderRadius: 10, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)', color: '#f87171', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.12)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.06)' }}>
            <X size={12} /> Limpar filtros
          </button>
        )}

        <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginLeft: 'auto' }}>
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
      </div>

      {/* Galeria */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>Nenhum material encontrado</p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{isAdmin ? 'Adicione o primeiro material clicando em "Novo material".' : 'Nenhum material disponível para o seu time ainda.'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(260px,100%),1fr))', gap: 14 }}>
          {filtered.map(it => (
            <MediaCard key={it.id} item={it} isAdmin={isAdmin}
              onEdit={() => { setEditTarget(it); setModal('edit') }}
              onDelete={handleDeleted}
            />
          ))}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--card)' }}>
          {filtered.map(it => (
            <MediaRow key={it.id} item={it} isAdmin={isAdmin}
              onEdit={() => { setEditTarget(it); setModal('edit') }}
              onDelete={handleDeleted}
            />
          ))}
        </div>
      )}

      {modal === 'create' && <MediaModal mode="create" onClose={() => setModal(null)} onSaved={handleCreated} />}
      {modal === 'edit' && editTarget && <MediaModal mode="edit" item={editTarget} onClose={() => { setModal(null); setEditTarget(null) }} onSaved={handleUpdated} />}

      <style>{`
        /* Hover sutil nos quadrantes da galeria — card eleva levemente,
           ganha sombra mais forte e borda destacada; a miniatura faz um
           zoom suave por baixo. Mesmo efeito (só a imagem) na lista. */
        .mm-card { border: 1px solid var(--border); box-shadow: var(--shadow-xs); transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .mm-card:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(0,0,0,.12); border-color: rgba(99,102,241,.35); }
        .mm-thumb-inner { transition: transform .4s ease; }
        .mm-card:hover .mm-thumb-inner, .mm-row:hover .mm-thumb-inner { transform: scale(1.07); }
      `}</style>
    </div>
  )
}
