'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Megaphone, Trophy, Flag } from 'lucide-react'
import { WinnersModal } from '@/components/campaigns/WinnersModal'

// ══ Sininho de notificações ══════════════════════════════════════════════════
// • número de NÃO LIDAS no botão · clique abre um popup AO LADO do botão com as últimas
// • atualiza sozinho a cada 30 s, quando a aba volta ao foco e ao abrir
// • clicar numa notificação marca como lida e leva pro link (se tiver)

export interface NotificationItem { id: string; title: string; body: string | null; kind: 'aviso' | 'campanha' | 'vitoria'; link: string | null; created_at: string; read_at: string | null; campaign_id?: string | null }
export const KIND = {
  aviso:    { color: '#6366f1', Icon: Megaphone, label: 'Aviso' },
  campanha: { color: '#f59e0b', Icon: Flag,      label: 'Campanha' },
  vitoria:  { color: '#22c55e', Icon: Trophy,    label: 'Vitória' },
} as const
const POLL_MS = 30_000

export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  if (s < 172800) return 'ontem'
  const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** O cartão de uma notificação — usado no popup E na prévia da tela de envio. */
export function NotificationCard({ n, onClick, now }: { n: Pick<NotificationItem, 'title' | 'body' | 'kind' | 'created_at'> & { read_at?: string | null }; onClick?: () => void; now?: number }) {
  const k = KIND[n.kind] ?? KIND.aviso, unread = !n.read_at
  return (
    <button onClick={onClick} data-notif={n.title} data-unread={unread ? '1' : '0'} disabled={!onClick}
      style={{ width: '100%', display: 'flex', gap: 11, padding: '11px 14px', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: unread ? `${k.color}0f` : 'transparent', cursor: onClick ? 'pointer' : 'default', color: 'var(--foreground)', fontFamily: 'inherit' }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: `${k.color}22`, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><k.Icon size={15} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: unread ? 800 : 600, lineHeight: 1.3, flex: 1 }}>{n.title || 'Título da notificação'}</span>
          {unread && <span aria-label="não lida" style={{ width: 8, height: 8, borderRadius: '50%', background: k.color, flexShrink: 0 }} />}
        </span>
        {n.body ? <span style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 3, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{n.body}</span> : null}
        <span style={{ display: 'block', fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4, opacity: 0.8 }}>{k.label} · {timeAgo(n.created_at, now)}</span>
      </span>
    </button>
  )
}

