#!/usr/bin/env python3
"""
DASHBOARD (Dados Gerais) — corrige o CORTE SILENCIOSO em 1.000 linhas nas consultas de vendas. (v2: tolerante a diferenças no seu arquivo)

O Supabase devolve no máximo 1.000 linhas por resposta e IGNORA .limit(999999). Um mês com mais de 1.000 vendas (o seu tem 1.027) chegava INCOMPLETO ao dashboard,
e como a consulta não tinha ordem, quais vendas ficavam de fora era arbitrário: cartões dos closers, ticket médio, "feito no mês" e metas subcontavam.
Este script troca CADA consulta  X.from('telao_events') ... .limit(999999)  por leitura PAGINADA (1.000 em 1.000, sempre na mesma ordem). Não muda NENHUMA regra de cálculo.

DIFERENÇA da v1: não depende da lista de colunas do .select(...) nem do resto da consulta; acha a consulta pela ESTRUTURA. Por isso funciona mesmo que o seu arquivo tenha
colunas diferentes das que eu vi. Ele lista cada consulta encontrada (com a linha) para você conferir. Não mexe em hubspot_leads nem geracoes_links (não tenho o esquema).

Uso (na RAIZ do projeto):   python aplicar-dashboard-paginacao.py .   |  --dry-run (só mostra)  |  --desfazer
Tudo-ou-nada: se nada for encontrado, ou algo parecer estranho, o arquivo NÃO é tocado e o motivo aparece. Rodar de novo não duplica. Preserva CRLF/LF e BOM.
"""
import os, re, sys

ARQ = 'app/(platform)/dashboard/page.tsx'
HELPER = """// O Supabase corta SILENCIOSAMENTE cada resposta em 1.000 linhas e ignora .limit(999999): um mês com mais de 1.000 vendas vinha INCOMPLETO
// (e sem ordem, então "quais vendas ficavam de fora" era arbitrário). Aqui lê de 1.000 em 1.000, sempre na mesma ordem, até acabar.
async function paged(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<{ data: any[] | null; error: any }> {
  const out: any[] = []
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) return { data: null, error }
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return { data: out, error: null }
}

"""
# uma consulta de telao_events que termina em .limit(999999) (sem outra .from( no meio: é a MESMA consulta)
RX_ANTES = re.compile(r"(\w+)\.from\('telao_events'\)((?:(?!\.limit\(999999\)|\.from\()[\s\S])*?)\.limit\(999999\)")
RX_DEPOIS = re.compile(r"paged\(\(a, b\) => (\w+)\.from\('telao_events'\)((?:(?!\.range\()[\s\S])*?)\.order\('occurred_at', \{ ascending: false \}\)\.order\('id'\)\.range\(a, b\)\)")
RX_FUNC = re.compile(r"^export default async function \w+\(", re.M)
ORDEM = ".order('occurred_at', { ascending: false }).order('id').range(a, b))"

def linha_de(texto, pos): return texto.count('\n', 0, pos) + 1

def transforma(texto, modo):
    msgs = []
    if modo == 'desfazer':
        achou = list(RX_DEPOIS.finditer(texto))
        novo = RX_DEPOIS.sub(lambda m: f"{m.group(1)}.from('telao_events'){m.group(2)}.limit(999999)", texto)
        for m in achou: msgs.append(f'  ✓ revertido: consulta da linha {linha_de(texto, m.start())}')
        if HELPER in novo: novo = novo.replace(HELPER, ''); msgs.append('  ✓ revertido: função paged')
        elif not achou: msgs.append('  · já estava como antes')
        return novo, msgs, True
    achou = list(RX_ANTES.finditer(texto)); tem_helper = 'async function paged(' in texto
    if not achou and not tem_helper: return texto, ['  ✗ nenhuma consulta .from(\'telao_events\') ... .limit(999999) foi encontrada neste arquivo — NÃO alterado (me mande o arquivo)'], False
    if not achou and tem_helper: return texto, ['  · já estava assim (nenhuma consulta com .limit(999999) sobrando)'], True
    m_fn = RX_FUNC.search(texto)
    if not tem_helper and not m_fn: return texto, ['  ✗ não achei "export default async function ..." para inserir a função — NÃO alterado (me mande o arquivo)'], False
    def troca(m):
        msgs.append(f'  ✓ consulta paginada (linha {linha_de(texto, m.start())}): {m.group(1)}.from(\'telao_events\'){re.sub(r"\s+", " ", m.group(2))[:70]}…')
        return f"paged((a, b) => {m.group(1)}.from('telao_events'){m.group(2)}{ORDEM}"
    novo = RX_ANTES.sub(troca, texto)
    if not tem_helper:
        m = RX_FUNC.search(novo); novo = novo[:m.start()] + HELPER + novo[m.start():]; msgs.insert(0, '  ✓ função paged (leitura de 1.000 em 1.000) inserida')
    return novo, msgs, True

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else '.'
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'lib')):
        print('Rode na RAIZ do projeto (onde ficam as pastas app/ e lib/), ex.: python aplicar-dashboard-paginacao.py .'); return 2
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Dashboard: leitura paginada das vendas\n')
    caminho = os.path.join(raiz, *ARQ.split('/'))
    if not os.path.isfile(caminho): print(f'✘ {ARQ}\n  ✗ arquivo não encontrado'); return 1
    bruto = open(caminho, 'rb').read(); bom = bruto.startswith(b'\xef\xbb\xbf'); crlf = b'\r\n' in bruto
    texto = bruto.decode('utf-8-sig').replace('\r\n', '\n')
    novo, msgs, ok = transforma(texto, 'desfazer' if modo == 'desfazer' else 'aplicar')
    print(('✔ ' if ok else '✘ ') + ARQ); print('\n'.join(msgs))
    if ok and novo != texto and modo != 'dry':
        saida = novo.replace('\n', '\r\n') if crlf else novo; dados = saida.encode('utf-8'); dados = (b'\xef\xbb\xbf' + dados) if bom else dados
        tmp = caminho + '.dash.tmp'; open(tmp, 'wb').write(dados); os.replace(tmp, caminho)
    print('\nTudo certo.' if ok else '\n1 arquivo com problema.'); return 0 if ok else 1

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
