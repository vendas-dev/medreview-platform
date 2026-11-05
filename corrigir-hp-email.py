#!/usr/bin/env python3
"""
CONSULTAR HP — corrige o aviso falso "Nome do lead diverge" quando o closer digitou o E-MAIL no campo "Nome do Lead".

  uso (na RAIZ do projeto):   python corrigir-hp-email.py .
                              python corrigir-hp-email.py . --dry-run     (só mostra o que faria)
                              python corrigir-hp-email.py . --desfazer    (volta ao que era)

Altera UM arquivo existente: lib/vendas/hp.ts (só a função de conferência; nada de banco, rota ou tela).
  • Antes: o que o closer digitou no campo "Nome do Lead" era sempre comparado com o NOME do banco. Se ele digitou o e-mail, dava divergência falsa.
  • Agora: se o valor digitado parece um e-mail, compara com o E-MAIL do banco (igual = confere). Se for outro e-mail (ou o banco não tiver e-mail), olha o texto antes do @: se
    contém os nomes do lead, confere. Se não bater de verdade, continua avisando (agora mostrando o e-mail do banco). Quem digita um NOME continua exatamente como antes.
SEGURANÇA: guarda cópia exata (lib/vendas/hp.ts.bak-hp-email); tudo-ou-nada (trecho não reconhecido = NADA é gravado e o script diz qual); rodar de novo não duplica; preserva CRLF/LF e BOM.
"""
import os, sys
ARQ = 'lib/vendas/hp.ts'; BAK = '.bak-hp-email'
HELPER = '\nconst EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/\nconst emailNorm = (s?: string | null) => (s ?? \'\').trim().toLowerCase()\n/** "Nome do lead" digitado pelo closer × o que está no banco. Se o closer digitou o E-MAIL do lead nesse campo (acontece), compara com o E-MAIL do banco — e não com o nome.\n *  Igual = confere. Se o e-mail for outro (ou o banco não tiver e-mail), olha o texto antes do @: se contém os nomes do lead, confere (provavelmente outro e-mail da mesma pessoa). */\nfunction conferirLead(v: VendaBanco, p: PedidoInfo): Conf {\n  const digitado = (p.lead_name ?? \'\').trim(), nome = normalizar(v.lead_name)\n  if (EMAIL.test(digitado)) {\n    const dg = emailNorm(digitado), leadEhEmail = EMAIL.test((v.lead_name ?? \'\').trim())\n    const emBanco = emailNorm(v.email) || (leadEhEmail ? emailNorm(v.lead_name) : \'\')\n    const local = normalizar(dg.split(\'@\')[0]).replace(/ /g, \'\'), partes = leadEhEmail ? [] : nome.split(\' \').filter(x => x.length > 2)\n    const pelaNome = !!local && partes.length > 0 && partes.filter(x => local.includes(x)).length / partes.length >= 0.6\n    const banco = v.email?.trim() || (leadEhEmail ? (v.lead_name ?? \'\').trim() : \'\') || v.lead_name || \'—\'\n    return { campo: \'lead\', rotulo: \'E-mail do lead\', pedido: digitado, banco, status: emBanco === dg || pelaNome ? \'confere\' : !emBanco && !nome ? \'sem_dado\' : \'diverge\' }\n  }\n  const pl = normalizar(p.lead_name)\n  return { campo: \'lead\', rotulo: \'Nome do lead\', pedido: p.lead_name, banco: v.lead_name ?? \'—\', status: !nome ? \'sem_dado\' : contem(nome, pl) ? \'confere\' : (() => { const a = new Set(nome.split(\' \')), b = pl.split(\' \').filter(x => x.length > 2); return b.length && b.filter(x => a.has(x)).length / b.length >= 0.6 ? \'confere\' : \'diverge\' })() }\n}\n'
EDITS = [
  ('function conferirLead', 'const contem = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a))' + '\n', 'const contem = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a))' + '\n' + HELPER + '\n', 'função que confere o "nome do lead" (com e-mail)'),
  ("  const prod = normalizar(v.product), pp = normalizar(p.product)\n  const campos", '  const lead = normalizar(v.lead_name), pl = normalizar(p.lead_name), prod = normalizar(v.product), pp = normalizar(p.product)' + '\n  const campos', "  const prod = normalizar(v.product), pp = normalizar(p.product)\n  const campos", 'tira as variáveis do nome que não são mais usadas aqui'),
  ('conferirLead(v, p),', "    { campo: 'lead', rotulo: 'Nome do lead', pedido: p.lead_name, banco: v.lead_name ?? '—', status: !lead ? 'sem_dado' : contem(lead, pl) ? 'confere' : (() => { const a = new Set(lead.split(' ')), b = pl.split(' ').filter(x => x.length > 2); return b.length && b.filter(x => a.has(x)).length / b.length >= 0.6 ? 'confere' : 'diverge' })() }," + '\n', '    conferirLead(v, p),\n', 'a conferência do lead passa a usar a nova função'),
]
def le(p):
    raw = open(p, 'rb').read(); bom = raw.startswith(b'\xef\xbb\xbf'); t = (raw[3:] if bom else raw).decode('utf-8'); return t.replace('\r\n', '\n'), ('\r\n' in t), bom
def grava(p, t, crlf, bom):
    b = (t.replace('\n', '\r\n') if crlf else t).encode('utf-8'); open(p, 'wb').write((b'\xef\xbb\xbf' + b) if bom else b)
def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else None; modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not raiz or not os.path.isdir(os.path.join(raiz, 'lib')): print(__doc__); return 2
    p = os.path.join(raiz, *ARQ.split('/'))
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Consultar HP: conferência por e-mail\n')
    if modo == 'desfazer':
        if os.path.isfile(p + BAK): os.replace(p + BAK, p); print('✔ ' + ARQ + '\n  ✓ restaurado da cópia de segurança\n\nTudo certo.')
        else: print('Nada a desfazer.')
        return 0
    if not os.path.isfile(p): print('✘ ' + ARQ + ' não encontrado (rode na raiz do projeto)'); return 1
    texto, crlf, bom = le(p); novo, msgs, ok = texto, [], True
    for marcador, antes, depois, desc in EDITS:
        if marcador in novo: msgs.append('  · já estava assim: ' + desc); continue
        n = novo.count(antes)
        if n != 1: ok = False; msgs.append(f'  ✗ {desc}: o trecho esperado apareceu {n} vez(es) (precisa ser exatamente 1)'); continue
        novo = novo.replace(antes, depois); msgs.append('  ✓ alterado: ' + desc)
    print(('✔ ' if ok else '✘ ') + ARQ); print('\n'.join(msgs))
    if not ok: print('\nNADA foi gravado. Me mande o seu lib/vendas/hp.ts atual que eu ajusto o script.'); return 1
    if modo == 'dry': print('\n(simulação) nada foi gravado.'); return 0
    if novo == texto: print('\nJá aplicado. Nada foi alterado.'); return 0
    if not os.path.exists(p + BAK): open(p + BAK, 'wb').write(open(p, 'rb').read())
    grava(p, novo, crlf, bom); print('\nOK: conferência por e-mail instalada.\nPróximo passo: commit + push + deploy e teste o "Consultar HP" de uma troca em que o closer digitou o e-mail.'); return 0
if __name__ == '__main__':
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
    sys.exit(main(sys.argv[1:]))
