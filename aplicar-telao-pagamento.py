#!/usr/bin/env python3
"""
TELÃO COMPLETO — forma de pagamento e filtro de TRIMESTRE.

  1) Pix e boleto PARCELADOS deixam de contar como "à vista": à vista = pagamento integral, de uma vez; parcelado = 2x ou
     mais em QUALQUER forma (Pix parcelado, boleto parcelado, cartão em Nx...). O nº de parcelas vem de payment_installments
     (ou, se vazio, de total_installments, que as parcelas de recorrência trazem).
  2) Acabou o "Outros / Demais formas": a rosca tem uma fatia por forma e modalidade (Pix à vista, Pix parcelado, Boleto à
     vista, Boleto parcelado, Cartão à vista, Cartão parcelado, NuPay, Apple Pay...) e a lista mostra TODAS as formas
     (Cartão em 3x, Cartão em 12x, Pix parcelado em 6x...). O "BILLET" da Hotmart passa a ser reconhecido como boleto.
  3) TRIMESTRE = mês atual + os 2 anteriores (antes era o trimestre do calendário até hoje: no começo de jan/abr/jul/out
     eram só alguns dias). O comparativo ("trimestre anterior, mesmos dias") acompanha.

Uso (na RAIZ do projeto, onde ficam app/ e lib/):
    python aplicar-telao-pagamento.py .               aplica
    python aplicar-telao-pagamento.py . --dry-run     só mostra o que faria, sem gravar nada
    python aplicar-telao-pagamento.py . --desfazer    volta tudo ao que era antes

Cada arquivo é tudo-ou-nada: se UM trecho não for achado exatamente uma vez, o arquivo NÃO é tocado e o motivo aparece.
Rodar de novo não duplica nada. Quebras de linha (LF/CRLF) e BOM são preservados.
"""
import os, sys

A = 'lib/telao/analytics.ts'
T = 'app/(platform)/telao-completo/TelaoCompleto.tsx'

