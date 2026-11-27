'use client'
import { useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { maskMoneyTyped, moneyFieldText } from '@/lib/dashboard/moneyMask'
import { fmtReais } from '@/lib/dashboard/yoy'
import type { AjusteRadar } from '@/lib/dashboard/projecao'

// Painel "Configurar": a Meta do Radar do mês e o ajuste manual do plano (fixa a meta planejada de um dia; a diferença vai para outro dia).
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export function MetaRadarEditor({ meta, cadastrada, ajustes, dias, onSaved }: { meta: number; cadastrada: number; ajustes: AjusteRadar[]; dias: { date: string; wd: string; planejada: number }[]; onSaved: () => void }) {
  const [aberto, setAberto] = useState(false), [texto, setTexto] = useState(''), [valor, setValor] = useState<number | undefined>(undefined)
  const [aDia, setADia] = useState(''), [aPara, setAPara] = useState(''), [aTxt, setATxt] = useState(''), [aVal, setAVal] = useState<number | undefined>(undefined)
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState('')
  const abrir = () => { setTexto(moneyFieldText(meta || cadastrada)); setValor(meta || cadastrada); setADia(dias[0]?.date ?? ''); setAPara(dias[dias.length - 1]?.date ?? ''); setATxt(''); setAVal(undefined); setErro(''); setAberto(true) }
  const enviar = async (corpo: object) => {
    setSalvando(true); setErro('')
    try {
      const r = await fetch('/api/dashboard/radar-meta', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j?.error || 'Não foi possível salvar.'); return false }
      onSaved(); return true
    } catch { setErro('Sem conexão. Tente de novo.'); return false } finally { setSalvando(false) }
  }
  const salvarMeta = async () => { if (!valor || valor <= 0) { setErro('Informe um valor maior que zero.'); return } if (await enviar({ meta: valor })) setAberto(false) }
  const addAjuste = async () => {
    if (!aDia || !aPara || aDia === aPara) { setErro('Escolha dois dias diferentes.'); return }
    if (aVal === undefined) { setErro('Informe a meta do dia.'); return }
    const lista = [...ajustes.filter(a => a.dia !== aDia), { dia: aDia, planejada: aVal, para: aPara }]
    if (await enviar({ ajustes: lista })) { setATxt(''); setAVal(undefined) }
  }
  return (
    <>
      <button type="button" className="rd-cfgbtn" onClick={() => (aberto ? setAberto(false) : abrir())} aria-expanded={aberto} data-testid="radar-meta-editar"><Settings2 size={15} aria-hidden /> Configurar</button>
      {aberto && (
        <div className="rd-cfg" data-testid="radar-meta-editor" role="group" aria-label="Configurar o Radar">
          <div className="rd-cfgrow">
            <label>Meta do Radar<input inputMode="decimal" value={texto} data-testid="radar-meta-input" onChange={e => { const m = maskMoneyTyped(e.target.value); setTexto(m.text); setValor(m.value) }} onKeyDown={e => { if (e.key === 'Enter') salvarMeta() }} /></label>
            <button type="button" className="rd-primary" onClick={salvarMeta} disabled={salvando} data-testid="radar-meta-salvar">{salvando ? 'Salvando…' : 'Salvar meta'}</button>
            {cadastrada > 0 && <small>Nos outros painéis a meta continua {fmtReais(cadastrada)}.</small>}
          </div>
          <div className="rd-cfgsep" />
          <div className="rd-cfgtit">Ajuste manual do plano</div>
          {ajustes.length === 0 && <small>Nenhum ajuste.</small>}
          {ajustes.map(a => (
            <span key={a.dia} className="rd-chip" data-testid="radar-ajuste">{dm(a.dia)} fixado em <b>{fmtReais(a.planejada)}</b> · o resto vai para {dm(a.para)}
              <button type="button" aria-label={`Remover o ajuste de ${dm(a.dia)}`} disabled={salvando} onClick={() => enviar({ ajustes: ajustes.filter(x => x.dia !== a.dia) })}><X size={13} /></button></span>
          ))}
          <div className="rd-cfgrow">
            <label>Dia<select value={aDia} onChange={e => setADia(e.target.value)}>{dias.map(x => <option key={x.date} value={x.date}>{dm(x.date)} {x.wd}</option>)}</select></label>
            <label>Meta do dia<input inputMode="decimal" value={aTxt} onChange={e => { const m = maskMoneyTyped(e.target.value); setATxt(m.text); setAVal(m.value) }} placeholder="R$" /></label>
            <label>O resto vai para<select value={aPara} onChange={e => setAPara(e.target.value)}>{dias.map(x => <option key={x.date} value={x.date}>{dm(x.date)} {x.wd}</option>)}</select></label>
            <button type="button" onClick={addAjuste} disabled={salvando}>Adicionar</button>
          </div>
          {erro && <em role="alert" className="rd-err">{erro}</em>}
        </div>
      )}
    </>
  )
}
