#!/usr/bin/env python3
"""
TELÃO — as TROCAS DE VENDA (embaixador + closer, e self checkout → closer) passam a contar certo, e os totais batem com Vendas Individuais / Dados Gerais.

O QUE ESTAVA ERRADO (3 defeitos)
  1) CO-CLOSER SUMIA DO RANKING. closer_id é o id da tabela "closers", mas co_closer_id é o id do PERFIL ("profiles"). O Telão procurava o co-closer só entre os ids de closers,
     não achava, creditava a uma linha "?" e o LiveWall descarta "?" — a venda do co-closer (inclusive "embaixador + closer") nunca aparecia para ele. Venda com closer_id vazio
     e só hubspot_id ficava numa linha separada, pelo nome (o closer aparecia em DUAS linhas).
  2) TOTAL DO MÊS SUBCONTADO. A receita do mês (placar "MÊS · R$ …" e meta do dia) era lida SEM paginar e o Supabase corta em 1.000 linhas (o seu mês tem 1.027 vendas).
     Os eventos de hoje também cortavam em 500.
  3) DADOS VELHOS. Uma troca é um UPDATE numa venda que pode ser de OUTRO dia; o período filtrado e o "mês por closer" (meta individual) eram carregados UMA vez e só
     corrigiam recarregando a página. Agora o telão relê tudo a cada 60 s (e ao voltar para a aba) e o botão de atualizar relê o período também.

ARQUIVOS (procurados a partir da raiz do projeto): lib/telao/format.ts · hooks/useLiveData.ts(x) · app/(platform)/telao/LiveWall.tsx
  Antes de gravar, o script guarda uma CÓPIA de cada arquivo (<arquivo>.bak-trocas). --desfazer restaura essa cópia (exata, byte a byte).
  Tudo-ou-nada por arquivo: se UM trecho não for reconhecido, o arquivo NÃO é tocado e o motivo aparece. Rodar de novo não duplica. Preserva CRLF/LF e BOM.

Uso (na RAIZ do projeto):   python aplicar-telao-trocas.py .   |  --dry-run (só mostra)  |  --desfazer
"""
import os, re, sys