# Trechos originais (exatos) que o script substitui — embutidos aqui para o script não depender de nenhum outro arquivo.
SEG_FORM = '''export interface PayForm { kind: 'avista' | 'parcelado'; label: string; n: number }
/**
 * Pix = à vista. Cartão/boleto: 1x = à vista, 2x ou mais = parcelado. Sem forma de pagamento (ou cartão sem nº de
 * parcelas) → null: a venda não entra nesta conta (a tela mostra a % informada), nada é presumido.
 */
export function payForm(s: { pay: PayKind | null; installments: number | null }): PayForm | null {
  if (!s.pay) return null
  if (s.pay === 'pix') return { kind: 'avista', label: 'Pix', n: 1 }
  const n = s.installments
  if (n === null || n === undefined || !(n >= 1)) return null
  const base = s.pay === 'cartao' ? 'Cartão' : s.pay === 'boleto' ? 'Boleto' : 'Outros'
  return n <= 1 ? { kind: 'avista', label: s.pay === 'cartao' ? 'Cartão à vista' : s.pay === 'boleto' ? 'Boleto' : 'Outros à vista', n: 1 }
                : { kind: 'parcelado', label: `${base} em ${n}x`, n }
}'''
SEG_STRUCT = '''export interface PayStructure {
  avista: { revenue: number; count: number }; parcelado: { revenue: number; count: number; avgInstallments: number | null }
  forms: { label: string; kind: 'avista' | 'parcelado'; revenue: number; count: number }[]; coveragePct: number; known: number
  total: number                                   // receita de TODAS as vendas do período (a base de todas as %)
  unknown: { revenue: number; count: number }     // vendas sem forma de pagamento (ou cartão sem nº de parcelas)
}
export function payStructure(sales: Sale[]): PayStructure {
  const av = { revenue: 0, count: 0 }, pa = { revenue: 0, count: 0 }
  const forms = new Map<string, { label: string; kind: 'avista' | 'parcelado'; revenue: number; count: number }>()
  let known = 0, instSum = 0, unknownCount = 0
  for (const s of sales) {
    const f = payForm(s); if (!f) { unknownCount++; continue }
    known += s.value
    const bucket = f.kind === 'avista' ? av : pa; bucket.revenue += s.value; bucket.count++
    if (f.kind === 'parcelado') instSum += f.n
    const x = forms.get(f.label) ?? { label: f.label, kind: f.kind, revenue: 0, count: 0 }; x.revenue += s.value; x.count++; forms.set(f.label, x)
  }
  const total = sales.reduce((a, s) => a + s.value, 0)
  return { avista: av, parcelado: { ...pa, avgInstallments: pa.count ? instSum / pa.count : null },
    forms: [...forms.values()].sort((a, b) => b.revenue - a.revenue), coveragePct: total > 0 ? (known / total) * 100 : 0, known,
    total, unknown: { revenue: total - known, count: unknownCount } }
}'''
SEG_ROWS = '''export interface PayRow { id: string; label: string; revenue: number; count: number; kind: 'avista' | 'parcelado' | 'outras' | 'sem-info' }
/**
 * A lista "formas mais usadas" que FECHA o total: as N maiores + "Demais formas" (tudo que ficou de fora) +
 * "Sem forma informada". A soma das linhas é sempre a receita do período (nada some em silêncio).
 */
export function payBreakdown(ps: PayStructure, topN = 5): { rows: PayRow[]; total: number; hiddenForms: number } {
  const top = ps.forms.slice(0, topN), rest = ps.forms.slice(topN)
  const rows: PayRow[] = top.map(f => ({ id: f.label, label: f.label, revenue: f.revenue, count: f.count, kind: f.kind }))
  if (rest.length) rows.push({ id: 'outras', label: `Demais formas (${rest.length})`, revenue: rest.reduce((a, f) => a + f.revenue, 0), count: rest.reduce((a, f) => a + f.count, 0), kind: 'outras' })
  if (ps.unknown.revenue > 0.005 || ps.unknown.count > 0) rows.push({ id: 'sem-info', label: 'Sem forma informada', revenue: ps.unknown.revenue, count: ps.unknown.count, kind: 'sem-info' })
  return { rows, total: ps.total, hiddenForms: rest.length }
}'''

