import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('onboarding_settings').select('welcome_message')
    .eq('id', '00000000-0000-0000-0000-000000000001').single()
  return NextResponse.json({ message: (settings as any)?.welcome_message ?? 'Olá! Bem-vindo ao onboarding da MedReview!' })
}
