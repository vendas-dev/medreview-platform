import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ValidadorAlunoClient } from './ValidadorAlunoClient'

export default async function ValidadorAlunoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <ValidadorAlunoClient />
}
