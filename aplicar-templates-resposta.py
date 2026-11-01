#!/usr/bin/env python3
"""
TEMPLATES — um template que NUNCA disparou deixa de mostrar "disparos / taxa de resposta" que são de OUTRO template.

Como era: a página liga cada template aos disparos só pelo NOME (hubspot_name e, se não achar, name), sem identificador único. Então dois templates com o mesmo
nome, ou um template cujo "name" é igual ao "hubspot_name" de outro, mostravam os MESMOS números, mesmo sem ter enviado nada.
Como fica:
  • hubspot_name (o nome que a integração usa): vale se UM único template ativo o tem;
  • name (nome interno): só vale se nenhum template o usa como hubspot_name e nenhum outro template ativo tem o mesmo name;
  • nome repetido em 2+ templates = ambíguo: NÃO é atribuído a nenhum (aparece como "sem disparos" em vez de números de outro).
TAMBÉM corrige o CORTE EM 1.000 LINHAS: a página lia 'disparos' com .limit(999999) e o Supabase devolvia só 1.000 linhas arbitrárias, então os números de TODOS os templates
ficavam parciais (só os 3 primeiros nomes do seu resultado já somam 1.624 disparos). Agora lê por janelas de tempo, dividindo ao meio a janela que vem cheia.
NÃO muda: o corte de 30/09 e a regra de contar resposta (respondido_at).
Rode ANTES conferir-templates-resposta.sql no Supabase para ver, template por template, quem está herdando números de quem.

Alterado: app/(platform)/templates/page.tsx  (3 trechos: 1 função no fim do arquivo + a consulta dos disparos + a regra de atribuição).
(v2: não depende do Promise.all nem do lugar do export default; busca os templates ativos num comando separado.)
Uso (na RAIZ do projeto):  python aplicar-templates-resposta.py .   |  --dry-run  |  --desfazer
Tudo-ou-nada: se UM trecho não for achado exatamente uma vez, o arquivo NÃO é tocado e o motivo aparece. Rodar de novo não duplica. Preserva CRLF/LF e BOM.
"""
import os, sys

ARQ = 'app/(platform)/templates/page.tsx'
EDITS = {
  ARQ: [
    ('função fetchDisparos acrescentada no FIM do arquivo (leitura por janelas de tempo; o Supabase corta em 1.000 linhas)',
     None,
     "// O Supabase corta SILENCIOSAMENTE cada resposta em 1.000 linhas e ignora .limit(999999): com milhares de disparos a página recebia só 1.000 linhas\n// arbitrárias e TODOS os números por template ficavam parciais. Aqui lê por JANELAS DE TEMPO e divide ao meio a janela que voltar cheia (1.000 linhas),\n// até cada uma caber. Exato, não depende de coluna única nem de ordem. (Só não consegue dividir mais de 1.000 disparos no MESMO milissegundo.)\nasync function fetchDisparos(admin: any, startIso: string, endIso: string): Promise<{ template: string | null; respondido_at: string | null }[]> {\n  const { data, error } = await admin.from('disparos').select('template, respondido_at').gte('data_disparo', startIso).lt('data_disparo', endIso).limit(1000)\n  if (error) return []\n  const rows = data ?? []\n  if (rows.length < 1000) return rows\n  const a = Date.parse(startIso), b = Date.parse(endIso)\n  if (!(b - a > 1)) return rows\n  const mid = new Date(a + Math.floor((b - a) / 2)).toISOString()\n  const left = await fetchDisparos(admin, startIso, mid)\n  const right = await fetchDisparos(admin, mid, endIso)\n  return [...left, ...right]\n}\n"),
    ('disparos lidos por janelas de tempo (sem o corte em 1.000 linhas)',
     "disparosAdmin.from('disparos').select('template, respondido_at').gte('data_disparo', cutoffStart).limit(999999)",
     'fetchDisparos(disparosAdmin, cutoffStart, new Date(Date.now() + 3600000).toISOString())'),
    ('um template NÃO herda os números de outro (nome repetido = ambíguo = sem atribuição) + busca dos templates ativos',
     "  const templateStats: Record<string, { disparos: number; respostas: number }> = {}\n  ;(templates ?? []).forEach((t: any) => {\n    const byHub  = countsByName.get(normalizeTemplateName(t.hubspot_name ?? ''))\n    const byName = countsByName.get(normalizeTemplateName(t.name ?? ''))\n    const found = byHub ?? byName\n    if (found) templateStats[t.id] = found\n  })",
     '  // Todos os templates ATIVOS (inclusive de outros times) para saber quantos reivindicam cada nome.\n  const { data: allActive } = await disparosAdmin.from(\'templates\').select(\'id, name, hubspot_name\').eq(\'is_active\', true)\n  // Não existe identificador único ligando template ↔ disparo: só o NOME. Para um template não "herdar" números que são de outro:\n  //  • o hubspot_name é o nome que a integração usa: se UM único template ativo o tem, os disparos com esse nome são dele;\n  //  • o name (nome interno) só vale quando NENHUM template o usa como hubspot_name e nenhum outro template ativo tem o mesmo name;\n  //  • nome repetido em 2+ templates é AMBÍGUO: não é atribuído a nenhum (melhor mostrar "sem disparos" do que números de outro template).\n  const hubClaims = new Map<string, number>(), nameClaims = new Map<string, number>()\n  ;(allActive ?? []).forEach((t: any) => {\n    const h = normalizeTemplateName(t.hubspot_name ?? \'\'), n = normalizeTemplateName(t.name ?? \'\')\n    if (h) hubClaims.set(h, (hubClaims.get(h) ?? 0) + 1)\n    if (n) nameClaims.set(n, (nameClaims.get(n) ?? 0) + 1)\n  })\n  const templateStats: Record<string, { disparos: number; respostas: number }> = {}\n  ;(templates ?? []).forEach((t: any) => {\n    const kHub = normalizeTemplateName(t.hubspot_name ?? \'\'), kName = normalizeTemplateName(t.name ?? \'\')\n    const byHub  = kHub && hubClaims.get(kHub) === 1 ? countsByName.get(kHub) : undefined\n    const byName = kName && !hubClaims.has(kName) && nameClaims.get(kName) === 1 ? countsByName.get(kName) : undefined\n    const found = byHub ?? byName\n    if (found) templateStats[t.id] = found\n  })')
  ],
}