export function NotificationBell({ collapsed = false, variant = 'sidebar' }: { collapsed?: boolean; variant?: 'sidebar' | 'header' }) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [winnersOf, setWinnersOf] = useState<string | null>(null)      // aviso de campanha → popup dos vencedores
  const [pos, setPos] = useState<{ left?: number; right?: number; top?: number; bottom?: number; maxH: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const prevUnread = useRef(0)
  const busy = useRef(false)
  const shake = useAnimationControls()

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setItems(j.items ?? []); setUnread(j.unread ?? 0); setLoaded(true)
    } catch { /* mantém o que já tinha; tenta de novo no próximo ciclo */ } finally { busy.current = false }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load); document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  // chegou notificação nova → o sino balança
  useEffect(() => {
    if (loaded && unread > prevUnread.current) shake.start({ rotate: [0, -16, 14, -10, 6, 0], transition: { duration: 0.7 } })
    prevUnread.current = unread
  }, [unread, loaded, shake])

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect(); if (!r) return
    if (variant === 'header') setPos({ top: r.bottom + 8, right: 12, maxH: Math.max(window.innerHeight - r.bottom - 24, 240) })
    else {                                                  // encosta na borda do MENU (não do botão): no menu recolhido o botão fica 12px pra dentro
      const edge = btn.current?.closest('aside')?.getBoundingClientRect().right ?? r.right
      setPos({ left: Math.max(edge, r.right) + 10, bottom: Math.max(window.innerHeight - r.bottom - 4, 8), maxH: Math.max(r.bottom - 12, 240) })
    }
  }, [variant])
  useLayoutEffect(() => { if (open) place() }, [open, place, collapsed])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown); window.addEventListener('keydown', onKey); window.addEventListener('resize', place)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', place) }
  }, [open, place])

  const toggle = () => { setOpen(o => !o); if (!open) load() }

  const markRead = async (ids: string[]) => {
    const fresh = items.filter(i => ids.includes(i.id) && !i.read_at).length
    if (fresh === 0) return
    setItems(p => p.map(i => (ids.includes(i.id) && !i.read_at ? { ...i, read_at: new Date().toISOString() } : i))); setUnread(u => Math.max(u - fresh, 0))
    try { await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }) } catch { load() }
  }
  const markAll = async () => {
    setItems(p => p.map(i => (i.read_at ? i : { ...i, read_at: new Date().toISOString() }))); setUnread(0)
    try { await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }) } catch { load() }
  }
  const openItem = (n: NotificationItem) => {
    markRead([n.id]); setOpen(false)
    if (n.campaign_id) { setWinnersOf(n.campaign_id); return }           // aviso de campanha: abre o popup dos vencedores (não leva pra outra página)
    if (!n.link) return
    if (n.link.startsWith('/')) router.push(n.link); else window.open(n.link, '_blank', 'noopener,noreferrer')
  }

  const badge = unread > 99 ? '99+' : String(unread)
  const label = `Notificações${unread > 0 ? ` (${unread} não lida${unread > 1 ? 's' : ''})` : ''}`
  const icon = <motion.span animate={shake} style={{ display: 'inline-flex', transformOrigin: '50% 10%' }}><Bell size={15} /></motion.span>
  const pill = unread > 0 ? <span data-bell-badge style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--sidebar-bg, var(--card))' }}>{badge}</span> : null

  return (
    <>
      {variant === 'sidebar' && !collapsed ? (
        <button ref={btn} onClick={toggle} aria-label={label} aria-expanded={open} data-bell
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 38, borderRadius: 10, border: '1px solid var(--border)', background: open ? 'var(--border)' : 'var(--card)', cursor: 'pointer', color: unread > 0 ? 'var(--foreground)' : 'var(--muted-foreground)', fontSize: 12.5, fontWeight: 600 }}>
          {icon}<span style={{ flex: 1, textAlign: 'left' }}>Notificações</span>{pill}
        </button>
      ) : (
        <button ref={btn} onClick={toggle} aria-label={label} aria-expanded={open} data-bell
          style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: open ? 'var(--border)' : 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: unread > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
          {icon}
          {pill && <span style={{ position: 'absolute', top: -6, right: -6 }}>{pill}</span>}
        </button>
      )}

      {winnersOf && <WinnersModal campaignId={winnersOf} onClose={() => setWinnersOf(null)} />}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div ref={pop} role="dialog" aria-label="Notificações" data-bell-popup initial={{ opacity: 0, x: variant === 'header' ? 0 : -8, y: variant === 'header' ? -8 : 0, scale: 0.98 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
              style={{ position: 'fixed', left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, width: 'min(390px, calc(100vw - 24px))', maxHeight: pos.maxH, zIndex: 1000, display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 18px 50px rgba(0,0,0,.28)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', flex: 1 }}>Notificações {unread > 0 && <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>· {unread} nova{unread > 1 ? 's' : ''}</span>}</span>
                {unread > 0 && <button onClick={markAll} data-mark-all style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6366f1', fontSize: 11.5, fontWeight: 700 }}><CheckCheck size={13} />Marcar todas como lidas</button>}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {!loaded ? <p style={{ margin: 0, padding: 22, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>Carregando…</p>
                  : items.length === 0 ? <p data-bell-empty style={{ margin: 0, padding: '30px 22px', fontSize: 12.5, color: 'var(--muted-foreground)', textAlign: 'center' }}>Nenhuma notificação por aqui ainda 🎉</p>
                  : items.map(n => <NotificationCard key={n.id} n={n} onClick={() => openItem(n)} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </>
  )
}
