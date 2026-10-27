#!/usr/bin/env python3
"""
Telão/Análises — passa a TOLERAR vendas de uma vertical "aposentada" (Vasc-Review) sem criar painel, aba nem cartão.

  uso (na raiz do projeto):   python tolerar-vasc.py .

Por quê: vai entrar no banco a vertical 'vascreview' (só como histórico). Hoje o código só conhece 4 verticais e uma venda de outra quebra telas:
  • lib/telao/analytics.ts   byVertical[s.vertical].revenue  → TypeError (derruba o Telão Completo em qualquer período que inclua uma venda de Vasc)
  • VERTICALS[ev.vertical].accent no feed/ticker do Telão → idem
O que muda (2 arquivos, mexe só nisso):
  lib/telao/types.ts      VERTICALS devolve um visual neutro e discreto SÓ para 'vascreview' (as 4 verticais ativas ficam idênticas; VERTICAL_LIST, Object.keys/values continuam com 4 → NENHUM painel novo)
  lib/telao/analytics.ts  a venda de Vasc CONTA no total, mas não ganha linha própria "por vertical" (2 trechos protegidos)
TUDO-OU-NADA, pode rodar de novo ("já aplicado"), mantém CRLF. Publique (push + deploy) ANTES de inserir a Vasc no banco.
"""
import re, sys, os
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
ROOT = sys.argv[1] if len(sys.argv) == 2 else None
if not ROOT: print(__doc__); sys.exit(2)
def load(rel):
    p = os.path.join(ROOT, *rel.split('/'))
    if not os.path.exists(p): print(f'NADA foi alterado: arquivo não encontrado: {rel} (rode na raiz do projeto)'); sys.exit(1)
    raw = open(p, 'rb').read().decode('utf-8'); return p, raw.replace('\r\n', '\n'), '\r\n' in raw
def falha(m): print('NADA foi alterado.\n  - ' + m + '\n  Me mande o arquivo atual que eu ajusto o script.'); sys.exit(1)
pt, st, ct = load('lib/telao/types.ts'); pa, sa, ca = load('lib/telao/analytics.ts')
ja_t, ja_a = 'VERTICAL_APOSENTADA' in st, 'vertical aposentada' in sa
if ja_t and ja_a: print('Já aplicado. Nada foi alterado.'); sys.exit(0)
if ja_t != ja_a: falha('só um dos dois arquivos já tem a alteração (estado misto).')
# ── types.ts
A = "export const VERTICALS: Record<VerticalId, VerticalConfig> = {"
B = "export const VERTICAL_LIST = Object.values(VERTICALS)"
if st.count(A) != 1 or st.count(B) != 1: falha(f'types.ts: esperava 1 definição de VERTICALS e 1 de VERTICAL_LIST, achei {st.count(A)} e {st.count(B)}')
PROXY = '''// Verticais APOSENTADAS (ex.: vascreview): existem no banco só como histórico de vendas. NÃO ganham painel, aba nem cartão: VERTICAL_LIST e Object.keys/values só enxergam as 4 ativas.
// Mas se uma venda dessas aparecer num período (feed, ticker, análises), VERTICALS[ev.vertical] devolve um visual neutro em vez de undefined (que derrubaria a tela).
const VERTICAL_APOSENTADA: VerticalConfig = { id: 'vascreview' as VerticalId, label: 'Vasc-Review', short: 'VASC', accent: '#94a3b8', glow: 'rgba(148,163,184,0.4)', mascot: '' }
export const VERTICALS: Record<VerticalId, VerticalConfig> = new Proxy(VERTICAIS_ATIVAS, {
  get: (t, k) => (k === 'vascreview' ? VERTICAL_APOSENTADA : (t as any)[k]),
})

'''
st = st.replace(A, "const VERTICAIS_ATIVAS: Record<VerticalId, VerticalConfig> = {").replace(B, PROXY + B)
# ── analytics.ts
X1 = "byVertical[s.vertical].revenue += s.value; byVertical[s.vertical].count++"
X2 = "b.byVertical[s.vertical] += s.value;"
if sa.count(X1) != 1 or sa.count(X2) != 1: falha(f'analytics.ts: esperava 1 agregação por vertical em summarize e 1 em bucketize, achei {sa.count(X1)} e {sa.count(X2)}')
sa = sa.replace(X1, "const bv = byVertical[s.vertical]; if (bv) { bv.revenue += s.value; bv.count++ }      // vertical aposentada (ex.: vascreview) conta no total, mas não ganha linha própria")
sa = sa.replace(X2, "if (s.vertical in b.byVertical) b.byVertical[s.vertical] += s.value;       // idem (vertical aposentada não vira NaN)")
open(pt, 'wb').write((st.replace('\n', '\r\n') if ct else st).encode('utf-8')); open(pa, 'wb').write((sa.replace('\n', '\r\n') if ca else sa).encode('utf-8'))
print('OK: o sistema agora tolera a Vasc-Review sem criar painel.\n  ✓ lib/telao/types.ts\n  ✓ lib/telao/analytics.ts')
