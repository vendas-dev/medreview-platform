import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEAL_ID_VALIDADOR, URL_PADRAO, emailValido, lerResposta, normalizarEmail } from '@/lib/aluno/tipo'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Closer e superadmin (qualquer usuário logado com perfil). O disparo para o n8n sai SEMPRE do servidor: o navegador nunca fala com o webhook.
// URL: variável TIPO_ALUNO_WEBHOOK_URL (se existir) ou o endereço padrão da integração.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })
  const { data: perfil } = await supabase.from('profiles').select('id').eq('id', user.id).single()
  if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 })

  const corpo = await req.json().catch(() => null)
  const email = normalizarEmail(corpo?.email)
  if (!emailValido(email)) return NextResponse.json({ error: 'Digite um e-mail válido.' }, { status: 400 })

  const url = process.env.TIPO_ALUNO_WEBHOOK_URL || URL_PADRAO
  let r: Response
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, dealId: DEAL_ID_VALIDADOR }), cache: 'no-store', signal: AbortSignal.timeout(25_000) })
  } catch (e) {
    const nome = (e as { name?: string } | null)?.name
    const demorou = nome === 'TimeoutError' || nome === 'AbortError'
    return NextResponse.json({ error: demorou ? 'A integração demorou demais para responder. Tente de novo.' : 'Não consegui falar com a integração. Tente de novo em instantes.' }, { status: 504 })
  }
  const texto = await r.text()
  if (!r.ok) return NextResponse.json({ error: `A integração respondeu com erro (${r.status}).` }, { status: 502 })
  let json: unknown = null
  try { json = JSON.parse(texto) } catch { /* resposta vazia ou não-JSON */ }
  const resultado = lerResposta(json)
  if (!resultado) return NextResponse.json({ error: 'A integração respondeu em um formato que não reconheço.' }, { status: 502 })
  return NextResponse.json({ email, ...resultado })
}
