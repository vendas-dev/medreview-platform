// Resolve o nome de template que chega nas requisições de Disparos.
// A integração manda o NOME DO TEMPLATE NO HUBSPOT (é o que fica salvo em disparos.template). Agora também aceitamos o NOME INTERNO
// NA BOTMAKER (templates.internal_platform_id), tanto no próprio campo "template" quanto num campo próprio.
// Regras (puras, sem banco — testadas em tests/unit/disparos_template.test.ts):
//  1) o nome do HubSpot sempre ganha: se "template" bate com o hubspot_name de algum template, é ele e fica como veio;
//  2) se não bate, tenta como nome interno da Botmaker. Só resolve se UM único template ativo o tem (nome repetido = ambíguo, não chuta);
//  3) quando resolve pela Botmaker, o que se grava/usa é o nome do HubSpot do template (se não tiver, o nome da cópia);
//  4) não achou em lugar nenhum: segue com o texto como veio (nada é perdido nem barrado).

export type TplRef = { name: string | null; hubspot_name: string | null; internal_platform_id: string | null }
export type Resolvido = {
  /** nome a gravar em disparos.template (HubSpot quando resolve; senão, o texto como veio) */
  template: string | null
  /** nomes possíveis desse template em disparos.template (para localizar disparos já gravados) */
  candidatos: string[]
  /** como foi resolvido */
  via: 'hubspot' | 'botmaker' | 'nenhum'
}

/** minúsculas, sem acento, espaços/hífens/pontos viram um só "_": 'Multi Sales-Disp' = 'multi_sales_disp'. */
export function chave(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
const txt = (v: unknown): string | null => { const s = String(v ?? '').trim(); return s ? s : null }

export function resolverTemplate(templates: TplRef[], template: unknown, botmaker?: unknown): Resolvido {
  const t = txt(template), b = txt(botmaker)
  const porHub = (k: string) => templates.filter(x => chave(x.hubspot_name) === k)
  const porBot = (k: string) => templates.filter(x => chave(x.internal_platform_id) === k)
  const cands = (x: TplRef) => [...new Set([x.hubspot_name, x.name].map(txt).filter((v): v is string => !!v))]

  // 1) nome do HubSpot (mantém exatamente como veio)
  if (t && porHub(chave(t)).length >= 1) {
    const achados = porHub(chave(t))
    return { template: t, candidatos: [...new Set([t, ...achados.flatMap(cands)])], via: 'hubspot' }
  }
  // 2) nome interno da Botmaker: no campo "template" ou no campo próprio
  for (const nome of [b, t]) {
    if (!nome) continue
    const achados = porBot(chave(nome))
    if (achados.length === 1) {
      const x = achados[0], oficial = txt(x.hubspot_name) ?? txt(x.name) ?? nome
      return { template: oficial, candidatos: [...new Set([oficial, ...cands(x)])], via: 'botmaker' }
    }
  }
  // 3) sem de-para: segue com o que veio (prefere o HubSpot; sem ele, o que houver)
  const solto = t ?? b
  return { template: solto, candidatos: solto ? [solto] : [], via: 'nenhum' }
}

/** Lê os campos de nome interno da Botmaker de uma linha já normalizada (chaves em minúsculas_com_underscore). */
export function botmakerDe(r: Record<string, unknown>): string | null {
  for (const k of ['nome_interno_botmaker', 'botmaker_name', 'nome_botmaker', 'botmaker', 'nome_interno', 'internal_platform_id', 'id_interno', 'template_internal_id', 'botmaker_template', 'template_botmaker']) {
    const v = txt(r[k]); if (v) return v
  }
  return null
}

/** Templates ativos (só os campos de nome), lendo em páginas porque o Supabase corta em 1.000 linhas. */
export async function carregarTemplates(admin: any): Promise<TplRef[]> {
  const out: TplRef[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin.from('templates').select('name, hubspot_name, internal_platform_id').eq('is_active', true).order('id').range(from, from + 999)
    if (error || !data) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

/** Busca da biblioteca de templates: acha pelo nome, conteúdo, nome no HubSpot e nome interno da Botmaker (sem diferenciar maiúsculas/acentos;
 *  "multi sales" acha "multi_sales_disp"). */
export function buscaTemplate(t: { name?: string | null; content?: string | null; hubspot_name?: string | null; internal_platform_id?: string | null }, termo: string): boolean {
  const q = String(termo ?? '').trim()
  if (!q) return true
  const simples = (x: unknown) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const qs = simples(q), qk = chave(q)
  return [t.name, t.content, t.hubspot_name, t.internal_platform_id].some(c => simples(c).includes(qs)) ||
    (qk !== '' && [t.name, t.hubspot_name, t.internal_platform_id].some(c => chave(c).includes(qk)))
}
