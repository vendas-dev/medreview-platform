#!/usr/bin/env python3
"""
CAMPANHAS (Administração → Campanhas) — FILTRO DE PERÍODO, no mesmo visual elegante do filtro das Vendas.

  • Menu suspenso "Período" ao lado das abas (Todas / Em andamento / Programadas / Encerradas / Rascunhos), com: Hoje, Ontem, Esta semana, Este mês,
    Mês passado, Últimos 30 dias, Últimos 3 meses, Este ano, TODO O PERÍODO e Intervalo personalizado. PADRÃO: "Este mês".
  • A campanha aparece se ela ACONTECE (ao menos um dia) dentro do período. Aqui "Este mês" é o mês INTEIRO (uma campanha programada para amanhã aparece),
    "Esta semana" vai de segunda a domingo e "Este ano" até 31/12.
  • Os contadores das abas passam a respeitar o período. Quando o período esconde campanhas, uma linha avisa quantas e oferece "ver todo o período".

Arquivos alterados (3):  app/(platform)/admin/campanhas/CampanhasClient.tsx · components/vendas/PeriodoFilter.tsx (aceita lista própria de presets; sem ela, igual a antes)
                         · lib/vendas/periodo.ts (só o tipo ganha a chave 'ano'). As telas de Vendas NÃO mudam.
REQUISITO: o módulo de Vendas (pacote v5) já instalado — é dele que vêm o PeriodoFilter e os estilos .vd-*.

Uso (na RAIZ do projeto, onde ficam app/ e lib/):
    python aplicar-campanhas-periodo.py .               aplica
    python aplicar-campanhas-periodo.py . --dry-run     só mostra o que faria, sem gravar nada
    python aplicar-campanhas-periodo.py . --desfazer    volta ao que era
Tudo-ou-nada por arquivo: se UM trecho não for achado exatamente uma vez, o arquivo NÃO é tocado e o motivo aparece. Rodar de novo não duplica. Preserva CRLF/LF e BOM.
"""
import os, sys

