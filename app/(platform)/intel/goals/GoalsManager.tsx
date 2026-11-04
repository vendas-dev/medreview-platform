'use client'
import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Target, ChevronLeft, ChevronRight, Save, Check, Loader2, Search, LayoutList, LayoutGrid, Copy, RotateCcw, AlertTriangle, Wallet, Users, PencilLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ══ Metas (por closer, geral da empresa e por vertical) ═══════════════════════════════════════════════════
// • A lista é AGRUPADA POR TIME: OAO só mostra Anest · Oft · Ortop; R1 só mostra Med R1 (nada de coluna vazia).
// • A meta de EMBAIXADORES está pausada: some da tela, mas o valor já gravado é preservado ao salvar.
// • Foto e situação (ativo/inativo/excluído) vêm direto de profiles: inativo e excluído nunca aparecem.
// • Desempenho: cada linha é memorizada — digitar numa linha NÃO redesenha as outras; só a lista ou os cartões existem no DOM (nunca os dois).

const ALL_VERTICALS = ['Anest-Review', 'Oft-Review', 'Ortop-Review', 'Med-Review R1']
const VERT_SHORT: Record<string, string> = { 'Anest-Review': 'Anest', 'Oft-Review': 'Oft', 'Ortop-Review': 'Ortop', 'Med-Review R1': 'Med R1' }
type TeamKey = 'OAO' | 'R1' | 'OUTROS'
const TEAMS: { key: TeamKey; label: string; verticals: string[]; color: string }[] = [
  { key: 'OAO', label: 'Time OAO', verticals: ['Anest-Review', 'Oft-Review', 'Ortop-Review'], color: '#2563eb' },
  { key: 'R1', label: 'Time R1', verticals: ['Med-Review R1'], color: '#7c3aed' },
  { key: 'OUTROS', label: 'Sem time', verticals: [], color: '#64748b' },
]
const teamOf = (c: any): TeamKey => (c.team === 'OAO' ? 'OAO' : c.team === 'R1' ? 'R1' : 'OUTROS')

// ── dinheiro ────────────────────────────────────────────────
const fmtNum = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBRL = (n: number) => 'R$ ' + fmtNum(n)
const fmtShort = (n: number) => (n >= 1e6 ? `R$ ${(n / 1e6).toFixed(2).replace('.', ',')} mi` : fmtBRL(n))
const maskDigits = (raw: string) => { const d = raw.replace(/\D/g, ''); return d ? fmtNum(parseInt(d, 10) / 100) : '' }
const parseMasked = (v: string) => { const d = v.replace(/\D/g, ''); return d ? parseInt(d, 10) / 100 : 0 }

function MoneyField({ value, onChange, cell, label, dirty = false, onNav }: { value: number; onChange: (v: number) => void; cell?: string; label?: string; dirty?: boolean; onNav?: (dir: -1 | 1) => void }) {
  const [display, setDisplay] = useState(value > 0 ? fmtNum(value) : '')
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setDisplay(value > 0 ? fmtNum(value) : '') }, [value, focused])
  return (
    <label className="gm-money" data-dirty={dirty ? '1' : '0'}>
      <span className="gm-money-pre">R$</span>
      <input type="text" inputMode="numeric" data-cell={cell} aria-label={label} placeholder="0,00" value={display}
        onChange={e => { const m = maskDigits(e.target.value); setDisplay(m); onChange(parseMasked(m)) }}
        onFocus={e => { setFocused(true); e.target.select() }} onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); onNav?.(1) } else if (e.key === 'ArrowUp') { e.preventDefault(); onNav?.(-1) } }} />
    </label>
  )
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const [bad, setBad] = useState(false)
  const ini = (name || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
  if (url && !bad) return <img src={url} alt={name} onError={() => setBad(true)} data-avatar="img" className="gm-av" style={{ width: size, height: size }} />
  return <div data-avatar="ini" className="gm-av gm-av-ini" style={{ width: size, height: size, fontSize: size * 0.36 }}>{ini}</div>
}

// ── rascunho de um closer (tela) × base (salvo). goalAmbassador NÃO é editável (pausado): só viaja de volta no salvar ──
type Draft = { goalSales: number; goalAmbassador: number; byV: Record<string, number> }
const toDraft = (c: any): Draft => ({ goalSales: Number(c.goal?.goal_sales) || 0, goalAmbassador: Number(c.goal?.goal_ambassador) || 0, byV: Object.fromEntries(Object.entries(c.goal?.goals_by_vertical ?? {}).map(([k, v]) => [k, Number(v) || 0])) })
const buildAll = (list: any[]) => Object.fromEntries(list.map(c => [c.id, toDraft(c)])) as Record<string, Draft>
const same = (a: Draft, b: Draft) => a.goalSales === b.goalSales && ALL_VERTICALS.every(v => (a.byV[v] || 0) === (b.byV[v] || 0))
const hiddenByFlag = (c: any) => c.is_active === false || !!c.deleted_at || c.status === 'inactive' || c.status === 'deleted'
type RowSt = { status: 'saving' | 'saved' | 'error'; msg?: string }
const EMPTY: Draft = { goalSales: 0, goalAmbassador: 0, byV: {} }

