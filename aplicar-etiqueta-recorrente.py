#!/usr/bin/env python3
"""ETIQUETA "RECORRENTE" NAS TABELAS DE VENDAS — Minhas Vendas (closer), Vendas Individuais e Vendas Gerais (superadmin).
Marca em violeta, na coluna Data, a venda que é pagamento recorrente (parcela de assinatura): "Recorrente 2/12" (ou só "Recorrente" se a parcela não vier). Convive com a etiqueta vermelha "Reembolso" (uma abaixo da outra).
Critério (o mesmo da coluna "Tipo" de Vendas Gerais): sale_type = 'recorrente' OU is_recurring = true. Não muda somas, filtros, banco nem servidor.
PRÉ-REQUISITO: o pacote "reembolsadas-na-lista" já instalado (esta etiqueta fica ao lado da de Reembolso). Se não estiver, o instalador avisa e não altera nada.
Uso, na RAIZ do projeto:   python aplicar-etiqueta-recorrente.py .
   --dry-run   só mostra o que faria        --desfazer   volta ao que estava (usa as cópias .bak-recorrente)
Faz EDIÇÕES PONTUAIS (3 arquivos), cada trecho localizado por um texto exato. Se algum não for encontrado, RECUSA e não altera nada. Preserva a quebra de linha do Windows (CRLF)."""
import sys, os, json, base64, shutil
EDITS = json.loads(base64.b64decode(
'eyJjb21wb25lbnRzL3ZlbmRhcy91aS50c3giOiBbWyJpbXBvcnQgeyBDaGVjaywgQ2hldnJvbkRvd24sIExvYWRlcjIsIFNlYXJj'
'aCwgVW5kbzIsIFggfSBmcm9tICdsdWNpZGUtcmVhY3QnIiwgImltcG9ydCB7IENoZWNrLCBDaGV2cm9uRG93biwgTG9hZGVyMiwg'
'UmVwZWF0MiwgU2VhcmNoLCBVbmRvMiwgWCB9IGZyb20gJ2x1Y2lkZS1yZWFjdCciXSwgWyIvLyDilIDilIAgRXN0cnV0dXJhIOKU'
'gOKUgFxuIiwgIi8qKiBQYWdhbWVudG8gUkVDT1JSRU5URSAocGFyY2VsYSBkZSBhc3NpbmF0dXJhLCAywqogZW0gZGlhbnRlKTog'
'bWVzbW8gY3JpdMOpcmlvIGRhIGNvbHVuYSBcIlRpcG9cIiBkZSBWZW5kYXMgR2VyYWlzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVo'
'UmVjb3JyZW50ZSh2OiB7IHNhbGVfdHlwZT86IHN0cmluZyB8IG51bGw7IGlzX3JlY3VycmluZz86IGJvb2xlYW4gfCBudWxsIH0p'
'IHsgcmV0dXJuIHYuc2FsZV90eXBlID09PSAncmVjb3JyZW50ZScgfHwgdi5pc19yZWN1cnJpbmcgPT09IHRydWUgfVxuLyoqIEEg'
'ZXRpcXVldGEgdmlvbGV0YSBcIlJlY29ycmVudGUgMi8xMlwiIChuID0gcGFyY2VsYSBhdHVhbCwgdG90YWwgPSBuwrogZGUgcGFy'
'Y2VsYXMgZGEgYXNzaW5hdHVyYTsgYW1ib3Mgb3BjaW9uYWlzKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBFdGlxdWV0YVJlY29ycmVu'
'dGUoeyBuLCB0b3RhbCB9OiB7IG4/OiBudW1iZXIgfCBudWxsOyB0b3RhbD86IG51bWJlciB8IG51bGwgfSkge1xuICBjb25zdCBu'
'dW0gPSBuID8gYCR7bn0ke3RvdGFsID8gJy8nICsgdG90YWwgOiAnJ31gIDogJydcbiAgY29uc3QgZGljYSA9IG4gPyBgUGFnYW1l'
'bnRvIHJlY29ycmVudGUgKGFzc2luYXR1cmEpOiBwYXJjZWxhICR7bn0ke3RvdGFsID8gJyBkZSAnICsgdG90YWwgOiAnJ30uYCA6'
'ICdQYWdhbWVudG8gcmVjb3JyZW50ZSAocGFyY2VsYSBkZSBhc3NpbmF0dXJhKS4nXG4gIHJldHVybiA8c3BhbiBkYXRhLXY9XCJ0'
'YWctcmVjb3JyZW50ZVwiIHJvbGU9XCJub3RlXCIgdGl0bGU9e2RpY2F9IGFyaWEtbGFiZWw9e2RpY2F9IGNsYXNzTmFtZT1cInZk'
'LWNoaXBcIiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIHdpZHRoOiAnZml0LWNvbnRlbnQnLCBhbGlnbkl0ZW1zOiAnY2VudGVy'
'JywgZ2FwOiA1LCBtYXJnaW5Ub3A6IDYsIHBhZGRpbmc6ICczcHggOXB4JywgYm9yZGVyUmFkaXVzOiA5OSwgZm9udFNpemU6IDEx'
'LjUsIGZvbnRXZWlnaHQ6IDgwMCwgd2hpdGVTcGFjZTogJ25vd3JhcCcsIGNvbG9yOiAnY29sb3ItbWl4KGluIHNyZ2IsIzdjM2Fl'
'ZCA1NSUsdmFyKC0tZm9yZWdyb3VuZCkpJywgYmFja2dyb3VuZDogJ2NvbG9yLW1peChpbiBzcmdiLCM4YjVjZjYgMTMlLHRyYW5z'
'cGFyZW50KScsIGJvcmRlcjogJzFweCBzb2xpZCBjb2xvci1taXgoaW4gc3JnYiwjOGI1Y2Y2IDM0JSx0cmFuc3BhcmVudCknIH19'
'PjxSZXBlYXQyIHNpemU9ezEyfSAvPlJlY29ycmVudGV7bnVtID8gJyAnICsgbnVtIDogJyd9PC9zcGFuPlxufVxuXG4vLyDilIDi'
'lIAgRXN0cnV0dXJhIOKUgOKUgFxuIl1dLCAiY29tcG9uZW50cy92ZW5kYXMvVmVuZGFzVGFibGUudHN4IjogW1siaW1wb3J0IHsg'
'Q2hpcCwgRXRpcXVldGFSZWVtYm9sc28gfSBmcm9tICcuL3VpJyIsICJpbXBvcnQgeyBDaGlwLCBFdGlxdWV0YVJlY29ycmVudGUs'
'IEV0aXF1ZXRhUmVlbWJvbHNvLCBlaFJlY29ycmVudGUgfSBmcm9tICcuL3VpJyJdLCBbInt2LmlzX3JlZnVuZGVkID8gPD48c3Bh'
'biBjbGFzc05hbWU9XCJyZi1kaW1cIj57Zm10RGF0YUhvcmEodi5vY2N1cnJlZF9hdCl9PC9zcGFuPjxFdGlxdWV0YVJlZW1ib2xz'
'byBlbT17di5yZWZ1bmRlZF9hdH0gbW90aXZvPXt2LnJlZnVuZF9yZWFzb259IC8+PC8+IDogZm10RGF0YUhvcmEodi5vY2N1cnJl'
'ZF9hdCl9PC90ZD4iLCAiPHNwYW4gY2xhc3NOYW1lPXt2LmlzX3JlZnVuZGVkID8gJ3JmLWRpbScgOiB1bmRlZmluZWR9PntmbXRE'
'YXRhSG9yYSh2Lm9jY3VycmVkX2F0KX08L3NwYW4+e2VoUmVjb3JyZW50ZSh2KSAmJiA8RXRpcXVldGFSZWNvcnJlbnRlIG49e3Yu'
'aW5zdGFsbG1lbnRfbnVtYmVyfSB0b3RhbD17di50b3RhbF9pbnN0YWxsbWVudHN9IC8+fXt2LmlzX3JlZnVuZGVkICYmIDxFdGlx'
'dWV0YVJlZW1ib2xzbyBlbT17di5yZWZ1bmRlZF9hdH0gbW90aXZvPXt2LnJlZnVuZF9yZWFzb259IC8+fTwvdGQ+Il1dLCAiY29t'
'cG9uZW50cy92ZW5kYXMvR2VyYWlzVGFibGUudHN4IjogW1siaW1wb3J0IHsgQXZhdGFyLCBDaGlwLCBFdGlxdWV0YVJlZW1ib2xz'
'bywgVGVhbUJhZGdlIH0gZnJvbSAnLi91aSciLCAiaW1wb3J0IHsgQXZhdGFyLCBDaGlwLCBFdGlxdWV0YVJlY29ycmVudGUsIEV0'
'aXF1ZXRhUmVlbWJvbHNvLCBUZWFtQmFkZ2UgfSBmcm9tICcuL3VpJyJdLCBbInt2LnJlZW1ib2xzYWRhICYmIDxFdGlxdWV0YVJl'
'ZW1ib2xzbyBlbT17di5yZWZ1bmRlZF9hdH0gbW90aXZvPXt2LnJlZnVuZF9yZWFzb259IC8+fTwvdGQ+IiwgIntyZWMgJiYgPEV0'
'aXF1ZXRhUmVjb3JyZW50ZSBuPXt2Lmluc3RhbGxtZW50X251bWJlcn0gdG90YWw9e3YudG90YWxfaW5zdGFsbG1lbnRzfSAvPn17'
'di5yZWVtYm9sc2FkYSAmJiA8RXRpcXVldGFSZWVtYm9sc28gZW09e3YucmVmdW5kZWRfYXR9IG1vdGl2bz17di5yZWZ1bmRfcmVh'
'c29ufSAvPn08L3RkPiJdXX0='
).decode('utf-8'))
ARQ = {'components/vendas/ui.tsx': 'components/vendas/ui.tsx', 'components/vendas/VendasTable.tsx': 'components/vendas/VendasTable.tsx', 'components/vendas/GeraisTable.tsx': 'components/vendas/GeraisTable.tsx'}
BAK = '.bak-recorrente'
def ler(p):
    raw = open(p, 'rb').read(); return raw, raw.decode('utf-8').replace('\r\n', '\n'), b'\r\n' in raw
