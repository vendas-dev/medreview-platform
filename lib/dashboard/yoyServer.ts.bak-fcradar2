import { DB_VERTICALS, VERTICAL_DB, VKEYS, daysIn, type VKey, type YoYData, type YoYMetas } from './yoy'
import { refDates } from './projecao'

// Lê as vendas do mês atual e do PERÍODO EQUIVALENTE do ano passado (cada dia casado por dia da semana: 364 dias antes) e devolve a receita por dia e por vertical (horário de Brasília) e, do ano passado, também por HORA.
// Lê em páginas de 1.000 (o Supabase corta qualquer leitura em 1.000 linhas SEM avisar). Só as 4 verticais ativas (Vasc-Review/PsiqClara nem são lidas).
const SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export const spDate = (iso: string): string => SP.format(new Date(iso))                                   // AAAA-MM-DD em Brasília
const SPH = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
export const spHour = (iso: string): number => +SPH.format(new Date(iso))                                    // 0 a 23, hora em Brasília (23h30 de 30/11 é a hora 23 do dia 30)
const startUtc = (iso: string) => `${iso}T03:00:00.000Z`                                       // 00:00 de Brasília (UTC-3, sem horário de verão)

/** Receita por dia (dia) e, por dia, a receita (h) e o nº de vendas (n) de cada HORA de Brasília: h[vertical][i][0..23], i = posição na lista `datas`.
 *  `datas` é a data de CADA posição (o mês de hoje, ou as datas do ano passado que servem de régua, já alinhadas por dia da semana). Datas repetidas alimentam todas as posições. */
interface MesLido { dia: Record<VKey, number[]>; h: Record<VKey, number[][]>; n: Record<VKey, number[][]> }
async function lerDatas(admin: any, datas: string[]): Promise<MesLido> {
  const n = datas.length, out = Object.fromEntries(VKEYS.map(k => [k, new Array(n).fill(0)])) as Record<VKey, number[]>
  const hr = Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: n }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>, vn = Object.fromEntries(VKEYS.map(k => [k, Array.from({ length: n }, () => new Array(24).fill(0))])) as Record<VKey, number[][]>
  const pos = new Map<string, number[]>(); datas.forEach((dt, i) => { const l = pos.get(dt); if (l) l.push(i); else pos.set(dt, [i]) })
  const ordem = [...datas].sort(), de = ordem[0], ate = ordem[ordem.length - 1], fim = new Date(Date.parse(ate + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)
  for (let off = 0, i = 0; i < 400; i++) {
    const { data, error } = await admin.from('telao_events').select('value, vertical, occurred_at').eq('event_type', 'sale').in('vertical', DB_VERTICALS)
      .gte('occurred_at', startUtc(de)).lt('occurred_at', startUtc(fim)).order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(off, off + 999)
    if (error) throw new Error(`telao_events: ${error.message}`)
    const rows = (data ?? []) as { value: number | string | null; vertical: string; occurred_at: string }[]
    if (rows.length === 0) break
    for (const r of rows) {
      const k = VERTICAL_DB[r.vertical], v = Number(r.value); if (!k || !Number.isFinite(v)) continue
      const idx = pos.get(spDate(r.occurred_at)); if (!idx) continue         // a data de Brasília manda (23h30 de 30/11 é dia 30, mesmo sendo 01/12 em UTC)
      const h = spHour(r.occurred_at)
      for (const j of idx) { out[k][j] += v; if (h >= 0 && h <= 23) { hr[k][j][h] += v; vn[k][j][h] += 1 } }
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

// "Meta do Radar" do mês (tabela forecast_radar_meta, editada pelo superadmin): a meta que o Radar, a rota e o hora a hora usam. Sem a tabela/linha: 0 (cai na meta cadastrada).
export async function lerMetaRadar(admin: any, month: string): Promise<number> {
  try {
    const { data, error } = await admin.from('forecast_radar_meta').select('meta').eq('month', month).maybeSingle()
    if (error) return 0
    const v = Number((data as any)?.meta); return Number.isFinite(v) && v > 0 ? v : 0
  } catch { return 0 }
}

export async function computeYoY(admin: any, now: Date = new Date()): Promise<YoYData> {
  const today = spDate(now.toISOString()), yearCur = +today.slice(0, 4), m1 = +today.slice(5, 7), month = today.slice(0, 7), N = daysIn(yearCur, m1)
  const mesAtual = Array.from({ length: N }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`), regua = refDates(month)         // regua[i] = o dia do ano passado que vale para o dia i+1 (mesmo dia da semana)
  const [cur, prev, metas] = await Promise.all([lerDatas(admin, mesAtual), lerDatas(admin, regua), lerMetas(admin, month)])
  const metaRadar = await lerMetaRadar(admin, month)
  return { metas, metaRadar, horaAgora: spHour(now.toISOString()), curH: cur.h, curHN: cur.n, today, month, dayOfMonth: +today.slice(8, 10), yearCur, yearPrev: +regua[0].slice(0, 4), daysInMonth: { cur: N, prev: N }, prevDates: regua, cur: cur.dia, prev: prev.dia, prevH: prev.h, prevHN: prev.n }       // hora a hora só do ano passado (é o perfil do dia forte)
}
