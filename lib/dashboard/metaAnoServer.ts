import { DB_VERTICALS } from './yoy'
import { spDate } from './yoyServer'

// Receita do ano (1º de janeiro até agora) das 4 verticais ativas, em horário de Brasília. Lê em páginas de 1.000 (o Supabase corta qualquer leitura em 1.000 linhas SEM avisar).
const startUtc = (y: number) => `${y}-01-01T03:00:00.000Z`        // 00:00 de Brasília (UTC-3, sem horário de verão)
export interface RealizadoAno { ano: number; today: string; realizado: number; vendas: number }
let cache: { at: number; ano: number; dia: string; data: RealizadoAno } | null = null      // vários painéis abertos não repetem a leitura: vale 45 s

export async function computeRealizadoAno(admin: any, now: Date = new Date()): Promise<RealizadoAno> {
  const today = spDate(now.toISOString()), ano = +today.slice(0, 4)
  if (cache && cache.ano === ano && cache.dia === today && now.getTime() - cache.at < 45_000 && now.getTime() >= cache.at) return cache.data
  let total = 0, vendas = 0
  for (let off = 0, i = 0; i < 800; i++) {
    const { data, error } = await admin.from('telao_events').select('value').eq('event_type', 'sale').in('vertical', DB_VERTICALS)
      .gte('occurred_at', startUtc(ano)).lt('occurred_at', startUtc(ano + 1)).order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(off, off + 999)
    if (error) throw new Error(`telao_events: ${error.message}`)
    const rows = (data ?? []) as { value: number | string | null }[]
    if (rows.length === 0) break
    for (const r of rows) { const v = Number(r.value); if (Number.isFinite(v)) { total += v; vendas++ } }
    off += rows.length
  }
  const out = { ano, today, realizado: Math.round(total * 100) / 100, vendas }
  cache = { at: now.getTime(), ano, dia: today, data: out }
  return out
}