EDITS = {
  'app/(platform)/admin/campanhas/CampanhasClient.tsx': [
    ('imports: filtro de período (o mesmo das Vendas), estilos e utilitários de data',
     "import { Btn, CampaignStyles, IconBtn } from '@/components/campaigns/ui'",
     "import { Btn, CampaignStyles, IconBtn } from '@/components/campaigns/ui'\nimport { PeriodoFilter } from '@/components/vendas/PeriodoFilter'\nimport { VendasStyle } from '@/components/vendas/ui'\nimport { periodoRotulo, type Periodo } from '@/lib/vendas/periodo'\nimport { addDaysToDateStr, todayInSaoPaulo, weekdayInSaoPaulo } from '@/lib/timezone'"),
    ('períodos das campanhas (mês INTEIRO, semana de segunda a domingo, ano inteiro)',
     "const MEDALS = ['🥇', '🥈', '🥉']",
     'const MEDALS = [\'🥇\', \'🥈\', \'🥉\']\n\n// ── Filtro de período das campanhas ───────────────────────────────────────────────────────────────────────────────────────\n// A campanha aparece se ela ACONTECE (ao menos um dia) dentro do período. Aqui "Este mês" é o mês INTEIRO (uma campanha programada para amanhã aparece),\n// "Esta semana" vai de segunda a domingo e "Este ano" até 31/12 — diferente das Vendas, onde o período termina hoje.\nconst lastDayOf = (firstOfMonth: string) => { const [y, m] = firstOfMonth.split(\'-\').map(Number); return addDaysToDateStr(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, \'0\')}-01`, -1) }\nfunction campanhaPresets(): Periodo[] {\n  const t = todayInSaoPaulo(), dow = (weekdayInSaoPaulo(new Date()) + 6) % 7, mon = addDaysToDateStr(t, -dow), first = t.slice(0, 8) + \'01\', prevLast = addDaysToDateStr(first, -1)\n  return [\n    { key: \'hoje\', label: \'Hoje\', start: t, end: t },\n    { key: \'ontem\', label: \'Ontem\', start: addDaysToDateStr(t, -1), end: addDaysToDateStr(t, -1) },\n    { key: \'semana\', label: \'Esta semana\', start: mon, end: addDaysToDateStr(mon, 6) },\n    { key: \'mes\', label: \'Este mês\', start: first, end: lastDayOf(first) },\n    { key: \'mes-passado\', label: \'Mês passado\', start: prevLast.slice(0, 8) + \'01\', end: prevLast },\n    { key: \'30d\', label: \'Últimos 30 dias\', start: addDaysToDateStr(t, -29), end: t },\n    { key: \'3m\', label: \'Últimos 3 meses\', start: addDaysToDateStr(t, -89), end: t },\n    { key: \'ano\', label: \'Este ano\', start: `${t.slice(0, 4)}-01-01`, end: `${t.slice(0, 4)}-12-31` },\n  ]\n}\nconst campanhaPadrao = (): Periodo => campanhaPresets().find(p => p.key === \'mes\')!'),
    ('estado do período (padrão: Este mês)',
     "  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all')",
     "  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all')\n  const [periodo, setPeriodo] = useState<Periodo | null>(() => campanhaPadrao())"),
    ('lista filtrada por período (as abas e os contadores passam a respeitá-lo)',
     'const shown = useMemo(() => list.filter(c =>',
     'const inPeriod = useMemo(() => (periodo ? list.filter(c => c.starts_on <= periodo.end && c.ends_on >= periodo.start) : list), [list, periodo])\n  const shown = useMemo(() => inPeriod.filter(c =>'),
    ('aba/estado: depende do período',
     'c.phase === filter), [list, filter])',
     'c.phase === filter), [inPeriod, filter])'),
    ('contadores das abas: dentro do período',
     'const count = (f: string) => list.filter(c =>',
     'const count = (f: string) => inPeriod.filter(c =>'),
    ('estilos do filtro (classes .vd-*, sem regra global)',
     '      <CampaignStyles />',
     '      <CampaignStyles /><VendasStyle />'),
    ('abas + filtro de período na mesma linha (abre)',
     '      <div className="cp-tabs" role="group" aria-label="Filtrar campanhas" style={{ marginBottom: 24 }}>',
     '      <div data-campaign-filters style={{ display: \'flex\', alignItems: \'center\', justifyContent: \'space-between\', gap: 16, flexWrap: \'wrap\', marginBottom: periodo && list.length > inPeriod.length ? 12 : 24 }}>\n      <div className="cp-tabs" role="group" aria-label="Filtrar campanhas">'),
    ('abas + filtro de período na mesma linha (fecha) e aviso de campanhas fora do período',
     '<b>{count(id)}</b></button>)}\n      </div>',
     '<b>{count(id)}</b></button>)}\n      </div>\n      <PeriodoFilter value={periodo} onChange={setPeriodo} allowAll presets={campanhaPresets()} padrao={campanhaPadrao()} />\n      </div>\n      {periodo && list.length > inPeriod.length && (\n        <p data-period-hint style={{ margin: \'0 0 24px\', fontSize: 12.5, color: \'var(--muted-foreground)\' }}>\n          {list.length - inPeriod.length} {list.length - inPeriod.length === 1 ? \'campanha fora\' : \'campanhas fora\'} de {periodoRotulo(periodo)} ·{\' \'}\n          <button type="button" data-period-all onClick={() => setPeriodo(null)} style={{ border: \'none\', background: \'none\', padding: 0, color: \'var(--primary)\', fontWeight: 700, fontSize: 12.5, cursor: \'pointer\', textDecoration: \'underline\' }}>ver todo o período</button>\n        </p>\n      )}'),
    ('tela vazia: diz quando é o período que esvaziou a lista',
     "'Nenhuma campanha ainda' : 'Nada neste filtro'}",
     "'Nenhuma campanha ainda' : inPeriod.length === 0 ? 'Nenhuma campanha neste período' : 'Nada neste filtro'}"),
    ('tela vazia: dica',
     "'Troque o filtro acima.'}",
     "'Troque o filtro ou o período acima.'}")
  ],
  'components/vendas/PeriodoFilter.tsx': [
    ('PeriodoFilter: aceita uma lista própria de presets (opcional; sem ela, igual a antes)',
     'export function PeriodoFilter({ value, onChange, allowAll = false, padrao }: { value: Periodo | null; onChange: (p: Periodo | null) => void; allowAll?: boolean; padrao: Periodo | null }) {',
     'export function PeriodoFilter({ value, onChange, allowAll = false, padrao, presets: presetsProp }: { value: Periodo | null; onChange: (p: Periodo | null) => void; allowAll?: boolean; padrao: Periodo | null; presets?: Periodo[] }) {'),
    ('PeriodoFilter: usa os presets recebidos, ou os de sempre',
     'const presets = periodoPresets(); const escolher',
     'const presets = presetsProp ?? periodoPresets(); const escolher')
  ],
  'lib/vendas/periodo.ts': [
    ("tipo do período: aceita a chave 'ano' (Este ano)",
     "export type PeriodoKey = 'hoje' | 'ontem' | 'semana' | 'mes' | '7d' | '30d' | '3m' | 'mes-passado' | 'custom'",
     "export type PeriodoKey = 'hoje' | 'ontem' | 'semana' | 'mes' | '7d' | '30d' | '3m' | 'mes-passado' | 'ano' | 'custom'")
  ],
}

def processa(raiz, rel, edits, modo):
    caminho = os.path.join(raiz, *rel.split('/'))
    if not os.path.isfile(caminho): return 'erro', [f'  ✗ arquivo não encontrado: {rel}']
    bruto = open(caminho, 'rb').read(); bom = bruto.startswith(b'\xef\xbb\xbf'); crlf = b'\r\n' in bruto
    texto = bruto.decode('utf-8-sig').replace('\r\n', '\n'); rel_out, erros, novo = [], False, texto
    for desc, antes, depois in edits:
        aplicado = depois in novo
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
        tmp = caminho + '.camp.tmp'; open(tmp, 'wb').write(dados); os.replace(tmp, caminho)
    return 'ok', rel_out

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else '.'
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'lib')):
        print('Rode na RAIZ do projeto (onde ficam as pastas app/ e lib/), ex.: python aplicar-campanhas-periodo.py .'); return 2
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Campanhas: filtro de período\n')
    falhas = 0
    for rel, edits in EDITS.items():
        st, linhas = processa(raiz, rel, edits, modo)
        print(('✔ ' if st == 'ok' else '✘ ') + rel); print('\n'.join(linhas)); falhas += st != 'ok'
    print(f'\n{"Tudo certo." if not falhas else str(falhas) + " arquivo(s) com problema."}')
    return 1 if falhas else 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
