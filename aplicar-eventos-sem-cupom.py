#!/usr/bin/env python3
"""EVENTOS (superadmin): contar também a venda com event_name E event_category preenchidos, mesmo com cupom vazio.
Hoje a Análise de Eventos só conta venda com cupom EV_...; depois: cupom EV_... OU (event_name e event_category preenchidos).
Uso, na RAIZ do projeto:   python aplicar-eventos-sem-cupom.py .
   --dry-run   só mostra o que faria        --desfazer   volta ao que estava (usa a cópia .bak-eventos-sem-cupom)
Acha sozinho o arquivo que tem "computeEventsAnalysis" (a função da Análise de Eventos). Edições PONTUAIS; se algum trecho esperado
não for encontrado, RECUSA e não altera nada. Preserva a quebra de linha do Windows (CRLF)."""
import sys, os, json, base64, shutil
EDITS = json.loads(base64.b64decode(
'W1siY29uc3QgdkxhYmVsID0gKGs6IHN0cmluZykgPT4gVkVSVF9MQUJFTFtrXSA/PyBrXG4iLCAiY29uc3QgdkxhYmVsID0gKGs6'
'IHN0cmluZykgPT4gVkVSVF9MQUJFTFtrXSA/PyBrXG5cbi8qKiBWZW5kYSBkZSBldmVudG86IGN1cG9tIEVWX+KApiBPVSAoZXZl'
'bnRfbmFtZSBFIGV2ZW50X2NhdGVnb3J5IHByZWVuY2hpZG9zLCBtZXNtbyBjb20gY3Vwb20gdmF6aW8pLiAqL1xuZXhwb3J0IGZ1'
'bmN0aW9uIGlzRXZlbnRTYWxlKHI6IHsgY291cG9uX2NvZGU/OiBzdHJpbmcgfCBudWxsOyBldmVudF9uYW1lPzogc3RyaW5nIHwg'
'bnVsbDsgZXZlbnRfY2F0ZWdvcnk/OiBzdHJpbmcgfCBudWxsIH0pOiBib29sZWFuIHtcbiAgaWYgKC9eRVYuL2kudGVzdChyLmNv'
'dXBvbl9jb2RlID8/ICcnKSkgcmV0dXJuIHRydWUgICAgIC8vIGlndWFsIGFvIGlsaWtlICdFVl8lJyBkZSBhbnRlcyAobm8gTElL'
'RSwgXCJfXCIgdmFsZSBxdWFscXVlciBjYXJhY3RlcmUpXG4gIHJldHVybiAhIShyLmV2ZW50X25hbWUgPz8gJycpLnRyaW0oKSAm'
'JiAhIShyLmV2ZW50X2NhdGVnb3J5ID8/ICcnKS50cmltKClcbn1cbiJdLCBbIiAgLy8gUXVhbHF1ZXIgdmVuZGEgY29tIGN1cG9t'
'IGRlIGV2ZW50byAoRVZfKSDigJQgw6kgZXNzZSBvIGNyaXTDqXJpbyBjb21iaW5hZG9cbiAgLy8gcHJhIHR1ZG8gcXVlIMOpIFwi'
'dmVuZGEgZGUgZXZlbnRvXCIgbm8gc2lzdGVtYS5cbiAgY29uc3QgeyBkYXRhOiByb3dzIH0gPSBhd2FpdCBhZG1pbi5mcm9tKCd0'
'ZWxhb19ldmVudHMnKVxuICAgIC5zZWxlY3QoJ3ZhbHVlLCB2ZXJ0aWNhbCwgcHJvZHVjdCwgZXZlbnRfbmFtZSwgZXZlbnRfY2F0'
'ZWdvcnksIGNvdXBvbl9jb2RlLCBjbG9zZXJfaWQsIGNsb3Nlcl9odWJzcG90X2lkLCBpc19zZWxmX2NoZWNrb3V0LCBvY2N1cnJl'
'ZF9hdCcpXG4gICAgLmVxKCdldmVudF90eXBlJywgJ3NhbGUnKS5pbGlrZSgnY291cG9uX2NvZGUnLCAnRVZfJScpXG4gICAgLmd0'
'ZSgnb2NjdXJyZWRfYXQnLCBzdGFydCkubHRlKCdvY2N1cnJlZF9hdCcsIGVuZCkubGltaXQoOTk5OTk5KVxuICBjb25zdCBhbGwg'
'PSAocm93cyA/PyBbXSkgYXMgYW55W11cbiIsICIgIC8vIFZlbmRhIGRlIGV2ZW50byA9IGN1cG9tIGNvbWXDp2FuZG8gY29tIEVW'
'XyAgT1UgIGV2ZW50X25hbWUgRSBldmVudF9jYXRlZ29yeVxuICAvLyBwcmVlbmNoaWRvcyAobWVzbW8gY29tIG8gY3Vwb20gdmF6'
'aW8g4oCUIGV4LjogY2hlY2tvdXQgZGUgZXZlbnRvIHNlbSBjdXBvbSkuXG4gIC8vIEEgY29uc3VsdGEgdHJheiBvcyBkb2lzIGdy'
'dXBvczsgbyBmaWx0cm8gYWJhaXhvIGNvbmZpcm1hLCBkZXNjYXJ0YW5kbyB0ZXh0b3NcbiAgLy8gZW0gYnJhbmNvIChzw7MgZXNw'
'YcOnb3MpLCBxdWUgbyBiYW5jbyBjb25zaWRlcmFyaWEgXCJwcmVlbmNoaWRvc1wiLlxuICBjb25zdCB7IGRhdGE6IHJvd3MgfSA9'
'IGF3YWl0IGFkbWluLmZyb20oJ3RlbGFvX2V2ZW50cycpXG4gICAgLnNlbGVjdCgndmFsdWUsIHZlcnRpY2FsLCBwcm9kdWN0LCBl'
'dmVudF9uYW1lLCBldmVudF9jYXRlZ29yeSwgY291cG9uX2NvZGUsIGNsb3Nlcl9pZCwgY2xvc2VyX2h1YnNwb3RfaWQsIGlzX3Nl'
'bGZfY2hlY2tvdXQsIG9jY3VycmVkX2F0JylcbiAgICAuZXEoJ2V2ZW50X3R5cGUnLCAnc2FsZScpXG4gICAgLm9yKCdjb3Vwb25f'
'Y29kZS5pbGlrZS5FVl8qLGFuZChldmVudF9uYW1lLm5vdC5pcy5udWxsLGV2ZW50X2NhdGVnb3J5Lm5vdC5pcy5udWxsKScpXG4g'
'ICAgLmd0ZSgnb2NjdXJyZWRfYXQnLCBzdGFydCkubHRlKCdvY2N1cnJlZF9hdCcsIGVuZCkubGltaXQoOTk5OTk5KVxuICBjb25z'
'dCBhbGwgPSAoKHJvd3MgPz8gW10pIGFzIGFueVtdKS5maWx0ZXIoaXNFdmVudFNhbGUpXG4iXV0='
).decode('utf-8'))
BAK = '.bak-eventos-sem-cupom'
def achar(raiz):
    r = []
    for d, ds, fs in os.walk(raiz):
        ds[:] = [x for x in ds if x not in ('node_modules', '.next', '.git', 'dist', 'build')]
        for f in fs:
            if f.endswith(('.ts', '.tsx')):
                p = os.path.join(d, f)
                try: t = open(p, encoding='utf-8').read()
                except Exception: continue
                if 'export async function computeEventsAnalysis' in t: r.append(p)
    return r
