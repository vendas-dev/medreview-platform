#!/usr/bin/env python3
"""
Telão — aumenta a LEGENDA do gráfico do mês (Total no mês / Média por dia / Melhor dia) SEM diminuir as barras.

  uso (na raiz do projeto):   python aumentar-legenda.py .

Mexe SÓ em app/(platform)/telao/DailyRevenueChart.tsx, e só na legenda: letras maiores e o "884 vendas" ao LADO do valor (mesma linha), em vez de embaixo.
Assim a legenda cresce na LARGURA (que sobra), não na altura — a altura do cabeçalho não muda e as barras ficam exatamente do mesmo tamanho.
Em tela estreita (pouco espaço) a legenda continua como está hoje. Exige que o pacote "telao-ritmo-grafico" já esteja aplicado.
TUDO-OU-NADA: se algo não bater, NÃO grava e diz o quê. Pode rodar de novo ("já aplicado"). Mantém CRLF.
"""
import re, sys, os
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
ROOT = sys.argv[1] if len(sys.argv) == 2 else None
if not ROOT: print(__doc__); sys.exit(2)
P = os.path.join(ROOT, 'app', '(platform)', 'telao', 'DailyRevenueChart.tsx')
if not os.path.exists(P): print(f'NADA foi alterado: arquivo não encontrado: {P} (rode na raiz do projeto)'); sys.exit(1)
raw = open(P, 'rb').read().decode('utf-8'); s = raw.replace('\r\n', '\n'); crlf = '\r\n' in raw
if 'data-stat-big' in s: print('Já aplicado (a legenda já está maior). Nada foi alterado.'); sys.exit(0)
def falha(m): print('NADA foi alterado.\n  - ' + m); sys.exit(1)
a = s.find('function Stat(')
if a < 0: falha('não achei o componente da legenda (function Stat). Me mande o arquivo.')
b = s.find('\n}\n', a)
bloco = s[a:b + 3]
if 'dense = false' not in bloco: falha('o componente da legenda não tem o modo "dense" — falta aplicar antes o pacote telao-ritmo-grafico (gráfico maior). Me mande o arquivo se já aplicou.')
NOVO = '''function Stat({ k, label, sub, color, children, text, muted2, dense = false, big = false }: { k: string; label: string; sub: string; color?: string; children: React.ReactNode; text: string; muted2: string; dense?: boolean; big?: boolean }) {
  // big (só no "ajustar à tela" e com largura de sobra): legenda MAIOR sem ficar mais ALTA — o "884 vendas" vai AO LADO do valor, na mesma linha.
  // A altura do cabeçalho não muda, então as barras do gráfico seguem exatamente do mesmo tamanho.
  if (big) return (
    <div data-stat={k} data-stat-big style={{ minWidth: 0 }}>
      <p style={{ margin: '0 0 1px', fontSize: 10, lineHeight: '12px', fontWeight: 900, color: muted2, textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: MONO, whiteSpace: 'nowrap' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, whiteSpace: 'nowrap' }}>
        <p style={{ margin: 0, fontSize: 21, lineHeight: '26px', fontWeight: 900, color: color ?? text, fontFamily: GROTESK, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{children}</p>
        <p style={{ margin: 0, fontSize: 11, lineHeight: '14px', color: muted2, fontFamily: MONO, whiteSpace: 'nowrap' }}>{sub}</p>
      </div>
    </div>
  )
''' + bloco[bloco.index('  return (\n'):]
s = s[:a] + NOVO + s[b + 3:]
n = s.count('<Stat dense={fill} k="')
if n != 3: falha(f'usos da legenda: encontrei {n}, esperava 3')
s = s.replace('<Stat dense={fill} k="', '<Stat dense={fill} big={fill && W >= 1180} k="')
old = "<div style={{ display: 'flex', gap: fill ? 16 : 22, flexWrap: 'wrap' }}>"
if s.count(old) != 1: falha(f'espaço entre as legendas: encontrei {s.count(old)}, esperava 1')
s = s.replace(old, "<div style={{ display: 'flex', gap: fill ? (W >= 1180 ? 28 : 16) : 22, flexWrap: 'wrap' }}>")
if s.count('const [W, setW]') != 1: falha('não achei a largura medida do gráfico (W)')
open(P, 'wb').write((s.replace('\n', '\r\n') if crlf else s).encode('utf-8'))
print('OK: legenda do gráfico maior.\n  ✓ app/(platform)/telao/DailyRevenueChart.tsx')
