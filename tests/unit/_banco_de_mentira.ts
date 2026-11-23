// @ts-nocheck — banco em memória para os testes de campanhas (suporta insert/upsert com conflito/update/delete/range). Não é um teste: o executor só roda *.test.ts.
export function fakeAdmin(seed: Record<string, any[]>) {
  const db: Record<string, any[]> = JSON.parse(JSON.stringify(seed)); let seq = 1
  const uniq: Record<string, string[]> = { campaign_event_log: ['campaign_id', 'event_key'], campaign_winners: ['campaign_id', 'team', 'position'] }
  const from = (name: string) => {
    const rows = (db[name] ??= [])
    const st: any = { f: [] as ((r: any) => boolean)[], op: 'select', payload: null as any, single: false, maybe: false, lim: null as null | [number, number], conflict: null as any, ignore: false }
    const q: any = {
      select: () => q, order: () => q, limit: () => q,
      range: (a: number, b: number) => { st.lim = [a, b]; return q },
      eq: (k: string, v: any) => (st.f.push(r => r[k] === v), q), neq: (k: string, v: any) => (st.f.push(r => r[k] !== v), q),
      in: (k: string, v: any[]) => (st.f.push(r => v.includes(r[k])), q), is: (k: string, v: any) => (st.f.push(r => (r[k] ?? null) === v), q),
      gte: (k: string, v: any) => (st.f.push(r => r[k] >= v), q), lt: (k: string, v: any) => (st.f.push(r => r[k] < v), q), lte: (k: string, v: any) => (st.f.push(r => r[k] <= v), q),
      insert: (p: any) => (st.op = 'insert', st.payload = p, q),
      update: (p: any) => (st.op = 'update', st.payload = p, q),
      upsert: (p: any, o: any) => (st.op = 'upsert', st.payload = p, st.ignore = !!o?.ignoreDuplicates, st.conflict = o?.onConflict ? String(o.onConflict).split(',') : null, q),
      delete: () => (st.op = 'delete', q),
      single: () => (st.single = true, q), maybeSingle: () => (st.maybe = true, q),
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    }
    const run = () => {
      const match = () => rows.filter(r => st.f.every((f: any) => f(r)))
      if (st.op === 'insert' || st.op === 'upsert') {
        const list = Array.isArray(st.payload) ? st.payload : [st.payload], keys = st.conflict ?? uniq[name]
        const out: any[] = []
        for (const x of list) {
          const dup = keys ? rows.find(r => keys.every((k: string) => r[k] === x[k])) : null
          if (dup) {
            if (st.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
            if (!st.ignore) Object.assign(dup, x)
            continue
          }
          const made = { id: x.id ?? `id${seq++}`, ...x }; rows.push(made); out.push(made)
        }
        return { data: st.single ? out[0] ?? null : out, error: null }
      }
      if (st.op === 'update') { const m = match(); m.forEach(r => Object.assign(r, st.payload)); return { data: m, error: null } }
      if (st.op === 'delete') { const m = match(); m.forEach(r => rows.splice(rows.indexOf(r), 1)); return { data: m, error: null } }
      let m = match(); if (st.lim) m = m.slice(st.lim[0], st.lim[1] + 1)
      return { data: st.single || st.maybe ? m[0] ?? null : m, error: null }
    }
    return q
  }
  return { from, db }
}
