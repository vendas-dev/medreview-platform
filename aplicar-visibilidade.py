#!/usr/bin/env python3
"""
Acrescenta a VISIBILIDADE das copys (o "olhinho" do superadmin) na seção Templates, SEM substituir os seus arquivos.

  uso (na raiz do projeto):   python3 aplicar-visibilidade.py .

Altera 3 arquivos, com correções ancoradas pela ESTRUTURA do código (não por linhas exatas), e CRIA a rota nova app/api/templates/visibility/route.ts:
  app/(platform)/templates/TemplatesView.tsx   olhinho no card e na linha, esmaecer o oculto + selo "OCULTO", filtro Todos/Visíveis/Ocultos (só superadmin), erro com aviso, coach do Medy sem os ocultos
  app/(platform)/templates/page.tsx            quem não é superadmin não recebe os ocultos
  app/api/templates/route.ts                   idem no GET /api/templates
Tudo-ou-nada: confere os 3 ANTES; se algum trecho não for encontrado, NÃO grava nada e diz qual. Pode rodar de novo (avisa "já aplicado"). Mantém CRLF.
Depois: rode a migração SQL no Supabase (migration-template-visibility.sql), faça commit/push na master e espere o deploy. O olhinho só aparece para SUPERADMIN.
"""
import os, re, sys

MARK = '[visibilidade-v1]'
ROUTE_REL = 'app/api/templates/visibility/route.ts'
ROUTE_TS = r'''import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuper } from '@/lib/campaigns/auth'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/templates/visibility   { ids: string[], hidden: boolean }
// Só superadmin. Oculta (hidden: true) ou mostra de novo (hidden: false) uma ou várias copys pro time. Só mexe em templates ATIVOS (não excluídos).
// Idempotente: ocultar o que já está oculto não faz nada e não muda a data de quando foi ocultado.
export async function PATCH(req: NextRequest) {
  const a = await requireSuper(); if (!a.ok) return a.res
  let body: any; try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const ids: unknown = body?.ids, hidden: unknown = body?.hidden
  if (typeof hidden !== 'boolean') return NextResponse.json({ error: 'hidden deve ser verdadeiro ou falso' }, { status: 400 })
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some(i => typeof i !== 'string' || !UUID.test(i)))
    return NextResponse.json({ error: 'ids deve ser uma lista de 1 a 200 ids de template' }, { status: 400 })
  const unique = [...new Set(ids as string[])]

  const admin = createAdminClient()
  const patch = hidden ? { is_hidden: true, hidden_at: new Date().toISOString(), hidden_by: a.userId } : { is_hidden: false, hidden_at: null, hidden_by: null }
  // só altera quem realmente muda de estado (assim a data de "ocultado em" não é reescrita por um clique repetido)
  const { data, error } = await admin.from('templates').update(patch).in('id', unique).eq('is_active', true).eq('is_hidden', !hidden).select('id')
  if (error) {
    const faltaColuna = /is_hidden|hidden_at|hidden_by|42703/.test(`${error.code ?? ''} ${error.message ?? ''}`)
    console.error('[templates/visibility]', error.message)
    return NextResponse.json({ error: faltaColuna ? 'Falta rodar a migração migration-template-visibility.sql no Supabase.' : 'Não consegui alterar a visibilidade agora.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, hidden, requested: unique.length, updated: (data ?? []).length })
}
'''


class Falha(Exception):
    pass


def uma(pat, s, flags=0, nome=''):
    ms = list(re.finditer(pat, s, flags))
    if len(ms) != 1:
        raise Falha(f'{nome or pat[:50]}: encontrei {len(ms)} ocorrência(s), esperava 1')
    return ms[0]


