#!/usr/bin/env python3
"""
TROCAS DE VENDA — cada solicitação MINIMIZADA por padrão (clique para expandir) + filtro de ORDEM por data da solicitação.

  uso (na RAIZ do projeto):   python aplicar-trocas-minimizar.py .
                              python aplicar-trocas-minimizar.py . --dry-run     (só mostra o que faria)
                              python aplicar-trocas-minimizar.py . --desfazer    (volta ao que era)

O que muda (3 arquivos, nenhum novo):
  components/vendas/TrocaCard.tsx
      • cada solicitação nasce MINIMIZADA: aparece o cabeçalho (quem pediu, data, situação) e uma linha com VERTICAL, PRODUTO e HP (ID da transação);
      • botão com seta (e clique no cabeçalho ou na linha-resumo) para expandir/minimizar; expandida mostra tudo o que já existia (links, motivo, resposta, Conceder/Negar, Consultar HP, Transferir Venda);
      • o que você digitou numa resposta NÃO se perde ao minimizar e expandir de novo.
  app/(platform)/admin/vendas/trocas/TrocasAdminClient.tsx   e   app/(platform)/vendas/trocas/TrocasCloserClient.tsx
      • filtro "Ordenar por data" (Mais recentes — o padrão, igual ao que já era — ou Mais antigas), na linha de CIMA, ao lado das abas de status (a linha de baixo — Período, Vertical, Time, Closer — continua igual); o "Limpar filtros" também volta a ordem ao padrão.
Funciona COM ou SEM o "Consultar HP / Transferir Venda" já aplicado. Não mexe em banco, rota nem dependência.
SEGURANÇA: guarda uma cópia exata (<arquivo>.bak-minimizar); tudo-ou-nada (se um trecho não for reconhecido, NADA é gravado e o script diz qual); rodar de novo não duplica; preserva CRLF/LF e BOM.
"""
import os, sys

BAK = '.bak-minimizar'
TC = 'components/vendas/TrocaCard.tsx'
ADM = 'app/(platform)/admin/vendas/trocas/TrocasAdminClient.tsx'
CLO = 'app/(platform)/vendas/trocas/TrocasCloserClient.tsx'

HELPER = """
/** Ordena as solicitações pela DATA em que foram enviadas: "recentes" (mais nova primeiro) ou "antigas" (mais velha primeiro). Empate: pelo id, para a ordem ser estável. */
const porData = (ordem: string) => (a: TrocaRow, b: TrocaRow) => { const d = Date.parse(a.created_at) - Date.parse(b.created_at); return (ordem === 'antigas' ? d : -d) || a.id.localeCompare(b.id) }
"""
SELECT = """        <Select name="ordem" caption="Ordenar por data" icon={<ArrowDownUp size={18} />} value={ordem} onChange={setOrdem} defaultValue="recentes" minWidth={200} options={[{ value: 'recentes', label: 'Mais recentes' }, { value: 'antigas', label: 'Mais antigas' }]} />
"""
TOGGLE = """        <button type="button" data-v="troca-toggle" aria-expanded={aberto} aria-controls={`troca-corpo-${t.id}`} aria-label={aberto ? 'Minimizar a solicitação' : 'Expandir a solicitação'} title={aberto ? 'Minimizar' : 'Expandir'} onClick={() => setAberto(a => !a)} className="vd-btn" style={{ width: 42, height: 42, borderRadius: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--foreground)', cursor: 'pointer', flexShrink: 0 }}><ChevronDown size={20} style={{ transition: 'transform .22s', transform: aberto ? 'rotate(180deg)' : 'none' }} /></button>
      </div>
      {!aberto && (
        <div data-v="troca-resumo" role="button" tabIndex={0} aria-expanded={false} onClick={() => setAberto(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(true) } }} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px 22px', marginTop: 18, padding: '14px 18px', borderRadius: 16, background: 'var(--secondary)', cursor: 'pointer' }}>
          <span data-v="troca-resumo-vertical"><VerticalChip v={t.vertical} /></span>
          <span data-v="troca-resumo-produto" title={t.product} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}><Package size={15} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product}</span></span>
          <span data-v="troca-resumo-hp" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}><Hash size={14} />HP<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 14, fontWeight: 800, letterSpacing: 0, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>{t.transaction_id}</code></span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div key="corpo" id={`troca-corpo-${t.id}`} data-v="troca-corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden', margin: '0 -6px -6px', padding: '0 6px 6px' }}>
      <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />
"""
FIM = "          </motion.div>\n        )}\n      </AnimatePresence>\n      {/* fim troca-corpo */}\n"
A_EDITAR = "        {podeEditar && <Btn data-v=\"troca-editar\" size=\"sm\" icon={<Pencil size={14} />} onClick={() => onEdit!(t)} title=\"Editar a solicitação\">Editar</Btn>}\n      </div>\n      <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />\n"
A_CAB = "      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>\n        <Avatar name={t.requester_name}"
N_CAB = "      <div data-v=\"troca-cabecalho\" onClick={e => { if (!(e.target as HTMLElement).closest('button, a, input, textarea, select')) setAberto(a => !a) }} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', cursor: 'pointer' }}>\n        <Avatar name={t.requester_name}"

