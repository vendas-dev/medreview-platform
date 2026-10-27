#!/usr/bin/env python3
"""
Oculta a "Visão Geral" (/intel): tira do menu, desliga os cliques que levavam até ela e faz QUALQUER acesso a /intel (link antigo, favorito, clique em algum gráfico) cair no /dashboard.
NÃO apaga nada (o código original da página fica guardado) e NÃO mexe em /intel/goals ("Meta dos Closers").

  uso (na raiz do projeto):   python3 ocultar-visao-geral.py .

  components/shell/Sidebar.tsx                        tira o item "Visão Geral" da seção Administração
  app/(platform)/dashboard/CommercialAnalysis.tsx     os cartões KPI deixam de ser clicáveis para /intel (o hover continua; os que levam ao /telao continuam iguais)
  app/(platform)/dashboard/ForecastSection.tsx        tira o link "Ver detalhe →" do "Sinal vital da recorrência" (e o ícone ArrowRight, se ficar sem uso)
  app/(platform)/intel/page.tsx                       passa a só redirecionar para /dashboard; o código ORIGINAL vai para app/(platform)/intel/page.original.txt (pra reativar: apague o page.tsx e renomeie o .txt de volta)
TUDO-OU-NADA: confere os 4 antes; se um arquivo não for encontrado ou algo inesperado aparecer, NÃO grava nenhum. Pode rodar de novo ("já aplicado"). Mantém CRLF.
"""
import re, sys, os
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')      # o terminal do Windows às vezes não aceita acentos/✓
except Exception: pass
ROOT = sys.argv[1] if len(sys.argv) == 2 else None
if not ROOT: print(__doc__); sys.exit(2)
ARQ = {'sidebar': 'components/shell/Sidebar.tsx', 'comercial': 'app/(platform)/dashboard/CommercialAnalysis.tsx', 'forecast': 'app/(platform)/dashboard/ForecastSection.tsx', 'intel': 'app/(platform)/intel/page.tsx'}
def load(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p): print(f'NADA foi alterado: arquivo não encontrado: {rel} (rode na raiz do projeto)'); sys.exit(1)
    raw = open(p, 'rb').read().decode('utf-8'); return p, raw.replace('\r\n', '\n'), '\r\n' in raw
OUT, REL, EXTRA = {}, [], []          # EXTRA = arquivos a criar/trocar por inteiro (backup e nova página do /intel)
# 1) Sidebar: o item da Visão Geral (href '/intel' exato — '/intel/goals' não casa)
p, s, crlf = load(ARQ['sidebar'])
item = re.compile(r"^[ \t]*\{[^\n}]*href:\s*['\"]/intel['\"]\s*\},?[ \t]*\n", re.M)
n = len(item.findall(s))
if n > 1: print(f'NADA foi alterado: Sidebar: achei {n} itens com href /intel (esperava 0 ou 1). Me mande o arquivo.'); sys.exit(1)
if n == 1: s = item.sub('', s, count=1)
OUT[p] = (s, crlf); REL.append(('Sidebar.tsx', f'{n} item removido' if n else 'já estava sem o item'))
# 2) Cartões KPI do Painel Comercial
p, s, crlf = load(ARQ['comercial'])
n = len(re.findall(r'\shref="/intel"', s))
s = re.sub(r'(\s)href="/intel"', '', s)          # tira só o atributo (mantém o espaço anterior)
if re.search(r'''href=\{?["'`]/intel(?![/\w])''', s): print('NADA foi alterado: CommercialAnalysis: sobrou um link para /intel em formato inesperado. Me mande o arquivo.'); sys.exit(1)
OUT[p] = (s, crlf); REL.append(('CommercialAnalysis.tsx', f'{n} cartão(ões) sem link' if n else 'já estava sem os links'))
# 3) "Ver detalhe →" do Sinal vital da recorrência
p, s, crlf = load(ARQ['forecast'])
link = re.compile(r'\n[ \t]*right=\{<Link href="/intel"[^\n]*?</Link>\}(?=>)')
n = len(link.findall(s))
if n > 1: print(f'NADA foi alterado: ForecastSection: achei {n} links "Ver detalhe" para /intel (esperava 0 ou 1).'); sys.exit(1)
if n == 1:
    s = link.sub('', s, count=1)
    if len(re.findall(r'\bArrowRight\b', s)) == 1:          # só sobrou o import: tira pra não deixar import sem uso
        s = re.sub(r'\bArrowRight,\s*', '', s, count=1)
if re.search(r'<Link href="/intel"', s): print('NADA foi alterado: ForecastSection: sobrou um <Link> para /intel em formato inesperado. Me mande o arquivo.'); sys.exit(1)
OUT[p] = (s, crlf); REL.append(('ForecastSection.tsx', 'link "Ver detalhe" removido' if n else 'já estava sem o link'))
MARCA = '[visao-geral-oculta]'
NOVA_PAGINA = """// [visao-geral-oculta] A "Visão Geral" foi ocultada: quem chegar aqui (link antigo, favorito, clique em algum gráfico) vai para o dashboard.
// O código ORIGINAL desta página está guardado em page.original.txt (nesta mesma pasta).
// Para reativar a Visão Geral: apague este arquivo e renomeie page.original.txt para page.tsx.
// É um redirecionamento TEMPORÁRIO (o navegador não "decora" o destino), então reativar é só devolver o arquivo.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function IntelPage() {
  redirect('/dashboard')
}
"""
p, s, crlf = load(ARQ['intel'])
if MARCA in s: REL.append(('intel/page.tsx', 'já redireciona para /dashboard'))
else:
    original = open(p, 'rb').read(); bak = os.path.join(os.path.dirname(p), 'page.original.txt')
    if os.path.exists(bak) and open(bak, 'rb').read() != original:
        print('NADA foi alterado: já existe app/(platform)/intel/page.original.txt com conteúdo DIFERENTE do page.tsx atual. Renomeie ou apague esse arquivo e rode de novo.'); sys.exit(1)
    EXTRA.append((bak, original)); EXTRA.append((p, (NOVA_PAGINA.replace('\n', '\r\n') if crlf else NOVA_PAGINA).encode('utf-8')))
    REL.append(('intel/page.tsx', 'agora redireciona para /dashboard (original guardado em page.original.txt)'))
# grava (só chega aqui se tudo conferiu)
mudou = [p for p, (s, c) in OUT.items() if (s.replace('\n', '\r\n') if c else s).encode('utf-8') != open(p, 'rb').read()]
if not mudou and not EXTRA: print('Já aplicado (nada para ocultar). Nada foi alterado.'); sys.exit(0)
for p, b in EXTRA: open(p, 'wb').write(b)          # primeiro o backup e a nova página; depois os demais
for p in mudou: s, c = OUT[p]; open(p, 'wb').write((s.replace('\n', '\r\n') if c else s).encode('utf-8'))
print('OK: Visão Geral oculta.'); [print(f'  ✓ {a}: {b}') for a, b in REL]