# ───────────────────────────── TemplatesView.tsx ─────────────────────────────
BLOCO = r'''// ── Visibilidade das copys (olhinho do superadmin) ── [visibilidade-v1]
// Oculto = some pro time; o superadmin continua vendo (esmaecido, com selo) e pode mostrar de novo. Excluir continua sendo outra coisa.
const HiddenCtx = createContext<(id: string, hidden: boolean) => Promise<void>>(async () => {})
function VisibilityButton({ t, size = 12 }: { t: any; size?: number }) {
  const setHidden = useContext(HiddenCtx)
  const [busy, setBusy] = useState(false)
  const hidden = !!t.is_hidden
  return (
    <>
      {hidden && <span data-tpl="hidden-badge" title="Oculta para o time" style={{ alignSelf: 'center', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 5, background: 'rgba(245,158,11,0.16)', color: '#b45309', whiteSpace: 'nowrap' }}>OCULTO</span>}
      <button type="button" data-tpl="eye" aria-pressed={hidden} aria-label={hidden ? 'Mostrar esta copy para o time' : 'Ocultar esta copy do time'} title={hidden ? 'Oculta para o time — clique para mostrar' : 'Visível para o time — clique para ocultar'} disabled={busy}
        onClick={async e => { e.stopPropagation(); setBusy(true); try { await setHidden(t.id, !hidden) } finally { setBusy(false) } }}
        style={{ width: size >= 13 ? 30 : 24, height: size >= 13 ? 30 : 24, borderRadius: size >= 13 ? 8 : 7, border: 'none', background: 'transparent', cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hidden ? '#f59e0b' : 'var(--muted-foreground)', opacity: busy ? 0.5 : 1, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.color = hidden ? '#d97706' : 'var(--foreground)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = hidden ? '#f59e0b' : 'var(--muted-foreground)' }}>
        {hidden ? <EyeOff size={size} /> : <Eye size={size} />}
      </button>
    </>
  )
}
function VisibilityFilter({ value, onChange, counts }: { value: 'todos' | 'visiveis' | 'ocultos'; onChange: (v: 'todos' | 'visiveis' | 'ocultos') => void; counts: { todos: number; visiveis: number; ocultos: number } }) {
  const opts: { v: 'todos' | 'visiveis' | 'ocultos'; label: string }[] = [{ v: 'todos', label: 'Todos' }, { v: 'visiveis', label: 'Visíveis' }, { v: 'ocultos', label: 'Ocultos' }]
  return (
    <div data-tpl="vis-filter" role="group" aria-label="Filtrar por visibilidade" style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', flexShrink: 0, height: 38 }}>
      {opts.map(o => (
        <button key={o.v} type="button" data-tpl="vis-opt" data-v={o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          style={{ padding: '0 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: value === o.v ? 'var(--secondary)' : 'transparent', color: value === o.v ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
          {o.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>{counts[o.v]}</span>
        </button>
      ))}
    </div>
  )
}

'''
ESTADO = r'''
  // ── Visibilidade (olhinho do superadmin) — otimista; se o servidor recusar, desfaz e avisa. [visibilidade-v1]
  const [filterVis, setFilterVis] = useState<'todos' | 'visiveis' | 'ocultos'>('todos')
  const [visError, setVisError] = useState('')
  async function setHidden(id: string, hidden: boolean) {
    const before = !!templates.find(x => x.id === id)?.is_hidden
    setTemplates(p => p.map(x => (x.id === id ? { ...x, is_hidden: hidden } : x)))
    setVisError('')
    try {
      const res = await fetch('/api/templates/visibility', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id], hidden }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || 'Não consegui alterar a visibilidade agora.') }
    } catch (e: any) {
      setTemplates(p => p.map(x => (x.id === id ? { ...x, is_hidden: before } : x)))
      setVisError(e?.message || 'Não consegui alterar a visibilidade agora.')
      setTimeout(() => setVisError(''), 6000)
    }
  }
  const visCounts = { todos: templates.length, visiveis: templates.filter(t => !t.is_hidden).length, ocultos: templates.filter(t => t.is_hidden).length }
'''
FILTRO = r'''      if (!isAdmin && t.is_hidden) return false                       // defesa: quem não é superadmin nunca vê oculto, mesmo que a lista chegue com algum
      if (isAdmin && filterVis === 'visiveis' && t.is_hidden) return false
      if (isAdmin && filterVis === 'ocultos' && !t.is_hidden) return false
'''
TOAST = r'''      {visError && (
        <div role="alert" data-tpl="vis-error" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 60, background: '#ef4444', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: 'min(520px, 92vw)' }}>{visError}</div>
      )}
'''


