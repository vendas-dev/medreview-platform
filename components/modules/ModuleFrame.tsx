'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Maximize2, AlertCircle } from 'lucide-react'

interface ModuleFrameProps {
  url: string
  title: string
}

export function ModuleFrame({ url, title }: ModuleFrameProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [key, setKey] = useState(0)

  const handleLoad = useCallback(() => setLoading(false), [])
  const handleError = useCallback(() => { setError(true); setLoading(false) }, [])
  const handleRefresh = useCallback(() => { setKey(k => k + 1); setLoading(true); setError(false) }, [])
  const handleFullscreen = useCallback(() => window.open(url, '_blank'), [url])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-11 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={handleFullscreen}
            className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Abrir em nova aba"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Frame */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence>
          {loading && !error && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-background flex flex-col items-center justify-center gap-3"
            >
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Carregando {title}...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle size={32} className="text-destructive/50" />
            <p className="text-sm">Não foi possível carregar o módulo.</p>
            <button
              onClick={handleRefresh}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        ) : (
          <motion.iframe
            key={key}
            src={url}
            title={title}
            onLoad={handleLoad}
            onError={handleError}
            className="w-full h-full border-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: loading ? 0 : 1 }}
            transition={{ duration: 0.25 }}
            allow="clipboard-write"
          />
        )}
      </div>
    </div>
  )
}