# (marcador de "já aplicado", trecho esperado, trecho novo, descrição)
EDITS = {
  TC: [
    ('ChevronDown }', "ThumbsUp, User, XCircle } from 'lucide-react'", "ThumbsUp, User, XCircle, ChevronDown } from 'lucide-react'", 'ícone da seta'),
    ('const [aberto, setAberto]', "  const corModo = modo ? COR_STATUS[modo] : cor\n", "  const [aberto, setAberto] = useState(false)      // minimizada por padrão: o gestor expande só a que quer ler\n  const corModo = modo ? COR_STATUS[modo] : cor\n", 'estado minimizada/expandida (começa minimizada)'),
    ('data-v="troca-cabecalho"', A_CAB, N_CAB, 'clique no cabeçalho expande/minimiza (botões e links dentro dele continuam funcionando)'),
    ('data-v="troca-toggle"', A_EDITAR, A_EDITAR.split('      </div>\n')[0] + TOGGLE, 'botão de seta + linha-resumo (Vertical · Produto · HP) quando minimizada + início do corpo expansível'),
  ],
  ADM: [
    ('ArrowDownUp', "import { BarChart3, Inbox, Repeat2, Users, UsersRound } from 'lucide-react'", "import { ArrowDownUp, BarChart3, Inbox, Repeat2, Users, UsersRound } from 'lucide-react'", 'ícone do filtro de ordem'),
    ('const porData', "import type { CloserResumo, Decisao, TrocaRow } from '@/lib/vendas/types'\n", "import type { CloserResumo, Decisao, TrocaRow } from '@/lib/vendas/types'\n" + HELPER, 'função que ordena por data da solicitação'),
    ('setOrdem] = useState', "const [closerId, setCloserId] = useState('todos')\n  const [fixas, setFixas]", "const [closerId, setCloserId] = useState('todos'); const [ordem, setOrdem] = useState('recentes')\n  const [fixas, setFixas]", 'estado da ordem (padrão: mais recentes primeiro, como já era)'),
    ("|| ordem !== 'recentes'", "|| closerId !== 'todos'\n  const limpar", "|| closerId !== 'todos' || ordem !== 'recentes'\n  const limpar", 'ordem diferente do padrão conta como filtro ativo'),
    ("setOrdem('recentes') }", "setCloserId('todos') }\n  useEffect(() => { api<{ closers", "setCloserId('todos'); setOrdem('recentes') }\n  useEffect(() => { api<{ closers", '"Limpar" volta a ordem ao padrão'),
    ('topo={<>', "topo={\n        <Segmented name=\"status\"", "topo={<>\n        <Segmented name=\"status\"", 'abre o grupo da linha de cima (status + ordem)'),
    ('name="ordem"', "\n      }>\n        <PeriodoFilter value={periodo}", "\n" + SELECT + "      </>}>\n        <PeriodoFilter value={periodo}", 'filtro "Ordenar por data" na linha de cima, ao lado do status'),
    ('.sort(porData(ordem))', "{lista.map(t => <TrocaCard key={t.id} t={t} admin", "{[...lista].sort(porData(ordem)).map(t => <TrocaCard key={t.id} t={t} admin", 'a lista aparece na ordem escolhida'),
  ],
  CLO: [
    ('ArrowDownUp', "import { BarChart3, CheckCircle2, Clock, Inbox, Plus, Repeat2, XCircle } from 'lucide-react'", "import { ArrowDownUp, BarChart3, CheckCircle2, Clock, Inbox, Plus, Repeat2, XCircle } from 'lucide-react'", 'ícone do filtro de ordem'),
    ('const porData', "import type { TrocaRow } from '@/lib/vendas/types'\n", "import type { TrocaRow } from '@/lib/vendas/types'\n" + HELPER, 'função que ordena por data da solicitação'),
    ('setOrdem] = useState', "const [status, setStatus] = useState('todas')\n", "const [status, setStatus] = useState('todas'); const [ordem, setOrdem] = useState('recentes')\n", 'estado da ordem (padrão: mais recentes primeiro, como já era)'),
    ("|| ordem !== 'recentes'", "|| status !== 'todas'\n  const limpar", "|| status !== 'todas' || ordem !== 'recentes'\n  const limpar", 'ordem diferente do padrão conta como filtro ativo'),
    ("setOrdem('recentes') }", "setStatus('todas') }\n  const carregar", "setStatus('todas'); setOrdem('recentes') }\n  const carregar", '"Limpar" volta a ordem ao padrão'),
    ('topo={<>', "topo={\n        <Segmented name=\"status\"", "topo={<>\n        <Segmented name=\"status\"", 'abre o grupo da linha de cima (status + ordem)'),
    ('name="ordem"', "\n      }>\n        <PeriodoFilter value={periodo}", "\n" + SELECT + "      </>}>\n        <PeriodoFilter value={periodo}", 'filtro "Ordenar por data" na linha de cima, ao lado do status'),
    ('.sort(porData(ordem))', "{lista.map(t => <TrocaCard key={t.id} t={t} onEdit={setEditando} />)}", "{[...lista].sort(porData(ordem)).map(t => <TrocaCard key={t.id} t={t} onEdit={setEditando} />)}", 'a lista aparece na ordem escolhida'),
  ],
}