EDITS = {
  'lib/telao/format.ts': [
    ('func', 'computeCloserStats', '/**\n * Soma por closer — corrigida para as TROCAS DE VENDA (embaixador + closer, e self checkout → closer).\n *  • closer_id é o id da tabela CLOSERS, mas co_closer_id é o id do PERFIL (profiles): resolve pelos dois (closer.profile_id) e também pelo hubspot_id (com trim).\n *    Antes o co-closer não era achado, virava "?" e era descartado do ranking — a venda dele sumia do Telão.\n *  • Venda com closer_id vazio mas hubspot preenchido passa a somar no closer certo (antes ficava numa linha separada, pelo nome).\n *  • O crédito do co-closer é SOMADO (não tira do principal); se principal e co-closer forem a mesma pessoa, conta uma vez.\n */\nexport function computeCloserStats(\n  events: TelaoEvent[],\n  closers: Closer[],\n): CloserStats[] {\n  const hubOf = (v: unknown) => (v == null ? \'\' : String(v).trim())\n  const closersById = Object.fromEntries(closers.map(c => [c.id, c]))\n  const closersByHub = new Map<string, Closer>()\n  const closersByProfile = new Map<string, Closer>()\n  for (const c of closers) {\n    if (hubOf(c.hubspot_id)) closersByHub.set(hubOf(c.hubspot_id), c)\n    const pid = (c as any).profile_id\n    if (pid) closersByProfile.set(String(pid), c)\n  }\n  const resolve = (id: string | null | undefined, hubspotId: unknown): Closer | null =>\n    (id ? (closersById[id] ?? closersByProfile.get(id)) : undefined) ?? (hubOf(hubspotId) ? closersByHub.get(hubOf(hubspotId)) : undefined) ?? null\n  const map = new Map<string, CloserStats>()\n\n  const credit = (key: string, closer: Closer | null, name: string, isSelf: boolean, ev: TelaoEvent) => {\n    if (!map.has(key)) map.set(key, { closer, name, isSelf, revenue: 0, sales: 0, certs: 0 })\n    const s = map.get(key)!\n    if (ev.event_type === \'sale\') { s.revenue += ev.value ?? 0; s.sales++ }\n    else s.certs++\n  }\n\n  for (const ev of events) {\n    const isSelf = ev.is_self_checkout\n    const closer = resolve(ev.closer_id, (ev as any).closer_hubspot_id)\n    const key    = isSelf ? \'self\' : (closer?.id ?? ev.closer_id ?? ev.closer_name ?? \'unknown\')\n    const name   = closer?.name ?? (isSelf ? \'Self Checkout\' : ev.closer_name ?? \'?\')\n    credit(key, closer, name, isSelf, ev)\n\n    // Venda transferida/co-atribuída — o closer que recebeu crédito também\n    // soma essa venda nas próprias estatísticas (sem tirar da atribuição\n    // original acima; é crédito somado, não substituído).\n    const coHub = (ev as any).co_closer_hubspot_id\n    if (ev.co_closer_id || hubOf(coHub)) {\n      const coCloser = resolve(ev.co_closer_id, coHub)\n      if (!(coCloser && closer && coCloser.id === closer.id && !isSelf)) {\n        credit(coCloser?.id ?? ev.co_closer_id ?? `co:${hubOf(coHub)}`, coCloser, coCloser?.name ?? \'?\', false, ev)\n      }\n    }\n  }\n\n  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)\n}', 'Soma por closer — corrigida para as TROCAS DE VENDA', 'cálculo por closer: co-closer por id de perfil/hubspot, venda só com hubspot e sem linha duplicada (TROCAS DE VENDA)')
  ],
  'hooks/useLiveData': [
    ('append', None, '// O Supabase corta SILENCIOSAMENTE cada resposta em 1.000 linhas (e ignora .limit maior): lê de 1.000 em 1.000, sempre na mesma ordem, até acabar.\nasync function fetchAllPages<T = any>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, maxRows = 100000): Promise<{ data: T[] | null; error: any }> {\n  const out: T[] = []\n  for (let from = 0; from < maxRows; from += 1000) {\n    const { data, error } = await build(from, from + 999)\n    if (error) return { data: null, error }\n    out.push(...(data ?? []))\n    if (!data || data.length < 1000) break\n  }\n  return { data: out, error: null }\n}\n', 'async function fetchAllPages', 'função de leitura paginada (de 1.000 em 1.000)'),
    ('regex', "const \\{ data: monthData \\} = await supabase\\s*\\.from\\('telao_events'\\)\\s*\\.select\\(('[^']*')\\)\\s*\\.eq\\('event_type', 'sale'\\)\\s*\\.gte\\('occurred_at', monthStart\\(\\)\\)\\s*\\.not\\('value', 'is', null\\)", "const { data: monthData } = await fetchAllPages((a, b) => supabase.from('telao_events').select(\\1).eq('event_type', 'sale').gte('occurred_at', monthStart()).not('value', 'is', null).order('occurred_at', { ascending: false }).order('id').range(a, b))", ".not('value', 'is', null).order('occurred_at', { ascending: false }).order('id').range(a, b))", 'receita do MÊS paginada (o Supabase cortava em 1.000 e o seu mês tem 1.027 vendas)'),
    ('regex', "const \\{ data: eventsData \\} = await supabase\\s*\\.from\\('telao_events'\\)\\s*\\.select\\(('[^']*')\\)\\s*\\.gte\\('occurred_at', todayStart\\(\\)\\)\\s*\\.order\\('occurred_at', \\{ ascending: false \\}\\)\\s*\\.limit\\(\\d+\\)", "const { data: eventsData } = await fetchAllPages((a, b) => supabase.from('telao_events').select(\\1).gte('occurred_at', todayStart()).order('occurred_at', { ascending: false }).order('id').range(a, b), 20000)", ".order('id').range(a, b), 20000)", 'eventos de HOJE paginados (antes cortava em 500)')
  ],
  'app/(platform)/telao/LiveWall.tsx': [
    ('exact', 'onClick={()=>{ refetch(); setChartTick(t=>t+1) }}', 'onClick={()=>{ refetch(); setChartTick(t=>t+1); setRangeTick(t=>t+1) }}', 'setChartTick(t=>t+1); setRangeTick(t=>t+1)', 'botão atualizar: também relê o período filtrado'),
    ('exact', 'const monthSales = useMonthSales(isAdmin, chartTick)', "const monthSales = useMonthSales(isAdmin, chartTick)\n\n  // [trocas] reatualiza sozinho: uma TROCA DE VENDA (atribuição) é um UPDATE numa venda que pode ser de outro dia, e o período filtrado / o mês por closer eram carregados UMA vez\n  // (só corrigiam recarregando a página). A cada 60 s (e ao voltar para a aba) o telão relê o período e o mês.\n  useEffect(() => {\n    const atualiza = () => { if (document.visibilityState === 'visible') { setRangeTick(x => x + 1); setChartTick(x => x + 1) } }\n    const id = setInterval(atualiza, 60_000)\n    document.addEventListener('visibilitychange', atualiza)\n    return () => { clearInterval(id); document.removeEventListener('visibilitychange', atualiza) }\n  }, [])", '[trocas] reatualiza sozinho', 'atualização automática a cada 60 s do período e do mês'),
    ('exact', 'useState<{ value:number; closer_id:string|null; closer_hubspot_id:string|null }[]>([])', 'useState<{ value:number; closer_id:string|null; closer_hubspot_id:string|null; co_closer_id?:string|null; co_closer_hubspot_id?:string|null }[]>([])', 'co_closer_id?:string|null; co_closer_hubspot_id?:string|null }[]>([])', 'vendas do mês por closer: guarda também o co-closer'),
    ('regex', "supabase\\.from\\('telao_events'\\)\\.select\\('value, closer_id, closer_hubspot_id'\\)\\s*\\.eq\\('event_type', 'sale'\\)\\.gte\\('occurred_at', monthStart\\(\\)\\)\\s*\\.then\\(\\(\\{ data \\}\\) => setMonthSalesRaw\\(\\(data \\?\\? \\[\\]\\) as any\\)\\)\\s*\\}, \\[isAdmin\\]\\)", "let cancelled = false\n    ;(async () => {                                                         // paginado (o Supabase corta em 1.000) e COM o co-closer; refaz a cada atualização (troca de venda é um UPDATE)\n      const rows: any[] = []\n      for (let from = 0; from < 100000; from += 1000) {\n        const { data, error } = await supabase.from('telao_events').select('value, closer_id, closer_hubspot_id, co_closer_id, co_closer_hubspot_id')\n          .eq('event_type', 'sale').gte('occurred_at', monthStart()).order('occurred_at', { ascending: false }).order('id').range(from, from + 999)\n        if (error) return\n        rows.push(...(data ?? []))\n        if ((data ?? []).length < 1000) break\n      }\n      if (!cancelled) setMonthSalesRaw(rows as any)\n    })()\n    return () => { cancelled = true }\n  }, [isAdmin, chartTick])", 'paginado (o Supabase corta em 1.000) e COM o co-closer', 'vendas do mês por closer: paginadas, com co-closer e relidas a cada atualização'),
    ('regex', 'const closerMonthRevenue = useMemo\\(\\(\\) => \\{\\s*const map: Record<string, number> = \\{\\}\\s*monthSalesRaw\\.forEach\\(\\(e: any\\) => \\{[\\s\\S]*?\\}\\)\\s*return map\\s*\\}, \\[monthSalesRaw, byId, byHubId\\]\\)', 'const closerMonthRevenue = useMemo(() => {\n    // closer_id é id da tabela closers; co_closer_id é id do PERFIL: resolve pelos dois e pelo hubspot_id (com trim). Principal E co-closer somam (uma vez por pessoa).\n    const map: Record<string, number> = {}\n    const byProfile = new Map<string, Closer>(); (closers ?? []).forEach((c: any) => { if (c.profile_id) byProfile.set(String(c.profile_id), c) })\n    const byHub = new Map<string, Closer>(); Object.entries(byHubId).forEach(([k, c]) => byHub.set(String(k).trim(), c as Closer))\n    const find = (id: any, hub: any): Closer | null => (id ? (byId[id] ?? byProfile.get(String(id))) : undefined) ?? (hub != null && String(hub).trim() ? byHub.get(String(hub).trim()) : undefined) ?? null\n    monthSalesRaw.forEach((e: any) => {\n      const seen = new Set<string>()\n      for (const c of [find(e.closer_id, e.closer_hubspot_id), find(e.co_closer_id, e.co_closer_hubspot_id)]) {\n        if (!c || seen.has(c.id)) continue\n        seen.add(c.id); map[c.id] = (map[c.id] ?? 0) + (e.value ?? 0)\n      }\n    })\n    return map\n  }, [monthSalesRaw, byId, byHubId, closers])', 'closer_id é id da tabela closers; co_closer_id é id do PERFIL', 'meta do mês por closer: soma principal E co-closer (id de perfil/hubspot)')
  ],
}