def patch_view(s: str) -> str:
    if MARK in s:
        return s
    # react: createContext, useContext
    m = uma(r"^import \{([^}]*)\} from 'react'[ \t]*$", s, re.M, 'import do react')
    nomes = [x.strip() for x in m.group(1).split(',') if x.strip()]
    for n in ('createContext', 'useContext'):
        if n not in nomes:
            nomes.append(n)
    s = s[:m.start()] + "import { " + ', '.join(nomes) + " } from 'react'" + s[m.end():]
    # lucide: Eye, EyeOff
    m = uma(r"import \{([^}]*)\} from 'lucide-react'", s, 0, 'import do lucide-react')
    corpo = m.group(1)
    falta = [n for n in ('Eye', 'EyeOff') if not re.search(r'\b' + n + r'\b', corpo)]
    if falta:
        novo = corpo.rstrip().rstrip(',') + ', ' + ', '.join(falta) + ('\n' if corpo.endswith('\n') else '')
        s = s[:m.start(1)] + novo + s[m.end(1):]
    # bloco antes do TemplateCard
    m = uma(r"^function TemplateCard\(", s, re.M, 'function TemplateCard')
    s = s[:m.start()] + BLOCO + s[m.start():]
    # botão nas ações de admin (card e linha)
    achados = list(re.finditer(r"(\{isAdmin && \(\s*<>\s*)(<button onClick=\{onEdit\})", s))
    if len(achados) != 2:
        raise Falha(f'ações de admin do card/linha: encontrei {len(achados)} bloco(s), esperava 2')
    for m in reversed(achados):
        tam = re.search(r'Pencil size=\{(\d+)\}', s[m.end():m.end() + 900])
        size = tam.group(1) if tam else '12'
        s = s[:m.start(2)] + f'<VisibilityButton t={{t}} size={{{size}}} />\n              ' + s[m.start(2):]
    # esmaecer o oculto (card e linha)
    a = "<div style={{ background: 'var(--card)', border: isFavorite ?"
    if s.count(a) != 1:
        raise Falha(f'raiz do card: encontrei {s.count(a)}, esperava 1')
    s = s.replace(a, "<div data-tpl=\"card\" data-hidden={t.is_hidden ? 'true' : 'false'} style={{ opacity: t.is_hidden ? 0.55 : 1, background: 'var(--card)', border: isFavorite ?")
    b = "<div style={{ borderBottom: '1px solid var(--border)', background: isFavorite ? 'rgba(245,158,11,0.03)' : 'transparent' }}>"
    if s.count(b) != 1:
        raise Falha(f'raiz da linha: encontrei {s.count(b)}, esperava 1')
    s = s.replace(b, "<div data-tpl=\"row\" data-hidden={t.is_hidden ? 'true' : 'false'} style={{ opacity: t.is_hidden ? 0.55 : 1, borderBottom: '1px solid var(--border)', background: isFavorite ? 'rgba(245,158,11,0.03)' : 'transparent' }}>")
    # estado + função no componente principal
    m = uma(r"^[ \t]*const \[showFavoritesOnly, setShowFavoritesOnly\] = useState\(false\)[ \t]*\n", s, re.M, 'estado showFavoritesOnly')
    s = s[:m.end()] + ESTADO + s[m.end():]
    # filtro
    m = uma(r"^([ \t]*)if \(showFavoritesOnly && !favIds\.has\(t\.id\)\) return false", s, re.M, 'filtro de favoritos')
    s = s[:m.start()] + FILTRO + s[m.start():]
    m = uma(r"\}, \[templates, search,", s, 0, 'dependências do useMemo da lista')
    s = s[:m.start()] + "}, [templates, filterVis, isAdmin, search," + s[m.end():]
    # coach do Medy sem os ocultos
    c = "<MedyTemplateCoach templates={templates} />"
    if s.count(c) != 1:
        raise Falha(f'uso do MedyTemplateCoach: encontrei {s.count(c)}, esperava 1')
    s = s.replace(c, "<MedyTemplateCoach templates={templates.filter(t => !t.is_hidden)} />")
    # provider no return principal + aviso de erro no fim
    ini = uma(r"^export function TemplatesView\(", s, re.M, 'export function TemplatesView').start()
    r = re.compile(r"\n  return \(\n    <div").search(s, ini)
    if not r:
        raise Falha("início do return do TemplatesView ('  return (' + '<div')")
    s = s[:r.start()] + "\n  return (\n    <HiddenCtx.Provider value={setHidden}>\n    <div" + s[r.end():]
    fim = re.search(r"\n    </div>\n  \)\n\}\s*$", s)
    if not fim:
        raise Falha("fim do TemplatesView ('</div>' + ')' + '}' no fim do arquivo)")
    s = s[:fim.start()] + "\n" + TOAST.rstrip('\n') + "\n    </div>\n    </HiddenCtx.Provider>\n  )\n}\n"
    # filtro Todos/Visíveis/Ocultos (só superadmin) antes do alternador grade/lista
    m = re.search(r"(\n[ \t]*)(<div style=\{\{[^\n]*\}\}>\n[ \t]*<button onClick=\{\(\) => setViewMode\('grid'\)\})", s)
    if not m:
        raise Falha("alternador grade/lista (onde o filtro de visibilidade entra)")
    s = s[:m.start(2)] + "{isAdmin && (visCounts.ocultos > 0 || filterVis !== 'todos') && <VisibilityFilter value={filterVis} onChange={setFilterVis} counts={visCounts} />}\n        " + s[m.start(2):]
    return s