EDITS = {
  A: [
    ("boleto: reconhece BILLET (nome que a Hotmart usa)",
     "if (u.includes('BOLETO') || u.includes('SLIP')) return 'boleto'",
     "if (u.includes('BOLETO') || u.includes('SLIP') || u.includes('BILLET')) return 'boleto'"),
    ("nova função payMethod: nome da forma de pagamento (Pix, Boleto, Cartão, NuPay, Apple Pay...)",
     "export function payKind(t?: string | null): PayKind | null {",
     '''/** Nome da forma de pagamento para exibir. Nada vira "Outros": uma forma que não conhecemos aparece com o nome que veio. */
export function payMethod(t?: string | null): string | null {
  if (!t || !t.trim()) return null
  const u = t.toUpperCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  const k = payKind(t)
  if (k === 'cartao') return 'Cartão'
  if (k === 'pix') return 'Pix'
  if (k === 'boleto') return 'Boleto'
  if (u.includes('NUPAY')) return 'NuPay'
  if (u.includes('APPLE')) return 'Apple Pay'
  if (u.includes('GOOGLE')) return 'Google Pay'
  if (u.includes('PAYPAL')) return 'PayPal'
  if (u.includes('HYBRID') || u.includes('HIBRID')) return 'Pagamento híbrido'
  if (u.includes('HOTMART') || u.includes('SALDO') || u.includes('BALANCE') || u.includes('WALLET')) return 'Saldo Hotmart'
  if (u.includes('CASH') || u.includes('DINHEIRO')) return 'Dinheiro'
  return t.trim().replace(/[_-]+/g, ' ').toLowerCase().replace(/(^|\\s)\\S/g, c => c.toUpperCase())
}
export function payKind(t?: string | null): PayKind | null {'''),
    ("RawSale: total_installments",
     "payment_type?: string | null; payment_installments?: number | null",
     "payment_type?: string | null; payment_installments?: number | null; total_installments?: number | null"),
    ("Sale: totalInstallments e method",
     "installments: number | null; eventName: string | null",
     "installments: number | null; totalInstallments?: number | null; method?: string | null; eventName: string | null"),
    ("toSale: preenche totalInstallments e method",
     "installments: r.payment_installments ?? null, eventName: r.event_name?.trim() || null,",
     "installments: r.payment_installments ?? null, totalInstallments: r.total_installments ?? null, method: payMethod(r.payment_type), eventName: r.event_name?.trim() || null,"),
    ("trimestre = mês atual + 2 anteriores (antes: trimestre do calendário até hoje)",
     "case 'trimestre': return { start: quarterStartOf(today), end: today }",
     "case 'trimestre': return { start: `${addMonths(monthOf(today), -2)}-01`, end: today }      // 3 meses: o atual + os 2 anteriores"),
    ("comparativo do trimestre: os 3 meses anteriores (mesmos dias)",
     "const ps = quarterStartOf(addDays(r.start, -1))",
     "const ps = `${addMonths(monthOf(r.start), -3)}-01`"),
    ("remove o helper quarterStartOf (não é mais usado)",
     "const quarterStartOf = (day: string): string => { const [y, m] = day.split('-').map(Number); return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01` }",
     "// (trimestre = mês atual + 2 anteriores: ver resolvePreset / previousRange)"),
    ("payForm: Pix e boleto PARCELADOS deixam de ser à vista; rótulos por forma",
     SEG_FORM,
     '''export interface PayForm { kind: 'avista' | 'parcelado'; label: string; n: number; method: string }
/**
 * À vista = pagamento integral, de uma vez. Parcelado = 2x ou mais em QUALQUER forma (Pix parcelado, boleto parcelado,
 * cartão em Nx...): o dinheiro entra mês a mês. O nº de parcelas é o da compra (payment_installments); se vier vazio,
 * o total da recorrência (total_installments). Pix sem nº de parcelas = à vista. Cartão, boleto e demais formas sem nº de
 * parcelas → null: a venda não entra nesta conta (a tela mostra a % informada), nada é presumido.
 */
export function payForm(s: { pay: PayKind | null; installments: number | null; method?: string | null; totalInstallments?: number | null }): PayForm | null {
  if (!s.pay) return null
  const method = s.method ?? PAY_LABEL[s.pay]
  const n = s.installments != null && s.installments >= 1 ? s.installments
    : s.totalInstallments != null && s.totalInstallments >= 1 ? s.totalInstallments : null
  if (n === null) return s.pay === 'pix' ? { kind: 'avista', label: `${method} à vista`, n: 1, method } : null
  if (n <= 1) return { kind: 'avista', label: `${method} à vista`, n: 1, method }
  return { kind: 'parcelado', label: s.pay === 'cartao' ? `${method} em ${n}x` : `${method} parcelado em ${n}x`, n, method }
}'''),
    ("payStructure: forms com method e groups (uma fatia por forma e modalidade)",
     SEG_STRUCT,
     '''export interface PayGroup { id: string; label: string; method: string; kind: 'avista' | 'parcelado'; revenue: number; count: number }
export interface PayStructure {
  avista: { revenue: number; count: number }; parcelado: { revenue: number; count: number; avgInstallments: number | null }
  forms: { label: string; kind: 'avista' | 'parcelado'; method: string; revenue: number; count: number }[]
  groups: PayGroup[]                              // uma fatia por forma e modalidade (Pix à vista, Pix parcelado, Boleto à vista...): alimenta a rosca
  coveragePct: number; known: number
  total: number                                   // receita de TODAS as vendas do período (a base de todas as %)
  unknown: { revenue: number; count: number }     // vendas sem forma de pagamento (ou cartão/boleto sem nº de parcelas)
}
export function payStructure(sales: Sale[]): PayStructure {
  const av = { revenue: 0, count: 0 }, pa = { revenue: 0, count: 0 }
  const forms = new Map<string, { label: string; kind: 'avista' | 'parcelado'; method: string; revenue: number; count: number }>()
  const groups = new Map<string, PayGroup>()
  let known = 0, instSum = 0, unknownCount = 0
  for (const s of sales) {
    const f = payForm(s); if (!f) { unknownCount++; continue }
    known += s.value
    const bucket = f.kind === 'avista' ? av : pa; bucket.revenue += s.value; bucket.count++
    if (f.kind === 'parcelado') instSum += f.n
    const x = forms.get(f.label) ?? { label: f.label, kind: f.kind, method: f.method, revenue: 0, count: 0 }; x.revenue += s.value; x.count++; forms.set(f.label, x)
    const gid = `${f.method}|${f.kind}`
    const g = groups.get(gid) ?? { id: gid, label: `${f.method} ${f.kind === 'avista' ? 'à vista' : 'parcelado'}`, method: f.method, kind: f.kind, revenue: 0, count: 0 }; g.revenue += s.value; g.count++; groups.set(gid, g)
  }
  const total = sales.reduce((a, s) => a + s.value, 0)
  return { avista: av, parcelado: { ...pa, avgInstallments: pa.count ? instSum / pa.count : null },
    forms: [...forms.values()].sort((a, b) => b.revenue - a.revenue), groups: [...groups.values()].sort((a, b) => b.revenue - a.revenue),
    coveragePct: total > 0 ? (known / total) * 100 : 0, known,
    total, unknown: { revenue: total - known, count: unknownCount } }
}'''),
    ("payBreakdown: cada linha leva a forma (method)",
     SEG_ROWS,
     SEG_ROWS
       .replace("export interface PayRow { id: string; label: string; revenue: number; count: number; kind: 'avista' | 'parcelado' | 'outras' | 'sem-info' }",
                "export interface PayRow { id: string; label: string; revenue: number; count: number; kind: 'avista' | 'parcelado' | 'outras' | 'sem-info'; method?: string }")
       .replace("const rows: PayRow[] = top.map(f => ({ id: f.label, label: f.label, revenue: f.revenue, count: f.count, kind: f.kind }))",
                "const rows: PayRow[] = top.map(f => ({ id: f.label, label: f.label, revenue: f.revenue, count: f.count, kind: f.kind, method: f.method }))")),
  ],
  T: [
    ("busca total_installments no banco (parcelas de recorrência)",
     "payment_type,payment_installments,event_name'",
     "payment_type,payment_installments,total_installments,event_name'"),
    ("cores por forma e modalidade (à vista = tom cheio; parcelado = tom claro da mesma cor)",
     "const PAY_ROW_COLOR: Record<A.PayRow['kind'], string> = { avista: '#22c55e', parcelado: '#8b5cf6', outras: '#94a3b8', 'sem-info': '#64748b' }",
     '''const PAY_ROW_COLOR: Record<A.PayRow['kind'], string> = { avista: '#22c55e', parcelado: '#8b5cf6', outras: '#94a3b8', 'sem-info': '#64748b' }
// Cor por forma + modalidade: à vista = tom cheio, parcelado = tom claro da MESMA cor (Pix verde, Boleto âmbar, Cartão roxo; as demais formas ganham cor própria)
const METHOD_TONES: Record<string, [string, string]> = { Pix: ['#22c55e', '#86efac'], Boleto: ['#f59e0b', '#fcd34d'], 'Cartão': ['#8b5cf6', '#c4b5fd'] }
const EXTRA_METHODS = ['NuPay', 'Apple Pay', 'Google Pay', 'PayPal', 'Pagamento híbrido', 'Saldo Hotmart', 'Dinheiro']
const EXTRA_TONES: [string, string][] = [['#06b6d4', '#67e8f9'], ['#ec4899', '#f9a8d4'], ['#14b8a6', '#5eead4'], ['#f97316', '#fdba74'], ['#3b82f6', '#93c5fd'], ['#a3e635', '#d9f99d'], ['#e879f9', '#f0abfc']]
const payColor = (method: string, kind: 'avista' | 'parcelado'): string => {
  const i = EXTRA_METHODS.indexOf(method)
  const tone = METHOD_TONES[method] ?? EXTRA_TONES[(i >= 0 ? i : [...method].reduce((a, c) => a + c.charCodeAt(0), 0)) % EXTRA_TONES.length]
  return kind === 'avista' ? tone[0] : tone[1]
}'''),
    ("lista: mostra TODAS as formas (sem o \"Demais formas\")",
     "const bd = useMemo(() => A.payBreakdown(ps, 5), [ps])",
     "const bd = useMemo(() => A.payBreakdown(ps, 99), [ps])"),
    ("cartão \"À vista\": nota correta (pagamento integral)",
     "note: 'Pix, boleto e cartão em 1x' }",
     "note: 'pagamento integral, de uma vez (Pix, boleto ou cartão em 1x)' }"),
    ("cartão \"Parcelado\": nota inclui o Pix",
     ": 'cartão/boleto em 2x ou mais' }",
     ": 'Pix, boleto ou cartão em 2x ou mais' }"),
    ("rosca: uma fatia por forma e modalidade (acaba o \"Outros\")",
     "...pay.items.map(i => ({ id: i.kind, label: A.PAY_LABEL[i.kind], color: PAY_COLORS[i.kind], value: i.revenue }))",
     "...ps.groups.map(g => ({ id: g.id, label: g.label, color: payColor(g.method, g.kind), value: g.revenue }))"),
    ("barras da lista: mesma cor da rosca",
     "color: PAY_ROW_COLOR[r.kind] }))} />",
     "color: r.method && (r.kind === 'avista' || r.kind === 'parcelado') ? payColor(r.method, r.kind) : PAY_ROW_COLOR[r.kind] }))} />"),
  ],
}

