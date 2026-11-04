import { tierHitMessage, sortedTiers, tierIndexFor } from './tiers'

// ══ Faixas de valor — parte do SERVIDOR (apuração durante a campanha e fechamento) ═══════════════════════
// Tudo idempotente: rodar a rotina várias vezes dá o mesmo resultado. Os ganhadores ficam em campaign_winners (1 linha por pessoa e time),
// com posição ESTÁVEL (ordem em que bateram a 1ª faixa: quem já está registrado não muda de posição). O prêmio acompanha a faixa mais alta atingida.

type Send = (title: string, body: string, kind: 'campanha' | 'vitoria', to: string[], event_key: string) => Promise<void>

/** Durante a campanha (e na última apuração, ao fechar): registra quem atingiu faixa, atualiza o prêmio de quem subiu, tira quem deixou de atingir e avisa. */
export async function tickTierWinners(o: { admin: any; c: any; d: any; ev: any; participants: any[]; send: Send; claim: (key: string) => Promise<boolean>; sum: { winners: number } }) {
  const { admin, c, d, ev, send, claim, sum } = o
  const { data: cur } = await admin.from('campaign_winners').select('*').eq('campaign_id', c.id)
  const rows = (cur ?? []) as any[]
  for (const t of ev.teams) {
    const mine = rows.filter(r => r.team === t.team), byUser = new Map<string, any>(mine.map(r => [r.user_id, r]))
    let nextPos = Math.max(0, ...mine.map(r => Number(r.position))) + 1
    const qualified = (t.winners as any[]).slice().sort((a, b) => (a.reachedAt ?? '').localeCompare(b.reachedAt ?? '') || a.userId.localeCompare(b.userId))
    for (const w of qualified) {
      const prize = w.tierPrize ?? '', ex = byUser.get(w.userId)
      if (!ex) {
        const { error } = await admin.from('campaign_winners').insert({ campaign_id: c.id, team: t.team, position: nextPos++, user_id: w.userId, user_name: w.name, metric_value: w.metric, reached_at: w.reachedAt, prize })
        if (!error) sum.winners++
      } else if ((ex.prize ?? '') !== prize || Number(ex.metric_value ?? 0) !== w.metric || ex.user_name !== w.name) {
        await admin.from('campaign_winners').update({ prize, metric_value: w.metric, user_name: w.name, reached_at: w.reachedAt ?? ex.reached_at }).eq('id', ex.id)
      }
      // aviso: só da faixa MAIS ALTA atingida e uma vez por faixa (as de baixo ficam "marcadas" sem avisar, pra não avisar depois)
      for (let k = 0; k <= (w.tier ?? -1); k++) {
        if (!(await claim(`tier:${t.team}:${w.userId}:${k}`))) continue
        if (k === w.tier) { const m = tierHitMessage(d.name, { metric: w.metric, tierTarget: w.tierTarget, tierPrize: w.tierPrize, nextTarget: w.nextTarget, nextPrize: w.nextPrize }); await send(m.title, m.body, 'vitoria', [w.userId], `tier:personal:${t.team}:${w.userId}:${k}`) }
      }
    }
    // quem deixou de atingir (ex.: venda estornada): sai, a menos que o prêmio já tenha sido entregue
    const still = new Set(qualified.map((w: any) => w.userId))
    for (const r of mine) if (!still.has(r.user_id) && !r.delivered_at) await admin.from('campaign_winners').delete().eq('id', r.id)
  }
}

/** Ao fechar: o aviso pessoal "Você ganhou: …" de cada premiado (mesma chave dos outros critérios: finish:personal:TIME:POSIÇÃO).
 *  SÓ de quem atinge a faixa no fim: uma linha mantida porque o prêmio já tinha sido entregue (e a venda foi estornada depois) fica para a gestão decidir, sem aviso de vitória. */
export async function finishTierWinners(o: { admin: any; c: any; d: any; ev: any; send: Send; msgs: any; sum: { winners: number } }) {
  const { admin, c, ev, send, msgs } = o
  const still = new Set<string>(); for (const t of ev.teams) for (const w of t.winners) still.add(w.userId)
  const { data } = await admin.from('campaign_winners').select('*').eq('campaign_id', c.id)
  for (const w of ((data ?? []) as any[]).filter(r => still.has(r.user_id)).sort((a, b) => a.team.localeCompare(b.team) || a.position - b.position)) {
    const m = msgs.personal({ team: w.team, metric: Number(w.metric_value ?? 0), prize: w.prize ?? null }, w.position)
    await send(m.title, m.body, 'vitoria', [w.user_id], `finish:personal:${w.team}:${w.position}`)
  }
}

/** Editou o texto/valor das faixas: o prêmio de quem já está registrado acompanha (antes de reescrever os avisos já enviados). */
export async function refreshTierWinnerPrizes(admin: any, row: any) {
  const { data } = await admin.from('campaign_winners').select('*').eq('campaign_id', row.id)
  for (const w of (data ?? []) as any[]) {
    const s = sortedTiers(row.teams?.[w.team]?.tiers), i = tierIndexFor(s, Number(w.metric_value ?? 0)), prize = i >= 0 ? s[i].prize : null
    if (prize && prize !== w.prize) await admin.from('campaign_winners').update({ prize }).eq('id', w.id)
  }
}
