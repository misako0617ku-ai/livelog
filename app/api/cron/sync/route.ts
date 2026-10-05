import { NextRequest, NextResponse } from 'next/server'

// Vercel Cronから呼ばれるエンドポイント
// 毎日自動でSTARTOのデータを取得してDBに保存する
export async function GET(req: NextRequest) {
  // Vercel Cronからのリクエストか確認（セキュリティ）
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 既存のスクレイパーAPIを内部で呼び出す
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/scrape/starto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()
    console.log('[Cron] STARTO sync result:', data)

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      result: data,
    })
  } catch (err) {
    console.error('[Cron] Sync failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