def processa(raiz, rel, edits, modo):
    caminho = os.path.join(raiz, *rel.split('/'))
    if not os.path.isfile(caminho): return 'erro', [f'  ✗ arquivo não encontrado: {rel}']
    bruto = open(caminho, 'rb').read(); bom = bruto.startswith(b'\xef\xbb\xbf'); crlf = b'\r\n' in bruto
    texto = bruto.decode('utf-8-sig').replace('\r\n', '\n'); rel_out, erros, novo = [], False, texto
    for desc, antes, depois in edits:
        aplicado = depois in novo                      # o texto NOVO existe no arquivo ⇒ já está aplicado
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
        tmp = caminho + '.telao.tmp'; open(tmp, 'wb').write(dados); os.replace(tmp, caminho)
    return 'ok', rel_out

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else '.'
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'lib')):
        print('Rode na RAIZ do projeto (onde ficam as pastas app/ e lib/), ex.: python aplicar-telao-pagamento.py .'); return 2
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Telão Completo: forma de pagamento e trimestre\n')
    falhas = 0
    for rel, edits in EDITS.items():
        st, linhas = processa(raiz, rel, edits, modo)
        print(('✔ ' if st == 'ok' else '✘ ') + rel); print('\n'.join(linhas)); falhas += st != 'ok'
    print(f'\n{"Tudo certo." if not falhas else str(falhas) + " arquivo(s) com problema (os demais foram processados)."}')
    return 1 if falhas else 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