def le(p):
    raw = open(p, 'rb').read(); bom = raw.startswith(b'\xef\xbb\xbf'); t = (raw[3:] if bom else raw).decode('utf-8')
    return t.replace('\r\n', '\n'), ('\r\n' in t), bom
def grava(p, t, crlf, bom):
    b = (t.replace('\n', '\r\n') if crlf else t).encode('utf-8'); open(p, 'wb').write((b'\xef\xbb\xbf' + b) if bom else b)

def aplica(rel, texto):
    novo, msgs, ok = texto, [], True
    for marcador, antes, depois, desc in EDITS[rel]:
        if marcador in novo: msgs.append(f'  · já estava assim: {desc}'); continue
        n = novo.count(antes)
        if n != 1: ok = False; msgs.append(f'  ✗ {desc}: o trecho esperado apareceu {n} vez(es) (precisa ser exatamente 1) — NADA foi gravado'); continue
        novo = novo.replace(antes, depois); msgs.append(f'  ✓ alterado: {desc}')
    if rel == TC and '{/* fim troca-corpo */}' not in novo and ok:
        hp, fim = "      {admin && hpAberto && <ConsultarHpModal", "    </motion.article>\n  )\n}"
        alvo = hp if novo.count(hp) == 1 else (fim if novo.count(fim) == 1 else None)
        if alvo is None: ok = False; msgs.append('  ✗ fim do cartão: não achei onde fechar o corpo expansível — NADA foi gravado')
        else: novo = novo.replace(alvo, FIM + alvo); msgs.append('  ✓ alterado: fim do corpo expansível (os popups do Consultar HP/Transferir ficam de fora dele)')
    return novo, msgs, ok

def main(argv):
    args = [a for a in argv if not a.startswith('--')]; raiz = args[0] if args else None
    modo = 'desfazer' if '--desfazer' in argv else 'dry' if '--dry-run' in argv else 'aplicar'
    if not raiz or not os.path.isdir(os.path.join(raiz, 'app')) or not os.path.isdir(os.path.join(raiz, 'components')):
        print(__doc__); return 2
    P = lambda rel: os.path.join(raiz, *rel.split('/'))
    print({'aplicar': 'APLICANDO', 'dry': 'SIMULAÇÃO (nada será gravado)', 'desfazer': 'DESFAZENDO'}[modo], '— Trocas de venda: minimizar/expandir + ordem por data\n')
    if modo == 'desfazer':
        feitos = 0
        for rel in EDITS:
            p = P(rel)
            if os.path.isfile(p + BAK): os.replace(p + BAK, p); feitos += 1; print(f'✔ {rel}\n  ✓ restaurado da cópia de segurança')
            else: print(f'✔ {rel}\n  · sem cópia de segurança: nada a desfazer')
        print('\nTudo certo.' if feitos else '\nNada a desfazer.'); return 0
    plano, falhas = [], 0
    for rel in EDITS:
        p = P(rel)
        if not os.path.isfile(p): print(f'✘ {rel}\n  ✗ arquivo não encontrado (rode na raiz do projeto)'); falhas += 1; continue
        texto, crlf, bom = le(p); novo, msgs, ok = aplica(rel, texto)
        print(('✔ ' if ok else '✘ ') + rel); print('\n'.join(msgs))
        if not ok: falhas += 1
        elif novo != texto: plano.append((p, novo, crlf, bom))
    if falhas: print(f'\nNADA foi gravado ({falhas} arquivo(s) com trecho não reconhecido). Me mande o arquivo atual que eu ajusto o script.'); return 1
    if modo == 'dry': print('\n(simulação) nada foi gravado.'); return 0
    if not plano: print('\nJá aplicado. Nada foi alterado.'); return 0
    for p, novo, crlf, bom in plano:
        if not os.path.exists(p + BAK): open(p + BAK, 'wb').write(open(p, 'rb').read())
        grava(p, novo, crlf, bom)
    print('\nOK: solicitações minimizadas por padrão e filtro de ordem instalados.\nPróximo passo: commit + push + deploy e abra "Trocas de Venda" (as solicitações aparecem minimizadas; clique para expandir).'); return 0

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
    sys.exit(main(sys.argv[1:]))
