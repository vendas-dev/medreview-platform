#!/usr/bin/env python3
"""
Dashboard — lê TODAS as vendas (e não só as primeiras 1.000) nas 3 consultas de telao_events do app/(platform)/dashboard/page.tsx:
  • vendas do mês   • histórico COMPLETO de recorrentes (a previsão)   • vendas do mês anterior

  uso (na raiz do projeto):   python paginar-dashboard.py .

O Supabase devolve no máximo 1.000 linhas por consulta e IGNORA o ".limit(999999)" em silêncio — por isso hoje, num mês com mais de 1.000 vendas (julho teve 2.242), os totais saem cortados.
Com o histórico retroativo importado, as parcelas recorrentes passam de 1.000 e a previsão/taxa de cancelamento seriam calculadas sobre um pedaço arbitrário. Este script troca essas 3 consultas por uma leitura em páginas de 1.000.
Mexe só nessas 3 consultas (e acrescenta a função fetchAll). TUDO-OU-NADA, pode rodar de novo ("já aplicado"), mantém CRLF.
"""
import re, sys, os
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
ROOT = sys.argv[1] if len(sys.argv) == 2 else None
if not ROOT: print(__doc__); sys.exit(2)
P = os.path.join(ROOT, 'app', '(platform)', 'dashboard', 'page.tsx')
if not os.path.exists(P): print(f'NADA foi alterado: arquivo não encontrado: {P} (rode na raiz do projeto)'); sys.exit(1)
raw = open(P, 'rb').read().decode('utf-8'); s = raw.replace('\r\n', '\n'); crlf = '\r\n' in raw
if 'function fetchAll' in s: print('Já aplicado. Nada foi alterado.'); sys.exit(0)
def falha(m): print('NADA foi alterado.\n  - ' + m + '\n  Me mande o arquivo atual que eu ajusto o script.'); sys.exit(1)
HELPER = '''// Lê TODAS as linhas de uma consulta do Supabase, em páginas de 1.000. O Supabase corta cada resposta em 1.000 linhas e ignora ".limit(999999)" sem avisar.
// build(from, to) recebe a faixa (inclusiva) e devolve a consulta já com .range(from, to). Devolve { data, error } no mesmo formato das outras consultas.
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<{ data: any[] | null; error: any }> {
  const PAGE = 1000
  const out: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) return { data: null, error }
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return { data: out, error: null }
}

'''
m = re.search(r'^export default (async )?function', s, re.M)
if not m: falha('não achei o "export default function" da página')
chain = re.compile(r"admin2\.from\('telao_events'\)((?:\n[ \t]+\.[^\n]*)+?)\n([ \t]+)\.limit\(999999\),")
achados = [x for x in chain.finditer(s) if 'ambassador_certified' not in x.group(1)]
if len(achados) != 3: falha(f"esperava 3 consultas de vendas em telao_events com .limit(999999) no bloco principal, achei {len(achados)}")
trechos = [x.group(1) for x in achados]
if sum("is_recurring', true" in t for t in trechos) != 1: falha('não achei (exatamente uma) a consulta do histórico de recorrentes')
for x in reversed(achados):
    ind = x.group(2)
    nova = f"fetchAll((from, to) => admin2.from('telao_events'){x.group(1)}\n{ind}.order('occurred_at', {{ ascending: true }}).order('id', {{ ascending: true }}).range(from, to)),"
    s = s[:x.start()] + nova + s[x.end():]
s = s[:m.start()] + HELPER + s[m.start():]
open(P, 'wb').write((s.replace('\n', '\r\n') if crlf else s).encode('utf-8'))
print('OK: 3 consultas do dashboard agora leem todas as linhas (páginas de 1.000).\n  ✓ app/(platform)/dashboard/page.tsx')