function useNarrow() {
  const [n, setN] = useState(false)
  useEffect(() => { const m = window.matchMedia('(max-width: 899px)'); const f = () => setN(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

function SaveBtn({ dirty, st, onClick, disabled }: { dirty: boolean; st?: RowSt; onClick: () => void; disabled?: boolean }) {
  const saved = st?.status === 'saved', saving = st?.status === 'saving'
  return (
    <button type="button" className="gm-save" data-v="row-save" data-state={saved ? 'saved' : dirty ? 'dirty' : 'idle'} disabled={!dirty || saving || disabled} onClick={onClick}>
      {saving ? <Loader2 size={13} className="gm-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}{saving ? 'Salvando' : saved ? 'Salvo' : 'Salvar'}
    </button>
  )
}

// ── linha da lista (memorizada) ────────────────────────────────────────────────────────────────────────────
const GoalRow = memo(function GoalRow({ c, d, b, st, dirty, verts, avatar, r, bulk, onField, onSave, onNav }: { c: any; d: Draft; b: Draft; st?: RowSt; dirty: boolean; verts: string[]; avatar?: string | null; r: number; bulk: boolean; onField: (id: string, key: string, v: number) => void; onSave: (id: string) => void; onNav: (r: number, col: string, dir: -1 | 1) => void }) {
  const empty = d.goalSales === 0 && verts.every(v => !(d.byV[v] > 0))
  const nr = useRef(0); nr.current++          // contador de renderizações (prova de desempenho: linha que não mudou NÃO re-renderiza)
  return (
    <div className="gm-row" role="row" data-v="goals-row" data-id={c.id} data-dirty={dirty ? '1' : '0'} data-renders={nr.current}>
      <div className="gm-who">
        <Avatar name={c.name} url={avatar ?? c.avatar_url} size={40} />
        <div className="gm-who-t"><p data-v="goals-name">{c.name}</p><span className={empty ? 'gm-pill gm-pill-warn' : 'gm-pill gm-pill-ok'}>{empty ? 'Sem meta' : dirty ? 'Editando' : 'Meta definida'}</span></div>
      </div>
      <div className="gm-cell" data-label="Meta geral"><MoneyField value={d.goalSales} dirty={d.goalSales !== b.goalSales} onChange={v => onField(c.id, 'geral', v)} cell={`${r}:geral`} label={`Meta geral de ${c.name}`} onNav={dir => onNav(r, 'geral', dir)} /></div>
      {verts.map(v => (
        <div className="gm-cell" key={v} data-label={VERT_SHORT[v]}><MoneyField value={d.byV[v] || 0} dirty={(d.byV[v] || 0) !== (b.byV[v] || 0)} onChange={val => onField(c.id, v, val)} cell={`${r}:${v}`} label={`${v} de ${c.name}`} onNav={dir => onNav(r, v, dir)} /></div>
      ))}
      <div className="gm-act">
        <SaveBtn dirty={dirty} st={st} onClick={() => onSave(c.id)} disabled={bulk} />
        {st?.status === 'error' && <span data-v="row-erro" className="gm-err" title={st.msg}><AlertTriangle size={11} />{st.msg}</span>}
      </div>
    </div>
  )
})

// ── cartão (memorizado) ─────────────────────────────────────────────────────────────────────────────────────
const GoalCard = memo(function GoalCard({ c, d, b, st, dirty, verts, avatar, r, bulk, color, onField, onSave }: { c: any; d: Draft; b: Draft; st?: RowSt; dirty: boolean; verts: string[]; avatar?: string | null; r: number; bulk: boolean; color: string; onField: (id: string, key: string, v: number) => void; onSave: (id: string) => void }) {
  return (
    <div className="gm-card" data-v="goals-card" data-id={c.id} data-dirty={dirty ? '1' : '0'} style={{ ['--tc' as any]: color }}>
      <div className="gm-card-h">
        <Avatar name={c.name} url={avatar ?? c.avatar_url} size={52} />
        <div className="gm-who-t" style={{ flex: 1 }}><p>{c.name}</p><span className="gm-pill" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{c.team ? `Time ${c.team}` : 'Sem time'}</span></div>
        <SaveBtn dirty={dirty} st={st} onClick={() => onSave(c.id)} disabled={bulk} />
      </div>
      <div className="gm-card-b">
        {st?.status === 'error' && <p data-v="row-erro" className="gm-err gm-err-box"><AlertTriangle size={12} />{st.msg}</p>}
        <div><span className="gm-lab">Meta geral de vendas</span><MoneyField value={d.goalSales} dirty={d.goalSales !== b.goalSales} onChange={v => onField(c.id, 'geral', v)} cell={`c${r}:geral`} label={`Meta geral de ${c.name}`} /></div>
        {verts.length > 0 && <div className="gm-card-v"><span className="gm-lab">Meta por vertical</span>{verts.map(v => <div key={v} className="gm-card-vr"><span>{VERT_SHORT[v]}</span><MoneyField value={d.byV[v] || 0} dirty={(d.byV[v] || 0) !== (b.byV[v] || 0)} onChange={val => onField(c.id, v, val)} cell={`c${r}:${v}`} label={`${v} de ${c.name}`} /></div>)}</div>}
      </div>
    </div>
  )
})

// ── Painel de Meta Geral / Metas por Vertical (empresa) — mesma lógica de sempre: salva e CONFIRMA lendo de volta do banco ──
function CompanyGoalsPanel({ mode, month, initialGoals }: { mode: 'geral' | 'vertical'; month: string; initialGoals: Record<string, number> }) {
  const [geral, setGeral] = useState<number>(Number(initialGoals['geral']) || 0)
  const [byVertical, setByVertical] = useState<Record<string, number>>(Object.fromEntries(ALL_VERTICALS.map(v => [v, Number(initialGoals[v]) || 0])))
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState(''), [confirmedAt, setConfirmedAt] = useState<string | null>(null)
  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const goals = mode === 'geral' ? { geral } : { ...byVertical }
      const res = await fetch('/api/intel/company-goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, goals }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
      const check = await fetch(`/api/intel/company-goals?month=${month}`)
      const checkData = await check.json().catch(() => ({ goals: {} }))
      const persisted = mode === 'geral' ? Number(checkData.goals?.geral) === geral : ALL_VERTICALS.every(v => Number(checkData.goals?.[v] ?? 0) === (byVertical[v] ?? 0))
      if (!persisted) { setError('Salvou, mas a confirmação não bateu — tenta recarregar a página pra checar.'); return }
      setSaved(true); setConfirmedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })); setTimeout(() => setSaved(false), 3000)
    } catch { setError('Erro de conexão') } finally { setSaving(false) }
  }
  const isGeral = mode === 'geral'
  const grad = isGeral ? 'linear-gradient(135deg,#0f766e 0%,#0d9488 55%,#16a34a 100%)' : 'linear-gradient(135deg,#7c2d12 0%,#c2410c 55%,#f59e0b 100%)'
  return (
    <div data-v="company-panel" className="gm-panel">
      <div className="gm-panel-h" style={{ background: grad }}>
        <p>{isGeral ? '🎯 Qual é o norte da empresa esse mês?' : '📊 Onde cada vertical precisa chegar'}</p>
        <span>{isGeral ? 'Essa é a meta que todo o time olha — alimenta o "Meta x Realizado" e o forecast de fechamento do mês.' : 'Cada vertical com sua própria meta — alimenta qualquer análise que compare uma vertical específica no sistema.'}</span>
      </div>
      <div className="gm-panel-b">
        {error && <p data-v="company-error" className="gm-err gm-err-box"><AlertTriangle size={12} />{error}</p>}
        {isGeral ? (
          <div><span className="gm-lab">Meta do mês (empresa)</span><MoneyField value={geral} onChange={setGeral} label="Meta do mês (empresa)" cell="geral" /></div>
        ) : (
          <div className="gm-panel-v">{ALL_VERTICALS.map(v => <div key={v}><span>{v}</span><MoneyField value={byVertical[v] ?? 0} onChange={val => setByVertical(prev => ({ ...prev, [v]: val }))} label={v} cell={v} /></div>)}</div>
        )}
        <div className="gm-panel-f">
          <span>{confirmedAt ? `✅ Confirmado no banco às ${confirmedAt}` : 'Ainda não salvo esse mês'}</span>
          <button type="button" data-v="company-save" className="gm-btn" onClick={handleSave} disabled={saving} style={{ background: saved ? '#16a34a' : grad }}>
            {saving ? <Loader2 size={14} className="gm-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}{saving ? 'Salvando...' : saved ? 'Confirmado!' : 'Salvar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GoalsManager ────────────────────────────────────────────
export function GoalsManager({ closers: initialClosers, month: initialMonth, companyGoals: initialCompanyGoals }: { closers: any[]; month: string; companyGoals: Record<string, number> }) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth)
  const [closers, setClosers] = useState<any[]>(initialClosers)
  const [companyGoals, setCompanyGoals] = useState(initialCompanyGoals)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [filterTeam, setFilterTeam] = useState<'todos' | 'R1' | 'OAO'>('todos')
  const [tab, setTab] = useState<'closers' | 'geral' | 'vertical'>('closers')
  const [view, setView] = useState<'lista' | 'cards'>('lista')
  const [query, setQuery] = useState('')
  const [base, setBase] = useState<Record<string, Draft>>(() => buildAll(initialClosers))
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => buildAll(initialClosers))
  const [rows, setRows] = useState<Record<string, RowSt>>({})
  const [bulk, setBulk] = useState(false)
  const [notice, setNotice] = useState('')
  const [info, setInfo] = useState<Record<string, { avatar_url: string | null; is_active: boolean | null }>>({})
  const [queried, setQueried] = useState<Set<string>>(new Set())
  const [infoFailed, setInfoFailed] = useState(false)
  const narrow = useNarrow()
  const timers = useRef<number[]>([])
  const draftsRef = useRef(drafts), baseRef = useRef(base), monthRef = useRef(currentMonth)
  draftsRef.current = drafts; baseRef.current = base; monthRef.current = currentMonth
  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)) }, [])

  useEffect(() => {
    const faltam = closers.map(c => c.id).filter(id => !queried.has(id))
    if (faltam.length === 0) return
    let off = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('profiles').select('id, avatar_url, is_active').in('id', faltam)
        if (off) return
        if (error || !data) { setInfoFailed(true); setQueried(prev => new Set([...prev, ...faltam])); return }
        setInfo(prev => ({ ...prev, ...Object.fromEntries((data as any[]).map(p => [p.id, { avatar_url: p.avatar_url ?? null, is_active: p.is_active ?? null }])) }))
        setQueried(prev => new Set([...prev, ...faltam]))
      } catch { if (!off) { setInfoFailed(true); setQueried(prev => new Set([...prev, ...faltam])) } }
    })()
    return () => { off = true }
  }, [closers, queried])

  const infoReady = closers.every(c => queried.has(c.id))
  const visible = useMemo(() => closers.filter(c => {
    if (hiddenByFlag(c)) return false
    if (!infoFailed && queried.has(c.id) && !info[c.id]) return false          // não existe mais em profiles = excluído
    if (info[c.id]?.is_active === false) return false
    return true
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')), [closers, info, queried, infoFailed])
  const hiddenCount = closers.length - visible.length

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => visible.filter(c => (filterTeam === 'todos' || c.team === filterTeam) && (!q || String(c.name).toLowerCase().includes(q))), [visible, filterTeam, q])
  const countTeam = (t: string) => visible.filter(c => c.team === t).length
  const dirtySet = useMemo(() => new Set(visible.filter(c => drafts[c.id] && base[c.id] && !same(drafts[c.id], base[c.id])).map(c => c.id)), [visible, drafts, base])
  const dirtyIds = useMemo(() => visible.filter(c => dirtySet.has(c.id)).map(c => c.id), [visible, dirtySet])
  const [y, m] = currentMonth.split('-').map(Number)
  const monthLabel = (l => l.charAt(0).toUpperCase() + l.slice(1))(new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

  // agrupa por time (só mostra o time que tem gente)
  const groups = useMemo(() => {
    let r = 0
    return TEAMS.map(t => ({ ...t, members: filtered.filter(c => teamOf(c) === t.key) })).filter(g => g.members.length > 0).map(g => ({ ...g, items: g.members.map(c => ({ c, r: r++ })) }))
  }, [filtered])

  const onField = useCallback((id: string, key: string, v: number) => {
    setDrafts(prev => { const cur = prev[id] ?? EMPTY; return { ...prev, [id]: key === 'geral' ? { ...cur, goalSales: v } : { ...cur, byV: { ...cur.byV, [key]: v } } } })
    setRows(prev => (prev[id] ? (() => { const n = { ...prev }; delete n[id]; return n })() : prev))
  }, [])

  const saveOne = useCallback(async (id: string): Promise<boolean> => {
    const d = draftsRef.current[id]; if (!d) return false
    const month = monthRef.current, b0 = baseRef.current[id]
    setRows(prev => ({ ...prev, [id]: { status: 'saving' } }))
    try {
      const res = await fetch('/api/intel/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id, month, goal_sales: d.goalSales, goal_ambassador: b0?.goalAmbassador ?? d.goalAmbassador, goals_by_vertical: { ...(b0?.byV ?? {}), ...d.byV } }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setRows(prev => ({ ...prev, [id]: { status: 'error', msg: data.error ?? 'Erro ao salvar' } })); return false }
      setBase(prev => ({ ...prev, [id]: { goalSales: d.goalSales, goalAmbassador: prev[id]?.goalAmbassador ?? d.goalAmbassador, byV: { ...(prev[id]?.byV ?? {}), ...d.byV } } }))
      setRows(prev => ({ ...prev, [id]: { status: 'saved' } }))
      timers.current.push(window.setTimeout(() => setRows(prev => (prev[id]?.status === 'saved' ? (() => { const n = { ...prev }; delete n[id]; return n })() : prev)), 3000))
      return true
    } catch { setRows(prev => ({ ...prev, [id]: { status: 'error', msg: 'Erro de conexão' } })); return false }
  }, [])

  async function changeMonth(delta: number) {
    if (dirtyIds.length > 0 && !window.confirm(`Há ${dirtyIds.length} linha${dirtyIds.length > 1 ? 's' : ''} com alterações NÃO salvas. Trocar de mês descarta essas alterações. Continuar?`)) return
    const [cy, cm] = currentMonth.split('-').map(Number)
    const d = new Date(cy, cm - 1 + delta, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setLoadingMonth(true)
    try {
      const [res, resCompany] = await Promise.all([fetch(`/api/intel/goals?month=${newMonth}`), fetch(`/api/intel/company-goals?month=${newMonth}`)])
      const data = await res.json()
      const dataCompany = await resCompany.json().catch(() => ({ goals: {} }))
      const list = data.closers ?? []
      setClosers(list); setBase(buildAll(list)); setDrafts(buildAll(list)); setRows({}); setNotice('')
      setCompanyGoals(dataCompany.goals ?? {}); setCurrentMonth(newMonth)
    } catch { /* mantém o mês atual se falhar */ } finally { setLoadingMonth(false) }
  }
  async function saveAll() {
    setBulk(true); setNotice('')
    let ok = 0, fail = 0
    for (const id of dirtyIds) { if (await saveOne(id)) ok++; else fail++ }
    setBulk(false)
    setNotice(fail === 0 ? `✅ ${ok} ${ok === 1 ? 'meta salva' : 'metas salvas'}.` : `⚠ ${ok} salva${ok === 1 ? '' : 's'}, ${fail} com erro — veja as linhas marcadas.`)
  }
  const discardAll = () => { setDrafts(prev => ({ ...prev, ...Object.fromEntries(dirtyIds.map(id => [id, baseRef.current[id]])) })); setRows({}); setNotice('') }

  async function fillFromPrevious() {
    const [cy, cm] = currentMonth.split('-').map(Number); const d = new Date(cy, cm - 2, 1)
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setNotice('')
    try {
      const res = await fetch(`/api/intel/goals?month=${prev}`); const data = await res.json()
      const before = Object.fromEntries(((data.closers ?? []) as any[]).map(c => [c.id, toDraft(c)])) as Record<string, Draft>
      setDrafts(cur => { const next = { ...cur }
        for (const c of visible) { const p = before[c.id], now = cur[c.id]; if (!p || !now) continue
          const nd: Draft = { goalSales: now.goalSales || p.goalSales, goalAmbassador: now.goalAmbassador, byV: { ...now.byV } }
          for (const v of TEAMS.find(t => t.key === teamOf(c))!.verticals) if (!nd.byV[v]) nd.byV[v] = p.byV[v] || 0
          if (!same(nd, now)) next[c.id] = nd }
        return next })
      setNotice(`Preenchi os campos vazios com os valores de ${new Date(d).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Confira e salve.`)
    } catch { setNotice('⚠ Não consegui buscar o mês anterior.') }
  }

  const onNav = useCallback((r: number, col: string, dir: -1 | 1) => {
    for (let k = r + dir; k >= 0 && k < 500; k += dir) { const el = document.querySelector<HTMLInputElement>(`[data-cell="${k}:${col}"]`); if (el) { el.focus(); return } }
  }, [])

  const totals = useMemo(() => {
    const t = { geral: 0, filled: 0, byTeam: {} as Record<string, { geral: number; byV: Record<string, number> }> }
    for (const c of filtered) { const d = drafts[c.id]; if (!d) continue; const k = teamOf(c); const bt = (t.byTeam[k] ??= { geral: 0, byV: {} }); t.geral += d.goalSales; bt.geral += d.goalSales; if (d.goalSales > 0) t.filled++; for (const v of TEAMS.find(x => x.key === k)!.verticals) bt.byV[v] = (bt.byV[v] || 0) + (d.byV[v] || 0) }
    return t
  }, [filtered, drafts])

  const TABS = [{ key: 'closers' as const, label: 'Por closer', Icon: Users }, { key: 'geral' as const, label: 'Meta geral', Icon: Wallet }, { key: 'vertical' as const, label: 'Por vertical', Icon: Target }]
  const showCards = narrow || view === 'cards'
  const loading = loadingMonth || !infoReady

  return (
    <div className="gm">
      <style>{CSS}</style>
      <header className="gm-top">
        <div className="gm-logo"><Target size={22} color="#fff" /></div>
        <div className="gm-top-t"><h1>Metas</h1><p>Defina as metas do mês por closer, da empresa e por vertical. Cada mês é independente.</p></div>
        <div className="gm-month">
          <button type="button" onClick={() => changeMonth(-1)} disabled={loadingMonth} aria-label="Mês anterior" data-v="mes-ant"><ChevronLeft size={16} /></button>
          <span data-v="mes-label">{loadingMonth ? '...' : monthLabel}</span>
          <button type="button" onClick={() => changeMonth(1)} disabled={loadingMonth} aria-label="Próximo mês" data-v="mes-prox"><ChevronRight size={16} /></button>
        </div>
      </header>

      <div role="tablist" className="gm-tabs">
        {TABS.map(t => <button type="button" key={t.key} role="tab" aria-selected={tab === t.key} data-v={`tab-${t.key}`} onClick={() => setTab(t.key)}><t.Icon size={15} />{t.label}</button>)}
      </div>

      {tab === 'geral' && <CompanyGoalsPanel mode="geral" month={currentMonth} initialGoals={companyGoals} key={`geral-${currentMonth}`} />}
      {tab === 'vertical' && <CompanyGoalsPanel mode="vertical" month={currentMonth} initialGoals={companyGoals} key={`vertical-${currentMonth}`} />}

      {tab === 'closers' && (<>
        {!loading && visible.length > 0 && (
          <div className="gm-kpis" data-v="kpis">
            <div className="gm-kpi"><span>Meta geral somada</span><strong data-v="kpi-total">{fmtShort(totals.geral)}</strong><em>{filtered.length} {filtered.length === 1 ? 'closer' : 'closers'} na visão atual</em></div>
            <div className="gm-kpi"><span>Com meta definida</span><strong data-v="kpi-filled">{totals.filled} <small>de {filtered.length}</small></strong><div className="gm-bar"><i style={{ width: `${filtered.length ? (totals.filled / filtered.length) * 100 : 0}%` }} /></div></div>
            <div className="gm-kpi"><span>Alterações pendentes</span><strong data-v="kpi-dirty" data-warn={dirtyIds.length > 0 ? '1' : '0'}>{dirtyIds.length}</strong><em>{dirtyIds.length > 0 ? 'ainda não salvas' : 'tudo salvo'}</em></div>
          </div>
        )}

        <div className="gm-tools">
          <label className="gm-search"><Search size={15} /><input data-v="busca" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar closer…" aria-label="Buscar closer" /></label>
          <div className="gm-chips">
            {([{ key: 'todos', label: 'Todos', n: visible.length }, { key: 'OAO', label: 'OAO', n: countTeam('OAO') }, { key: 'R1', label: 'R1', n: countTeam('R1') }] as const).map(t => (
              <button type="button" key={t.key} data-v={`time-${t.key}`} aria-pressed={filterTeam === t.key} onClick={() => setFilterTeam(t.key)}>{t.label}<b>{t.n}</b></button>
            ))}
          </div>
          <div className="gm-tools-r">
            <button type="button" className="gm-ghost" data-v="repetir" onClick={fillFromPrevious} title="Completa só os campos vazios com os valores do mês anterior (você confere e salva)"><Copy size={14} />Preencher vazios com o mês anterior</button>
            {!narrow && <div className="gm-seg">
              {([{ k: 'lista', Icon: LayoutList, l: 'Lista' }, { k: 'cards', Icon: LayoutGrid, l: 'Cartões' }] as const).map(o => <button type="button" key={o.k} data-v={`view-${o.k}`} aria-pressed={view === o.k} onClick={() => setView(o.k)}><o.Icon size={14} />{o.l}</button>)}
            </div>}
          </div>
        </div>
        {notice && <p data-v="aviso" className="gm-notice" data-warn={notice.startsWith('⚠') ? '1' : '0'}>{notice}</p>}

        {loading ? (
          <div data-v="carregando" className="gm-empty"><Loader2 size={28} className="gm-spin" /><p>Carregando metas...</p></div>
        ) : groups.length === 0 ? (
          <div data-v="vazio" className="gm-empty"><Target size={36} style={{ opacity: .3 }} /><p>Nenhum consultor encontrado.</p></div>
        ) : groups.map(g => {
          const bt = totals.byTeam[g.key] ?? { geral: 0, byV: {} }
          const cols = `270px repeat(${1 + g.verticals.length}, 160px) minmax(112px,1fr)`
          return (
            <section key={g.key} className="gm-sec" data-v="grupo" data-team={g.key} style={{ ['--tc' as any]: g.color }}>
              <div className="gm-sec-h">
                <span className="gm-dot" /><h2>{g.label}</h2><span className="gm-count">{g.members.length} {g.members.length === 1 ? 'closer' : 'closers'}</span>
                <span className="gm-sec-sum">Meta geral do time <b data-v="total-geral">{fmtShort(bt.geral)}</b></span>
              </div>
              {showCards ? (
                <div className="gm-cards" data-v="cards">
                  {g.items.map(({ c, r }) => <GoalCard key={`${c.id}-${currentMonth}`} c={c} r={r} d={drafts[c.id] ?? EMPTY} b={base[c.id] ?? EMPTY} st={rows[c.id]} dirty={dirtySet.has(c.id)} verts={g.verticals} avatar={info[c.id]?.avatar_url} bulk={bulk} color={g.color} onField={onField} onSave={saveOne} />)}
                </div>
              ) : (
                <div className="gm-scroll" data-v="lista" role="table">
                  <div className="gm-grid" style={{ ['--cols' as any]: cols }}>
                    <div className="gm-row gm-head" role="row"><span>Closer</span><span>Meta geral</span>{g.verticals.map(v => <span key={v}>{VERT_SHORT[v]}</span>)}<span /></div>
                    {g.items.map(({ c, r }) => <GoalRow key={`${c.id}-${currentMonth}`} c={c} r={r} d={drafts[c.id] ?? EMPTY} b={base[c.id] ?? EMPTY} st={rows[c.id]} dirty={dirtySet.has(c.id)} verts={g.verticals} avatar={info[c.id]?.avatar_url} bulk={bulk} onField={onField} onSave={saveOne} onNav={onNav} />)}
                    <div className="gm-row gm-foot" role="row" data-v="totais"><span>Total do time</span><span data-v="foot-geral">{fmtShort(bt.geral)}</span>{g.verticals.map(v => <span key={v} data-v={`total-${v}`}>{bt.byV[v] ? fmtShort(bt.byV[v]) : '—'}</span>)}<span /></div>
                  </div>
                </div>
              )}
            </section>
          )
        })}

        {hiddenCount > 0 && !loading && <p data-v="ocultos" className="gm-hidden">{hiddenCount} usuário{hiddenCount > 1 ? 's' : ''} inativo{hiddenCount > 1 ? 's' : ''} ou excluído{hiddenCount > 1 ? 's' : ''} não aparece{hiddenCount > 1 ? 'm' : ''} aqui (as metas já gravadas continuam valendo).</p>}

        {dirtyIds.length > 0 && (
          <div data-v="barra-salvar" className="gm-savebar">
            <PencilLine size={16} /><span data-v="barra-info">{dirtyIds.length} {dirtyIds.length === 1 ? 'linha alterada' : 'linhas alteradas'} · não salvas</span>
            <button type="button" data-v="descartar" onClick={discardAll} disabled={bulk} className="gm-sb-ghost"><RotateCcw size={13} />Descartar</button>
            <button type="button" data-v="salvar-todas" onClick={saveAll} disabled={bulk} className="gm-sb-main">{bulk ? <Loader2 size={13} className="gm-spin" /> : <Save size={13} />}{bulk ? 'Salvando…' : 'Salvar todas'}</button>
          </div>
        )}
      </>)}
    </div>
  )
}

const CSS = `
.gm{--ac:#6366f1;--ac2:#8b5cf6;max-width:1240px;margin:0 auto;padding:32px 28px 110px;display:flex;flex-direction:column;gap:22px;color:var(--foreground)}
.gm *{box-sizing:border-box}
.gm-spin{animation:gmspin 1s linear infinite}@keyframes gmspin{to{transform:rotate(360deg)}}
.gm-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.gm-logo{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,var(--ac),var(--ac2));display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(99,102,241,.35)}
.gm-top-t{flex:1;min-width:240px}.gm-top-t h1{margin:0;font-size:26px;font-weight:900;letter-spacing:-.03em}.gm-top-t p{margin:3px 0 0;font-size:13.5px;color:var(--muted-foreground)}
.gm-month{display:flex;align-items:center;gap:4px;padding:5px;background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.gm-month span{min-width:158px;text-align:center;font-size:14px;font-weight:800}
.gm-month button{width:34px;height:34px;border:none;border-radius:11px;background:var(--secondary);color:var(--foreground);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.gm-month button:hover:not(:disabled){background:color-mix(in srgb,var(--ac) 14%,var(--secondary))}
.gm-tabs{display:inline-flex;gap:4px;padding:5px;background:var(--secondary);border:1px solid var(--border);border-radius:16px;width:fit-content;max-width:100%;overflow-x:auto}
.gm-tabs button{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 18px;border:none;border-radius:12px;background:transparent;color:var(--muted-foreground);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}
.gm-tabs button[aria-selected="true"]{background:var(--card);color:var(--ac);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.gm-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.gm-kpi{padding:18px 20px;background:var(--card);border:1px solid var(--border);border-radius:18px;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.gm-kpi span{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.gm-kpi strong{font-size:26px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.gm-kpi strong small{font-size:14px;font-weight:600;color:var(--muted-foreground)}
.gm-kpi strong[data-warn="1"]{color:#d97706}.gm-kpi em{font-style:normal;font-size:12px;color:var(--muted-foreground)}
.gm-bar{height:7px;border-radius:99px;background:var(--secondary);overflow:hidden}.gm-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ac),var(--ac2));transition:width .3s}
.gm-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.gm-search{position:relative;flex:1 1 240px;max-width:340px;display:block}.gm-search svg{position:absolute;left:14px;top:13px;color:var(--muted-foreground)}
.gm-search input{width:100%;height:42px;padding:0 14px 0 40px;border:1px solid var(--border);border-radius:13px;background:var(--card);color:var(--foreground);font:inherit;font-size:13.5px;outline:none;transition:all .15s}
.gm-search input:focus{border-color:var(--ac);box-shadow:0 0 0 4px rgba(99,102,241,.14)}
.gm-chips{display:inline-flex;gap:6px}
.gm-chips button{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border:1px solid var(--border);border-radius:99px;background:var(--card);color:var(--muted-foreground);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.gm-chips button:hover{border-color:var(--ac);color:var(--ac)}.gm-chips button[aria-pressed="true"]{background:color-mix(in srgb,var(--ac) 12%,var(--card));border-color:var(--ac);color:var(--ac)}
.gm-chips button b{font-size:11px;padding:1px 8px;border-radius:99px;background:var(--secondary);color:var(--foreground)}
.gm-tools-r{margin-left:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.gm-ghost{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border:1px dashed color-mix(in srgb,var(--ac) 50%,var(--border));border-radius:12px;background:transparent;color:var(--ac);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.gm-ghost:hover{background:color-mix(in srgb,var(--ac) 8%,transparent)}
.gm-seg{display:inline-flex;padding:4px;background:var(--secondary);border:1px solid var(--border);border-radius:13px}
.gm-seg button{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 14px;border:none;border-radius:9px;background:transparent;color:var(--muted-foreground);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.gm-seg button[aria-pressed="true"]{background:var(--card);color:var(--ac);box-shadow:0 1px 3px rgba(0,0,0,.1)}
.gm-notice{margin:0;padding:11px 16px;border-radius:13px;font-size:13px;font-weight:600;color:#15803d;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28)}.gm-notice[data-warn="1"]{color:#b45309;background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3)}
.gm-sec{background:var(--card);border:1px solid var(--border);border-radius:22px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.04)}
.gm-sec-h{display:flex;align-items:center;gap:12px;padding:18px 22px;background:linear-gradient(135deg,color-mix(in srgb,var(--tc) 10%,transparent),transparent 70%);border-bottom:1px solid var(--border);flex-wrap:wrap}
.gm-dot{width:12px;height:12px;border-radius:50%;background:var(--tc);box-shadow:0 0 0 4px color-mix(in srgb,var(--tc) 22%,transparent)}
.gm-sec-h h2{margin:0;font-size:17px;font-weight:900;letter-spacing:-.01em}.gm-count{font-size:12.5px;font-weight:700;color:var(--muted-foreground)}
.gm-sec-sum{margin-left:auto;font-size:12.5px;color:var(--muted-foreground)}.gm-sec-sum b{margin-left:6px;font-size:15px;font-weight:900;color:var(--tc);font-variant-numeric:tabular-nums}
.gm-scroll{overflow-x:auto}.gm-grid{min-width:100%;width:max-content}
.gm-row{display:grid;grid-template-columns:var(--cols);gap:12px;align-items:center;padding:12px 22px;border-bottom:1px solid var(--border);transition:background .12s;position:relative}
.gm-row:not(.gm-head):not(.gm-foot):hover{background:color-mix(in srgb,var(--ac) 4%,transparent)}
.gm-row[data-dirty="1"]{background:color-mix(in srgb,#f59e0b 7%,transparent)}.gm-row[data-dirty="1"]::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:#f59e0b}
.gm-head{padding-top:11px;padding-bottom:11px;background:var(--secondary);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-foreground)}
.gm-foot{border-bottom:none;background:var(--secondary);font-weight:900;font-size:13.5px;font-variant-numeric:tabular-nums}.gm-foot span:first-child{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground)}
.gm-who{display:flex;align-items:center;gap:12px;min-width:0}.gm-who-t{min-width:0}.gm-who-t p{margin:0;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gm-pill{display:inline-block;margin-top:3px;padding:2px 9px;border-radius:99px;font-size:10.5px;font-weight:800;letter-spacing:.02em}.gm-pill-ok{background:rgba(34,197,94,.13);color:#15803d}.gm-pill-warn{background:rgba(148,163,184,.18);color:var(--muted-foreground)}
.gm-av{border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 2px var(--card),0 0 0 3.5px var(--border)}.gm-av-ini{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
.gm-money{display:flex;align-items:center;height:42px;padding:0 12px;border:1px solid var(--border);border-radius:12px;background:var(--background);transition:all .15s;cursor:text}
.gm-money:hover{border-color:color-mix(in srgb,var(--ac) 45%,var(--border))}.gm-money:focus-within{border-color:var(--ac);box-shadow:0 0 0 4px rgba(99,102,241,.14);background:var(--card)}
.gm-money[data-dirty="1"]{border-color:#f59e0b;background:color-mix(in srgb,#f59e0b 8%,var(--background))}
.gm-money-pre{font-size:12px;font-weight:800;color:var(--muted-foreground);margin-right:8px}
.gm-money input{flex:1;min-width:0;width:100%;border:none;outline:none;background:transparent;color:var(--foreground);font:inherit;font-size:14px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.gm-money input::placeholder{color:var(--muted-foreground);opacity:.45;font-weight:500}
.gm-act{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.gm-save{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border:none;border-radius:10px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:all .15s;background:var(--secondary);color:var(--muted-foreground);opacity:.65}
.gm-save[data-state="dirty"]{background:linear-gradient(135deg,var(--ac),var(--ac2));color:#fff;opacity:1;box-shadow:0 4px 12px rgba(99,102,241,.3)}.gm-save[data-state="saved"]{background:#16a34a;color:#fff;opacity:1}
.gm-save:disabled{cursor:default}.gm-save[data-state="dirty"]:hover:not(:disabled){transform:translateY(-1px)}
.gm-err{font-size:10.5px;font-weight:700;color:#ef4444;display:inline-flex;gap:3px;align-items:center}.gm-err-box{margin:0;padding:9px 12px;font-size:12px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22);border-radius:10px}
.gm-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px;padding:20px}
.gm-card{border:1px solid var(--border);border-radius:18px;overflow:hidden;background:var(--background);transition:box-shadow .15s}.gm-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.07)}.gm-card[data-dirty="1"]{border-color:#f59e0b}
.gm-card-h{display:flex;align-items:center;gap:13px;padding:16px 18px;background:linear-gradient(135deg,color-mix(in srgb,var(--tc) 10%,transparent),transparent);border-bottom:1px solid var(--border)}
.gm-card-b{padding:16px 18px;display:flex;flex-direction:column;gap:14px}.gm-lab{display:block;margin-bottom:7px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.gm-card-v{display:flex;flex-direction:column;gap:9px}.gm-card-vr{display:grid;grid-template-columns:64px 1fr;align-items:center;gap:10px}.gm-card-vr span{font-size:13px;font-weight:700}
.gm-empty{text-align:center;padding:64px 24px;color:var(--muted-foreground)}.gm-empty p{margin:12px 0 0;font-size:14px}
.gm-hidden{margin:0;text-align:center;font-size:12px;color:var(--muted-foreground)}
.gm-savebar{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:14px;padding:11px 12px 11px 20px;border-radius:18px;background:var(--foreground);color:var(--background);box-shadow:0 18px 44px rgba(0,0,0,.35);max-width:calc(100vw - 24px)}
.gm-savebar span{font-size:13.5px;font-weight:700}
.gm-sb-ghost,.gm-sb-main{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border-radius:11px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.gm-sb-ghost{background:transparent;color:inherit;border:1px solid rgba(128,128,128,.4)}.gm-sb-main{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none}
.gm-panel{max-width:600px;border-radius:22px;overflow:hidden;box-shadow:0 14px 36px rgba(0,0,0,.13)}
.gm-panel-h{padding:26px 28px;color:#fff}.gm-panel-h p{margin:0 0 6px;font-size:17px;font-weight:900}.gm-panel-h span{font-size:13px;opacity:.88;line-height:1.55;display:block}
.gm-panel-b{background:var(--card);border:1px solid var(--border);border-top:none;padding:24px 28px;display:flex;flex-direction:column;gap:18px}
.gm-panel-v{display:flex;flex-direction:column;gap:12px}.gm-panel-v>div{display:grid;grid-template-columns:1fr 1.3fr;align-items:center;gap:14px}.gm-panel-v span{font-size:14px;font-weight:700}
.gm-panel-f{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.gm-panel-f>span{font-size:12px;color:var(--muted-foreground)}
.gm-btn{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 20px;border:none;border-radius:12px;color:#fff;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:transform .12s}.gm-btn:hover:not(:disabled){transform:translateY(-1px)}
@media(max-width:899px){.gm{padding:22px 16px 110px}.gm-kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.gm-kpi{padding:12px}.gm-kpi strong{font-size:18px}.gm-kpi strong small,.gm-kpi em{display:none}.gm-kpi span{font-size:9.5px;letter-spacing:.03em}.gm-tools-r{margin-left:0;width:100%}.gm-sec-sum{margin-left:0;width:100%}.gm-cards{padding:14px;grid-template-columns:1fr}}
`
