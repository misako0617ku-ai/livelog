import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('fan_club_memberships')
    .select('id, artist_id, joined_year_month, created_at, artist:artists(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { artist_id, joined_year_month } = body as Record<string, unknown>

  if (typeof artist_id !== 'string' || !UUID_RE.test(artist_id)) {
    return NextResponse.json({ error: 'Invalid artist_id' }, { status: 400 })
  }
  if (typeof joined_year_month !== 'string' || !YEAR_MONTH_RE.test(joined_year_month)) {
    return NextResponse.json({ error: 'Invalid joined_year_month (YYYY-MM)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fan_club_memberships')
    .insert({ user_id: user.id, artist_id, joined_year_month })
    .select('id, artist_id, joined_year_month, created_at, artist:artists(id, name)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'このアーティストはすでに登録済みです' }, { status: 409 })
    }
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
