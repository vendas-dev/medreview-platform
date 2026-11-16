import { DB_VERTICALS, VERTICAL_DB, VKEYS, daysIn, type VKey, type YoYData, type YoYMetas } from './yoy'

// Lê as vendas do mês atual e do MESMO mês do ano passado e devolve a receita por dia e por vertical (horário de Brasília) e, do ano passado, também por HORA.
// Lê em páginas de 1.000 (o Supabase corta qualquer leitura em 1.000 linhas SEM avisar). Só as 4 verticais ativas (Vasc-Review/PsiqClara nem são lidas).
const SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export const spDate = (iso: string): string => SP.format(new Date(iso))                                   // AAAA-MM-DD em Brasília
const SPH = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
export const spHour = (iso: string): number => +SPH.format(new Date(iso))                                    // 0 a 23, hora em Brasília (23h30 de 30/11 é a hora 23 do dia 30)
const startUtc = (y: number, m1: number) => `${y}-${String(m1).padStart(2, '0')}-01T03:00:00.000Z`        // 00:00 de Brasília (UTC-3, sem horário de verão)
const nextUtc = (y: number, m1: number) => (m1 === 12 ? startUtc(y + 1, 1) : startUtc(y, m1 + 1))

/** Receita por dia (dia) e, por dia, a receita (h) e o nº de vendas (n) de cada HORA de Brasília: h[vertical][dia-1][0..23]. */
interface MesLido { dia: Record<VKey, number[]>; h: Record<VKey, number[][]>; n: Record<VKey, number[][]> }
async function lerMes(admin: any, y: number, m1: number): Promise<MesLido> {
  const n = daysIn(y, m1), out = Object.fromEntries(VKEYS.map(k => [k, new Array(n).fill(0)])) as Record<VKey, number[]>
  const hr = Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: n }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>, vn = Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: n }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>
  for (let off = 0, i = 0; i < 400; i++) {
    const { data, error } = await admin.from('telao_events').select('value, vertical, occurred_at').eq('event_type', 'sale').in('vertical', DB_VERTICALS)
      .gte('occurred_at', startUtc(y, m1)).lt('occurred_at', nextUtc(y, m1)).order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(off, off + 999)
    if (error) throw new Error(`telao_events: ${error.message}`)
    const rows = (data ?? []) as { value: number | string | null; vertical: string; occurred_at: string }[]
    if (rows.length === 0) break
    for (const r of rows) {
      const k = VERTICAL_DB[r.vertical], v = Number(r.value); if (!k || !Number.isFinite(v)) continue
      const day = +spDate(r.occurred_at).slice(8, 10); if (day >= 1 && day <= n) { out[k][day - 1] += v         // a data de Brasília manda (23h30 de 30/11 é dia 30, mesmo sendo 01/12 em UTC)
        const h = spHour(r.occurred_at); if (h >= 0 && h <= 23) { hr[k][day - 1][h] += v; vn[k][day - 1][h] += 1 } }
    }
    off += rows.length
  }
  for (const k of VKEYS) for (const dia of hr[k]) for (let h = 0; h < 24; h++) dia[h] = Math.round(dia[h] * 100) / 100      // centavos (a soma das horas = o dia)
  return { dia: out, h: hr, n: vn }
}

// Metas do mês: do MESMO cadastro que o resto do Forecast usa — company_goals (scope = nome da vertical, ou "geral") e, se não houver meta geral, a soma das metas dos closers (closer_goals).
const GOAL_SCOPE: Record<VKey, string> = { anest: 'Anest-Review', oft: 'Oft-Review', ortop: 'Ortop-Review', r1: 'Med-Review R1' }
async function lerMetas(admin: any, month: string): Promise<YoYMetas> {
  const [cg, cl] = await Promise.all([admin.from('company_goals').select('scope, goal_value').eq('month', month), admin.from('closer_goals').select('goal_sales').eq('month', month)])
  if (cg.error) throw new Error(`company_goals: ${cg.error.message}`)
  if (cl.error) throw new Error(`closer_goals: ${cl.error.message}`)
  const by: Record<string, number> = Object.fromEntries(((cg.data ?? []) as any[]).map(g => [g.scope, Number(g.goal_value) || 0]))
  const closers = ((cl.data ?? []) as any[]).reduce((s, g) => s + (Number(g.goal_sales) || 0), 0)
  return { anest: by[GOAL_SCOPE.anest] ?? 0, oft: by[GOAL_SCOPE.oft] ?? 0, ortop: by[GOAL_SCOPE.ortop] ?? 0, r1: by[GOAL_SCOPE.r1] ?? 0, geral: by['geral'] > 0 ? by['geral'] : closers }
}

export async function computeYoY(admin: any, now: Date = new Date()): Promise<YoYData> {
  const today = spDate(now.toISOString()), yearCur = +today.slice(0, 4), m1 = +today.slice(5, 7), yearPrev = yearCur - 1
  const [cur, prev, metas] = await Promise.all([lerMes(admin, yearCur, m1), lerMes(admin, yearPrev, m1), lerMetas(admin, today.slice(0, 7))])
  return { metas, today, month: today.slice(0, 7), dayOfMonth: +today.slice(8, 10), yearCur, yearPrev, daysInMonth: { cur: daysIn(yearCur, m1), prev: daysIn(yearPrev, m1) }, cur: cur.dia, prev: prev.dia, prevH: prev.h, prevHN: prev.n }       // hora a hora só do ano passado (é o perfil do dia forte)
}
