'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Megaphone, Search, Send, X } from 'lucide-react'
import { NotificationCard, timeAgo } from '@/components/notifications/NotificationBell'

// ══ Administração → Notificação: o superadmin escolhe QUEM recebe e escreve o aviso ══

interface User { id: string; name: string; role: string | null; team: string | null; avatar_url: string | null }
interface Hist { id: string; title: string; body: string | null; kind: 'aviso' | 'campanha' | 'vitoria'; link: string | null; created_at: string; total: number; read: number }
const input: React.CSSProperties = { width: '100%', padding: '0 12px', height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
const lab: React.CSSProperties = { display: 'block', margin: '0 0 5px', fontSize: 10.5, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const linkOk = (l: string) => { const v = l.trim(); if (!v) return true; if (v.startsWith('/') && !v.startsWith('//')) return true; try { return new URL(v).protocol === 'https:' } catch { return false } }
const initials = (n: string) => n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?'

export function NotificacoesClient() {
  const [users, setUsers] = useState<User[]>([])
  const [hist, setHist] = useState<Hist[]>([])
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [link, setLink] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadHist = useCallback(async () => { const r = await fetch('/api/admin/notifications', { cache: 'no-store' }); if (r.ok) setHist((await r.json()).items ?? []) }, [])
  useEffect(() => {
    fetch('/api/admin/notifications/recipients', { cache: 'no-store' }).then(r => r.ok ? r.json() : { users: [] }).then(j => setUsers(j.users ?? []))
    loadHist()
  }, [loadHist])
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 5000); return () => clearTimeout(id) }, [msg])

  const groups = useMemo(() => [
    { id: 'all', label: 'Todos', ids: users.map(u => u.id) },
    { id: 'OAO', label: 'Time OAO', ids: users.filter(u => u.team === 'OAO').map(u => u.id) },
    { id: 'R1', label: 'Time R1', ids: users.filter(u => u.team === 'R1').map(u => u.id) },
    { id: 'super', label: 'Superadmins', ids: users.filter(u => u.role === 'superadmin').map(u => u.id) },
  ], [users])
  const filtered = useMemo(() => { const n = norm(q.trim()); return n ? users.filter(u => norm(`${u.name} ${u.role ?? ''} ${u.team ?? ''}`).includes(n)) : users }, [users, q])
  const full = (ids: string[]) => ids.length > 0 && ids.every(i => sel.has(i))
  const toggleGroup = (ids: string[]) => setSel(s => { const n = new Set(s); if (full(ids)) ids.forEach(i => n.delete(i)); else ids.forEach(i => n.add(i)); return n })
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const problems = [!title.trim() && 'Escreva o título.', sel.size === 0 && 'Escolha pelo menos uma pessoa.', !linkOk(link) && 'O link precisa começar com / (ex.: /telao) ou https://.'].filter(Boolean) as string[]

  async function send() {
    setSending(true); setMsg(null)
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, link: link.trim() || null, userIds: [...sel] }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, text: j?.error ?? 'Não consegui enviar.' }); return }
      setMsg({ ok: true, text: `Enviada para ${j.recipients} ${j.recipients === 1 ? 'pessoa' : 'pessoas'}! 🔔` })
      setTitle(''); setBody(''); setLink(''); setSel(new Set()); loadHist()
    } catch { setMsg({ ok: false, text: 'Sem conexão. Tente de novo.' }) } finally { setSending(false) }
  }

  return (
    <div style={{ padding: 'clamp(16px,3vw,32px)', maxWidth: 1180, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.02em', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 10 }}><Megaphone size={22} style={{ color: '#6366f1' }} />Notificação</h1>
      <p style={{ margin: '3px 0 20px', fontSize: 13, color: 'var(--muted-foreground)' }}>Envie um aviso para quem você escolher. Ele aparece no sininho da pessoa.</p>

      <div className="nt-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,380px)', gap: 20, alignItems: 'start' }}>
        <style>{`@media(max-width:900px){.nt-grid{grid-template-columns:minmax(0,1fr)!important}}`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section style={{ padding: 18, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <label style={lab}>Título</label>
            <input data-f="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Reunião de resultados amanhã às 9h" style={input} />
            <div style={{ height: 12 }} />
            <label style={lab}>Descrição</label>
            <textarea data-f="body" value={body} onChange={e => setBody(e.target.value)} maxLength={1000} rows={4} placeholder="Escreva os detalhes do aviso…" style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
            <p style={{ margin: '3px 0 0', fontSize: 10.5, color: 'var(--muted-foreground)', textAlign: 'right' }}>{body.length}/1000</p>
            <label style={lab}>Link ao clicar (opcional)</label>
            <input data-f="link" value={link} onChange={e => setLink(e.target.value)} placeholder="/telao  ou  https://…" style={{ ...input, borderColor: linkOk(link) ? 'var(--border)' : '#ef4444' }} />
          </section>

          <section data-recipients style={{ padding: 18, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', flex: 1 }}>Quem recebe</p><span data-count style={{ fontSize: 12, fontWeight: 800, color: '#6366f1' }}>{sel.size} selecionada{sel.size === 1 ? '' : 's'}</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {groups.map(g => <button key={g.id} data-group={g.id} disabled={g.ids.length === 0} onClick={() => toggleGroup(g.ids)} style={{ height: 30, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${full(g.ids) ? '#6366f1' : 'var(--border)'}`, background: full(g.ids) ? 'rgba(99,102,241,.14)' : 'var(--card)', color: 'var(--foreground)', fontSize: 11.5, fontWeight: 700, cursor: g.ids.length ? 'pointer' : 'not-allowed', opacity: g.ids.length ? 1 : 0.4, fontFamily: 'inherit' }}>{g.label} <span style={{ opacity: 0.55 }}>{g.ids.length}</span></button>)}
              {sel.size > 0 && <button data-clear onClick={() => setSel(new Set())} style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}><X size={12} />Limpar</button>}
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted-foreground)' }} />
              <input data-f="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, time ou cargo…" style={{ ...input, paddingLeft: 34 }} />
            </div>
            {q.trim() && filtered.length > 0 && <button data-select-filtered onClick={() => toggleGroup(filtered.map(u => u.id))} style={{ border: 'none', background: 'transparent', color: '#6366f1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '0 0 8px', fontFamily: 'inherit' }}>{full(filtered.map(u => u.id)) ? 'Desmarcar' : 'Selecionar'} os {filtered.length} resultados</button>}
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              {filtered.map(u => (
                <label key={u.id} data-user={u.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: sel.has(u.id) ? 'rgba(99,102,241,.08)' : 'transparent' }}>
                  <input type="checkbox" data-pick={u.name} checked={sel.has(u.id)} onChange={() => toggle(u.id)} />
                  {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(u.name)}</span>}
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)' }}>{u.name}</span>
                  {u.team && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>{u.team}</span>}
                  {u.role && <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>{u.role}</span>}
                </label>
              ))}
              {filtered.length === 0 && <p style={{ margin: 0, padding: 18, fontSize: 12.5, color: 'var(--muted-foreground)', textAlign: 'center' }}>{users.length === 0 ? 'Carregando pessoas…' : 'Ninguém encontrado.'}</p>}
            </div>
          </section>
        </div>

        <div style={{ position: 'sticky', top: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 900, letterSpacing: '.14em', color: 'var(--muted-foreground)' }}>PRÉVIA · COMO VAI APARECER</p>
          <div data-preview style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,.14)' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)' }}>Notificações <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>· 1 nova</span></div>
            <NotificationCard n={{ title, body: body.trim() || null, kind: 'aviso', created_at: new Date().toISOString() }} />
          </div>
          <p data-summary style={{ margin: 0, fontSize: 12.5, color: 'var(--foreground)' }}>Vai para <strong>{sel.size}</strong> {sel.size === 1 ? 'pessoa' : 'pessoas'}{link.trim() && linkOk(link) ? <> · abre <code style={{ fontSize: 11.5 }}>{link.trim()}</code></> : ''}.</p>
          {problems.length > 0 && <p data-problems style={{ margin: 0, fontSize: 11.5, color: '#d97706' }}>{problems.join(' ')}</p>}
          <button data-send onClick={send} disabled={sending || problems.length > 0} style={{ height: 44, borderRadius: 12, border: 'none', cursor: problems.length ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: problems.length ? 0.45 : 1, boxShadow: problems.length ? 'none' : '0 6px 18px rgba(99,102,241,.4)', fontFamily: 'inherit' }}><Send size={15} />{sending ? 'Enviando…' : 'Enviar notificação'}</button>
          <AnimatePresence>{msg && <motion.p role="status" data-msg initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ margin: 0, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: msg.ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: msg.ok ? '#16a34a' : '#ef4444' }}>{msg.ok ? '✅ ' : '⛔ '}{msg.text}</motion.p>}</AnimatePresence>
        </div>
      </div>

      <h2 style={{ margin: '30px 0 10px', fontSize: 15, fontWeight: 900, color: 'var(--foreground)' }}>Enviadas recentemente</h2>
      <div data-history style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
        {hist.length === 0 && <p style={{ margin: 0, padding: 22, fontSize: 12.5, color: 'var(--muted-foreground)', textAlign: 'center' }}>Nenhuma notificação enviada ainda.</p>}
        {hist.map(h => (
          <div key={h.id} data-hist={h.title} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.kind !== 'aviso' && <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(245,158,11,.18)', color: '#d97706', marginRight: 7 }}>CAMPANHA</span>}{h.title}</p>
              {h.body && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.body}</p>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: 'var(--foreground)' }}>{h.read}/{h.total} leram</p>
              <p style={{ margin: '1px 0 0', fontSize: 10.5, color: 'var(--muted-foreground)' }}>{timeAgo(h.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
