import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { origin } = new URL(request.url)

  await supabase.auth.signOut()

  return NextResponse.redirect(`${origin}/`)
}
