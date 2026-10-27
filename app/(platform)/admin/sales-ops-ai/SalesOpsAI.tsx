'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Settings2 } from 'lucide-react'
import { SalesOpsAiIcon, useSalesOpsAiImage } from '@/components/shell/SalesOpsAiIcon'
import type { SalesOpsSettings } from '@/lib/salesops/prompt'
import { SalesOpsChat, type Conv } from './SalesOpsChat'
import { SalesOpsConfig, type GapDraft } from './SalesOpsConfig'

type Tab = 'chat' | 'config'

// Casca da página: cabeçalho + duas abas (Conversar / Configuração). As duas ficam montadas (só escondidas), então trocar de aba não perde conversa em andamento
// nem o que você digitou na configuração e ainda não salvou.
export function SalesOpsAI({ initialConversations, suggested, initialGapCount }: { initialConversations: Conv[]; suggested: string[]; initialGapCount: number }) {
  const [tab, setTab] = useState<Tab>('chat')
  const [configSeen, setConfigSeen] = useState(false)
  const [gapCount, setGapCount] = useState(initialGapCount)
  const [gapDraft, setGapDraft] = useState<GapDraft | null>(null)
  const [starters, setStarters] = useState<string[]>(suggested)
  const img = useSalesOpsAiImage()                         // com imagem própria, o bloco colorido atrás do ícone sai

  const go = useCallback((t: Tab) => { setTab(t); if (t === 'config') setConfigSeen(true); try { history.replaceState(null, '', t === 'config' ? '#configuracao' : location.pathname + location.search) } catch { /* ignore */ } }, [])
  useEffect(() => { if (location.hash === '#configuracao') { setTab('config'); setConfigSeen(true) } }, [])
  const onDocument = useCallback((question: string, messageId?: string) => { setGapDraft({ question, messageId, nonce: Date.now() }); go('config') }, [go])
  const onSettings = useCallback((s: SalesOpsSettings) => setStarters(s.suggested_prompts), [])

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [{ id: 'chat', label: 'Conversar', icon: MessageSquare }, { id: 'config', label: 'Configuração', icon: Settings2, badge: gapCount }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--background)', color: 'var(--foreground)' }} data-soai="page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px clamp(14px,2.2vw,26px)', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <motion.div initial={{ rotate: -8, scale: .9 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 14 }}
          style={{ width: 46, height: 46, borderRadius: 14, background: img ? 'transparent' : 'var(--grad-hot)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: img ? 'none' : 'var(--shadow-purple)', flexShrink: 0 }}>
          <SalesOpsAiIcon size={img ? 46 : 25} />
        </motion.div>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--foreground)', lineHeight: 1.15 }}>Sales Ops AI</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted-foreground)' }}>Processos e partes técnicas da operação: roleta, CRM, ofertas, closers e mais.</p>
        </div>
        <div role="tablist" aria-label="Seções" style={{ display: 'inline-flex', padding: 4, gap: 4, borderRadius: 14, background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-soai="tab" data-tab={t.id} onClick={() => go(t.id)}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 15px', borderRadius: 10, border: 'none', background: tab === t.id ? 'var(--card)' : 'transparent', color: tab === t.id ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: tab === t.id ? 'var(--shadow-xs)' : 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s ease, color .15s ease' }}>
              <t.icon size={15} />{t.label}
              {t.badge ? <span data-soai="tab-badge" style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--warning)', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span> : null}
            </button>
          ))}
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div hidden={tab !== 'chat'} style={{ height: '100%' }}><SalesOpsChat initialConversations={initialConversations} suggested={starters} onDocument={onDocument} /></div>
        <div hidden={tab !== 'config'} style={{ height: '100%', overflowY: 'auto' }}>{configSeen && <SalesOpsConfig gapDraft={gapDraft} onGapCount={setGapCount} onSettings={onSettings} />}</div>
      </div>
    </div>
  )
}
