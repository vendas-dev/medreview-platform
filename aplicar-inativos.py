#!/usr/bin/env python3
"""
USUÁRIOS INATIVOS (profiles.is_active = false): some SÓ A LINHA dele (ranking, análises de IA, filtros, cadastro de campanha...).
NADA é retirado de soma: vendas, metas e totais continuam incluindo tudo que o inativo vendeu.

Uso (na RAIZ do projeto, onde ficam as pastas app/ e lib/):
    python aplicar-inativos.py .               aplica
    python aplicar-inativos.py . --dry-run     só mostra o que faria, sem gravar nada
    python aplicar-inativos.py . --desfazer    volta tudo ao que era antes

Garantias: cada arquivo é tudo-ou-nada (se UM trecho não for achado exatamente uma vez, o arquivo NÃO é tocado
e o motivo é mostrado); rodar de novo não duplica nada; quebras de linha (LF/CRLF) e BOM são preservados.
"""
import os, sys

ATIVO = ".or('is_active.is.null,is_active.eq.true')"      # ativo = is_active verdadeiro OU vazio (nunca some alguém por campo nulo)

EDITS = {
  # ── Dados Gerais (/dashboard) ─────────────────────────────────────────────────────────────────────────────────────
  # A lista de perfis continua COMPLETA (somas, metas e nomes das vendas antigas não mudam); só a LINHA do inativo é escondida.
  'app/(platform)/dashboard/page.tsx': [
    ("onboarding: lista de usuários (progresso de treinamento, não é venda)",
     "admin.from('profiles').select('id, name, team, role, email, avatar_url').neq('role', 'superadmin'),",
     "admin.from('profiles').select('id, name, team, role, email, avatar_url').neq('role', 'superadmin')" + ATIVO + ","),
    ("closers: traz também is_active (a lista segue completa)",
     "admin2.from('profiles').select('id, name, team, avatar_url, hubspot_id').neq('role', 'superadmin'),",
     "admin2.from('profiles').select('id, name, team, avatar_url, hubspot_id, is_active').neq('role', 'superadmin'),"),
    ("cartões de closer, IA e \"sem vender há dias\": esconde só a LINHA do inativo",
     "const closerCards = closers.map((c: any) => {",
     "const closerCards = closers.filter((c: any) => c.is_active !== false).map((c: any) => {"),
    ("ranking pessoal: traz também is_active",
     "admin3.from('profiles').select('id, hubspot_id').neq('role', 'superadmin'),",
     "admin3.from('profiles').select('id, hubspot_id, is_active').neq('role', 'superadmin'),"),
    ("ranking pessoal: esconde a linha do inativo",
     "const rankList = (allClosersForRank ?? []).map((c: any) => {",
     "const rankList = (allClosersForRank ?? []).filter((c: any) => c.is_active !== false).map((c: any) => {"),
  ],
  # ── IA de Dados Gerais (análise comercial) ───────────────────────────────────────────────────────────────────────
  'app/api/dashboard/commercial-analysis/route.ts': [
    ("closers: traz também is_active (a lista segue completa: ela também resolve o nome de quem certificou)",
     "admin.from('profiles').select('id, name, team, hubspot_id, avatar_url').neq('role', 'superadmin'),",
     "admin.from('profiles').select('id, name, team, hubspot_id, avatar_url, is_active').neq('role', 'superadmin'),"),
    ("ranking de certificações: esconde a linha do inativo (a contagem total continua)",
     "const key  = closer?.id ?? e.closer_hubspot_id ?? 'desconhecido'",
     "if (closer && closer.is_active === false) return   // inativo: some do ranking de certificações (a contagem total continua)\n    const key  = closer?.id ?? e.closer_hubspot_id ?? 'desconhecido'"),
    ("desempenho por closer enviado à IA: esconde o inativo",
     "const closerPerformance = closers.map((c: any) => {",
     "const closerPerformance = closers.filter((c: any) => c.is_active !== false).map((c: any) => {"),
  ],
  # ── Inteligência: a página marca o inativo; a tela esconde só a linha (somas por vertical/time seguem completas) ──
  'app/(platform)/intel/page.tsx': [
    ("traz também is_active",
     "admin.from('profiles').select('id, name, team, hubspot_id, avatar_url').neq('role','superadmin').order('name'),",
     "admin.from('profiles').select('id, name, team, hubspot_id, avatar_url, is_active').neq('role','superadmin').order('name'),"),
    ("marca o closer inativo (inativo: true)",
     "return { id:c.id, name:c.name, team:c.team,",
     "return { id:c.id, inativo: c.is_active === false, name:c.name, team:c.team,"),
  ],
  'app/(platform)/intel/IntelView.tsx': [
    ("filtro de closer: não oferece inativo",
     "...allClosers.map((c:any)=>({value:c.id,label:c.name}))]",
     "...allClosers.filter((c:any)=>!c.inativo).map((c:any)=>({value:c.id,label:c.name}))]"),
    ("lista completa (para somar) passa a se chamar filteredTodos",
     "const filtered = useMemo(() => {\n    let list = allClosers",
     "const filteredTodos = useMemo(() => {\n    let list = allClosers"),
    ("lista de LINHAS (filtered) = sem os inativos",
     "}, [allClosers, filterTeam, filterCloser, filterVert])",
     "}, [allClosers, filterTeam, filterCloser, filterVert])\n  // Linhas e filtros: some quem está INATIVO (só a linha). As SOMAS continuam usando filteredTodos / allClosers.\n  const filtered = useMemo(() => filteredTodos.filter((c:any) => !c.inativo), [filteredTodos])"),
    ("receita por vertical (soma) usa a lista completa",
     "filtered.forEach((c: any) => {",
     "filteredTodos.forEach((c: any) => {"),
    ("receita por vertical: dependência da lista completa",
     "}, [filtered, byVertical, filterVert, hasFilters])",
     "}, [filteredTodos, byVertical, filterVert, hasFilters])"),
    ("metas de embaixador R1: esconde a linha do inativo (os totais seguem completos)",
     "{ambassadorGoalRows.map((c:any) => {",
     "{ambassadorGoalRows.filter((c:any) => !c.inativo).map((c:any) => {"),
  ],
  'app/api/intel/generate/route.ts': [
    ("traz também is_active",
     "admin.from('profiles').select('id,name,team,hubspot_id').neq('role','superadmin').order('name'),",
     "admin.from('profiles').select('id,name,team,hubspot_id,is_active').neq('role','superadmin').order('name'),"),
    ("closers enviados à IA: esconde o inativo",
     "const context = (closers ?? []).map((c: any) => {",
     "const context = (closers ?? []).filter((c: any) => c.is_active !== false).map((c: any) => {"),
  ],
  # ── Cadastro de metas e onboarding: listas de pessoas (não somam vendas) ────────────────────────────────────────
  'app/(platform)/intel/goals/page.tsx': [
    ("cadastro de metas: não lista inativo (as metas já gravadas continuam somando)",
     "admin.from('profiles').select('id, name, team').neq('role', 'superadmin').order('name'),",
     "admin.from('profiles').select('id, name, team').neq('role', 'superadmin')" + ATIVO + ".order('name'),"),
  ],
  'app/(platform)/onboarding/dashboard/page.tsx': [
    ("onboarding: só ativos",
     "admin.from('profiles').select('id, name, team, role, email, avatar_url').neq('role', 'superadmin'),",
     "admin.from('profiles').select('id, name, team, role, email, avatar_url').neq('role', 'superadmin')" + ATIVO + ","),
  ],
  # ── Campanhas: participantes (ranking), lista de usuários dos avisos e destinatários ─────────────────────────────
  'lib/campaigns/server.ts': [
    ("participantes da campanha (ranking): sem inativos",
     ".filter(p => p.role !== 'superadmin' && TEAMS.includes(p.team) && teams.includes(p.team))",
     ".filter(p => p.role !== 'superadmin' && p.is_active !== false && TEAMS.includes(p.team) && teams.includes(p.team))"),
  ],
  'lib/campaigns/handlers.ts': [
    ("lista de usuários dos avisos: sem inativos",
     "return ok({ users: ((data ?? []) as any[]).map(p => ({ id: p.id, name: p.name ?? '(sem nome)',",
     "return ok({ users: ((data ?? []) as any[]).filter(p => p.is_active !== false).map(p => ({ id: p.id, name: p.name ?? '(sem nome)',"),
    ("destinatários: inativo nunca recebe aviso",
     "const { data: valid } = await admin.from('profiles').select('id').in('id', userIds)",
     "const { data: valid } = await admin.from('profiles').select('id').in('id', userIds)" + ATIVO),
  ],
}