BAK = '.bak-trocas'
CANDIDATOS = {'hooks/useLiveData': ['hooks/useLiveData.ts', 'hooks/useLiveData.tsx']}

def acha_arquivo(raiz, arq):
    for rel in CANDIDATOS.get(arq, [arq]):
        p = os.path.join(raiz, *rel.split('/'))
        if os.path.isfile(p): return rel, p
    return CANDIDATOS.get(arq, [arq])[0], None

def acha_fim_funcao(t, nome):
    ini = t.index('export function ' + nome + '(')
    j = t.index('{', t.index(')', t.index('):', ini)))       # a "{" do corpo (depois do tipo de retorno)
    d = 0
    for k in range(j, len(t)):
        if t[k] == '{': d += 1
        elif t[k] == '}':
            d -= 1
            if d == 0: return ini, k + 1
    raise ValueError('chaves não fecham')

def aplica(texto, edits):
    novo, msgs, erro = texto, [], False
    for tipo, a, b, marcador, desc in edits:
        if marcador in novo: msgs.append(f'  · já estava assim: {desc}'); continue
        try:
            if tipo == 'func':
                n = novo.count('export function ' + a + '(')
                if n != 1: raise LookupError(f'a função {a} apareceu {n} vez(es) (precisa ser exatamente 1)')
                i, f = acha_fim_funcao(novo, a); novo = novo[:i] + b + novo[f:]
            elif tipo == 'append': novo = novo.rstrip('\n') + '\n\n' + b
            elif tipo == 'exact':
                n = novo.count(a)
                if n != 1: raise LookupError(f'o trecho esperado apareceu {n} vez(es) (precisa ser exatamente 1)')
                novo = novo.replace(a, b)
            else:
                ms = list(re.finditer(a, novo))
                if len(ms) != 1: raise LookupError(f'o trecho esperado apareceu {len(ms)} vez(es) (precisa ser exatamente 1)')
                m = ms[0]; novo = novo[:m.start()] + m.expand(b) + novo[m.end():]
            msgs.append(f'  ✓ alterado: {desc}')
        except (LookupError, ValueError) as e:
            erro = True; msgs.append(f'  ✗ {desc}: {e} — arquivo NÃO alterado')
    return novo, msgs, not erro

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else '.'
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'lib')):
        print('Rode na RAIZ do projeto (onde ficam as pastas app/ e lib/), ex.: python aplicar-telao-trocas.py .'); return 2
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Telão: trocas de venda\n')
    falhas = 0
    for arq, edits in EDITS.items():
        rel, p = acha_arquivo(raiz, arq)
        if not p: print(f'✘ {rel}\n  ✗ arquivo não encontrado'); falhas += 1; continue
        if modo == 'desfazer':
            if os.path.isfile(p + BAK): os.replace(p + BAK, p); print(f'✔ {rel}\n  ✓ restaurado da cópia de segurança (exatamente como estava antes)')
            else: print(f'✔ {rel}\n  · sem cópia de segurança: nada a desfazer')
            continue
        bruto = open(p, 'rb').read(); bom = bruto.startswith(b'\xef\xbb\xbf'); crlf = b'\r\n' in bruto
        texto = bruto.decode('utf-8-sig').replace('\r\n', '\n')
        novo, msgs, ok = aplica(texto, edits)
        print(('✔ ' if ok else '✘ ') + rel); print('\n'.join(msgs)); falhas += not ok
        if ok and novo != texto and modo == 'aplicar':
            if not os.path.isfile(p + BAK): open(p + BAK, 'wb').write(bruto)
            saida = novo.replace('\n', '\r\n') if crlf else novo; dados = saida.encode('utf-8'); dados = (b'\xef\xbb\xbf' + dados) if bom else dados
            tmp = p + '.trocas.tmp'; open(tmp, 'wb').write(dados); os.replace(tmp, p)
    print('\nTudo certo.' if not falhas else f'\n{falhas} arquivo(s) com problema (os demais foram processados).')
    return 1 if falhas else 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
