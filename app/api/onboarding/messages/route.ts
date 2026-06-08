import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ messages: [] })

  const { data } = await supabase
    .from('onboarding_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at')

  return NextResponse.json({ messages: data ?? [] })
}
