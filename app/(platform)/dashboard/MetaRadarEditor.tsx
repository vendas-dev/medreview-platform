'use client'
import { useState } from 'react'
import { maskMoneyTyped, moneyFieldText } from '@/lib/dashboard/moneyMask'
import { fmtReais } from '@/lib/dashboard/yoy'

// Linha "Meta do Radar": o valor que o Radar, a rota e o hora a hora usam no mês. Edita e salva; depois pede ao Forecast para recarregar.
export function MetaRadarEditor({ meta, cadastrada, onSaved }: { meta: number; cadastrada: number; onSaved: () => void }) {
  const [editando, setEditando] = useState(false), [texto, setTexto] = useState(''), [valor, setValor] = useState<number | undefined>(undefined)
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState('')
  const abrir = () => { setTexto(moneyFieldText(meta || cadastrada)); setValor(meta || cadastrada); setErro(''); setEditando(true) }
  const salvar = async () => {
    if (!valor || valor <= 0) { setErro('Informe um valor maior que zero.'); return }
    setSalvando(true); setErro('')
    try {
      const r = await fetch('/api/dashboard/radar-meta', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meta: valor }) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j?.error || 'Não foi possível salvar.'); return }
      setEditando(false); onSaved()
    } catch { setErro('Sem conexão. Tente de novo.') } finally { setSalvando(false) }
  }
  return (
    <div className="ft-rmeta" data-testid="radar-meta-editor">
      <span>Meta do Radar: <b data-testid="radar-meta-valor">{fmtReais(meta || cadastrada)}</b>{meta > 0 && cadastrada > 0 && meta !== cadastrada ? <small> (meta cadastrada nos outros painéis: {fmtReais(cadastrada)})</small> : null}</span>
      {!editando ? <button type="button" onClick={abrir} data-testid="radar-meta-editar">Editar</button> : (
        <span className="ft-rmeta-f">
          <input inputMode="decimal" aria-label="Meta do Radar em reais" value={texto} data-testid="radar-meta-input" onChange={e => { const m = maskMoneyTyped(e.target.value); setTexto(m.text); setValor(m.value) }} onKeyDown={e => { if (e.key === 'Enter') salvar() }} />
          <button type="button" onClick={salvar} disabled={salvando} data-testid="radar-meta-salvar">{salvando ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" onClick={() => setEditando(false)} disabled={salvando}>Cancelar</button>
          {erro && <em role="alert">{erro}</em>}
        </span>
      )}
    </div>
  )
}
