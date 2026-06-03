'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Maximize2, AlertCircle } from 'lucide-react'

export function ModuleFrame({ url, title }: { url: string; title: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [key, setKey] = useState(0)

  const refresh = useCallback(() => { setKey(k => k + 1); setLoading(true); setError(false) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ icon: RefreshCw, onClick: refresh, title: 'Recarregar' }, { icon: Maximize2, onClick: () => window.open(url, '_blank'), title: 'Abrir em nova aba' }].map(({ icon: Icon, onClick, title: t }) => (
            <button key={t} onClick={onClick} title={t} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence>
          {loading && !error && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10 }}>
              <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Carregando {title}...</p>
            </motion.div>
          )}
        </AnimatePresence>
        {error ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <AlertCircle size={32} style={{ color: 'var(--destructive)', opacity: 0.5 }} />
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Não foi possível carregar o módulo.</p>
            <button onClick={refresh} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Tentar novamente</button>
          </div>
        ) : (
          <iframe key={key} src={url} title={title} onLoad={() => setLoading(false)} onError={() => { setError(true); setLoading(false) }}
            style={{ width: '100%', height: '100%', border: 'none', opacity: loading ? 0 : 1, transition: 'opacity 0.25s' }} />
        )}
      </div>
    </div>
  )
}
