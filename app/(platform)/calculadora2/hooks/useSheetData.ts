'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PriceRow, AppSettings } from '../lib/types'
import { parseBRL } from '../lib/pricing'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur = '', inQ = false
  const row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      row.push(cur); cur = ''
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      row.push(cur); cur = ''
      if (row.some(c => c.trim())) rows.push([...row])
      row.length = 0
      if (ch === '\r' && text[i + 1] === '\n') i++
    } else { cur += ch }
  }
  if (cur || row.length) { row.push(cur); if (row.some(c => c.trim())) rows.push(row) }
  return rows
}

// Filtra produtos com "3x" no nome — usados apenas para integrações externas
function is3xProduct(nome: string): boolean {
  return /\b3x\b/i.test(nome)
}

function rowToModel(cols: string[], map: Record<string, number>): PriceRow | null {
  const get = (k: string) => (cols[map[k]] ?? '').trim()
  const vertical  = get('vertical')
  const produto   = get('produto')
  if (!vertical || !produto) return null
  if (is3xProduct(produto)) return null           // ← filtro de 3x
  return {
    vertical,
    produto,
    tempoAcesso:   get('tempoAcesso'),
    tipoAluno:     get('tipoAluno'),
    canalVenda:    get('canalVenda'),
    precoCheio:    parseBRL(get('precoCheio')),
    precoEspecial: parseBRL(get('precoEspecial')),
  }
}

const REFRESH_MS = 60_000

export function useSheetData(settings: AppSettings, settingsLoaded: boolean) {
  const [rows,    setRows]    = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = useCallback(async () => {
    const url = settings.spreadsheetUrl?.trim()
    if (!url) { setRows([]); setError(null); return }
    setLoading(true); setError(null)
    try {
      const res  = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const all  = parseCSV(text)
      const data = all.slice(1)
        .map(cols => rowToModel(cols, settings.columnMap))
        .filter(Boolean) as PriceRow[]
      setRows(data)
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar planilha')
    } finally {
      setLoading(false)
    }
  }, [settings.spreadsheetUrl, settings.columnMap])

  useEffect(() => {
    if (!settingsLoaded) return
    fetch_()
    timerRef.current = setInterval(fetch_, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetch_, settingsLoaded])

  return { rows, loading, error, refresh: fetch_ }
}