def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]; raiz = os.path.abspath(a[0] if a else '.'); seco = '--dry-run' in sys.argv; desfazer = '--desfazer' in sys.argv
    if not (os.path.isdir(os.path.join(raiz, 'lib', 'vendas')) and os.path.isdir(os.path.join(raiz, 'components', 'vendas'))): print('Rode na RAIZ do projeto (a pasta que tem lib/vendas e components/vendas).'); return 2
    if desfazer:
        n = 0
        for rel in EDITS:
            p = os.path.join(raiz, *rel.split('/')); b = p + BAK
            if not os.path.exists(b): print('  (sem cópia de segurança) ' + rel); continue
            if not seco: shutil.copyfile(b, p); os.remove(b)
            n += 1; print(('  voltaria ' if seco else '  voltou ') + rel)
        print('Nada foi gravado (--dry-run).' if seco else f'Desfeito: {n} arquivo(s).'); return 0
    plano = []; recusa = []
    for rel, pares in EDITS.items():
        p = os.path.join(raiz, *rel.split('/'))
        if not os.path.exists(p): recusa.append(f'{rel}: o arquivo não existe nesta pasta'); continue
        raw, txt, crlf = ler(p)
        if all(nv in txt for _, nv in pares): plano.append((rel, p, 'ja', crlf, txt)); continue
        if 'EtiquetaReembolso' not in txt: recusa.append(f'{rel}: ainda não tem a etiqueta de Reembolso. Instale ANTES o pacote "reembolsadas-na-lista" e rode este de novo'); continue
        novo = txt; falta = []
        for i, (o, nv) in enumerate(pares):
            if nv in novo and o not in novo.replace(nv, ''): continue          # esta edição já está feita
            c = novo.count(o)
            if c != 1: falta.append(f'edição {i + 1}: o trecho esperado aparece {c}x (devia ser 1x): ' + o.strip().split(chr(10))[0][:90]); continue
            novo = novo.replace(o, nv)
        if falta: recusa.extend(f'{rel}: ' + f for f in falta)
        else: plano.append((rel, p, 'editar', crlf, novo))
    if recusa:
        print('RECUSADO — nada foi alterado:'); [print('  - ' + r) for r in recusa]; print('Se o motivo não for o pacote de Reembolso, me envie a versão atual desses arquivos.'); return 1
    if all(x[2] == 'ja' for x in plano): print('Já aplicado. Nada foi alterado.'); return 0
    for rel, p, est, crlf, novo in plano:
        if est == 'ja': print('  = já está feito ' + rel); continue
        if seco: print('  editaria ' + rel + (' (mantém CRLF)' if crlf else '')); continue
        if not os.path.exists(p + BAK): shutil.copyfile(p, p + BAK)
        if crlf: novo = novo.replace('\n', '\r\n')
        open(p, 'wb').write(novo.encode('utf-8')); print('  ok ' + rel)
    print('Nada foi gravado (--dry-run).' if seco else 'Pronto. Abra Minhas Vendas, Vendas Individuais e Vendas Gerais: as parcelas de assinatura levam a etiqueta violeta "Recorrente". (Voltar atrás: --desfazer)'); return 0
sys.exit(main())