def processa(raiz, rel, edits, modo):
    """Devolve (status, linhas_de_relatorio). status: 'ok' | 'erro'."""
    caminho = os.path.join(raiz, *rel.split('/'))
    if not os.path.isfile(caminho): return 'erro', [f'  ✗ arquivo não encontrado: {rel}']
    bruto = open(caminho, 'rb').read()
    bom = bruto.startswith(b'\xef\xbb\xbf'); crlf = b'\r\n' in bruto
    texto = bruto.decode('utf-8-sig').replace('\r\n', '\n')
    rel_out, erros, novo = [], False, texto
    for desc, antes, depois in edits:
        aplicado = depois in novo                      # o texto NOVO existe no arquivo ⇒ já está aplicado (o antigo pode ser só o começo dele)
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
        tmp = caminho + '.inativos.tmp'; open(tmp, 'wb').write(dados); os.replace(tmp, caminho)
    return 'ok', rel_out

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else '.'
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'lib')):
        print('Rode na RAIZ do projeto (onde ficam as pastas app/ e lib/), ex.: python aplicar-inativos.py .'); return 2
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— usuários inativos\n')
    falhas = 0
    for rel, edits in EDITS.items():
        st, linhas = processa(raiz, rel, edits, 'dry' if modo == 'dry' else modo)
        print(('✔ ' if st == 'ok' else '✘ ') + rel); print('\n'.join(linhas)); falhas += st != 'ok'
    print(f'\n{"Tudo certo." if not falhas else str(falhas) + " arquivo(s) com problema (os demais foram processados)."}')
    return 1 if falhas else 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
