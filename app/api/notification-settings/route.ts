import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = new Set(['fc', 'live', 'all'])
const VALID_DAYS = new Set([0, 3, 7, 14])

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_notification_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json(data ?? {
    notifications_enabled: false,
    notify_types: ['fc'],
    notify_days_before: [14, 7],
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { notifications_enabled, notify_types, notify_days_before } = body as Record<string, unknown>

  if (typeof notifications_enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid notifications_enabled' }, { status: 400 })
  }
  if (!Array.isArray(notify_types) || notify_types.some(t => !VALID_TYPES.has(t as string))) {
    return NextResponse.json({ error: 'Invalid notify_types' }, { status: 400 })
  }
  if (!Array.isArray(notify_days_before) || notify_days_before.some(d => !VALID_DAYS.has(d as number))) {
    return NextResponse.json({ error: 'Invalid notify_days_before' }, { status: 400 })
  }
  if (notifications_enabled && (notify_types.length === 0 || notify_days_before.length === 0)) {
    return NextResponse.json({ error: '通知種類とタイミングを1つ以上選択してください' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_notification_settings')
    .upsert({ user_id: user.id, notifications_enabled, notify_types, notify_days_before })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json(data)
}
