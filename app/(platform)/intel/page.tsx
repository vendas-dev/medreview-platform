// [visao-geral-oculta] A "Visão Geral" foi ocultada: quem chegar aqui (link antigo, favorito, clique em algum gráfico) vai para o dashboard.
// O código ORIGINAL desta página está guardado em page.original.txt (nesta mesma pasta).
// Para reativar a Visão Geral: apague este arquivo e renomeie page.original.txt para page.tsx.
// É um redirecionamento TEMPORÁRIO (o navegador não "decora" o destino), então reativar é só devolver o arquivo.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function IntelPage() {
  redirect('/dashboard')
}
