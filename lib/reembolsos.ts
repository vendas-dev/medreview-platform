// ══ REEMBOLSOS ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// Marca (ou desfaz) o reembolso de vendas pelo transaction_id (o "HP" da Hotmart). Quem faz a venda SAIR dos números é o GATILHO do banco
// (sql/02_reembolso_campos_e_gatilho.sql): ao colocar is_refunded = true a linha deixa de ser event_type 'sale', e o sistema inteiro só conta 'sale'.
// Esta função só marca o flag e CONFERE que o gatilho agiu (se a migração não foi aplicada, desfaz o que fez e avisa — nunca deixa a venda "meio reembolsada").
export interface ReembolsoItem { transaction_id: string; motivo?: string }
export type ReembolsoStatus = 'reembolsado' | 'ja_reembolsado' | 'nao_encontrado' | 'nao_e_venda' | 'desfeito' | 'nao_estava_reembolsado' | 'erro'
export interface ReembolsoResultado { transaction_id: string; status: ReembolsoStatus; linhas: number; valor: number; mensagem?: string }
export const MAX_REEMBOLSOS_POR_CHAMADA = 500

const CAMPOS_HP = ['transaction_id', 'transactionId', 'transaction', 'hp', 'HP']
const HP_VALIDO = /^[A-Za-z0-9_\-.]{3,64}$/
function pegaHp(o: any): string | null {
  if (typeof o === 'string' || typeof o === 'number') return String(o)
  if (!o || typeof o !== 'object') return null
  for (const k of CAMPOS_HP) if (typeof o[k] === 'string' || typeof o[k] === 'number') return String(o[k])
  const hot = o?.data?.purchase?.transaction ?? o?.purchase?.transaction                      // o aviso de reembolso da própria Hotmart (PURCHASE_REFUNDED)
  return typeof hot === 'string' ? hot : null
}
/** Aceita: { transaction_id } · { transaction_id, motivo } · { transaction_ids: [...] } · [ {transaction_id}, "HP..." ] · o JSON do aviso da Hotmart. Para DESFAZER: { desfazer: true } (ou o método DELETE). */
export function parseReembolsoBody(body: any): { items: ReembolsoItem[]; rejected: string[]; desfazer: boolean } {
  const obj = body && typeof body === 'object' && !Array.isArray(body)
  const desfazer = !!obj && (body.desfazer === true || body.undo === true || body.action === 'desfazer' || body.action === 'undo' || body.refunded === false)
  const motivoGeral = obj && typeof (body.motivo ?? body.reason) === 'string' ? String(body.motivo ?? body.reason) : undefined
  const lista: any[] = Array.isArray(body) ? body : obj && Array.isArray(body.transaction_ids) ? body.transaction_ids : obj && Array.isArray(body.items) ? body.items : [body]
  const items: ReembolsoItem[] = [], rejected: string[] = [], vistos = new Set<string>()
  for (const x of lista) {
    const bruto = pegaHp(x)?.trim()
    if (!bruto) { rejected.push('sem transaction_id'); continue }
    if (!HP_VALIDO.test(bruto)) { rejected.push(`transaction_id inválido: ${bruto.slice(0, 40)}`); continue }
    if (vistos.has(bruto.toUpperCase())) continue
    vistos.add(bruto.toUpperCase())
    const m = x && typeof x === 'object' && typeof (x.motivo ?? x.reason) === 'string' ? String(x.motivo ?? x.reason) : motivoGeral
    items.push({ transaction_id: bruto, motivo: m ? m.slice(0, 500) : undefined })
  }
  return { items, rejected, desfazer }
}

const escapaLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)
const COLS = 'id, event_type, is_refunded, value, transaction_id'
type Linha = { id: string; event_type: string; is_refunded: boolean | null; value: number | string | null; transaction_id: string }
const soma = (ls: Linha[]) => Math.round(ls.reduce((s, l) => s + (Number(l.value) || 0), 0) * 100) / 100

