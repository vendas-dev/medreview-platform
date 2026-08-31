'use client'
import { useState, useMemo } from 'react'
import { Settings, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { useSettings }       from './hooks/useSettings'
import { useSheetData }      from './hooks/useSheetData'
import { SalesConfigurator } from './components/SalesConfigurator'
import { PaymentCard }       from './components/PaymentCard'
import { WhatsAppPreview }   from './components/WhatsAppPreview'
import { InstallmentsPanel } from './components/InstallmentsPanel'
import { SettingsDialog }    from './components/SettingsDialog'
import { PaymentMode }       from './lib/types'
import { simulate, rateForVertical, parseBRL, buildWhatsAppMessage } from './lib/pricing'

interface Props { isAdmin?: boolean; userTeam?: string | null }

export function CalculadoraView({ isAdmin = false, userTeam = null }: Props) {
  const { settings, setSettings, reset, loaded } = useSettings()
  const { rows: allRows, loading, error, refresh } = useSheetData(settings, loaded)

  const TEAM_VERTICALS: Record<string,string[]> = {
    'R1':  ['Med-Review R1'],
    'OAO': ['Anest-Review', 'Oft-Review', 'Ortop-Review'],
  }
  const rows = isAdmin || !userTeam || !TEAM_VERTICALS[userTeam]
    ? allRows
    : allRows.filter(r => TEAM_VERTICALS[userTeam!]?.some(v => r.vertical?.includes(v) || v.includes(r.vertical ?? ''))
        || TEAM_VERTICALS[userTeam!]?.includes(r.vertical ?? ''))

  const [vertical,      setVertical]      = useState('')
  const [produto,       setProduto]       = useState('')
  const [tempo,         setTempo]         = useState('')
  const [tipoAluno,     setTipoAluno]     = useState('')
  const [canal,         setCanal]         = useState('')
  const [upsellOn,      setUpsellOn]      = useState(false)
  const [upsellProduto, setUpsellProduto] = useState('')
  const [usoInterno,    setUsoInterno]    = useState(false)
  const [paymentMode,   setPaymentModeRaw]= useState<PaymentMode>('parcelado')
  const [manualN,       setManualN]       = useState(12)
  const [manualRate,    setManualRate]    = useState(settings.defaultMonthlyRate)
  const [eventoSub,     setEventoSub]     = useState<'avista'|'parcelado'>('parcelado')
  const [showSettings,  setShowSettings]  = useState(false)

  // ── Negociação — barra 0-MAX% + campo de valor desejado ─────────
  const [discountPct,  setDiscountPct]  = useState(0)
  const [targetValue,  setTargetValue]  = useState('')
  const [hoveredParcela, setHoveredParcela] = useState<{ n: number; valor: number } | null>(null)

  function setPaymentMode(mode: PaymentMode) {
    setPaymentModeRaw(mode)
    if (mode === 'avista') {
      setDiscountPct(settings.cashDiscountPercent)
      setTargetValue('')
    }
  }

  const selectedRow = useMemo(() => {
    if (!vertical || !produto || !tempo || !tipoAluno || !canal) return null
    return rows.find(r =>
      r.vertical    === vertical &&
      r.produto     === produto  &&
      r.tempoAcesso === tempo    &&
      r.tipoAluno   === tipoAluno &&
      r.canalVenda  === canal
    ) ?? null
  }, [rows, vertical, produto, tempo, tipoAluno, canal])

  const upsellRow = useMemo(() => {
    if (!upsellOn || !upsellProduto || !selectedRow) return null
    return rows.find(r =>
      r.vertical    === vertical &&
      r.produto     === upsellProduto &&
      r.tempoAcesso === tempo    &&
      r.tipoAluno   === tipoAluno &&
      r.canalVenda  === canal
    ) ?? rows.find(r => r.vertical === vertical && r.produto === upsellProduto) ?? null
  }, [rows, upsellOn, upsellProduto, selectedRow, vertical, tempo, tipoAluno, canal])

  const entregaveisFinal = useMemo(() => {
    if (!selectedRow) return ''
    if (selectedRow.entregaveis) return selectedRow.entregaveis
    const irma = rows.find(r =>
      r.vertical === selectedRow.vertical && r.produto === selectedRow.produto &&
      r.tempoAcesso === selectedRow.tempoAcesso && r.tipoAluno === selectedRow.tipoAluno &&
      r.canalVenda === selectedRow.canalVenda && r.entregaveis
    )
    return irma?.entregaveis ?? ''
  }, [selectedRow, rows])

  const PV = useMemo(() => {
    if (!selectedRow) return 0
    return selectedRow.precoEspecial + (upsellOn && upsellRow ? upsellRow.precoEspecial : 0)
  }, [selectedRow, upsellOn, upsellRow])

  const totalCheioComUpsell = useMemo(() => {
    if (!selectedRow) return 0
    return selectedRow.precoCheio + (upsellOn && upsellRow ? upsellRow.precoCheio : 0)
  }, [selectedRow, upsellOn, upsellRow])

  const impliedPct = useMemo(() => {
    if (!targetValue || PV <= 0) return null
    const tv = parseBRL(targetValue)
    if (tv <= 0) return null
    return Math.max(0, (1 - tv / PV) * 100)
  }, [targetValue, PV])

  const maxDiscountPct = settings.discountLimits?.[vertical] ?? 20
  const isOverLimit = impliedPct !== null && impliedPct > maxDiscountPct

  const effectiveDiscountPct = isOverLimit ? discountPct : (impliedPct ?? discountPct)

  const effectivePV = useMemo(() => {
    if (isOverLimit) {
      const tv = parseBRL(targetValue)
      return tv > 0 ? tv : PV
    }
    if (impliedPct !== null) return PV * (1 - impliedPct / 100)
    return PV * (1 - discountPct / 100)
  }, [isOverLimit, targetValue, PV, impliedPct, discountPct])

  const simResult = useMemo(() => {
    if (!selectedRow || effectivePV <= 0) return null
    return simulate(effectivePV, paymentMode, settings, vertical, manualN, manualRate, eventoSub)
  }, [selectedRow, effectivePV, paymentMode, settings, vertical, manualN, manualRate, eventoSub])

  const hasUrl = !!settings.spreadsheetUrl
  const currentRate    = rateForVertical(vertical || '', settings)
  const isSemJurosMode = currentRate === 0

  function clearAll() {
    setVertical(''); setProduto(''); setTempo(''); setTipoAluno(''); setCanal('')
    setUpsellOn(false); setUpsellProduto('')
    setUsoInterno(false)
    setPaymentModeRaw('parcelado')
    setDiscountPct(0); setTargetValue('')
    setHoveredParcela(null)
  }

  const cursoLabelFull = selectedRow ? `${selectedRow.produto}${selectedRow.tipoAluno ? ` (${selectedRow.tipoAluno})` : ''}${upsellRow ? ` + ${upsellRow.produto}` : ''}` : ''
  const liveMessage = useMemo(() => {
    if (!simResult || !selectedRow) return 'Selecione um produto pra ver a prévia da mensagem aqui.'
    return buildWhatsAppMessage({
      cursoLabel: cursoLabelFull, tempoAcesso: selectedRow.tempoAcesso, entregaveis: entregaveisFinal,
      totalCheio: totalCheioComUpsell, totalBase: effectivePV, result: simResult, parcela: hoveredParcela,
    })
  }, [simResult, selectedRow, cursoLabelFull, entregaveisFinal, totalCheioComUpsell, effectivePV, hoveredParcela])

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1440, margin: '0 auto' }}>

      {/* ── Header compacto — sem badge, uma linha fina ──────────────
          Antes: ~80px de altura com badge + h1 + subtítulo em bloco
          Agora: ~44px, título + subtítulo inline, botões menores       */}
      <div className="calc2-hdr" style={{ borderRadius: 8, padding: 'clamp(9px,1.4vw,12px) clamp(14px,2vw,20px)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="calc2-hdr-title" style={{ fontSize: 'clamp(14px,1.8vw,16px)', fontWeight: 800, margin: '0 0 1px', letterSpacing: '-0.02em' }}>
            Negociação Comercial
          </h1>
          <p className="calc2-hdr-sub" style={{ fontSize: 11, margin: 0 }}>
            Simulador de oferta{rows.length > 0 ? ` · ${rows.length} produtos disponíveis` : ' · Carregando...'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {hasUrl && (
            <button onClick={refresh} disabled={loading} title="Atualizar" className="calc2-hdr-btn"
              style={{ width: 32, height: 32, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="calc2-hdr-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
              <Settings size={12} /> Configurações
            </button>
          )}
        </div>
      </div>

      {isAdmin && !hasUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
          <AlertCircle size={17} style={{ color: '#d97706', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 2px' }}>Planilha não configurada</p>
            <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: 0 }}>Cole a URL CSV da planilha nas configurações para carregar os produtos.</p>
          </div>
          <button onClick={() => setShowSettings(true)}
            style={{ height: 34, padding: '0 14px', borderRadius: 7, border: 'none', background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Configurar
          </button>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
          <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: '#ef4444', margin: 0 }}>Erro ao carregar planilha: {error}</p>
        </div>
      )}

      {loading && rows.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 8, background: 'var(--secondary)', marginBottom: 16 }}>
          <Loader2 size={15} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', margin: 0 }}>Carregando produtos da planilha...</p>
        </div>
      )}

      {/* Layout 3 colunas — configuração | oferta+negociação | prévia WhatsApp */}
      <div className="calc2-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr 320px', gap: 16, alignItems: 'start' }}>
        <div>
          <SalesConfigurator
            rows={rows}
            settings={settings}
            vertical={vertical}         setVertical={v  => { setVertical(v);  setProduto(''); setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto(''); setDiscountPct(0); setTargetValue('') }}
            produto={produto}           setProduto={v   => { setProduto(v);   setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto(''); setDiscountPct(0); setTargetValue('') }}
            tempo={tempo}               setTempo={v     => { setTempo(v);     setTipoAluno(''); setCanal('') }}
            tipoAluno={tipoAluno}       setTipoAluno={v => { setTipoAluno(v); setCanal('') }}
            canal={canal}               setCanal={setCanal}
            upsellOn={upsellOn}         setUpsellOn={setUpsellOn}
            upsellProduto={upsellProduto} setUpsellProduto={setUpsellProduto}
            upsellRow={upsellRow}
            usoInterno={usoInterno}     setUsoInterno={setUsoInterno}
            selectedRow={selectedRow}
            onClearAll={clearAll}
          />
        </div>

        <div>
          <PaymentCard
            result={simResult}
            cursoLabel={cursoLabelFull}
            entregaveis={entregaveisFinal}
            tempoAcesso={selectedRow?.tempoAcesso ?? ''}
            produtoLabel={selectedRow ? `${selectedRow.produto}${upsellRow ? ` + ${upsellRow.produto}` : ''} — ${selectedRow.tempoAcesso}` : ''}
            precoCheio={selectedRow ? selectedRow.precoCheio + (upsellOn && upsellRow ? upsellRow.precoCheio : 0) : 0}
            precoBase={selectedRow ? effectivePV : 0}
            upsellLabel={upsellRow?.produto}
            upsellPrice={upsellOn && upsellRow ? upsellRow.precoEspecial : 0}
            vertical={vertical}
            eventDiscount={settings.eventDiscounts[vertical]}
            paymentMode={paymentMode}   setPaymentMode={setPaymentMode}
            usoInterno={usoInterno}
            manualN={manualN}           setManualN={setManualN}
            manualRate={manualRate}     setManualRate={setManualRate}
            eventoSub={eventoSub}       setEventoSub={setEventoSub}
            currentRate={currentRate}
            isSemJurosMode={isSemJurosMode}
            pvOriginal={PV}
            effectivePV={effectivePV}
            discountPct={effectiveDiscountPct}
            setDiscountPct={setDiscountPct}
            targetValue={targetValue}   setTargetValue={setTargetValue}
            impliedPct={impliedPct}
            isOverLimit={isOverLimit}
            defaultCashPct={settings.cashDiscountPercent}
            maxDiscountPct={maxDiscountPct}
            onHoverParcela={setHoveredParcela}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <WhatsAppPreview message={liveMessage} isHoveringParcela={!!hoveredParcela} />
          <InstallmentsPanel
            result={simResult}
            cursoLabel={cursoLabelFull}
            tempoAcesso={selectedRow?.tempoAcesso ?? ''}
            entregaveis={entregaveisFinal}
            totalCheio={totalCheioComUpsell}
            totalBase={effectivePV}
            onHoverParcela={setHoveredParcela}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }

        .calc2-hdr { background: var(--card); border: 1px solid var(--border); }
        .calc2-hdr-title { color: var(--foreground); }
        .calc2-hdr-sub { color: var(--muted-foreground); }
        .calc2-hdr-btn { border: 1px solid var(--border); background: var(--secondary); color: var(--muted-foreground); }
        .calc2-hdr-btn:hover { background: var(--border); color: var(--foreground); }

        .dark .calc2-hdr { background: linear-gradient(135deg,#0f0524,#1e0b45,#2e1065); border: none; }
        .dark .calc2-hdr-title { color: #fff; }
        .dark .calc2-hdr-sub { color: rgba(255,255,255,0.55); }
        .dark .calc2-hdr-btn { border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #fff; }
        .dark .calc2-hdr-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }

        @media (max-width: 1180px) {
          .calc2-grid { grid-template-columns: 320px 1fr !important; }
          .calc2-grid > div:nth-child(3) { grid-column: 1 / -1; }
        }
        @media (max-width: 860px) {
          .calc2-grid { grid-template-columns: 1fr !important; }
          .calc2-grid > div:nth-child(3) { grid-column: auto; }
        }
      `}</style>

      {isAdmin && showSettings && (
        <SettingsDialog settings={settings} onSave={setSettings} onReset={reset} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
