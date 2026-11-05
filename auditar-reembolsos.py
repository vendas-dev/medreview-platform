#!/usr/bin/env python3
"""
REEMBOLSOS — AUDITOR: procura no seu código qualquer lugar que lê a tabela telao_events SEM filtrar por tipo de evento.
Por quê: o reembolso tira a venda de TODOS os números porque o gatilho do banco muda o tipo da linha de 'sale' para 'refund', e o sistema só conta 'sale'.
A única exceção seria uma consulta que lê telao_events SEM filtrar event_type (aí a venda reembolsada ainda apareceria). Este script acha esses casos.
SÓ LÊ os arquivos; não altera nada.

  uso (na RAIZ do projeto):   python auditar-reembolsos.py .            (lista tudo)
                              python auditar-reembolsos.py . --falhar   (sai com código 1 se achar algum "ATENÇÃO", útil em automação)
Classifica cada leitura de telao_events:
  OK        filtra event_type = 'sale' (ou outro tipo específico), ou filtra em JS logo depois
  ESCRITA   insert/update/delete/upsert (não soma nada)
  ATENÇÃO   lê sem filtrar o tipo → confira se uma venda reembolsada poderia entrar na conta
  + lista os pontos de Realtime (postgres_changes) em telao_events, para você conferir se tratam UPDATE (o reembolso é um UPDATE).
"""
import os, re, sys
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) != 1 or not os.path.isdir(args[0]): print(__doc__); sys.exit(2)
ROOT, FALHAR = args[0], '--falhar' in sys.argv
SKIP_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '.vercel', 'coverage', '.turbo'}
EXT = ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql')
re_from = re.compile(r"""\.from\(\s*['"`]telao_events['"`]\s*\)""")
re_sale = re.compile(r"""event_type['"`]?\s*(,|=|:|===?|!==?)\s*['"`]sale['"`]|event_type\s*=\s*'sale'|event_type::text\s*=\s*'sale'""", re.I)
re_tipo_especifico = re.compile(r"""\.eq\(\s*['"`]event_type['"`]\s*,\s*['"`](?!sale)[a-z_]+['"`]\s*\)""")
re_escrita = re.compile(r"""\.(insert|update|delete|upsert)\(""")
re_sql = re.compile(r"""\bfrom\s+(public\.)?telao_events\b""", re.I)
re_rt = re.compile(r"""postgres_changes""")
ok, esc, aten, rt, arquivos = [], [], [], [], 0
def helper_filtra(texto, bloco):
    """A consulta é passada a uma função auxiliar do MESMO arquivo (ex.: filtrosVendas(q, f)); se o corpo dela filtra event_type = 'sale', está coberta."""
    for m in re.finditer(r"\b([A-Za-z_]\w*)\(\s*[\w.]*\.from\(\s*['\"`]telao_events['\"`]\s*\)", bloco):
        nome = m.group(1)
        d = re.search(r"(function\s+" + re.escape(nome) + r"\b|const\s+" + re.escape(nome) + r"\s*=)", texto)
        if d and re_sale.search(texto[d.start():d.start() + 900]): return True
    return False
def trecho(linhas, i, n=14):
    fim = i
    while fim < min(len(linhas), i + n):
        if fim > i and (linhas[fim].strip() == '' or re.match(r"\s*(const|let|var|export|function|return|if)\b", linhas[fim]) and ';' in linhas[fim - 1]): break
        fim += 1
    return '\n'.join(linhas[i:fim + 1])
for r, ds, fs in os.walk(ROOT):
    ds[:] = [d for d in ds if d not in SKIP_DIRS]
    for f in fs:
        if not f.endswith(EXT): continue
        rel = os.path.relpath(os.path.join(r, f), ROOT).replace(os.sep, '/')
        if 'reembolsos' in rel or rel.startswith('sql/') and 'reembolso' in rel: continue
        try: t = open(os.path.join(r, f), 'rb').read().decode('utf-8', errors='replace')
        except OSError: continue
        if 'telao_events' not in t: continue
        arquivos += 1; L = t.split('\n')
        for i, l in enumerate(L):
            if re_from.search(l):
                bloco = trecho(L, i); depois = '\n'.join(L[i:i + 45])
                if re_escrita.search(bloco) and not re.search(r"\.select\(", bloco.split('.update(')[0] if '.update(' in bloco else bloco): esc.append((rel, i + 1, l.strip()))
                elif re_sale.search(bloco) or re_tipo_especifico.search(bloco): ok.append((rel, i + 1, l.strip()))
                elif re.search(r"event_type\s*[!=]==?\s*['\"]sale['\"]|event_type\s*===?\s*['\"]sale['\"]", depois): ok.append((rel, i + 1, l.strip()))
                elif helper_filtra(t, bloco): ok.append((rel, i + 1, l.strip()))
                else: aten.append((rel, i + 1, l.strip()))
            elif f.endswith('.sql') or '`' in l or re.search(r"\bfrom\s", l, re.I):
                if re_sql.search(l):
                    janela = '\n'.join(L[i:i + 12])
                    if re_sale.search(janela) or re.search(r"event_type\s*=\s*'[a-z_]+'", janela): ok.append((rel, i + 1, l.strip()))
                    elif re.search(r"\b(insert\s+into|update|delete\s+from)\b", l, re.I): esc.append((rel, i + 1, l.strip()))
                    else: aten.append((rel, i + 1, l.strip()))
            if re_rt.search(l) and 'telao_events' in '\n'.join(L[max(0, i - 3):i + 8]):
                ev = re.search(r"event:\s*['\"](\*|INSERT|UPDATE|DELETE)['\"]", '\n'.join(L[i:i + 8]))
                rt.append((rel, i + 1, ev.group(1) if ev else '?'))
print(f'AUDITORIA DE REEMBOLSOS — {arquivos} arquivo(s) mencionam telao_events\n')
print(f'  OK       {len(ok):4d}   leituras que filtram o tipo de evento (a venda reembolsada fica de fora)')
print(f'  ESCRITA  {len(esc):4d}   inserções/atualizações/remoções (não somam nada)')
print(f'  ATENÇÃO  {len(aten):4d}   leituras SEM filtro de tipo')
if aten:
    print('\nCONFIRA estes pontos (uma venda reembolsada ainda poderia entrar na conta):')
    for rel, n, s in aten: print(f'  {rel}:{n}   {s[:120]}')
    print('\n  Se o resultado desses pontos for somado/contado como venda, acrescente  .eq(\'event_type\', \'sale\')  na consulta (ou filtre event_type === \'sale\' no código).')
else: print('\n  Nenhuma leitura sem filtro de tipo encontrada: todo valor/contagem de venda já exclui os reembolsos.')
if rt:
    print('\nREALTIME em telao_events (o reembolso chega como UPDATE; telas abertas só se corrigem sozinhas se tratarem UPDATE):')
    for rel, n, ev in rt: print(f'  {rel}:{n}   evento: {ev}' + ('   ← só INSERT: telas abertas corrigem no próximo recarregamento' if ev == 'INSERT' else ''))
sys.exit(1 if (FALHAR and aten) else 0)