async function achar(admin: any, hp: string): Promise<{ linhas: Linha[]; erro?: string }> {
  let r = await admin.from('telao_events').select(COLS).eq('transaction_id', hp).limit(50)
  if (r.error) return { linhas: [], erro: r.error.message }
  if (!r.data?.length) { r = await admin.from('telao_events').select(COLS).ilike('transaction_id', escapaLike(hp)).limit(50); if (r.error) return { linhas: [], erro: r.error.message } }   // diferença de maiúsculas/minúsculas
  return { linhas: (r.data ?? []) as Linha[] }
}

export async function aplicarReembolsos(admin: any, items: ReembolsoItem[], desfazer = false): Promise<ReembolsoResultado[]> {
  const out: ReembolsoResultado[] = []
  for (const it of items) {
    const base = { transaction_id: it.transaction_id }
    const { linhas, erro } = await achar(admin, it.transaction_id)
    if (erro) { out.push({ ...base, status: 'erro', linhas: 0, valor: 0, mensagem: /is_refunded|refunded|column/i.test(erro) ? 'Os campos de reembolso não existem no banco: rode primeiro os arquivos SQL 01 e 02.' : `Erro ao consultar: ${erro}` }); continue }
    if (!linhas.length) { out.push({ ...base, status: 'nao_encontrado', linhas: 0, valor: 0 }); continue }
    if (!desfazer) {
      const alvo = linhas.filter(l => l.event_type === 'sale' && !l.is_refunded), jaFeitas = linhas.filter(l => l.is_refunded)
      if (!alvo.length) { out.push({ ...base, status: jaFeitas.length ? 'ja_reembolsado' : 'nao_e_venda', linhas: jaFeitas.length || linhas.length, valor: soma(jaFeitas.length ? jaFeitas : linhas) }); continue }
      const ids = alvo.map(l => l.id)
      const up = await admin.from('telao_events').update({ is_refunded: true, refunded_at: new Date().toISOString(), refund_reason: it.motivo ?? null }).in('id', ids)
      if (up.error) { out.push({ ...base, status: 'erro', linhas: 0, valor: 0, mensagem: /is_refunded|refunded|column/i.test(up.error.message) ? 'Os campos de reembolso não existem no banco: rode primeiro os arquivos SQL 01 e 02.' : `Erro ao gravar: ${up.error.message}` }); continue }
      const conf = await admin.from('telao_events').select(COLS).in('id', ids)                      // CONFERE que o gatilho tirou a linha de 'sale'
      const ainda = ((conf.data ?? []) as Linha[]).filter(l => l.event_type === 'sale')
      if (conf.error || ainda.length) {
        await admin.from('telao_events').update({ is_refunded: false, refunded_at: null, refund_reason: null }).in('id', ids)       // desfaz: nunca deixa "meio reembolsada"
        out.push({ ...base, status: 'erro', linhas: 0, valor: 0, mensagem: 'O gatilho do banco não está ativo (a venda continuaria contando). Nada foi alterado. Rode o arquivo SQL 02.' }); continue
      }
      out.push({ ...base, status: 'reembolsado', linhas: alvo.length, valor: soma(alvo) })
    } else {
      const alvo = linhas.filter(l => l.is_refunded)
      if (!alvo.length) { out.push({ ...base, status: 'nao_estava_reembolsado', linhas: linhas.length, valor: soma(linhas) }); continue }
      const ids = alvo.map(l => l.id)
      const up = await admin.from('telao_events').update({ is_refunded: false }).in('id', ids)
      if (up.error) { out.push({ ...base, status: 'erro', linhas: 0, valor: 0, mensagem: `Erro ao gravar: ${up.error.message}` }); continue }
      out.push({ ...base, status: 'desfeito', linhas: alvo.length, valor: soma(alvo) })
    }
  }
  return out
}
