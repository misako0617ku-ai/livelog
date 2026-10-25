import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/scrape/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    console.log('[Cron] Labels sync result:', data)
    return NextResponse.json({ success: true, syncedAt: new Date().toISOString(), result: data })
  } catch (err) {
    console.error('[Cron] Labels sync failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