# ───────────────────────────── page.tsx ─────────────────────────────
def patch_page(s: str) -> str:
    if MARK in s:
        return s
    m = uma(r"const \[\{ data: templates \}, ", s, 0, 'desestruturação do Promise.all (data: templates)')
    s = s[:m.start()] + "const [{ data: templatesRaw }, " + s[m.end():]
    f = re.compile(r"\n  \]\)\n").search(s, m.start())
    if not f:
        raise Falha("fim do Promise.all da página")
    s = s[:f.end()] + "\n  // Copys OCULTAS pelo superadmin: só ele as recebe. Feito em JS (e não no SQL) de propósito: se a coluna is_hidden ainda não existir, tudo continua visível e a página não quebra. [visibilidade-v1]\n  const templates = (templatesRaw ?? []).filter((t: any) => isAdmin || !t.is_hidden)\n" + s[f.end():]
    return s


# ───────────────────────────── api/templates/route.ts ─────────────────────────────
def patch_route(s: str) -> str:
    if MARK in s:
        return s
    a = "return NextResponse.json({ templates: data })"
    if s.count(a) != 1:
        raise Falha(f"GET /api/templates (return da lista): encontrei {s.count(a)}, esperava 1")
    return s.replace(a, "return NextResponse.json({ templates: (data ?? []).filter((t: any) => isAdmin || !t.is_hidden) })   // oculto só pro superadmin [visibilidade-v1]")


ARQUIVOS = [
    ('app/(platform)/templates/TemplatesView.tsx', patch_view),
    ('app/(platform)/templates/page.tsx', patch_page),
    ('app/api/templates/route.ts', patch_route),
]


def main(raiz: str) -> int:
    novos, falhas, ja = {}, [], 0
    for rel, fn in ARQUIVOS:
        p = os.path.join(raiz, rel)
        if not os.path.exists(p):
            falhas.append(f'  - {rel}: arquivo não encontrado (rode na raiz do projeto)')
            continue
        raw = open(p, 'rb').read()
        crlf = b'\r\n' in raw
        s = raw.decode('utf-8').replace('\r\n', '\n')
        if MARK in s:
            ja += 1
            continue
        try:
            n = fn(s)
        except Falha as e:
            falhas.append(f'  - {rel}: {e}')
            continue
        novos[p] = (n.replace('\n', '\r\n') if crlf else n).encode('utf-8')
    # rota nova (visibilidade): cria se não existir; se já existir IGUAL, ok; se existir DIFERENTE, recusa (não destrói o seu arquivo)
    rp = os.path.join(raiz, *ROUTE_REL.split('/')); rota_nova = None
    crlf_proj = any(b'\r\n' in open(os.path.join(raiz, rel), 'rb').read() for rel, _ in ARQUIVOS if os.path.exists(os.path.join(raiz, rel)))
    if os.path.exists(rp):
        if open(rp, 'rb').read().decode('utf-8').replace('\r\n', '\n') != ROUTE_TS: falhas.append(f'  - {ROUTE_REL}: já existe um arquivo DIFERENTE do esperado (renomeie ou apague e rode de novo)')
    else:
        rota_nova = (ROUTE_TS.replace('\n', '\r\n') if crlf_proj else ROUTE_TS).encode('utf-8')
    if falhas:
        print('NADA foi alterado. Estes pontos não bateram com o esperado:')
        print('\n'.join(falhas))
        print('Me mande os arquivos atuais que eu ajusto o script.')
        return 1
    if not novos and rota_nova is None:
        print('Já aplicado (os 3 arquivos e a rota já têm a visibilidade). Nada foi alterado.')
        return 0
    for p, b in novos.items():
        open(p, 'wb').write(b)
    if rota_nova is not None:
        os.makedirs(os.path.dirname(rp), exist_ok=True); open(rp, 'wb').write(rota_nova)
    print(f'OK: visibilidade aplicada ({len(novos)} arquivo(s) alterado(s), {ja} já estavam' + ('; rota nova criada' if rota_nova is not None else '') + '):')
    for p in novos:
        print('  ✓ ' + os.path.relpath(p, raiz))
    if rota_nova is not None: print('  ✓ ' + ROUTE_REL + ' (nova)')
    print('PRÓXIMOS PASSOS: 1) rode migration-template-visibility.sql no Supabase  2) commit + push na master  3) abra Templates como SUPERADMIN: cada copy tem um olhinho.')
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