def processa(raiz, rel, edits, modo):
    caminho = os.path.join(raiz, *rel.split('/'))
    if not os.path.isfile(caminho): return 'erro', [f'  ✗ arquivo não encontrado: {rel}']
    bruto = open(caminho, 'rb').read(); bom = bruto.startswith(b'\xef\xbb\xbf'); crlf = b'\r\n' in bruto
    texto = bruto.decode('utf-8-sig').replace('\r\n', '\n'); rel_out, erros, novo = [], False, texto
    for desc, antes, depois in edits:
        aplicado = depois in novo
        if antes is None:                                                   # acrescentar no FIM do arquivo (e remover, no desfazer)
            if modo == 'desfazer':
                if not aplicado: rel_out.append(f'  · já estava como antes: {desc}'); continue
                novo = novo.replace('\n' + depois, '', 1); rel_out.append(f'  ✓ revertido: {desc}'); continue
            if aplicado: rel_out.append(f'  · já estava assim: {desc}'); continue
            novo = novo + '\n' + depois; rel_out.append(f'  ✓ alterado: {desc}'); continue
        if modo == 'desfazer':
            if not aplicado: rel_out.append(f'  · já estava como antes: {desc}'); continue
            de, para = depois, antes
        else:
            if aplicado: rel_out.append(f'  · já estava assim: {desc}'); continue
            de, para = antes, depois
        n = novo.count(de)
        if n == 1: novo = novo.replace(de, para); rel_out.append(f'  ✓ {"revertido" if modo == "desfazer" else "alterado"}: {desc}')
        else: erros = True; rel_out.append(f'  ✗ {desc}: o trecho esperado apareceu {n} vez(es) (precisa ser exatamente 1) — arquivo NÃO alterado')
    if erros: return 'erro', rel_out
    if novo != texto and modo != 'dry':
        saida = novo.replace('\n', '\r\n') if crlf else novo
        dados = saida.encode('utf-8'); dados = (b'\xef\xbb\xbf' + dados) if bom else dados
        tmp = caminho + '.tpl.tmp'; open(tmp, 'wb').write(dados); os.replace(tmp, caminho)
    return 'ok', rel_out

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else '.'
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'lib')):
        print('Rode na RAIZ do projeto (onde ficam as pastas app/ e lib/), ex.: python aplicar-templates-resposta.py .'); return 2
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Templates: disparos e taxa de resposta sem herança\n')
    falhas = 0
    for rel, edits in EDITS.items():
        st, linhas = processa(raiz, rel, edits, modo)
        print(('✔ ' if st == 'ok' else '✘ ') + rel); print('\n'.join(linhas)); falhas += st != 'ok'
    print(f'\n{"Tudo certo." if not falhas else str(falhas) + " arquivo(s) com problema."}')
    return 1 if falhas else 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
