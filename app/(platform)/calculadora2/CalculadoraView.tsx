'use client'
import { useState, useMemo } from 'react'
import { Settings, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { useSettings }       from './hooks/useSettings'
import { useSheetData }      from './hooks/useSheetData'
import { SalesConfigurator } from './components/SalesConfigurator'
import { PaymentCard }       from './components/PaymentCard'
import { SettingsDialog }    from './components/SettingsDialog'
import { PaymentMode }       from './lib/types'
import { simulate, rateForVertical } from './lib/pricing'

interface Props { isAdmin?: boolean; userTeam?: string | null }

export function CalculadoraView({ isAdmin = false, userTeam = null }: Props) {
  const { settings, setSettings, reset, loaded } = useSettings()
  const { rows: allRows, loading, error, refresh } = useSheetData(settings, loaded)

  // Filtrar verticais disponíveis por time (exceto superadmin)
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
  const [paymentMode,   setPaymentMode]   = useState<PaymentMode>('parcelado')
  const [manualN,       setManualN]       = useState(12)
  const [manualRate,    setManualRate]    = useState(settings.defaultMonthlyRate)
  const [eventoSub,     setEventoSub]     = useState<'avista'|'parcelado'>('parcelado')
  const [showSettings,  setShowSettings]  = useState(false)

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

  const PV = useMemo(() => {
    if (!selectedRow) return 0
    return selectedRow.precoEspecial + (upsellOn && upsellRow ? upsellRow.precoEspecial : 0)
  }, [selectedRow, upsellOn, upsellRow])

  const simResult = useMemo(() => {
    if (!selectedRow || PV <= 0) return null
    return simulate(PV, paymentMode, settings, vertical, manualN, manualRate, eventoSub)
  }, [selectedRow, PV, paymentMode, settings, vertical, manualN, manualRate, eventoSub])

  const hasUrl = !!settings.spreadsheetUrl

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', maxWidth: 1240, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#2e1065 0%,#3730a3 30%,#4f46e5 68%,#7c3aed 100%)', borderRadius: 22, padding: 'clamp(18px,3vw,28px)', marginBottom: 22, position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(79,70,229,0.3)' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'inline-block', marginBottom: 10, border: '1px solid rgba(255,255,255,0.2)' }}>
              🧮 Calculadora Comercial
            </span>
            <h1 style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
              Simulador de Investimento
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
              {rows.length > 0
                ? `${rows.length} produtos · Atualiza a cada 60s`
                : 'Carregando produtos...'}
            </p>
          </div>

          {/* Botões — refresh sempre visível, configurações só para admin */}
          <div style={{ display: 'flex', gap: 8 }}>
            {hasUrl && (
              <button onClick={refresh} disabled={loading} title="Atualizar"
                style={{ width: 40, height: 40, borderRadius: 11, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(8px)', transition: 'all 0.15s' }}>
                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            )}

            {/* ← Configurações: APENAS para superadmin */}
            {isAdmin && (
              <button onClick={() => setShowSettings(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit', backdropFilter: 'blur(8px)', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
                <Settings size={15} /> Configurações
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aviso de planilha não configurada — só para admin */}
      {isAdmin && !hasUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.25)', marginBottom: 20 }}>
          <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 2px' }}>Planilha não configurada</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Cole a URL CSV da planilha nas configurações para carregar os produtos.</p>
          </div>
          <button onClick={() => setShowSettings(true)}
            style={{ height: 36, padding: '0 16px', borderRadius: 9, border: 'none', background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Configurar
          </button>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 20 }}>
          <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>Erro ao carregar planilha: {error}</p>
        </div>
      )}

      {loading && rows.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'var(--secondary)', marginBottom: 20 }}>
          <Loader2 size={16} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Carregando produtos da planilha...</p>
        </div>
      )}

      {/* Layout 2 colunas */}
      <div className="calc2-grid" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <SalesConfigurator
            rows={rows}
            settings={settings}
            vertical={vertical}         setVertical={v  => { setVertical(v);  setProduto(''); setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto('') }}
            produto={produto}           setProduto={v   => { setProduto(v);   setTempo(''); setTipoAluno(''); setCanal(''); setUpsellOn(false); setUpsellProduto('') }}
            tempo={tempo}               setTempo={v     => { setTempo(v);     setTipoAluno(''); setCanal('') }}
            tipoAluno={tipoAluno}       setTipoAluno={v => { setTipoAluno(v); setCanal('') }}
            canal={canal}               setCanal={setCanal}
            upsellOn={upsellOn}         setUpsellOn={setUpsellOn}
            upsellProduto={upsellProduto} setUpsellProduto={setUpsellProduto}
            upsellRow={upsellRow}
            usoInterno={usoInterno}     setUsoInterno={setUsoInterno}
            paymentMode={paymentMode}   setPaymentMode={setPaymentMode}
            manualN={manualN}           setManualN={setManualN}
            manualRate={manualRate}     setManualRate={setManualRate}
            eventoSub={eventoSub}       setEventoSub={setEventoSub}
            selectedRow={selectedRow}
          />
        </div>

        <div style={{ position: 'sticky', top: 20 }}>
          <PaymentCard
            result={simResult}
            produtoLabel={selectedRow ? `${selectedRow.produto}${upsellRow ? ` + ${upsellRow.produto}` : ''} — ${selectedRow.tempoAcesso}` : ''}
            precoCheio={selectedRow ? selectedRow.precoCheio + (upsellOn && upsellRow ? upsellRow.precoCheio : 0) : 0}
            precoBase={selectedRow?.precoEspecial ?? 0}
            upsellLabel={upsellRow?.produto}
            upsellPrice={upsellOn && upsellRow ? upsellRow.precoEspecial : 0}
            vertical={vertical}
            eventDiscount={settings.eventDiscounts[vertical]}
            cashDiscountPct={settings.cashDiscountPercent}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 860px) {
          .calc2-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Dialog de configurações — só abre se isAdmin (dupla proteção) */}
      {isAdmin && showSettings && (
        <SettingsDialog settings={settings} onSave={setSettings} onReset={reset} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
