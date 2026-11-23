import { addDays, prizeFor } from './engine'
import { fetchAllRows } from './paged'
import { slotByPos, slotWinMessage } from './hourly'

// ══ Critério POR HORA — parte do SERVIDOR (apuração durante a campanha) ═══════════════════════════════════
// Cada rodada FECHADA (fim + tolerância) vira 1 linha em campaign_winners: position = nº da rodada (1, 2, 3… em ordem de horário), por time.
// Tudo idempotente: rodar a rotina várias vezes dá o mesmo resultado. A linha é gravada ANTES de marcar o aviso (se cair no meio, a próxima rodada de apuração completa).

type Send = (title: string, body: string, kind: 'campanha' | 'vitoria', to: string[], event_key: string) => Promise<void>

/** Rodadas novas por apuração (campanha antiga publicada de uma vez não estoura o tempo da rota; o resto entra na próxima apuração). */
export const MAX_SLOTS_PER_TICK = 200
/** Só avisa ganhador de rodada recente: publicar uma campanha de semana passada não deve mandar centenas de avisos de uma vez. */
export const NOTIFY_WINDOW_DAYS = 1

/** Devolve true se ainda sobrou rodada para registrar (então a campanha NÃO pode ser fechada nesta apuração). */
export async function tickHourlyWinners(o: { admin: any; c: any; d: any; ev: any; today: string; send: Send; claim: (key: string) => Promise<boolean>; sum: { winners: number } }): Promise<boolean> {
  const { admin, c, d, ev, today, send, claim, sum } = o
  const cur = await fetchAllRows(( f, t ) => admin.from('campaign_winners').select('team, position').eq('campaign_id', c.id).order('team').order('position').range(f, t))
  const have = new Set(cur.map((r: any) => `${r.team}:${r.position}`))
  const lg = await fetchAllRows((f, t) => admin.from('campaign_event_log').select('event_key').eq('campaign_id', c.id).order('event_key').range(f, t))
  const logged = new Set(lg.map((r: any) => r.event_key as string))
  let budget = MAX_SLOTS_PER_TICK, pending = false
  for (const t of ev.teams) for (const w of t.winners as any[]) {
    const pos = Number(w.slot), key = `slot:${t.team}:${pos}`
    if (have.has(`${t.team}:${pos}`) && logged.has(key)) continue         // já registrado e já avisado
    if (budget-- <= 0) { pending = true; continue }
    await admin.from('campaign_winners').upsert({ campaign_id: c.id, team: t.team, position: pos, user_id: w.userId, user_name: w.name, metric_value: w.metric, reached_at: w.reachedAt, prize: prizeFor(d, t.team, pos) }, { onConflict: 'campaign_id,team,position', ignoreDuplicates: true })
    if (!(await claim(key))) continue
    sum.winners++
    const s = slotByPos(d, pos)
    if (s && s.day >= addDays(today, -NOTIFY_WINDOW_DAYS)) {
      const m = slotWinMessage(d, { team: t.team, pos, name: w.name, metric: w.metric })
      await send(m.title, m.body, 'vitoria', [w.userId], `slot:personal:${t.team}:${pos}`)
    }
  }
  return pending
}