def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]; raiz = os.path.abspath(a[0] if a else '.'); seco = '--dry-run' in sys.argv; desfazer = '--desfazer' in sys.argv
    c = achar(raiz)
    if desfazer:
        c = [p for p in c] or []
        bak = [os.path.join(d, f) for d, ds, fs in os.walk(raiz) if 'node_modules' not in d for f in fs if f.endswith(BAK)]
        if not bak: print('Nenhuma cópia de segurança encontrada.'); return 1
        for b in bak:
            p = b[:-len(BAK)]
            if not seco: shutil.copyfile(b, p); os.remove(b)
            print(('  voltaria ' if seco else '  voltou ') + os.path.relpath(p, raiz))
        return 0
    if len(c) != 1: print('Rode na RAIZ do projeto. Achei %d arquivo(s) com computeEventsAnalysis (devia ser 1).' % len(c)); [print('  - ' + x) for x in c]; return 2
    p = c[0]; rel = os.path.relpath(p, raiz); raw = open(p, 'rb').read(); crlf = b'\r\n' in raw; txt = raw.decode('utf-8').replace('\r\n', '\n')
    if all(nv in txt for _, nv in EDITS): print('Já aplicado. Nada foi alterado.'); return 0
    novo = txt; falta = []
    for i, (o, nv) in enumerate(EDITS):
        if nv in novo: continue
        n = novo.count(o)
        if n != 1: falta.append(f'edição {i + 1}: o trecho esperado aparece {n}x (devia ser 1x): ' + o.strip().split(chr(10))[0][:90]); continue
        novo = novo.replace(o, nv)
    if falta: print('RECUSADO — nada foi alterado (' + rel + '):'); [print('  - ' + f) for f in falta]; print('Me envie a versão atual desse arquivo.'); return 1
    if seco: print('  editaria ' + rel + (' (mantém CRLF)' if crlf else '') + '\nNada foi gravado (--dry-run).'); return 0
    if not os.path.exists(p + BAK): shutil.copyfile(p, p + BAK)
    if crlf: novo = novo.replace('\n', '\r\n')
    open(p, 'wb').write(novo.encode('utf-8')); print('  ok ' + rel); print('Pronto. Na seção Eventos, vendas com event_name + event_category preenchidos passam a contar, mesmo sem cupom. (Voltar atrás: --desfazer)'); return 0
sys.exit(main())
